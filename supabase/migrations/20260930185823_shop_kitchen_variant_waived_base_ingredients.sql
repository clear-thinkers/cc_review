-- Shop Kitchen: let a named variant waive specific base ingredients.
--
-- Forward migration on top of 20260824000000_shop_kitchen_special_ingredients.sql
-- (same cook_shop_recipe(uuid, jsonb) signature -- no arg-list change, so no
-- drop/recreate needed, just `create or replace`).
--
-- Motivating case: "Mapo Tofu over Rice" is a named variant of the
-- "Fried Egg over Rice" recipe (base_ingredients: rice, egg, scallions) via
-- a special-ingredient combo (tofu, ground pork, peppercorn, soy sauce) --
-- but a mapo tofu bowl doesn't include a fried egg, so this specific variant
-- should not require (or consume) the recipe's usual egg. Until now,
-- variant_icon_rules was a pure read-time display concern (icon + title);
-- cook_shop_recipe required every base_ingredients row unconditionally, no
-- matter which special-ingredient combination was chosen. This migration
-- adds an optional `waivedBaseIngredientKeys` array to whichever
-- variant_icon_rules entry matches the player's chosen special ingredients
-- (src/lib/shop.types.ts ShopVariantIconRule) and has cook_shop_recipe
-- exclude those keys from BOTH the requirement check and the consumption
-- insert -- a waived ingredient is neither required nor spent.
--
-- The matching algorithm mirrors resolveShopRecipeVariant in src/lib/shop.ts
-- exactly (subset-match, prefer the most specific/longest `match` array; a
-- rule with `match: []` matches vacuously so it still works as the "nothing
-- more specific matched" fallback) so server-side enforcement can never
-- disagree with the client's own read-time icon/title resolution about
-- which rule is "the" matched variant. Implemented as an equality-of-counts
-- check (match array length == count of its keys present in the player's
-- selection) rather than NOT EXISTS/bool_and, specifically so the empty
-- `match: []` case (0 == 0) counts as a match instead of vacuously failing.
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
  v_matched_rule jsonb;
  v_waived_base_keys jsonb;
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

  -- Which variant_icon_rules entry (if any) matches v_special_keys -- see
  -- header comment for why this is an equality-of-counts check rather than
  -- NOT EXISTS/bool_and.
  select rule
  into v_matched_rule
  from jsonb_array_elements(coalesce(v_recipe.variant_icon_rules, '[]'::jsonb)) as rule
  where jsonb_array_length(coalesce(rule -> 'match', '[]'::jsonb)) = (
    select count(*)
    from jsonb_array_elements(coalesce(rule -> 'match', '[]'::jsonb)) as m
    where m #>> '{}' in (
      select value #>> '{}' from jsonb_array_elements(v_special_keys)
    )
  )
  order by jsonb_array_length(coalesce(rule -> 'match', '[]'::jsonb)) desc
  limit 1;

  v_waived_base_keys := coalesce(v_matched_rule -> 'waivedBaseIngredientKeys', '[]'::jsonb);

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
        and (ingredient ->> 'ingredientKey') not in (
          select value #>> '{}' from jsonb_array_elements(v_waived_base_keys)
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
      and (ingredient ->> 'ingredientKey') not in (
        select value #>> '{}' from jsonb_array_elements(v_waived_base_keys)
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
