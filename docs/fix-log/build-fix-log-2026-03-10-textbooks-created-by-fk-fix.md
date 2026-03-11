# Fix Log - 2026-03-10 - Textbooks created_by FK Fix

## Context
Parent users hit batch tag save failures on `/words/all` with:
`createTextbook insert: insert or update on table "textbooks" violates foreign key constraint "textbooks_created_by_fkey"`.

## Root Cause
`textbooks.created_by` references `auth.users(id)`, but `createTextbook` wrote `user_id` from JWT app metadata (profile `users.id`) instead of the authenticated Supabase user ID (`auth.users.id`).

## Changes Applied
- Updated `src/lib/supabase-service.ts`:
  - Extended `SessionMetadata` to include `authUserId` from `session.user.id`.
  - Kept existing `userId` for profile-scoped tables.
  - Changed `createTextbook()` insert payload to write `created_by: authUserId`.

## Architectural Impact
No boundary changes. Service-layer FK mapping corrected; no schema, scheduler, AI, or route changes.

## Preventative Rule
When writing to columns that reference `auth.users(id)`, always use `session.user.id` (auth user), not app-profile `user_id` from JWT metadata.

## Docs Updated
- AI_CONTRACT.md: no - no contract policy change.
- 0_ARCHITECTURE.md: no - architecture rules unchanged.
- 0_BUILD_CONVENTIONS.md: no - coding conventions unchanged.
- 0_PRODUCT_ROADMAP.md: no - roadmap scope unchanged.
