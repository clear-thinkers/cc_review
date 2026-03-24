create table shop_recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  display_order integer not null unique,
  is_active boolean not null default true,
  variant_icon_rules jsonb not null default '[]',
  intro text not null default '',
  unlock_cost_coins integer not null default 25,
  base_ingredients jsonb not null default '[]',
  special_ingredient_slots jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_recipes_unlock_cost_nonnegative check (unlock_cost_coins >= 0)
);

alter table shop_recipes enable row level security;

create index shop_recipes_display_order_idx on shop_recipes(display_order);

create table shop_recipe_unlocks (
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  recipe_id uuid not null references shop_recipes(id) on delete cascade,
  coins_spent integer not null default 0,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, recipe_id),
  constraint shop_recipe_unlocks_coins_spent_nonnegative check (coins_spent >= 0)
);

alter table shop_recipe_unlocks enable row level security;

create index shop_recipe_unlocks_family_id_idx on shop_recipe_unlocks(family_id);
create index shop_recipe_unlocks_recipe_id_idx on shop_recipe_unlocks(recipe_id);

create policy "shop_recipes: authenticated read"
on shop_recipes for select
using (
  is_platform_admin()
  or current_user_id() is not null
);

create policy "shop_recipes: platform admin insert"
on shop_recipes for insert
with check (is_platform_admin());

create policy "shop_recipes: platform admin update"
on shop_recipes for update
using (is_platform_admin());

create policy "shop_recipes: platform admin delete"
on shop_recipes for delete
using (is_platform_admin());

create policy "shop_recipe_unlocks: family scoped read"
on shop_recipe_unlocks for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "shop_recipe_unlocks: user can insert own unlocks"
on shop_recipe_unlocks for insert
with check (
  is_platform_admin()
  or (family_id = current_family_id() and user_id = current_user_id())
);

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

insert into shop_recipes (
  slug,
  title,
  display_order,
  is_active,
  variant_icon_rules,
  intro,
  unlock_cost_coins,
  base_ingredients,
  special_ingredient_slots
)
values
  (
    'bubble_tea',
    'Bubble Tea',
    1,
    true,
    $$[
      { "match": [], "iconPath": "/rewards/bubble_tea_smile_1.png" },
      { "match": ["wink_jelly"], "iconPath": "/rewards/bubble_tea_wink_1.png" },
      { "match": ["spark_pop"], "iconPath": "/rewards/bubble_tea_excited_1.png" },
      { "match": ["sleepy_cream"], "iconPath": "/rewards/bubble_tea_sleep_1.png" }
    ]$$::jsonb,
    'A sweet milk tea with chewy pearls that can change mood with special toppings.',
    25,
    $$[
      { "name": "Black Tea", "quantity": "1", "unit": "cup" },
      { "name": "Milk", "quantity": "0.5", "unit": "cup" },
      { "name": "Tapioca Pearls", "quantity": "0.5", "unit": "cup" }
    ]$$::jsonb,
    $$[
      {
        "slotKey": "expression",
        "label": "Expression Mixer",
        "maxSelections": 1,
        "options": [
          { "key": "wink_jelly", "label": "Wink Jelly", "effect": "adds a wink face" },
          { "key": "sleepy_cream", "label": "Sleepy Cream", "effect": "adds a sleepy face" }
        ]
      },
      {
        "slotKey": "effect",
        "label": "Energy Burst",
        "maxSelections": 1,
        "options": [
          { "key": "spark_pop", "label": "Spark Pop", "effect": "adds an excited effect" }
        ]
      }
    ]$$::jsonb
  ),
  (
    'bun',
    'Bun',
    2,
    true,
    $$[
      { "match": [], "iconPath": "/rewards/bun_smile_1.png" },
      { "match": ["wink_jelly"], "iconPath": "/rewards/bun_wink_1.png" }
    ]$$::jsonb,
    'A soft steamed bun with a simple base dough and a playful expression option.',
    25,
    $$[
      { "name": "Flour", "quantity": "2", "unit": "cups" },
      { "name": "Yeast", "quantity": "1", "unit": "packet" },
      { "name": "Warm Water", "quantity": "0.75", "unit": "cup" }
    ]$$::jsonb,
    $$[
      {
        "slotKey": "expression",
        "label": "Face Filling",
        "maxSelections": 1,
        "options": [
          { "key": "wink_jelly", "label": "Wink Jelly", "effect": "adds a wink face" }
        ]
      }
    ]$$::jsonb
  ),
  (
    'cake',
    'Cake',
    3,
    true,
    $$[
      { "match": [], "iconPath": "/rewards/cake_smile_1.png" },
      { "match": ["berry_glow"], "iconPath": "/rewards/cake_smile_2.png" },
      { "match": ["sleepy_cream"], "iconPath": "/rewards/cake_sleep_1.png" }
    ]$$::jsonb,
    'A fluffy celebration cake whose frosting can change the final mood.',
    25,
    $$[
      { "name": "Flour", "quantity": "2", "unit": "cups" },
      { "name": "Eggs", "quantity": "3", "unit": "" },
      { "name": "Sugar", "quantity": "1", "unit": "cup" },
      { "name": "Butter", "quantity": "0.5", "unit": "cup" }
    ]$$::jsonb,
    $$[
      {
        "slotKey": "frosting_style",
        "label": "Frosting Style",
        "maxSelections": 1,
        "options": [
          { "key": "berry_glow", "label": "Berry Glow", "effect": "brightens the smile frosting" },
          { "key": "sleepy_cream", "label": "Sleepy Cream", "effect": "adds a sleepy face" }
        ]
      }
    ]$$::jsonb
  ),
  (
    'donut',
    'Donut',
    4,
    true,
    $$[
      { "match": [], "iconPath": "/rewards/donut_smile_1.png" },
      { "match": ["wink_jelly"], "iconPath": "/rewards/donut_wink_1.png" },
      { "match": ["spark_pop"], "iconPath": "/rewards/donut_excited_1.png" },
      { "match": ["dream_sugar"], "iconPath": "/rewards/donut_sleep_1.png" },
      { "match": ["goal_glaze"], "iconPath": "/rewards/donut_ambitious_1.png" }
    ]$$::jsonb,
    'A ring donut with toppings that can swing from sleepy to super ambitious.',
    25,
    $$[
      { "name": "Flour", "quantity": "2.5", "unit": "cups" },
      { "name": "Milk", "quantity": "0.75", "unit": "cup" },
      { "name": "Egg", "quantity": "1", "unit": "" },
      { "name": "Sugar", "quantity": "0.5", "unit": "cup" }
    ]$$::jsonb,
    $$[
      {
        "slotKey": "expression",
        "label": "Mood Glaze",
        "maxSelections": 1,
        "options": [
          { "key": "wink_jelly", "label": "Wink Jelly", "effect": "adds a wink face" },
          { "key": "dream_sugar", "label": "Dream Sugar", "effect": "adds a sleepy face" }
        ]
      },
      {
        "slotKey": "effect",
        "label": "Power Topping",
        "maxSelections": 1,
        "options": [
          { "key": "spark_pop", "label": "Spark Pop", "effect": "adds an excited effect" },
          { "key": "goal_glaze", "label": "Goal Glaze", "effect": "adds an ambitious expression" }
        ]
      }
    ]$$::jsonb
  ),
  (
    'milkshake',
    'Milkshake',
    5,
    true,
    $$[
      { "match": [], "iconPath": "/rewards/milkshake_sleep_1.png" }
    ]$$::jsonb,
    'A cool milkshake recipe that starts with a dreamy sleepy look.',
    25,
    $$[
      { "name": "Milk", "quantity": "1", "unit": "cup" },
      { "name": "Ice Cream", "quantity": "2", "unit": "scoops" },
      { "name": "Sugar", "quantity": "2", "unit": "tbsp" }
    ]$$::jsonb,
    '[]'::jsonb
  ),
  (
    'ramen',
    'Ramen',
    6,
    true,
    $$[
      { "match": [], "iconPath": "/rewards/ramen_calm_1.png" }
    ]$$::jsonb,
    'A warm noodle bowl with a calm base style and room for future broth effects.',
    25,
    $$[
      { "name": "Noodles", "quantity": "1", "unit": "bundle" },
      { "name": "Broth", "quantity": "2", "unit": "cups" },
      { "name": "Egg", "quantity": "1", "unit": "" }
    ]$$::jsonb,
    '[]'::jsonb
  ),
  (
    'rice_ball',
    'Rice Ball',
    7,
    true,
    $$[
      { "match": [], "iconPath": "/rewards/rice_ball_sleep_1.png" }
    ]$$::jsonb,
    'A simple rice ball recipe with a cozy sleepy expression.',
    25,
    $$[
      { "name": "Cooked Rice", "quantity": "1", "unit": "cup" },
      { "name": "Seaweed", "quantity": "1", "unit": "sheet" },
      { "name": "Salt", "quantity": "1", "unit": "pinch" }
    ]$$::jsonb,
    '[]'::jsonb
  ),
  (
    'tangyuan',
    'Tangyuan',
    8,
    true,
    $$[
      { "match": [], "iconPath": "/rewards/tangyuan_smile_1.png" }
    ]$$::jsonb,
    'A sweet glutinous rice dessert that keeps a happy smile by default.',
    25,
    $$[
      { "name": "Glutinous Rice Flour", "quantity": "1.5", "unit": "cups" },
      { "name": "Water", "quantity": "0.75", "unit": "cup" },
      { "name": "Sesame Filling", "quantity": "0.5", "unit": "cup" }
    ]$$::jsonb,
    '[]'::jsonb
  ),
  (
    'zongzi',
    'Zongzi',
    9,
    true,
    $$[
      { "match": [], "iconPath": "/rewards/zongzi_smile_1.png" }
    ]$$::jsonb,
    'A wrapped sticky rice dumpling with a cheerful smile and a traditional filling base.',
    25,
    $$[
      { "name": "Sticky Rice", "quantity": "2", "unit": "cups" },
      { "name": "Bamboo Leaves", "quantity": "4", "unit": "" },
      { "name": "Red Bean Filling", "quantity": "0.5", "unit": "cup" }
    ]$$::jsonb,
    '[]'::jsonb
  );
