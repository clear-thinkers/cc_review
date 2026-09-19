---
title: Fix Log – 2026-09-19 – Scheduler Retrievability Power-Law Model
---

## Context

Avg Familiarity on `/words/all` sat around 60% despite the child completing 25 reviews/day, and a character displayed below 20% familiarity was recalled correctly roughly 80% of the time. Investigated and root-caused in conversation (not a filed bug report) before drafting `docs/feature-specs/2026-09-19-scheduler-retrievability-power-law.md`.

## Root Cause

Two compounding issues in `src/lib/scheduler.ts`:

1. The retrievability formula was exponential (`R = exp(-elapsed/stability)`), which decays far faster than real human forgetting once a word sits unreviewed for more than a few days — at 24 days elapsed with stability 5, the old formula reads ~0.8% versus real recall around 65-80%.
2. `computeIntervalDays`'s interval target (`-S × ln(0.9) ≈ 0.105 × S`) scheduled reviews roughly 13x sooner than necessary, so most words re-entered the due pool almost immediately after being reviewed. With review throughput fixed at 25/day, the due backlog (~600 of ~800 words) far outpaced what could be drained, so a word's actual time between reviews was governed by backlog-size ÷ throughput (~24 days), not by its computed interval — and the exponential curve crashed toward the 1% floor well before most words were reviewed again.

The formula was also duplicated between `scheduler.ts` and `words.shared.utils.tsx`'s `getMemorizationProbability`, a drift risk independent of the curve-shape bug.

## Revision (same day, before live QA)

While drafting the manual test flow, sanity-checked concrete interval numbers for the as-shipped constants (`FORGETTING_FACTOR=9`, `R_TARGET=0.85`) against realistic `ease` values and found an overcorrection: a wrong "again" answer on a typical word (`ease=21`, the DB default) would schedule 17 days out, and a brand-new word's first-ever "good" grade would jump straight to 67 days — near-term intervals for existing `ease` values had ballooned ~15x versus the old model, not just the intended ~13-15x reduction in review *frequency* for the backlog. Root cause: `FORGETTING_FACTOR`/`R_target` control both the long-delay curve shape (the actual fix) and the near-term interval-per-unit-stability coefficient, and the original pair was chosen only against the long-delay calibration point, without checking the near-term side against the old model.

Recalibrated to `FORGETTING_FACTOR=8`, `R_TARGET=0.987` — solved so `FORGETTING_FACTOR × (1/R_TARGET − 1) ≈ 0.1054` (the old model's near-term coefficient), while `FORGETTING_FACTOR=8` alone still reproduces the long-delay fit (a `<20%`-displayed character is recalled ~83% of the time under the new curve, matching the observed ~80%). Verified: `computeIntervalDays(21) = 2` days (matches old exactly); a wrong answer at `ease=21` now schedules 1 day out; a first-ever "good" grade at `ease=21` schedules 4 days out (previously 3 under the old model) — proportionate, not a 67-day jump. `scheduler.test.ts` updated accordingly; full suite (925 tests) passes.

## Second bug found in live manual testing: familiarity stuck at 25% after an "again" grade

Manually testing the recalibration (grading a real due character "again" and checking `/words/all`) surfaced a second, **pre-existing** bug, unrelated to the retrievability curve change: `getMemorizationProbability`'s "never reviewed" guard checked `!word.repetitions`, but `calculateNextState` resets `repetitions` to 0 on every `again` grade — even though the word has real scheduling state (`reviewCount`, `nextReviewAt`, `ease`) and was just reviewed. Any word whose most recent grade was "again" therefore displayed a flat 25% placeholder regardless of its real retrievability, permanently, until a subsequent non-again grade pushed `repetitions` back above 0. This existed before this change (I only replaced the formula below the guard, not the guard itself) and plausibly contributed to the original "familiarity looks off" complaint independent of the curve-shape/backlog issue, since any character ever failed even once would be stuck at exactly 25% no matter how well it's since been retained.

Fixed in `words.shared.utils.tsx`: the guard now checks `!getReviewCount(word)` (which reads `reviewCount`, incremented on every grade including `again`, falling back to `repetitions` only when `reviewCount` is absent) instead of `!word.repetitions`. `nextReviewAt` is still checked to catch a Reset, which zeroes both fields together. Added a dedicated `getMemorizationProbability` test block in `words.shared.utils.test.tsx` (3 new tests) covering: never-reviewed, reset, and the "again"-doesn't-mean-unreviewed regression case. Also fixed a stale fixture in the adjacent `selectLowestFamiliarityWords` describe block (`reviewCount: 0` alongside `repetitions: 5` — an unrealistic combination that would have started hitting the same flat-25% branch under the corrected guard and broken the ordering assertions). Full suite (928 tests) passes.

## Second recalibration (same day, explicit product choice): FORGETTING_FACTOR 8 → 4

After live-testing several individual grades, the parent felt the long-delay decay was still too forgiving overall — a fresh word left unreviewed for ~60 days read ~74% under `FORGETTING_FACTOR=8`, and an already-tested "easy" word (`S≈63`) read ~89%. Presented a table of `FORGETTING_FACTOR` options (8/6/5/4/3) against two reference stabilities (a fresh `ease=21` word and a `S=63` "easy"-graded word) at 30/60/90/180-day marks, each cross-checked against the original recall-calibration data point (the scale-invariant "`<20%`-displayed, ~80%-recalled" observation). Chose **`FORGETTING_FACTOR=4`**, explicitly trading some of that empirical fit (long-delay recall now implies ~71% instead of the observed ~80% at the calibration point) for a stricter overall feel: a fresh word at 60 days now reads 58% (was 74%); a `S=63` word reads 81% (was 89%).

`R_TARGET` re-derived to `0.974` (from `0.987`) to preserve the same near-term-interval-matching property as before — `FORGETTING_FACTOR × (1/R_TARGET − 1)` still ≈ 0.1054, so every previously-validated near-term interval (雷's "good" → 3 days, 坑's "easy" → 7 days, 听's "again" → 1 day) is **unchanged**; only long-delay decay got faster. `scheduler.ts` and `scheduler.test.ts` updated. Full suite (932 tests, +4 unrelated to this change — a parallel "Last Review Date" column addition on `/words/all`) passes.

## Related, independently-authored change shipping in the same commit: Last Review Date column

Not part of this fix — a parallel edit (by the project owner, in the IDE, alongside this conversation) added a **Last Review Date** column to `/words/all` (`AllWordsSection.tsx`, `all.types.ts`, `words.strings.ts`). It builds directly on this fix-log's work: it extracted the never-reviewed/reset back-derivation logic out of `getMemorizationProbability` into a new exported `getLastReviewedAt(word)` helper in `words.shared.utils.tsx`, reused by both the new column and `getMemorizationProbability` itself (which now calls it instead of inlining the same check) — a clean instance of this fix-log's own Preventative Rule about not letting this logic drift into a second copy. Uses `getReviewCount`, not `repetitions` alone, for the same "ever reviewed" check this fix-log's second bug fix established. No new persisted column — `getLastReviewedAt` is derived, matching the existing `next_review_at − interval_days` technique, not a new `words` field. Documented in `0_ARCHITECTURE.md`'s All Characters Inventory Rules (new rule 6a). Test coverage: `getLastReviewedAt` describe block in `words.shared.utils.test.tsx`, `all.types.test.ts` sort-key coverage (+4 of the 932 total tests).

## Changes Applied

- `src/lib/scheduler.ts`: replaced the exponential curve with a power-law model (`R = 1 / (1 + elapsedDays / (FORGETTING_FACTOR × stabilityDays))`, same family FSRS uses), exported as `computeRetrievability`. Recalibrated `computeIntervalDays` to the power-law's own interval formula, settling at `FORGETTING_FACTOR=4`, `R_TARGET=0.974` after two rounds of tuning (see the two Revision notes — solved jointly so long-delay behavior fixes the reported bug while near-term intervals for existing `ease` values stay close to the old model's). Added a recall-aware stability boost on `good`/`easy` grades — a correct recall at low predicted retrievability now earns a bigger stability gain (bounded to at most 2x the base multiplier) than a correct recall right on schedule. Grade multipliers changed from `again=0.6/hard=1.05/good=1.35/easy=1.6` to `again=0.5/hard=1.2/good=2.0/easy=3.0` (good/easy additionally scaled by the recall boost).
- `src/app/words/shared/words.shared.utils.tsx`: `getMemorizationProbability` now delegates to `scheduler.ts`'s exported `computeRetrievability` instead of maintaining its own copy of the formula. Its "never reviewed" guard also fixed to check `getReviewCount(word)` instead of `word.repetitions` (see the second-bug section above).
- `src/app/words/shared/words.shared.state.ts`: `allWordsSummary.averageFamiliarity` now excludes never-reviewed words (`repetitions === 0`) from both the sum and the denominator, instead of folding them in at a flat 25% placeholder.
- `src/lib/scheduler.test.ts`: rewritten for the new formulas, including new coverage for `computeRetrievability` directly and the recall-aware boost mechanic.
- `src/app/words/shared/words.shared.utils.test.tsx`: new `getMemorizationProbability` describe block (3 tests); fixed a stale `reviewCount`/`repetitions` mismatch in the `selectLowestFamiliarityWords` fixture.
- No schema, RPC, RLS policy, or route changes — `ease`/`interval_days`/`next_review_at` are reused as-is; `ease` continues to mean "stability in days," now interpreted by a different curve.

## Architectural Impact

Domain layer only (`scheduler.ts`), plus two UI-layer call sites (`words.shared.utils.tsx`, `words.shared.state.ts`) updated to stay consistent with it. No Service or AI layer changes. Full spec: `docs/feature-specs/2026-09-19-scheduler-retrievability-power-law.md`.

## Preventative Rule

- The retrievability formula has one home (`scheduler.ts`'s exported `computeRetrievability`) — any future display or filter that needs a word's recall probability should import it rather than reimplementing the curve, the way `getMemorizationProbability` now does.
- `repetitions` is not a reliable "has this word ever been reviewed" signal — it resets to 0 on `again`. Use `getReviewCount(word)` (or `reviewCount` directly) for that check instead.
- Test fixtures for `Word` should keep `reviewCount` and `repetitions` mutually consistent (both reflect real review history) rather than defaulting one to 0 independently of the other — the stale `selectLowestFamiliarityWords` fixture above is exactly the kind of drift that hides a guard-condition bug like this one.

## Docs Updated

- AI_CONTRACT.md: no — no rule/hard-stop changed
- 0_ARCHITECTURE.md: yes — Data Schema's `ease` field note now points at the power-law formula and the spec; All Characters Inventory Rule 2's Avg Familiarity definition now states the never-reviewed-word exclusion
- 0_BUILD_CONVENTIONS.md: no
- 0_PRODUCT_ROADMAP.md: yes — item K status updated to reflect implementation
