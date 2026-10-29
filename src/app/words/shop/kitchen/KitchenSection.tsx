"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useLocale } from "@/app/shared/locale";
import { useSession } from "@/lib/authContext";
import type {
  ShopCookedDish,
  ShopFoodType,
  ShopIngredientLedgerEntry,
  ShopIngredientPrice,
  ShopRecipe,
  ShopRecipeUnlock,
} from "@/lib/shop.types";
import {
  buildShopIngredientAvailabilityMap,
  buildShopIngredientRecordMap,
  computeShopCookBaseRequirements,
  computeShopCookReadiness,
  getShopRecipeContentForLocale,
  resolveShopIngredientLabel,
} from "@/lib/shop";
import {
  cookShopRecipe,
  getChefChallenge,
  listChefChallengeRecipeIds,
  listPawPrintRedemptions,
  listShopCookedDishes,
  listShopIngredientConsumptions,
  listShopIngredientPrices,
  listShopIngredientPurchases,
  listShopIngredientRewards,
  listShopRecipeUnlocks,
  listShopRecipes,
  organizeShopKitchenCountertop,
} from "@/lib/supabase-service";
import { hasRedeemedReward, SHREWY_HAND_WASH_REWARD_KEY } from "@/lib/pawPrints";
import type { ChefChallenge } from "@/lib/pawPrints.types";
import type { WordsWorkspaceVM } from "../../shared/WordsWorkspaceVM";
import ChefChallengeModal from "./ChefChallengeModal";
import HandWashVideoModal from "./HandWashVideoModal";
import { kitchenStrings } from "./kitchen.strings";
import KitchenChef from "./KitchenChef";
import KitchenDishReveal from "./KitchenDishReveal";
import KitchenSceneEffects from "./KitchenSceneEffects";
import { kitchenChefStrings } from "./kitchenChef.strings";
import {
  buildShelfChefReactions,
  countShelfDishesByFoodType,
  findFavoriteRecipeId,
  findUnseenMysteryUnlocks,
  parseSeenUnlockIds,
  serializeSeenUnlockIds,
} from "./kitchenChef.utils";
import { useKitchenChef } from "./useKitchenChef";
import { useKitchenMusic } from "./useKitchenMusic";
import {
  buildCountertopTiles,
  buildShelfTilesByFoodType,
  countCountertopDishes,
  countShelfDishes,
  countTotalCookedDishes,
  KITCHEN_SCENE_COOK_MS,
  buildKitchenScenePrepRequirements,
  buildKitchenScenePrepTokens,
  isChefChallengePrepPhase,
  isKitchenScenePrepComplete,
  recipeOffersChefChallenge,
  resolveApplianceLabel,
  resolveAvailableSpecialIngredients,
  resolveKitchenScene,
  resolveRecipeDishIconPath,
  SHOP_FOOD_TYPES,
  SHOP_KITCHEN_COUNTERTOP_CAPACITY,
  shouldPlayHandWashVideo,
  type KitchenSceneLayout,
  type KitchenSpecialIngredientOption,
} from "./kitchen.types";

type LoadState = "idle" | "loading" | "ready" | "error";
type KitchenStrings = (typeof kitchenStrings)["en"];

// The btn-nav/btn-secondary/etc. semantic classes (globals.css) are scoped
// under .kids-page, but modal content here is rendered via createPortal
// straight onto document.body -- outside that ancestor -- so those classes
// silently apply no color at all. Portaled buttons use the same gold/cream
// palette as literal classes instead, matching ShopSection.tsx's existing
// modal-button precedent (its own portaled modals never use btn-nav either).
const NAV_BUTTON =
  "rounded-md border-2 border-[#dcc38a] bg-[#fcf8ef] px-4 py-2 text-sm font-semibold text-[#6a5530] transition hover:bg-[#fff1cd]";

function replaceToken(template: string, token: string, value: string): string {
  return template.replace(token, value);
}

/**
 * One clickable region over the kitchen-scene illustration (see
 * resolveKitchenScene). Position is expressed as percentages of the
 * image's own box, tied to each artwork's fixed layout (the three
 * shelf-stock variants share one; a recipe's special scene has its own) -- there's no static
 * Tailwind class for "the top half of the appliance in this particular
 * picture," so inline style is the documented exception here
 * (BUILD_CONVENTIONS.md §7).
 */
function SceneHotspot({
  left,
  top,
  width,
  height,
  label,
  ariaLabel,
  onClick,
}: {
  left: string;
  top: string;
  width: string;
  height: string;
  label: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      className="group absolute rounded-xl outline-offset-2 transition hover:bg-white/25 focus-visible:bg-white/25"
      style={{ left, top, width, height }}
    >
      <span className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 rounded-full border border-[#dcc38a] bg-[#fffaf0]/95 px-2 py-0.5 text-[11px] font-bold text-[#6a5530] opacity-90 shadow-sm transition group-hover:opacity-100">
        {label}
      </span>
      <span className="absolute inset-0 rounded-xl ring-0 ring-[#d2b15b] transition group-hover:ring-2 group-focus-visible:ring-2" />
    </button>
  );
}

function FridgeModal({
  ingredients,
  ingredientRecordsByKey,
  availabilityByKey,
  locale,
  strings,
  onClose,
}: {
  ingredients: ShopIngredientPrice[];
  ingredientRecordsByKey: ReadonlyMap<string, ShopIngredientPrice>;
  availabilityByKey: ReadonlyMap<string, number>;
  locale: "en" | "zh";
  strings: KitchenStrings;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  const availableIngredients = ingredients.filter(
    (ingredient) => (availabilityByKey.get(ingredient.ingredientKey) ?? 0) > 0
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/35 p-4" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center">
        <div
          className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 shadow-[0_24px_60px_rgba(85,122,84,0.18)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kitchen-fridge-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="kitchen-fridge-title" className="text-xl font-semibold text-gray-900">
                {strings.fridgeModalTitle}
              </h2>
              <p className="mt-1 text-sm text-gray-600">{strings.fridgeModalDescription}</p>
            </div>
            <button
              type="button"
              className={NAV_BUTTON}
              onClick={onClose}
            >
              {strings.fridgeCloseButton}
            </button>
          </div>

          {availableIngredients.length === 0 ? (
            <p className="mt-4 text-sm italic text-gray-500">{strings.fridgeEmpty}</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {availableIngredients.map((ingredient) => {
                const record = ingredientRecordsByKey.get(ingredient.ingredientKey);
                const label = resolveShopIngredientLabel(record, locale, ingredient.ingredientKey);
                const iconPath = record?.iconPath ?? null;
                const available = availabilityByKey.get(ingredient.ingredientKey) ?? 0;
                return (
                  <div
                    key={ingredient.ingredientKey}
                    className={
                      record?.isMystery
                        ? "relative flex flex-col items-center gap-2 rounded-xl border border-purple-300 bg-white px-3 py-3 text-center shadow-[0_0_10px_rgba(126,34,206,0.18)]"
                        : "flex flex-col items-center gap-2 rounded-xl border border-[#eadfbe] bg-white px-3 py-3 text-center"
                    }
                  >
                    {record?.isMystery ? (
                      <span className="absolute -top-2 left-2 rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        {strings.fridgeMysteryBadge}
                      </span>
                    ) : null}
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#eadfbe] bg-[#fff8ea] p-1.5">
                      {iconPath ? (
                        <img src={iconPath} alt={label} className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-xs font-semibold text-[#9a8f79]">{label}</span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-gray-900">{label}</div>
                    <div className="text-sm font-semibold text-[#9f6027]">x{available}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function RecipeBookModal({
  recipes,
  unlockedRecipeIds,
  availabilityByKey,
  ingredientRecordsByKey,
  selectedRecipeId,
  onSelectRecipe,
  challengeRecipeIds,
  locale,
  strings,
  onClose,
}: {
  recipes: ShopRecipe[];
  unlockedRecipeIds: ReadonlySet<string>;
  /** Recipes with active chef-challenge questions (ids only). */
  challengeRecipeIds: ReadonlySet<string>;
  availabilityByKey: ReadonlyMap<string, number>;
  ingredientRecordsByKey: ReadonlyMap<string, ShopIngredientPrice>;
  selectedRecipeId: string | null;
  onSelectRecipe: (recipeId: string) => void;
  locale: "en" | "zh";
  strings: KitchenStrings;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/35 p-4" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center">
        <div
          className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 shadow-[0_24px_60px_rgba(85,122,84,0.18)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kitchen-book-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="kitchen-book-title" className="text-xl font-semibold text-gray-900">
                {strings.bookModalTitle}
              </h2>
              <p className="mt-1 text-sm text-gray-600">{strings.bookModalDescription}</p>
            </div>
            <button
              type="button"
              className={NAV_BUTTON}
              onClick={onClose}
            >
              {strings.bookCloseButton}
            </button>
          </div>

          {recipes.length === 0 ? (
            <p className="mt-4 text-sm italic text-gray-500">{strings.bookEmpty}</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {recipes.map((recipe) => {
                const localized = getShopRecipeContentForLocale(recipe, locale);
                const isUnlocked = unlockedRecipeIds.has(recipe.id);
                const readiness = computeShopCookReadiness(recipe, availabilityByKey);
                const isSelected = selectedRecipeId === recipe.id;
                const applianceLabel = recipe.cookMethod
                  ? resolveApplianceLabel(recipe.cookMethod, strings)
                  : null;

                if (!isUnlocked) {
                  return (
                    <div
                      key={recipe.id}
                      className="flex flex-col gap-2 rounded-xl border border-gray-300 bg-gray-50 p-3 text-left text-gray-500"
                    >
                      <div className="text-base font-semibold">{localized.title}</div>
                      <div className="text-xs uppercase tracking-wide">{strings.recipeLocked}</div>
                      <Link
                        href="/words/shop"
                        className="inline-block w-fit rounded-md border-2 border-[#dcc38a] bg-[#fcf8ef] px-3 py-1.5 text-xs font-semibold text-[#6a5530] transition hover:bg-[#fff1cd]"
                      >
                        {strings.recipeLockedLinkText}
                      </Link>
                    </div>
                  );
                }

                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => onSelectRecipe(recipe.id)}
                    className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? "border-[#d2b15b] bg-white shadow-[0_0_0_3px_rgba(210,177,91,0.35)]"
                        : "border-[#eadfbe] bg-white hover:border-[#d2b15b]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-semibold text-gray-900">{localized.title}</span>
                      <span className="flex items-center gap-1.5">
                        {recipeOffersChefChallenge(recipe, challengeRecipeIds) ? (
                          <img
                            src="/paw-prints/shrewy_paw_badge.png"
                            alt={strings.recipeHasChallenge}
                            title={strings.recipeHasChallenge}
                            draggable={false}
                            className="h-7 w-7 select-none"
                          />
                        ) : null}
                        <span className="rounded-full border border-[#dcc38a] bg-[#fcf8ef] px-2 py-0.5 text-[11px] font-semibold uppercase text-[#6a5530]">
                          {applianceLabel}
                        </span>
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {localized.baseIngredients
                        .map((ingredient) => {
                          const key = ingredient.ingredientKey ?? "";
                          const label = resolveShopIngredientLabel(ingredientRecordsByKey.get(key), locale, ingredient.name);
                          return `${label} x${ingredient.quantity}`;
                        })
                        .join(", ")}
                    </div>
                    {readiness.isReady ? (
                      <span className="text-xs font-semibold text-green-700">{strings.readyToCook}</span>
                    ) : (
                      <span className="text-xs font-semibold text-[#9f6027]">
                        {strings.missingIngredientsPrefix}{" "}
                        {readiness.missingIngredientKeys
                          .map((key) => resolveShopIngredientLabel(ingredientRecordsByKey.get(key), locale, key))
                          .join(", ")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function SpecialIngredientsModal({
  recipeTitle,
  options,
  selectedKeys,
  onToggle,
  ingredientRecordsByKey,
  locale,
  strings,
  onClose,
}: {
  recipeTitle: string;
  options: KitchenSpecialIngredientOption[];
  selectedKeys: string[];
  onToggle: (ingredientKey: string) => void;
  ingredientRecordsByKey: ReadonlyMap<string, ShopIngredientPrice>;
  locale: "en" | "zh";
  strings: KitchenStrings;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/35 p-4" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center">
        <div
          className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 shadow-[0_24px_60px_rgba(85,122,84,0.18)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kitchen-special-title"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 id="kitchen-special-title" className="text-xl font-semibold text-gray-900">
            {replaceToken(strings.specialModalTitleTemplate, "{title}", recipeTitle)}
          </h2>
          <p className="mt-1 text-sm text-gray-600">{strings.specialModalDescription}</p>

          {options.length === 0 ? (
            <p className="mt-4 text-sm italic text-gray-500">{strings.specialModalEmpty}</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {options.map((option) => {
                const record = ingredientRecordsByKey.get(option.ingredientKey);
                const label = resolveShopIngredientLabel(record, locale, option.ingredientKey);
                const iconPath = record?.iconPath ?? null;
                const isSelected = selectedKeys.includes(option.ingredientKey);
                return (
                  <button
                    key={option.ingredientKey}
                    type="button"
                    onClick={() => onToggle(option.ingredientKey)}
                    aria-pressed={isSelected}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-center transition ${
                      isSelected
                        ? "border-[#8b6f2f] bg-[#f7ead0] shadow-[0_3px_8px_rgba(139,111,47,0.25)]"
                        : "border-[#eadfbe] bg-white hover:border-[#d2b15b]"
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#eadfbe] bg-[#fff8ea] p-1">
                      {iconPath ? (
                        <img src={iconPath} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-xs font-semibold text-[#9a8f79]">{label}</span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-gray-800">{label}</span>
                    {isSelected ? (
                      <span className="text-[11px] font-semibold text-[#8b6f2f]">{strings.specialSelectedBadge}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          <button type="button" className={`${NAV_BUTTON} mt-5 w-full`} onClick={onClose}>
            {strings.specialDoneButton}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function DishTileGrid({
  tiles,
  emptyText,
  size = "sm",
  enlargeAriaTemplate,
  enlargeCloseLabel,
}: {
  tiles: { recipeId: string; iconPath: string | null; title: string; count: number }[];
  emptyText: string;
  size?: "sm" | "lg";
  enlargeAriaTemplate: string;
  enlargeCloseLabel: string;
}) {
  const [enlargedTile, setEnlargedTile] = useState<
    { recipeId: string; iconPath: string | null; title: string; count: number } | null
  >(null);

  if (tiles.length === 0) {
    return <p className="text-sm italic text-gray-500">{emptyText}</p>;
  }

  const iconBoxClass = size === "lg" ? "h-16 w-16" : "h-9 w-9";
  const fallbackEmojiClass = size === "lg" ? "text-5xl" : "text-2xl";
  const badgeClass =
    size === "lg"
      ? "absolute -right-2.5 -top-2.5 flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-[#d2b15b] px-1.5 text-sm font-bold text-white shadow-sm"
      : "absolute -right-2 -top-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#d2b15b] px-1 text-[11px] font-bold text-white";
  const nameClass =
    size === "lg"
      ? "max-w-[6.5rem] truncate text-center text-sm font-semibold text-gray-800"
      : "max-w-[4rem] truncate text-center text-[11px] font-medium text-gray-700";
  const tileGapClass = size === "lg" ? "gap-4" : "gap-3";
  const itemGapClass = size === "lg" ? "gap-2" : "gap-1";
  const itemPaddingClass = size === "lg" ? "px-3 py-2" : "px-2 py-1";

  return (
    <>
      <div className={`flex flex-wrap ${tileGapClass}`}>
        {tiles.map((tile) => (
          <button
            type="button"
            key={`${tile.recipeId}::${tile.iconPath ?? ""}`}
            title={`${tile.title} (x${tile.count})`}
            aria-label={replaceToken(enlargeAriaTemplate, "{title}", tile.title)}
            onClick={() => setEnlargedTile(tile)}
            className={`flex flex-col items-center ${itemGapClass} rounded-xl border border-[#eadfbe] bg-white ${itemPaddingClass} shadow-sm transition hover:border-[#dcc38a] hover:shadow-md`}
          >
            <span className="relative" aria-hidden="true">
              {tile.iconPath ? (
                <img src={tile.iconPath} alt="" className={`${iconBoxClass} object-contain`} />
              ) : (
                <span className={fallbackEmojiClass}>🍽️</span>
              )}
              {tile.count > 1 ? <span className={badgeClass}>{tile.count}</span> : null}
            </span>
            <span className={nameClass}>{tile.title}</span>
          </button>
        ))}
      </div>
      {enlargedTile ? (
        <DishEnlargeModal
          tile={enlargedTile}
          closeLabel={enlargeCloseLabel}
          onClose={() => setEnlargedTile(null)}
        />
      ) : null}
    </>
  );
}

function DishEnlargeModal({
  tile,
  closeLabel,
  onClose,
}: {
  tile: { recipeId: string; iconPath: string | null; title: string; count: number };
  closeLabel: string;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-black/45 p-4" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center">
        <div
          className="w-full max-w-xs rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-6 shadow-[0_24px_60px_rgba(85,122,84,0.18)]"
          role="dialog"
          aria-modal="true"
          aria-label={tile.title}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-col items-center gap-3">
            <span className="flex h-40 w-40 items-center justify-center" aria-hidden="true">
              {tile.iconPath ? (
                <img src={tile.iconPath} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className="text-8xl">🍽️</span>
              )}
            </span>
            <p className="text-center text-lg font-bold text-gray-900">{tile.title}</p>
            {tile.count > 1 ? (
              <p className="text-sm font-semibold text-[#9f6027]">×{tile.count}</p>
            ) : null}
            <button type="button" className={NAV_BUTTON} onClick={onClose}>
              {closeLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ShelfModal({
  tilesByFoodType,
  strings,
  onClose,
}: {
  tilesByFoodType: Record<
    ShopFoodType,
    { recipeId: string; iconPath: string | null; title: string; count: number }[]
  >;
  strings: KitchenStrings;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ShopFoodType>("drinks");
  if (typeof document === "undefined") return null;

  const tabLabel: Record<ShopFoodType, string> = {
    drinks: strings.tabDrinksLabel,
    hotmeal: strings.tabHotMealLabel,
    desserts: strings.tabDessertsLabel,
  };
  const tabEmoji: Record<ShopFoodType, string> = {
    drinks: "🥤",
    hotmeal: "🍲",
    desserts: "🍰",
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/35 p-4" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center">
        <div
          className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 shadow-[0_24px_60px_rgba(85,122,84,0.18)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kitchen-shelf-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="kitchen-shelf-title" className="text-xl font-semibold text-gray-900">
                {strings.shelfModalTitle}
              </h2>
              <p className="mt-1 text-sm text-gray-600">{strings.shelfModalDescription}</p>
            </div>
            <button
              type="button"
              className={NAV_BUTTON}
              onClick={onClose}
            >
              {strings.shelfCloseButton}
            </button>
          </div>

          <div className="mt-5 flex gap-3" role="tablist" aria-label={strings.shelfModalTitle}>
            {SHOP_FOOD_TYPES.map((foodType) => {
              const isActive = activeTab === foodType;
              return (
                <button
                  key={foodType}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(foodType)}
                  className={
                    isActive
                      ? "flex items-center gap-1.5 rounded-full border-2 border-[#8b6f2f] bg-[#f7ead0] px-5 py-2.5 text-base font-bold text-[#5c4720] shadow-[0_3px_8px_rgba(139,111,47,0.3)] transition"
                      : "flex items-center gap-1.5 rounded-full border-2 border-[#dcc38a] bg-[#fcf8ef] px-5 py-2.5 text-base font-bold text-[#6a5530] transition hover:bg-[#fff1cd]"
                  }
                >
                  <span aria-hidden="true">{tabEmoji[foodType]}</span>
                  {tabLabel[foodType]}
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <DishTileGrid
              size="lg"
              tiles={tilesByFoodType[activeTab]}
              emptyText={replaceToken(strings.shelfTabEmptyTemplate, "{tab}", tabLabel[activeTab])}
              enlargeAriaTemplate={strings.dishEnlargeAriaTemplate}
              enlargeCloseLabel={strings.dishEnlargeCloseButton}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function KitchenSection({ vm }: { vm: WordsWorkspaceVM }) {
  const locale = useLocale();
  const str = kitchenStrings[locale];
  const session = useSession();
  const userId = session?.userId ?? null;
  const chefStrings = kitchenChefStrings[locale];
  const chef = useKitchenChef(chefStrings);
  const chefSay = chef.say;
  const [isChefHidden, setIsChefHidden] = useState(false);

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [recipes, setRecipes] = useState<ShopRecipe[]>([]);
  const [unlocks, setUnlocks] = useState<ShopRecipeUnlock[]>([]);
  const [ingredientPrices, setIngredientPrices] = useState<ShopIngredientPrice[]>([]);
  const [rewards, setRewards] = useState<ShopIngredientLedgerEntry[]>([]);
  const [purchases, setPurchases] = useState<ShopIngredientLedgerEntry[]>([]);
  const [consumptions, setConsumptions] = useState<ShopIngredientLedgerEntry[]>([]);
  const [dishes, setDishes] = useState<ShopCookedDish[]>([]);

  const [isFridgeOpen, setIsFridgeOpen] = useState(false);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isShelfOpen, setIsShelfOpen] = useState(false);
  const [isSpecialIngredientsOpen, setIsSpecialIngredientsOpen] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [selectedSpecialIngredientKeys, setSelectedSpecialIngredientKeys] = useState<string[]>([]);
  const [cookingRecipeId, setCookingRecipeId] = useState<string | null>(null);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  // Recipe-scene prep: units the child has dragged into the pot, for one recipe +
  // special-ingredient choice (`key`); any other choice, and every cook after a
  // successful one, starts from an empty pot.
  // A successful cook on such a scene then shows the dish full-size (`dishReveal`),
  // holding the recipe's scene behind it until the child presses Finish.
  const [scenePrep, setScenePrep] = useState<{ key: string; addedByKey: Record<string, number> }>({
    key: "",
    addedByKey: {},
  });
  // Cancelling (handleCancelCooking) bumps the run number; `isCookCommitting` marks
  // the moment the server cook is in flight, when it can no longer be cancelled.
  const cookRunRef = useRef(0);
  const [isCookCommitting, setIsCookCommitting] = useState(false);

  // Leaving the kitchen mid-boil counts as cancelling: the server cook never runs.
  useEffect(
    () => () => {
      cookRunRef.current += 1;
    },
    []
  );
  const [dishReveal, setDishReveal] = useState<{
    scene: KitchenSceneLayout;
    iconPath: string | null;
    title: string;
    recipeSlug: string;
  } | null>(null);
  // Chef challenge + paw prints (roadmap item T). The challenge is kept with the recipe
  // it was fetched for, so a stale one never shows for another recipe; the server
  // (get_chef_challenge) is the source of truth, re-asked on every selection and close.
  const [challengeState, setChallengeState] = useState<{ recipeId: string; challenge: ChefChallenge | null } | null>(
    null
  );
  const [isChallengeOpen, setIsChallengeOpen] = useState(false);
  const [challengeRefresh, setChallengeRefresh] = useState(0);
  const [isHandWashUnlocked, setIsHandWashUnlocked] = useState(false);
  // Recipes with active challenge questions, for the Recipe Book's paw marker.
  const [challengeRecipeIds, setChallengeRecipeIds] = useState<ReadonlySet<string>>(new Set());
  // The recipe just chosen while the hand-wash video plays; the usual next step waits for it.
  const [handWashRecipe, setHandWashRecipe] = useState<ShopRecipe | null>(null);
  // Background music (spec 2026-10-28): plays only on this page, dips under the
  // dish-reveal chime and the hand-wash video; the mute toggle covers the music only.
  const music = useKitchenMusic({
    userId,
    active: vm.page === "shopKitchen",
    ducked: dishReveal !== null || handWashRecipe !== null,
  });

  useEffect(() => {
    if (vm.page !== "shopKitchen") return;

    let isCancelled = false;

    async function loadKitchen(): Promise<void> {
      setLoadState("loading");
      try {
        const [recipeRows, unlockRows, priceRows, rewardRows, purchaseRows, consumptionRows, dishRows] =
          await Promise.all([
            listShopRecipes(),
            listShopRecipeUnlocks(),
            listShopIngredientPrices(),
            listShopIngredientRewards(),
            listShopIngredientPurchases(),
            listShopIngredientConsumptions(),
            listShopCookedDishes(),
          ]);
        if (isCancelled) return;
        setRecipes(recipeRows);
        setUnlocks(unlockRows);
        setIngredientPrices(priceRows);
        setRewards(rewardRows);
        setPurchases(purchaseRows);
        setConsumptions(consumptionRows);
        setDishes(dishRows);
        setLoadState("ready");

        // The hand-wash reward and the challenge markers are nice-to-haves: if these reads
        // fail the kitchen still works.
        try {
          const redemptions = await listPawPrintRedemptions();
          if (!isCancelled) setIsHandWashUnlocked(hasRedeemedReward(redemptions, SHREWY_HAND_WASH_REWARD_KEY));
        } catch (error) {
          console.error("Failed to load paw-print redemptions:", error);
        }
        try {
          const recipeIds = await listChefChallengeRecipeIds();
          if (!isCancelled) setChallengeRecipeIds(new Set(recipeIds));
        } catch (error) {
          console.error("Failed to load chef-challenge recipes:", error);
        }

        // A mystery food unlocks during a quiz, not here, so the chef announces any
        // newly unlocked one the first time the child comes back to the kitchen.
        // "Already announced" lives in localStorage (a lost flag just means one
        // repeat line -- low stakes), keyed per profile.
        if (userId) {
          const storageKey = `hq-kitchen-chef-seen-unlocks:${userId}`;
          let seen = new Set<string>();
          try {
            seen = parseSeenUnlockIds(window.localStorage.getItem(storageKey));
          } catch {
            // storage unavailable (private window etc.): treat as nothing seen
          }
          const unseen = findUnseenMysteryUnlocks(
            recipeRows,
            new Set(unlockRows.map((unlock) => unlock.recipeId)),
            seen
          );
          if (unseen.length > 0) {
            chefSay("unlock", { recipeSlug: unseen[0].slug });
            try {
              window.localStorage.setItem(
                storageKey,
                serializeSeenUnlockIds(new Set([...seen, ...unseen.map((recipe) => recipe.id)]))
              );
            } catch {
              // ignore: worst case the line repeats next visit
            }
          }
        }
      } catch (error) {
        console.error("Failed to load kitchen:", error);
        if (!isCancelled) setLoadState("error");
      }
    }

    void loadKitchen();
    return () => {
      isCancelled = true;
    };
  }, [vm.page, userId, chefSay]);

  const ingredientRecordsByKey = useMemo(
    () => buildShopIngredientRecordMap(ingredientPrices),
    [ingredientPrices]
  );
  const availabilityByKey = useMemo(
    // Purchased ingredients (roadmap item F) feed into the same client-side
    // availability aggregation as quiz rewards -- a second reward-like input,
    // per 0_ARCHITECTURE.md's Shop Kitchen Rule 10, not a redesign of this helper.
    () => buildShopIngredientAvailabilityMap([...rewards, ...purchases], consumptions),
    [rewards, purchases, consumptions]
  );
  const unlockedRecipeIds = useMemo(
    () => new Set(unlocks.map((unlock) => unlock.recipeId)),
    [unlocks]
  );
  const recipesById = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);
  const cookableRecipes = useMemo(() => recipes.filter((recipe) => recipe.cookMethod !== null), [recipes]);
  const countertopTiles = useMemo(
    () => buildCountertopTiles(dishes, recipesById, locale),
    [dishes, recipesById, locale]
  );
  const countertopCount = useMemo(() => countCountertopDishes(dishes), [dishes]);
  const shelfDishCount = useMemo(() => countShelfDishes(dishes), [dishes]);
  const shelfTilesByFoodType = useMemo(
    () => buildShelfTilesByFoodType(dishes, recipesById, locale),
    [dishes, recipesById, locale]
  );
  const totalDishesMade = useMemo(() => countTotalCookedDishes(dishes), [dishes]);
  const selectedRecipe = selectedRecipeId ? recipesById.get(selectedRecipeId) ?? null : null;
  const selectedKitchenScene = useMemo(
    () => resolveKitchenScene(shelfDishCount, selectedRecipe?.slug ?? null),
    [shelfDishCount, selectedRecipe]
  );
  const kitchenScene = dishReveal?.scene ?? selectedKitchenScene;
  // The prep step only runs when the recipe can actually be cooked; otherwise the
  // stove's usual missing-ingredients notice does the talking.
  const scenePrepRequirements = useMemo(() => {
    if (!selectedRecipe || !selectedKitchenScene.effects) return [];
    if (!computeShopCookReadiness(selectedRecipe, availabilityByKey, selectedSpecialIngredientKeys).isReady) return [];
    const specialSlots = getShopRecipeContentForLocale(selectedRecipe, locale).specialIngredients;
    return buildKitchenScenePrepRequirements({
      baseRequirements: computeShopCookBaseRequirements(selectedRecipe, selectedSpecialIngredientKeys),
      specialIngredients: selectedSpecialIngredientKeys.map((key) => ({
        key,
        quantity: specialSlots.find((slot) => slot.ingredientKey === key)?.quantity ?? 1,
      })),
      resolveIngredient: (key) => {
        const record = ingredientRecordsByKey.get(key);
        return { label: resolveShopIngredientLabel(record, locale, key), iconPath: record?.iconPath ?? null };
      },
    });
  }, [
    selectedRecipe,
    selectedKitchenScene,
    availabilityByKey,
    selectedSpecialIngredientKeys,
    ingredientRecordsByKey,
    locale,
  ]);
  const scenePrepKey = `${selectedRecipeId ?? ""}|${[...selectedSpecialIngredientKeys].sort().join(",")}`;
  const scenePrepAdded = scenePrep.key === scenePrepKey ? scenePrep.addedByKey : {};
  const scenePrepTokens = selectedKitchenScene.effects
    ? buildKitchenScenePrepTokens(scenePrepRequirements, selectedKitchenScene.effects.ingredientOrigins, scenePrepAdded)
    : [];
  const isScenePrepPending = scenePrepRequirements.length > 0 && !isKitchenScenePrepComplete(scenePrepRequirements, scenePrepAdded);
  // Each scene names its own vessel (pot, mixing bowl) and the recipe's own appliance.
  const sceneVesselLabel = selectedKitchenScene.effects?.vessel === "bowl" ? str.prepVesselBowl : str.prepVesselPot;
  const sceneApplianceLabel = resolveApplianceLabel(selectedRecipe?.cookMethod ?? "stove", str);

  // Chef challenge (roadmap item T): offered only on an interactive scene during prep.
  const sceneIsInteractive = Boolean(selectedKitchenScene.effects);
  const isChallengePhase = isChefChallengePrepPhase({
    sceneIsInteractive,
    selectedRecipeId,
    cookingRecipeId,
    isCookCommitting,
    hasDishReveal: dishReveal !== null,
  });
  const activeChallenge =
    isChallengePhase && challengeState && challengeState.recipeId === selectedRecipeId ? challengeState.challenge : null;

  useEffect(() => {
    if (vm.page !== "shopKitchen" || loadState !== "ready" || !sceneIsInteractive || !selectedRecipeId) return;
    let isCancelled = false;
    const recipeId = selectedRecipeId;
    getChefChallenge(recipeId)
      .then((result) => {
        if (!isCancelled) setChallengeState({ recipeId, challenge: result.success ? result.challenge : null });
      })
      .catch((error) => {
        console.error("Failed to load Chef Shrewy's challenge:", error);
        if (!isCancelled) setChallengeState({ recipeId, challenge: null });
      });
    return () => {
      isCancelled = true;
    };
  }, [vm.page, loadState, sceneIsInteractive, selectedRecipeId, challengeRefresh]);
  const servedRecipeSlugs = useMemo(
    () =>
      dishes.flatMap((dish) => {
        const slug = recipesById.get(dish.recipeId)?.slug;
        return slug ? [slug] : [];
      }),
    [dishes, recipesById]
  );
  const shelfChefReactions = useMemo(() => {
    const favoriteRecipe = recipesById.get(findFavoriteRecipeId(dishes, recipesById) ?? "");
    return buildShelfChefReactions(
      {
        shelfCountsByFoodType: countShelfDishesByFoodType(dishes, recipesById),
        favoriteDishTitle: favoriteRecipe ? getShopRecipeContentForLocale(favoriteRecipe, locale).title : null,
      },
      chefStrings
    );
  }, [dishes, recipesById, chefStrings, locale]);
  const isCountertopFull = countertopCount >= SHOP_KITCHEN_COUNTERTOP_CAPACITY;
  const availableSpecialIngredientOptions = useMemo(
    () =>
      selectedRecipe
        ? resolveAvailableSpecialIngredients(
            getShopRecipeContentForLocale(selectedRecipe, locale).specialIngredients,
            availabilityByKey
          )
        : [],
    [selectedRecipe, locale, availabilityByKey]
  );

  if (vm.page !== "shopKitchen") return null;

  async function refreshAfterCook(): Promise<void> {
    try {
      const [consumptionRows, dishRows] = await Promise.all([
        listShopIngredientConsumptions(),
        listShopCookedDishes(),
      ]);
      setConsumptions(consumptionRows);
      setDishes(dishRows);
    } catch (error) {
      console.error("Failed to refresh kitchen ledgers after cooking:", error);
    }
  }

  async function refreshAfterOrganize(): Promise<void> {
    try {
      setDishes(await listShopCookedDishes());
    } catch (error) {
      console.error("Failed to refresh dishes after organizing:", error);
    }
  }

  function handleSelectRecipeFromBook(recipeId: string): void {
    if (selectedRecipeId === recipeId) {
      setSelectedRecipeId(null);
      setSelectedSpecialIngredientKeys([]);
      return;
    }

    setSelectedRecipeId(recipeId);
    setSelectedSpecialIngredientKeys([]);

    // Picking a recipe closes the book straight away (2026-10-27). Once the hand-wash
    // reward is unlocked (roadmap item T), Shrewy washes his hands first and the usual
    // next step waits for the video to end.
    const recipe = recipesById.get(recipeId) ?? null;
    setIsBookOpen(false);
    if (recipe && shouldPlayHandWashVideo({ isUnlocked: isHandWashUnlocked, isDeselecting: false })) {
      setHandWashRecipe(recipe);
      return;
    }
    continueAfterRecipeChosen(recipe);
  }

  // After a recipe is chosen: the special-ingredient picker if the child has any of
  // this recipe's special ingredients to offer, else back to the kitchen with
  // Shrewy's start line.
  function continueAfterRecipeChosen(recipe: ShopRecipe | null): void {
    const localizedSpecialIngredients = recipe
      ? getShopRecipeContentForLocale(recipe, locale).specialIngredients
      : [];
    if (resolveAvailableSpecialIngredients(localizedSpecialIngredients, availabilityByKey).length > 0) {
      setIsSpecialIngredientsOpen(true);
    } else {
      announceCookingStart(recipe);
    }
  }

  function handleHandWashFinished(): void {
    const recipe = handWashRecipe;
    setHandWashRecipe(null);
    continueAfterRecipeChosen(recipe);
  }

  // Tapping the painted chef: his challenge while one is on offer, else a chat line.
  function handleSceneChefTap(): void {
    if (activeChallenge) {
      setIsChallengeOpen(true);
      return;
    }
    chef.tap(servedRecipeSlugs, shelfChefReactions);
  }

  function handleChallengeClosed(finished: boolean): void {
    setIsChallengeOpen(false);
    if (!finished) {
      const lines = chefStrings.challenge.dismiss;
      chef.sayLine(lines[Math.floor(Math.random() * lines.length)] ?? "");
    }
    // Re-ask the server: mid-challenge it hands back the next unanswered question (so the
    // badge stays); once the challenge is over it reports cook_required and the badge goes.
    setChallengeRefresh((current) => current + 1);
  }

  // The recipe book and special-ingredient picker are full-screen modals, so the
  // chef's "start cooking" line plays when the child returns to the kitchen scene
  // with a recipe chosen -- the moment they can actually see him. Callers that
  // just changed the selection pass the recipe, since `selectedRecipe` is stale.
  function announceCookingStart(recipe: ShopRecipe | null = selectedRecipe): void {
    if (recipe) {
      chef.say("start", { recipeSlug: recipe.slug });
    }
  }

  function handleAddPrepIngredient(ingredientKey: string): void {
    setScenePrep((current) => {
      const addedByKey = current.key === scenePrepKey ? current.addedByKey : {};
      return { key: scenePrepKey, addedByKey: { ...addedByKey, [ingredientKey]: (addedByKey[ingredientKey] ?? 0) + 1 } };
    });
  }

  function handleToggleSpecialIngredient(ingredientKey: string): void {
    setSelectedSpecialIngredientKeys((current) =>
      current.includes(ingredientKey)
        ? current.filter((key) => key !== ingredientKey)
        : [...current, ingredientKey]
    );
  }

  async function handleCook(method: "stove" | "oven"): Promise<void> {
    // One cook at a time -- a recipe scene's cook now runs for ~3 s.
    if (cookingRecipeId) return;

    if (!selectedRecipe) {
      setNotice({ tone: "error", text: str.pickRecipeFirst });
      return;
    }

    if (selectedRecipe.cookMethod !== method) {
      const localized = getShopRecipeContentForLocale(selectedRecipe, locale);
      const applianceLabel = selectedRecipe.cookMethod
        ? resolveApplianceLabel(selectedRecipe.cookMethod, str)
        : str.ovenLabel;
      setNotice({
        tone: "error",
        text: replaceToken(
          replaceToken(str.wrongApplianceTemplate, "{title}", localized.title),
          "{appliance}",
          applianceLabel
        ),
      });
      return;
    }

    if (isCountertopFull) {
      setNotice({ tone: "error", text: str.countertopFullMessage });
      return;
    }

    const readiness = computeShopCookReadiness(selectedRecipe, availabilityByKey, selectedSpecialIngredientKeys);
    if (!readiness.isReady) {
      const names = readiness.missingIngredientKeys
        .map((key) => resolveShopIngredientLabel(ingredientRecordsByKey.get(key), locale, key))
        .join(", ");
      setNotice({ tone: "error", text: replaceToken(str.missingIngredientsTemplate, "{ingredients}", names) });
      return;
    }

    if (isScenePrepPending) {
      setNotice({ tone: "error", text: replaceToken(str.prepNotDoneMessage, "{vessel}", sceneVesselLabel) });
      return;
    }

    setCookingRecipeId(selectedRecipe.id);
    setNotice(null);
    const cookScene = selectedKitchenScene.effects ? selectedKitchenScene : null;
    // Each cook gets a run number; handleCancelCooking bumps it, so a boil that was
    // cancelled stops here and never reaches the server (nothing is consumed).
    const run = ++cookRunRef.current;
    try {
      if (cookScene) {
        // Boil first (~3 s), cook on the server after -- so cancelling mid-boil is free.
        await new Promise((resolve) => setTimeout(resolve, KITCHEN_SCENE_COOK_MS));
        if (cookRunRef.current !== run) return;
      }
      setIsCookCommitting(true);
      const result = await cookShopRecipe(selectedRecipe.id, selectedSpecialIngredientKeys);
      if (!result.success) {
        if (result.code === "insufficient_ingredients") {
          await refreshAfterCook();
          const names = result.missingIngredientKeys
            .map((key) => resolveShopIngredientLabel(ingredientRecordsByKey.get(key), locale, key))
            .join(", ");
          setNotice({ tone: "error", text: replaceToken(str.missingIngredientsTemplate, "{ingredients}", names) });
        } else if (result.code === "countertop_full") {
          await refreshAfterCook();
          setNotice({ tone: "error", text: str.countertopFullMessage });
        } else {
          setNotice({ tone: "error", text: str.cookFailedGeneric });
        }
        return;
      }

      const localized = getShopRecipeContentForLocale(selectedRecipe, locale);
      await refreshAfterCook();
      setSelectedRecipeId(null);
      setSelectedSpecialIngredientKeys([]);
      // Those units were cooked: a re-cook of the same recipe starts from an empty pot.
      setScenePrep({ key: "", addedByKey: {} });
      if (cookScene) {
        // Success notice and chef line wait for Finish (handleFinishDishReveal).
        setDishReveal({
          scene: cookScene,
          iconPath: resolveRecipeDishIconPath(selectedRecipe, selectedSpecialIngredientKeys),
          title: localized.title,
          recipeSlug: selectedRecipe.slug,
        });
      } else {
        setNotice({ tone: "success", text: replaceToken(str.cookSuccessTemplate, "{title}", localized.title) });
        chef.say("success", { recipeSlug: selectedRecipe.slug });
      }
    } catch (error) {
      console.error("Failed to cook recipe:", error);
      setNotice({ tone: "error", text: str.cookFailedGeneric });
    } finally {
      // A cancelled run must not clear a newer cook the child has since started.
      if (cookRunRef.current === run) {
        setCookingRecipeId(null);
        setIsCookCommitting(false);
      }
    }
  }

  // Cancel at any point before the server cook (picking ingredients, or mid-boil):
  // nothing was consumed yet, so "restoring" the ingredients is just emptying the pot.
  function handleCancelCooking(): void {
    if (isCookCommitting) return;
    cookRunRef.current += 1;
    setCookingRecipeId(null);
    setSelectedRecipeId(null);
    setSelectedSpecialIngredientKeys([]);
    setScenePrep({ key: "", addedByKey: {} });
    setNotice({ tone: "success", text: str.cookCancelledMessage });
  }

  function handleFinishDishReveal(): void {
    if (!dishReveal) return;
    setDishReveal(null);
    setNotice({ tone: "success", text: replaceToken(str.cookSuccessTemplate, "{title}", dishReveal.title) });
    chef.say("success", { recipeSlug: dishReveal.recipeSlug });
  }

  async function handleOrganize(): Promise<void> {
    if (countertopCount === 0 || isOrganizing) return;

    setIsOrganizing(true);
    setNotice(null);
    try {
      const result = await organizeShopKitchenCountertop();
      if (!result.success) {
        setNotice({ tone: "error", text: str.organizeFailedGeneric });
        return;
      }
      await refreshAfterOrganize();
      setNotice({ tone: "success", text: replaceToken(str.organizeSuccessTemplate, "{count}", String(result.movedCount)) });
    } catch (error) {
      console.error("Failed to organize the countertop:", error);
      setNotice({ tone: "error", text: str.organizeFailedGeneric });
    } finally {
      setIsOrganizing(false);
    }
  }

  const availableIngredientKindCount = Array.from(availabilityByKey.values()).filter((count) => count > 0).length;

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">{str.pageTitle}</h2>
          <button
            type="button"
            onClick={music.toggleMuted}
            aria-label={music.isMuted ? str.musicUnmuteAria : str.musicMuteAria}
            title={music.isMuted ? str.musicUnmuteAria : str.musicMuteAria}
            className="btn-nav inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-semibold hover:bg-[#fff1cd]"
          >
            <span aria-hidden="true">{music.isMuted ? "🔇" : "🔊"}</span>
            {music.isMuted ? str.musicOffLabel : str.musicOnLabel}
          </button>
        </div>
        <p className="max-w-3xl text-sm text-gray-700">{str.pageDescription}</p>
      </div>

      {notice ? (
        <p
          className={
            notice.tone === "success"
              ? "text-sm text-blue-700"
              : "rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
          }
        >
          {notice.text}
        </p>
      ) : null}

      {loadState === "loading" || loadState === "idle" ? (
        <p className="text-sm text-gray-600">{str.loading}</p>
      ) : loadState === "error" ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{str.loadError}</p>
      ) : (
        <div className="space-y-4">
          {/* The kitchen scene (chosen by resolveKitchenScene: a recipe's own special
              scene while it's selected, otherwise kitchen_empty/kitchen_half_stocked/
              kitchen_stocked.png by how many dishes are on the shelf) with clickable
              hotspots for the fridge, recipe book, stovetop, oven, and shelf --
              percentage boxes per artwork that may need a small visual nudge once
              checked in a real browser against the actual rendered image. */}
          <div className="relative mx-auto w-full max-w-3xl" style={{ aspectRatio: kitchenScene.aspectRatio }}>
            <img
              src={kitchenScene.imagePath}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full rounded-2xl object-contain"
            />
            {kitchenScene.effects ? (
              <KitchenSceneEffects
                key={kitchenScene.imagePath}
                effects={kitchenScene.effects}
                prepTokens={scenePrepTokens}
                prepComplete={scenePrepRequirements.length > 0 && !isScenePrepPending}
                prompt={
                  cookingRecipeId
                    ? str.cookingPrompt
                    : scenePrepRequirements.length === 0 || dishReveal
                      ? null
                      : isScenePrepPending
                        ? replaceToken(str.prepDragPrompt, "{vessel}", sceneVesselLabel)
                        : replaceToken(str.prepDonePrompt, "{appliance}", sceneApplianceLabel)
                }
                tokenAriaLabel={(token) =>
                  replaceToken(
                    replaceToken(
                      replaceToken(str.prepTokenAriaTemplate, "{ingredient}", token.label),
                      "{vessel}",
                      sceneVesselLabel
                    ),
                    "{count}",
                    String(token.remaining)
                  )
                }
                onAddIngredient={handleAddPrepIngredient}
                cooking={cookingRecipeId !== null}
                chefLine={chef.line}
                chefTapAria={chefStrings.tapAria}
                onChefTap={handleSceneChefTap}
                chefBadge={
                  activeChallenge ? { iconPath: "/paw-prints/shrewy_paw_badge.png", ariaLabel: str.challengeBadgeAria } : null
                }
              />
            ) : null}

            <SceneHotspot
              {...kitchenScene.hotspots.fridge}
              label={str.fridgeLabel}
              ariaLabel={str.fridgeOpenAria}
              onClick={() => setIsFridgeOpen(true)}
            />
            <SceneHotspot
              {...kitchenScene.hotspots.book}
              label={str.bookLabel}
              ariaLabel={str.bookOpenAria}
              onClick={() => setIsBookOpen(true)}
            />
            <SceneHotspot
              {...kitchenScene.hotspots.stovetop}
              label={str.stovetopLabel}
              ariaLabel={str.stovetopAria}
              onClick={() => void handleCook("stove")}
            />
            <SceneHotspot
              {...kitchenScene.hotspots.oven}
              label={str.ovenLabel}
              ariaLabel={str.ovenAria}
              onClick={() => void handleCook("oven")}
            />
            <SceneHotspot
              {...kitchenScene.hotspots.shelf}
              label={str.shelfLabel}
              ariaLabel={str.shelfOpenAria}
              onClick={() => setIsShelfOpen(true)}
            />
            {kitchenScene.showChef ? (
              <KitchenChef
                pose={chef.pose}
                line={chef.line}
                spot={chef.spot}
                tapAria={chefStrings.tapAria}
                hideLabel={chefStrings.hideLabel}
                showLabel={chefStrings.showLabel}
                hidden={isChefHidden}
                onTap={() => chef.tap(servedRecipeSlugs, shelfChefReactions)}
                onToggleHidden={() => setIsChefHidden((current) => !current)}
              />
            ) : null}
          </div>

          {/* Fridge / recipe book status line */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            <span className="rounded-full border border-[#dcc38a] bg-[#fcf8ef] px-3 py-1 font-medium text-[#8b6f2f]">
              {str.fridgeLabel}: {availableIngredientKindCount} {str.ingredientCountSuffix}
            </span>
            <span className="rounded-full border border-[#dcc38a] bg-[#fcf8ef] px-3 py-1 font-medium text-[#8b6f2f]">
              {selectedRecipe
                ? `${str.recipeSelectedPrefix} ${getShopRecipeContentForLocale(selectedRecipe, locale).title}`
                : `${cookableRecipes.filter((recipe) => unlockedRecipeIds.has(recipe.id) && computeShopCookReadiness(recipe, availabilityByKey).isReady).length} ${str.recipesReadySuffix}`}
            </span>
            {selectedRecipe && availableSpecialIngredientOptions.length > 0 ? (
              <button
                type="button"
                onClick={() => setIsSpecialIngredientsOpen(true)}
                className="rounded-full border border-[#8b6f2f] bg-[#f7ead0] px-3 py-1 font-semibold text-[#5c4720] transition hover:bg-[#f0dfb8]"
              >
                {selectedSpecialIngredientKeys.length > 0
                  ? replaceToken(str.specialEditPillTemplate, "{count}", String(selectedSpecialIngredientKeys.length))
                  : str.specialAddPillLabel}
              </button>
            ) : null}
            {selectedRecipe && !isCookCommitting ? (
              <button
                type="button"
                onClick={handleCancelCooking}
                className="rounded-full border border-[#c9a99a] bg-white px-3 py-1 font-semibold text-[#8a4b3a] transition hover:bg-[#fbeee9]"
              >
                {str.cancelCookingButton}
              </button>
            ) : null}
            {cookingRecipeId ? <span className="text-gray-500">{str.cooking}</span> : null}
          </div>

          {/* Countertop: what's fresh from the kitchen, capacity-limited */}
          <div className="rounded-[1.25rem] border border-[#dcc38a] bg-[linear-gradient(180deg,rgba(255,252,244,0.98),rgba(249,242,224,0.98))] p-4 shadow-[0_16px_34px_rgba(115,92,40,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-[#6a5530]">{str.countertopLabel}</h3>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-bold ${
                    isCountertopFull ? "bg-red-100 text-red-700" : "bg-[#fcf8ef] text-[#8b6f2f]"
                  }`}
                >
                  {replaceToken(
                    replaceToken(str.countertopCountTemplate, "{count}", String(countertopCount)),
                    "{capacity}",
                    String(SHOP_KITCHEN_COUNTERTOP_CAPACITY)
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => void handleOrganize()}
                  disabled={countertopCount === 0 || isOrganizing}
                  aria-label={str.organizeButtonAria}
                  className="btn-caution rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {str.organizeButton}
                </button>
              </div>
            </div>
            <div className="mt-3">
              <DishTileGrid
                tiles={countertopTiles}
                emptyText={str.countertopEmpty}
                enlargeAriaTemplate={str.dishEnlargeAriaTemplate}
                enlargeCloseLabel={str.dishEnlargeCloseButton}
              />
            </div>
          </div>

          <p className="text-center text-sm text-gray-600">
            {totalDishesMade === 1
              ? str.shelfSummarySingular
              : replaceToken(str.shelfSummaryTemplate, "{count}", String(totalDishesMade))}
          </p>
        </div>
      )}

      {isFridgeOpen ? (
        <FridgeModal
          ingredients={ingredientPrices}
          ingredientRecordsByKey={ingredientRecordsByKey}
          availabilityByKey={availabilityByKey}
          locale={locale}
          strings={str}
          onClose={() => setIsFridgeOpen(false)}
        />
      ) : null}

      {isBookOpen ? (
        <RecipeBookModal
          recipes={cookableRecipes}
          unlockedRecipeIds={unlockedRecipeIds}
          availabilityByKey={availabilityByKey}
          ingredientRecordsByKey={ingredientRecordsByKey}
          selectedRecipeId={selectedRecipeId}
          onSelectRecipe={handleSelectRecipeFromBook}
          challengeRecipeIds={challengeRecipeIds}
          locale={locale}
          strings={str}
          onClose={() => {
            setIsBookOpen(false);
            announceCookingStart();
          }}
        />
      ) : null}

      {isChallengeOpen && activeChallenge && selectedRecipeId ? (
        <ChefChallengeModal
          recipeId={selectedRecipeId}
          challenge={activeChallenge}
          strings={str}
          chefStrings={chefStrings}
          onClose={handleChallengeClosed}
        />
      ) : null}

      {handWashRecipe ? <HandWashVideoModal ariaLabel={str.handWashAria} onFinished={handleHandWashFinished} /> : null}

      {dishReveal ? (
        <KitchenDishReveal
          heading={replaceToken(str.dishRevealTitleTemplate, "{title}", dishReveal.title)}
          iconPath={dishReveal.iconPath}
          finishLabel={str.dishRevealFinish}
          onFinished={handleFinishDishReveal}
        />
      ) : null}

      {isShelfOpen ? (
        <ShelfModal
          tilesByFoodType={shelfTilesByFoodType}
          strings={str}
          onClose={() => setIsShelfOpen(false)}
        />
      ) : null}

      {isSpecialIngredientsOpen && selectedRecipe ? (
        <SpecialIngredientsModal
          recipeTitle={getShopRecipeContentForLocale(selectedRecipe, locale).title}
          options={availableSpecialIngredientOptions}
          selectedKeys={selectedSpecialIngredientKeys}
          onToggle={handleToggleSpecialIngredient}
          ingredientRecordsByKey={ingredientRecordsByKey}
          locale={locale}
          strings={str}
          onClose={() => {
            setIsSpecialIngredientsOpen(false);
            announceCookingStart();
          }}
        />
      ) : null}
    </section>
  );
}
