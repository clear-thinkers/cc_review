-- Packaged review test session reattribution generated at 2026-07-30T10:49:36.550Z
-- Family ID: d7ee29e1-8666-49fb-9b71-603913595a18
-- Packaged session: review-test-session-1784919402855-29hpa3fl
-- Quiz session: w_edw8vpv4_1785356210536
-- Reattributing from 9f878502-9e97-4bfe-aabd-8320692a4a31 to 55793185-3e1a-4efe-ab8d-8fc73e773901, moving 96 coins
-- Safe to rerun: each step is guarded by the current row state.

begin;

do $$
declare
  v_from_user_id uuid := '9f878502-9e97-4bfe-aabd-8320692a4a31';
  v_to_user_id uuid := '55793185-3e1a-4efe-ab8d-8fc73e773901';
  v_family_id uuid := 'd7ee29e1-8666-49fb-9b71-603913595a18';
  v_quiz_session_id text := 'w_edw8vpv4_1785356210536';
  v_packaged_session_id text := 'review-test-session-1784919402855-29hpa3fl';
  v_coins integer := 96;
  v_current_owner uuid;
begin
  if not exists (select 1 from users where id = v_from_user_id and family_id = v_family_id) then
    raise exception 'Reattribution source user % not found in family %', v_from_user_id, v_family_id;
  end if;

  if not exists (
    select 1 from users where id = v_to_user_id and family_id = v_family_id and role = 'child'
  ) then
    raise exception 'Reattribution target user % not found as a child profile in family %', v_to_user_id, v_family_id;
  end if;

  select user_id into v_current_owner
  from quiz_sessions
  where id = v_quiz_session_id and family_id = v_family_id;

  if v_current_owner is null then
    raise exception 'quiz_sessions row % not found in family %', v_quiz_session_id, v_family_id;
  end if;

  if v_current_owner = v_from_user_id then
    update quiz_sessions
    set user_id = v_to_user_id
    where id = v_quiz_session_id;

    update wallets
    set total_coins = total_coins - v_coins,
        last_updated_at = now(),
        version = coalesce(version, 1) + 1
    where user_id = v_from_user_id;

    insert into wallets (user_id, family_id, total_coins, last_updated_at, version)
    values (v_to_user_id, v_family_id, 0, now(), 1)
    on conflict on constraint wallets_pkey do nothing;

    update wallets
    set total_coins = total_coins + v_coins,
        last_updated_at = now(),
        version = coalesce(version, 1) + 1
    where user_id = v_to_user_id;
  elsif v_current_owner <> v_to_user_id then
    raise exception
      'quiz_sessions row % is owned by % (expected % or %) -- refusing to guess, investigate manually',
      v_quiz_session_id, v_current_owner, v_from_user_id, v_to_user_id;
  end if;

  update review_test_sessions
  set completed_at = now(),
      completed_by_user_id = v_to_user_id
  where id = v_packaged_session_id
    and family_id = v_family_id
    and completed_at is null;

  delete from review_session_progress
  where packaged_session_id = v_packaged_session_id;
end
$$;

commit;
