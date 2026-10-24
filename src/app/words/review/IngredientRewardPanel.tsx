"use client";

import { useEffect, useState } from "react";
import type {
  ClaimSessionOfferResult,
  RewardedIngredient,
  SessionIngredientReward,
  SessionRewardOffer,
} from "@/lib/shop.types";
import { resolveShopLocalizedString } from "@/lib/shop";
import { listShopRecipes } from "@/lib/supabase-service";
import { buildUnlockedRecipeTitles, isMysteryReward } from "@/lib/mysteryFoodUi";
import { toggleRewardSelection } from "@/lib/rewardTiers";
import { useLocale } from "@/app/shared/locale";
import { buildRewardHeadline } from "./reviewSession.utils";

export type IngredientRewardPanelStrings = {
  eyebrow: string;
  headlineSingular: string;
  headlinePlural: string;
  subtext: string;
  continueButton: string;
  winEyebrow: string;
  winHeadlineSingular: string;
  winHeadlinePlural: string;
  winSubtext: string;
  mysteryBadge: string;
  quantityTimes: string;
  unlockedEyebrow: string;
  unlockedHeadline: string;
  unlockedSubtext: string;
  pickEyebrow: string;
  pickHeadline: string;
  pickSubtext: string;
  pickCounter: string;
  claimButton: string;
  claimingButton: string;
  skipButton: string;
  claimError: string;
  claimAlready: string;
  pendingTitle: string;
  pendingOpen: string;
};

type PanelStatus = "picking" | "claiming" | "claimed";

function fillTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [token, value]) => text.replaceAll(`{${token}}`, String(value)),
    template
  );
}

/**
 * Ingredient-reward panel shown when a finished packaged review test session has a
 * reward OFFER (roadmap item P). Two steps:
 *   1. pick -- the child chooses `offer.picksAllowed` of the offered ingredients
 *      (1 / 2 / 3 by Tested Count); a clean session offers mystery ingredients;
 *   2. claimed -- shows exactly what was granted, plus an unlock banner when the pick
 *      just completed a mystery food's set.
 * The child may also "decide later": the offer stays pending on Due Review.
 *
 * Originally built for the paragraph quiz (spec 2026-08-22-paragraph-quiz-ingredient-reward.md)
 * and shared with the character/phrase fill-test completion; the claim call itself is
 * passed in by the caller so this component stays presentational.
 */
export default function IngredientRewardPanel({
  offer,
  strings,
  onClaim,
  onContinue,
}: {
  offer: SessionRewardOffer;
  strings: IngredientRewardPanelStrings;
  onClaim: (ingredientKeys: string[]) => Promise<ClaimSessionOfferResult>;
  onContinue: () => void;
}) {
  const locale = useLocale();
  const [status, setStatus] = useState<PanelStatus>("picking");
  const [selected, setSelected] = useState<string[]>([]);
  const [granted, setGranted] = useState<SessionIngredientReward | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [unlockedTitles, setUnlockedTitles] = useState<string[]>([]);

  const unlockedKey = granted ? granted.unlockedRecipeIds.join("|") : "";
  useEffect(() => {
    // Nothing to look up until a claim has unlocked something.
    if (unlockedKey === "") {
      return;
    }
    let cancelled = false;
    void listShopRecipes()
      .then((recipes) => {
        if (!cancelled) {
          setUnlockedTitles(buildUnlockedRecipeTitles(recipes, unlockedKey.split("|"), locale));
        }
      })
      .catch((error) => {
        // The banner just falls back to a generic line; never block the reward screen.
        console.error("Failed to load unlocked mystery food titles:", error);
      });
    return () => {
      cancelled = true;
    };
  }, [unlockedKey, locale]);

  const isMystery = isMysteryReward(offer.offers);
  const canClaim = selected.length === offer.picksAllowed && status === "picking";

  async function handleClaim() {
    if (!canClaim) return;
    setStatus("claiming");
    setErrorText(null);
    try {
      const result = await onClaim(selected);
      if (result.success) {
        setGranted({
          isWin: result.isWin,
          ingredients: result.ingredients,
          unlockedRecipeIds: result.unlockedRecipeIds,
        });
        setStatus("claimed");
        return;
      }
      setErrorText(result.code === "already_claimed" ? strings.claimAlready : strings.claimError);
    } catch (error) {
      console.error("Failed to claim ingredient reward:", error);
      setErrorText(strings.claimError);
    }
    setStatus("picking");
  }

  const panelClassName = isMystery
    ? "relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl border-2 border-purple-300 bg-gradient-to-b from-indigo-50 to-purple-50 p-8 shadow-[0_18px_38px_rgba(126,34,206,0.16)]"
    : "relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl border-2 border-[#dcc38a] bg-[linear-gradient(180deg,rgba(255,252,244,0.98),rgba(249,242,224,0.98))] p-8 shadow-[0_18px_38px_rgba(166,128,42,0.14)]";
  const eyebrowClassName = isMystery
    ? "text-xs font-bold uppercase tracking-wide text-purple-700"
    : "text-xs font-bold uppercase tracking-wide text-[#8b6f2f]";

  function renderCard(ingredient: RewardedIngredient, index: number, options?: { selectable: boolean }) {
    const label = resolveShopLocalizedString(
      ingredient.labelI18n ?? { en: ingredient.ingredientKey, zh: ingredient.ingredientKey },
      locale,
      ingredient.ingredientKey
    );
    const quantity = ingredient.quantity ?? 1;
    const isSelected = selected.includes(ingredient.ingredientKey);
    const baseClassName = ingredient.isMystery
      ? "relative flex flex-col items-center gap-2 rounded-2xl border bg-white p-3 shadow-[0_8px_18px_rgba(126,34,206,0.1)]"
      : "relative flex flex-col items-center gap-2 rounded-2xl border bg-white p-3 shadow-[0_8px_18px_rgba(166,128,42,0.08)]";
    const borderClassName = options?.selectable
      ? isSelected
        ? "border-4 border-emerald-500"
        : ingredient.isMystery
          ? "border-purple-200"
          : "border-[#eadfbe]"
      : ingredient.isMystery
        ? "border-purple-200"
        : "border-[#eadfbe]";

    const content = (
      <>
        {ingredient.isMystery ? (
          <span className="absolute -top-2 left-2 rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {strings.mysteryBadge}
          </span>
        ) : null}
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[#eadfbe] bg-[#fff8ea] p-2">
          {ingredient.iconPath ? (
            <img src={ingredient.iconPath} alt={label} className="h-full w-full object-contain" />
          ) : (
            <span className="text-center text-[10px] font-semibold text-[#9a8f79]">{label}</span>
          )}
        </div>
        <span className="text-center text-sm font-bold text-gray-900">{label}</span>
        {ingredient.isMystery ? (
          <span className="text-sm font-bold text-purple-700">
            {fillTemplate(strings.quantityTimes, { quantity })}
          </span>
        ) : null}
      </>
    );

    if (options?.selectable) {
      return (
        <button
          key={`${ingredient.ingredientKey}-${index}`}
          type="button"
          aria-pressed={isSelected}
          disabled={status === "claiming"}
          onClick={() =>
            setSelected((current) => toggleRewardSelection(current, ingredient.ingredientKey, offer.picksAllowed))
          }
          className={`${baseClassName} ${borderClassName} transition hover:shadow-md disabled:opacity-60`}
        >
          {content}
        </button>
      );
    }
    return (
      <div key={`${ingredient.ingredientKey}-${index}`} className={`${baseClassName} ${borderClassName}`}>
        {content}
      </div>
    );
  }

  if (status === "claimed" && granted) {
    const grantedIsMystery = isMysteryReward(granted.ingredients);
    const headline = buildRewardHeadline(
      granted.ingredients.length,
      grantedIsMystery
        ? { headlineSingular: strings.winHeadlineSingular, headlinePlural: strings.winHeadlinePlural }
        : strings
    );
    return (
      <div className={panelClassName}>
        <div className="text-center">
          <p className={eyebrowClassName}>{grantedIsMystery ? strings.winEyebrow : strings.eyebrow}</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#24423a]">{headline}</h1>
          <p className="mt-1 text-sm text-[#6b5a3a]">{grantedIsMystery ? strings.winSubtext : strings.subtext}</p>
        </div>

        <div className="grid w-full max-w-lg grid-cols-3 gap-4">
          {granted.ingredients.map((ingredient, index) => renderCard(ingredient, index))}
        </div>

        {granted.unlockedRecipeIds.length > 0 ? (
          <div className="w-full max-w-lg rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-indigo-950 to-purple-950 p-4 text-center text-amber-50 shadow-[0_0_18px_rgba(253,224,71,0.35)]">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-300">{strings.unlockedEyebrow}</p>
            {unlockedTitles.length > 0 ? (
              <p className="mt-1 text-lg font-extrabold">
                {strings.unlockedHeadline.replace("{title}", unlockedTitles.join(" / "))}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-amber-100">{strings.unlockedSubtext}</p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onContinue}
          className="btn-primary rounded-full border-2 px-8 py-3 text-base font-bold"
        >
          {strings.continueButton}
        </button>
      </div>
    );
  }

  return (
    <div className={panelClassName}>
      <div className="text-center">
        <p className={eyebrowClassName}>{offer.isWin ? strings.winEyebrow : strings.pickEyebrow}</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#24423a]">
          {fillTemplate(strings.pickHeadline, { picks: offer.picksAllowed, total: offer.offers.length })}
        </h1>
        <p className="mt-1 text-sm text-[#6b5a3a]">{strings.pickSubtext}</p>
      </div>

      <div className="grid w-full max-w-lg grid-cols-3 gap-4">
        {offer.offers.map((ingredient, index) => renderCard(ingredient, index, { selectable: true }))}
      </div>

      <p className="text-sm font-semibold text-[#6b5a3a]" aria-live="polite">
        {fillTemplate(strings.pickCounter, { selected: selected.length, picks: offer.picksAllowed })}
      </p>

      {errorText ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {errorText}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => void handleClaim()}
          disabled={!canClaim}
          className="btn-primary rounded-full border-2 px-8 py-3 text-base font-bold disabled:opacity-50"
        >
          {status === "claiming" ? strings.claimingButton : strings.claimButton}
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={status === "claiming"}
          className="btn-neutral rounded-full border-2 px-6 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {strings.skipButton}
        </button>
      </div>
    </div>
  );
}
