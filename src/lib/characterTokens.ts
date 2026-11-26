/**
 * Café, character tokens + wishlist: pure helpers (roadmap item U; spec
 * docs/feature-specs/2026-11-21-cafe-visitors-character-tokens-wishlist.md).
 *
 * Balances mirror the SQL `paw_print_balance`. The server remains the authority for every
 * spend, sale and price; these helpers decide only what the UI shows.
 */
import type {
  CafeOrderItem,
  CafeVisit,
  CafeVisitFrequency,
  CafeVisitFrequencyError,
  CatalogTokenSpend,
  CharacterOrderDraft,
  CharacterOrderDraftError,
  CharacterTokenAward,
  CharacterTokenBalance,
  CharacterTokenStamp,
  DismissCafeVisitFailureCode,
  DismissCafeVisitResult,
  GetCafeVisitFailureCode,
  GetCafeVisitResult,
  LocalizedText,
  MissingTokens,
  OrderReadiness,
  RedeemWishlistRewardFailureCode,
  RedeemWishlistRewardResult,
  SaveCharacterOrderFailureCode,
  SaveCharacterOrderResult,
  SaveWishlistRewardFailureCode,
  SaveWishlistRewardResult,
  ServeCafeVisitFailureCode,
  ServeCafeVisitResult,
  WishlistCardState,
  WishlistDraft,
  WishlistDraftError,
  WishlistPrice,
  WishlistRedemption,
  WishlistReward,
} from "./characterTokens.types";

export const CHARACTER_ORDER_PRICE_MAX = 50;
export const CHARACTER_ORDER_QUANTITY_MAX = 9;
export const WISHLIST_TITLE_MAX = 60;
export const WISHLIST_TOKEN_MAX = 999;
export const WISHLIST_SIGNATURE_MAX = 60;
/** Longest side of a wishlist photo after the browser shrinks it. */
export const WISHLIST_PHOTO_MAX_SIDE = 1600;

/** Scales a width and height down (never up) so the longest side is at most maxSide. */
export function scaleToFit(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export const CAFE_VISIT_FREQUENCIES: readonly CafeVisitFrequency[] = ["unlimited", "daily", "weekly", "monthly", "random_days"];
/** Mirrors shop_characters' checks: 1-100 visits, or 1-31 random days a month. */
export const CAFE_VISIT_LIMIT_MAX = 100;
export const CAFE_RANDOM_DAYS_MAX = 31;

export function isCafeVisitFrequency(value: unknown): value is CafeVisitFrequency {
  return typeof value === "string" && (CAFE_VISIT_FREQUENCIES as readonly string[]).includes(value);
}

/** The limit to save for a frequency: null when unlimited, otherwise a whole number in range. */
export function validateCafeVisitFrequency(
  frequency: CafeVisitFrequency,
  limit: number | null
): CafeVisitFrequencyError | null {
  if (frequency === "unlimited") return null;
  if (limit === null || !Number.isInteger(limit) || limit < 1) return "missing_limit";
  const max = frequency === "random_days" ? CAFE_RANDOM_DAYS_MAX : CAFE_VISIT_LIMIT_MAX;
  return limit > max ? "limit_too_large" : null;
}

function tokensSpent(
  catalogSpends: readonly CatalogTokenSpend[],
  wishlistRedemptions: readonly WishlistRedemption[],
  characterKey: string
): number {
  const catalog = catalogSpends
    .filter((spend) => spend.giver === characterKey)
    .reduce((sum, spend) => sum + spend.cost, 0);
  const wishlist = wishlistRedemptions.reduce(
    (sum, redemption) => sum + (redemption.priceSnapshot[characterKey] ?? 0),
    0
  );
  return catalog + wishlist;
}

/** Collected = earned from this character; available = collected minus every spend of their tokens. */
export function computeCharacterTokenBalance(
  awards: readonly CharacterTokenAward[],
  catalogSpends: readonly CatalogTokenSpend[],
  wishlistRedemptions: readonly WishlistRedemption[],
  characterKey: string
): CharacterTokenBalance {
  const collected = awards.filter((award) => award.giver === characterKey).length;
  const spent = tokensSpent(catalogSpends, wishlistRedemptions, characterKey);
  return { collected, available: Math.max(collected - spent, 0) };
}

/** One character's sheet, oldest first. Spending never removes a token: the oldest spent ones show as used. */
export function buildCharacterTokenStamps(
  awards: readonly CharacterTokenAward[],
  catalogSpends: readonly CatalogTokenSpend[],
  wishlistRedemptions: readonly WishlistRedemption[],
  characterKey: string
): CharacterTokenStamp[] {
  const spent = tokensSpent(catalogSpends, wishlistRedemptions, characterKey);
  return awards
    .filter((award) => award.giver === characterKey)
    .slice()
    .sort((a, b) => a.earnedAt - b.earnedAt || a.id.localeCompare(b.id))
    .map((award, index) => ({ award, isUsed: index < spent }));
}

/** What the child still lacks for a price, per character. Empty means they can afford it. */
export function findMissingTokens(
  prices: readonly WishlistPrice[],
  availableByCharacter: ReadonlyMap<string, number>
): MissingTokens[] {
  return prices.flatMap((price) => {
    const missing = price.tokenCount - (availableByCharacter.get(price.characterKey) ?? 0);
    return missing > 0 ? [{ characterKey: price.characterKey, missing }] : [];
  });
}

export function resolveWishlistCardState(
  reward: Pick<WishlistReward, "id" | "isRepeatable" | "prices">,
  redemptions: readonly WishlistRedemption[],
  availableByCharacter: ReadonlyMap<string, number>
): WishlistCardState {
  if (!reward.isRepeatable && redemptions.some((redemption) => redemption.rewardId === reward.id)) {
    return "redeemed";
  }
  return findMissingTokens(reward.prices, availableByCharacter).length === 0 ? "redeemable" : "needMore";
}

/** Rewards this child can see: active, and for the whole family or for them. */
export function filterWishlistForChild(rewards: readonly WishlistReward[], userId: string): WishlistReward[] {
  return rewards.filter((reward) => reward.isActive && (reward.childUserId === null || reward.childUserId === userId));
}

/** How many of each recipe sit on the shelf. Countertop and sold dishes never count. */
export function countShelfDishesByRecipe(
  dishes: readonly { recipeId: string; location: string }[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const dish of dishes) {
    if (dish.location !== "shelf") continue;
    counts.set(dish.recipeId, (counts.get(dish.recipeId) ?? 0) + 1);
  }
  return counts;
}

/** Serving is all-or-nothing, so an order is ready only when every item is fully on the shelf. */
export function resolveOrderReadiness(
  items: readonly CafeOrderItem[],
  shelfCounts: ReadonlyMap<string, number>
): OrderReadiness {
  const resolved = items.map((item) => {
    const onShelf = shelfCounts.get(item.recipeId) ?? 0;
    return { ...item, onShelf, isReady: onShelf >= item.quantity };
  });
  return { items: resolved, isReady: resolved.length > 0 && resolved.every((item) => item.isReady) };
}

export function validateWishlistDraft(draft: WishlistDraft): WishlistDraftError | null {
  const title = draft.title.trim();
  if (title === "") return "missing_title";
  if (title.length > WISHLIST_TITLE_MAX) return "title_too_long";
  if (draft.prices.length === 0) return "missing_price";
  if (draft.prices.some((price) => !Number.isInteger(price.tokenCount) || price.tokenCount < 1 || price.tokenCount > WISHLIST_TOKEN_MAX)) {
    return "invalid_price";
  }
  if (new Set(draft.prices.map((price) => price.characterKey)).size !== draft.prices.length) return "duplicate_price";
  return null;
}

export function validateCharacterOrderDraft(draft: CharacterOrderDraft): CharacterOrderDraftError | null {
  if (!Number.isInteger(draft.tokenPrice) || draft.tokenPrice < 1 || draft.tokenPrice > CHARACTER_ORDER_PRICE_MAX) {
    return "invalid_price";
  }
  if (draft.items.length === 0) return "missing_items";
  if (draft.items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > CHARACTER_ORDER_QUANTITY_MAX)) {
    return "invalid_quantity";
  }
  if (new Set(draft.items.map((item) => item.recipeId)).size !== draft.items.length) return "duplicate_item";
  return null;
}

/**
 * A poem's text, one 句 per line: line breaks the admin typed are kept, otherwise the text is
 * split after each sentence or clause mark (，。！？； and their ASCII forms), which stays at
 * the end of its line.
 */
export function splitPoemLines(body: string): string[] {
  return body
    .split(/\r?\n/)
    .flatMap((row) => row.match(/[^，。！？；,.!?;]+[，。！？；,.!?;]*/g) ?? [])
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** A random line for this moment, avoiding the previous one when there's a choice. */
export function pickCharacterLine(
  lines: readonly LocalizedText[] | undefined,
  previous: LocalizedText | null,
  random: () => number = Math.random
): LocalizedText | null {
  if (!lines || lines.length === 0) return null;
  const pool = lines.length > 1 ? lines.filter((line) => line !== previous) : lines;
  return pool[Math.floor(random() * pool.length)] ?? pool[0];
}

// ── Row and RPC normalizers ─────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asCount(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.max(Math.trunc(n), 0) : 0;
}

function pickCode<T extends string>(value: unknown, known: readonly T[], fallback: T): T {
  return typeof value === "string" && (known as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function normalizeLocalizedText(value: unknown): LocalizedText {
  const row = asRecord(value);
  return {
    en: typeof row?.en === "string" ? row.en : "",
    zh: typeof row?.zh === "string" ? row.zh : "",
  };
}

/** A visit's stored items. Malformed entries are dropped rather than shown. */
export function normalizeCafeOrderItems(value: unknown): CafeOrderItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = asRecord(entry);
    const quantity = asCount(row?.quantity);
    return typeof row?.recipeId === "string" && quantity > 0 ? [{ recipeId: row.recipeId, quantity }] : [];
  });
}

/** A price snapshot `{ characterKey: count }`, keeping positive counts only. */
export function normalizePriceSnapshot(value: unknown): Record<string, number> {
  const row = asRecord(value);
  if (!row) return {};
  return Object.fromEntries(
    Object.entries(row).flatMap(([key, count]) => {
      const n = asCount(count);
      return n > 0 ? [[key, n] as const] : [];
    })
  );
}

const GET_VISIT_CODES: readonly GetCafeVisitFailureCode[] = ["forbidden", "no_visitors", "no_visitors_today"];
const SERVE_CODES: readonly ServeCafeVisitFailureCode[] = ["forbidden", "no_visit", "visit_closed", "not_on_shelf"];
const DISMISS_CODES: readonly DismissCafeVisitFailureCode[] = ["forbidden", "no_visit", "visit_closed"];
const SAVE_ORDER_CODES: readonly SaveCharacterOrderFailureCode[] = [
  "forbidden",
  "unknown_character",
  "unknown_order",
  "invalid_price",
  "invalid_items",
];
const SAVE_WISHLIST_CODES: readonly SaveWishlistRewardFailureCode[] = [
  "forbidden",
  "invalid_title",
  "invalid_child",
  "invalid_price",
  "invalid_image",
  "unknown_reward",
];
const REDEEM_WISHLIST_CODES: readonly RedeemWishlistRewardFailureCode[] = [
  "forbidden",
  "invalid_child_signature",
  "invalid_parent_signature",
  "same_signature",
  "unknown_reward",
  "already_redeemed",
  "insufficient_tokens",
];

export function normalizeGetCafeVisitResult(data: unknown): GetCafeVisitResult {
  const row = asRecord(data);
  if (row?.success === true) {
    const items = normalizeCafeOrderItems(row.items);
    const tokenPrice = asCount(row.tokenPrice);
    if (typeof row.visitId === "string" && typeof row.characterKey === "string" && items.length > 0 && tokenPrice > 0) {
      const visit: CafeVisit = { visitId: row.visitId, characterKey: row.characterKey, items, tokenPrice };
      return { success: true, visit };
    }
    return { success: false, code: "unknown" };
  }
  return { success: false, code: pickCode(row?.code, GET_VISIT_CODES, "unknown") };
}

export function normalizeServeCafeVisitResult(data: unknown): ServeCafeVisitResult {
  const row = asRecord(data);
  if (row?.success === true && typeof row.characterKey === "string") {
    return {
      success: true,
      characterKey: row.characterKey,
      tokensEarned: asCount(row.tokensEarned),
      balance: { collected: asCount(row.collected), available: asCount(row.available) },
    };
  }
  return { success: false, code: pickCode(row?.code, SERVE_CODES, "unknown") };
}

export function normalizeDismissCafeVisitResult(data: unknown): DismissCafeVisitResult {
  const row = asRecord(data);
  if (row?.success === true) return { success: true };
  return { success: false, code: pickCode(row?.code, DISMISS_CODES, "unknown") };
}

export function normalizeSaveCharacterOrderResult(data: unknown): SaveCharacterOrderResult {
  const row = asRecord(data);
  if (row?.success === true && typeof row.orderId === "string") return { success: true, orderId: row.orderId };
  return { success: false, code: pickCode(row?.code, SAVE_ORDER_CODES, "unknown") };
}

export function normalizeSaveWishlistRewardResult(data: unknown): SaveWishlistRewardResult {
  const row = asRecord(data);
  if (row?.success === true && typeof row.rewardId === "string") return { success: true, rewardId: row.rewardId };
  return { success: false, code: pickCode(row?.code, SAVE_WISHLIST_CODES, "unknown") };
}

export function normalizeRedeemWishlistRewardResult(data: unknown): RedeemWishlistRewardResult {
  const row = asRecord(data);
  if (row?.success === true && typeof row.title === "string") return { success: true, title: row.title };
  return { success: false, code: pickCode(row?.code, REDEEM_WISHLIST_CODES, "unknown") };
}
