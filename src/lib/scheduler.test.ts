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
});
