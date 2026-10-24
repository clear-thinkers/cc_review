"use client";

import { createPortal } from "react-dom";
import {
  getShopRecipeContentForLocale,
  resolveShopIngredientIconPath,
  resolveShopLocalizedString,
} from "@/lib/shop";
import type { MysteryFoodProgress } from "@/lib/mysteryFood.types";
import type { ShopIngredientPrice, ShopLocale, ShopRecipe } from "@/lib/shop.types";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";

type ShopStrings = WordsWorkspaceVM["str"]["shop"];

/*
 * Locked mystery foods deliberately leave the shop's gold/cream skin for a
 * jewel-toned "vault" look (indigo/plum with amber glow) so they read as special,
 * not disabled -- owner direction 2026-10-24 (docs/feature-specs/2026-10-24-mystery-foods.md).
 * Arbitrary shadow/text-shadow values below exist only for that glow; there is no
 * Tailwind utility for a coloured text glow.
 */

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [token, value]) => text.replaceAll(`{${token}}`, String(value)),
    template
  );
}

/** One filled/empty segment per ingredient type -- avoids a dynamic-width style attribute. */
function ProgressSegments({ progress, label }: { progress: MysteryFoodProgress; label: string }) {
  return (
    <div className="flex gap-1" role="img" aria-label={label}>
      {Array.from({ length: progress.totalTypes }, (_, index) => (
        <div
          key={index}
          className={
            index < progress.satisfiedTypes
              ? "h-2 flex-1 rounded-full bg-amber-300 shadow-[0_0_6px_rgba(253,224,71,0.8)]"
              : "h-2 flex-1 rounded-full bg-purple-950 ring-1 ring-inset ring-purple-700"
          }
        />
      ))}
    </div>
  );
}

export function MysteryFoodTile({
  recipe,
  iconPath,
  progress,
  locale,
  strings,
  onOpen,
}: {
  recipe: ShopRecipe;
  iconPath: string | null;
  progress: MysteryFoodProgress;
  locale: ShopLocale;
  strings: ShopStrings;
  onOpen: () => void;
}) {
  const m = strings.mystery;
  const teaser = recipe.teaserI18n
    ? resolveShopLocalizedString(recipe.teaserI18n, locale, "")
    : "";
  const values = { have: progress.satisfiedTypes, total: progress.totalTypes };

  return (
    <article
      className="flex h-full min-h-[250px] flex-col gap-4 rounded-[1.75rem] border-2 border-amber-300/70 bg-gradient-to-b from-indigo-950 via-indigo-900 to-purple-950 p-5 text-amber-50 shadow-[0_0_18px_rgba(253,224,71,0.35)]"
      aria-label={formatTemplate(m.tileAria, values)}
    >
      <div className="relative flex min-h-[138px] items-center justify-center overflow-hidden rounded-[1.4rem] border border-amber-300/40 bg-[radial-gradient(circle_at_50%_40%,rgba(126,34,206,0.55),rgba(30,27,75,0.95))] p-4">
        <span aria-hidden="true" className="absolute left-4 top-3 animate-pulse text-sm text-amber-200">✦</span>
        <span aria-hidden="true" className="absolute right-6 top-6 animate-pulse text-xs text-amber-100">✦</span>
        <span aria-hidden="true" className="absolute bottom-4 left-8 animate-pulse text-xs text-amber-100">✦</span>
        <span aria-hidden="true" className="absolute bottom-3 right-4 animate-pulse text-sm text-amber-200">✦</span>
        {iconPath ? (
          <img
            src={iconPath}
            alt=""
            className="relative z-[1] h-28 w-28 object-contain opacity-90 brightness-0 drop-shadow-[0_0_14px_rgba(253,224,71,0.9)] sm:h-32 sm:w-32"
          />
        ) : null}
        <span
          aria-hidden="true"
          className="absolute z-[2] text-6xl font-extrabold text-amber-300 [text-shadow:0_0_12px_rgba(245,158,11,0.9)]"
        >
          ?
        </span>
      </div>

      <p className="text-xs uppercase tracking-[0.18em] text-amber-300">{m.tileLabel}</p>
      <p className="text-base font-semibold italic leading-snug text-amber-50">{teaser || m.teaserFallback}</p>

      <div className="mt-auto space-y-2">
        <ProgressSegments progress={progress} label={formatTemplate(m.progressAria, values)} />
        <p className="text-sm font-semibold text-amber-200">{formatTemplate(m.progress, values)}</p>
        <button
          type="button"
          className="w-full rounded-md border-2 border-amber-300 bg-indigo-800/70 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-indigo-700/80"
          onClick={onOpen}
        >
          {strings.showIngredients}
        </button>
      </div>
    </article>
  );
}

/**
 * Detail view for a LOCKED mystery food: secret-ingredient progress only. It
 * never shows the food's name or intro (the teaser stands in), has no unlock
 * button (it unlocks itself), and no Buy controls (mystery ingredients are never
 * for sale).
 */
export function MysteryRecipeModal({
  recipe,
  ingredientRecordsByKey,
  availability,
  progress,
  locale,
  strings,
  onClose,
}: {
  recipe: ShopRecipe;
  ingredientRecordsByKey: ReadonlyMap<string, ShopIngredientPrice>;
  availability: ReadonlyMap<string, number>;
  progress: MysteryFoodProgress;
  locale: ShopLocale;
  strings: ShopStrings;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  const m = strings.mystery;
  const ingredients = getShopRecipeContentForLocale(recipe, locale).baseIngredients;
  const teaser = recipe.teaserI18n ? resolveShopLocalizedString(recipe.teaserI18n, locale, "") : "";
  const values = { have: progress.satisfiedTypes, total: progress.totalTypes };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center">
        <div
          className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border-2 border-amber-300/70 bg-gradient-to-b from-indigo-950 to-purple-950 p-5 text-amber-50 shadow-[0_0_28px_rgba(253,224,71,0.35)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shop-mystery-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="shop-mystery-title" className="text-xl font-semibold text-amber-200">
                {m.tileLabel}
              </h2>
              <p className="mt-1 text-sm italic text-amber-50">{teaser || m.teaserFallback}</p>
            </div>
            <button
              type="button"
              className="rounded-md border-2 border-amber-300 bg-indigo-800/70 px-4 py-2 text-sm font-medium text-amber-100"
              onClick={onClose}
            >
              {strings.modal.close}
            </button>
          </div>

          <div className="mt-4 space-y-2">
            <ProgressSegments progress={progress} label={formatTemplate(m.progressAria, values)} />
            <p className="text-sm font-semibold text-amber-200">{formatTemplate(m.progress, values)}</p>
            <p className="text-xs text-amber-100/80">{m.lockedHint}</p>
          </div>

          <div className="mt-4 space-y-2 rounded-lg border border-amber-300/40 bg-indigo-900/50 p-4">
            <h3 className="text-lg font-semibold text-amber-200">{m.modalHeading}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {ingredients.map((ingredient, index) => {
                const key = ingredient.ingredientKey ?? "";
                const have = Math.max(availability.get(key) ?? 0, 0);
                const isComplete = have >= ingredient.quantity;
                const iconPath = resolveShopIngredientIconPath(ingredient, ingredientRecordsByKey);
                return (
                  <div
                    key={`${recipe.id}-${key || index}`}
                    className={
                      isComplete
                        ? "flex items-center gap-3 rounded-xl border-2 border-amber-300 bg-indigo-800/60 p-3"
                        : "flex items-center gap-3 rounded-xl border border-purple-700 bg-purple-950/60 p-3"
                    }
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-amber-200/40 bg-[#fff8ea] p-1.5">
                      {iconPath ? (
                        <img
                          src={iconPath}
                          alt={ingredient.name}
                          className={isComplete ? "h-full w-full object-contain" : "h-full w-full object-contain opacity-50 grayscale"}
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold leading-tight text-amber-50">{ingredient.name}</div>
                      <div className={isComplete ? "text-sm font-medium text-amber-300" : "text-sm text-purple-200"}>
                        {formatTemplate(m.ingredientHave, { have: Math.min(have, 99), need: ingredient.quantity })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="pt-1 text-xs text-amber-100/80">{m.ingredientNotForSale}</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
