import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { makeFakeAccessToken } from "./testHelpers/fakeJwt";

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

import {
  claimSessionRewardOffer,
  listPendingRewardOffers,
  listShopIngredientPrices,
  listShopRecipes,
  requestSessionRewardOffer,
} from "./supabase-service";

function mockSession(userId = "user-1", familyId = "family-1") {
  getSessionMock.mockResolvedValue({
    data: {
      session: {
        access_token: makeFakeAccessToken({ app_metadata: { family_id: familyId, user_id: userId } }),
        user: { id: "auth-user-1", app_metadata: { family_id: familyId, user_id: userId } },
      },
    },
  });
}

const offerPayload = (overrides: Record<string, unknown> = {}) => ({
  hasOffer: true,
  quizSessionId: "quiz-1",
  isWin: true,
  testedCount: 22,
  picksAllowed: 2,
  claimed: false,
  offers: [
    {
      ingredientKey: "wild-tiger-prawn",
      labelI18n: { en: "Wild Tiger Prawn", zh: "野生虎头虾" },
      iconPath: "/ingredients/wild-tiger-prawn.png",
      quantity: 2,
      isMystery: true,
    },
    { ingredientKey: "gilded-sesame-oil", labelI18n: null, iconPath: null, quantity: 1, isMystery: true },
    { ingredientKey: "spring-bamboo-shoot", labelI18n: null, iconPath: null, quantity: 1, isMystery: true },
  ],
  ...overrides,
});

describe("requestSessionRewardOffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("calls reward_session_ingredients with only the quiz session id", async () => {
    rpcMock.mockResolvedValue({ data: { hasOffer: false }, error: null });

    await requestSessionRewardOffer("quiz-1");

    expect(rpcMock).toHaveBeenCalledWith("reward_session_ingredients", { p_quiz_session_id: "quiz-1" });
  });

  it("maps an offer: picks, tested count, win flag, and each ingredient's quantity / mystery flag", async () => {
    rpcMock.mockResolvedValue({ data: offerPayload(), error: null });

    const offer = await requestSessionRewardOffer("quiz-1");

    expect(offer).toEqual({
      quizSessionId: "quiz-1",
      isWin: true,
      testedCount: 22,
      picksAllowed: 2,
      offers: [
        {
          ingredientKey: "wild-tiger-prawn",
          labelI18n: { en: "Wild Tiger Prawn", zh: "野生虎头虾" },
          iconPath: "/ingredients/wild-tiger-prawn.png",
          quantity: 2,
          isMystery: true,
        },
        { ingredientKey: "gilded-sesame-oil", quantity: 1, isMystery: true },
        { ingredientKey: "spring-bamboo-shoot", quantity: 1, isMystery: true },
      ],
    });
  });

  it("returns null when there is nothing to choose (no offer, e.g. under 10 tested)", async () => {
    rpcMock.mockResolvedValue({ data: { hasOffer: false, testedCount: 6 }, error: null });
    expect(await requestSessionRewardOffer("quiz-1")).toBeNull();
  });

  it("returns null when the offer was already claimed", async () => {
    rpcMock.mockResolvedValue({ data: offerPayload({ claimed: true }), error: null });
    expect(await requestSessionRewardOffer("quiz-1")).toBeNull();
  });

  it("returns null for a null / malformed payload instead of throwing", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    expect(await requestSessionRewardOffer("quiz-1")).toBeNull();
    rpcMock.mockResolvedValue({ data: { hasOffer: true, quizSessionId: "q", offers: "nope", picksAllowed: 1 }, error: null });
    expect(await requestSessionRewardOffer("quiz-1")).toBeNull();
  });

  it("caps picks at the number of offers and drops rows with no key", async () => {
    rpcMock.mockResolvedValue({
      data: offerPayload({
        picksAllowed: 3,
        offers: [
          { ingredientKey: "", quantity: 2 },
          { ingredientKey: "milk", quantity: -3, isMystery: false },
        ],
      }),
      error: null,
    });

    const offer = await requestSessionRewardOffer("quiz-1");

    expect(offer?.offers.map((row) => [row.ingredientKey, row.quantity])).toEqual([["milk", 1]]);
    expect(offer?.picksAllowed).toBe(1);
  });

  it("throws on an RPC error so callers can log it and still finish the session", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(requestSessionRewardOffer("quiz-1")).rejects.toThrow("requestSessionRewardOffer: boom");
  });
});

describe("claimSessionRewardOffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("sends the session id and the chosen keys", async () => {
    rpcMock.mockResolvedValue({ data: { success: false, code: "no_offer" }, error: null });

    await claimSessionRewardOffer("quiz-1", ["a", "b"]);

    expect(rpcMock).toHaveBeenCalledWith("claim_session_ingredient_offer", {
      p_quiz_session_id: "quiz-1",
      p_ingredient_keys: ["a", "b"],
    });
  });

  it("maps a successful claim: granted ingredients and unlocked recipes", async () => {
    rpcMock.mockResolvedValue({
      data: {
        success: true,
        code: "claimed",
        isWin: true,
        ingredients: [{ ingredientKey: "wild-tiger-prawn", labelI18n: null, iconPath: null, quantity: 2, isMystery: true }],
        unlockedRecipeIds: ["recipe-1", 7],
      },
      error: null,
    });

    const result = await claimSessionRewardOffer("quiz-1", ["wild-tiger-prawn"]);

    expect(result).toEqual({
      success: true,
      isWin: true,
      ingredients: [{ ingredientKey: "wild-tiger-prawn", quantity: 2, isMystery: true }],
      unlockedRecipeIds: ["recipe-1"],
    });
  });

  it.each(["forbidden", "no_offer", "already_claimed", "invalid_selection"] as const)(
    "passes through the %s refusal code",
    async (code) => {
      rpcMock.mockResolvedValue({ data: { success: false, code }, error: null });
      expect(await claimSessionRewardOffer("quiz-1", ["a"])).toEqual({ success: false, code });
    }
  );

  it("maps an unexpected refusal to 'unknown' rather than throwing", async () => {
    rpcMock.mockResolvedValue({ data: { success: false, code: "weird" }, error: null });
    expect(await claimSessionRewardOffer("quiz-1", ["a"])).toEqual({ success: false, code: "unknown" });
    rpcMock.mockResolvedValue({ data: null, error: null });
    expect(await claimSessionRewardOffer("quiz-1", ["a"])).toEqual({ success: false, code: "unknown" });
  });

  it("throws on an RPC transport error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(claimSessionRewardOffer("quiz-1", ["a"])).rejects.toThrow("claimSessionRewardOffer: boom");
  });
});

describe("listPendingRewardOffers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("maps each pending offer and ignores anything malformed or already claimed", async () => {
    rpcMock.mockResolvedValue({
      data: [
        offerPayload({ quizSessionId: "quiz-a" }),
        offerPayload({ quizSessionId: "quiz-b", claimed: true }),
        { hasOffer: false },
        null,
      ],
      error: null,
    });

    const pending = await listPendingRewardOffers();

    expect(rpcMock).toHaveBeenCalledWith("list_pending_ingredient_offers");
    expect(pending.map((offer) => offer.quizSessionId)).toEqual(["quiz-a"]);
  });

  it("returns an empty list for no data, and throws on an RPC error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    expect(await listPendingRewardOffers()).toEqual([]);
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(listPendingRewardOffers()).rejects.toThrow("listPendingRewardOffers: boom");
  });
});

describe("shop catalog reads carry the mystery fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("listShopRecipes maps is_mystery and teaser_i18n (defaults: false / null)", async () => {
    const builder = { select: vi.fn(), order: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.order.mockResolvedValue({
      data: [
        {
          id: "r1",
          slug: "crystal-dumpling",
          title: "Crystal Dumplings",
          display_order: 14,
          is_active: true,
          variant_icon_rules: [{ match: [], iconPath: "/rewards/crystal-dumpling_plain.png" }],
          intro: "x",
          unlock_cost_coins: 0,
          base_ingredients: [],
          special_ingredient_slots: [],
          cook_method: "stove",
          food_type: "hotmeal",
          is_mystery: true,
          teaser_i18n: { en: "A secret.", zh: "秘密。" },
        },
        {
          id: "r2",
          slug: "bun",
          title: "Bun",
          display_order: 2,
          is_active: true,
          variant_icon_rules: [],
          intro: "y",
          unlock_cost_coins: 25,
          base_ingredients: [],
          special_ingredient_slots: [],
        },
      ],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const [mystery, normal] = await listShopRecipes();

    expect(mystery.isMystery).toBe(true);
    expect(mystery.teaserI18n).toEqual({ en: "A secret.", zh: "秘密。" });
    expect(normal.isMystery).toBe(false);
    expect(normal.teaserI18n).toBeNull();
  });

  it("listShopIngredientPrices maps is_mystery (default false)", async () => {
    const builder = { select: vi.fn(), order: vi.fn() };
    builder.select.mockReturnValue(builder);
    builder.order.mockResolvedValue({
      data: [
        { ingredient_key: "wild-tiger-prawn", cost_coins: 0, updated_at: "2026-10-24T00:00:00Z", is_mystery: true },
        { ingredient_key: "milk", cost_coins: 5, updated_at: "2026-10-24T00:00:00Z" },
      ],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const [prawn, milk] = await listShopIngredientPrices();

    expect(prawn.isMystery).toBe(true);
    expect(milk.isMystery).toBe(false);
  });
});
