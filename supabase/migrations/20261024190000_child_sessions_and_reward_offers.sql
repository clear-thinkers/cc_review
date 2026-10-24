-- Child-created packaged sessions + size-tiered reward picks
-- (roadmap item P; feature spec 2026-10-24-child-packaged-sessions-and-reward-picks.md).
--
-- Authorized 2026-10-24 (AI_CONTRACT.md §2). Contents:
--   1. ADDITIVE RLS policies so a CHILD can create review test sessions (and add targets
--      to) and delete sessions THEY created. No existing policy is edited or dropped:
--      parents and the platform admin keep exactly the rights they had.
--   2. New table shop_ingredient_reward_offers (RPC-only writes) + helper functions.
--   3. reward_session_ingredients now CREATES AN OFFER (3 candidates, the child picks
--      1/2/3 by Tested Count) instead of granting directly; new claim RPC grants the
--      pick and runs the mystery auto-unlock; new list RPC for walk-away claims.
--   4. reward_random_ingredients is no longer reachable by clients (it granted 3 random
--      ingredients per quiz session with no size check, which would bypass the tiers).
--   5. The direct-insert policy on shop_ingredient_rewards is DROPPED (owner-approved
--      2026-10-24): it let any signed-in user insert reward rows for themselves with no
--      quiz at all. The claim RPC (security definer) is now the only writer.
--
-- Reference implementation of the tier/claim rules: src/lib/rewardTiers.ts.

-- ---------------------------------------------------------------------------
-- 1. Child-scoped session RLS (additive)
-- ---------------------------------------------------------------------------

-- A child may create a CHARACTER session for their own family, attributed to themselves.
-- Paragraph-quiz sessions (paragraph_test_mode_id) stay parent-only.
create policy "review_test_sessions: child scoped insert"
on review_test_sessions for insert
with check (
  family_id = current_family_id()
  and current_jwt_role() = 'child'
  and created_by_user_id = current_user_id()
  and paragraph_test_mode_id is null
);

-- A child may add targets only to a session THEY created, and only plain character
-- targets (no phrase / paragraph targets).
create policy "review_test_session_targets: child scoped insert"
on review_test_session_targets for insert
with check (
  family_id = current_family_id()
  and current_jwt_role() = 'child'
  and vocab_phrase_id is null
  and paragraph_id is null
  and paragraph_span_id is null
  and exists (
    select 1
    from review_test_sessions s
    where s.id = review_test_session_targets.session_id
      and s.family_id = current_family_id()
      and s.created_by_user_id = current_user_id()
  )
);

-- A child may delete only the sessions they created (a parent's stay parent-only; the
-- existing parent-scoped delete policy already lets a parent delete any family session).
-- Targets and saved progress go with the session via ON DELETE CASCADE.
create policy "review_test_sessions: child scoped delete own"
on review_test_sessions for delete
using (
  family_id = current_family_id()
  and current_jwt_role() = 'child'
  and created_by_user_id = current_user_id()
);

-- ---------------------------------------------------------------------------
-- 2. Reward offers
-- ---------------------------------------------------------------------------
create table shop_ingredient_reward_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  quiz_session_id text not null unique references quiz_sessions(id) on delete cascade,
  is_win boolean not null,
  tested_count integer not null,
  picks_allowed integer not null check (picks_allowed between 1 and 3),
  -- [{ "ingredientKey": text, "quantity": int, "isMystery": bool }, ...] in offer order
  offers jsonb not null check (jsonb_typeof(offers) = 'array'),
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

create index shop_ingredient_reward_offers_pending_idx
  on shop_ingredient_reward_offers (user_id) where claimed_at is null;

alter table shop_ingredient_reward_offers enable row level security;

-- Read-only to the family. There is deliberately NO insert/update/delete policy: the
-- security-definer RPCs below are the only writers, so a client can never invent an
-- offer, change what is offered, or mark one claimed (same posture as cook_shop_recipe's tables).
create policy "shop_ingredient_reward_offers: family scoped read"
on shop_ingredient_reward_offers for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

-- Picks allowed by Tested Count (mirrors rewardPicksForTestedCount): <10 none, 10-19 one,
-- 20-29 two, >=30 three.
create or replace function ingredient_reward_picks(p_tested_count integer)
returns integer
language sql
immutable
as $$
  select case
    when p_tested_count is null or p_tested_count < 10 then 0
    when p_tested_count < 20 then 1
    when p_tested_count < 30 then 2
    else 3
  end;
$$;

-- One offer as the client-facing jsonb (labels/icons joined from the shared catalog).
create or replace function shop_reward_offer_json(p_offer_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'hasOffer', true,
    'quizSessionId', o.quiz_session_id,
    'isWin', o.is_win,
    'testedCount', o.tested_count,
    'picksAllowed', o.picks_allowed,
    'claimed', o.claimed_at is not null,
    'offers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'ingredientKey', t.e ->> 'ingredientKey',
          'labelI18n', sip.label_i18n,
          'iconPath', sip.icon_path,
          'quantity', coalesce((t.e ->> 'quantity')::integer, 1),
          'isMystery', coalesce((t.e ->> 'isMystery')::boolean, false)
        )
        order by t.ord
      )
      from jsonb_array_elements(o.offers) with ordinality as t(e, ord)
      left join shop_ingredient_prices sip on sip.ingredient_key = t.e ->> 'ingredientKey'
    ), '[]'::jsonb)
  )
  from shop_ingredient_reward_offers o
  where o.id = p_offer_id;
$$;

-- ---------------------------------------------------------------------------
-- 3a. reward_session_ingredients: create (or return) the offer. Grants NOTHING.
--     security definer: the offers table has no client write policy, so RLS is not a
--     backstop -- every query below is scoped to the caller explicitly.
-- ---------------------------------------------------------------------------
create or replace function reward_session_ingredients(
  p_quiz_session_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_offer_size constant integer := 3;
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
  v_role text;
  v_session quiz_sessions%rowtype;
  v_existing_id uuid;
  v_offer_id uuid;
  v_tested integer;
  v_tier_picks integer;
  v_is_win boolean := false;
  v_is_paragraph boolean := false;
  v_has_mystery_food boolean;
  v_food record;
  v_req record;
  v_keys text[] := '{}';
  v_amounts jsonb := '{}'::jsonb;
  v_key text;
  v_need integer;
  v_working integer;
  v_sets integer;
  v_target_sets integer;
  v_offers jsonb := '[]'::jsonb;
  v_offer_count integer;
begin
  if v_user_id is null or v_family_id is null then
    return jsonb_build_object('hasOffer', false);
  end if;

  select role into v_role from users where id = v_user_id;
  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return jsonb_build_object('hasOffer', false);
  end if;

  select * into v_session from quiz_sessions where id = p_quiz_session_id;
  if not found or v_session.user_id <> v_user_id then
    return jsonb_build_object('hasOffer', false);
  end if;

  -- Idempotency: one offer per quiz session; a repeat call returns it (claimed or not).
  select id into v_existing_id
  from shop_ingredient_reward_offers
  where quiz_session_id = p_quiz_session_id and user_id = v_user_id;
  if found then
    return shop_reward_offer_json(v_existing_id);
  end if;

  -- Tested Count = distinct hanzi in the saved grade data (what Quiz Results shows).
  v_tested := 0;
  if jsonb_typeof(v_session.grade_data) = 'array' then
    select count(distinct e ->> 'hanzi')::integer into v_tested
    from jsonb_array_elements(v_session.grade_data) e;
  end if;

  v_tier_picks := ingredient_reward_picks(v_tested);
  if v_tier_picks = 0 then
    return jsonb_build_object('hasOffer', false, 'testedCount', v_tested);
  end if;

  -- Win rule (mirrors isWinSession in src/lib/mysteryFood.ts).
  if jsonb_typeof(v_session.grade_data) = 'array' and jsonb_array_length(v_session.grade_data) > 0 then
    v_is_paragraph := exists (
      select 1 from jsonb_array_elements(v_session.grade_data) e
      where e ->> 'isParagraphBlank' = 'true'
    );
    if v_is_paragraph then
      v_is_win := not exists (
        select 1 from jsonb_array_elements(v_session.grade_data) e
        where coalesce(e ->> 'grade', '') <> 'easy'
      );
    else
      v_is_win := v_session.failed_count = 0 and v_session.total_grades > 0;
    end if;
  end if;

  select exists (
    select 1
    from shop_recipes sr
    where sr.is_mystery and sr.is_active
      and exists (select 1 from shop_recipe_base_requirements(sr.base_ingredients))
  ) into v_has_mystery_food;

  if v_is_win and v_has_mystery_food then
    -- Phase 1: top up unsatisfied types, closest-to-complete food first, then least-made,
    -- then display order. Need is measured against what the child held BEFORE this win.
    for v_food in
      select
        sr.id,
        sr.display_order,
        sr.base_ingredients,
        (select count(*) from shop_cooked_dishes d
           where d.user_id = v_user_id and d.recipe_id = sr.id) as made_count,
        (select count(*) from shop_recipe_base_requirements(sr.base_ingredients) q
           where shop_ingredient_available_count(v_user_id, q.ingredient_key) < q.quantity) as unsatisfied
      from shop_recipes sr
      where sr.is_mystery and sr.is_active
      order by unsatisfied asc, made_count asc, sr.display_order asc
    loop
      continue when v_food.unsatisfied = 0;

      for v_req in
        select * from shop_recipe_base_requirements(v_food.base_ingredients) order by sort_order
      loop
        v_key := v_req.ingredient_key;
        continue when coalesce(array_length(v_keys, 1), 0) >= c_offer_size and not (v_key = any (v_keys));

        v_need := v_req.quantity - shop_ingredient_available_count(v_user_id, v_key);
        continue when v_need <= 0;

        if v_key = any (v_keys) then
          if v_need > (v_amounts ->> v_key)::integer then
            v_amounts := jsonb_set(v_amounts, array[v_key], to_jsonb(v_need));
          end if;
        else
          v_keys := v_keys || v_key;
          v_amounts := jsonb_set(v_amounts, array[v_key], to_jsonb(v_need));
        end if;
      end loop;

      exit when coalesce(array_length(v_keys, 1), 0) >= c_offer_size;
    end loop;

    -- Phase 2: everything satisfied (or fewer than 3 types so far) -> stockpile another set.
    -- Fewest ingredient types first; ties picked at random.
    if coalesce(array_length(v_keys, 1), 0) < c_offer_size then
      for v_food in
        select
          sr.id,
          sr.base_ingredients,
          (select count(*) from shop_recipe_base_requirements(sr.base_ingredients)) as type_count
        from shop_recipes sr
        where sr.is_mystery and sr.is_active
          and exists (select 1 from shop_recipe_base_requirements(sr.base_ingredients))
        order by type_count asc, random()
      loop
        exit when coalesce(array_length(v_keys, 1), 0) >= c_offer_size;

        select min(
          floor(
            (shop_ingredient_available_count(v_user_id, q.ingredient_key)
              + coalesce((v_amounts ->> q.ingredient_key)::integer, 0))::numeric
            / q.quantity
          )
        )::integer
        into v_sets
        from shop_recipe_base_requirements(v_food.base_ingredients) q;

        v_target_sets := coalesce(v_sets, 0) + 1;

        for v_req in
          select * from shop_recipe_base_requirements(v_food.base_ingredients) order by sort_order
        loop
          exit when coalesce(array_length(v_keys, 1), 0) >= c_offer_size;
          v_key := v_req.ingredient_key;
          continue when v_key = any (v_keys);

          v_working := shop_ingredient_available_count(v_user_id, v_key);
          v_need := v_target_sets * v_req.quantity - v_working;
          continue when v_need <= 0;

          v_keys := v_keys || v_key;
          v_amounts := jsonb_set(v_amounts, array[v_key], to_jsonb(v_need));
        end loop;
      end loop;
    end if;

    if coalesce(array_length(v_keys, 1), 0) > 0 then
      select jsonb_agg(
        jsonb_build_object('ingredientKey', t.k, 'quantity', (v_amounts ->> t.k)::integer, 'isMystery', true)
        order by t.ord
      )
      into v_offers
      from unnest(v_keys) with ordinality as t(k, ord);
    end if;
  end if;

  -- Non-win, or a win with no mystery food available: three random distinct ingredients
  -- pooled across the caller's unlocked recipes (mystery ingredients excluded).
  if jsonb_array_length(v_offers) = 0 then
    select coalesce(jsonb_agg(
      jsonb_build_object('ingredientKey', p.key, 'quantity', 1, 'isMystery', false)
    ), '[]'::jsonb)
    into v_offers
    from (
      select pool.key
      from (
        select distinct (ingredient ->> 'ingredientKey') as key
        from shop_recipe_unlocks sru
        join shop_recipes sr on sr.id = sru.recipe_id
        cross join lateral jsonb_array_elements(coalesce(sr.base_ingredients, '[]'::jsonb)) as ingredient
        where sru.user_id = v_user_id
          and coalesce(ingredient ->> 'ingredientKey', '') <> ''
          and exists (
            select 1 from shop_ingredient_prices sip
            where sip.ingredient_key = ingredient ->> 'ingredientKey'
              and not sip.is_mystery
          )
      ) pool
      order by random()
      limit c_offer_size
    ) p;
  end if;

  v_offer_count := jsonb_array_length(v_offers);
  if v_offer_count = 0 then
    return jsonb_build_object('hasOffer', false, 'testedCount', v_tested);
  end if;

  insert into shop_ingredient_reward_offers (
    user_id, family_id, quiz_session_id, is_win, tested_count, picks_allowed, offers
  )
  values (
    v_user_id, v_family_id, p_quiz_session_id, v_is_win, v_tested,
    least(v_tier_picks, v_offer_count), v_offers
  )
  on conflict (quiz_session_id) do nothing
  returning id into v_offer_id;

  if v_offer_id is null then
    select id into v_offer_id from shop_ingredient_reward_offers where quiz_session_id = p_quiz_session_id;
  end if;

  return shop_reward_offer_json(v_offer_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3b. claim_session_ingredient_offer: grant the child's pick, once.
-- ---------------------------------------------------------------------------
create or replace function claim_session_ingredient_offer(
  p_quiz_session_id text,
  p_ingredient_keys text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
  v_role text;
  v_offer shop_ingredient_reward_offers%rowtype;
  v_offered_keys text[];
  v_selected text[];
  v_key text;
  v_has_mystery boolean;
  v_food record;
  v_unlock jsonb;
  v_unlocked uuid[] := '{}';
  v_granted jsonb;
begin
  if v_user_id is null or v_family_id is null then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select role into v_role from users where id = v_user_id;
  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  -- Lock the caller's own offer so two simultaneous claims can't both succeed.
  select * into v_offer
  from shop_ingredient_reward_offers
  where quiz_session_id = p_quiz_session_id and user_id = v_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'no_offer');
  end if;
  if v_offer.claimed_at is not null then
    return jsonb_build_object('success', false, 'code', 'already_claimed');
  end if;

  select coalesce(array_agg(e ->> 'ingredientKey'), '{}')
  into v_offered_keys
  from jsonb_array_elements(v_offer.offers) e;

  v_selected := coalesce(p_ingredient_keys, '{}');

  -- Exactly picks_allowed DISTINCT keys, every one of them actually offered.
  if cardinality(v_selected) <> v_offer.picks_allowed
     or (select count(distinct k) from unnest(v_selected) k) <> cardinality(v_selected)
     or exists (select 1 from unnest(v_selected) k where not (k = any (v_offered_keys)))
  then
    return jsonb_build_object('success', false, 'code', 'invalid_selection');
  end if;

  -- One ledger row per unit, at the offer's stored quantity (never the client's).
  foreach v_key in array v_selected loop
    insert into shop_ingredient_rewards (user_id, family_id, ingredient_key, quiz_session_id, rewarded_at)
    select v_user_id, v_family_id, v_key, p_quiz_session_id, now()
    from generate_series(1, (
      select coalesce((e ->> 'quantity')::integer, 1)
      from jsonb_array_elements(v_offer.offers) e
      where e ->> 'ingredientKey' = v_key
      limit 1
    ));
  end loop;

  update shop_ingredient_reward_offers set claimed_at = now() where id = v_offer.id;

  -- Mystery foods: unlock any whose set is now full (unlock_shop_recipe stays the only
  -- writer of shop_recipe_unlocks).
  select exists (
    select 1
    from jsonb_array_elements(v_offer.offers) e
    where e ->> 'ingredientKey' = any (v_selected)
      and coalesce((e ->> 'isMystery')::boolean, false)
  ) into v_has_mystery;

  if v_has_mystery then
    for v_food in
      select sr.id
      from shop_recipes sr
      where sr.is_mystery and sr.is_active
        and not exists (
          select 1 from shop_recipe_unlocks u
          where u.user_id = v_user_id and u.recipe_id = sr.id
        )
      order by sr.display_order
    loop
      v_unlock := unlock_shop_recipe(v_food.id);
      if coalesce((v_unlock ->> 'success')::boolean, false) then
        v_unlocked := v_unlocked || v_food.id;
      end if;
    end loop;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'ingredientKey', t.e ->> 'ingredientKey',
      'labelI18n', sip.label_i18n,
      'iconPath', sip.icon_path,
      'quantity', coalesce((t.e ->> 'quantity')::integer, 1),
      'isMystery', coalesce((t.e ->> 'isMystery')::boolean, false)
    )
    order by t.ord
  ), '[]'::jsonb)
  into v_granted
  from jsonb_array_elements(v_offer.offers) with ordinality as t(e, ord)
  left join shop_ingredient_prices sip on sip.ingredient_key = t.e ->> 'ingredientKey'
  where t.e ->> 'ingredientKey' = any (v_selected);

  return jsonb_build_object(
    'success', true,
    'code', 'claimed',
    'isWin', v_offer.is_win,
    'ingredients', v_granted,
    'unlockedRecipeIds', to_jsonb(v_unlocked)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3c. list_pending_ingredient_offers: the caller's unclaimed offers (walk-away recovery).
-- ---------------------------------------------------------------------------
create or replace function list_pending_ingredient_offers()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    jsonb_agg(shop_reward_offer_json(o.id) order by o.created_at),
    '[]'::jsonb
  )
  from shop_ingredient_reward_offers o
  where o.user_id = current_user_id()
    and o.claimed_at is null;
$$;

-- ---------------------------------------------------------------------------
-- 4. Close the old direct path: reward_random_ingredients granted 3 random ingredients
--    for ANY quiz session with no size check. Only the (definer) new flow may use it now.
-- ---------------------------------------------------------------------------
revoke execute on function reward_random_ingredients(text, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Close the direct-insert path on the rewards ledger. Before this, a child could insert
--    their own shop_ingredient_rewards rows through the API without finishing any quiz.
--    The app only ever READS this table from the client; the (definer) claim RPC writes it.
-- ---------------------------------------------------------------------------
drop policy "shop_ingredient_rewards: user scoped insert" on shop_ingredient_rewards;
