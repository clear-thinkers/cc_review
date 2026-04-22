# Feature Spec - 2026-04-22 - Results Failed Characters to Test Session

## Problem
Users can see which Hanzi failed in a completed fill-test session, but there is no direct way to package those failed characters into a reusable review test session from `/words/results`.

## Scope
- Add a results-page action that sends one session's failed characters into a named packaged review test session.
- Reuse the existing `review_test_sessions` / `review_test_session_targets` flow and service functions.
- Resolve failed Hanzi into current saved packaged-session targets without changing persisted quiz-session records.
- Support both creating a new active review test session and appending to an existing active session when the entered name matches exactly.

## Out of scope
- Starting the packaged session directly from `/words/results`
- Changing quiz grading, scheduler behavior, or coin logic
- Adding new tables, columns, RPCs, or routes
- Reconstructing historical pronunciation-level targets from old quiz-session data

## Proposed behavior
1. Each results-row gains a `Send Failed to Test Session` action.
2. The action is available only when that session has at least one failed Hanzi (`grade="again"`).
3. Clicking the action opens a dialog with a required session-name input.
4. The dialog pre-fills a suggested name derived from the results session date, but the user may edit it before submitting.
5. Submission resolves eligible packaged-session targets from the current family data:
   - Start from the row's deduplicated failed Hanzi list.
   - Keep only Hanzi that still have exactly one current `words` row in the family collection.
   - For each remaining Hanzi, include every saved `flashcard_contents` entry whose `character` matches that Hanzi.
   - Convert those saved entries into `character|pronunciation` review-test targets.
6. Hidden or historical admin-target metadata is not reconstructed from quiz history. The results action packages only currently saved content that still exists.
7. Target ordering reuses the existing packaged-session ordering helper: familiarity ascending, then character ascending, then pronunciation ascending.
8. If the entered session name matches an existing active session with exact case, the action appends only new targets to that session.
9. If the entered session name does not match an active session, the action creates a new active review test session.
10. If all resolved targets are already present in the matching session, no duplicate rows are written and the user gets a no-op success notice.
11. If no failed Hanzi resolve to any current saved targets, no mutation occurs and the user gets a blocking notice.
12. The action does not mutate `quiz_sessions`; the results page remains read-only with respect to quiz history itself.

## Layer impact
- UI: `/words/results` adds row action, dialog, and notices
- Domain: add helper logic to resolve failed Hanzi into packaged-session targets
- Service: reuse existing `listReviewTestSessions`, `createReviewTestSession`, and `appendTargetsToReviewTestSession`

## Edge cases
- Failed Hanzi whose word was deleted after the quiz: skip it
- Failed Hanzi with no saved flashcard content now: skip it
- Failed Hanzi with duplicate current `words` rows: skip it rather than creating a runtime-invalid packaged session
- Session row with zero failed Hanzi: hide or disable the action
- Existing active session name match with zero new targets: surface a no-op message instead of erroring

## Risks
- Results rows only store Hanzi, not pronunciation-level admin targets, so the packaged session can only reflect current saved content rather than the exact historical quiz payload.
- A later admin content change can make the packaged session broader or narrower than the original failed quiz context for the same Hanzi.

## Test plan
- Unit test the failed-Hanzi-to-target resolution helper:
  - deduplicates Hanzi
  - skips missing-content characters
  - skips duplicate-word characters
  - emits all saved pronunciations for eligible Hanzi
- Update results-table focused tests for action visibility rules
- Verify existing packaged-session service tests still pass unchanged

## Acceptance criteria
- From `/words/results`, a user can package one session's failed Hanzi into a named test session.
- The action reuses the existing packaged-session persistence flow.
- No new schema, RPC, or route is introduced.
- `quiz_sessions` records remain unchanged by the new action.
- Success and failure notices are bilingual and sourced from `words.strings.ts`.

## Open questions
- None for this implementation. The feature intentionally packages current saved content for failed Hanzi rather than attempting historical reconstruction.
