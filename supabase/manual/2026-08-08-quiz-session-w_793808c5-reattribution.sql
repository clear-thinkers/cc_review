-- One-time quiz_sessions reattribution generated 2026-08-08
-- Family: d7ee29e1-8666-49fb-9b71-603913595a18 (Zhou Fu)
-- Quiz session w_793808c5_1785886010797 (2026-08-04T23:26:50Z, 8 grades,
-- 32 coins) was recorded under the parent's user_id (9f878502-...) instead
-- of the child's (55793185-...) -- same root cause as
-- build-fix-log-2026-07-30-packaged-session-limbo.md: record_quiz_session
-- has no role gate, so it silently succeeds under whichever identity the
-- JWT resolves to.
--
-- Unlike the 2.3.543 incident, this one left no orphaned
-- review_session_progress row and no packaged review_test_sessions row
-- could be conclusively matched to the 8 graded characters (partial 5/8
-- overlap with session "2.1", 0-1/8 with all 18 other open sessions at the
-- time of investigation -- inconclusive, and the child appears to have
-- separately and successfully completed other sessions the next day). So
-- this repair is scoped to ONLY the quiz_sessions ownership + wallet
-- rebalance -- no review_test_sessions or review_session_progress rows are
-- touched.
--
-- Safe to rerun: the wallet update is guarded by the current owner check.

begin;

do $$
declare
  v_from_user_id uuid := '9f878502-9e97-4bfe-aabd-8320692a4a31'; -- parent (妈妈)
  v_to_user_id uuid := '55793185-3e1a-4efe-ab8d-8fc73e773901';   -- child (瓜瓜)
  v_family_id uuid := 'd7ee29e1-8666-49fb-9b71-603913595a18';
  v_quiz_session_id text := 'w_793808c5_1785886010797';
  v_coins integer := 32;
  v_current_owner uuid;
begin
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
end
$$;

commit;
