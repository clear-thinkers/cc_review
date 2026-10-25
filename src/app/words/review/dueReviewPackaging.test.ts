import { describe, expect, it } from "vitest";
import {
  QUICK_ADD_SIZES,
  buildDefaultChildSessionName,
  canDeleteReviewTestSession,
  isQuickAddAvailable,
  partitionByQuizReady,
  resolveSessionNameTarget,
} from "./dueReviewPackaging";

const sessions = [
  { id: "s-parent", name: "Parent set", createdByUserId: "parent-1" },
  { id: "s-child", name: "My practice", createdByUserId: "child-1" },
];

describe("QUICK_ADD_SIZES", () => {
  it("has one size per reward tier", () => {
    expect([...QUICK_ADD_SIZES]).toEqual([10, 20, 30]);
  });
});

describe("resolveSessionNameTarget", () => {
  it("creates when the name is new, trimming whitespace", () => {
    expect(
      resolveSessionNameTarget({ name: "  Brand new  ", sessions, viewerUserId: "child-1", viewerIsChild: true })
    ).toEqual({ kind: "create" });
  });

  it("lets a child append to a session they created", () => {
    expect(
      resolveSessionNameTarget({ name: "My practice", sessions, viewerUserId: "child-1", viewerIsChild: true })
    ).toEqual({ kind: "append", sessionId: "s-child" });
  });

  it("tells a child the name is taken when it belongs to someone else's session", () => {
    expect(
      resolveSessionNameTarget({ name: "Parent set", sessions, viewerUserId: "child-1", viewerIsChild: true })
    ).toEqual({ kind: "name_taken" });
  });

  it("keeps the parent behavior: any matching session is appended to", () => {
    expect(
      resolveSessionNameTarget({ name: "My practice", sessions, viewerUserId: "parent-1", viewerIsChild: false })
    ).toEqual({ kind: "append", sessionId: "s-child" });
    expect(
      resolveSessionNameTarget({ name: "Parent set", sessions, viewerUserId: "parent-1", viewerIsChild: false })
    ).toEqual({ kind: "append", sessionId: "s-parent" });
  });

  it("matches names case-sensitively, like the database's unique index", () => {
    expect(
      resolveSessionNameTarget({ name: "my practice", sessions, viewerUserId: "child-1", viewerIsChild: true })
    ).toEqual({ kind: "create" });
  });

  it("treats a child with no resolved user id as unable to extend anything", () => {
    expect(
      resolveSessionNameTarget({ name: "My practice", sessions, viewerUserId: null, viewerIsChild: true })
    ).toEqual({ kind: "name_taken" });
  });
});

describe("canDeleteReviewTestSession", () => {
  const base = { viewerIsPlatformAdmin: false, viewerUserId: "child-1" };

  it("lets a parent delete any session, including a child's", () => {
    expect(canDeleteReviewTestSession({ ...base, viewerRole: "parent", createdByUserId: "child-1" })).toBe(true);
    expect(canDeleteReviewTestSession({ ...base, viewerRole: "parent", createdByUserId: "parent-1" })).toBe(true);
  });

  it("lets a child delete only sessions they created", () => {
    expect(canDeleteReviewTestSession({ ...base, viewerRole: "child", createdByUserId: "child-1" })).toBe(true);
    expect(canDeleteReviewTestSession({ ...base, viewerRole: "child", createdByUserId: "parent-1" })).toBe(false);
  });

  it("gives no delete control to a child with no resolved user id, or an unknown role", () => {
    expect(canDeleteReviewTestSession({ ...base, viewerUserId: null, viewerRole: "child", createdByUserId: "x" })).toBe(false);
    expect(canDeleteReviewTestSession({ ...base, viewerRole: undefined, createdByUserId: "child-1" })).toBe(false);
  });

  it("keeps the platform admin's existing behavior (no delete control here)", () => {
    expect(
      canDeleteReviewTestSession({ ...base, viewerIsPlatformAdmin: true, viewerRole: "parent", createdByUserId: "child-1" })
    ).toBe(false);
  });
});

describe("buildDefaultChildSessionName", () => {
  it("fills the template with a zero-padded month-day hour:minute stamp", () => {
    expect(buildDefaultChildSessionName("My practice {time}", new Date(2026, 9, 4, 8, 5))).toBe("My practice 10-04 08:05");
    expect(buildDefaultChildSessionName("我的练习 {time}", new Date(2026, 11, 24, 18, 30))).toBe("我的练习 12-24 18:30");
  });

  it("produces different names a minute apart (so a fresh session never collides with the last one)", () => {
    const a = buildDefaultChildSessionName("P {time}", new Date(2026, 9, 24, 18, 5));
    const b = buildDefaultChildSessionName("P {time}", new Date(2026, 9, 24, 18, 6));
    expect(a).not.toBe(b);
  });
});

describe("isQuickAddAvailable", () => {
  it("is available only when at least that many characters are due", () => {
    expect(isQuickAddAvailable(10, 9)).toBe(false);
    expect(isQuickAddAvailable(10, 10)).toBe(true);
    expect(isQuickAddAvailable(30, 25)).toBe(false);
    expect(isQuickAddAvailable(20, 40)).toBe(true);
  });
});

describe("partitionByQuizReady", () => {
  const words = [
    { id: "a", ready: true },
    { id: "b", ready: false },
    { id: "c", ready: true },
  ];

  it("separates quizzable words from ones with no quiz content, keeping order", () => {
    const { quizReady, notQuizReady } = partitionByQuizReady(words, (word) => word.ready);
    expect(quizReady.map((word) => word.id)).toEqual(["a", "c"]);
    expect(notQuizReady.map((word) => word.id)).toEqual(["b"]);
  });

  it("handles none and all", () => {
    expect(partitionByQuizReady([], () => true)).toEqual({ quizReady: [], notQuizReady: [] });
    expect(partitionByQuizReady(words, () => false).quizReady).toEqual([]);
  });
});
