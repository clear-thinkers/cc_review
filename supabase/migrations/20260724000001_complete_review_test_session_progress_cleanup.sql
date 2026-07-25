-- ============================================================================
-- Migration: 2026-07-24 — Complete Review Test Session Progress Cleanup
-- Feature: save & resume test session progress (E1 — schema & service foundation)
-- Authorized by: docs/feature-specs/2026-07-24-save-resume-test-session-progress.md
--
-- Reproduces complete_review_test_session() from
-- supabase/migrations/20260321000001_review_test_sessions.sql verbatim, adding
-- one cleanup statement: delete any review_session_progress rows for the
-- packaged session that was just completed, in the same transaction boundary
-- as the completion stamp.
-- ============================================================================

create or replace function complete_review_test_session(p_session_id text)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if not (is_platform_admin() or current_jwt_role() = 'child') then
    raise exception 'Only child profiles can complete review test sessions';
  end if;

  update review_test_sessions
  set completed_at = now(),
      completed_by_user_id = current_user_id()
  where id = p_session_id
    and family_id = current_family_id()
    and completed_at is null;

  if not found then
    raise exception 'Review test session not found or already completed';
  end if;

  delete from review_session_progress
  where packaged_session_id = p_session_id;
end;
$$;

-- create or replace function preserves existing grants in Postgres, but the
-- grant is re-issued explicitly here to be safe.
grant execute on function complete_review_test_session(text) to authenticated;
