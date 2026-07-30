import { describe, expect, it } from "vitest";
import {
  buildPackagedSessionReattributionSql,
  normalizePackagedSessionReattributionRequest,
  type PackagedSessionReattributionRequest,
} from "./packagedSessionReattributionFix";

function makeRequest(
  overrides: Partial<PackagedSessionReattributionRequest> = {}
): PackagedSessionReattributionRequest {
  return {
    familyId: "family-1",
    packagedSessionId: "review-test-session-1",
    quizSessionId: "quiz-session-1",
    fromUserId: "parent-1",
    toUserId: "child-1",
    coins: 96,
    ...overrides,
  };
}

describe("normalizePackagedSessionReattributionRequest", () => {
  it("passes through a valid request unchanged", () => {
    const request = makeRequest();
    expect(normalizePackagedSessionReattributionRequest(request)).toEqual(request);
  });

  it("rejects an empty required field", () => {
    expect(() =>
      normalizePackagedSessionReattributionRequest(makeRequest({ familyId: "  " }))
    ).toThrow("familyId is required.");
  });

  it("rejects fromUserId and toUserId being the same user", () => {
    expect(() =>
      normalizePackagedSessionReattributionRequest(
        makeRequest({ fromUserId: "same-user", toUserId: "same-user" })
      )
    ).toThrow("fromUserId and toUserId must be different users.");
  });

  it("rejects a negative or non-integer coin amount", () => {
    expect(() => normalizePackagedSessionReattributionRequest(makeRequest({ coins: -1 }))).toThrow(
      "coins must be a non-negative integer"
    );
    expect(() => normalizePackagedSessionReattributionRequest(makeRequest({ coins: 1.5 }))).toThrow(
      "coins must be a non-negative integer"
    );
  });

  it("allows zero coins (reattribution without a wallet adjustment)", () => {
    expect(() =>
      normalizePackagedSessionReattributionRequest(makeRequest({ coins: 0 }))
    ).not.toThrow();
  });
});

describe("buildPackagedSessionReattributionSql", () => {
  it("wraps the repair in a single transaction", () => {
    const sql = buildPackagedSessionReattributionSql(makeRequest());
    expect(sql).toContain("begin;");
    expect(sql).toContain("commit;");
  });

  it("only moves quiz_sessions ownership and coins when still owned by fromUserId", () => {
    const sql = buildPackagedSessionReattributionSql(makeRequest());
    expect(sql).toContain("if v_current_owner = v_from_user_id then");
    expect(sql).toContain("update quiz_sessions");
    expect(sql).toContain("set user_id = v_to_user_id");
  });

  it("refuses to guess when the quiz session is owned by neither expected user", () => {
    const sql = buildPackagedSessionReattributionSql(makeRequest());
    expect(sql).toContain("elsif v_current_owner <> v_to_user_id then");
    expect(sql).toContain("refusing to guess, investigate manually");
  });

  it("only stamps completion when review_test_sessions is not already completed", () => {
    const sql = buildPackagedSessionReattributionSql(makeRequest());
    expect(sql).toContain("and completed_at is null;");
  });

  it("cleans up the stale paused-session row unconditionally (naturally idempotent delete)", () => {
    const sql = buildPackagedSessionReattributionSql(makeRequest());
    expect(sql).toContain("delete from review_session_progress");
    expect(sql).toContain("where packaged_session_id = v_packaged_session_id;");
  });

  it("interpolates the request ids and coin amount into the generated SQL", () => {
    const sql = buildPackagedSessionReattributionSql(
      makeRequest({
        familyId: "family-xyz",
        packagedSessionId: "review-test-session-xyz",
        quizSessionId: "quiz-session-xyz",
        fromUserId: "parent-xyz",
        toUserId: "child-xyz",
        coins: 42,
      })
    );

    expect(sql).toContain("v_family_id uuid := 'family-xyz';");
    expect(sql).toContain("v_packaged_session_id text := 'review-test-session-xyz';");
    expect(sql).toContain("v_quiz_session_id text := 'quiz-session-xyz';");
    expect(sql).toContain("v_from_user_id uuid := 'parent-xyz';");
    expect(sql).toContain("v_to_user_id uuid := 'child-xyz';");
    expect(sql).toContain("v_coins integer := 42;");
  });

  it("escapes single quotes in id fields to prevent SQL injection into the generated script", () => {
    const sql = buildPackagedSessionReattributionSql(
      makeRequest({ packagedSessionId: "abc'; drop table users; --" })
    );

    expect(sql).toContain("v_packaged_session_id text := 'abc''; drop table users; --';");
  });
});
