---
title: Fix Log – 2026-08-20 – Paused Paragraph-Quiz Session Shows Wrong Remaining Count
---

## Context

User reported (screenshot of Due Review's "Paused Sessions" table) that a paused paragraph-quiz session ("桃园三结义") always showed "还剩 0 个汉字" ("0 characters remaining") in the Remaining column, regardless of how many blanks were actually left, and that the column should show remaining **blanks** for this session type rather than characters.

## Root Cause

`getPausedSessionRemainingCount` (`src/app/words/shared/words.shared.utils.tsx`) is the only function `DueReviewSection.tsx` called to render the Remaining column for every paused-session row. It only understands the ordinary ad-hoc/packaged fill-test progress shape (`{ quizQueue: unknown[], resumeIndex?: number }`, as saved by `buildDueReviewAutosavePayload`) and returns `0` for anything else.

A paragraph-quiz session's saved `progress_data` is shaped entirely differently — `ParagraphQuizProgressData` (`{ testModeId, currentPageIndex, blankState, sessionStartTime }`, saved by `ParagraphQuizReviewSection.tsx`'s `autosave`) — it has no `quizQueue` field at all. So `getPausedSessionRemainingCount` always fell through its type guard and returned `0` for every paused paragraph-quiz row, independent of actual progress.

## Changes Applied

- `src/app/words/shared/words.shared.utils.tsx`:
  - Exported the previously-private `isParagraphQuizProgressData` type guard (no behavior change) so it can be reused outside this file.
  - Added `getPausedParagraphQuizRemainingBlankCount(progressData, totalBlanks)`: a pure helper that counts `blankState` entries with `status === "correct"` and returns `totalBlanks - correctCount` (floored at 0). `blankState` only ever gains an entry once a blank has actually been attempted (see `ParagraphQuizReviewSection.tsx`'s `handlePlacement`), so counting correct entries directly is sufficient — an untouched blank needs no entry to be correctly counted as "remaining".
- `src/app/words/review/DueReviewSection.tsx`:
  - Added `paragraphQuizTotalBlanksBySessionId`, a `useMemo` map built from the already-loaded `reviewTestSessionRows` — for any row whose `runtime.paragraphQuiz` is set, its `characterCount` field (computed in `words.shared.state.ts`) already equals the session's total blank count (`orderedWords`/`vocabPhrases` are always empty for a paragraph-quiz session), so no new resolution logic was needed to get the total.
  - Added `getPausedSessionRemainingLabel(row)`, which looks up the row's `packagedSessionId` in that map: if found (this row is a paused paragraph-quiz session), renders the new `remainingBlanks` string via `getPausedParagraphQuizRemainingBlankCount`; otherwise falls back to the existing `remaining` string via the original `getPausedSessionRemainingCount`.
  - Replaced the inline `str.due.pausedSessions.remaining.replace(...)` call in the Paused Sessions table with `getPausedSessionRemainingLabel(row)`.
- `src/app/words/words.strings.ts`: added `pausedSessions.remainingBlanks` ("{count} blanks remaining" / "还剩 {count} 个空格") to both `en` and `zh`, alongside the existing `remaining` ("{count} characters remaining") string, which is now used only for non-paragraph-quiz paused rows.
- Tests added: `src/app/words/shared/words.shared.utils.test.tsx` — new `getPausedParagraphQuizRemainingBlankCount` describe block (subtracts correct count from total, returns full total when nothing attempted, floors at 0, returns 0 for non-paragraph-quiz-shaped input), plus one added case confirming `getPausedSessionRemainingCount` itself still correctly returns 0 for paragraph-quiz-shaped input (documenting why the new function exists rather than extending the old one).

## Architectural Impact

UI-layer only (`src/app/words/review/`, `src/app/words/shared/`). No schema, RPC, RLS, or service-layer changes. Reused the existing `reviewTestSessionRuntimeById`/`reviewTestSessionRows` memoization already computed for the Test Sessions table above — no new data fetch or resolution path introduced.

## Preventative Rule

A helper that inspects a `progress_data`/`unknown` blob by shape (rather than an explicit discriminator field) must be re-examined whenever a new producer of that column starts writing a differently-shaped payload — `review_session_progress.progress_data` is intentionally polymorphic across ad-hoc/packaged-character and paragraph-quiz sessions (see `0_ARCHITECTURE.md`'s `review_session_progress` schema entry), so any function reading it needs a branch (or its own type-guarded sibling, as here) per shape it actually needs to support, not a single function assumed to cover all of them.

## Verification

- `npx vitest run src/app/words/shared/words.shared.utils.test.tsx` — 72/72 pass.
- `npm test` — 774/774 pass (769 pre-existing + 5 new).
- `npx tsc --noEmit` — clean.
- `npx eslint` on all four changed files — clean.
- `npm run check:encoding` — passes.
- Not re-verified live in-browser by the implementing session (no browser-automation tool available here) — the user should confirm the Paused Sessions row for a paragraph-quiz session now shows the correct "N blanks remaining" count after resuming/answering a few blanks.

## Docs Updated

- AI_CONTRACT.md: no — no hard-stop, boundary, or layer-crossing behavior involved.
- 0_ARCHITECTURE.md: no — corrects a display bug in already-documented behavior (Due Review Queue Rules); no documented rule changed.
- 0_BUILD_CONVENTIONS.md: no — no new convention introduced.
- 0_PRODUCT_ROADMAP.md: no — bug fix within Item I's already-shipped scope.
