-- Coin redemptions: new table + redeem_coins RPC for the cash-out feature.
-- Redemptions draw from wallets.total_coins at 100 coins = $1.
-- quiz_sessions.coins_earned is immutable and unaffected.

create table coin_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  coins_redeemed integer not null,
  dollar_value numeric(10,2) not null,
  note text not null,
  child_signature text not null,
  beginning_balance integer not null,
  ending_balance integer not null,
  created_at timestamptz not null default now(),
  constraint coin_redemptions_coins_positive check (coins_redeemed > 0),
  constraint coin_redemptions_coins_multiple_of_100 check (coins_redeemed % 100 = 0),
  constraint coin_redemptions_dollar_value_positive check (dollar_value > 0),
  constraint coin_redemptions_balances_nonnegative check (beginning_balance >= 0 and ending_balance >= 0)
);

alter table coin_redemptions enable row level security;

create index coin_redemptions_user_created_idx
  on coin_redemptions(user_id, created_at desc);
create index coin_redemptions_family_id_idx
  on coin_redemptions(family_id);

create policy "coin_redemptions: family scoped read"
on coin_redemptions for select
using (
  is_platform_admin()
  or family_id = current_family_id()
);

create policy "coin_redemptions: user can insert own rows"
on coin_redemptions for insert
with check (
  is_platform_admin()
  or (family_id = current_family_id() and user_id = current_user_id())
);

create function redeem_coins(
  p_coins integer,
  p_note text,
  p_signature text
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
  v_wallet wallets%rowtype;
  v_remaining_coins integer;
  v_dollar_value numeric(10,2);
begin
  if v_user_id is null or v_family_id is null then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  select role into v_role from users where id = v_user_id;

  if coalesce(v_role, '') <> 'child' and not is_platform_admin() then
    return jsonb_build_object('success', false, 'code', 'forbidden');
  end if;

  if p_coins is null or p_coins <= 0 or p_coins % 100 <> 0 then
    return jsonb_build_object('success', false, 'code', 'invalid_amount');
  end if;

  if p_note is null or length(trim(p_note)) = 0 or length(trim(p_note)) > 200 then
    return jsonb_build_object('success', false, 'code', 'invalid_note');
  end if;

  if p_signature is null or length(trim(p_signature)) = 0 then
    return jsonb_build_object('success', false, 'code', 'invalid_signature');
  end if;

  insert into wallets (user_id, family_id, total_coins, last_updated_at, version)
  values (v_user_id, v_family_id, 0, now(), 1)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from wallets
  where user_id = v_user_id
  for update;

  if coalesce(v_wallet.total_coins, 0) < p_coins then
    return jsonb_build_object(
      'success', false,
      'code', 'insufficient_coins',
      'remainingCoins', coalesce(v_wallet.total_coins, 0)
    );
  end if;

  v_dollar_value := p_coins::numeric / 100.0;

  update wallets
  set
    total_coins = total_coins - p_coins,
    last_updated_at = now(),
    version = coalesce(version, 1) + 1
  where user_id = v_user_id
  returning total_coins into v_remaining_coins;

  insert into coin_redemptions (
    user_id,
    family_id,
    coins_redeemed,
    dollar_value,
    note,
    child_signature,
    beginning_balance,
    ending_balance
  )
  values (
    v_user_id,
    v_family_id,
    p_coins,
    v_dollar_value,
    trim(p_note),
    trim(p_signature),
    coalesce(v_wallet.total_coins, 0),
    v_remaining_coins
  );

  return jsonb_build_object(
    'success', true,
    'code', 'redeemed',
    'coinsRedeemed', p_coins,
    'dollarValue', v_dollar_value,
    'remainingCoins', v_remaining_coins
  );
end;
$$;
