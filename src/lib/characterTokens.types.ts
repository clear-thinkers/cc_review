/**
 * Café, character tokens + wishlist types (roadmap item U; spec
 * docs/feature-specs/2026-11-21-cafe-visitors-character-tokens-wishlist.md).
 */

export type LocalizedText = { en: string; zh: string };

export type CafeLineMoment = "order" | "served" | "dismissed";
export type CafeSpritePose = "waiting" | "delighted";

/** How often a character may visit each child (owner, 2026-11-25). A visit counts when they walk in. */
export type CafeVisitFrequency = "unlimited" | "daily" | "weekly" | "monthly" | "random_days";
export type CafeVisitFrequencyError = "missing_limit" | "limit_too_large";

/** A `shop_characters` row. Chef Shrewy is one too (`visitsCafe: false`). */
export type ShopCharacter = {
  key: string;
  name: LocalizedText;
  intro: LocalizedText;
  tokenName: LocalizedText;
  tokenIconPath: string | null;
  spritePaths: Partial<Record<CafeSpritePose, string>>;
  lines: Partial<Record<CafeLineMoment, LocalizedText[]>>;
  visitsCafe: boolean;
  /** x visits per day / week / month, or one visit on each of x random days a month. */
  visitFrequency: CafeVisitFrequency;
  /** Null only when visitFrequency is "unlimited". */
  visitLimit: number | null;
  isActive: boolean;
  displayOrder: number;
};

export type CafeOrderItem = { recipeId: string; quantity: number };

/** One order a character can place: a mix of dishes for one token price. */
export type ShopCharacterOrder = {
  id: string;
  characterKey: string;
  tokenPrice: number;
  isActive: boolean;
  items: CafeOrderItem[];
};

/** Curated content a token can carry, e.g. a poem on a 诗笺. */
export type CharacterTokenContent = {
  id: string;
  characterKey: string;
  title: string;
  body: string;
  isActive: boolean;
  displayOrder: number;
};

export type CafeVisit = {
  visitId: string;
  characterKey: string;
  items: CafeOrderItem[];
  tokenPrice: number;
};

export type CharacterTokenSource = "chef_challenge" | "cafe_sale";

/** One earned token (a `paw_print_awards` row, for any character). */
export type CharacterTokenAward = {
  id: string;
  userId: string;
  giver: string;
  source: CharacterTokenSource;
  recipeId: string | null;
  /** What the café order contained; empty for a chef-challenge paw print. */
  cafeItems: CafeOrderItem[];
  contentId: string | null;
  earnedAt: number;
};

export type CharacterTokenStamp = { award: CharacterTokenAward; isUsed: boolean };
export type CharacterTokenBalance = { collected: number; available: number };

/** Tokens spent on an in-app catalog reward (a `paw_print_redemptions` row). */
export type CatalogTokenSpend = { giver: string; cost: number };

export type WishlistPrice = { characterKey: string; tokenCount: number };

export type WishlistReward = {
  id: string;
  /** Null = any child in the family. */
  childUserId: string | null;
  title: string;
  isRepeatable: boolean;
  isActive: boolean;
  prices: WishlistPrice[];
  /** Path of the optional photo in the private wishlist-photos bucket. */
  imagePath: string | null;
};

export type WishlistRedemption = {
  id: string;
  userId: string;
  rewardId: string | null;
  title: string;
  priceSnapshot: Record<string, number>;
  childSignature: string;
  parentSignature: string;
  redeemedAt: number;
};

export type WishlistCardState = "redeemable" | "needMore" | "redeemed";
export type MissingTokens = { characterKey: string; missing: number };

export type OrderItemReadiness = CafeOrderItem & { onShelf: number; isReady: boolean };
export type OrderReadiness = { items: OrderItemReadiness[]; isReady: boolean };

export type WishlistDraft = {
  title: string;
  childUserId: string | null;
  isRepeatable: boolean;
  prices: WishlistPrice[];
};
export type WishlistDraftError = "missing_title" | "title_too_long" | "missing_price" | "invalid_price" | "duplicate_price";

export type CharacterOrderDraft = { tokenPrice: number; items: CafeOrderItem[] };
export type CharacterOrderDraftError = "invalid_price" | "missing_items" | "invalid_quantity" | "duplicate_item";

/** no_visitors: nobody is set up to visit; no_visitors_today: everyone has used up their visits for now. */
export type GetCafeVisitFailureCode = "forbidden" | "no_visitors" | "no_visitors_today" | "unknown";
export type GetCafeVisitResult =
  | { success: true; visit: CafeVisit }
  | { success: false; code: GetCafeVisitFailureCode };

export type ServeCafeVisitFailureCode = "forbidden" | "no_visit" | "visit_closed" | "not_on_shelf" | "unknown";
export type ServeCafeVisitResult =
  | { success: true; characterKey: string; tokensEarned: number; balance: CharacterTokenBalance }
  | { success: false; code: ServeCafeVisitFailureCode };

export type DismissCafeVisitFailureCode = "forbidden" | "no_visit" | "visit_closed" | "unknown";
export type DismissCafeVisitResult = { success: true } | { success: false; code: DismissCafeVisitFailureCode };

export type SaveCharacterOrderFailureCode =
  | "forbidden"
  | "unknown_character"
  | "unknown_order"
  | "invalid_price"
  | "invalid_items"
  | "unknown";
export type SaveCharacterOrderResult =
  | { success: true; orderId: string }
  | { success: false; code: SaveCharacterOrderFailureCode };

export type SaveWishlistRewardFailureCode =
  | "forbidden"
  | "invalid_title"
  | "invalid_child"
  | "invalid_price"
  | "invalid_image"
  | "unknown_reward"
  | "unknown";
export type SaveWishlistRewardResult =
  | { success: true; rewardId: string }
  | { success: false; code: SaveWishlistRewardFailureCode };

export type RedeemWishlistRewardFailureCode =
  | "forbidden"
  | "invalid_child_signature"
  | "invalid_parent_signature"
  | "same_signature"
  | "unknown_reward"
  | "already_redeemed"
  | "insufficient_tokens"
  | "unknown";
export type RedeemWishlistRewardResult =
  | { success: true; title: string }
  | { success: false; code: RedeemWishlistRewardFailureCode };
