"use client";

import { Ma_Shan_Zheng } from "next/font/google";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/app/shared/locale";
import { useSession } from "@/lib/authContext";
import {
  buildCharacterTokenStamps,
  computeCharacterTokenBalance,
  filterWishlistForChild,
  findMissingTokens,
  resolveWishlistCardState,
  splitPoemLines,
  WISHLIST_SIGNATURE_MAX,
} from "@/lib/characterTokens";
import type {
  CatalogTokenSpend,
  CharacterTokenAward,
  CharacterTokenContent,
  CharacterTokenStamp,
  ShopCharacter,
  WishlistPrice,
  WishlistRedemption,
  WishlistReward,
} from "@/lib/characterTokens.types";
import { resolveRewardCardState } from "@/lib/pawPrints";
import type { PawPrintRedemption, PawPrintReward } from "@/lib/pawPrints.types";
import { getShopRecipeContentForLocale, resolveShopRecipeVariantTitle } from "@/lib/shop";
import type { ShopRecipe } from "@/lib/shop.types";
import {
  listCatalogTokenSpends,
  listCharacterTokenAwards,
  listCharacterTokenContents,
  listPawPrintRedemptions,
  listPawPrintRewards,
  listShopCharacters,
  listShopRecipes,
  listWishlistRedemptions,
  getWishlistPhotoUrls,
  listWishlistRewards,
  redeemPawPrintReward,
  redeemWishlistReward,
} from "@/lib/supabase-service";
import type { WordsWorkspaceVM } from "../../shared/WordsWorkspaceVM";
import { rewardsStrings, type RewardsLocaleStrings } from "./rewards.strings";

type LoadState = "loading" | "ready" | "error";

const SHREWY_KEY = "shrewy";
const SHREWY_BADGE = "/paw-prints/shrewy_paw_badge.png";

/**
 * A brush-style 楷书 face for the poems a token carries (owner, 2026-11-25: "more classical").
 * Chinese fonts are served in small unicode-range pieces, so nothing is preloaded; until it
 * arrives (or if it can't) the device's own 楷体 is used.
 */
const poemFont = Ma_Shan_Zheng({
  weight: "400",
  subsets: ["latin"],
  preload: false,
  display: "swap",
  fallback: ["KaiTi", "STKaiti", "Kaiti SC", "楷体", "serif"],
});

/** A still for each catalog reward's card. */
const REWARD_PREVIEW: Record<string, string> = {
  "shrewy-hand-wash": "/video/shrewy_hand_wash_poster.jpg",
};

function fill(template: string, tokens: Record<string, string>): string {
  return Object.entries(tokens).reduce((text, [key, value]) => text.split("{" + key + "}").join(value), template);
}

function formatDate(timestamp: number, locale: "en" | "zh"): string {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium" }).format(timestamp);
}

function rewardCopy(strings: RewardsLocaleStrings, rewardKey: string): { title: string; description: string } {
  const catalog = strings.catalog as Record<string, { title: string; description: string } | undefined>;
  return catalog[rewardKey] ?? { title: rewardKey, description: "" };
}

/**
 * The Rewards page (/words/shop/rewards, roadmap items T and U). Child + platform admin
 * only. One sheet per character the child has tokens from (every token ever earned, the
 * oldest spent ones shown as used), Shrewy's in-app rewards, and the real-world wishlist a
 * parent set up, redeemed with both signatures. All spending goes through the RPCs, and
 * prices always come from the server.
 */
export default function RewardsSection({ vm }: { vm: WordsWorkspaceVM }) {
  const locale = useLocale();
  const session = useSession();
  const str = rewardsStrings[locale];
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [characters, setCharacters] = useState<ShopCharacter[]>([]);
  const [contents, setContents] = useState<CharacterTokenContent[]>([]);
  const [awards, setAwards] = useState<CharacterTokenAward[]>([]);
  const [catalogSpends, setCatalogSpends] = useState<CatalogTokenSpend[]>([]);
  const [redemptions, setRedemptions] = useState<PawPrintRedemption[]>([]);
  const [rewards, setRewards] = useState<PawPrintReward[]>([]);
  const [wishlist, setWishlist] = useState<WishlistReward[]>([]);
  const [wishlistRedemptions, setWishlistRedemptions] = useState<WishlistRedemption[]>([]);
  /** Signed links for the wishlist photos, keyed by storage path. */
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [recipes, setRecipes] = useState<ShopRecipe[]>([]);
  const [openStamp, setOpenStamp] = useState<CharacterTokenStamp | null>(null);
  const [openStack, setOpenStack] = useState<{ characterKey: string; kind: "available" | "redeemed" } | null>(null);
  const [confirmReward, setConfirmReward] = useState<PawPrintReward | null>(null);
  const [signReward, setSignReward] = useState<WishlistReward | null>(null);
  const [childSignature, setChildSignature] = useState("");
  const [parentSignature, setParentSignature] = useState("");
  const [signError, setSignError] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (vm.page !== "rewards") return;
    let isCancelled = false;
    Promise.all([
      listShopCharacters(),
      listCharacterTokenContents(),
      listCharacterTokenAwards(),
      listCatalogTokenSpends(),
      listPawPrintRedemptions(),
      listPawPrintRewards(),
      listWishlistRewards(),
      listWishlistRedemptions(),
      listShopRecipes(),
    ])
      .then(([characterRows, contentRows, awardRows, spendRows, redemptionRows, rewardRows, wishlistRows, wishlistRedemptionRows, recipeRows]) => {
        if (isCancelled) return;
        setCharacters(characterRows);
        setContents(contentRows);
        setAwards(awardRows);
        setCatalogSpends(spendRows);
        setRedemptions(redemptionRows);
        setRewards(rewardRows);
        setWishlist(wishlistRows);
        // Photos are a nice-to-have: a failure just leaves the cards without them.
        const paths = wishlistRows.flatMap((reward) => (reward.imagePath ? [reward.imagePath] : []));
        getWishlistPhotoUrls(paths)
          .then((urls) => {
            if (!isCancelled) setPhotoUrls(urls);
          })
          .catch((error) => console.error("Failed to load wishlist photos:", error));
        setWishlistRedemptions(wishlistRedemptionRows);
        setRecipes(recipeRows);
        setLoadState("ready");
      })
      .catch((error) => {
        console.error("Failed to load rewards:", error);
        if (!isCancelled) setLoadState("error");
      });
    return () => {
      isCancelled = true;
    };
  }, [vm.page]);

  const characterByKey = useMemo(() => new Map(characters.map((character) => [character.key, character])), [characters]);
  const contentById = useMemo(() => new Map(contents.map((content) => [content.id, content])), [contents]);
  const availableByCharacter = useMemo(
    () =>
      new Map(
        characters.map((character) => [
          character.key,
          computeCharacterTokenBalance(awards, catalogSpends, wishlistRedemptions, character.key).available,
        ])
      ),
    [characters, awards, catalogSpends, wishlistRedemptions]
  );
  // Shrewy's sheet always shows; another character's appears once the child has their tokens.
  const sheets = useMemo(
    () =>
      characters
        .filter((character) => character.key === SHREWY_KEY || awards.some((award) => award.giver === character.key))
        .map((character) => ({
          character,
          balance: computeCharacterTokenBalance(awards, catalogSpends, wishlistRedemptions, character.key),
          stamps: buildCharacterTokenStamps(awards, catalogSpends, wishlistRedemptions, character.key),
        })),
    [characters, awards, catalogSpends, wishlistRedemptions]
  );
  const redeemedKeys = useMemo(() => new Set(redemptions.map((redemption) => redemption.rewardKey)), [redemptions]);
  const recipeTitleById = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, getShopRecipeContentForLocale(recipe, locale).title])),
    [recipes, locale]
  );
  /** A sold dish's name, using its pinned variant's name (e.g. 红豆包) when the order had one. */
  const orderDishTitle = (recipeId: string, specialIngredientKeys: string[] | undefined): string => {
    const title = recipeTitleById.get(recipeId);
    const recipe = recipes.find((entry) => entry.id === recipeId);
    if (!title || !recipe) return str.stampUnknownRecipe;
    return resolveShopRecipeVariantTitle(recipe.variantIconRules, specialIngredientKeys ?? [], locale, title);
  };
  const shrewyRewards = rewards.filter((reward) => reward.giver === SHREWY_KEY);
  const shrewyAvailable = availableByCharacter.get(SHREWY_KEY) ?? 0;
  const visibleWishlist = filterWishlistForChild(wishlist, session?.userId ?? "");

  if (vm.page !== "rewards") return null;

  const nameOf = (key: string): string => {
    const character = characterByKey.get(key);
    return character?.name[locale] || character?.name.en || (key === SHREWY_KEY ? str.giverNames.shrewy : key);
  };
  const tokenOf = (key: string): string => {
    const character = characterByKey.get(key);
    return character?.tokenName[locale] || character?.tokenName.en || key;
  };
  const priceText = (prices: readonly WishlistPrice[]): string =>
    prices.map((price) => price.tokenCount + " " + tokenOf(price.characterKey)).join(" + ");

  async function handleRedeem(reward: PawPrintReward): Promise<void> {
    setIsRedeeming(true);
    setNotice(null);
    try {
      const result = await redeemPawPrintReward(reward.rewardKey);
      if (!result.success) {
        setNotice({ tone: "error", text: str.redeemErrors[result.code] });
        return;
      }
      const [redemptionRows, spendRows] = await Promise.all([listPawPrintRedemptions(), listCatalogTokenSpends()]);
      setRedemptions(redemptionRows);
      setCatalogSpends(spendRows);
      setNotice({
        tone: "success",
        text: fill(str.redeemSuccessTemplate, { title: rewardCopy(str, reward.rewardKey).title }),
      });
    } catch (error) {
      console.error("Failed to redeem reward:", error);
      setNotice({ tone: "error", text: str.redeemErrors.unknown });
    } finally {
      setIsRedeeming(false);
      setConfirmReward(null);
    }
  }

  function openSignDialog(reward: WishlistReward): void {
    setChildSignature("");
    setParentSignature("");
    setSignError(null);
    setSignReward(reward);
  }

  async function handleWishlistRedeem(reward: WishlistReward): Promise<void> {
    const child = childSignature.trim();
    const parent = parentSignature.trim();
    if (!child) return setSignError(str.wishlistErrors.invalid_child_signature);
    if (!parent) return setSignError(str.wishlistErrors.invalid_parent_signature);
    if (child.toLowerCase() === parent.toLowerCase()) return setSignError(str.wishlistErrors.same_signature);

    setIsRedeeming(true);
    setSignError(null);
    setNotice(null);
    try {
      const result = await redeemWishlistReward(reward.id, child, parent);
      if (!result.success) {
        setSignError(str.wishlistErrors[result.code]);
        return;
      }
      setWishlistRedemptions(await listWishlistRedemptions());
      setSignReward(null);
      setNotice({ tone: "success", text: fill(str.wishlistSuccessTemplate, { title: result.title }) });
    } catch (error) {
      console.error("Failed to redeem wishlist reward:", error);
      setSignError(str.wishlistErrors.unknown);
    } finally {
      setIsRedeeming(false);
    }
  }

  const openCharacter = openStamp ? characterByKey.get(openStamp.award.giver) : undefined;
  const openStackSheet = (() => {
    if (!openStack) return null;
    const sheet = sheets.find((entry) => entry.character.key === openStack.characterKey);
    if (!sheet) return null;
    const isUsed = openStack.kind === "redeemed";
    const heading =
      sheet.character.key === SHREWY_KEY
        ? str.collectionHeading
        : fill(str.sheetHeadingTemplate, { name: nameOf(sheet.character.key), token: tokenOf(sheet.character.key) });
    return {
      character: sheet.character,
      stamps: sheet.stamps.filter((stamp) => stamp.isUsed === isUsed),
      title: heading + " · " + (isUsed ? str.usedBadge : str.availableLabel),
    };
  })();
  const openContent = openStamp?.award.contentId ? contentById.get(openStamp.award.contentId) : undefined;

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <h2 className="font-medium">{str.pageTitle}</h2>
        <p className="max-w-3xl text-sm text-gray-700">{str.pageDescription}</p>
      </div>

      {notice ? (
        <p
          role="status"
          className={
            notice.tone === "success"
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
          }
        >
          {notice.text}
        </p>
      ) : null}

      {loadState === "loading" ? (
        <p className="text-sm text-gray-600">{str.loading}</p>
      ) : loadState === "error" ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{str.loadError}</p>
      ) : (
        <>
          {/* One paper sheet per character: an "available" stack and a "redeemed" stack */}
          <div className="grid gap-4 md:grid-cols-2">
          {sheets.map(({ character, stamps }) => {
            const isShrewy = character.key === SHREWY_KEY;
            const heading = isShrewy
              ? str.collectionHeading
              : fill(str.sheetHeadingTemplate, { name: nameOf(character.key), token: tokenOf(character.key) });
            const badge = isShrewy ? SHREWY_BADGE : character.tokenIconPath;
            const stacks = [
              { kind: "available" as const, label: str.availableLabel, stamps: stamps.filter((stamp) => !stamp.isUsed) },
              { kind: "redeemed" as const, label: str.usedBadge, stamps: stamps.filter((stamp) => stamp.isUsed) },
            ].filter((stack) => stack.stamps.length > 0);
            return (
              <div
                key={character.key}
                className="rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-4 shadow-[0_16px_34px_rgba(115,92,40,0.08)]"
              >
                <h3 className="flex items-center gap-2 text-lg font-semibold text-[#6a5530]">
                  {heading}
                  {badge ? <img src={badge} alt="" aria-hidden="true" draggable={false} className="h-7 w-7 select-none object-contain" /> : null}
                </h3>

                {stacks.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-[#e8dcc0] bg-white/60 px-4 py-4 text-center text-sm text-[#8b6f2f]">
                    {str.emptySheet}
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-6">
                    {stacks.map((stack) => {
                      const isUsed = stack.kind === "redeemed";
                      const layers = Math.min(stack.stamps.length, 3);
                      return (
                        <button
                          key={stack.kind}
                          type="button"
                          onClick={() => setOpenStack({ characterKey: character.key, kind: stack.kind })}
                          aria-haspopup="dialog"
                          aria-label={fill(str.stackAriaTemplate, { label: stack.label, count: String(stack.stamps.length) })}
                          className="group flex flex-col items-center gap-1 rounded-xl p-1 transition hover:bg-[#fff6e3]"
                        >
                          <span className="relative block h-24 w-24">
                            {/* Up to two tokens peek out behind the top one, so a pile reads as a pile. */}
                            {Array.from({ length: layers }, (_, index) => layers - 1 - index).map((depth) => (
                              <span
                                key={depth}
                                className={
                                  "absolute inset-0 flex items-center justify-center " +
                                  (depth === 2 ? "translate-x-2 -translate-y-1 rotate-12" : depth === 1 ? "translate-x-1 rotate-6" : "-rotate-6")
                                }
                              >
                                {character.tokenIconPath ? (
                                  <img
                                    src={character.tokenIconPath}
                                    alt=""
                                    aria-hidden="true"
                                    draggable={false}
                                    className={"h-full w-full select-none object-contain drop-shadow-sm " + (isUsed ? "opacity-35 grayscale" : "")}
                                  />
                                ) : (
                                  <span
                                    aria-hidden="true"
                                    className={
                                      "flex h-full w-full items-center justify-center rounded-full border-2 border-[#dcc38a] bg-white text-2xl font-bold text-[#8b6f2f] " +
                                      (isUsed ? "opacity-35" : "")
                                    }
                                  >
                                    {tokenOf(character.key).slice(0, 1)}
                                  </span>
                                )}
                              </span>
                            ))}
                            <span
                              className={
                                "absolute -bottom-1 -right-1 min-w-[2rem] rounded-full border-2 px-1.5 py-0.5 text-center text-sm font-bold shadow-sm " +
                                (isUsed ? "border-gray-300 bg-white text-gray-600" : "border-emerald-400 bg-emerald-50 text-emerald-800")
                              }
                            >
                              {fill(str.stackCountTemplate, { count: String(stack.stamps.length) })}
                            </span>
                          </span>
                          <span className={"text-xs font-semibold " + (isUsed ? "text-gray-500" : "text-emerald-700")}>{stack.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          </div>

          {openStackSheet && typeof document !== "undefined"
            ? createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpenStack(null)}>
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={openStackSheet.title}
                    onClick={(event) => event.stopPropagation()}
                    className="max-h-[85vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 shadow-xl"
                  >
                    <h3 className="text-lg font-semibold text-[#5c4720]">{openStackSheet.title}</h3>
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {openStackSheet.stamps.map((stamp) => {
                      const character = openStackSheet.character;
                      const isShrewy = character.key === SHREWY_KEY;
                      return (
                      <button
                        key={stamp.award.id}
                        type="button"
                        onClick={() => setOpenStamp(stamp)}
                        aria-label={
                          isShrewy
                            ? fill(str.stampAriaTemplate, { date: formatDate(stamp.award.earnedAt, locale) })
                            : fill(str.tokenAriaTemplate, { token: tokenOf(character.key), date: formatDate(stamp.award.earnedAt, locale) })
                        }
                        className="relative flex aspect-square items-center justify-center rounded-xl border border-dashed border-[#e8dcc0] bg-white/70 p-2 transition hover:bg-[#fff6e3]"
                      >
                        {character.tokenIconPath ? (
                          <img
                            src={character.tokenIconPath}
                            alt=""
                            aria-hidden="true"
                            draggable={false}
                            className={"h-full w-full -rotate-6 select-none object-contain " + (stamp.isUsed ? "opacity-35 grayscale" : "")}
                          />
                        ) : (
                          <span aria-hidden="true" className={"text-2xl font-bold text-[#8b6f2f] " + (stamp.isUsed ? "opacity-35" : "")}>
                            {tokenOf(character.key).slice(0, 1)}
                          </span>
                        )}
                      </button>
                      );
                    })}
                    </div>
                    <button
                      type="button"
                      autoFocus
                      onClick={() => setOpenStack(null)}
                      className="btn-nav w-full rounded-full border-2 px-4 py-2 font-semibold"
                    >
                      {str.closeButton}
                    </button>
                  </div>
                </div>,
                document.body
              )
            : null}

          {/* Real-world rewards a parent set up */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-[#6a5530]">{str.wishlistHeading}</h3>
              <p className="text-sm text-gray-700">{str.wishlistDescription}</p>
            </div>
            {visibleWishlist.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#e8dcc0] bg-white/60 px-4 py-6 text-center text-sm text-[#8b6f2f]">
                {str.wishlistEmpty}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {visibleWishlist.map((reward) => {
                  const state = resolveWishlistCardState(reward, wishlistRedemptions, availableByCharacter);
                  const missing = findMissingTokens(reward.prices, availableByCharacter);
                  return (
                    <div key={reward.id} className="space-y-2 rounded-[1.25rem] border border-[#dcc38a] bg-[#fffaf0] p-4 shadow-sm">
                      {reward.imagePath && photoUrls[reward.imagePath] ? (
                        <img
                          src={photoUrls[reward.imagePath]}
                          alt={fill(str.wishlistPhotoAltTemplate, { title: reward.title })}
                          className="aspect-[4/3] w-full rounded-xl object-cover"
                        />
                      ) : null}
                      <p className="font-semibold text-[#5c4720]">{reward.title}</p>
                      <p className="text-sm font-semibold text-[#8b6f2f]">{priceText(reward.prices)}</p>
                      {state === "needMore" ? (
                        <ul className="text-xs text-amber-700">
                          {missing.map((entry) => (
                            <li key={entry.characterKey}>
                              {fill(str.wishlistNeedTemplate, { count: String(entry.missing), token: tokenOf(entry.characterKey) })}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="flex justify-end">
                        {state === "redeemed" ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                            ✓ {str.wishlistRedeemedBadge}
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={state !== "redeemable" || isRedeeming}
                            onClick={() => openSignDialog(reward)}
                            className="btn-primary rounded-full border-2 px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
                          >
                            {str.redeemButton}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Shrewy's rewards */}
          <div className="space-y-3">
            <h3 className="font-semibold text-[#6a5530]">{str.rewardsHeading}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {shrewyRewards.map((reward) => {
                const copy = rewardCopy(str, reward.rewardKey);
                const state = resolveRewardCardState({
                  rewardKey: reward.rewardKey,
                  cost: reward.cost,
                  available: shrewyAvailable,
                  redeemedKeys,
                });
                return (
                  <div
                    key={reward.rewardKey}
                    className="overflow-hidden rounded-[1.25rem] border border-[#dcc38a] bg-[#fffaf0] shadow-sm"
                  >
                    {REWARD_PREVIEW[reward.rewardKey] ? (
                      <img
                        src={REWARD_PREVIEW[reward.rewardKey]}
                        alt=""
                        aria-hidden="true"
                        className="aspect-video w-full object-cover"
                      />
                    ) : null}
                    <div className="space-y-2 p-4">
                      <p className="font-semibold text-[#5c4720]">{copy.title}</p>
                      <p className="text-sm text-gray-700">{copy.description}</p>
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-[#8b6f2f]">
                          <img src={SHREWY_BADGE} alt="" aria-hidden="true" className="h-6 w-6" />
                          {fill(str.costTemplate, { cost: String(reward.cost) })}
                        </span>
                        {state === "unlocked" ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                            ✓ {str.unlockedBadge}
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={state !== "redeemable" || isRedeeming}
                            onClick={() => setConfirmReward(reward)}
                            className="btn-primary rounded-full border-2 px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
                          >
                            {state === "redeemable"
                              ? str.redeemButton
                              : fill(str.needMoreTemplate, { count: String(reward.cost - shrewyAvailable) })}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {openStamp && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpenStamp(null)}>
              <div
                role="dialog"
                aria-modal="true"
                aria-label={openStamp.award.giver === SHREWY_KEY ? str.stampDetailTitle : str.tokenDetailTitle}
                onClick={(event) => event.stopPropagation()}
                className="max-h-[85vh] w-full max-w-xs space-y-3 overflow-y-auto rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 text-sm shadow-xl"
              >
                {openCharacter?.tokenIconPath ? (
                  <img
                    src={openCharacter.tokenIconPath}
                    alt=""
                    aria-hidden="true"
                    className={"mx-auto h-28 w-28 -rotate-6 object-contain " + (openStamp.isUsed ? "opacity-35 grayscale" : "")}
                  />
                ) : null}
                {openContent ? (
                  <div className={poemFont.className + " rounded-xl border border-[#e8dcc0] bg-white/70 px-3 py-4 text-center text-[#4a3818]"}>
                    <p className="text-2xl">{openContent.title}</p>
                    <div className="mt-2 text-xl leading-9">
                      {splitPoemLines(openContent.body).map((poemLine, index) => (
                        <p key={index}>{poemLine}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
                <dl className="space-y-1.5 text-[#5c4720]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">{str.stampEarnedLabel}</dt>
                    <dd className="font-semibold">{formatDate(openStamp.award.earnedAt, locale)}</dd>
                  </div>
                  {openStamp.award.source === "cafe_sale" ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">{str.tokenOrderLabel}</dt>
                      <dd className="text-right font-semibold">
                        {openStamp.award.cafeItems
                          .map((item) => orderDishTitle(item.recipeId, item.specialIngredientKeys) + " × " + item.quantity)
                          .join(", ") || str.stampUnknownRecipe}
                      </dd>
                    </div>
                  ) : (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">{str.stampRecipeLabel}</dt>
                      <dd className="text-right font-semibold">
                        {(openStamp.award.recipeId && recipeTitleById.get(openStamp.award.recipeId)) || str.stampUnknownRecipe}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">{str.stampFromLabel}</dt>
                    <dd className="font-semibold">{nameOf(openStamp.award.giver)}</dd>
                  </div>
                </dl>
                <p className={"text-center font-semibold " + (openStamp.isUsed ? "text-gray-500" : "text-emerald-700")}>
                  {openStamp.isUsed ? str.stampStatusUsed : str.stampStatusAvailable}
                </p>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setOpenStamp(null)}
                  className="btn-nav w-full rounded-full border-2 px-4 py-2 font-semibold"
                >
                  {str.closeButton}
                </button>
              </div>
            </div>,
            document.body
          )
        : null}

      {confirmReward && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-label={str.confirmTitle}
                className="w-full max-w-sm space-y-4 rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 shadow-xl"
              >
                <h3 className="text-lg font-semibold text-[#5c4720]">{str.confirmTitle}</h3>
                <p className="text-sm text-gray-700">
                  {fill(str.confirmBodyTemplate, {
                    cost: String(confirmReward.cost),
                    title: rewardCopy(str, confirmReward.rewardKey).title,
                  })}
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    disabled={isRedeeming}
                    onClick={() => setConfirmReward(null)}
                    className="btn-neutral rounded-full border-2 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {str.cancelButton}
                  </button>
                  <button
                    type="button"
                    disabled={isRedeeming}
                    onClick={() => void handleRedeem(confirmReward)}
                    className="btn-primary rounded-full border-2 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {isRedeeming ? str.redeeming : str.confirmButton}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {signReward && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
              <form
                role="dialog"
                aria-modal="true"
                aria-label={str.wishlistConfirmTitle}
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleWishlistRedeem(signReward);
                }}
                className="w-full max-w-sm space-y-3 rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 shadow-xl"
              >
                <h3 className="text-lg font-semibold text-[#5c4720]">{str.wishlistConfirmTitle}</h3>
                {signReward.imagePath && photoUrls[signReward.imagePath] ? (
                  <img
                    src={photoUrls[signReward.imagePath]}
                    alt={fill(str.wishlistPhotoAltTemplate, { title: signReward.title })}
                    className="mx-auto max-h-40 rounded-xl object-contain"
                  />
                ) : null}
                <p className="text-sm text-gray-700">
                  {fill(str.wishlistConfirmBodyTemplate, { price: priceText(signReward.prices), title: signReward.title })}
                </p>
                <label className="block text-sm font-medium text-gray-700">
                  {str.childSignatureLabel}
                  <input
                    autoFocus
                    value={childSignature}
                    maxLength={WISHLIST_SIGNATURE_MAX}
                    placeholder={str.signaturePlaceholder}
                    onChange={(event) => setChildSignature(event.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 italic"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  {str.parentSignatureLabel}
                  <input
                    value={parentSignature}
                    maxLength={WISHLIST_SIGNATURE_MAX}
                    placeholder={str.signaturePlaceholder}
                    onChange={(event) => setParentSignature(event.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 italic"
                  />
                </label>
                {signError ? <p className="text-sm text-red-700">{signError}</p> : null}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    disabled={isRedeeming}
                    onClick={() => setSignReward(null)}
                    className="btn-neutral rounded-full border-2 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {str.cancelButton}
                  </button>
                  <button
                    type="submit"
                    disabled={isRedeeming}
                    className="btn-primary rounded-full border-2 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {isRedeeming ? str.redeeming : str.wishlistSignButton}
                  </button>
                </div>
              </form>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
