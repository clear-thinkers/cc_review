-- Shop Kitchen: countertop/organize redesign (feature spec 2026-08-23-kitchen-page.md, Revision)
--
-- `20260823000000_shop_kitchen.sql` (the original Shop Kitchen migration)
-- has already been applied to dev, so this is a forward migration on top of
-- it, not an edit to that file. It does three things:
--
--   1. Fixes a real RLS gap scripts/verify-rls.ts Section 10 caught live on
--      dev: shop_ingredient_consumptions had a caller-scoped INSERT policy
--      copied from shop_ingredient_rewards' own "defense in depth" pattern.
--      That pattern only makes sense for a SECURITY INVOKER RPC that needs
--      an RLS policy to write through (reward_random_ingredients). Both
--      cook_shop_recipe and the new organize_shop_kitchen_countertop below
--      are SECURITY DEFINER and bypass RLS entirely -- they need no insert
--      policy to function, so keeping one was pure unnecessary attack
--      surface (a child could INSERT arbitrary consumption rows directly,
--      artificially depleting their own available-ingredient count; low
--      severity, but a genuine contradiction of "the RPC is the only
--      writer, full stop"). Dropped outright.
--   2. Replaces `shop_cooked_dishes.shelf_category` (four child-chosen
--      categories) with `location` ('countertop' | 'shelf') -- shelf
--      sorting is no longer a per-dish choice, see (3).
--   3. Adds `shop_recipes.food_type` -- an admin-configured recipe property
--      (independent of cook_method) that now decides which of the shelf's
--      three tabs (Drinks/Hot Meal/Desserts) a shelved dish displays under,
--      replacing the original move_shop_cooked_dish(dishId, shelfCategory)
--      RPC with organize_shop_kitchen_countertop() -- no parameters, bulk-
--      moves every countertop dish to the shelf in one call.

-- 1. Drop the stray shop_ingredient_consumptions insert policy (see header).
drop policy if exists "shop_ingredient_consumptions: user scoped insert" on shop_ingredient_consumptions;

-- 2. shop_recipes.food_type -- nullable; independent of cook_method. Shop
--    Admin requires this whenever cook_method is set (a cookable recipe
--    must be sortable -- the shelf has no "unsorted" fallback tab).
alter table shop_recipes
  add column food_type text check (food_type in ('drinks', 'hotmeal', 'desserts'));

-- 3. shop_cooked_dishes.shelf_category -> location. Existing rows (test/dev
--    data only -- this feature has not been live-QA'd with real families
--    yet) map 'default' -> 'countertop' and every other prior value ->
--    'shelf', since organizing is now all-or-nothing rather than
--    per-category.
update shop_cooked_dishes
set shelf_category = case when shelf_category = 'default' then 'countertop' else 'shelf' end;

alter table shop_cooked_dishes
  drop constraint if exists shop_cooked_dishes_shelf_category_check;

alter table shop_cooked_dishes
  rename column shelf_category to location;

alter table shop_cooked_dishes
  alter column location set default 'countertop';

alter table shop_cooked_dishes
  add constraint shop_cooked_dishes_location_check check (location in ('countertop', 'shelf'));

-- 4. Drop the old per-dish move RPC -- superseded by
--    organize_shop_kitchen_countertop() below, which has no per-dish
--    variant at all.
drop function if exists move_shop_cooked_dish(uuid, text);

-- 5. cook_shop_recipe -- redefined in place (still SECURITY DEFINER, same
--    reasoning as the original migration). Adds a countertop capacity check
--    (SHOP_KITCHEN_COUNTERTOP_CAPACITY = 6 in src/lib/shop.types.ts, kept in
--    sync by hand) before the ingredient check, and inserts with
--    location = 'countertop' instead of shelf_category = 'default'. Also
--    now counts shop_ingredient_purchases toward availability alongside
--    shop_ingredient_rewards, matching what the Kitchen UI's own readiness
--    display already did (a client/server consistency gap found while
--    writing this migration).
create or replace function cook_shop_recipe(
  p_recipe_id uuid
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
  v_recipe shop_recipes%rowtype;
  v_dish_id uuid;
  v_missing jsonb;
begin
  if v_user_id is null or v_family_id is null then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select role into v_role from users where id = v_user_id;
  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select * into v_recipe from shop_recipes where id = p_recipe_id;
  if not found or not v_recipe.is_active or v_recipe.cook_method is null then
    return jsonb_build_object('success', false, 'code', 'recipe_not_cookable');
  end if;

  if not exists (
    select 1 from shop_recipe_unlocks
    where user_id = v_user_id and recipe_id = p_recipe_id
  ) then
    return jsonb_build_object('success', false, 'code', 'recipe_not_unlocked');
  end if;

  -- Countertop capacity, checked before ingredient availability so a full
  -- countertop always reports as full, not as an ingredient shortfall.
  if (
    select count(*) from shop_cooked_dishes
    where user_id = v_user_id and location = 'countertop'
  ) >= 6 then
    return jsonb_build_object('success', false, 'code', 'countertop_full');
  end if;

  -- Required quantities per ingredient key, skipping entries with no
  -- resolvable ingredientKey or one no longer in shop_ingredient_prices --
  -- same skip-invalid-silently precedent as reward_random_ingredients. No
  -- temp table (see the original migration's reasoning) -- the same small
  -- CTE is recomputed in both statements below.
  if not exists (
    select 1
    from jsonb_array_elements(coalesce(v_recipe.base_ingredients, '[]'::jsonb)) as ingredient
    where coalesce(ingredient ->> 'ingredientKey', '') <> ''
      and exists (
        select 1 from shop_ingredient_prices sip
        where sip.ingredient_key = ingredient ->> 'ingredientKey'
      )
  ) then
    return jsonb_build_object('success', false, 'code', 'recipe_not_cookable');
  end if;

  select coalesce(jsonb_agg(req.ingredient_key), '[]'::jsonb)
  into v_missing
  from (
    select
      ingredient ->> 'ingredientKey' as ingredient_key,
      sum(coalesce((ingredient ->> 'quantity')::integer, 1)) as required_qty
    from jsonb_array_elements(coalesce(v_recipe.base_ingredients, '[]'::jsonb)) as ingredient
    where coalesce(ingredient ->> 'ingredientKey', '') <> ''
      and exists (
        select 1 from shop_ingredient_prices sip
        where sip.ingredient_key = ingredient ->> 'ingredientKey'
      )
    group by ingredient ->> 'ingredientKey'
  ) req
  where (
    (select count(*) from shop_ingredient_rewards
      where user_id = v_user_id and ingredient_key = req.ingredient_key)
    +
    (select count(*) from shop_ingredient_purchases
      where user_id = v_user_id and ingredient_key = req.ingredient_key)
    -
    (select count(*) from shop_ingredient_consumptions
      where user_id = v_user_id and ingredient_key = req.ingredient_key)
  ) < req.required_qty;

  if jsonb_array_length(v_missing) > 0 then
    return jsonb_build_object(
      'success', false,
      'code', 'insufficient_ingredients',
      'missingIngredientKeys', v_missing
    );
  end if;

  insert into shop_cooked_dishes (user_id, family_id, recipe_id, location, cooked_at)
  values (v_user_id, v_family_id, p_recipe_id, 'countertop', now())
  returning id into v_dish_id;

  insert into shop_ingredient_consumptions (user_id, family_id, ingredient_key, cooked_dish_id, consumed_at)
  select v_user_id, v_family_id, req.ingredient_key, v_dish_id, now()
  from (
    select
      ingredient ->> 'ingredientKey' as ingredient_key,
      sum(coalesce((ingredient ->> 'quantity')::integer, 1)) as required_qty
    from jsonb_array_elements(coalesce(v_recipe.base_ingredients, '[]'::jsonb)) as ingredient
    where coalesce(ingredient ->> 'ingredientKey', '') <> ''
      and exists (
        select 1 from shop_ingredient_prices sip
        where sip.ingredient_key = ingredient ->> 'ingredientKey'
      )
    group by ingredient ->> 'ingredientKey'
  ) req,
  lateral generate_series(1, req.required_qty);

  return jsonb_build_object(
    'success', true,
    'code', 'cooked',
    'dishId', v_dish_id,
    'recipeId', p_recipe_id,
    'location', 'countertop'
  );
end;
$$;

-- 6. organize_shop_kitchen_countertop -- SECURITY DEFINER, same reasoning
--    as cook_shop_recipe. Bulk-moves every one of the caller's countertop
--    dishes to the shelf in a single call -- no per-dish variant, since the
--    child never chooses a destination category (that's derived from each
--    dish's recipe's food_type at read time, client-side).
create or replace function organize_shop_kitchen_countertop()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_role text;
  v_moved_count integer;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select role into v_role from users where id = v_user_id;
  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  with moved as (
    update shop_cooked_dishes
    set location = 'shelf'
    where user_id = v_user_id and location = 'countertop'
    returning id
  )
  select count(*) into v_moved_count from moved;

  return jsonb_build_object('success', true, 'code', 'organized', 'movedCount', v_moved_count);
end;
$$;
