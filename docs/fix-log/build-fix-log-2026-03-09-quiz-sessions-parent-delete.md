# Fix Log — 2026-03-09 — Quiz Sessions Parent Delete

## Problem

"Clear History" button silently does nothing for parent accounts. The same button works correctly for the platform admin account.

## Root Cause

The RLS DELETE policy on `quiz_sessions` was `is_platform_admin()` only:

```sql
create policy "quiz_sessions: platform admin delete"
on quiz_sessions for delete
using (is_platform_admin());
```

When a parent calls `clearAllQuizSessions()`, Supabase silently returns success (no error, 0 rows deleted) because RLS blocks the DELETE without raising an exception. The UI clears local state but the data persists in the database. On the next poll (1 s interval), sessions are re-fetched and the history reappears.

## Fix

Added migration `20260309000003_quiz_sessions_family_delete.sql`:

- Drops `quiz_sessions: platform admin delete`
- Creates `quiz_sessions: family scoped delete` — same `is_platform_admin() or family_id = current_family_id()` pattern used by `words` and `flashcard_contents`

The UI already hides the Clear History button for child profiles (`hideDestructiveActions={isChild}` in `ResultsPage.tsx`), so children remain blocked at the presentation layer.

## Coins

No code change needed. Wallet `total_coins` is stored in the `wallets` table and is written by `updateWallet()` at session completion — it is never recomputed from `quiz_sessions`. Deleting `quiz_sessions` rows does not affect the wallet balance.

The Results page summary shows `totalCoinsEarned` derived from loaded sessions. After clearing history this value correctly becomes 0 (no sessions to sum) — this is expected display behavior, not data loss.

## Files Changed

- `supabase/migrations/20260309000003_quiz_sessions_family_delete.sql` — new migration
