import { describe, expect, it } from "vitest";
import type { Word } from "./types";
import { calculateNextState, computeIntervalDays, computeRetrievability, isDue } from "./scheduler";

const DAY_MS = 24 * 60 * 60 * 1000;

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: "w1",
    hanzi: "汉字",
    createdAt: 1000,
    repetitions: 2,
    intervalDays: 3,
    ease: 21,
    nextReviewAt: 1000,
    ...overrides,
  };
}

describe("isDue", () => {
  it("returns true for nextReviewAt <= now", () => {
    expect(isDue(100, 100)).toBe(true);
    expect(isDue(99, 100)).toBe(true);
  });

  it("returns true for 0 and undefined", () => {
    expect(isDue(0, 100)).toBe(true);
    expect(isDue(undefined, 100)).toBe(true);
  });

  it("returns false for future reviews", () => {
    expect(isDue(101, 100)).toBe(false);
  });
});

describe("computeRetrievability", () => {
  it("is 1 at zero elapsed time, regardless of stability", () => {
    expect(computeRetrievability(0, 10)).toBe(1);
    expect(computeRetrievability(0, 0.5)).toBe(1);
  });

  it("decreases monotonically as elapsed time grows", () => {
    const day1 = computeRetrievability(1, 5);
    const day5 = computeRetrievability(5, 5);
    const day20 = computeRetrievability(20, 5);

    expect(day1).toBeGreaterThan(day5);
    expect(day5).toBeGreaterThan(day20);
  });

  it("matches the power-law formula: R = 1 / (1 + t / (4S))", () => {
    expect(computeRetrievability(4, 10)).toBeCloseTo(1 / (1 + 4 / 40));
    expect(computeRetrievability(20, 5)).toBeCloseTo(1 / (1 + 20 / 20));
  });

  it("clamps stability at S_min (0.5) for non-positive input", () => {
    expect(computeRetrievability(9, 0)).toBeCloseTo(computeRetrievability(9, 0.5));
    expect(computeRetrievability(9, -5)).toBeCloseTo(computeRetrievability(9, 0.5));
  });

  it("clamps negative elapsed time to 0", () => {
    expect(computeRetrievability(-10, 5)).toBe(1);
  });

  it("stays well above the old exponential model's value at long delays", () => {
    // At elapsed=24 days, stability=5: old exp(-24/5) ~= 0.008 (essentially the 1% display floor).
    // The whole point of switching curves is that real recall at this point is much higher than that.
    const oldExponentialValue = Math.exp(-24 / 5);
    const newPowerLawValue = computeRetrievability(24, 5);

    expect(newPowerLawValue).toBeGreaterThan(oldExponentialValue * 10);
  });
});

describe("computeIntervalDays", () => {
  it("uses max(1, round(4 * S * (1/R_target - 1)))", () => {
    const expected = Math.max(1, Math.round(4 * 5 * (1 / 0.9 - 1)));
    expect(computeIntervalDays(5, 0.9)).toBe(expected);
  });

  it("matches anchor case: S=1.0, R=0.90 -> 1 day", () => {
    expect(computeIntervalDays(1.0, 0.9)).toBe(1);
  });

  it("default target: S=1.0 -> 1 day (matches the old model's near-term cadence by construction)", () => {
    expect(computeIntervalDays(1.0)).toBe(1);
  });

  it("default target: S=21 (the DB's default new-word stability) -> 2 days, same as the old model gave", () => {
    expect(computeIntervalDays(21)).toBe(2);
  });

  it("reviewing exactly on the computed interval lands retrievability near the target", () => {
    const stability = 20;
    const interval = computeIntervalDays(stability);

    // Rounding to a whole day means this is approximate, not exact.
    expect(computeRetrievability(interval, stability)).toBeCloseTo(0.974, 2);
  });
});

describe("calculateNextState", () => {
  it("again reduces stability (x0.5) and resets repetitions", () => {
    const now = 10_000;
    const base = makeWord({ ease: 2, repetitions: 5, nextReviewAt: 0 });

    const next = calculateNextState(base, "again", now);

    expect(next.ease).toBeCloseTo(1.0);
    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(computeIntervalDays(1.0));
  });

  it("good increases stability (x2.0, no recall boost with no prior review) and increments repetitions", () => {
    const now = 20_000;
    const base = makeWord({ ease: 2, repetitions: 1, nextReviewAt: 0 });

    const next = calculateNextState(base, "good", now);

    expect(next.ease).toBeCloseTo(4.0);
    expect(next.repetitions).toBe(2);
  });

  it("clamps stability at S_min when ease is non-positive", () => {
    const now = 30_000;
    const base = makeWord({ ease: 0, repetitions: 1, nextReviewAt: 0 });

    const next = calculateNextState(base, "again", now);

    expect(next.ease).toBe(0.5);
    expect(next.intervalDays).toBe(1);
  });

  it("moves nextReviewAt forward by intervalDays * dayMs", () => {
    const now = 123_456;
    const base = makeWord({ ease: 1, repetitions: 0, nextReviewAt: 0 });

    const next = calculateNextState(base, "good", now);

    expect(next.nextReviewAt).toBe(now + next.intervalDays * DAY_MS);
  });

  it("produces larger interval for larger stability from same starting word", () => {
    const now = 99_999;
    const base = makeWord({ ease: 21, repetitions: 0, nextReviewAt: 0 });

    const again = calculateNextState(base, "again", now);
    const hard = calculateNextState(base, "hard", now);
    const good = calculateNextState(base, "good", now);
    const easy = calculateNextState(base, "easy", now);

    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
    expect(good.intervalDays).toBeGreaterThan(hard.intervalDays);
    expect(hard.intervalDays).toBeGreaterThan(again.intervalDays);
  });

  // ============= EDGE CASES FROM PHASE 1 AUDIT =============

  it("hard multiplier: 1.2x increases stability slowly, no recall boost applies", () => {
    const now = 10_000;
    const base = makeWord({ ease: 10, repetitions: 5, nextReviewAt: 0 });

    const next = calculateNextState(base, "hard", now);

    expect(next.ease).toBeCloseTo(12.0);
    expect(next.repetitions).toBe(6);
    expect(next.intervalDays).toBeGreaterThan(0);
  });

  it("easy multiplier: 3.0x accelerates stability growth (no recall boost with no prior review)", () => {
    const now = 10_000;
    const base = makeWord({ ease: 10, repetitions: 5, nextReviewAt: 0 });

    const next = calculateNextState(base, "easy", now);

    expect(next.ease).toBeCloseTo(30.0);
    expect(next.repetitions).toBe(6);
    expect(next.intervalDays).toBeGreaterThan(0);
  });

  it("multi-failure cycle: repeated again grades clamp at S_min", () => {
    const now = 10_000;
    let word = makeWord({ ease: 0.5, repetitions: 3, nextReviewAt: 0 });

    // First "again": S = 0.5 x 0.5 = 0.25 -> clamped to 0.5
    word = calculateNextState(word, "again", now);
    expect(word.ease).toBe(0.5);
    expect(word.repetitions).toBe(0);
    expect(word.intervalDays).toBe(1);

    // Second "again": S = 0.5 x 0.5 = 0.25 -> clamped to 0.5
    word = calculateNextState(word, "again", now);
    expect(word.ease).toBe(0.5);
    expect(word.repetitions).toBe(0);
    expect(word.intervalDays).toBe(1);

    // After success, should recover: S = 0.5 x 2.0 = 1.0 (elapsed since the prior grade is
    // 0 at this fixed `now`, so recall boost is a no-op here too)
    word = calculateNextState(word, "good", now);
    expect(word.ease).toBeCloseTo(1.0);
    expect(word.repetitions).toBe(1);
  });

  it("high stability + failure: drops interval but maintains minimum", () => {
    const now = 10_000;
    const base = makeWord({ ease: 100, repetitions: 50, nextReviewAt: 0 });

    const beforeFail = calculateNextState(base, "good", now);
    const intervalBefore = beforeFail.intervalDays;

    const afterFail = calculateNextState(base, "again", now);
    const intervalAfter = afterFail.intervalDays;

    // Failure should reduce interval
    expect(intervalAfter).toBeLessThan(intervalBefore);
    // But maintain 1-day minimum
    expect(intervalAfter).toBeGreaterThanOrEqual(1);
  });

  it("early review: grading before scheduled date still applies transition", () => {
    const now = 10_000;
    const scheduledDate = now + 5 * DAY_MS; // Scheduled 5 days from now
    const base = makeWord({
      ease: 5,
      repetitions: 2,
      nextReviewAt: scheduledDate,
    });

    // Review early (now) with grade "good" -- reviewing before the word is even due clamps
    // elapsed-since-last-review to 0, so no recall boost applies (R at review reads as 1).
    const next = calculateNextState(base, "good", now);

    expect(next.ease).toBeCloseTo(5 * 2.0);
    expect(next.repetitions).toBe(3);
    // New scheduled date is relative to "now", not original scheduled date
    expect(next.nextReviewAt).toBe(now + next.intervalDays * DAY_MS);
    // Should be earlier than original scheduled date
    expect(next.nextReviewAt).toBeLessThan(scheduledDate + next.intervalDays * DAY_MS);
  });

  it("recall-aware boost: correct recall after a longer overdue wait gains more stability than an on-time recall", () => {
    const stability = 5;
    const intervalDays = computeIntervalDays(stability); // the word's own "on schedule" interval
    const base = makeWord({
      ease: stability,
      repetitions: 2,
      intervalDays,
      nextReviewAt: intervalDays * DAY_MS,
    });

    const onTimeNow = intervalDays * DAY_MS; // reviewed exactly on its due date
    const overdueNow = 30 * DAY_MS; // reviewed long after its due date

    const onTime = calculateNextState(base, "good", onTimeNow);
    const overdue = calculateNextState(base, "good", overdueNow);

    expect(overdue.ease).toBeGreaterThan(onTime.ease);
  });

  it("recall-aware boost is bounded: even an extremely overdue recall caps at 2x the base multiplier", () => {
    const stability = 5;
    const base = makeWord({
      ease: stability,
      repetitions: 2,
      intervalDays: 1,
      nextReviewAt: 1 * DAY_MS,
    });

    // Absurdly overdue -- retrievability at review approaches 0, so boost approaches its cap of 2.
    const next = calculateNextState(base, "good", 100_000 * DAY_MS);

    expect(next.ease).toBeLessThanOrEqual(stability * 2.0 * 2);
  });

  it("rapid repeated reviews: state changes compound correctly", () => {
    const now = 10_000;
    const base = makeWord({ ease: 1, repetitions: 0, nextReviewAt: 0 });

    // First review: "good"
    let word = calculateNextState(base, "good", now);
    const ease1 = word.ease; // 1 x 2.0 = 2.0
    expect(word.repetitions).toBe(1);

    // Second review (same moment): "good" again
    word = calculateNextState(word, "good", now);
    const ease2 = word.ease; // 2.0 x 2.0 = 4.0 (elapsed since the first grade is 0 at this fixed `now`)
    expect(word.repetitions).toBe(2);

    // Verify compounding
    expect(ease2).toBeCloseTo(ease1 * 2.0);
  });

  it("floating-point stability at high values remains precise", () => {
    // Simulate ~20 consecutive "easy" grades starting from S = 0.5, all at the same fixed `now`
    // (so elapsed-since-last-review is always 0 and no recall boost applies).
    // Expected growth: 0.5 x (3.0^20)
    const now = 10_000;
    const base = makeWord({ ease: 0.5, repetitions: 0, nextReviewAt: 0 });

    let word = base;
    for (let i = 0; i < 20; i++) {
      word = calculateNextState(word, "easy", now);
    }

    // Final stability should be compounded growth
    const expectedStability = 0.5 * Math.pow(3.0, 20);
    expect(word.ease).toBeCloseTo(expectedStability, 5); // Allow 5 decimal places

    // Interval should be computable without error
    expect(word.intervalDays).toBeGreaterThan(100);
    expect(Number.isFinite(word.intervalDays)).toBe(true);
  });

  it("repetitions preserved across grades: only again resets", () => {
    const now = 10_000;
    const base = makeWord({ ease: 2, repetitions: 5, nextReviewAt: 0 });

    // Hard: increments
    const hard = calculateNextState(base, "hard", now);
    expect(hard.repetitions).toBe(6);

    // Good: increments
    const good = calculateNextState(base, "good", now);
    expect(good.repetitions).toBe(6);

    // Easy: increments
    const easy = calculateNextState(base, "easy", now);
    expect(easy.repetitions).toBe(6);

    // Again: resets
    const again = calculateNextState(base, "again", now);
    expect(again.repetitions).toBe(0);
  });

  it("stability never decreases below S_min on any grade", () => {
    const now = 10_000;
    const S_MIN = 0.5; // From scheduler.ts

    // Test at the boundary
    const atMin = makeWord({ ease: 0.5, repetitions: 0, nextReviewAt: 0 });

    // All grades should maintain S_MIN or above
    [
      calculateNextState(atMin, "again", now).ease,
      calculateNextState(atMin, "hard", now).ease,
      calculateNextState(atMin, "good", now).ease,
      calculateNextState(atMin, "easy", now).ease,
    ].forEach((resultEase) => {
      expect(resultEase).toBeGreaterThanOrEqual(S_MIN);
    });
  });

  it("nextReviewAt always advances forward (never regresses)", () => {
    const now = 10_000;
    const base = makeWord({
      ease: 10,
      repetitions: 5,
      nextReviewAt: now + 100 * DAY_MS, // Scheduled far in future
    });

    // All grades should schedule after "now", regardless of current nextReviewAt
    [
      calculateNextState(base, "again", now),
      calculateNextState(base, "hard", now),
      calculateNextState(base, "good", now),
      calculateNextState(base, "easy", now),
    ].forEach((result) => {
      expect(result.nextReviewAt).toBeGreaterThan(now);
      expect(result.nextReviewAt).toBeGreaterThanOrEqual(now + DAY_MS); // At least 1 day ahead
    });
  });

  it("initializing from 0: first review paths all lead to 1-day interval", () => {
    const now = 10_000;
    const unreviewed = makeWord({
      ease: 0,
      repetitions: 0,
      nextReviewAt: 0,
    });

    // Due to S_MIN clamping (0.5), even the largest first-grade multiplier (easy, x3.0 -> S=1.5)
    // stays low enough that R_TARGET's calibration (matched to the old model's near-term cadence)
    // still floors every grade at the 1-day minimum.
    const results = [
      calculateNextState(unreviewed, "again", now),
      calculateNextState(unreviewed, "hard", now),
      calculateNextState(unreviewed, "good", now),
      calculateNextState(unreviewed, "easy", now),
    ];

    results.forEach((result) => {
      expect(result.intervalDays).toBe(1);
      expect(result.nextReviewAt).toBe(now + 1 * DAY_MS);
    });
  });

  it("grade multipliers are exact: again=0.5, hard=1.2, good=2.0, easy=3.0", () => {
    const now = 10_000;
    const base = makeWord({ ease: 100, repetitions: 0, nextReviewAt: 0 });

    const hard = calculateNextState(base, "hard", now);
    const good = calculateNextState(base, "good", now);
    const easy = calculateNextState(base, "easy", now);
    const again = calculateNextState(base, "again", now);

    expect(hard.ease).toBeCloseTo(100 * 1.2);
    expect(good.ease).toBeCloseTo(100 * 2.0);
    expect(easy.ease).toBeCloseTo(100 * 3.0);
    expect(again.ease).toBeCloseTo(100 * 0.5);
  });
});
