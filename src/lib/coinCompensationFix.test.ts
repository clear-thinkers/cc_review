import { describe, expect, it } from "vitest";

import {
  buildMissingChildTargetMessage,
  buildCoinCompensationSessionId,
  buildCoinCompensationSql,
  normalizeCoinCompensationRequest,
} from "./coinCompensationFix";

describe("normalizeCoinCompensationRequest", () => {
  it("normalizes createdAt and auto-builds a deterministic session id", () => {
    const result = normalizeCoinCompensationRequest({
      childUserId: " child-user-1 ",
      childUserName: " Mei ",
      familyId: " family-1 ",
      coins: 13,
      reason: " Missed coins after RPC failure ",
      createdAtIso: "2026-03-28T15:04:05-04:00",
      existingWalletCoins: 20,
    });

    expect(result).toMatchObject({
      childUserId: "child-user-1",
      childUserName: "Mei",
      familyId: "family-1",
      coins: 13,
      reason: "Missed coins after RPC failure",
      createdAtIso: "2026-03-28T19:04:05.000Z",
      existingWalletCoins: 20,
    });
    expect(result.sessionId).toBe(
      "manual-coin-fix-20260328t190405z-childuser1-missed-coins-after-rpc-failure"
    );
  });

  it("rejects non-positive coin values", () => {
    expect(() =>
      normalizeCoinCompensationRequest({
        childUserId: "child-user-1",
        childUserName: "Mei",
        familyId: "family-1",
        coins: 0,
        reason: "Missed coins",
        createdAtIso: "2026-03-28T19:04:05.000Z",
        existingWalletCoins: null,
      })
    ).toThrow("coins must be a positive integer");
  });

  it("keeps an explicitly supplied session id", () => {
    const result = normalizeCoinCompensationRequest({
      childUserId: "child-user-1",
      childUserName: "Mei",
      familyId: "family-1",
      coins: 5,
      reason: "Manual adjustment",
      createdAtIso: "2026-03-28T19:04:05.000Z",
      sessionId: "custom-session-id",
      existingWalletCoins: null,
    });

    expect(result.sessionId).toBe("custom-session-id");
  });
});

describe("buildCoinCompensationSessionId", () => {
  it("falls back to a default reason slug when the reason has no ascii word characters", () => {
    const sessionId = buildCoinCompensationSessionId({
      childUserId: "child-user-1",
      createdAtIso: "2026-03-28T19:04:05.000Z",
      reason: "!!!",
    });

    expect(sessionId).toBe(
      "manual-coin-fix-20260328t190405z-childuser1-manual-adjustment"
    );
  });
});

describe("buildCoinCompensationSql", () => {
  it("builds an idempotent transaction that inserts the session and updates the wallet", () => {
    const sql = buildCoinCompensationSql(
      normalizeCoinCompensationRequest({
        childUserId: "child-user-1",
        childUserName: "Mei",
        familyId: "family-1",
        coins: 13,
        reason: "Missed coins after RPC failure",
        createdAtIso: "2026-03-28T19:04:05.000Z",
        existingWalletCoins: null,
      })
    );

    expect(sql).toContain("begin;");
    expect(sql).toContain("insert into quiz_sessions");
    expect(sql).toContain("on conflict (id) do nothing");
    expect(sql).toContain("on conflict on constraint wallets_pkey do nothing");
    expect(sql).toContain("total_coins = wallets.total_coins + inserted_session.coins_earned");
    expect(sql).toContain("grade_data,");
    expect(sql).toContain("'[]'::jsonb");
    expect(sql).toContain("-- Safe to rerun:");
  });

  it("escapes apostrophes in SQL comments and literals", () => {
    const sql = buildCoinCompensationSql(
      normalizeCoinCompensationRequest({
        childUserId: "child-user-1",
        childUserName: "O'Neil",
        familyId: "family-1",
        coins: 7,
        reason: "Parent said it's needed",
        createdAtIso: "2026-03-28T19:04:05.000Z",
        existingWalletCoins: 10,
      })
    );

    expect(sql).toContain("-- Child user: O'Neil (child-user-1)");
    expect(sql).toContain("-- Reason: Parent said it's needed");
    expect(sql).toContain("where id = 'child-user-1'");
  });
});

describe("buildMissingChildTargetMessage", () => {
  it("explains the users.id vs auth_user_id mismatch and lists family children", () => {
    const message = buildMissingChildTargetMessage({
      requestedId: "auth-id-1",
      matchedAuthUser: {
        id: "parent-profile-1",
        name: "Parent User",
        role: "parent",
        familyId: "family-1",
      },
      familyChildCandidates: [
        { id: "child-1", name: "Mei" },
        { id: "child-2", name: "Bo" },
      ],
    });

    expect(message).toContain("No public.users.id row was found for: auth-id-1");
    expect(message).toContain("auth_user_id = auth-id-1");
    expect(message).toContain("- Mei: child-1");
    expect(message).toContain("- Bo: child-2");
  });

  it("falls back to a general guidance message when no auth row matches either", () => {
    const message = buildMissingChildTargetMessage({
      requestedId: "missing-id",
    });

    expect(message).toContain("This script expects the app-level child profile id");
    expect(message).toContain("fetch the child profile id from the app's users table instead");
  });
});
