-- One-time child coin compensation generated at 2026-03-28T20:37:51.972Z
-- Child user: 瓜瓜 (55793185-3e1a-4efe-ab8d-8fc73e773901)
-- Family ID: d7ee29e1-8666-49fb-9b71-603913595a18
-- Reason: Missed coins due to app glitch
-- Coins to add: 101
-- Existing wallet total before patch: 369
-- Session ID: manual-coin-fix-20260328t203751z-557931853e1a-missed-coins-due-to-app-glitch
-- Safe to rerun: the wallet update only happens if this exact session row is inserted.

begin;

do $$
begin
  if not exists (
    select 1
    from users
    where id = '55793185-3e1a-4efe-ab8d-8fc73e773901'
      and family_id = 'd7ee29e1-8666-49fb-9b71-603913595a18'
      and role = 'child'
  ) then
    raise exception
      'Coin compensation target % was not found in family % as a child profile.', '55793185-3e1a-4efe-ab8d-8fc73e773901', 'd7ee29e1-8666-49fb-9b71-603913595a18';
  end if;
end
$$;

with inserted_session as (
  insert into quiz_sessions (
    id,
    user_id,
    family_id,
    created_at,
    session_type,
    grade_data,
    fully_correct_count,
    failed_count,
    partially_correct_count,
    total_grades,
    duration_seconds,
    coins_earned
  )
  select
    'manual-coin-fix-20260328t203751z-557931853e1a-missed-coins-due-to-app-glitch',
    u.id,
    u.family_id,
    '2026-03-28T20:37:51.534Z'::timestamptz,
    'fill-test',
    '[]'::jsonb,
    0,
    0,
    0,
    0,
    0,
    101
  from users u
  where u.id = '55793185-3e1a-4efe-ab8d-8fc73e773901'
    and u.family_id = 'd7ee29e1-8666-49fb-9b71-603913595a18'
    and u.role = 'child'
  on conflict (id) do nothing
  returning user_id, family_id, coins_earned
), ensured_wallet as (
  insert into wallets (
    user_id,
    family_id,
    total_coins,
    last_updated_at,
    version
  )
  select
    inserted_session.user_id,
    inserted_session.family_id,
    0,
    '2026-03-28T20:37:51.534Z'::timestamptz,
    1
  from inserted_session
  on conflict on constraint wallets_pkey do nothing
)
update wallets
set
  total_coins = wallets.total_coins + inserted_session.coins_earned,
  last_updated_at = '2026-03-28T20:37:51.534Z'::timestamptz,
  version = coalesce(wallets.version, 1) + 1
from inserted_session
where wallets.user_id = inserted_session.user_id;

commit;
