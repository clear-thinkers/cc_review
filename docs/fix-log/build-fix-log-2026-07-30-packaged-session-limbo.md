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

---

## Retry Attempt — 2026-08-08

### Why the Prior Attempt Failed

It didn't fail so much as it was scoped narrower than the actual defect: the
2026-07-30 fix corrected the client-side symptom (the notice-clobbering bug)
and repaired the one reported incident's data, but explicitly deferred the
deeper root cause -- *why* the JWT resolves to the parent's identity during
what should be a child-driven session. That root cause was still live, so
the same misattribution recurred.

### Revised Root Cause

Same as before: `record_quiz_session` has no role gate and silently
succeeds under whichever identity the JWT resolves to at call time. A second
incident was found in the same family (`d7ee29e1-8666-49fb-9b71-603913595a18`):
quiz session `w_793808c5_1785886010797` (2026-08-04T23:26:50Z, 8 grades, 32
coins) was recorded under the parent's `user_id` instead of the child's.

This instance differed from the first in a way worth recording: at
investigation time there were no leftover `review_session_progress` rows
anywhere in the system, and none of the 19 currently-open (uncompleted)
packaged sessions in that family could be conclusively matched to the 8
graded characters (best match was a partial 5/8 overlap with session "2.1";
the other 3 graded characters weren't in "2.1"'s target list, and content
for the overlapping targets had since been edited, making retroactive
verification unreliable). Separately, the child successfully completed two
other sessions ("2.2" and "复习") the next day (2026-08-05), which is
consistent with the family retrying and succeeding under the correct
identity rather than the original attempt ever resolving itself -- this is
also why the user reported "I no longer see the in-limbo session": nothing
was left visibly stuck in the UI, only the orphaned parent-owned
`quiz_sessions` row and its misattributed coins remained.

Given the ambiguity, this repair was intentionally scoped to **only** the
`quiz_sessions` ownership + wallet rebalance for the one identified orphaned
row -- no `review_test_sessions` or `review_session_progress` rows were
touched, since none could be reliably tied to this specific record. Marking
an unrelated packaged session "complete" on a guess would have hidden its
other un-reviewed characters from the child.

### Changes Applied

- No code changes this round -- the notice-clobbering fix from the prior
  attempt already covers the client-side symptom; this recurrence is a data
  incident, not a new code defect.
- Applied a scoped one-off repair to prod: reattributed `quiz_sessions` row
  `w_793808c5_1785886010797` and its 32 coins from the parent
  (`9f878502-9e97-4bfe-aabd-8320692a4a31`) to the child
  (`55793185-3e1a-4efe-ab8d-8fc73e773901`). Verified post-repair: the quiz
  session's `user_id` is the child, and both wallets rebalanced correctly
  (the parent's wallet netted back to its pre-incident value since the
  original bug's erroneous +32 credit and this repair's -32 correction
  cancelled out; the child gained +32 on top of her normal activity in the
  interim). SQL saved at
  `supabase/manual/2026-08-08-quiz-session-w_793808c5-reattribution.sql`.
  Did not reuse the existing `generate-packaged-session-reattribution-fix.ts`
  script, since it always stamps a specific packaged session's
  `completed_at` and deletes its progress row -- neither applies here, and
  forcing a fake `--session-id` through it would have produced misleading
  generated-SQL comments claiming to touch a packaged session that isn't
  actually implicated.

### Architectural Impact

None -- data-only repair, no schema/RLS/code changes.

### Preventative Rule

The underlying identity-resolution root cause (flagged but deferred in the
original attempt) remains open and is the actual preventative fix needed:
until `record_quiz_session` and the broader completion flow can guarantee
the JWT's `user_id`/`role` claims reflect the profile the UI is actually
displaying (see the original Context section's note on shared
`auth.users.app_metadata` across concurrent device/profile switches), this
class of incident will keep recurring and each instance will need to be
found and repaired manually. Recommend prioritizing that investigation
before the next recurrence rather than continuing to patch data after the
fact.

### Docs Updated

- AI_CONTRACT.md: no -- no hard-stop or scope-boundary rule changed.
- 0_ARCHITECTURE.md: no -- no schema, RLS, or system-guarantee change.
- 0_BUILD_CONVENTIONS.md: no -- no new script or convention introduced.
- 0_PRODUCT_ROADMAP.md: no -- data repair, not a scope change.
