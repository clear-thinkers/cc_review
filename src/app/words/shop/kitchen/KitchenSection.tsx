"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useLocale } from "@/app/shared/locale";
import type {
  ShopCookedDish,
  ShopIngredientLedgerEntry,
  ShopIngredientPrice,
  ShopRecipe,
  ShopRecipeUnlock,
  ShopShelfCategory,
} from "@/lib/shop.types";
import {
  buildShopIngredientAvailabilityMap,
  buildShopIngredientRecordMap,
  computeShopCookReadiness,
  getShopRecipeContentForLocale,
  resolvePlainShopRecipeIconPath,
  resolveShopIngredientLabel,
} from "@/lib/shop";
import {
  cookShopRecipe,
  listShopCookedDishes,
  listShopIngredientConsumptions,
  listShopIngredientPrices,
  listShopIngredientRewards,
  listShopRecipeUnlocks,
  listShopRecipes,
  moveShopCookedDish,
} from "@/lib/supabase-service";
import type { WordsWorkspaceVM } from "../../shared/WordsWorkspaceVM";
import { kitchenStrings } from "./kitchen.strings";
import { buildKitchenShelvesByCategory, countTotalCookedDishes } from "./kitchen.types";

type LoadState = "idle" | "loading" | "ready" | "error";

type DragState = {
  dishId: string;
  recipeId: string;
  pointerId: number;
  x: number;
  y: number;
};

function replaceToken(template: string, token: string, value: string): string {
  return template.replace(token, value);
}

function CupboardModal({
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
  strings: (typeof kitchenStrings)["en"];
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
          aria-labelledby="kitchen-cupboard-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="kitchen-cupboard-title" className="text-xl font-semibold text-gray-900">
                {strings.cupboardModalTitle}
              </h2>
              <p className="mt-1 text-sm text-gray-600">{strings.cupboardModalDescription}</p>
            </div>
            <button
              type="button"
              className="btn-nav rounded-md px-4 py-2 text-sm font-medium"
              onClick={onClose}
            >
              {strings.cupboardCloseButton}
            </button>
          </div>

          {availableIngredients.length === 0 ? (
            <p className="mt-4 text-sm italic text-gray-500">{strings.cupboardEmpty}</p>
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
  strings: (typeof kitchenStrings)["en"];
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
              className="btn-nav rounded-md px-4 py-2 text-sm font-medium"
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
                const applianceLabel = recipe.cookMethod === "stove" ? strings.stovetopLabel : strings.ovenLabel;

                if (!isUnlocked) {
                  return (
                    <div
                      key={recipe.id}
                      className="flex flex-col gap-2 rounded-xl border border-gray-300 bg-gray-50 p-3 text-left text-gray-500"
                    >
                      <div className="text-base font-semibold">{localized.title}</div>
                      <div className="text-xs uppercase tracking-wide">{strings.recipeLocked}</div>
                      <Link href="/words/shop" className="btn-nav inline-block w-fit rounded-md px-3 py-1.5 text-xs font-medium">
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

export default function KitchenSection({ vm }: { vm: WordsWorkspaceVM }) {
  const locale = useLocale();
  const str = kitchenStrings[locale];

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [recipes, setRecipes] = useState<ShopRecipe[]>([]);
  const [unlocks, setUnlocks] = useState<ShopRecipeUnlock[]>([]);
  const [ingredientPrices, setIngredientPrices] = useState<ShopIngredientPrice[]>([]);
  const [rewards, setRewards] = useState<ShopIngredientLedgerEntry[]>([]);
  const [consumptions, setConsumptions] = useState<ShopIngredientLedgerEntry[]>([]);
  const [dishes, setDishes] = useState<ShopCookedDish[]>([]);

  const [isCupboardOpen, setIsCupboardOpen] = useState(false);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [cookingRecipeId, setCookingRecipeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverShelf, setDragOverShelf] = useState<ShopShelfCategory | null>(null);
  const shelfRowRefs = useRef<Record<ShopShelfCategory, HTMLDivElement | null>>({
    default: null,
    drinks: null,
    desserts: null,
    hotmeal: null,
  });

  useEffect(() => {
    if (vm.page !== "shopKitchen") return;

    let isCancelled = false;

    async function loadKitchen(): Promise<void> {
      setLoadState("loading");
      try {
        const [recipeRows, unlockRows, priceRows, rewardRows, consumptionRows, dishRows] =
          await Promise.all([
            listShopRecipes(),
            listShopRecipeUnlocks(),
            listShopIngredientPrices(),
            listShopIngredientRewards(),
            listShopIngredientConsumptions(),
            listShopCookedDishes(),
          ]);
        if (isCancelled) return;
        setRecipes(recipeRows);
        setUnlocks(unlockRows);
        setIngredientPrices(priceRows);
        setRewards(rewardRows);
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
    () => buildShopIngredientAvailabilityMap(rewards, consumptions),
    [rewards, consumptions]
  );
  const unlockedRecipeIds = useMemo(
    () => new Set(unlocks.map((unlock) => unlock.recipeId)),
    [unlocks]
  );
  const recipesById = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);
  const cookableRecipes = useMemo(() => recipes.filter((recipe) => recipe.cookMethod !== null), [recipes]);
  const shelvesByCategory = useMemo(() => buildKitchenShelvesByCategory(dishes), [dishes]);
  const totalDishesMade = useMemo(() => countTotalCookedDishes(dishes), [dishes]);
  const selectedRecipe = selectedRecipeId ? recipesById.get(selectedRecipeId) ?? null : null;

  if (vm.page !== "shopKitchen") return null;

  async function refreshConsumptionsAndDishes(): Promise<void> {
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

  function tileTitleAndIcon(recipeId: string): { title: string; iconPath: string | null } {
    const recipe = recipesById.get(recipeId);
    if (!recipe) return { title: recipeId, iconPath: null };
    const localized = getShopRecipeContentForLocale(recipe, locale);
    return { title: localized.title, iconPath: resolvePlainShopRecipeIconPath(recipe.variantIconRules) };
  }

  async function handleCook(method: "stove" | "oven"): Promise<void> {
    if (!selectedRecipe) {
      setNotice({ tone: "error", text: str.pickRecipeFirst });
      return;
    }

    if (selectedRecipe.cookMethod !== method) {
      const localized = getShopRecipeContentForLocale(selectedRecipe, locale);
      const applianceLabel = method === "stove" ? str.stovetopLabel : str.ovenLabel;
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
      const result = await cookShopRecipe(selectedRecipe.id);
      if (!result.success) {
        if (result.code === "insufficient_ingredients") {
          await refreshConsumptionsAndDishes();
          const names = result.missingIngredientKeys
            .map((key) => resolveShopIngredientLabel(ingredientRecordsByKey.get(key), locale, key))
            .join(", ");
          setNotice({ tone: "error", text: replaceToken(str.missingIngredientsTemplate, "{ingredients}", names) });
        } else {
          setNotice({ tone: "error", text: str.cookFailedGeneric });
        }
        return;
      }

      const localized = getShopRecipeContentForLocale(selectedRecipe, locale);
      await refreshConsumptionsAndDishes();
      setSelectedRecipeId(null);
      setNotice({ tone: "success", text: replaceToken(str.cookSuccessTemplate, "{title}", localized.title) });
    } catch (error) {
      console.error("Failed to cook recipe:", error);
      setNotice({ tone: "error", text: str.cookFailedGeneric });
    } finally {
      setCookingRecipeId(null);
    }
  }

  async function handleMoveDish(dishId: string, targetShelf: ShopShelfCategory): Promise<void> {
    const dish = dishes.find((d) => d.id === dishId);
    if (!dish || dish.shelfCategory === targetShelf) return;

    const previousShelf = dish.shelfCategory;
    // Optimistic update -- the drag gesture itself is the feedback the child is
    // waiting on; reverting on failure keeps this safe if the RPC rejects it.
    setDishes((prev) => prev.map((d) => (d.id === dishId ? { ...d, shelfCategory: targetShelf } : d)));

    try {
      const result = await moveShopCookedDish(dishId, targetShelf);
      if (!result.success) {
        setDishes((prev) => prev.map((d) => (d.id === dishId ? { ...d, shelfCategory: previousShelf } : d)));
        setNotice({ tone: "error", text: str.moveFailedGeneric });
      }
    } catch (error) {
      console.error("Failed to move cooked dish:", error);
      setDishes((prev) => prev.map((d) => (d.id === dishId ? { ...d, shelfCategory: previousShelf } : d)));
      setNotice({ tone: "error", text: str.moveFailedGeneric });
    }
  }

  function findDishIdForTile(shelf: ShopShelfCategory, recipeId: string): string | null {
    // Any one instance of this recipe currently on this shelf is a valid drag
    // source for the tile (the tile represents the whole stack; dragging it
    // moves one underlying shop_cooked_dishes row).
    const match = dishes.find((d) => d.shelfCategory === shelf && d.recipeId === recipeId);
    return match ? match.id : null;
  }

  function handleTilePointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    dishId: string,
    recipeId: string
  ): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({ dishId, recipeId, pointerId: event.pointerId, x: event.clientX, y: event.clientY });
  }

  function handleTilePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const { clientX, clientY } = event;
    setDragState((prev) => (prev ? { ...prev, x: clientX, y: clientY } : prev));

    const elementUnderPointer = document.elementFromPoint(clientX, clientY);
    const hoveredShelf = (Object.entries(shelfRowRefs.current) as [ShopShelfCategory, HTMLDivElement | null][]).find(
      ([, node]) => node && elementUnderPointer && (node === elementUnderPointer || node.contains(elementUnderPointer))
    );
    setDragOverShelf(hoveredShelf ? hoveredShelf[0] : null);
  }

  function handleTilePointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const targetShelf = dragOverShelf;
    const { dishId } = dragState;
    setDragState(null);
    setDragOverShelf(null);
    if (targetShelf) {
      void handleMoveDish(dishId, targetShelf);
    }
  }

  const shelfDefs: { id: ShopShelfCategory; label: string; empty: string; wash: string; plank: string }[] = [
    { id: "default", label: str.shelfDefaultLabel, empty: str.shelfDefaultEmpty, wash: "bg-[#a5713f]/10", plank: "bg-[#a5713f]" },
    { id: "drinks", label: str.shelfDrinksLabel, empty: str.shelfDrinksEmpty, wash: "bg-[#4f9db3]/10", plank: "bg-[#4f9db3]" },
    { id: "desserts", label: str.shelfDessertsLabel, empty: str.shelfDessertsEmpty, wash: "bg-[#d1729a]/10", plank: "bg-[#d1729a]" },
    { id: "hotmeal", label: str.shelfHotMealLabel, empty: str.shelfHotMealEmpty, wash: "bg-[#d9822f]/10", plank: "bg-[#d9822f]" },
  ];

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
        <div className="space-y-6">
          {/* Shelves */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">{str.pageTitle}</h3>
              <span className="text-sm text-gray-600">
                {totalDishesMade === 1
                  ? str.shelfSummarySingular
                  : replaceToken(str.shelfSummaryTemplate, "{count}", String(totalDishesMade))}
              </span>
            </div>

            {shelfDefs.map((shelfDef) => {
              const tiles = shelvesByCategory[shelfDef.id];
              const itemCount = tiles.reduce((sum, tile) => sum + tile.count, 0);
              return (
                <div key={shelfDef.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${shelfDef.plank}`}
                        aria-hidden="true"
                      />
                      {shelfDef.label}
                    </h4>
                    <span className="text-xs text-gray-500">
                      {itemCount === 1
                        ? str.shelfItemCountSingular
                        : replaceToken(str.shelfItemCountTemplate, "{count}", String(itemCount))}
                    </span>
                  </div>
                  <div
                    ref={(node) => {
                      shelfRowRefs.current[shelfDef.id] = node;
                    }}
                    className={`flex min-h-[4.5rem] flex-wrap items-end gap-3 rounded-xl border border-[#eadfbe] p-3 transition ${shelfDef.wash} ${
                      dragOverShelf === shelfDef.id ? "ring-2 ring-[#d2b15b] ring-offset-1" : ""
                    }`}
                  >
                    {tiles.length === 0 ? (
                      <p className="text-xs italic text-gray-500">{shelfDef.empty}</p>
                    ) : (
                      tiles.map((tile) => {
                        const { title, iconPath } = tileTitleAndIcon(tile.recipeId);
                        const dishId = findDishIdForTile(shelfDef.id, tile.recipeId);
                        const isBeingDragged = dragState?.dishId === dishId;
                        return (
                          <div
                            key={tile.recipeId}
                            role="button"
                            tabIndex={0}
                            aria-label={title}
                            title={`${title} (x${tile.count})`}
                            onPointerDown={(event) => dishId && handleTilePointerDown(event, dishId, tile.recipeId)}
                            onPointerMove={handleTilePointerMove}
                            onPointerUp={handleTilePointerUp}
                            className={`relative flex touch-none flex-col items-center gap-1 rounded-lg px-2 py-1 ${
                              isBeingDragged ? "opacity-30" : ""
                            }`}
                          >
                            <span className="relative text-2xl" aria-hidden="true">
                              {iconPath ? (
                                <img src={iconPath} alt="" className="h-9 w-9 object-contain" />
                              ) : (
                                "🍽️"
                              )}
                              {tile.count > 1 ? (
                                <span className="absolute -right-2 -top-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#d2b15b] px-1 text-[11px] font-bold text-white">
                                  {tile.count}
                                </span>
                              ) : null}
                            </span>
                            <span className="max-w-[4rem] truncate text-center text-[11px] font-medium text-gray-700">
                              {title}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Counter: cupboard, stove/oven, recipe book */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => setIsCupboardOpen(true)}
              aria-haspopup="dialog"
              aria-label={str.cupboardOpenAria}
              className="flex flex-col items-center gap-2 rounded-[1.25rem] border border-[#dcc38a] bg-[linear-gradient(180deg,rgba(255,252,244,0.98),rgba(249,242,224,0.98))] p-4 text-center shadow-[0_16px_34px_rgba(115,92,40,0.08)]"
            >
              <span className="text-3xl" aria-hidden="true">🗄️</span>
              <span className="text-sm font-semibold text-[#6a5530]">{str.cupboardLabel}</span>
              <span className="rounded-full bg-[#fcf8ef] px-2 py-0.5 text-xs font-medium text-[#8b6f2f]">
                {Array.from(availabilityByKey.values()).filter((count) => count > 0).length} {str.ingredientCountSuffix}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleCook("stove")}
              disabled={cookingRecipeId !== null}
              aria-label={str.stovetopAria}
              className="flex flex-col items-center gap-2 rounded-[1.25rem] border border-[#dcc38a] bg-[linear-gradient(180deg,rgba(255,252,244,0.98),rgba(249,242,224,0.98))] p-4 text-center shadow-[0_16px_34px_rgba(115,92,40,0.08)] disabled:opacity-60"
            >
              <span className="text-3xl" aria-hidden="true">🔥</span>
              <span className="text-sm font-semibold text-[#6a5530]">{str.stovetopLabel}</span>
              {cookingRecipeId && selectedRecipe?.cookMethod === "stove" ? (
                <span className="text-xs text-gray-500">{str.cooking}</span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => void handleCook("oven")}
              disabled={cookingRecipeId !== null}
              aria-label={str.ovenAria}
              className="flex flex-col items-center gap-2 rounded-[1.25rem] border border-[#dcc38a] bg-[linear-gradient(180deg,rgba(255,252,244,0.98),rgba(249,242,224,0.98))] p-4 text-center shadow-[0_16px_34px_rgba(115,92,40,0.08)] disabled:opacity-60"
            >
              <span className="text-3xl" aria-hidden="true">♨️</span>
              <span className="text-sm font-semibold text-[#6a5530]">{str.ovenLabel}</span>
              {cookingRecipeId && selectedRecipe?.cookMethod === "oven" ? (
                <span className="text-xs text-gray-500">{str.cooking}</span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setIsBookOpen(true)}
              aria-haspopup="dialog"
              aria-label={str.bookOpenAria}
              className="flex flex-col items-center gap-2 rounded-[1.25rem] border border-[#dcc38a] bg-[linear-gradient(180deg,rgba(255,252,244,0.98),rgba(249,242,224,0.98))] p-4 text-center shadow-[0_16px_34px_rgba(115,92,40,0.08)]"
            >
              <span className="text-3xl" aria-hidden="true">📖</span>
              <span className="text-sm font-semibold text-[#6a5530]">{str.bookLabel}</span>
              <span className="rounded-full bg-[#fcf8ef] px-2 py-0.5 text-xs font-medium text-[#8b6f2f]">
                {selectedRecipe
                  ? `${str.recipeSelectedPrefix} ${getShopRecipeContentForLocale(selectedRecipe, locale).title}`
                  : `${cookableRecipes.filter((recipe) => unlockedRecipeIds.has(recipe.id) && computeShopCookReadiness(recipe, availabilityByKey).isReady).length} ${str.recipesReadySuffix}`}
              </span>
            </button>
          </div>
        </div>
      )}

      {isCupboardOpen ? (
        <CupboardModal
          ingredients={ingredientPrices}
          ingredientRecordsByKey={ingredientRecordsByKey}
          availabilityByKey={availabilityByKey}
          locale={locale}
          strings={str}
          onClose={() => setIsCupboardOpen(false)}
        />
      ) : null}

      {isBookOpen ? (
        <RecipeBookModal
          recipes={cookableRecipes}
          unlockedRecipeIds={unlockedRecipeIds}
          availabilityByKey={availabilityByKey}
          ingredientRecordsByKey={ingredientRecordsByKey}
          selectedRecipeId={selectedRecipeId}
          onSelectRecipe={(recipeId) =>
            setSelectedRecipeId((current) => (current === recipeId ? null : recipeId))
          }
          locale={locale}
          strings={str}
          onClose={() => setIsBookOpen(false)}
        />
      ) : null}

      {dragState && typeof document !== "undefined"
        ? createPortal(
            // Position tracks the pointer every frame during a drag -- an
            // unavoidable runtime value, not a static style, hence the one
            // inline style in this file (see BUILD_CONVENTIONS.md §7).
            <div
              className="pointer-events-none fixed z-[150] flex flex-col items-center gap-1 opacity-90"
              style={{ left: dragState.x - 24, top: dragState.y - 48 }}
            >
              <span className="text-3xl" aria-hidden="true">
                {tileTitleAndIcon(dragState.recipeId).iconPath ? (
                  <img
                    src={tileTitleAndIcon(dragState.recipeId).iconPath ?? undefined}
                    alt=""
                    className="h-9 w-9 object-contain"
                  />
                ) : (
                  "🍽️"
                )}
              </span>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
