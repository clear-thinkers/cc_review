"use client";

import { useEffect, useState } from "react";
import type { SessionIngredientReward } from "@/lib/shop.types";
import { resolveShopLocalizedString } from "@/lib/shop";
import { listShopRecipes } from "@/lib/supabase-service";
import { buildUnlockedRecipeTitles, isMysteryReward } from "@/lib/mysteryFoodUi";
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
};

/**
 * Ingredient-reward panel shown on completion of any packaged review test
 * session (character, phrase, mixed, or paragraph-quiz alike) that earned at
 * least one ingredient via `rewardSessionIngredients`. Originally built only
 * for ParagraphQuizReviewSection.tsx (feature spec
 * 2026-08-22-paragraph-quiz-ingredient-reward.md); extracted here so
 * FillTestReviewSection.tsx's packaged-session completion can reuse the same
 * visuals/strings instead of duplicating them.
 *
 * A win session (roadmap items L/M/N, 2026-10-24) shows mystery ingredients with
 * their per-food quantity and, when the reward just completed a mystery food's
 * set, an "unlocked" banner naming the food.
 */
export default function IngredientRewardPanel({
  reward,
  strings,
  onContinue,
}: {
  reward: SessionIngredientReward;
  strings: IngredientRewardPanelStrings;
  onContinue: () => void;
}) {
  const locale = useLocale();
  const { ingredients, unlockedRecipeIds } = reward;
  const isMystery = isMysteryReward(ingredients);
  const [unlockedTitles, setUnlockedTitles] = useState<string[]>([]);

  const unlockedKey = unlockedRecipeIds.join("|");
  useEffect(() => {
    // The panel mounts fresh for each reward, so there is nothing to reset when no food unlocked.
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

  const headline = isMystery
    ? buildRewardHeadline(ingredients.length, {
        headlineSingular: strings.winHeadlineSingular,
        headlinePlural: strings.winHeadlinePlural,
      })
    : buildRewardHeadline(ingredients.length, strings);
  const eyebrow = isMystery ? strings.winEyebrow : strings.eyebrow;
  const subtext = isMystery ? strings.winSubtext : strings.subtext;

  const panelClassName = isMystery
    ? "relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl border-2 border-purple-300 bg-gradient-to-b from-indigo-50 to-purple-50 p-8 shadow-[0_18px_38px_rgba(126,34,206,0.16)]"
    : "relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl border-2 border-[#dcc38a] bg-[linear-gradient(180deg,rgba(255,252,244,0.98),rgba(249,242,224,0.98))] p-8 shadow-[0_18px_38px_rgba(166,128,42,0.14)]";

  return (
    <div className={panelClassName}>
      <div className="text-center">
        <p className={isMystery ? "text-xs font-bold uppercase tracking-wide text-purple-700" : "text-xs font-bold uppercase tracking-wide text-[#8b6f2f]"}>
          {eyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#24423a]">{headline}</h1>
        <p className="mt-1 text-sm text-[#6b5a3a]">{subtext}</p>
      </div>

      <div className="grid w-full max-w-lg grid-cols-3 gap-4">
        {ingredients.map((ingredient, index) => {
          const label = resolveShopLocalizedString(
            ingredient.labelI18n ?? { en: ingredient.ingredientKey, zh: ingredient.ingredientKey },
            locale,
            ingredient.ingredientKey
          );
          const quantity = ingredient.quantity ?? 1;
          return (
            <div
              key={`${ingredient.ingredientKey}-${index}`}
              className={
                ingredient.isMystery
                  ? "relative flex flex-col items-center gap-2 rounded-2xl border border-purple-200 bg-white p-3 shadow-[0_8px_18px_rgba(126,34,206,0.1)]"
                  : "relative flex flex-col items-center gap-2 rounded-2xl border border-[#eadfbe] bg-white p-3 shadow-[0_8px_18px_rgba(166,128,42,0.08)]"
              }
            >
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
                  {strings.quantityTimes.replace("{quantity}", String(quantity))}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {unlockedRecipeIds.length > 0 ? (
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
