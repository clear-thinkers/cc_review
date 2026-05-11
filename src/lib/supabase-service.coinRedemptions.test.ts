import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, fromMock, rpcMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("./supabaseClient", () => ({
  supabase: {
    auth: { getSession: getSessionMock },
    from: fromMock,
    rpc: rpcMock,
  },
}));

import { redeemCoins, listCoinRedemptions, getCoinBreakdown } from "./supabase-service";

function mockSession(userId = "user-1", familyId = "family-1") {
  getSessionMock.mockResolvedValue({
    data: {
      session: {
        user: {
          id: "auth-user-1",
          app_metadata: { family_id: familyId, user_id: userId },
        },
      },
    },
  });
}

function makeBuilder(overrides: Record<string, unknown> = {}) {
  const builder: Record<string, unknown> = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
    ...overrides,
  };
  (builder.select as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  (builder.eq as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  (builder.order as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  return builder;
}

// ─── redeemCoins ─────────────────────────────────────────────────────────────

describe("redeemCoins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("calls the redeem_coins RPC with correct parameters and returns success", async () => {
    rpcMock.mockResolvedValue({
      data: {
        success: true,
        code: "redeemed",
        coinsRedeemed: 200,
        dollarValue: "2.00",
        remainingCoins: 150,
      },
      error: null,
    });

    const result = await redeemCoins(200, "birthday money", "Alice");

    expect(rpcMock).toHaveBeenCalledWith("redeem_coins", {
      p_coins: 200,
      p_note: "birthday money",
      p_signature: "Alice",
    });
    expect(result).toEqual({
      success: true,
      code: "redeemed",
      coinsRedeemed: 200,
      dollarValue: 2.0,
      remainingCoins: 150,
    });
  });

  it("returns insufficient_coins failure from the RPC", async () => {
    rpcMock.mockResolvedValue({
      data: { success: false, code: "insufficient_coins", remainingCoins: 50 },
      error: null,
    });

    const result = await redeemCoins(100, "toys", "Bob");

    expect(result).toEqual({
      success: false,
      code: "insufficient_coins",
      remainingCoins: 50,
    });
  });

  it("returns invalid_amount failure from the RPC", async () => {
    rpcMock.mockResolvedValue({
      data: { success: false, code: "invalid_amount" },
      error: null,
    });

    const result = await redeemCoins(50, "toys", "Bob");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("invalid_amount");
  });

  it("throws when the RPC returns a transport error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "network timeout" } });

    await expect(redeemCoins(100, "snacks", "Alice")).rejects.toThrow("redeemCoins: network timeout");
  });
});

// ─── listCoinRedemptions ─────────────────────────────────────────────────────

describe("listCoinRedemptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("reads redemptions for the session user when no targetUserId supplied", async () => {
    const row = {
      id: "red-1",
      user_id: "user-1",
      family_id: "family-1",
      coins_redeemed: 100,
      dollar_value: "1.00",
      note: "candy",
      child_signature: "Alice",
      beginning_balance: 200,
      ending_balance: 100,
      created_at: "2026-05-11T10:00:00.000Z",
    };
    const builder = makeBuilder();
    (builder.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [row], error: null });
    fromMock.mockReturnValue(builder);

    const result = await listCoinRedemptions();

    expect(fromMock).toHaveBeenCalledWith("coin_redemptions");
    expect(builder.eq).toHaveBeenNthCalledWith(1, "family_id", "family-1");
    expect(builder.eq).toHaveBeenNthCalledWith(2, "user_id", "user-1");
    expect(result).toEqual([
      {
        id: "red-1",
        userId: "user-1",
        coinsRedeemed: 100,
        dollarValue: 1.0,
        note: "candy",
        childSignature: "Alice",
        beginningBalance: 200,
        endingBalance: 100,
        createdAt: new Date("2026-05-11T10:00:00.000Z").getTime(),
      },
    ]);
  });

  it("scopes to the targetUserId when supplied", async () => {
    const builder = makeBuilder();
    (builder.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listCoinRedemptions("child-99");

    expect(builder.eq).toHaveBeenCalledWith("user_id", "child-99");
  });

  it("returns an empty array when the table has no rows", async () => {
    const builder = makeBuilder();
    (builder.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await expect(listCoinRedemptions()).resolves.toEqual([]);
  });

  it("parses dollarValue from a postgres numeric string", async () => {
    const row = {
      id: "red-2",
      user_id: "user-1",
      family_id: "family-1",
      coins_redeemed: 300,
      dollar_value: "3.00",
      note: "present",
      child_signature: "Alice",
      beginning_balance: 500,
      ending_balance: 200,
      created_at: "2026-05-11T11:00:00.000Z",
    };
    const builder = makeBuilder();
    (builder.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [row], error: null });
    fromMock.mockReturnValue(builder);

    const [redemption] = await listCoinRedemptions();
    expect(redemption.dollarValue).toBe(3.0);
  });

  it("throws when the query returns an error", async () => {
    const builder = makeBuilder();
    (builder.order as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });
    fromMock.mockReturnValue(builder);

    await expect(listCoinRedemptions()).rejects.toThrow("listCoinRedemptions: permission denied");
  });
});

// ─── getCoinBreakdown ─────────────────────────────────────────────────────────

function makeAggBuilder(rows: Record<string, unknown>[]) {
  // Builds a chain for tables whose query ends with two .eq() calls.
  // first .eq → returns self; second .eq → resolves with rows.
  const eqChain = vi.fn();
  eqChain
    .mockReturnValueOnce({ eq: eqChain })
    .mockResolvedValueOnce({ data: rows, error: null });
  return { select: vi.fn().mockReturnValue({ eq: eqChain }) };
}

function makeWalletBuilder(totalCoins: number | null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: totalCoins !== null ? { total_coins: totalCoins } : null,
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  return { select: vi.fn().mockReturnValue({ eq }) };
}

describe("getCoinBreakdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("aggregates all four sources into a breakdown object", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "quiz_sessions")
        return makeAggBuilder([{ coins_earned: 10 }, { coins_earned: 20 }]);
      if (table === "shop_coin_transactions")
        return makeAggBuilder([{ coins_spent: 25 }]);
      if (table === "coin_redemptions")
        return makeAggBuilder([{ coins_redeemed: 100 }]);
      if (table === "wallets") return makeWalletBuilder(205);
      return makeAggBuilder([]);
    });

    const result = await getCoinBreakdown();

    expect(result).toEqual({
      totalEarned: 30,
      spentOnRecipes: 25,
      redeemed: 100,
      available: 205,
    });
  });

  it("returns zeros when all tables are empty", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "wallets") return makeWalletBuilder(null);
      return makeAggBuilder([]);
    });

    const result = await getCoinBreakdown();

    expect(result).toEqual({
      totalEarned: 0,
      spentOnRecipes: 0,
      redeemed: 0,
      available: 0,
    });
  });
});
