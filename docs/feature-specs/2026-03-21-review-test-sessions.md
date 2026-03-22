# Feature Spec — 2026-03-21 — Review Test Sessions

## Status: Shipped 2026-03-21

## Problem

Parents can curate flashcard content on `/words/admin`, and children can review due characters on `/words/review`, but there is no way to package multiple curated targets into a named session that a child can complete in one continuous flow.

The requested behavior is:
- Parent multi-selects targets on Content Admin
- Parent clicks `Add to test session`
- App prompts for a session name; exact active-name match appends to that session
- Session is saved with backend creation timestamp
- Session list appears on Due Review for both parent and child
- Only children can initiate the session
- When initiated, the child must complete flashcards first, then immediately continue into the quiz

## Scope

- Add multi-select UI to Content Admin target rows
- Add session save flow with case-sensitive active family-scoped session names
- Persist packaged review/test session metadata and selected targets in Supabase
- Show packaged session list on Due Review
- Allow both parent and child to inspect packaged contents from Due Review
- Allow only child users to start a packaged session
- Enforce session runtime order: flashcard phase first, then fill-test phase

## Out of Scope

- Any scheduler grading rule changes
- Any live AI generation during review
- Any new top-level routes
- Session editing, reordering, duplication, or archival UI beyond basic listing/inspection
- Parent-initiated quiz execution
- Coins/rewards redesign
- Changes to existing standalone due-word flashcard or standalone fill-test flows unless needed for session handoff reuse

## Proposed Behavior

### 1. Content Admin packaging UX

- Add a selection control per target row on `/words/admin`.
- Selection unit is the existing admin target key: `character|pronunciation`.
- A parent can select multiple targets across the current filtered table.
- A new page-level pill button appears when at least one target is selected:
  - EN: `Add to test session`
  - ZH equivalent added in `admin.strings.ts`
- Clicking the button opens a lightweight prompt/modal with:
  - session name input
  - input defaults to the most recently created active session name, if one exists
  - selected target count summary
  - save and cancel actions
- Save is blocked when:
  - session name is blank after trim
  - no targets are selected
- Save behavior is:
  - if the exact case-sensitive name matches an active family session, append only new packaged targets to that existing session
  - if the name does not match an active family session, create a new active session
  - duplicate packaged targets for the same session are ignored rather than duplicated

### 2. Session persistence model

- Add a new family-scoped table for packaged sessions, for example `review_test_sessions`.
- Add a child table for packaged targets, for example `review_test_session_targets`.
- Parent save writes:
  - either a new family-scoped session row or additional targets into an existing active session with the same exact case-sensitive name
  - unique active-session name
  - server creation timestamp for newly created sessions
  - creator user id for newly created sessions
  - ordered target list for newly inserted targets
- Unique session name is enforced at the database level per family and is case-sensitive.
- Exact active-name matches append to the existing active session instead of failing validation.
- Session targets store:
  - session id
  - target key (`character|pronunciation`)
  - character
  - pronunciation
  - display order
- Default display/runtime order is computed at creation time as:
  - familiarity ascending (lowest first)
  - then character ascending
  - then pronunciation ascending
- The session should reference packaged targets directly, not copy flashcard content into a second content table.
- Runtime always reads current persisted flashcard content for those packaged targets.

### 3. Due Review packaged-session list

- Add a new section to `/words/review` below existing due actions/table:
  - session list visible to both parents and children
  - each row shows session name, creation timestamp, target count, and packaged target preview
- Parent behavior:
  - can view session metadata and packaged targets
  - can delete the entire active session from Due Review
  - cannot start the session
- Child behavior:
  - can view session metadata and packaged targets
  - can start the session

### 4. Session runtime flow

- Starting a packaged session from Due Review creates a two-phase runtime:
  1. flashcard review for the packaged targets
  2. immediate handoff into fill-test for the same packaged targets
- The child cannot skip directly to the quiz from a packaged session.
- Packaged targets are grouped into character-level runtime units before review starts.
- Flashcard phase uses character-level runtime order derived from the packaged target set, not the due-word queue order.
- If multiple packaged targets belong to the same character, flashcard review bundles them together exactly like the current flashcard experience for one Hanzi with multiple pronunciations.
- Quiz phase derives character-level testable words from the packaged target set plus existing saved content eligibility.
- Grading remains character-level, not target-level:
  - the graded `wordId` is the family-scoped `words` row whose `hanzi` matches the packaged character
  - pronunciation does not create separate grading records
  - multiple packaged targets for the same character contribute content to one bundled review/test unit
- Packaged sessions are shown on Due Review even when their targets are not currently due.
- If a packaged target no longer has usable fill-test content by runtime:
  - it still appears in flashcard phase
  - it is skipped from quiz phase with a clear session notice/count
- Parents may inspect session contents from Due Review but are blocked from runtime start controls.
- After quiz completion:
  - show the normal quiz summary screen
  - mark the packaged session completed
  - return to Due Review
  - hide the completed session from the Due Review session list

### 5. Session lifecycle assumptions

- Sessions are persistent until explicitly deleted in a future phase.
- Completed sessions are single-use for Due Review visibility in v1:
  - after completion, the session disappears from `/words/review`
  - once completed, its name becomes reusable for a new session
- Session creation timestamp is immutable and server-authored.

## Layer Impact

### UI

- `src/app/words/admin/AdminSection.tsx`
  - add selection column / state-driven selection affordances
  - add packaged-session creation button and prompt/modal
- `src/app/words/review/DueReviewSection.tsx`
  - add packaged-session list and read-only preview UI
  - add child-only start action
  - add parent delete action for active sessions
- `*.strings.ts`
  - bilingual copy for session actions, validation, empty states, and notices
- `*.types.ts`
  - feature-scoped types for session list rows, creation payloads, and runtime session state

### Shared state / domain orchestration

- `src/app/words/shared/words.shared.state.ts`
  - maintain selected admin targets
  - create or append packaged session
  - load packaged sessions into Due Review
  - add runtime state for active packaged session
  - hand off from flashcard completion into quiz start using packaged target membership

### Service layer

- `src/lib/supabase-service.ts`
  - create packaged session
  - append targets to an existing packaged session
  - list packaged sessions
  - list packaged session targets
  - optionally fetch packaged targets joined against current saved content

### Database

- new table: `review_test_sessions`
- new table: `review_test_session_targets`
- RLS policies:
  - family-scoped read for parent and child
  - insert allowed for parent and platform admin
  - delete allowed for parent and platform admin
  - child cannot insert/update/delete
- completion persistence must track completed state or completed timestamp so completed sessions no longer appear on Due Review while still allowing name reuse

### Architecture docs

- `0_ARCHITECTURE.md`
  - new rules for packaged review sessions under Content Admin and Due Review
- `0_PRODUCT_ROADMAP.md`
  - add feature entry before implementation begins

## Edge Cases

- Parent selects targets, but one or more targets are deleted from Content Admin before child starts the session.
- Session name collision differs only by case or surrounding whitespace.
- Parent reuses an existing active session name and some or all selected targets are already packaged in that session.
- Same character appears with multiple pronunciations in one session.
- Packaged targets include rows with flashcard content but no phrases marked for testing.
- Packaged targets include rows whose content becomes invalid or cleared after packaging.
- Empty session list on Due Review.
- Parent attempts to start via direct deep link or manipulated client state.
- Parent deletes an active session from Due Review.
- Child starts a session containing zero quiz-eligible targets after flashcard review.
- A completed session name is reused for a new session while an older completed row still exists in storage.

## Risks

- New session runtime path can drift from existing due-review flow unless it reuses current flashcard and fill-test state helpers carefully.
- A session packages `character|pronunciation` targets, while current quiz flow is word-centric; mapping packaged targets to quiz words needs a deterministic rule.
- Packaged sessions select content at the target level but must collapse back to character-level runtime behavior without drifting from the current review/test semantics.
- Parent visibility plus child-only initiation must be enforced in both UI and service/RLS, not UI alone.
- If session names are only client-validated, race conditions could still create duplicates.

## Test Plan

- Service tests:
  - create session succeeds with unique name
  - duplicate active family-scoped name with exact case appends to the existing session
  - same letters with different case are treated as different names
  - completed-session name can be reused
  - child insert is rejected
  - session list returns family rows only
- UI tests:
  - Content Admin multi-select enables/disables create button correctly
  - session prompt validation shows bilingual errors
  - Due Review renders packaged session list for both roles
  - parent sees no start button
  - parent sees delete button
  - child sees start button
- Runtime tests:
- packaged session enters flashcard first, then quiz
- packaged session uses packaged character order
- multiple packaged targets for one character are bundled into one character-level review/test unit
- non-quiz-eligible packaged targets are skipped from quiz only
  - completion marks session hidden from Due Review and returns to Due Review after summary
  - direct URL or state tampering does not let parent initiate child-only session

## Acceptance Criteria

- Parent can multi-select multiple Content Admin targets and save them into a named session, or append them into an existing active session by reusing the same exact case-sensitive name.
- Saved session records include backend-authored creation timestamp.
- Due Review shows packaged session list to both parent and child users.
- Parent can inspect packaged targets but cannot initiate the session.
- Parent can delete an active packaged session from Due Review.
- Child can initiate a packaged session from Due Review.
- Packaged session always runs flashcards before quiz.
- Quiz phase uses only packaged character units derived from packaged targets with valid saved test content.
- Packaged sessions are visible even when packaged targets are not currently due.
- After quiz completion, the user sees quiz summary, then returns to Due Review, and the completed session no longer appears there.
- A completed session name can be reused for a new session with the same exact case.
- No live AI generation occurs during packaged session execution.

## Open Questions

- None at this time. If duplicate `words` rows for the same Hanzi are ever encountered despite the schema uniqueness rule, runtime must block the session with an error rather than guess.
