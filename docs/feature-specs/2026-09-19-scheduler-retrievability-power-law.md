# Feature Spec — 2026-09-19 — Power-Law Retrievability Model

## Status: Shipped 2026-09-19

Authorized and implemented same day, then tuned twice more during live QA against real dev data:

1. **Revision 1** (before live QA): the originally-implemented constants (`FORGETTING_FACTOR=9`, `R_TARGET=0.85`) fixed the long-delay decay problem but, as an unintended side effect, also made near-term intervals for existing `ease` values ~15x longer than before (e.g. a wrong "again" answer on a typical word would schedule 17 days out, a first-ever "good" grade 67 days out) — an overcorrection caught by sanity-checking concrete numbers before drafting the manual test flow, not by the original test suite. Recalibrated to `FORGETTING_FACTOR=8`, `R_TARGET=0.987` — solved so near-term intervals match the old model closely, since the long-delay fix is controlled by `FORGETTING_FACTOR` alone.
2. **Revision 2** (during live QA, explicit product choice): after hands-on testing of several grades, `FORGETTING_FACTOR=8`'s long-delay decay still felt too forgiving (a fresh word unreviewed for 60 days read ~74%). Presented a table of `FORGETTING_FACTOR` options against the original recall-calibration data point; chose `FORGETTING_FACTOR=4` (paired `R_TARGET=0.974`), explicitly trading some empirical fit against the child's observed recall rate for a stricter overall curve. Near-term intervals remain unchanged from Revision 1 by construction.

Also found and fixed, during the same live QA, a **second, pre-existing, unrelated bug**: `getMemorizationProbability` showed a flat 25% for any word whose most recent grade was "again" (its guard checked `repetitions`, which an again-grade resets to 0, instead of `reviewCount`). See Proposed Behavior below for the current formulas and `scheduler.ts`'s own comment for the full derivation. See `docs/fix-log/build-fix-log-2026-09-19-scheduler-retrievability-power-law.md` for the complete applied-changes record and `0_PRODUCT_ROADMAP.md` item K for current status.

## Problem

`/words/all`'s Avg Familiarity stat sits around 60% despite the child completing 25 reviews/day, and individual "low familiarity" characters are recalled far more often than their displayed percentage predicts (observed: a character shown below 20% is recalled correctly ~80% of the time). Root-caused to two compounding issues:

1. **The retrievability curve is exponential** (`R = exp(-elapsed / stability)`, `src/lib/scheduler.ts` + duplicated in `src/app/words/shared/words.shared.utils.tsx`'s `getMemorizationProbability`), which decays far faster than actual human forgetting once a word sits unreviewed for more than a few days. Human forgetting is better fit by a power law (the model FSRS/modern Anki use): `R = (1 + t / (9S))⁻¹`. For the same `t` and `S`, the exponential formula can read 20% where the power law reads 85% — matching the observed 80% real-world recall rate almost exactly, with no change to the underlying stability numbers.
2. **Review throughput (25/day) is far below the due backlog (~600 of ~800 words currently due).** `computeIntervalDays`'s interval target (`-S × ln(0.9) ≈ 0.105 × S`) schedules reviews ~13× sooner than the power-law math below implies is necessary, so most words re-enter the due pool almost immediately after being reviewed — the backlog can't drain at 25/day. A word's *actual* time between reviews ends up governed by `backlog size ÷ daily throughput` (~24 days in steady state), not by its computed interval, and during that wait the exponential curve crashes toward the 1% floor well before the word is reviewed again.

Both issues are addressed together because they share the same root formula: fixing the curve shape also fixes the interval target, which shrinks the backlog that's aggravating the whole problem.

## Scope

- Replace the exponential retrievability formula with the power-law formula in `src/lib/scheduler.ts`, exported as the single source of truth.
- `getMemorizationProbability` (`words.shared.utils.tsx`) delegates to that exported function instead of maintaining its own copy of the formula (currently duplicated — see System Guarantee #8's intent that scheduling math has one home).
- Recalibrate `computeIntervalDays` to the power-law's own interval formula, targeted at `R_target = 0.85` (configurable constant, not per-family).
- Make the stability boost on a correct recall scale with how low the predicted retrievability was at the moment of that recall (successful recall at low predicted R is stronger evidence of true stability than successful recall at high predicted R).
- `words.shared.state.ts`'s `averageFamiliarity` calculation excludes never-reviewed words (`repetitions === 0`) from both numerator and denominator, instead of counting them at a flat 25%.

## Out of scope

- No new DB column, table, RPC, or migration. `last review time` continues to be derived as `nextReviewAt − intervalDays × DAY_MS` rather than stored explicitly — this remains exact because `calculateNextState` preserves the invariant `nextReviewAt = (time of this grade) + intervalDays × DAY_MS` under the new formula too. Storing it explicitly would be a cleaner long-term shape but crosses AI_CONTRACT §2's schema-migration boundary for no behavioral gain; deferred.
- No change to the DB default `ease = 21` seed value for new words.
- No change to daily review throughput/count, or any in-app nudge to raise it. Flagged as an open question below, not built here.
- No change to grade-button copy/UX, coin table, or any non-scheduler review-flow behavior.
- No roadmap edit — see Open Questions.

## Proposed behavior

**Retrievability** (replaces the exponential formula everywhere it's read):
```
R(elapsedDays, S) = 1 / (1 + elapsedDays / (FORGETTING_FACTOR × S))    // FORGETTING_FACTOR = 4
```

**Interval**, derived by solving the same formula for `elapsedDays` at `R = R_target`:
```
intervalDays = max(1, round(FORGETTING_FACTOR × S × (1 / R_target − 1)))
```
`FORGETTING_FACTOR` and `R_target` are not independent tuning knobs — they're solved together:
- `FORGETTING_FACTOR` controls the curve's long-delay *shape*. It was first set to `8` (matching observed real recall almost exactly — a heavily-overdue word's retrievability no longer crashes toward 0 the way the exponential model did), then deliberately lowered to **`4`** during live QA, an explicit product choice to make long-delay decay stricter, trading away some of that empirical fit (see Revision 2 above).
- `R_target = 0.974` is then solved so that `FORGETTING_FACTOR × (1/R_target − 1) ≈ 0.1054`, the OLD exponential model's near-term interval-per-unit-stability coefficient (`−ln(0.9)`). This keeps a word's *near-term* review cadence roughly unchanged on deploy for its existing `ease` value, regardless of which `FORGETTING_FACTOR` is chosen — only its behavior once significantly overdue changes. Concretely: `computeIntervalDays(21) = 2` days, matching the old model exactly at the DB's default new-word stability.

`R_target` should not be read as "the retention we're targeting at due time" in isolation — it's a calibration constant tied to `FORGETTING_FACTOR`, re-derived if that constant ever changes. The `max(1, …)` floor is kept (a sane lower bound); at `S_MIN = 0.5` every grade still lands on it (confirmed in `scheduler.test.ts`).

**Stability update on grading**, now recall-aware. `R_atReview` is the word's own retrievability (new formula) computed from its state *going into* this grade — i.e. before any of this grade's mutation — using the same derived-elapsed-time approach `computeIntervalDays`'s callers already use. For the very first grade of a word (`repetitions === 0` coming in), there is no meaningful prior review to compute `R_atReview` from, so the boost term is omitted (multiplier applies at its base value only):

```
currentStability = max(S_MIN, word.ease || 0)
boost = repetitions === 0 ? 1 : (1 + (1 − R_atReview))     // bounded: 1 ≤ boost ≤ 2

again: S' = max(S_MIN, currentStability × 0.5)              (repetitions resets to 0, as today)
hard:  S' = max(S_MIN, currentStability × 1.2)
good:  S' = max(S_MIN, currentStability × 2.0 × boost)
easy:  S' = max(S_MIN, currentStability × 3.0 × boost)
```

`boost` is capped at 2× by construction (`R_atReview ≥ 0`), so a word can't runaway-grow no matter how overdue it was when finally reviewed correctly.

**Summary stat**: `allWordsSummary.averageFamiliarity` (`words.shared.state.ts`) sums and divides over `words.filter(w => (w.repetitions ?? 0) > 0)` only.

## Layer impact

| Layer | File | Change |
|---|---|---|
| Domain | `src/lib/scheduler.ts` | Replace retrievability/interval formulas; export the retrievability function; recall-aware stability boost |
| UI | `src/app/words/shared/words.shared.utils.tsx` | `getMemorizationProbability` delegates to the scheduler's exported function instead of reimplementing it |
| UI | `src/app/words/shared/words.shared.state.ts` | `averageFamiliarity` excludes never-reviewed words |

No Service or AI layer changes. No schema, RPC, RLS, or route changes.

## Edge cases

- **Never-reviewed word** (`repetitions === 0`, `nextReviewAt` empty/0): unaffected by the retrievability formula change (still handled by `getMemorizationProbability`'s existing early return); now also excluded from the Avg Familiarity stat entirely rather than counted at 25%.
- **First-ever grade**: boost term omitted (see above) — avoids computing `R_atReview` against a word that was never actually "recalled" from a prior state.
- **Repeated `again` near `S_MIN`**: clamp behavior unchanged (`Math.max(S_MIN, …)` preserved on every branch).
- **Very long backlog wait (60+ days) before a correct review**: `boost` still caps at 2×; display clamp `[0.01, 0.99]` unchanged.
- **Existing `ease` values on already-reviewed words**: `ease` continues to mean "stability in days" under both the old and new curve — no rescaling/backfill needed, only the function that *interprets* it changes. This assumption is validated empirically in Test Plan (dry-run replay), not just asserted.

## Risks

- **AI_CONTRACT §2 Scope Boundary**: this is explicitly "Changing the scheduler's grading logic or due-date algorithm." This spec document does not implement the change — implementation requires the word **"authorized"** to appear in this conversation first, per AI_CONTRACT §2's exact procedure. Not yet given as of writing this spec.
- **Hard cutover on deploy**: there's no feature-flag mechanism in this codebase. The moment this ships, every existing word's displayed familiarity and every future due-date computation change simultaneously — no gradual rollout.
- **Unlisted in `0_PRODUCT_ROADMAP.md`**: flagged above; not resolved by this document.

## Test plan

- `src/lib/scheduler.test.ts`: update/add cases per Build Conventions §6 ("Scheduler logic: unit test each grade tier — verify `nextReviewAt` and `interval`") — each grade tier under the new formula, `S_MIN` clamping, the `boost` term at representative `R_atReview` values (near 0, near 1), and the first-grade no-boost case.
- `words.shared.utils.test.tsx`: update `getMemorizationProbability`/`selectLowestFamiliarityWords` expectations for the new curve; confirm it delegates to (doesn't reimplement) the scheduler's function.
- `words.shared.state.ts` tests: confirm `averageFamiliarity` excludes `repetitions === 0` words.
- Dry-run replay (scratch script, read-only against dev via existing service functions, never writes): compute old vs. new retrievability/interval for the family's current ~800 `words` rows, report the before/after distribution and how many words fall below `R_target` (the new "due" proxy) — the number to watch is whether that count settles near a small multiple of 25 instead of ~600.
- Manual QA on dev: `/words/all` Avg Familiarity and `/words/review`'s due count / Quick Add 25 selection behave sensibly after the change.
- `npm test`, `tsc --noEmit`, `eslint`, `npm run check:encoding` all green (per Build Conventions §0).

## Acceptance criteria

- Single retrievability implementation, exported from `scheduler.ts`; no duplicated formula in `words.shared.utils.tsx`.
- All scheduler/UI tests above pass; full suite green.
- Dry-run replay against real dev data shows the due backlog shrinking to a plausible multiple of daily throughput, not ~24×.
- No new migration, RPC, RLS policy, or route introduced.
- AI_CONTRACT §2 authorization (literal word "authorized") obtained before merge.
- Per AI_CONTRACT §4 Post-Task Protocol: `0_ARCHITECTURE.md`'s Data Schema note on `ease` and All Characters Inventory Rule 2 (Avg Familiarity definition) updated in the same commit to reflect the new formula and the never-reviewed exclusion; a fix-log entry created (this qualifies under "Any change to normalization, safety filtering, or scheduler logic").

## Open questions

- Should `0_PRODUCT_ROADMAP.md` gain a tracked entry for this work (new item, or appended under an existing Tier 1 line), given it's currently unlisted? Recommend yes, deferred to whoever authorizes implementation.
- Is `R_target = 0.85` the right target, or should it stay at the original `0.9` now that the curve itself is fixed? 0.85 was chosen to roughly match the observed 80% real-world recall rate with a small safety margin; open to adjustment.
- Should daily throughput (currently a manual "Quick Add 25" action) get a companion nudge (e.g., surfacing "the backlog implies you need ~N/day to keep up") as a follow-up, separate spec?
