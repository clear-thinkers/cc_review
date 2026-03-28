-- Fix record_quiz_session() so the wallets upsert does not collide with the
-- RETURNS TABLE output column names created by PL/pgSQL.

create or replace function record_quiz_session(
  p_id text,
  p_created_at timestamptz,
  p_session_type text,
  p_grade_data jsonb,
  p_fully_correct_count integer,
  p_failed_count integer,
  p_partially_correct_count integer,
  p_total_grades integer,
  p_duration_seconds integer,
  p_coins_earned integer
)
returns table (
  user_id uuid,
  family_id uuid,
  total_coins integer,
  last_updated_at timestamptz,
  version integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := current_user_id();
  v_family_id uuid := current_family_id();
begin
  if v_user_id is null or v_family_id is null then
    raise exception 'record_quiz_session requires current family_id and user_id claims';
  end if;

  insert into wallets (user_id, family_id, total_coins, last_updated_at, version)
  values (v_user_id, v_family_id, 0, now(), 1)
  on conflict on constraint wallets_pkey do nothing;

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
  values (
    p_id,
    v_user_id,
    v_family_id,
    p_created_at,
    p_session_type,
    coalesce(p_grade_data, '[]'::jsonb),
    coalesce(p_fully_correct_count, 0),
    coalesce(p_failed_count, 0),
    coalesce(p_partially_correct_count, 0),
    coalesce(p_total_grades, 0),
    coalesce(p_duration_seconds, 0),
    coalesce(p_coins_earned, 0)
  );

  return query
  update wallets
  set
    total_coins = wallets.total_coins + coalesce(p_coins_earned, 0),
    last_updated_at = now(),
    version = coalesce(wallets.version, 1) + 1
  where wallets.user_id = v_user_id
  returning
    wallets.user_id,
    wallets.family_id,
    wallets.total_coins,
    wallets.last_updated_at,
    wallets.version;
end;
$$;
