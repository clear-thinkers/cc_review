"use client";

import type { RewardedIngredient } from "@/lib/shop.types";
import { resolveShopLocalizedString } from "@/lib/shop";
import { useLocale } from "@/app/shared/locale";
import { buildRewardHeadline } from "./reviewSession.utils";

export type IngredientRewardPanelStrings = {
  eyebrow: string;
  headlineSingular: string;
  headlinePlural: string;
  subtext: string;
  continueButton: string;
};

/**
 * Ingredient-reward panel shown on completion of any packaged review test
 * session (character, phrase, mixed, or paragraph-quiz alike) that earned at
 * least one ingredient via `rewardRandomIngredients`. Originally built only
 * for ParagraphQuizReviewSection.tsx (feature spec
 * 2026-08-22-paragraph-quiz-ingredient-reward.md); extracted here so
 * FillTestReviewSection.tsx's packaged-session completion can reuse the same
 * visuals/strings instead of duplicating them.
 */
export default function IngredientRewardPanel({
  ingredients,
  strings,
  onContinue,
}: {
  ingredients: RewardedIngredient[];
  strings: IngredientRewardPanelStrings;
  onContinue: () => void;
}) {
  const locale = useLocale();
  const headline = buildRewardHeadline(ingredients.length, strings);

  return (
    <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl border-2 border-[#dcc38a] bg-[linear-gradient(180deg,rgba(255,252,244,0.98),rgba(249,242,224,0.98))] p-8 shadow-[0_18px_38px_rgba(166,128,42,0.14)]">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-[#8b6f2f]">{strings.eyebrow}</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#24423a]">{headline}</h1>
        <p className="mt-1 text-sm text-[#6b5a3a]">{strings.subtext}</p>
      </div>

      <div className="grid w-full max-w-lg grid-cols-3 gap-4">
        {ingredients.map((ingredient, index) => {
          const label = resolveShopLocalizedString(
            ingredient.labelI18n ?? { en: ingredient.ingredientKey, zh: ingredient.ingredientKey },
            locale,
            ingredient.ingredientKey
          );
          return (
            <div
              key={`${ingredient.ingredientKey}-${index}`}
              className="flex flex-col items-center gap-2 rounded-2xl border border-[#eadfbe] bg-white p-3 shadow-[0_8px_18px_rgba(166,128,42,0.08)]"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[#eadfbe] bg-[#fff8ea] p-2">
                {ingredient.iconPath ? (
                  <img src={ingredient.iconPath} alt={label} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-center text-[10px] font-semibold text-[#9a8f79]">{label}</span>
                )}
              </div>
              <span className="text-center text-sm font-bold text-gray-900">{label}</span>
            </div>
          );
        })}
      </div>

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
