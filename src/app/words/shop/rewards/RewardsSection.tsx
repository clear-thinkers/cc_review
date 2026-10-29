"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/app/shared/locale";
import { getShopRecipeContentForLocale } from "@/lib/shop";
import type { ShopRecipe } from "@/lib/shop.types";
import {
  buildPawPrintStamps,
  computePawPrintBalance,
  resolveRewardCardState,
} from "@/lib/pawPrints";
import type { PawPrintAward, PawPrintRedemption, PawPrintReward, PawPrintStamp } from "@/lib/pawPrints.types";
import {
  listPawPrintAwards,
  listPawPrintRedemptions,
  listPawPrintRewards,
  listShopRecipes,
  redeemPawPrintReward,
} from "@/lib/supabase-service";
import type { WordsWorkspaceVM } from "../../shared/WordsWorkspaceVM";
import { rewardsStrings, type RewardsLocaleStrings } from "./rewards.strings";

type LoadState = "loading" | "ready" | "error";

/** Stamp art per giver; only Shrewy gives paw prints today (spec decision 7c). */
const GIVER_ART = {
  shrewy: { stamp: "/paw-prints/shrewy_paw.png", badge: "/paw-prints/shrewy_paw_badge.png" },
} as const;

/** A still for each catalog reward's card. */
const REWARD_PREVIEW: Record<string, string> = {
  "shrewy-hand-wash": "/video/shrewy_hand_wash_poster.jpg",
};

function fill(template: string, tokens: Record<string, string>): string {
  return Object.entries(tokens).reduce((text, [key, value]) => text.split(`{${key}}`).join(value), template);
}

function formatDate(timestamp: number, locale: "en" | "zh"): string {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium" }).format(timestamp);
}

function rewardCopy(strings: RewardsLocaleStrings, rewardKey: string): { title: string; description: string } {
  const catalog = strings.catalog as Record<string, { title: string; description: string } | undefined>;
  return catalog[rewardKey] ?? { title: rewardKey, description: "" };
}

/**
 * The Rewards page (/words/shop/rewards, roadmap item T; spec section B). Child +
 * platform admin only. Shows Chef Shrewy's paw prints as a stamp sheet -- every print
 * ever earned, the oldest spent ones shown as used -- and his rewards to redeem. All
 * spending goes through redeem_paw_print_reward; prices come from the server catalog.
 */
export default function RewardsSection({ vm }: { vm: WordsWorkspaceVM }) {
  const locale = useLocale();
  const str = rewardsStrings[locale];
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [awards, setAwards] = useState<PawPrintAward[]>([]);
  const [redemptions, setRedemptions] = useState<PawPrintRedemption[]>([]);
  const [rewards, setRewards] = useState<PawPrintReward[]>([]);
  const [recipes, setRecipes] = useState<ShopRecipe[]>([]);
  const [openStamp, setOpenStamp] = useState<PawPrintStamp | null>(null);
  const [confirmReward, setConfirmReward] = useState<PawPrintReward | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (vm.page !== "rewards") return;
    let isCancelled = false;
    Promise.all([listPawPrintAwards(), listPawPrintRedemptions(), listPawPrintRewards(), listShopRecipes()])
      .then(([awardRows, redemptionRows, rewardRows, recipeRows]) => {
        if (isCancelled) return;
        setAwards(awardRows);
        setRedemptions(redemptionRows);
        setRewards(rewardRows);
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

  const balance = useMemo(() => computePawPrintBalance(awards, redemptions, "shrewy"), [awards, redemptions]);
  const stamps = useMemo(() => buildPawPrintStamps(awards, redemptions, "shrewy"), [awards, redemptions]);
  const redeemedKeys = useMemo(() => new Set(redemptions.map((redemption) => redemption.rewardKey)), [redemptions]);
  const recipeTitleById = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, getShopRecipeContentForLocale(recipe, locale).title])),
    [recipes, locale]
  );
  const shrewyRewards = rewards.filter((reward) => reward.giver === "shrewy");

  if (vm.page !== "rewards") return null;

  async function handleRedeem(reward: PawPrintReward): Promise<void> {
    setIsRedeeming(true);
    setNotice(null);
    try {
      const result = await redeemPawPrintReward(reward.rewardKey);
      if (!result.success) {
        setNotice({ tone: "error", text: str.redeemErrors[result.code] });
        return;
      }
      setRedemptions(await listPawPrintRedemptions());
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
          {/* The paper stamp sheet */}
          <div className="rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 shadow-[0_16px_34px_rgba(115,92,40,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold text-[#6a5530]">
                  {str.collectionHeading}
                  <img src={GIVER_ART.shrewy.badge} alt="" aria-hidden="true" draggable={false} className="h-7 w-7 select-none" />
                </h3>
              </div>
              <div className="flex gap-3 text-sm">
                <span className="rounded-full border border-[#dcc38a] bg-white px-4 py-2 font-semibold text-[#8b6f2f]">
                  {str.collectedLabel}: {balance.collected}
                </span>
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 font-semibold text-emerald-800">
                  {str.availableLabel}: {balance.available}
                </span>
              </div>
            </div>

            {stamps.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-[#e8dcc0] bg-white/60 px-4 py-6 text-center text-sm text-[#8b6f2f]">
                {str.emptySheet}
              </p>
            ) : (
              <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5 xl:grid-cols-6">
                {stamps.map((stamp) => (
                  <button
                    key={stamp.award.id}
                    type="button"
                    onClick={() => setOpenStamp(stamp)}
                    aria-label={fill(str.stampAriaTemplate, { date: formatDate(stamp.award.earnedAt, locale) })}
                    className="relative flex aspect-square items-center justify-center rounded-xl border border-dashed border-[#e8dcc0] bg-white/70 p-2 transition hover:bg-[#fff6e3]"
                  >
                    <img
                      src={GIVER_ART[stamp.award.giver].stamp}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      className={`h-full w-full -rotate-6 select-none object-contain ${stamp.isUsed ? "opacity-35 grayscale" : ""}`}
                    />
                    {stamp.isUsed ? (
                      <span className="absolute bottom-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                        {str.usedBadge}
                      </span>
                    ) : null}
                  </button>
                ))}
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
                  available: balance.available,
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
                          <img src={GIVER_ART.shrewy.badge} alt="" aria-hidden="true" className="h-6 w-6" />
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
                              : fill(str.needMoreTemplate, { count: String(reward.cost - balance.available) })}
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
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpenStamp(null)}>
              <div
                role="dialog"
                aria-modal="true"
                aria-label={str.stampDetailTitle}
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-xs space-y-3 rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 text-sm shadow-xl"
              >
                <img
                  src={GIVER_ART[openStamp.award.giver].stamp}
                  alt=""
                  aria-hidden="true"
                  className={`mx-auto h-28 w-28 -rotate-6 ${openStamp.isUsed ? "opacity-35 grayscale" : ""}`}
                />
                <dl className="space-y-1.5 text-[#5c4720]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">{str.stampEarnedLabel}</dt>
                    <dd className="font-semibold">{formatDate(openStamp.award.earnedAt, locale)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">{str.stampRecipeLabel}</dt>
                    <dd className="text-right font-semibold">
                      {(openStamp.award.recipeId && recipeTitleById.get(openStamp.award.recipeId)) ||
                        str.stampUnknownRecipe}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">{str.stampFromLabel}</dt>
                    <dd className="font-semibold">{str.giverNames[openStamp.award.giver]}</dd>
                  </div>
                </dl>
                <p className={`text-center font-semibold ${openStamp.isUsed ? "text-gray-500" : "text-emerald-700"}`}>
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
    </section>
  );
}
