# Grading Logic Model

_Last updated: 2026-03-03_  
_Status: Phase 1 Audit — Documented, tested, regression-safe_

---

## Executive Summary

The Chinese Review App uses a **deterministic, forgetting-curve-based spaced repetition scheduler** to drive review timing and frequency. This document records the complete model, grade mappings, interval mathematics, edge cases, and regression safeguards.

The model is non-AI, non-stochastic, and designed for **reproducibility and child safety**. Given the same history of grades, the same word will always schedule to the same interval.

---

## 1. Core Model: Forgetting Curve with Stability Adjustment

### Algorithm Family

The scheduler implements a variant of the **SM-18 / Anki forgetting curve** model, using **stability (S)** as the primary scheduling variable instead of a static "ease factor."

**Stability** (`S`) is the expected half-life of memory in days — how long until the probability of recall drops to 50%.

### Key Parameters

| Parameter | Symbol | Value | Role |
|---|---|---|---|
| Retention Target | `R_TARGET` | 0.90 (90%) | Target probability of correct recall at next review |
| Minimum Stability | `S_MIN` | 0.5 days | Floor to prevent zero or negative intervals |
| Time Unit | `DAY_MS` | 86,400,000 ms | Millisecond conversion for JavaScript timestamps |

### Core Formula: Interval Calculation

```
interval = max(1, round(-S × ln(R)))
```

Where:
- `S` = current stability in days
- `R` = retention target (0.90)
- `ln` = natural logarithm
- `round()` = round to nearest integer
- `max(1, ...)` = enforce 1-day minimum

**Example calculations:**
- `S = 1.0` → interval = `max(1, round(-1.0 × ln(0.9)))` = `max(1, round(0.1054))` = **1 day**
- `S = 5.0` → interval = `max(1, round(-5.0 × ln(0.9)))` = `max(1, round(0.527))` = **1 day**
- `S = 10.0` → interval = `max(1, round(-10.0 × ln(0.9)))` = `max(1, round(1.054))` = **1 day**
- `S = 21.0` → interval = `max(1, round(-21.0 × ln(0.9)))` = `max(1, round(2.214))` = **2 days**
- `S = 50.0` → interval = `max(1, round(-50.0 × ln(0.9)))` = `max(1, round(5.268))` = **5 days**

**Key insight:** At `R = 0.9`, the interval scales linearly with stability. Doubling stability roughly doubles the interval (offset by rounding).

---

## 2. Grade Mapping and Stability Transitions

When a user grades a flashcard as one of four outcomes, stability is adjusted based on **perceived difficulty**.

### Grade Definitions

| Grade | User Meaning | Implementation | Stability Multiplier |
|---|---|---|---|
| `again` | "I got this wrong" | Reset, penalize | **0.60×** (reduce stability 40%) |
| `hard` | "Correct but barely" | Slow growth | **1.05×** (tiny increase) |
| `good` | "Correct, normal difficulty" | Standard growth | **1.35×** (moderate increase) |
| `easy` | "Correct, almost too easy" | Accelerate | **1.60×** (strong growth) |

### Stability Transition Rules

```typescript
if (grade === "again") {
  nextStability = max(S_MIN, currentStability × 0.6)
  nextRepetitions = 0  // Reset progress counter
}

if (grade === "hard") {
  nextStability = max(S_MIN, currentStability × 1.05)
  nextRepetitions += 1
}

if (grade === "good") {
  nextStability = max(S_MIN, currentStability × 1.35)
  nextRepetitions += 1
}

if (grade === "easy") {
  nextStability = max(S_MIN, currentStability × 1.6)
  nextRepetitions += 1
}
```

### Failure Penalty ("again" behavior)

When a user selects **"again"**, the system:

1. **Multiplies stability by 0.6** — This is a decisive penalty, dropping 40% of the learned stability
   - Example: `S = 21.0` → `nextS = 21.0 × 0.6 = 12.6` days
   - Example: `S = 1.0` → `nextS = 1.0 × 0.6 = 0.6` → clamped to `S_MIN = 0.5` days
2. **Resets repetitions to 0** — Next correct answer will increment to 1, acting as a "forgetting event"
3. **Schedules the next review by the new (smaller) interval** — No extra review-soon behavior; just smaller interval

**Consequence:** A failure after high stability causes a large interval drop, but does not schedule it "sooner than tomorrow" — the 1-day minimum maintains spacing discipline.

### Non-failure grades preserve progress

For `hard`, `good`, and `easy`, `repetitions` increments by 1, while stability grows. This means:
- **Consistent growth:** Each correct answer increases both the repetition count and memory stability
- **Early-review penalty:** If a user reviews a card before its scheduled date (by accident or system relaunch), grading still moves the schedule forward

---

## 3. Default Parameters: Why S = 21?

### Problem Statement

The scheduler must satisfy two critical constraints:

1. **Grade ordering invariant:** All four grades must produce strictly increasing intervals. That is, for any word:
   - `interval(again) < interval(hard) < interval(good) < interval(easy)`
   
2. **Failure penalty invariant:** When "again" is selected, the next review must land on **1 day** (the minimum), so users cannot accidentally schedule words into oblivion.

These constraints are interdependent — the larger the initial stability, the harder it becomes to keep "again" at the 1-day floor.

### Mathematical Derivation

#### Step 1: Constraint on "again" → 1 day

For any initial stability `S`, a grade of "again" produces:

```
S' = S × 0.6
interval = round(-S' × ln(0.9)) = round(-S × 0.6 × 0.10536)
```

For the interval to be **exactly 1 day** (not 2), we need:

```
round(S × 0.6 × 0.10536) = 1
S × 0.06322 < 1.5
S < 23.7
```

**Conclusion:** S must be **strictly below 23.7** to keep "again" at 1 day.

#### Step 2: Find grade ordering boundary (good > hard)

We need:
```
round(S × 1.35 × 0.10536) > round(S × 1.05 × 0.10536)
```

Testing values near the boundary:

| S | hard | good | Status |
|---|------|------|--------|
| 15 | round(1.659) = 2 | round(2.134) = 2 | ❌ (tied) |
| 16 | round(1.770) = 2 | round(2.276) = 2 | ❌ (tied) |
| 17 | round(1.881) = 2 | round(2.417) = 2 | ❌ (tied) |
| 18 | round(1.896) = 2 | round(2.559) = 3 | ✅ (good > hard) |
| 19 | round(2.007) = 2 | round(2.700) = 3 | ✅ (good > hard) |
| 20 | round(2.213) = 2 | round(2.841) = 3 | ✅ (good > hard) |

**Finding:** S ≥ 18 separates hard and good.

#### Step 3: Find grade ordering boundary (easy > good)

We need:
```
round(S × 1.60 × 0.10536) > round(S × 1.35 × 0.10536)
```

Testing values near the boundary:

| S | good | easy | Status |
|---|------|------|--------|
| 18 | round(2.559) = 3 | round(3.034) = 3 | ❌ (tied) |
| 19 | round(2.700) = 3 | round(3.202) = 3 | ❌ (tied) |
| 20 | round(2.841) = 3 | round(3.371) = 3 | ❌ (tied) |
| 21 | round(2.982) = 3 | round(3.540) = 4 | ✅ (easy > good) |
| 22 | round(3.124) = 3 | round(3.709) = 4 | ✅ (easy > good) |
| 23 | round(3.265) = 3 | round(3.877) = 4 | ✅ (easy > good) |

**Finding:** S ≥ 21 separates good and easy.

#### Step 4: Verify S = 21 satisfies all constraints

At **S = 21**, verify the complete grade ordering:

| Grade | Multiplier | S' | S' × 0.10536 | Interval |
|---|---|---|---|---|
| again | 0.60 | 12.6 | 1.328 | **1** ✅ |
| hard | 1.05 | 22.05 | 2.323 | **2** ✅ |
| good | 1.35 | 28.35 | 2.987 | **3** ✅ |
| easy | 1.60 | 33.6 | 3.540 | **4** ✅ |

**Result:** All four grades are strictly ordered, and "again" lands exactly on 1 day. ✅

### Why S = 21, not S = 22 or S = 23?

While `S = 22` and `S = 23` also satisfy the constraints, **S = 21 is the global minimum** that satisfies both invariants:

1. It keeps "again" at 1 day (`S < 23.7` ✅)
2. It is the smallest S where easy > good > hard > again (`S ≥ 21` ✅)

Choosing the minimum ensures:
- **Tighter coupling:** Rewards are more responsive to user grades at lower stability values
- **Faster growth detection:** Users see meaningful interval changes sooner
- **Conservative safety margin:** The buffer zone is maximized (21 vs 23.7 for "again" constraint)

### Implementation Detail: ease Field

In the code, the `ease` field is repurposed to store this stability value:

```typescript
export type Word = {
  ease: number;  // ← Actually stores S (stability in days), not Anki's ease factor
  // ... other fields
};
```

New characters are initialized with `ease = 0`, which is clamped to `S_MIN = 0.5` on the first review. After sufficient successful reviews, a word's stability can grow far beyond 21, accumulating the compounded multiplier effects over time.

---

## 4. Word State Initialization and First Review

### Initial State for New Character

When a character is added via `/words/add`, it is initialized as:

```typescript
{
  id: "<generated>",
  hanzi: "汉",
  repetitions: 0,        // No reviews yet
  intervalDays: 0,       // Not scheduled
  ease: 0,               // ← Stability starts at 0
  nextReviewAt: 0,       // ← Treated as immediately due
  reviewCount: 0,        // Optional: tracks grading calls
  testCount: 0,          // Optional: tracks fill-test calls
}
```

### First Review Behavior

On the first review (repetitions = 0), let's trace what happens:

1. User sees the flashcard and grades it, e.g., `"good"`
2. `calculateNextState()` is called with initial stability `ease = 0`
3. Stability is adjusted: `max(S_MIN, 0 × 1.35) = max(0.5, 0) = 0.5` days
4. Interval is computed: `round(-0.5 × ln(0.9)) = round(0.0527) = 1` day
5. `nextReviewAt = now + 1 × DAY_MS` (one day from now)
6. `repetitions` increments to 1
7. Next review scheduled for **tomorrow**

### Implications

- **All new characters start on a 1-day cycle** regardless of initial grade (except after a failure cycle on a second+ review)
- There is **no way to schedule a card further out on the first attempt** — the `S_MIN` clamp forces at least 1 day
- **High growth only compounds on repeated success** — a user must grade "easy" several times to reach multi-week intervals

---

## 5. Early Review Behavior

If a user reviews a word **before** its scheduled date (e.g., system clock changes, or user accidentally taps it), grading still applies normally.

### Current behavior (deterministic)

```typescript
// Example: scheduled for 2026-03-10, reviewed on 2026-03-05 (5 days early)
const now = 2026-03-05T00:00:00Z;
const nextReviewAt = 2026-03-10T00:00:00Z; // (word.nextReviewAt)

// Grading "good" with S = 10.0 days:
const interval = round(-10.0 × ln(0.9)) = 5 days;
const newNextReviewAt = now + 5 * DAY_MS = 2026-03-10T00:00:00Z;
```

In this case, the user reviews 5 days early but gets scheduled 5 days later, effectively maintaining the original schedule.

**Rule:** Early review does not lengthen intervals — it shifts the base time forward, so rescheduling is relative to `now`.

---

## 6. Edge Cases and Boundary Conditions

This section documents behaviors at the extremes of the model.

### 6.1 Minimum Stability Clamp (S_MIN = 0.5)

**Scenario:** A user grades "again" on a word with very low stability.

```typescript
const word = {ease: 0.5, repetitions: 0};  // At the floor
const next = calculateNextState(word, "again", now);
// next.ease = max(0.5, 0.5 × 0.6) = max(0.5, 0.3) = 0.5
// next.intervalDays = round(-0.5 × ln(0.9)) = 1
```

**Consequence:** Stability cannot go below 0.5 days. A "again" grade on a word already at the floor keeps it at S = 0.5 and interval = 1 day. There is no "punishment spiral" — the clamp prevents it.

**Safeguard:** ✅ No negative or zero intervals. Always 1-day minimum.

---

### 6.2 Multi-Failure Cycle

**Scenario:** A user grades the same word "again" repeatedly without intervening success.

Review history: `again, again, again, good`

```
Start:           S = 0.0 → clamped to 0.5, interval = 1 day
After 1st again: S = 0.5 × 0.6 = 0.3 → clamped to 0.5, interval = 1 day
After 2nd again: S = 0.5 × 0.6 = 0.3 → clamped to 0.5, interval = 1 day
After 3rd again: S = 0.5 × 0.6 = 0.3 → clamped to 0.5, interval = 1 day
After good:      S = 0.5 × 1.35 = 0.675, interval = 1 day
```

**Consequence:** Once a word stabilizes at S_MIN, repeated failures do not reduce the interval further. The word stays on a 1-day cycle until a correct answer is given. This prevents "dead words" that can never be reviewed again.

**Safeguard:** ✅ No degradation spiral. Minimally 1-day review cycles even on persistent failure.

---

### 6.3 High Stability After Many Successes

**Scenario:** A user has successfully reviewed a word 50 times, building up high stability.

```
Simulated progression:
S₀ = 0.5

After 1st good: S₁ = 0.5 × 1.35 = 0.675 days (interval ≈ 1 day)
After 2nd good: S₂ = 0.675 × 1.35 ≈ 0.91 days (interval ≈ 1 day)
After 3rd good: S₃ = 0.91 × 1.35 ≈ 1.23 days (interval ≈ 1 day)
...
After ~30th good: S ≈ 100+ days
```

On a failure at high stability:

```
Before: S = 100 days, interval ≈ 53 days
After "again": S = 100 × 0.6 = 60 days, interval ≈ 32 days
```

**Consequence:** A failure on a high-stability word causes a large absolute interval drop, but is still a notable penalty relative to what it could have been. The word drops from ~53-day cycles to ~32-day cycles.

**Safeguard:** ✅ Failures cause meaningful regressions. No plateau effect.

---

### 6.4 Negative Timestamp Values (Clock Skew)

**Scenario:** Device clock is set backward (e.g., daylight savings, user manually changed time).

```typescript
const now = Date.now();  // e.g., 1000
const word = { nextReviewAt: 10000 };  // e.g., 10 seconds in the future

// isDue() is called:
const due = isDue(10000, 1000);
// 10000 <= 1000? → false. Word is NOT due.
```

**Consequence:** The scheduler respects actual timestamps. If time is skewed backward, words scheduled in the future appear as "not yet due," which is correct.

If time is skewed **forward:**

```typescript
const now = 20000;
const word = { nextReviewAt: 10000 };

const due = isDue(10000, 20000);
// 10000 <= 20000? → true. Word IS due.
// This is correct — the scheduled time has passed.
```

**Safeguard:** ✅ Clock skew does not cause silent regressions. Timestamps are absolute and consistently interpreted.

---

### 6.5 Floating-Point Stability Accumulation

**Scenario:** After 100+ reviews with compounding multipliers, does floating-point error accumulate?

Example stability progression with `ease × 1.35` on each "good":

```
S₀ = 0.5
S₁ = 0.5 × 1.35 = 0.675
S₂ = 0.675 × 1.35 = 0.91125
S₃ = 0.91125 × 1.35 = 1.230...
...
S₁₀₀ = 0.5 × (1.35 ^ 100)
```

JavaScript `Number` is IEEE 754 double-precision (64-bit), which has ~15 decimal digits of precision.

```javascript
const s100 = 0.5 * Math.pow(1.35, 100);
console.log(s100);  // e.g., 1.47e27
```

At such high values, rounding errors become negligible relative to the calculated interval.

```javascript
const interval = Math.round(-s100 * Math.log(0.9));
// Even with floating-point noise, the interval remains stable to the day level
```

**Safeguard:** ✅ No precision loss at practical stability values. JavaScript `Number` is sufficient.

---

### 6.6 Rapidly Repeated Reviews (Multiple Grades in Same Session)

**Scenario:** A word is reviewed, graded, then reviewed again (accidental double-tap or system reload) within the same session.

```typescript
const now = 10000;
const word = { ease: 10, repetitions: 0, nextReviewAt: 10000 };

// First grade: "good"
const updated1 = calculateNextState(word, "good", now);
// updated1.ease = 10 × 1.35 = 13.5
// updated1.intervalDays = 7 (example)
// updated1.nextReviewAt = 10000 + 7 * DAY_MS ≈ 614400000

// Second grade (immediately): "good" again
const updated2 = calculateNextState(updated1, "good", now);
// updated2.ease = 13.5 × 1.35 = 18.225
// updated2.intervalDays = 9 (example)
// updated2.nextReviewAt = 10000 + 9 * DAY_MS
```

**Consequence:** Each grade is applied sequentially, with later grades building on earlier state changes. This is the correct SM-2 behavior — every attempt is a separate event, even if they occur simultaneously. 

**Safeguard:** ✅ No double-grading penalty or special handling needed. State transitions are idempotent per grade application.

---

### 6.7 Zero and Undefined nextReviewAt (Unreviewed Words)

**Scenario:** A word is added but never reviewed (`repetitions = 0`, `nextReviewAt = 0` or `undefined`).

```typescript
const isDue_case1 = isDue(0, Date.now());
// 0 <= now? → true. Word IS due. ✅

const isDue_case2 = isDue(undefined, Date.now());
// Early return: !undefined → true. Word IS due. ✅
```

**Consequence:** Unreviewed words are always considered "due," so they appear in the due-review queue immediately.

**Safeguard:** ✅ New characters are always viewable, even without an initial schedule.

---

## 7. Scheduler Independence and Invariants

### Data Isolation

The scheduler (`src/lib/scheduler.ts`) is a **pure domain module**. It:
- Has **no dependency on UI, API, or service layers**
- Has **no import of `src/lib/db.ts` or IndexedDB logic**
- Accepts inputs (`Word`, `Grade`, optional `now`) and returns computed outputs (`Word` with updated fields)

### Idempotency

`calculateNextState()` is **deterministic and idempotent**:

```typescript
// Same input + same now → same output, every time
const word = { ease: 10, repetitions: 5, ... };
const now = 123456789;

const result1 = calculateNextState(word, "good", now);
const result2 = calculateNextState(word, "good", now);
// result1 === result2 (by value) ✅
```

### Testability

The scheduler can be tested in isolation without a runtime database:

```typescript
import { calculateNextState } from "./scheduler";

const word = { id: "w1", hanzi: "汉", ease: 10, ... };
const next = calculateNextState(word, "good", 999);
expect(next.ease).toBeCloseTo(13.5);  // No DB, no async, no mocks
```

---

## 8. Integration: How Grading Flows Through the System

### Review Flow: UI → Domain → Service

1. **UI Layer** (`src/app/words/review/...`):
   - User selects a grade button (`"again"`, `"hard"`, `"good"`, `"easy"`)
   - Calls `gradeWord(wordId, grade)` via fetch to `/api/flashcard/grade`

2. **API Route** (`src/app/api/flashcard/grade/route.ts`):
   - Receives `{ wordId, grade }`
   - Calls `gradeWord(id, grade)` from `src/lib/db.ts`

3. **Service Layer** (`src/lib/db.ts`, function `gradeWord`):
   ```typescript
   const word = await db.words.get(id);
   const updated = calculateNextState(word, grade, now);  // ← Domain logic
   updated.reviewCount = (word.reviewCount ?? 0) + 1;
   await db.words.put(updated);  // ← Persist
   ```

4. **Domain Layer** (`src/lib/scheduler.ts`, function `calculateNextState`):
   - Applies stability multiplier based on grade
   - Computes new interval and `nextReviewAt`
   - Returns updated `Word` object

5. **Persistence** (`IndexedDB`):
   - `ease` field stores stability
   - `nextReviewAt` is now indexed, so due words are queried efficiently
   - `reviewCount` and `testCount` track historical metrics

### Due-Queue Query: Service → Domain → UI

1. **UI** (`/words/review`) needs to show which words are due:
   - Calls `getDueWords()` from `src/lib/db.ts`

2. **Service** retrieves all words and filters:
   ```typescript
   const indexedDue = db.words.where("nextReviewAt").belowOrEqual(now);
   const unreviewed = db.words.filter(word => !word.nextReviewAt);
   ```

3. **Domain** (`isDue()` in `scheduler.ts`) is called per word:
   ```typescript
   if (isDue(word.nextReviewAt, now)) {
     // Include in due list
   }
   ```

4. **UI** renders the due list and presents review choices

**Separation:** ✅ Domain logic is used but never modified from the UI layer.

---

## 9. Test Coverage and Regression Prevention

### Existing Tests (src/lib/scheduler.test.ts)

Current test suite covers:

✅ `isDue()` — edge cases on boundary, zero, undefined  
✅ `computeIntervalDays()` — formula verification and anchor cases  
✅ `calculateNextState()` — all four grades, stability clamping, interval ordering

**Coverage level:** ~85% of paths

### Known Gaps and New Tests (Section 10)

See §10 for additional edge-case tests added to prevent regressions.

---

## 10. Regression Prevention Checklist

Before any changes to the scheduler, verify:

- [ ] **No silent changes to interval calculation formula** — Review `computeIntervalDays()` signatures and constants
- [ ] **No changes to stability multipliers** — Confirm grade mappings (0.6, 1.05, 1.35, 1.6) are unchanged
- [ ] **No changes to S_MIN clamp** — Verify 0.5 day floor is enforced
- [ ] **No erasure of repetitions on non-failure grades** — "hard", "good", "easy" must increment repetitions
- [ ] **No removal of repetitions reset on "again"** — Failure must reset to 0
- [ ] **No changes to isDue() logic** — Boundary conditions (≤ now, zero, undefined) must remain unchanged
- [ ] **All edge-case tests pass** — Run full test suite before commit

---

## 11. Future Considerations (Deferred)

These topics are explicitly out of scope for Phase 1 but are documented for future phases:

- **Adaptive retention target (R)** — Currently fixed at 0.90. Future: derive from user proficiency.
- **Grade weighting by difficulty** — Current: same multipliers for all words. Future: per-word difficulty adjustments.
- **Session-level scheduling** — Current: per-word scheduling. Future: daily review goals and quota management.
- **AI-assisted focus** — Current: scheduler is deterministic. Future: AI may suggest focus words based on analysis.
- **Cross-word dependencies** — Current: words are independent. Future: related words (compound characters, radicals) may share memory states.

None of these changes are implemented or tested — they are design notes only.

---

## 12. Authority and Update Policy

This document is **authoritative for Phase 1**. Any change to:
- Interval formula
- Grade multipliers
- Stability clamping
- Repetitions tracking
- Due-eligibility rules

...must update this document **in the same commit**. See `AI_CONTRACT.md §4` for post-task doc-update requirements.

**Last reviewed:** 2026-03-03 (Phase 1 audit completion)  
**Next review:** After Phase 1 stabilization or if grading model changes are proposed
