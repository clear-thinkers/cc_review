-- Allow redeeming any whole number of coins (minimum 1); rate stays 100 coins = $1.
-- Drops the multiple-of-100 constraint and the matching check in redeem_coins.

alter table coin_redemptions
  drop constraint coin_redemptions_coins_multiple_of_100;

create or replace function redeem_coins(
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

  if p_coins is null or p_coins <= 0 then
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

  -- Any whole coin amount maps exactly to cents (1 coin = $0.01).
  v_dollar_value := round(p_coins::numeric / 100.0, 2);

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
