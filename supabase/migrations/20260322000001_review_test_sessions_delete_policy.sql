-- ============================================================================
-- Migration: 2026-03-22 — Review Test Session Delete Policy
-- Feature: parent/platform-admin deletion of active packaged sessions
-- ============================================================================

create policy "review_test_sessions: parent scoped delete"
on review_test_sessions for delete
using (
  is_platform_admin()
  or (family_id = current_family_id() and current_jwt_role() = 'parent')
);

create policy "review_test_session_targets: parent scoped delete"
on review_test_session_targets for delete
using (
  is_platform_admin()
  or (family_id = current_family_id() and current_jwt_role() = 'parent')
);
