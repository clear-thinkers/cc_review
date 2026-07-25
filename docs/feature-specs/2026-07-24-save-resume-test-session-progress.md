# Feature Spec — 2026-07-24 — Save & Resume Progress on Any Test Session

## Status: Shipped 2026-07-25

## Problem

A child mid-way through a test session (either an ad-hoc due-review fill-test, or
a packaged review test session) has no way to pause and come back later. Runtime
quiz state (queue, position, per-character grades collected so far, elapsed timer)
lives only in transient React state (`useFillTestReviewState.ts`) and is discarded
on navigation away — `stopQuizSession()` explicitly resets it. If a child needs to
switch to another task, they lose all progress and must restart the whole session
from scratch.

## Scope

- Persist in-progress test-session state (queue, position, selections, per-character
  grade history, elapsed time) so a child can leave and later resume exactly where
  they stopped — for **both** ad-hoc due-review fill-test sessions and packaged
  review test sessions.
- Progress saves **automatically** after every graded blank/word (autosave) — no
  manual "save" button required, so an abrupt tab close or app switch never loses
  work.
- A child can have **multiple paused sessions at once** (e.g. a paused due-review
  session and a paused packaged session simultaneously).
- On resume, saved queue items are **re-validated** against current content state;
  any item whose underlying word/content no longer exists or is no longer fill-test
  eligible is silently dropped, and the session resumes with the remaining valid
  items (mirrors the existing skip-invalid pattern in "Send Failed to Test Session").
- Parents get **read-only visibility** into a child's paused sessions on Due Review
  (existence + basic progress, no ability to resume or edit) — consistent with
  parents already being able to inspect (but not initiate) packaged sessions.
- Resuming and discarding a paused session are child-only actions (and platform
  admin), matching existing fill-test permission scoping.

## Out of scope

- Any change to `quiz_sessions` (completed-session audit history) — remains
  immutable and insert-only. Saved progress is deleted once a session actually
  completes; it never becomes part of the permanent record.
- Expiring/auto-discarding stale paused sessions after a time window. Not
  requested; can be added later if paused sessions accumulate in practice.
- Cross-device conflict resolution beyond last-write-wins. At pilot family scale,
  a child is expected to use one device at a time; no locking is added.
- Parent ability to resume, discard, or edit a child's paused session — read-only
  only, per the resolved design gate.

## Proposed behavior

### Data model

New table `review_session_progress` — one row per paused session:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | Foreign key → `users.id`; owning child (or platform admin) |
| `family_id` | uuid | Foreign key → `families.id`; denormalized for RLS |
| `client_session_key` | text | Stable key for the paused session. For packaged sessions this **is** `review_test_sessions.id`. For ad-hoc due-review sessions it is a UUID minted client-side at session start and held for the life of that runtime session. |
| `source_type` | text | `'due_review'` \| `'packaged'` |
| `packaged_session_id` | text (nullable) | Foreign key → `review_test_sessions.id`; cascades on delete; null when `source_type = 'due_review'` |
| `progress_data` | jsonb | Serialized runtime state: `quizQueue`, `quizIndex`, `quizSelections`, `quizHistory`, `quizSelectionMode`/bundle plan, `elapsedSecondsAtSave` |
| `started_at` | timestamptz | When the session was originally started |
| `last_saved_at` | timestamptz | Updated on every autosave |
| `created_at` | timestamptz | Server timestamp |
| **Unique constraint** | | `(user_id, client_session_key)` — autosave upserts this row rather than creating duplicates |

RLS (matches existing patterns in `0_ARCHITECTURE.md §3`, no new policy shape):
- **Family-scoped read:** `family_id = current_family_id()` OR `is_platform_admin()` — gives parents the agreed read-only visibility for free, no separate parent-visibility policy needed.
- **User-scoped write:** insert/update/delete only when `family_id = current_family_id()` AND `user_id = current_user_id()` (or platform admin) — only the owning child can save or discard their own progress; parents cannot write.

### Save (autosave)

- After each graded blank/word during a fill-test session (both ad-hoc and
  packaged), the service layer upserts the `review_session_progress` row for the
  current `client_session_key` with the latest `progress_data` and
  `last_saved_at`.
- Autosave is fire-and-forget (does not block quiz interaction); a failure is
  logged but does not interrupt the session, matching the "Supabase read failure"
  graceful-degradation posture in `0_ARCHITECTURE.md §5` (session continues
  in-memory even if the save silently fails).

### Resume

- Due Review (`/words/review`) gains a "Paused Sessions" list (child/platform-admin
  view) showing each `review_session_progress` row for the current user: source
  type, characters remaining, last-saved time, with **Resume** and **Discard**
  actions.
- **Resume**: loads `progress_data`, re-validates every queued item against
  current `words` / `flashcard_contents` (and, for packaged sessions, current
  `review_test_session_targets`) state. Invalid items are dropped silently (no
  error surfaced — matches the existing skip-invalid precedent). The fill-test
  runtime state (`useFillTestReviewState.ts`) is initialized from the validated
  remainder instead of a fresh plan.
- **Discard**: deletes the `review_session_progress` row; no confirmation dialog
  (matches the existing immediate-removal precedent for non-destructive-to-history
  actions).
- Parents see the same list read-only (no Resume/Discard buttons), rendered
  alongside the existing packaged-session inspection UI.

### Cleanup on completion

- Ad-hoc due-review completion: after the existing `quiz_sessions` insert
  succeeds, the client deletes the matching `review_session_progress` row via the
  service layer (plain delete under the user-scoped RLS write policy — no RPC
  needed).
- Packaged session completion: `complete_review_test_session` RPC gains one
  additional statement deleting any `review_session_progress` rows for that
  `packaged_session_id`, in the same transaction boundary as the existing
  completion stamp.

## Layer impact

| Layer | Touched | Notes |
|---|---|---|
| UI | Yes | `src/app/words/review/DueReviewSection.tsx` (paused-sessions list), `src/app/words/review/fill-test/FillTestReviewSection.tsx`, `src/app/words/shared/state/useFillTestReviewState.ts` (init-from-saved-state path) |
| Domain | Yes | New pure helper to re-validate a saved queue against current content (`src/lib/fillTest.ts` or a sibling module) |
| Service | Yes | `src/lib/supabase-service.ts` — new `saveReviewSessionProgress`, `loadReviewSessionProgress`, `listReviewSessionProgress`, `deleteReviewSessionProgress` |
| AI | No | — |

Also touched: `src/app/words/shared/words.shared.state.ts` (autosave hook wiring,
resume/discard handlers), `src/app/words/words.strings.ts` (bilingual strings for
paused-session list, Resume/Discard buttons, empty state), one new migration under
`supabase/migrations/`, `complete_review_test_session` RPC definition.

Touches 4 layers and adds a persisted table + RPC change → spec required per
`BUILD_CONVENTIONS §1`. Schema/RPC change is a `AI_CONTRACT.md §2` scope boundary
— **authorized** by the user in conversation on 2026-07-24, along with the four
design gates below.

## Design gates already resolved (2026-07-24)

- Save trigger: **autosave** after each graded answer (not a manual save button).
- Resume reconciliation: **re-validate and skip stale items** silently.
- Concurrency: **multiple paused sessions allowed** per child at once.
- Parent visibility: **read-only** — parents can see paused sessions exist but
  cannot resume or discard them.

## Edge cases

- A child resumes a packaged session whose parent has since deleted the whole
  `review_test_sessions` row (or its last target): `packaged_session_id` cascade
  delete removes the orphaned `review_session_progress` row automatically —
  nothing to resume, the paused-sessions list simply won't show it.
- A child resumes an ad-hoc due-review session where every queued word has since
  been deleted or lost fill-test eligibility: re-validation drops all items,
  leaving an empty queue. Treat this the same as the existing "no eligible
  targets" empty state rather than resuming into a broken quiz.
- Two devices logged into the same child profile simultaneously: last autosave
  wins; no lock. Acceptable at pilot family scale (same caveat already accepted
  for `appendTargetsToReviewTestSession`).
- Autosave failing mid-session (network blip): session continues in-memory
  uninterrupted; the next successful autosave catches the state up. Worst case on
  an abrupt exit before the next successful save is losing only the answers since
  the last successful autosave, not the whole session.

## Risks

- No risk to wallet, coin, or scheduler state — this feature does not touch those
  tables or RPCs.
- New table/RLS surface increases audit scope slightly; `verify-rls.ts` must be
  extended to cover family-scoped read + user-scoped write on
  `review_session_progress` before this ships to prod.
- `complete_review_test_session` RPC change requires re-deploying the RPC and
  re-running `verify-rls.ts` / the RPC's existing test coverage — not just a new
  migration applied silently.

## Test plan

- `src/lib/supabase-service.reviewSessionProgress.test.ts`: save upserts by
  `client_session_key`, load returns null when no row exists, list scopes to the
  current user, delete removes the row, family/user RLS boundaries mocked and
  asserted.
- Domain re-validation helper: unit tests for dropping deleted words, dropping
  words that lost fill-test eligibility, and passing through fully-valid queues
  unchanged.
- UI: paused-sessions list renders Resume/Discard for child/admin and read-only
  rows for parent; resuming initializes `useFillTestReviewState` from validated
  saved state; discarding removes the row and the list entry.
- RPC: extend `complete_review_test_session` test coverage to assert progress
  rows are deleted on completion.
- Full existing suite re-run to confirm no regressions; `npm run check:encoding`
  and `npx tsc --noEmit` clean.

## Acceptance criteria

- [x] A child can leave an in-progress due-review fill-test session and later
      resume it from Due Review with prior answers, position, and grades intact.
      Verified live: graded word 1, reloaded/re-authenticated, resumed onto
      word 2 without replaying word 1.
- [x] A child can leave an in-progress packaged review test session and later
      resume it the same way. Verified live: same flow through a packaged
      session's flashcard→fill-test handoff; resume skips flashcard entirely
      and lands back in fill-test.
- [x] A child can have more than one paused session at a time and choose which
      to resume. Enforced by `(user_id, client_session_key)` uniqueness (one
      row per distinct session, not per user) and covered by
      `filterPausedSessionsForViewer`'s mixed-source-type unit test; not
      separately demoed with two simultaneous live paused sessions.
- [x] Resuming re-validates queued items and silently drops any that are no
      longer valid, rather than erroring. Unit-tested for both the general
      (word/content deleted) and packaged-only (target removed by parent)
      cases in `words.shared.utils.test.tsx`.
- [x] Parents can see that a paused session exists (read-only) but have no
      Resume/Discard controls. Verified live for a packaged paused session:
      parent's Due Review view shows it with zero Resume/Discard buttons.
- [x] Completing a session (either flow) deletes its saved progress row.
      Verified live for both flows: ad-hoc deletes client-side after the
      `quiz_sessions` insert; packaged deletes server-side inside
      `complete_review_test_session` (confirmed via direct DB query showing
      0 remaining rows, with no redundant client-side delete call).
- [x] No wallet/coin/scheduler state is touched beyond the existing
      `record_quiz_session`/`gradeWord` paths. `verify-rls.ts` passes (37/0)
      with `review_session_progress`'s policies covered. All new and existing
      tests pass (40 files / 446 tests). Coin crediting across an
      interruption verified live for both flows by checking wallet balance
      before/mid-session/after against the recorded `quiz_sessions.coins_earned`.

## Open questions

None outstanding — all design gates resolved in conversation on 2026-07-24.
