-- Fix: allow parents to delete quiz sessions for their family
-- Previously only platform admins could delete, which silently blocked
-- the "Clear History" button for parent accounts.
-- Wallets (coins) are a separate table and are unaffected by this delete.

-- Drop the admin-only policy
drop policy if exists "quiz_sessions: platform admin delete" on quiz_sessions;

-- Replace with family-scoped delete (same pattern as words / flashcard_contents)
-- UI layer already hides the Clear History button for child accounts.
create policy "quiz_sessions: family scoped delete"
on quiz_sessions for delete
using (
  is_platform_admin()
  or family_id = current_family_id()
);
