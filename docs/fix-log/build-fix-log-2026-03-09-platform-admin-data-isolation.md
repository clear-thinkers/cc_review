# Fix Log – 2026-03-09 – Platform Admin Data Isolation

## Context
Platform admin account in production could see words, flashcard content, quiz sessions, and wallet data from all families. Admin should only see data belonging to their own family, like any other user.

## Root Cause
RLS policies on every table include an `is_platform_admin()` bypass as the first OR clause. When the platform admin queries any table, RLS returns all rows across all families. The service layer (`src/lib/supabase-service.ts`) had no explicit `family_id` filtering on read or delete queries — it relied purely on RLS for tenant scoping. This meant platform admin saw every family's data.

## Changes Applied
- `src/lib/supabase-service.ts`: Added `.eq("family_id", familyId)` to every read and delete function that was missing it:
  - `getAllWords()`
  - `getDueWords()`
  - `getExistingWordsByHanzi()`
  - `getFlashcardContent()`
  - `getAllFlashcardContents()`
  - `deleteFlashcardContent()`
  - `deleteWord()`
  - `getAllQuizSessions()`
  - `clearAllQuizSessions()`
- Each function now calls `getSessionMetadata()` to obtain the session's `familyId` and scopes queries explicitly.
- Write functions already had `familyId` scoping and were unaffected.

## Architectural Impact
- Service layer only — no schema, RLS, or API route changes.
- RLS remains as defense-in-depth; service layer now enforces family scoping regardless of admin status.
- No scheduler or grading changes.

## Preventative Rule
Every query in the service layer must include an explicit `.eq("family_id", familyId)` filter. Never rely solely on RLS for tenant scoping — RLS is a safety net, not the primary scoping mechanism.

## Docs Updated
- AI_CONTRACT.md: no — no contract behavior changed.
- 0_ARCHITECTURE.md: no — no boundary or schema change.
- 0_BUILD_CONVENTIONS.md: no — project conventions unchanged.
- 0_PRODUCT_ROADMAP.md: no — bug fix only.
