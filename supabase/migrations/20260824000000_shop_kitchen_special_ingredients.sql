-- Shop Kitchen: special-ingredient variants (feature spec 2026-08-23-kitchen-page.md, Revision 2)
--
-- `20260823020000_shop_kitchen_countertop_redesign.sql` was already applied
-- to dev by the time this was written -- confirmed live via
-- `supabase db query --linked` (cook_shop_recipe(p_recipe_id uuid) was the
-- only deployed signature, and shop_cooked_dishes had no
-- special_ingredient_keys column) -- so this is a forward migration on top
-- of it, not an edit to that file.
--
-- Lets a child add a recipe's admin-configured special ingredients
-- (`shop_recipes.special_ingredient_slots`) when cooking, producing a
-- variant dish. Matching against `variant_icon_rules` to decide which icon
-- a dish displays is a pure read-time/display-layer concern
-- (resolveShopRecipeIconPath in src/lib/shop.ts, the same
-- subset-match-prefer-most-specific algorithm ShopSection.tsx already uses
-- for the recipe-wall variant display) -- this migration only records the
-- raw ingredient keys used and consumes them; an unmatched combination
-- still consumes ingredients and simply resolves to the plain icon at read
-- time, no special "no match" branch needed here.

-- 1. shop_cooked_dishes.special_ingredient_keys -- which of the recipe's own
--    special_ingredient_slots keys the child chose to add when cooking this
--    specific dish, e.g. '["chocolate","sugar-sprinkles"]'. Raw facts only.
alter table shop_cooked_dishes
  add column special_ingredient_keys jsonb not null default '[]'::jsonb;

-- 2. cook_shop_recipe gains an optional p_special_ingredient_keys param
--    (default '[]', so any existing caller that only passes p_recipe_id
--    keeps working unchanged). Since this changes the function's arg list,
--    the old single-arg overload is dropped explicitly rather than left
--    behind as dead, ambiguity-inviting cruft.
drop function if exists cook_shop_recipe(uuid);

-- Special-ingredient handling: submitted keys are first restricted to ones
-- that actually appear in this recipe's OWN special_ingredient_slots (a key
-- that isn't one of this recipe's options is silently dropped, not
-- rejected -- skip-invalid-silently, matching this function's existing
-- precedent for base_ingredients entries with no resolvable ingredientKey).
-- The recipe's own quantity for each selected key is looked up (summed,
-- same pattern as base_ingredients, in case a key appears more than once)
-- and folded into the SAME availability check and SAME "nothing partially
-- spent" guarantee as base_ingredients -- a shortfall in a selected special
-- ingredient rejects the whole cook exactly like a shortfall in a required
-- base ingredient does. Selected special ingredients are always consumed on
-- a successful cook, whether or not the final combination happens to match
-- one of the recipe's variantIconRules.
create or replace function cook_shop_recipe(
  p_recipe_id uuid,
  p_special_ingredient_keys jsonb default '[]'::jsonb
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
  v_special_keys jsonb;
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
  -- CTEs are recomputed in both statements below.
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

  -- Selected special ingredient keys, restricted to this recipe's own
  -- special_ingredient_slots (a key the client submitted that isn't one of
  -- this recipe's own options is silently dropped, not rejected).
  select coalesce(jsonb_agg(distinct ingredient ->> 'ingredientKey'), '[]'::jsonb)
  into v_special_keys
  from jsonb_array_elements(coalesce(v_recipe.special_ingredient_slots, '[]'::jsonb)) as ingredient
  where coalesce(ingredient ->> 'ingredientKey', '') <> ''
    and (ingredient ->> 'ingredientKey') in (
      select value #>> '{}' from jsonb_array_elements(coalesce(p_special_ingredient_keys, '[]'::jsonb))
    );

  select coalesce(jsonb_agg(missing.ingredient_key), '[]'::jsonb)
  into v_missing
  from (
    select req.ingredient_key
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

      union all

      select
        ingredient ->> 'ingredientKey' as ingredient_key,
        sum(coalesce((ingredient ->> 'quantity')::integer, 1)) as required_qty
      from jsonb_array_elements(coalesce(v_recipe.special_ingredient_slots, '[]'::jsonb)) as ingredient
      where (ingredient ->> 'ingredientKey') in (
        select value #>> '{}' from jsonb_array_elements(v_special_keys)
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
    ) < req.required_qty
  ) missing;

  if jsonb_array_length(v_missing) > 0 then
    return jsonb_build_object(
      'success', false,
      'code', 'insufficient_ingredients',
      'missingIngredientKeys', v_missing
    );
  end if;

  insert into shop_cooked_dishes (user_id, family_id, recipe_id, location, special_ingredient_keys, cooked_at)
  values (v_user_id, v_family_id, p_recipe_id, 'countertop', v_special_keys, now())
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

    union all

    select
      ingredient ->> 'ingredientKey' as ingredient_key,
      sum(coalesce((ingredient ->> 'quantity')::integer, 1)) as required_qty
    from jsonb_array_elements(coalesce(v_recipe.special_ingredient_slots, '[]'::jsonb)) as ingredient
    where (ingredient ->> 'ingredientKey') in (
      select value #>> '{}' from jsonb_array_elements(v_special_keys)
    )
    group by ingredient ->> 'ingredientKey'
  ) req,
  lateral generate_series(1, req.required_qty);

  return jsonb_build_object(
    'success', true,
    'code', 'cooked',
    'dishId', v_dish_id,
    'recipeId', p_recipe_id,
    'location', 'countertop',
    'specialIngredientKeys', v_special_keys
  );
end;
$$;
