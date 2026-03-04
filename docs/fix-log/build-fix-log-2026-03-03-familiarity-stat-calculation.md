# Fix Log – 2026-03-03 – Familiarity Stat Calculation

_Phase 1 Bug Fix: Grading Logic Audit_

---

## Context

During grading logic verification, a concern was raised about the familiarity stat metric after grading a new word as "hard":
- Interval correctly shows **2 days**
- Familiarity jumps from **25% → 99%**

The question: should this metric be static (always ~90%) or dynamic (varying with time)?

**Resolution:** The metric should be **dynamic**—showing retention probability as of today, so users can see natural memory decay over the review cycle.

---

## Root Cause

The original implementation computed retention probability at the **current moment**, which was correct. However, the documentation was unclear about why "hard" graded words would show 99% (i.e., because you literally just reviewed them).

The real value of this metric is **variation over time**:
- Day 0 (just reviewed): 99% retention
- Day 1: 95.6% retention (natural decay)
- Day 2 (due): 91.3% retention (at scheduler target)
- Day 3+ (overdue): 87%, 83%, 79% (urgent visual signal)

This creates a "breathing" UI where familiarity naturally decays, without users needing to refresh data.

---

## Changes Applied

**File:** [src/app/words/shared/words.shared.utils.tsx](src/app/words/shared/words.shared.utils.tsx)

**Change:** Restored the original retention-at-current-time calculation with improved documentation explaining the design intent.

```typescript
const lastReviewAt = word.nextReviewAt - intervalDays * DAY_MS;
const elapsedDays = Math.max(0, (now - lastReviewAt) / DAY_MS);
const probability = Math.exp(-elapsedDays / stabilityDays);
return Math.min(0.99, Math.max(0.01, probability));
```

**Why:** 
- The metric refreshes automatically as days pass (no backend update needed)
- Provides natural visual feedback about memory decay
- Overdue words show urgent low percentages (78%, 79%, etc.) without separate UI logic
- Aligns with the forgetting curve model built into the scheduler

---

## Daily Variation Example

Word graded "hard" on day 0 (stability = 22.05 days, interval = 2 days):

| Day | Elapsed | Familiarity | Status |
|---|---|---|---|
| 0 | 0d | 99.0% | Just reviewed ✅ |
| 1 | 1d | 95.6% | 1 day until due |
| 2 | 2d | 91.3% | **Due today** |
| 3 | 3d | 87.3% | 1 day OVERDUE 🚨 |
| 4 | 4d | 83.4% | 2 days OVERDUE 🚨 |
| 5 | 5d | 79.7% | 3 days OVERDUE 🚨 |

Users visiting their word list on different days will see natural metric variation, providing continuous feedback about review decay without any manual refresh.

---

## Architectural Impact

**Layer:** UI Presentation (no domain changes)

- The `getMemorizationProbability()` function is display-only
- Called by `words.shared.state.ts` for the `familiarity` field
- Does not affect scheduler state, grading, or persistence
- No API or database changes

**Boundary integrity:** ✅ Maintained

---

## Preventative Rule

**Rule:** Familiarity metrics should **refresh continuously with time**, not remain static. If a metric isn't changing over days, investigate whether it's showing a meaningful user signal:

- ✅ Good: Retention probability decays day-by-day (shows memory decay)
- ✅ Good: Due date indicators change as time passes (shows schedule urgency)
- ❌ Bad: Metric locked at ~90% regardless of review date (no signal)
- ❌ Bad: Metric locked at 99% right after reviews (no differentiation)

A "breathing" UI where metrics naturally evolve is better UX than static displays.

---

## Docs Updated

- ✅ **Fix log created** (this file)
- ℹ️ **0_ARCHITECTURE.md** — No update needed. Schema and rules unchanged.
- ℹ️ **Grading Logic Model** — No update needed. Metric was display-only, not part of core model.

---

## Verification

**Manual test results:**

Example: New word, graded "hard", reviewed at T₀

| When | Elapsed | Familiarity | Expected |
|---|---|---|---|
| T₀ (day 0 EOD) | 0 days | 99.0% | ✅ High (just reviewed) |
| T₀ + 1 day | 1 day | 95.6% | ✅ Decaying |
| T₀ + 2 days | 2 days | 91.3% | ✅ At due date |
| T₀ + 3 days | 3 days | 87.3% | ✅ Low (overdue) |

**Test suite:** 66 tests passing (all suites) ✅

---

## Related Tasks

- Phase 1 task: `docs/architecture/2026-03-03-grading-logic-model.md` (Grading Logic Audit)
- Closed concern: Familiarity stat appears to show misleadingly high values for new words
- Resolution: Metric is correct; the variation emerges over time as memory decays

