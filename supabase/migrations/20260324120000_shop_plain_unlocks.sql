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

update shop_recipes
set variant_icon_rules = $$[
  { "match": [], "iconPath": "/rewards/bubble-tea_plain.png" },
  { "match": ["wink_jelly"], "iconPath": "/rewards/bubble-tea_brown-sugar_wink.png" },
  { "match": ["spark_pop"], "iconPath": "/rewards/bubble-tea_jasmine_excited.png" },
  { "match": ["sleepy_cream"], "iconPath": "/rewards/bubble-tea_matcha_sleep.png" }
]$$::jsonb
where slug = 'bubble_tea';

update shop_recipes
set variant_icon_rules = $$[
  { "match": [], "iconPath": "/rewards/bun_plain.png" },
  { "match": ["wink_jelly"], "iconPath": "/rewards/bun_red-bean_wink.png" }
]$$::jsonb
where slug = 'bun';

update shop_recipes
set variant_icon_rules = $$[
  { "match": [], "iconPath": "/rewards/cake_plain.png" },
  { "match": ["sleepy_cream"], "iconPath": "/rewards/cake_strawberry_sleep.png" }
]$$::jsonb
where slug = 'cake';

update shop_recipes
set variant_icon_rules = $$[
  { "match": [], "iconPath": "/rewards/donut_plain.png" },
  { "match": ["wink_jelly"], "iconPath": "/rewards/donut_panda_wink.png" },
  { "match": ["spark_pop"], "iconPath": "/rewards/donut_sprinkled_excited.png" },
  { "match": ["dream_sugar"], "iconPath": "/rewards/donut_chocolate_sleep.png" },
  { "match": ["goal_glaze"], "iconPath": "/rewards/donut_strawberry_ambitious.png" }
]$$::jsonb
where slug = 'donut';

update shop_recipes
set variant_icon_rules = $$[
  { "match": [], "iconPath": "/rewards/rice-ball_plain.png" }
]$$::jsonb
where slug = 'rice_ball';
