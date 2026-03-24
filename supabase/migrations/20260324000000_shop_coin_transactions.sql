create table shop_coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  recipe_id uuid references shop_recipes(id) on delete set null,
  action_type text not null,
  coins_spent integer not null default 0,
  beginning_balance integer not null,
  ending_balance integer not null,
  created_at timestamptz not null default now(),
  constraint shop_coin_transactions_action_type_valid
    check (action_type in ('unlock_recipe')),
  constraint shop_coin_transactions_coins_spent_nonnegative
    check (coins_spent >= 0),
  constraint shop_coin_transactions_balances_nonnegative
    check (beginning_balance >= 0 and ending_balance >= 0)
);

alter table shop_coin_transactions enable row level security;

create index shop_coin_transactions_user_created_idx
  on shop_coin_transactions(user_id, created_at desc);
create index shop_coin_transactions_family_id_idx
  on shop_coin_transactions(family_id);

create policy "shop_coin_transactions: user scoped read"
on shop_coin_transactions for select
using (
  is_platform_admin()
  or user_id = current_user_id()
);

create policy "shop_coin_transactions: user can insert own rows"
on shop_coin_transactions for insert
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
