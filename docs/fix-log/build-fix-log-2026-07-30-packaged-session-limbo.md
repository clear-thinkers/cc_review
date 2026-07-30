---
title: Fix Log – 2026-07-30 – Packaged Review Test Session Stuck in Limbo
---

## Context

Reported bug: a child completed a packaged review test session ("2.3.543")
and saw the post-session summary view including coins earned. However, the
parent's Due Review page still listed the session as paused with 1 character
remaining, the session never appeared as completed on the results/history
page for either user, and the child could not find or resume the paused
session from their own screen.

## Root Cause

Live (read-only) inspection of the prod database for session "2.3.543"
showed the completed `quiz_sessions` row and the stale `review_session_progress`
row were both attributed to the **parent's** `user_id`, not the child's.

The completion sequence in `moveQuizForward` (`words.shared.state.ts`) runs
two independent, best-effort backend calls when a queue's last word is
graded:

1. `recordQuizSession` -> `record_quiz_session` RPC (no role restriction --
   this is why it silently succeeded under the wrong caller identity).
2. `completeReviewTestSession` -> `complete_review_test_session` RPC, which
   requires the caller to be a child or platform admin
   (`supabase/migrations/20260321000001_review_test_sessions.sql`). Since the
   JWT's role claim resolved to `'parent'` for this call, the RPC raised
   *before* stamping `completed_at` or running its
   `delete from review_session_progress` cleanup -- leaving the packaged
   session "active" and the second-to-last autosave row (1 item short of the
   full queue) orphaned.

Separately, and independent of *why* the RPC was called under the wrong
identity: `moveQuizForward` had a real bug. After the `completeReviewTestSession`
catch block set an error notice via `setQuizNotice(...completeError...)`, a
few lines later the function *unconditionally* called
`setQuizNotice(completedReviewTestSession ? ...completed... : ...)`,
clobbering the real error with a false "session completed" message. Combined
with the amber completion-summary panel in `FillTestReviewSection.tsx`
(coins earned, correct rate) rendering purely from local `quizHistory` state
whenever `quizCompleted` is true -- independent of whether either backend
call actually succeeded -- the user saw a fully "successful" completion
screen with no indication anything had failed to save.

The deeper question of *why* the JWT resolved to the parent's identity for
what the user believed was a child-driven session (concurrent-device profile
switching clobbering the shared `auth.users.app_metadata` claims used by
`current_user_id()`/`current_jwt_role()`, vs. the parent operating the
session directly) was investigated but not conclusively determined from the
data alone, and is out of scope for this fix per user direction -- flagged
for separate investigation.

## Changes Applied

- `src/app/words/shared/words.shared.state.ts`: `moveQuizForward` now tracks
  whether `completeReviewTestSession` failed and skips the unconditional
  success notice in that case, so a real completion error is never
  overwritten by a false "completed" message.
- `src/app/words/shared/words.shared.utils.tsx`: extracted the notice
  decision into a new pure, testable helper, `resolveQuizCompletionNotice`
  (per `0_BUILD_CONVENTIONS.md §6` UI seam priority -- extracted pure helper
  over inline untestable logic in the large orchestration hook).
- `src/app/words/shared/words.shared.utils.test.tsx`: added regression
  coverage for `resolveQuizCompletionNotice`, including the specific
  clobbering scenario.
- `src/lib/packagedSessionReattributionFix.ts` +
  `.test.ts`: new pure SQL-builder (mirrors the existing
  `coinCompensationFix.ts` pattern) generating an idempotent repair
  transaction for a packaged session left in this exact limbo state:
  reattributes the misattributed `quiz_sessions` row and its coin award to
  the correct user, stamps `review_test_sessions.completed_at`, and deletes
  the stale `review_session_progress` row. Guards on current row ownership
  so reruns are no-ops, and raises rather than guessing if the quiz session
  is owned by neither the expected source nor target user.
- `scripts/generate-packaged-session-reattribution-fix.ts`: CLI wrapper
  (mirrors `generate-coin-compensation-fix.ts`) that validates the target
  session/users against the live database before emitting SQL, per
  `0_BUILD_CONVENTIONS.md §10`.
- `package.json`: added `generate:packaged-session-reattribution-sql` script
  entry.
- Applied the generated repair to prod for the specific reported incident
  (family `d7ee29e1-8666-49fb-9b71-603913595a18`, session
  `review-test-session-1784919402855-29hpa3fl` / "2.3.543"): reattributed
  `quiz_sessions` row `w_edw8vpv4_1785356210536` and its 96 coins from the
  parent to the child (瓜瓜), stamped `completed_at`, and removed the stale
  paused-progress row. Verified post-repair: `review_test_sessions.completed_at`
  set with `completed_by_user_id` = child, zero remaining
  `review_session_progress` rows for the session, `quiz_sessions.user_id`
  = child, both wallets rebalanced (parent 231→135, child 4885→4981).
  SQL saved at `supabase/manual/2026-07-30-packaged-session-2.3.543-reattribution.sql`.

## Architectural Impact

UI-layer only (`words.shared.state.ts` / `words.shared.utils.tsx`) --
notice/state handling around an existing RPC call, no new call graph edges,
no schema or RLS changes. `record_quiz_session` and `complete_review_test_session`
RPC definitions are unchanged.

The new repair script follows the existing `scripts/` admin/repair-script
pattern (`0_BUILD_CONVENTIONS.md §10`): pure SQL-builder + CLI wrapper that
validates targets against the live DB before emitting SQL, idempotent by
construction.

## Preventative Rule

Any fire-and-forget backend call in a completion/finish flow that sets an
error notice on failure must guard subsequent unconditional notice writes so
a later "success" message can never overwrite it. When a completion flow has
multiple independent best-effort backend calls, the UI's terminal state
(what the user sees as "done") must not be presented as unconditionally
successful when any of those calls failed -- at minimum the failure must
remain visibly surfaced, not silently overwritten.

## Docs Updated

- AI_CONTRACT.md: no -- no hard-stop or scope-boundary rule changed.
- 0_ARCHITECTURE.md: no -- no system guarantee, error-handling table entry,
  or data-schema change; the underlying RPCs and their role checks are
  unchanged and already correctly documented (Fill-Test Review Rules §19).
- 0_BUILD_CONVENTIONS.md: no -- the new repair script already fits the
  existing §10 pattern; no convention changed.
- 0_PRODUCT_ROADMAP.md: no -- bug fix within an already-shipped feature
  (item H, Save & resume test session progress), not a scope change.
