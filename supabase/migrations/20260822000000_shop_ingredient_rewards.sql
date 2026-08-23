-- Paragraph Quiz Ingredient Reward (feature spec 2026-08-22-paragraph-quiz-ingredient-reward.md)
--
-- Append-only ledger of ingredients a child has been rewarded for finishing a
-- paragraph quiz. One row per rewarded ingredient (not per reward event) --
-- "how many of ingredient X does this child have" is derived by counting
-- matching rows, mirroring quiz_sessions/shop_coin_transactions/
-- coin_redemptions' existing insert-only-ledger convention.
create table shop_ingredient_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  ingredient_key text not null references shop_ingredient_prices(ingredient_key),
  quiz_session_id text not null references quiz_sessions(id) on delete cascade,
  rewarded_at timestamptz not null default now()
);

alter table shop_ingredient_rewards enable row level security;

create index shop_ingredient_rewards_user_id_idx on shop_ingredient_rewards(user_id);
create index shop_ingredient_rewards_quiz_session_id_idx on shop_ingredient_rewards(quiz_session_id);

create policy "shop_ingredient_rewards: family scoped read"
on shop_ingredient_rewards for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

-- No update/delete policy for non-admins -- immutable, matching quiz_sessions/
-- coin_redemptions. Insert is scoped to the caller's own row (same shape as
-- shop_recipe_unlocks/review_session_progress); reward_random_ingredients
-- below is the only path the app actually calls, exactly the same trust
-- model unlock_shop_recipe already has (the RPC supplies the real
-- validation/pool/idempotency logic, RLS supplies who's allowed to write).
create policy "shop_ingredient_rewards: user scoped insert"
on shop_ingredient_rewards for insert
with check (
  is_platform_admin()
  or (family_id = current_family_id() and user_id = current_user_id())
);

-- Rewards up to p_requested_count (default 3) distinct ingredients, pooled
-- across every recipe the caller has unlocked, and persists them. Server-side
-- only: the caller never supplies which ingredients are chosen. Mirrors
-- unlock_shop_recipe's security invoker + explicit role-check shape rather
-- than security definer, for consistency with every other shop RPC in this
-- codebase (unlock_shop_recipe, redeem_coins).
--
-- Pool source is base_ingredients only, NOT special_ingredient_slots --
-- special_ingredient_slots rows are cosmetic reward-icon variant selectors
-- (slotKey/options[].key, e.g. "wink_jelly", "spark_pop"), never real
-- shop_ingredient_prices-catalog ingredientKey values. Confirmed by reading
-- shop_recipes' actual seeded JSON shape before writing this query.
create or replace function reward_random_ingredients(
  p_quiz_session_id text,
  p_requested_count int default 3
)
returns table (ingredient_key text, label_i18n jsonb, icon_path text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
  v_role text;
  v_session_owner uuid;
begin
  if v_user_id is null or v_family_id is null then
    return;
  end if;

  select role
  into v_role
  from users
  where id = v_user_id;

  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return;
  end if;

  select user_id
  into v_session_owner
  from quiz_sessions
  where id = p_quiz_session_id;

  if v_session_owner is null or v_session_owner <> v_user_id then
    return;
  end if;

  -- Idempotency guard: a retried/duplicated call for the same session must
  -- never mint a second set of rewards.
  if exists (
    select 1
    from shop_ingredient_rewards
    where quiz_session_id = p_quiz_session_id
  ) then
    return;
  end if;

  return query
  with unlocked_ingredients as (
    select ingredient
    from shop_recipe_unlocks sru
    join shop_recipes sr on sr.id = sru.recipe_id
    cross join lateral jsonb_array_elements(coalesce(sr.base_ingredients, '[]'::jsonb)) as ingredient
    where sru.user_id = v_user_id
  ),
  pool as (
    select distinct (ingredient ->> 'ingredientKey') as key
    from unlocked_ingredients
    where coalesce(ingredient ->> 'ingredientKey', '') <> ''
      and exists (
        select 1
        from shop_ingredient_prices sip
        where sip.ingredient_key = ingredient ->> 'ingredientKey'
      )
  ),
  picked as (
    select key
    from pool
    order by random()
    limit greatest(p_requested_count, 0)
  ),
  inserted as (
    insert into shop_ingredient_rewards (user_id, family_id, ingredient_key, quiz_session_id, rewarded_at)
    select v_user_id, v_family_id, picked.key, p_quiz_session_id, now()
    from picked
    returning shop_ingredient_rewards.ingredient_key as key
  )
  select sip.ingredient_key, sip.label_i18n, sip.icon_path
  from inserted
  join shop_ingredient_prices sip on sip.ingredient_key = inserted.key;
end;
$$;
