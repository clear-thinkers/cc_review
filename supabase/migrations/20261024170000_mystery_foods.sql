-- Mystery Foods (roadmap items L/M/N; feature spec 2026-10-24-mystery-foods.md).
--
-- A "mystery food" is a shop_recipes row flagged is_mystery whose base_ingredients are
-- "mystery ingredients" (shop_ingredient_prices rows flagged is_mystery). Mystery
-- ingredients can never be bought and never enter the random-reward pool; they are
-- granted only by reward_session_ingredients, for a "win" session. When a child holds
-- a full set the recipe unlocks automatically and for free -- via unlock_shop_recipe
-- itself, so it stays the ONLY writer of shop_recipe_unlocks (AI_CONTRACT.md §1).
--
-- Authorized 2026-10-24 (AI_CONTRACT.md §2): new columns/constraints, one new
-- RPC, and edits to unlock_shop_recipe / purchase_shop_ingredient /
-- reward_random_ingredients. No RLS policy is added or changed. cook_shop_recipe is
-- NOT touched: a mystery food's base_ingredients are consumed one food's worth per
-- cook exactly like any recipe's.
--
-- Reference implementation of the reward rules (kept in sync, tested there):
-- src/lib/mysteryFood.ts.

-- ---------------------------------------------------------------------------
-- 1. Columns and defence-in-depth constraints
-- ---------------------------------------------------------------------------
alter table shop_ingredient_prices
  add column is_mystery boolean not null default false;

alter table shop_recipes
  add column is_mystery boolean not null default false,
  add column teaser_i18n jsonb;

alter table shop_ingredient_prices
  add constraint shop_ingredient_prices_mystery_is_free
    check (not is_mystery or cost_coins = 0);

alter table shop_recipes
  add constraint shop_recipes_mystery_unlocks_free
    check (not is_mystery or unlock_cost_coins = 0);

-- ---------------------------------------------------------------------------
-- 2. Small shared helpers (read-only, security invoker -- RLS still applies)
-- ---------------------------------------------------------------------------

-- Spendable count of one ingredient for one user:
-- rewards + purchases - consumptions (same formula cook_shop_recipe uses).
create or replace function shop_ingredient_available_count(
  p_user_id uuid,
  p_ingredient_key text
)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select (
    (select count(*) from shop_ingredient_rewards
       where user_id = p_user_id and ingredient_key = p_ingredient_key)
    + (select count(*) from shop_ingredient_purchases
       where user_id = p_user_id and ingredient_key = p_ingredient_key)
    - (select count(*) from shop_ingredient_consumptions
       where user_id = p_user_id and ingredient_key = p_ingredient_key)
  )::integer;
$$;

-- A recipe's base-ingredient requirements, one row per distinct valid key
-- (quantities summed, recipe order preserved in `sort_order`). Entries with no
-- ingredientKey, a key missing from shop_ingredient_prices, or a non-positive
-- quantity are skipped -- same skip-invalid-silently precedent as cook_shop_recipe.
create or replace function shop_recipe_base_requirements(p_base_ingredients jsonb)
returns table (ingredient_key text, quantity integer, sort_order bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.ingredient ->> 'ingredientKey',
    sum(coalesce((t.ingredient ->> 'quantity')::integer, 1))::integer,
    min(t.ord)
  from jsonb_array_elements(coalesce(p_base_ingredients, '[]'::jsonb))
       with ordinality as t(ingredient, ord)
  where coalesce(t.ingredient ->> 'ingredientKey', '') <> ''
    and exists (
      select 1 from shop_ingredient_prices sip
      where sip.ingredient_key = t.ingredient ->> 'ingredientKey'
    )
  group by t.ingredient ->> 'ingredientKey'
  having sum(coalesce((t.ingredient ->> 'quantity')::integer, 1)) > 0;
$$;

-- ---------------------------------------------------------------------------
-- 3. unlock_shop_recipe: mystery branch (free, requires a full set)
--    Non-mystery behavior is byte-for-byte the 20260324120000 definition.
-- ---------------------------------------------------------------------------
create or replace function unlock_shop_recipe(p_recipe_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
  v_role text;
  v_recipe shop_recipes%rowtype;
  v_wallet wallets%rowtype;
  v_remaining_coins integer;
begin
  if v_user_id is null or v_family_id is null then
    return jsonb_build_object(
      'success', false,
      'code', 'forbidden',
      'recipeId', p_recipe_id,
      'remainingCoins', null,
      'coinsSpent', 0
    );
  end if;

  select role
  into v_role
  from users
  where id = v_user_id;

  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return jsonb_build_object(
      'success', false,
      'code', 'forbidden',
      'recipeId', p_recipe_id,
      'remainingCoins', null,
      'coinsSpent', 0
    );
  end if;

  select *
  into v_recipe
  from shop_recipes
  where id = p_recipe_id;

  if not found or not v_recipe.is_active then
    return jsonb_build_object(
      'success', false,
      'code', 'recipe_not_available',
      'recipeId', p_recipe_id,
      'remainingCoins', null,
      'coinsSpent', 0
    );
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_recipe.variant_icon_rules) as rule
    where lower(coalesce(rule ->> 'iconPath', '')) like '%plain%'
  ) then
    return jsonb_build_object(
      'success', false,
      'code', 'plain_icon_missing',
      'recipeId', p_recipe_id,
      'remainingCoins', null,
      'coinsSpent', 0
    );
  end if;

  -- Mystery foods: free, no wallet or coin-history rows, unlock only once the
  -- caller currently holds every base ingredient in full per-food quantity.
  if v_recipe.is_mystery then
    select total_coins into v_remaining_coins from wallets where user_id = v_user_id;

    if exists (
      select 1 from shop_recipe_unlocks
      where user_id = v_user_id and recipe_id = p_recipe_id
    ) then
      return jsonb_build_object(
        'success', false,
        'code', 'already_unlocked',
        'recipeId', p_recipe_id,
        'remainingCoins', v_remaining_coins,
        'coinsSpent', 0
      );
    end if;

    if not exists (select 1 from shop_recipe_base_requirements(v_recipe.base_ingredients))
       or exists (
         select 1
         from shop_recipe_base_requirements(v_recipe.base_ingredients) req
         where shop_ingredient_available_count(v_user_id, req.ingredient_key) < req.quantity
       ) then
      return jsonb_build_object(
        'success', false,
        'code', 'mystery_not_ready',
        'recipeId', p_recipe_id,
        'remainingCoins', v_remaining_coins,
        'coinsSpent', 0
      );
    end if;

    insert into shop_recipe_unlocks (user_id, family_id, recipe_id, coins_spent, unlocked_at)
    values (v_user_id, v_family_id, p_recipe_id, 0, now());

    return jsonb_build_object(
      'success', true,
      'code', 'unlocked',
      'recipeId', p_recipe_id,
      'remainingCoins', v_remaining_coins,
      'coinsSpent', 0
    );
  end if;

  insert into wallets (user_id, family_id, total_coins, last_updated_at, version)
  values (v_user_id, v_family_id, 0, now(), 1)
  on conflict (user_id) do nothing;

  select *
  into v_wallet
  from wallets
  where user_id = v_user_id
  for update;

  if exists (
    select 1
    from shop_recipe_unlocks
    where user_id = v_user_id
      and recipe_id = p_recipe_id
  ) then
    return jsonb_build_object(
      'success', false,
      'code', 'already_unlocked',
      'recipeId', p_recipe_id,
      'remainingCoins', coalesce(v_wallet.total_coins, 0),
      'coinsSpent', 0
    );
  end if;

  if coalesce(v_wallet.total_coins, 0) < v_recipe.unlock_cost_coins then
    return jsonb_build_object(
      'success', false,
      'code', 'insufficient_coins',
      'recipeId', p_recipe_id,
      'remainingCoins', coalesce(v_wallet.total_coins, 0),
      'coinsSpent', 0
    );
  end if;

  insert into shop_recipe_unlocks (
    user_id,
    family_id,
    recipe_id,
    coins_spent,
    unlocked_at
  )
  values (
    v_user_id,
    v_family_id,
    p_recipe_id,
    v_recipe.unlock_cost_coins,
    now()
  );

  update wallets
  set
    total_coins = total_coins - v_recipe.unlock_cost_coins,
    last_updated_at = now(),
    version = coalesce(version, 1) + 1
  where user_id = v_user_id
  returning total_coins into v_remaining_coins;

  insert into shop_coin_transactions (
    user_id,
    family_id,
    recipe_id,
    action_type,
    coins_spent,
    beginning_balance,
    ending_balance
  )
  values (
    v_user_id,
    v_family_id,
    p_recipe_id,
    'unlock_recipe',
    v_recipe.unlock_cost_coins,
    coalesce(v_wallet.total_coins, 0),
    v_remaining_coins
  );

  return jsonb_build_object(
    'success', true,
    'code', 'unlocked',
    'recipeId', p_recipe_id,
    'remainingCoins', v_remaining_coins,
    'coinsSpent', v_recipe.unlock_cost_coins
  );
exception
  when unique_violation then
    select total_coins
    into v_remaining_coins
    from wallets
    where user_id = v_user_id;

    return jsonb_build_object(
      'success', false,
      'code', 'already_unlocked',
      'recipeId', p_recipe_id,
      'remainingCoins', v_remaining_coins,
      'coinsSpent', 0
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. purchase_shop_ingredient: mystery ingredients are never for sale
--    (reports the existing 'ingredient_not_available' code). Otherwise identical
--    to the 20260823010000 definition.
-- ---------------------------------------------------------------------------
create or replace function purchase_shop_ingredient(
  p_recipe_id uuid,
  p_ingredient_key text,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
  v_role text;
  v_price shop_ingredient_prices%rowtype;
  v_wallet wallets%rowtype;
  v_total_cost integer;
  v_remaining_coins integer;
begin
  if v_user_id is null or v_family_id is null then
    return jsonb_build_object(
      'success', false,
      'code', 'forbidden',
      'recipeId', p_recipe_id,
      'ingredientKey', p_ingredient_key,
      'remainingCoins', null,
      'coinsSpent', 0,
      'quantity', 0
    );
  end if;

  select role
  into v_role
  from users
  where id = v_user_id;

  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return jsonb_build_object(
      'success', false,
      'code', 'forbidden',
      'recipeId', p_recipe_id,
      'ingredientKey', p_ingredient_key,
      'remainingCoins', null,
      'coinsSpent', 0,
      'quantity', 0
    );
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 99 then
    return jsonb_build_object(
      'success', false,
      'code', 'invalid_quantity',
      'recipeId', p_recipe_id,
      'ingredientKey', p_ingredient_key,
      'remainingCoins', null,
      'coinsSpent', 0,
      'quantity', 0
    );
  end if;

  select *
  into v_price
  from shop_ingredient_prices
  where ingredient_key = p_ingredient_key;

  if not found or v_price.is_mystery then
    return jsonb_build_object(
      'success', false,
      'code', 'ingredient_not_available',
      'recipeId', p_recipe_id,
      'ingredientKey', p_ingredient_key,
      'remainingCoins', null,
      'coinsSpent', 0,
      'quantity', 0
    );
  end if;

  if not exists (
    select 1 from shop_recipes where id = p_recipe_id and is_active = true
  ) then
    return jsonb_build_object(
      'success', false,
      'code', 'recipe_not_available',
      'recipeId', p_recipe_id,
      'ingredientKey', p_ingredient_key,
      'remainingCoins', null,
      'coinsSpent', 0,
      'quantity', 0
    );
  end if;

  if not exists (
    select 1
    from shop_recipe_unlocks
    where user_id = v_user_id
      and recipe_id = p_recipe_id
  ) then
    return jsonb_build_object(
      'success', false,
      'code', 'recipe_not_unlocked',
      'recipeId', p_recipe_id,
      'ingredientKey', p_ingredient_key,
      'remainingCoins', null,
      'coinsSpent', 0,
      'quantity', 0
    );
  end if;

  insert into wallets (user_id, family_id, total_coins, last_updated_at, version)
  values (v_user_id, v_family_id, 0, now(), 1)
  on conflict (user_id) do nothing;

  select *
  into v_wallet
  from wallets
  where user_id = v_user_id
  for update;

  v_total_cost := v_price.cost_coins * p_quantity;

  if coalesce(v_wallet.total_coins, 0) < v_total_cost then
    return jsonb_build_object(
      'success', false,
      'code', 'insufficient_coins',
      'recipeId', p_recipe_id,
      'ingredientKey', p_ingredient_key,
      'remainingCoins', coalesce(v_wallet.total_coins, 0),
      'coinsSpent', 0,
      'quantity', 0
    );
  end if;

  insert into shop_ingredient_purchases (user_id, family_id, recipe_id, ingredient_key, coins_spent, purchased_at)
  select v_user_id, v_family_id, p_recipe_id, p_ingredient_key, v_price.cost_coins, now()
  from generate_series(1, p_quantity);

  update wallets
  set
    total_coins = total_coins - v_total_cost,
    last_updated_at = now(),
    version = coalesce(version, 1) + 1
  where user_id = v_user_id
  returning total_coins into v_remaining_coins;

  insert into shop_coin_transactions (
    user_id,
    family_id,
    recipe_id,
    ingredient_key,
    action_type,
    coins_spent,
    beginning_balance,
    ending_balance
  )
  values (
    v_user_id,
    v_family_id,
    p_recipe_id,
    p_ingredient_key,
    'purchase_ingredient',
    v_total_cost,
    coalesce(v_wallet.total_coins, 0),
    v_remaining_coins
  );

  return jsonb_build_object(
    'success', true,
    'code', 'purchased',
    'recipeId', p_recipe_id,
    'ingredientKey', p_ingredient_key,
    'remainingCoins', v_remaining_coins,
    'coinsSpent', v_total_cost,
    'quantity', p_quantity
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. reward_random_ingredients: mystery ingredients never enter the random pool
--    (an unlocked mystery food's base_ingredients would otherwise leak into it).
--    Otherwise identical to the 20260822000000 definition.
-- ---------------------------------------------------------------------------
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
          and not sip.is_mystery
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

-- ---------------------------------------------------------------------------
-- 6. reward_session_ingredients: the single reward entry point for a completed
--    packaged session. Server-side win determination; win -> mystery ingredients
--    (replacing the random reward), non-win -> the existing random reward.
-- ---------------------------------------------------------------------------
create or replace function reward_session_ingredients(
  p_quiz_session_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  c_quota constant integer := 3;
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
  v_role text;
  v_session quiz_sessions%rowtype;
  v_is_win boolean := false;
  v_is_paragraph boolean := false;
  v_food record;
  v_req record;
  v_keys text[] := '{}';
  v_amounts jsonb := '{}'::jsonb;
  v_key text;
  v_need integer;
  v_working integer;
  v_sets integer;
  v_target_sets integer;
  v_unlock jsonb;
  v_unlocked uuid[] := '{}';
  v_ingredients jsonb := '[]'::jsonb;
  v_has_mystery_food boolean;
begin
  if v_user_id is null or v_family_id is null then
    return jsonb_build_object('isWin', false, 'ingredients', '[]'::jsonb, 'unlockedRecipeIds', '[]'::jsonb);
  end if;

  select role into v_role from users where id = v_user_id;
  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return jsonb_build_object('isWin', false, 'ingredients', '[]'::jsonb, 'unlockedRecipeIds', '[]'::jsonb);
  end if;

  select * into v_session from quiz_sessions where id = p_quiz_session_id;
  if not found or v_session.user_id <> v_user_id then
    return jsonb_build_object('isWin', false, 'ingredients', '[]'::jsonb, 'unlockedRecipeIds', '[]'::jsonb);
  end if;

  -- Idempotency: a retried/duplicated call for the same session mints nothing.
  if exists (
    select 1 from shop_ingredient_rewards where quiz_session_id = p_quiz_session_id
  ) then
    return jsonb_build_object('isWin', false, 'ingredients', '[]'::jsonb, 'unlockedRecipeIds', '[]'::jsonb);
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

  -- Non-win, or a win with no mystery food available: the regular random reward.
  if not (v_is_win and v_has_mystery_food) then
    return jsonb_build_object(
      'isWin', v_is_win,
      'ingredients', coalesce((
        select jsonb_agg(jsonb_build_object(
          'ingredientKey', r.ingredient_key,
          'labelI18n', r.label_i18n,
          'iconPath', r.icon_path,
          'quantity', 1,
          'isMystery', false
        ))
        from reward_random_ingredients(p_quiz_session_id) r
      ), '[]'::jsonb),
      'unlockedRecipeIds', '[]'::jsonb
    );
  end if;

  -- Phase 1: top up unsatisfied types, closest-to-complete food first, then
  -- least-made (never-made = 0 wins ties), then display order. Need is measured
  -- against what the child held BEFORE this win.
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
      continue when coalesce(array_length(v_keys, 1), 0) >= c_quota and not (v_key = any (v_keys));

      v_need := v_req.quantity - shop_ingredient_available_count(v_user_id, v_key);
      continue when v_need <= 0;

      if v_key = any (v_keys) then
        -- Shared ingredient already chosen this win: keep the larger need, no new slot.
        if v_need > (v_amounts ->> v_key)::integer then
          v_amounts := jsonb_set(v_amounts, array[v_key], to_jsonb(v_need));
        end if;
      else
        v_keys := v_keys || v_key;
        v_amounts := jsonb_set(v_amounts, array[v_key], to_jsonb(v_need));
      end if;
    end loop;

    exit when coalesce(array_length(v_keys, 1), 0) >= c_quota;
  end loop;

  -- Phase 2: every food satisfied (or quota not yet met) -> stockpile another
  -- full set. Fewest ingredient types first; ties picked at random.
  if coalesce(array_length(v_keys, 1), 0) < c_quota then
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
      exit when coalesce(array_length(v_keys, 1), 0) >= c_quota;

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
        exit when coalesce(array_length(v_keys, 1), 0) >= c_quota;
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

  -- Nothing to grant (should not happen with >= 1 valid mystery food): fall back.
  if coalesce(array_length(v_keys, 1), 0) = 0 then
    return jsonb_build_object(
      'isWin', true,
      'ingredients', coalesce((
        select jsonb_agg(jsonb_build_object(
          'ingredientKey', r.ingredient_key,
          'labelI18n', r.label_i18n,
          'iconPath', r.icon_path,
          'quantity', 1,
          'isMystery', false
        ))
        from reward_random_ingredients(p_quiz_session_id) r
      ), '[]'::jsonb),
      'unlockedRecipeIds', '[]'::jsonb
    );
  end if;

  -- Persist: one ledger row per unit (existing shop_ingredient_rewards convention).
  foreach v_key in array v_keys loop
    insert into shop_ingredient_rewards (user_id, family_id, ingredient_key, quiz_session_id, rewarded_at)
    select v_user_id, v_family_id, v_key, p_quiz_session_id, now()
    from generate_series(1, (v_amounts ->> v_key)::integer);
  end loop;

  -- Auto-unlock: any active mystery food not yet unlocked whose set is now full.
  -- unlock_shop_recipe stays the only writer of shop_recipe_unlocks.
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'ingredientKey', sip.ingredient_key,
    'labelI18n', sip.label_i18n,
    'iconPath', sip.icon_path,
    'quantity', (v_amounts ->> sip.ingredient_key)::integer,
    'isMystery', sip.is_mystery
  ) order by array_position(v_keys, sip.ingredient_key)), '[]'::jsonb)
  into v_ingredients
  from shop_ingredient_prices sip
  where sip.ingredient_key = any (v_keys);

  return jsonb_build_object(
    'isWin', true,
    'ingredients', v_ingredients,
    'unlockedRecipeIds', to_jsonb(v_unlocked)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Launch content: Crystal Dumplings + its four mystery ingredients
--    (art: public/ingredients/<key>.png, public/rewards/crystal-dumpling_plain.png)
-- ---------------------------------------------------------------------------
insert into shop_ingredient_prices (ingredient_key, cost_coins, label_i18n, icon_path, is_mystery)
values
  ('imperial-wheat-starch', 0, '{"en":"Imperial Wheat Starch","zh":"御膳澄粉"}'::jsonb, '/ingredients/imperial-wheat-starch.png', true),
  ('wild-tiger-prawn',      0, '{"en":"Wild Tiger Prawn","zh":"野生虎头虾"}'::jsonb,     '/ingredients/wild-tiger-prawn.png',      true),
  ('spring-bamboo-shoot',   0, '{"en":"Spring Bamboo Shoot","zh":"翡翠春笋"}'::jsonb,   '/ingredients/spring-bamboo-shoot.png',   true),
  ('gilded-sesame-oil',     0, '{"en":"Gilded Sesame Oil","zh":"金箔香油"}'::jsonb,     '/ingredients/gilded-sesame-oil.png',     true)
on conflict (ingredient_key) do nothing;

insert into shop_recipes (
  slug, title, title_i18n, display_order, is_active,
  intro, intro_i18n, unlock_cost_coins,
  base_ingredients, base_ingredients_i18n,
  special_ingredient_slots, special_ingredient_slots_i18n,
  variant_icon_rules, cook_method, food_type,
  is_mystery, teaser_i18n
)
values (
  'crystal-dumpling',
  'Crystal Dumplings',
  '{"en":"Crystal Dumplings","zh":"水晶虾饺"}'::jsonb,
  14,
  true,
  'Translucent jade dumplings glowing with sweet tiger prawns and bamboo. A bite of pure imperial magic!',
  '{"en":"Translucent jade dumplings glowing with sweet tiger prawns and bamboo. A bite of pure imperial magic!","zh":"晶莹剔透的水晶皮，裹着鲜甜脆嫩的笋尖虾仁，像发光的小宝盒！"}'::jsonb,
  0,
  '[{"ingredientKey":"imperial-wheat-starch","name":"Imperial Wheat Starch","quantity":2},{"ingredientKey":"wild-tiger-prawn","name":"Wild Tiger Prawn","quantity":2},{"ingredientKey":"spring-bamboo-shoot","name":"Spring Bamboo Shoot","quantity":1},{"ingredientKey":"gilded-sesame-oil","name":"Gilded Sesame Oil","quantity":1}]'::jsonb,
  '{"en":[{"ingredientKey":"imperial-wheat-starch","name":"Imperial Wheat Starch","quantity":2},{"ingredientKey":"wild-tiger-prawn","name":"Wild Tiger Prawn","quantity":2},{"ingredientKey":"spring-bamboo-shoot","name":"Spring Bamboo Shoot","quantity":1},{"ingredientKey":"gilded-sesame-oil","name":"Gilded Sesame Oil","quantity":1}],"zh":[{"ingredientKey":"imperial-wheat-starch","name":"御膳澄粉","quantity":2},{"ingredientKey":"wild-tiger-prawn","name":"野生虎头虾","quantity":2},{"ingredientKey":"spring-bamboo-shoot","name":"翡翠春笋","quantity":1},{"ingredientKey":"gilded-sesame-oil","name":"金箔香油","quantity":1}]}'::jsonb,
  '[]'::jsonb,
  '{"en":[],"zh":[]}'::jsonb,
  '[{"match":[],"iconPath":"/rewards/crystal-dumpling_plain.png"}]'::jsonb,
  'stove',
  'hotmeal',
  true,
  '{"en":"A royal bamboo steamer hides a secret treasure glowing like jade.","zh":"神秘的蒸笼里，藏着一道像玉石般透亮发光的点心。"}'::jsonb
);
