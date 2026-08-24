-- Ingredient shopping for kids (feature spec 2026-03-30-shop-ingredient-shopping.md,
-- roadmap item F). Ships as a "buy N units in one tap" flow from the start (a deliberate
-- deviation from the original draft spec's one-unit-per-tap design) -- the quantity
-- picker was the explicit ask, and the underlying ledger shape supports it cleanly.
--
-- One row per unit purchased, matching shop_ingredient_rewards/shop_ingredient_consumptions'
-- existing "one row per unit, not aggregated" convention -- so a purchase slots straight
-- into buildShopIngredientAvailabilityMap as a second reward-like input, per
-- 0_ARCHITECTURE.md's Shop Kitchen Rule 10, with no redesign of that helper.
create table shop_ingredient_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  recipe_id uuid not null references shop_recipes(id) on delete cascade,
  ingredient_key text not null references shop_ingredient_prices(ingredient_key),
  coins_spent integer not null,
  purchased_at timestamptz not null default now(),
  constraint shop_ingredient_purchases_coins_spent_nonnegative check (coins_spent >= 0)
);

alter table shop_ingredient_purchases enable row level security;

create index shop_ingredient_purchases_user_id_idx on shop_ingredient_purchases(user_id);
create index shop_ingredient_purchases_recipe_id_idx on shop_ingredient_purchases(recipe_id);

-- Same trust model as shop_ingredient_rewards: family-scoped read (RLS is not the gate
-- on parent visibility -- no UI surfaces this table to parents, matching the shop's
-- existing parent-blocked posture), insert scoped to the caller's own row, no
-- update/delete -- purchases are an immutable ledger like every other shop ledger.
create policy "shop_ingredient_purchases: family scoped read"
on shop_ingredient_purchases for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "shop_ingredient_purchases: user scoped insert"
on shop_ingredient_purchases for insert
with check (
  is_platform_admin()
  or (family_id = current_family_id() and user_id = current_user_id())
);

alter table shop_coin_transactions
  add column ingredient_key text references shop_ingredient_prices(ingredient_key);

alter table shop_coin_transactions
  drop constraint shop_coin_transactions_action_type_valid;

alter table shop_coin_transactions
  add constraint shop_coin_transactions_action_type_valid
    check (action_type in ('unlock_recipe', 'purchase_ingredient'));

-- Atomic bulk purchase: buys p_quantity units of one ingredient for one recipe context
-- in a single tap. Mirrors unlock_shop_recipe's security invoker + explicit role-check
-- shape and its wallet FOR UPDATE lock. Requires the recipe to already be unlocked --
-- the ingredient sub-modal this feeds is only reachable from an unlocked recipe's
-- "Show Ingredients" flow, but the RPC re-checks server-side regardless.
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

  if not found then
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
