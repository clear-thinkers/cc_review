import { describe, expect, it } from "vitest";
import type { Word } from "./types";
import { calculateNextState, computeIntervalDays, isDue } from "./scheduler";

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
    contentStatus: 'ready',
    contentSource: null,
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

describe("computeIntervalDays", () => {
  it("uses max(1, round(-S * ln(R_target)))", () => {
    const expected = Math.max(1, Math.round(-5 * Math.log(0.9)));
    expect(computeIntervalDays(5, 0.9)).toBe(expected);
  });

  it("matches anchor case: S=1.0, R=0.90 -> 1 day", () => {
    expect(computeIntervalDays(1.0, 0.9)).toBe(1);
  });
});

describe("calculateNextState", () => {
  it("again reduces stability and resets repetitions", () => {
    const now = 10_000;
    const base = makeWord({ ease: 2, repetitions: 5, nextReviewAt: 0 });

    const next = calculateNextState(base, "again", now);

    expect(next.ease).toBeCloseTo(1.2);
    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(computeIntervalDays(1.2));
  });

  it("good increases stability and increments repetitions", () => {
    const now = 20_000;
    const base = makeWord({ ease: 2, repetitions: 1, nextReviewAt: 0 });

    const next = calculateNextState(base, "good", now);

    expect(next.ease).toBeCloseTo(2.7);
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

  it("hard multiplier: 1.05x increases stability slowly", () => {
    const now = 10_000;
    const base = makeWord({ ease: 10, repetitions: 5, nextReviewAt: 0 });

    const next = calculateNextState(base, "hard", now);

    expect(next.ease).toBeCloseTo(10.5);
    expect(next.repetitions).toBe(6);
    expect(next.intervalDays).toBeGreaterThan(0);
  });

  it("easy multiplier: 1.6x accelerates stability growth", () => {
    const now = 10_000;
    const base = makeWord({ ease: 10, repetitions: 5, nextReviewAt: 0 });

    const next = calculateNextState(base, "easy", now);

    expect(next.ease).toBeCloseTo(16);
    expect(next.repetitions).toBe(6);
    expect(next.intervalDays).toBeGreaterThan(0);
  });

  it("multi-failure cycle: repeated again grades clamp at S_min", () => {
    const now = 10_000;
    let word = makeWord({ ease: 0.5, repetitions: 3, nextReviewAt: 0 });

    // First "again": S = 0.5 × 0.6 = 0.3 → clamped to 0.5
    word = calculateNextState(word, "again", now);
    expect(word.ease).toBe(0.5);
    expect(word.repetitions).toBe(0);
    expect(word.intervalDays).toBe(1);

    // Second "again": S = 0.5 × 0.6 = 0.3 → clamped to 0.5
    word = calculateNextState(word, "again", now);
    expect(word.ease).toBe(0.5);
    expect(word.repetitions).toBe(0);
    expect(word.intervalDays).toBe(1);

    // After success, should recover: S = 0.5 × 1.35 = 0.675
    word = calculateNextState(word, "good", now);
    expect(word.ease).toBeCloseTo(0.675);
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

    // Review early (now) with grade "good"
    const next = calculateNextState(base, "good", now);

    // Transition should apply normally
    expect(next.ease).toBeCloseTo(5 * 1.35);
    expect(next.repetitions).toBe(3);
    // New scheduled date is relative to "now", not original scheduled date
    expect(next.nextReviewAt).toBe(now + next.intervalDays * DAY_MS);
    // Should be earlier than original scheduled date
    expect(next.nextReviewAt).toBeLessThan(scheduledDate + next.intervalDays * DAY_MS);
  });

  it("rapid repeated reviews: state changes compound correctly", () => {
    const now = 10_000;
    const base = makeWord({ ease: 1, repetitions: 0, nextReviewAt: 0 });

    // First review: "good"
    let word = calculateNextState(base, "good", now);
    const ease1 = word.ease; // 1 × 1.35 = 1.35
    expect(word.repetitions).toBe(1);

    // Second review (same moment): "good" again
    word = calculateNextState(word, "good", now);
    const ease2 = word.ease; // 1.35 × 1.35 ≈ 1.8225
    expect(word.repetitions).toBe(2);

    // Verify compounding
    expect(ease2).toBeCloseTo(ease1 * 1.35);
  });

  it("floating-point stability at high values remains precise", () => {
    // Simulate ~20 consecutive "easy" grades starting from S = 0.5
    // Expected growth: 0.5 × (1.6^20)
    const now = 10_000;
    const base = makeWord({ ease: 0.5, repetitions: 0, nextReviewAt: 0 });

    let word = base;
    for (let i = 0; i < 20; i++) {
      word = calculateNextState(word, "easy", now);
    }

    // Final stability should be compounded growth
    const expectedStability = 0.5 * Math.pow(1.6, 20);
    expect(word.ease).toBeCloseTo(expectedStability, 5); // Allow 5 decimal places

    // Interval should be computable without error
    expect(word.intervalDays).toBeGreaterThan(100);
    expect(Number.isFinite(word.intervalDays)).toBe(true);
  });

  it("repetitions preserved across grades: only again resets", () => {
    const now = 10_000;
    const base = makeWord({ ease: 2, repetitions: 5, nextReviewAt: 0 });

    // Hard: increments
    let hard = calculateNextState(base, "hard", now);
    expect(hard.repetitions).toBe(6);

    // Good: increments
    let good = calculateNextState(base, "good", now);
    expect(good.repetitions).toBe(6);

    // Easy: increments
    let easy = calculateNextState(base, "easy", now);
    expect(easy.repetitions).toBe(6);

    // Again: resets
    let again = calculateNextState(base, "again", now);
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

    // Due to S_MIN clamping, all first-review grades should result in ~1-day interval
    // (except "again" which also yields 1 day minimum)
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

  it("grade multipliers are exact: hard=1.05, good=1.35, easy=1.6", () => {
    const now = 10_000;
    const base = makeWord({ ease: 100, repetitions: 0, nextReviewAt: 0 });

    const hard = calculateNextState(base, "hard", now);
    const good = calculateNextState(base, "good", now);
    const easy = calculateNextState(base, "easy", now);
    const again = calculateNextState(base, "again", now);

    expect(hard.ease).toBeCloseTo(100 * 1.05);
    expect(good.ease).toBeCloseTo(100 * 1.35);
    expect(easy.ease).toBeCloseTo(100 * 1.6);
    expect(again.ease).toBeCloseTo(100 * 0.6);
  });
});
