-- Shop Kitchen (feature spec 2026-08-23-kitchen-page.md)
--
-- Adds a cooking mechanic on top of the existing shop: a recipe can be
-- flagged cookable (cook_method), a child spends rewarded ingredients to
-- cook an unlocked+cookable recipe, and the resulting dish can be dragged
-- into one of four shelf categories.

-- 1. `shop_recipes.cook_method` -- nullable; a recipe with cook_method IS
--    NULL is unlockable/inspectable exactly as today but never appears in
--    the Recipe Book and can never be cooked.
alter table shop_recipes
  add column cook_method text check (cook_method in ('stove', 'oven'));

-- 2. `shop_ingredient_consumptions` -- append-only ledger, one row per
--    ingredient unit spent by cook_shop_recipe. Mirrors shop_ingredient_rewards'
--    own shape/posture exactly: a child's available count of ingredient X is
--    count(shop_ingredient_rewards where key = X) - count(shop_ingredient_consumptions
--    where key = X), computed client-side, never a running-balance column.
create table shop_ingredient_consumptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  ingredient_key text not null references shop_ingredient_prices(ingredient_key),
  cooked_dish_id uuid not null,
  consumed_at timestamptz not null default now()
);

alter table shop_ingredient_consumptions enable row level security;

create index shop_ingredient_consumptions_user_id_idx on shop_ingredient_consumptions(user_id);
create index shop_ingredient_consumptions_cooked_dish_id_idx on shop_ingredient_consumptions(cooked_dish_id);

create policy "shop_ingredient_consumptions: family scoped read"
on shop_ingredient_consumptions for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

-- No update/delete policy -- immutable, matching shop_ingredient_rewards. No
-- direct insert policy either -- cook_shop_recipe (security invoker) is the
-- only path that writes here, exactly like reward_random_ingredients is the
-- only writer of shop_ingredient_rewards. Row-level insert is still scoped
-- to the caller's own identity as defense in depth, same shape as
-- shop_ingredient_rewards' own insert policy.
create policy "shop_ingredient_consumptions: user scoped insert"
on shop_ingredient_consumptions for insert
with check (
  is_platform_admin()
  or (family_id = current_family_id() and user_id = current_user_id())
);

-- 3. `shop_cooked_dishes` -- one row per cooked dish (not aggregated
--    server-side; the client aggregates by recipe_id for shelf display).
--    shelf_category is the ONE field on any shop-adjacent table in this
--    codebase that a child can update post-insert -- a deliberate,
--    called-out departure from the append-only convention everywhere else,
--    because "drag to reorganize" is inherently a mutation, not an event
--    log. It is still never touched by direct client UPDATE -- only
--    through move_shop_cooked_dish below.
create table shop_cooked_dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  recipe_id uuid not null references shop_recipes(id) on delete cascade,
  shelf_category text not null default 'default'
    check (shelf_category in ('default', 'drinks', 'desserts', 'hotmeal')),
  cooked_at timestamptz not null default now()
);

alter table shop_cooked_dishes enable row level security;

create index shop_cooked_dishes_user_id_idx on shop_cooked_dishes(user_id);
create index shop_cooked_dishes_recipe_id_idx on shop_cooked_dishes(recipe_id);

create policy "shop_cooked_dishes: family scoped read"
on shop_cooked_dishes for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

-- No insert/update/delete policy for direct client writes at all --
-- cook_shop_recipe is the only inserter, move_shop_cooked_dish is the only
-- updater (and only of shelf_category), both security invoker RPCs that
-- re-check ownership themselves. This is stricter than
-- shop_ingredient_rewards (which at least allows a defense-in-depth insert
-- policy scoped to the caller) because shelf_category's mutability makes a
-- permissive client UPDATE policy meaningfully more dangerous here.

-- 4. cook_shop_recipe -- SECURITY DEFINER, a deliberate departure from
--    unlock_shop_recipe/reward_random_ingredients's security invoker choice.
--    Those two RPCs pair "invoker" with a matching defense-in-depth RLS
--    insert policy scoped to the caller's own user_id -- workable for them,
--    but shop_cooked_dishes/shop_ingredient_consumptions are deliberately
--    designed with NO RLS write policy at all (see the CREATE TABLE
--    comments above), and a security-invoker function cannot write through
--    a table that has no applicable RLS policy for the calling role: RLS
--    still applies inside a SECURITY INVOKER function body, it does not
--    bypass it. SECURITY DEFINER is therefore required for these two writes
--    to work at all while keeping the "RPC is the only writer, full stop"
--    guarantee real rather than aspirational -- the alternative (adding a
--    caller-scoped INSERT policy just to make invoker work) would let a
--    child mint free cooked dishes via a direct client insert, bypassing
--    cook_shop_recipe's ingredient-spend check entirely, which is a real
--    exploit this feature cannot accept. All of this RPC's own checks
--    (role, unlock state, ingredient availability) still run before any
--    write, exactly as they would under invoker -- SECURITY DEFINER changes
--    who RLS sees as the writer, not what this function validates.
create or replace function cook_shop_recipe(p_recipe_id uuid)
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

  -- Required quantities per ingredient key, skipping entries with no
  -- resolvable ingredientKey or one no longer in shop_ingredient_prices --
  -- same skip-invalid-silently precedent as reward_random_ingredients.
  -- Deliberately no temp table here: creating one inside a plpgsql function
  -- risks plan-cache/session gotchas across repeated calls in the same
  -- connection, so the same small CTE is just recomputed in each of the two
  -- statements below (the availability check and the consumption insert)
  -- instead of being materialized once and reused.
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

  insert into shop_cooked_dishes (user_id, family_id, recipe_id, shelf_category, cooked_at)
  values (v_user_id, v_family_id, p_recipe_id, 'default', now())
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
    'shelfCategory', 'default'
  );
end;
$$;

-- 5. move_shop_cooked_dish -- SECURITY DEFINER for the same reason as
--    cook_shop_recipe above: shop_cooked_dishes has no RLS UPDATE policy at
--    all, so a security-invoker function could not perform this write
--    either. It is the one write path allowed to touch
--    shop_cooked_dishes.shelf_category after insert, and re-checks
--    ownership itself before writing (see below) since RLS is not doing
--    that job here the way it would for an invoker function.
create or replace function move_shop_cooked_dish(p_dish_id uuid, p_shelf_category text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_dish shop_cooked_dishes%rowtype;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  if p_shelf_category not in ('default', 'drinks', 'desserts', 'hotmeal') then
    return jsonb_build_object('success', false, 'code', 'invalid_shelf_category');
  end if;

  select * into v_dish from shop_cooked_dishes where id = p_dish_id;
  if not found then
    return jsonb_build_object('success', false, 'code', 'dish_not_found');
  end if;

  if v_dish.user_id <> v_user_id and not is_platform_admin() then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  update shop_cooked_dishes
  set shelf_category = p_shelf_category
  where id = p_dish_id;

  return jsonb_build_object('success', true, 'code', 'moved', 'dishId', p_dish_id, 'shelfCategory', p_shelf_category);
end;
$$;
