---
title: Fix Log – 2026-07-15 – Results Page Duplicate Quiz Session Records
---

## Context
The Quiz Results page (`/words/results`) sometimes showed two near-identical rows for what the user experienced as a single fill-test session — same date, same accuracy percentages, same tested/failed characters and coin total, but a one-second difference in duration (e.g. `9m 31s` vs `9m 30s`).

## Root Cause
`moveQuizForward()` in [src/app/words/shared/words.shared.state.ts](src/app/words/shared/words.shared.state.ts) is the handler bound to the fill-test "Finish"/"Next" button (`FillTestReviewSection.tsx`). On the last quiz item, it builds a `QuizSession` (with a fresh `makeId()`) and calls `recordQuizSession()`, then awaits `completeReviewTestSession()` and `refreshAll()` before setting `quizCompleted(true)`.

The Finish button's `disabled={quizSubmitting}` only reflected the *answer-submission* flag from `submitQuizAnswer`; `moveQuizForward` never set `quizSubmitting` itself and had no other re-entrancy guard. Because several awaits ran before `quizCompleted` flipped to `true` (which is what removes the button from the DOM), a second invocation of `moveQuizForward` during that window — e.g. a fast double-click — re-entered the `isLastWord` branch and built and persisted a second, independent `QuizSession` row with a new `Date.now()`-derived `createdAt`/`durationSeconds`. Both rows were legitimate inserts through `recordQuizSession()`/`record_quiz_session()`; this was a client-side double-submission, not a display or query bug.

## Changes Applied
- [src/app/words/shared/words.shared.state.ts](src/app/words/shared/words.shared.state.ts): added `quizFinishInFlightRef` (a `useRef`, consistent with the existing `quizExitWarningOpenRef` / `skipNextPopStateGuardRef` guard pattern already in this file) that is checked synchronously at the top of the `isLastWord` branch of `moveQuizForward`. A second call while the first is still in flight now returns immediately instead of re-running the finish sequence. The branch also now sets `setQuizSubmitting(true)` for its duration (reusing the existing flag already wired to the button's `disabled` prop) and resets both the ref and the flag in a `finally` block.
- No changes to `recordQuizSession`, `record_quiz_session()`, or any schema/RPC.

## Architectural Impact
None. This is a UI-layer (`src/app/...`) fix — a synchronous client-side re-entrancy guard around an existing handler. It does not touch the Domain, Service, or AI layers, and does not change the `recordQuizSession` service contract or the `record_quiz_session` RPC.

## Preventative Rule
Any async handler bound to a UI action that performs a non-idempotent write (session recording, RPC calls that insert rows) must set a re-entrancy guard for the *entire* async operation, not just reuse an unrelated loading flag from a different step of the flow. A `disabled` prop tied to a flag that isn't set for the full duration of the handler does not prevent double-submission from fast repeated clicks.

## Docs Updated
- AI_CONTRACT.md: no — no hard-stop, boundary, or agent-policy change
- 0_ARCHITECTURE.md: no — no layer boundary, schema, or system-guarantee change
- 0_BUILD_CONVENTIONS.md: no — no new convention introduced; existing ref-guard pattern reused
- 0_PRODUCT_ROADMAP.md: no — fix is within already-shipped Fill-Test/Results scope, not a new feature

## Tests
No dedicated unit/hook test was added. `useWordsWorkspaceState` (in `words.shared.state.ts`) is a single ~3800-line stateful hook with no existing test harness anywhere in the codebase (no `renderHook` usage found in `src/`), and it has deep dependencies on the Supabase service layer, routing, and locale strings. Building a mock harness to exercise this one guard clause would be disproportionate to the fix and out of scope for this change. The existing full suite (`npm test`, 401 tests across 38 files) passes unchanged, and `npm run check:encoding` passes. If broader coverage of this hook is prioritized later, a focused smoke test at the `FillTestReviewSection` component level (per the UI test-seam priority in the bug-fix skill) would be the next reasonable seam.
