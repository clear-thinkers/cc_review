"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useLocale } from "@/app/shared/locale";
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
  computeShopCookReadiness,
  getShopRecipeContentForLocale,
  resolveShopIngredientLabel,
} from "@/lib/shop";
import {
  cookShopRecipe,
  listShopCookedDishes,
  listShopIngredientConsumptions,
  listShopIngredientPrices,
  listShopIngredientPurchases,
  listShopIngredientRewards,
  listShopRecipeUnlocks,
  listShopRecipes,
  organizeShopKitchenCountertop,
} from "@/lib/supabase-service";
import type { WordsWorkspaceVM } from "../../shared/WordsWorkspaceVM";
import { kitchenStrings } from "./kitchen.strings";
import {
  buildCountertopTiles,
  buildShelfTilesByFoodType,
  countCountertopDishes,
  countTotalCookedDishes,
  resolveApplianceLabel,
  resolveAvailableSpecialIngredients,
  SHOP_FOOD_TYPES,
  SHOP_KITCHEN_COUNTERTOP_CAPACITY,
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
 * One clickable region over the full-kitchen.png illustration. Position is
 * expressed as percentages of the image's own box, tied to this specific
 * artwork's fixed layout -- there's no static Tailwind class for "the top
 * half of the appliance in this particular picture," so inline style is the
 * documented exception here (BUILD_CONVENTIONS.md §7).
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
                    className="flex flex-col items-center gap-2 rounded-xl border border-[#eadfbe] bg-white px-3 py-3 text-center"
                  >
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
  locale,
  strings,
  onClose,
}: {
  recipes: ShopRecipe[];
  unlockedRecipeIds: ReadonlySet<string>;
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
                      <span className="rounded-full border border-[#dcc38a] bg-[#fcf8ef] px-2 py-0.5 text-[11px] font-semibold uppercase text-[#6a5530]">
                        {applianceLabel}
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
}: {
  tiles: { recipeId: string; iconPath: string | null; title: string; count: number }[];
  emptyText: string;
  size?: "sm" | "lg";
}) {
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
    <div className={`flex flex-wrap ${tileGapClass}`}>
      {tiles.map((tile) => (
        <div
          key={`${tile.recipeId}::${tile.iconPath ?? ""}`}
          title={`${tile.title} (x${tile.count})`}
          className={`flex flex-col items-center ${itemGapClass} rounded-xl border border-[#eadfbe] bg-white ${itemPaddingClass} shadow-sm`}
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
        </div>
      ))}
    </div>
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
      } catch (error) {
        console.error("Failed to load kitchen:", error);
        if (!isCancelled) setLoadState("error");
      }
    }

    void loadKitchen();
    return () => {
      isCancelled = true;
    };
  }, [vm.page]);

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
  const shelfTilesByFoodType = useMemo(
    () => buildShelfTilesByFoodType(dishes, recipesById, locale),
    [dishes, recipesById, locale]
  );
  const totalDishesMade = useMemo(() => countTotalCookedDishes(dishes), [dishes]);
  const selectedRecipe = selectedRecipeId ? recipesById.get(selectedRecipeId) ?? null : null;
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

    // Ask about special ingredients right away, per the recipe -- but only
    // if the child actually has at least one of this recipe's special
    // ingredients to offer; otherwise there's nothing to ask about.
    const recipe = recipesById.get(recipeId);
    const localizedSpecialIngredients = recipe
      ? getShopRecipeContentForLocale(recipe, locale).specialIngredients
      : [];
    if (resolveAvailableSpecialIngredients(localizedSpecialIngredients, availabilityByKey).length > 0) {
      setIsBookOpen(false);
      setIsSpecialIngredientsOpen(true);
    }
  }

  function handleToggleSpecialIngredient(ingredientKey: string): void {
    setSelectedSpecialIngredientKeys((current) =>
      current.includes(ingredientKey)
        ? current.filter((key) => key !== ingredientKey)
        : [...current, ingredientKey]
    );
  }

  async function handleCook(method: "stove" | "oven"): Promise<void> {
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

    const readiness = computeShopCookReadiness(selectedRecipe, availabilityByKey);
    if (!readiness.isReady) {
      const names = readiness.missingIngredientKeys
        .map((key) => resolveShopIngredientLabel(ingredientRecordsByKey.get(key), locale, key))
        .join(", ");
      setNotice({ tone: "error", text: replaceToken(str.missingIngredientsTemplate, "{ingredients}", names) });
      return;
    }

    setCookingRecipeId(selectedRecipe.id);
    setNotice(null);
    try {
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
      setNotice({ tone: "success", text: replaceToken(str.cookSuccessTemplate, "{title}", localized.title) });
    } catch (error) {
      console.error("Failed to cook recipe:", error);
      setNotice({ tone: "error", text: str.cookFailedGeneric });
    } finally {
      setCookingRecipeId(null);
    }
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
        <h2 className="font-medium">{str.pageTitle}</h2>
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
          {/* The kitchen scene: full-kitchen.png with clickable hotspots for the
              fridge, recipe book, stovetop (top of the appliance), oven (bottom
              of the appliance), and shelf -- positions are approximate percentage
              boxes over the artwork and may need a small visual nudge once
              checked in a real browser against the actual rendered image. */}
          <div className="relative mx-auto w-full max-w-3xl" style={{ aspectRatio: "1337 / 1176" }}>
            <img
              src="/kitchen/full-kitchen.png"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full rounded-2xl object-contain"
            />

            <SceneHotspot
              left="4%" top="38%" width="21%" height="40%"
              label={str.fridgeLabel}
              ariaLabel={str.fridgeOpenAria}
              onClick={() => setIsFridgeOpen(true)}
            />
            <SceneHotspot
              left="46%" top="27%" width="14%" height="13%"
              label={str.bookLabel}
              ariaLabel={str.bookOpenAria}
              onClick={() => setIsBookOpen(true)}
            />
            <SceneHotspot
              left="31%" top="39%" width="19%" height="11%"
              label={str.stovetopLabel}
              ariaLabel={str.stovetopAria}
              onClick={() => void handleCook("stove")}
            />
            <SceneHotspot
              left="31%" top="50%" width="19%" height="11%"
              label={str.ovenLabel}
              ariaLabel={str.ovenAria}
              onClick={() => void handleCook("oven")}
            />
            <SceneHotspot
              left="76%" top="20%" width="17%" height="48%"
              label={str.shelfLabel}
              ariaLabel={str.shelfOpenAria}
              onClick={() => setIsShelfOpen(true)}
            />
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
              <DishTileGrid tiles={countertopTiles} emptyText={str.countertopEmpty} />
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
          locale={locale}
          strings={str}
          onClose={() => setIsBookOpen(false)}
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
          onClose={() => setIsSpecialIngredientsOpen(false)}
        />
      ) : null}
    </section>
  );
}
