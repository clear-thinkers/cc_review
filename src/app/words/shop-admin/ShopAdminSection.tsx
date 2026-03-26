"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/app/shared/locale";
import { useSession } from "@/lib/authContext";
import {
  SHOP_INGREDIENT_QUANTITY_MAX,
  SHOP_INGREDIENT_QUANTITY_MIN,
  getShopRecipeContentForLocale,
  parseShopIngredientQuantity,
  resolvePlainShopRecipeIconPath,
} from "@/lib/shop";
import type { ShopIngredient, ShopLocale, ShopRecipe } from "../shop/shop.types";
import {
  canonicalizeShopIngredientKey,
  type ShopAdminIngredientCatalogItem,
  type ShopAdminIngredientPricesResponse,
} from "../shop/shopIngredients";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import {
  SHOP_ADMIN_INGREDIENT_SAVE_ERROR_CODES,
  areShopAdminIngredientDraftsEqual,
  areShopRecipeAdminDraftsEqual,
  buildShopAdminIngredientDrafts,
  buildShopRecipeAdminDraft,
  createEmptyShopAdminIngredientDraft,
  isShopAdminIngredientSaveErrorCode,
  listShopAdminVariantIngredientOptions,
  removeDeletedIngredientKeysFromRecipe,
  removeDeletedIngredientKeysFromRecipeAdminDraft,
  serializeShopAdminIngredientDrafts,
  validateShopAdminIngredientDrafts,
  validateShopRecipeAdminDraft,
  type ShopAdminIngredientDraft,
  type ShopAdminIngredientSaveErrorResponse,
  type ShopAdminRecipesResponse,
  type ShopRecipeAdminDraft,
} from "./shopAdmin.types";

type LoadState = "idle" | "loading" | "ready" | "error";
type NoticeState = { kind: "success" | "error"; message: string } | null;
type IngredientUsageFilter = "all" | "base" | "special" | "unused";

const PANEL = "rounded-[1.5rem] border border-[#e3dac6] bg-[#fffdf8] p-5 md:p-6";
const LABEL = "shop-admin-label text-sm font-semibold leading-6 text-[#8b7c5a]";
const TOGGLE_BUTTON =
  "shop-admin-pill border border-[#d7c8a5] bg-white px-4 py-2 text-sm font-semibold text-[#6b6658] transition hover:border-[#c9ae63] hover:text-[#8b6f2f]";
const INPUT =
  "mt-2 w-full rounded-xl border border-[#d8cfba] bg-white px-4 py-3 text-sm text-[#24423a] outline-none transition focus:border-[#c9ae63] focus:ring-1 focus:ring-[#e8d79b]";
const READONLY =
  "mt-2 rounded-xl border border-[#e5dcc9] bg-[#f8f4ea] px-4 py-3 text-sm text-[#536859]";
const INGREDIENT_SECTION_CONTENT_ID = "shop-admin-ingredient-pricing-content";
const RECIPE_SECTION_CONTENT_ID = "shop-admin-recipe-management-content";

function getRecipeIconPath(recipe: ShopRecipe): string | null {
  return (
    resolvePlainShopRecipeIconPath(recipe.variantIconRules) ??
    recipe.variantIconRules[0]?.iconPath ??
    null
  );
}

function isPlainVariantRuleIcon(iconPath: string): boolean {
  return iconPath.trim().toLowerCase().split("/").at(-1)?.includes("plain") ?? false;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function swapItems<T>(items: T[], fromIndex: number, direction: -1 | 1): T[] {
  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= items.length) {
    return items;
  }

  const next = [...items];
  [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
  return next;
}

function clearIngredientKey(ingredient: ShopIngredient): ShopIngredient {
  const { ingredientKey: _discarded, ...next } = ingredient;
  return next;
}

function buildIngredientFromCatalogItem(
  ingredient: ShopAdminIngredientCatalogItem,
  locale: ShopLocale,
  quantity: number
): ShopIngredient {
  return {
    ingredientKey: ingredient.key,
    name: ingredient.label[locale],
    quantity,
  };
}

function matchesIngredientUsageFilter(
  ingredient: ShopAdminIngredientDraft,
  filter: IngredientUsageFilter
): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "base") {
    return ingredient.usage.usedInBase;
  }
  if (filter === "special") {
    return ingredient.usage.usedInSpecial;
  }
  return !ingredient.usage.usedInBase && !ingredient.usage.usedInSpecial;
}

function isManagedIngredientInUse(ingredient: ShopAdminIngredientDraft): boolean {
  return ingredient.usage.usedInBase || ingredient.usage.usedInSpecial;
}

function buildDraftId(): string {
  return `ingredient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ShopAdminSection({ vm }: { vm: WordsWorkspaceVM }) {
  const locale = useLocale();
  const session = useSession();
  const strings = vm.str.shopAdmin;
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [recipes, setRecipes] = useState<ShopRecipe[]>([]);
  const [ingredientCatalogBaseline, setIngredientCatalogBaseline] = useState<
    ShopAdminIngredientDraft[]
  >([]);
  const [ingredientCatalogDraft, setIngredientCatalogDraft] = useState<
    ShopAdminIngredientDraft[]
  >([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [baselineDraft, setBaselineDraft] = useState<ShopRecipeAdminDraft | null>(null);
  const [draft, setDraft] = useState<ShopRecipeAdminDraft | null>(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<NoticeState>(null);
  const [ingredientNotice, setIngredientNotice] = useState<NoticeState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingIngredients, setIsSavingIngredients] = useState(false);
  const [isIngredientSectionCollapsed, setIsIngredientSectionCollapsed] = useState(true);
  const [isRecipeSectionCollapsed, setIsRecipeSectionCollapsed] = useState(false);
  const [ingredientUsageFilter, setIngredientUsageFilter] =
    useState<IngredientUsageFilter>("all");

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null,
    [recipes, selectedRecipeId]
  );
  const localizedSelectedRecipe = useMemo(
    () => (selectedRecipe ? getShopRecipeContentForLocale(selectedRecipe, locale) : null),
    [selectedRecipe, locale]
  );
  const recipeValidationErrors = useMemo(
    () => (draft ? validateShopRecipeAdminDraft(draft) : []),
    [draft]
  );
  const ingredientValidationErrors = useMemo(
    () => validateShopAdminIngredientDrafts(ingredientCatalogDraft),
    [ingredientCatalogDraft]
  );
  const hasUnsavedRecipeChanges = useMemo(
    () =>
      draft !== null &&
      baselineDraft !== null &&
      !areShopRecipeAdminDraftsEqual(draft, baselineDraft),
    [draft, baselineDraft]
  );
  const hasUnsavedIngredientChanges = useMemo(
    () => !areShopAdminIngredientDraftsEqual(ingredientCatalogDraft, ingredientCatalogBaseline),
    [ingredientCatalogBaseline, ingredientCatalogDraft]
  );
  const availableIngredientCatalogItems = useMemo(
    () =>
      serializeShopAdminIngredientDrafts(ingredientCatalogDraft).filter(
        (ingredient) => ingredient.key && ingredient.label.en && ingredient.label.zh
      ),
    [ingredientCatalogDraft]
  );
  const filteredIngredientCatalogDraft = useMemo(
    () =>
      ingredientCatalogDraft.filter((ingredient) =>
        matchesIngredientUsageFilter(ingredient, ingredientUsageFilter)
      ),
    [ingredientCatalogDraft, ingredientUsageFilter]
  );
  const ingredientCatalogItemByKey = useMemo(
    () =>
      new Map(
        availableIngredientCatalogItems.map((ingredient) => [ingredient.key, ingredient] as const)
      ),
    [availableIngredientCatalogItems]
  );
  const variantIngredientOptions = useMemo(
    () => (draft ? listShopAdminVariantIngredientOptions(draft.specialIngredients) : []),
    [draft]
  );
  const variantIngredientOptionByKey = useMemo(
    () => new Map(variantIngredientOptions.map((option) => [option.key, option] as const)),
    [variantIngredientOptions]
  );

  useEffect(() => {
    if (vm.page !== "shopAdmin" || !session?.isPlatformAdmin) {
      return;
    }

    const accessToken = session.supabaseSession.access_token;
    let isCancelled = false;

    async function loadShopAdmin(): Promise<void> {
      setLoadState("loading");
      setLoadError("");

      try {
        const [recipesResponse, ingredientsResponse] = await Promise.all([
          fetch("/api/shop-admin/recipes", {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch("/api/shop-admin/ingredient-prices", {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);
        const recipesJson = (await recipesResponse.json()) as
          | ShopAdminRecipesResponse
          | { error?: string };
        const ingredientsJson = (await ingredientsResponse.json()) as
          | ShopAdminIngredientPricesResponse
          | { error?: string };

        if (!recipesResponse.ok) {
          throw new Error(
            typeof recipesJson === "object" && recipesJson && "error" in recipesJson
              ? recipesJson.error || strings.loadError
              : strings.loadError
          );
        }
        if (!ingredientsResponse.ok) {
          throw new Error(
            typeof ingredientsJson === "object" && ingredientsJson && "error" in ingredientsJson
              ? ingredientsJson.error || strings.ingredientPricing.loadError
              : strings.ingredientPricing.loadError
          );
        }

        const nextRecipes =
          "recipes" in recipesJson && Array.isArray(recipesJson.recipes)
            ? recipesJson.recipes
            : [];
        const nextIngredientItems =
          "ingredients" in ingredientsJson && Array.isArray(ingredientsJson.ingredients)
            ? buildShopAdminIngredientDrafts(ingredientsJson.ingredients)
            : [];

        if (isCancelled) {
          return;
        }

        const nextRecipe =
          nextRecipes.find((recipe) => recipe.id === selectedRecipeId) ?? nextRecipes[0] ?? null;
        const nextRecipeDraft = nextRecipe ? buildShopRecipeAdminDraft(nextRecipe) : null;

        setRecipes(nextRecipes);
        setIngredientCatalogBaseline(nextIngredientItems);
        setIngredientCatalogDraft(nextIngredientItems);
        setSelectedRecipeId(nextRecipe?.id ?? null);
        setBaselineDraft(nextRecipeDraft);
        setDraft(nextRecipeDraft);
        setNotice(null);
        setIngredientNotice(null);
        setLoadState("ready");
      } catch (error) {
        if (!isCancelled) {
          setLoadError(getErrorMessage(error, strings.loadError));
          setLoadState("error");
        }
      }
    }

    void loadShopAdmin();
    return () => {
      isCancelled = true;
    };
  }, [
    selectedRecipeId,
    session?.isPlatformAdmin,
    session?.supabaseSession.access_token,
    strings.ingredientPricing.loadError,
    strings.loadError,
    vm.page,
  ]);

  if (vm.page !== "shopAdmin") {
    return null;
  }

  function resetToRecipe(recipe: ShopRecipe | null): void {
    setSelectedRecipeId(recipe?.id ?? null);
    const nextDraft = recipe ? buildShopRecipeAdminDraft(recipe) : null;
    setBaselineDraft(nextDraft);
    setDraft(nextDraft);
    setNotice(null);
  }

  function updateDraft(updater: (current: ShopRecipeAdminDraft) => ShopRecipeAdminDraft): void {
    setDraft((current) => (current ? updater(current) : current));
    setNotice(null);
  }

  function updateText(field: "title" | "intro", targetLocale: ShopLocale, value: string): void {
    updateDraft((current) => ({
      ...current,
      [field]: {
        ...current[field],
        [targetLocale]: value,
      },
    }));
  }

  function updateIngredientName(
    type: "baseIngredients" | "specialIngredients",
    targetLocale: ShopLocale,
    index: number,
    value: string
  ): void {
    updateDraft((current) => {
      const next = {
        ...current,
        [type]: {
          en: current[type].en.map((ingredient) => ({ ...ingredient })),
          zh: current[type].zh.map((ingredient) => ({ ...ingredient })),
        },
      };

      next[type][targetLocale][index] = {
        ...next[type][targetLocale][index],
        name: value,
      };

      return next;
    });
  }

  function updateIngredientQuantity(
    type: "baseIngredients" | "specialIngredients",
    index: number,
    rawValue: string
  ): void {
    updateDraft((current) => {
      const next = {
        ...current,
        [type]: {
          en: current[type].en.map((ingredient) => ({ ...ingredient })),
          zh: current[type].zh.map((ingredient) => ({ ...ingredient })),
        },
      };
      const parsedQuantity =
        parseShopIngredientQuantity(rawValue) ?? SHOP_INGREDIENT_QUANTITY_MIN;

      next[type].en[index] = {
        ...next[type].en[index],
        quantity: parsedQuantity,
      };
      next[type].zh[index] = {
        ...next[type].zh[index],
        quantity: parsedQuantity,
      };

      return next;
    });
  }

  function addIngredientRow(type: "baseIngredients" | "specialIngredients"): void {
    updateDraft((current) => ({
      ...current,
      [type]: {
        en: [...current[type].en, { name: "", quantity: SHOP_INGREDIENT_QUANTITY_MIN }],
        zh: [...current[type].zh, { name: "", quantity: SHOP_INGREDIENT_QUANTITY_MIN }],
      },
    }));
  }

  function updateIngredientCatalogSelection(
    type: "baseIngredients" | "specialIngredients",
    index: number,
    ingredientKey: string
  ): void {
    updateDraft((current) => {
      const next = {
        ...current,
        [type]: {
          en: current[type].en.map((ingredient) => ({ ...ingredient })),
          zh: current[type].zh.map((ingredient) => ({ ...ingredient })),
        },
      };
      const quantity = next[type].en[index]?.quantity ?? SHOP_INGREDIENT_QUANTITY_MIN;
      const canonicalKey = canonicalizeShopIngredientKey(ingredientKey);

      if (!canonicalKey) {
        next[type].en[index] = clearIngredientKey(next[type].en[index]);
        next[type].zh[index] = clearIngredientKey(next[type].zh[index]);
        return next;
      }

      const entry = ingredientCatalogItemByKey.get(canonicalKey) ?? null;
      if (!entry) {
        next[type].en[index] = {
          ...next[type].en[index],
          ingredientKey: canonicalKey,
        };
        next[type].zh[index] = {
          ...next[type].zh[index],
          ingredientKey: canonicalKey,
        };
        return next;
      }

      next[type].en[index] = buildIngredientFromCatalogItem(entry, "en", quantity);
      next[type].zh[index] = buildIngredientFromCatalogItem(entry, "zh", quantity);
      return next;
    });
  }

  function moveIngredientRow(
    type: "baseIngredients" | "specialIngredients",
    index: number,
    direction: -1 | 1
  ): void {
    updateDraft((current) => ({
      ...current,
      [type]: {
        en: swapItems(current[type].en, index, direction),
        zh: swapItems(current[type].zh, index, direction),
      },
    }));
  }

  function removeIngredientRow(type: "baseIngredients" | "specialIngredients", index: number): void {
    updateDraft((current) => ({
      ...current,
      [type]: {
        en: current[type].en.filter((_, rowIndex) => rowIndex !== index),
        zh: current[type].zh.filter((_, rowIndex) => rowIndex !== index),
      },
    }));
  }

  function updateVariantRuleMatch(
    ruleIndex: number,
    ingredientKey: string,
    checked: boolean
  ): void {
    updateDraft((current) => ({
      ...current,
      variantIconRules: current.variantIconRules.map((rule, currentIndex) => {
        if (currentIndex !== ruleIndex) {
          return rule;
        }

        const nextMatch = checked
          ? [...rule.match, ingredientKey]
          : rule.match.filter((key) => key !== ingredientKey);

        return {
          ...rule,
          match: Array.from(new Set(nextMatch)).sort((left, right) => left.localeCompare(right)),
        };
      }),
    }));
  }

  function handleSelectRecipe(recipeId: string): void {
    if (recipeId === selectedRecipeId) {
      return;
    }

    if (hasUnsavedRecipeChanges && !window.confirm(strings.notices.discardChanges)) {
      return;
    }

    resetToRecipe(recipes.find((recipe) => recipe.id === recipeId) ?? null);
  }

  async function handleRecipeSave(): Promise<void> {
    if (!draft || recipeValidationErrors.length > 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/shop-admin/recipes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.supabaseSession.access_token ?? ""}`,
        },
        body: JSON.stringify(draft),
      });
      const json = (await response.json()) as { recipe?: ShopRecipe; error?: string };
      if (!response.ok || !json.recipe) {
        throw new Error(json.error || strings.notices.saveError);
      }

      setRecipes((current) =>
        current.map((recipe) => (recipe.id === json.recipe?.id ? json.recipe : recipe))
      );
      const nextDraft = buildShopRecipeAdminDraft(json.recipe);
      setBaselineDraft(nextDraft);
      setDraft(nextDraft);
      setNotice({ kind: "success", message: strings.notices.saveSuccess });
    } catch (error) {
      setNotice({ kind: "error", message: getErrorMessage(error, strings.notices.saveError) });
    } finally {
      setIsSaving(false);
    }
  }

  function updateIngredientDraft(
    draftId: string,
    updater: (current: ShopAdminIngredientDraft) => ShopAdminIngredientDraft
  ): void {
    setIngredientCatalogDraft((current) =>
      current.map((ingredient) =>
        ingredient.draftId === draftId ? updater(ingredient) : ingredient
      )
    );
    setIngredientNotice(null);
  }

  function addManagedIngredient(): void {
    setIngredientCatalogDraft((current) => [
      ...current,
      createEmptyShopAdminIngredientDraft(buildDraftId()),
    ]);
    setIngredientNotice(null);
  }

  function updateManagedIngredientKey(draftId: string, value: string): void {
    updateIngredientDraft(draftId, (current) =>
      current.isPersisted
        ? current
        : {
            ...current,
            key: value,
          }
    );
  }

  function updateManagedIngredientLabel(
    draftId: string,
    targetLocale: ShopLocale,
    value: string
  ): void {
    updateIngredientDraft(draftId, (current) => ({
      ...current,
      label: {
        ...current.label,
        [targetLocale]: value,
      },
    }));
  }

  function updateManagedIngredientIconPath(draftId: string, value: string): void {
    updateIngredientDraft(draftId, (current) => ({
      ...current,
      iconPath: value,
    }));
  }

  function updateManagedIngredientPrice(draftId: string, rawValue: string): void {
    const parsedValue = Number.parseInt(rawValue, 10);
    updateIngredientDraft(draftId, (current) => ({
      ...current,
      costCoins: Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : current.costCoins,
    }));
  }

  function deleteManagedIngredient(draftId: string): void {
    setIngredientCatalogDraft((current) =>
      current.filter((ingredient) => ingredient.draftId !== draftId)
    );
    setIngredientNotice(null);
  }

  async function handleIngredientSave(): Promise<void> {
    if (ingredientValidationErrors.length > 0 || isSavingIngredients) {
      return;
    }

    setIsSavingIngredients(true);
    setIngredientNotice(null);

    const serializedDrafts = serializeShopAdminIngredientDrafts(ingredientCatalogDraft);
    const baselineKeys = new Set(
      serializeShopAdminIngredientDrafts(ingredientCatalogBaseline).map((ingredient) => ingredient.key)
    );
    const nextKeys = new Set(serializedDrafts.map((ingredient) => ingredient.key));
    const deletedIngredientKeys = [...baselineKeys].filter(
      (ingredientKey) => !nextKeys.has(ingredientKey)
    );

    try {
      const response = await fetch("/api/shop-admin/ingredient-prices", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.supabaseSession.access_token ?? ""}`,
        },
        body: JSON.stringify({
          ingredients: serializedDrafts,
        }),
      });
      const json = (await response.json()) as
        | ShopAdminIngredientPricesResponse
        | ShopAdminIngredientSaveErrorResponse;
      if (!response.ok || !("ingredients" in json) || !Array.isArray(json.ingredients)) {
        const saveErrorCode =
          typeof json === "object" &&
          json &&
          "errorCode" in json &&
          isShopAdminIngredientSaveErrorCode(json.errorCode)
            ? json.errorCode
            : null;
        throw new Error(
          saveErrorCode === SHOP_ADMIN_INGREDIENT_SAVE_ERROR_CODES.missingIconPathColumn
            ? strings.ingredientPricing.iconPathColumnMissing
            : typeof json === "object" && json && "error" in json
              ? json.error || strings.ingredientPricing.saveError
              : strings.ingredientPricing.saveError
        );
      }

      const nextDrafts = buildShopAdminIngredientDrafts(json.ingredients);
      setIngredientCatalogBaseline(nextDrafts);
      setIngredientCatalogDraft(nextDrafts);
      if (deletedIngredientKeys.length > 0) {
        setRecipes((current) =>
          current.map((recipe) => removeDeletedIngredientKeysFromRecipe(recipe, deletedIngredientKeys))
        );
        setBaselineDraft((current) =>
          current
            ? removeDeletedIngredientKeysFromRecipeAdminDraft(current, deletedIngredientKeys)
            : current
        );
        setDraft((current) =>
          current
            ? removeDeletedIngredientKeysFromRecipeAdminDraft(current, deletedIngredientKeys)
            : current
        );
      }
      setIngredientNotice({ kind: "success", message: strings.ingredientPricing.saveSuccess });
    } catch (error) {
      setIngredientNotice({
        kind: "error",
        message: getErrorMessage(error, strings.ingredientPricing.saveError),
      });
    } finally {
      setIsSavingIngredients(false);
    }
  }

  if (!session?.isPlatformAdmin) {
    return (
      <section className={PANEL}>
        <p className="text-sm text-[#6b6658]">{strings.platformAdminOnly}</p>
      </section>
    );
  }

  if (loadState === "loading" || loadState === "idle") {
    return (
      <section className={PANEL}>
        <p className="text-sm text-[#6b6658]">{strings.loading}</p>
      </section>
    );
  }

  if (loadState === "error") {
    return (
      <section className={PANEL}>
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError || strings.loadError}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className={`shop-admin-pane ${PANEL}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className={LABEL}>{strings.ingredientPricing.title}</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#24423a]">
              {strings.ingredientPricing.heading}
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-[#627665]">
              {strings.ingredientPricing.helper}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              title={
                isIngredientSectionCollapsed
                  ? strings.collapsible.expand
                  : strings.collapsible.collapse
              }
              aria-controls={INGREDIENT_SECTION_CONTENT_ID}
              aria-expanded={!isIngredientSectionCollapsed}
              onClick={() => setIsIngredientSectionCollapsed((current) => !current)}
              className={TOGGLE_BUTTON}
            >
              {isIngredientSectionCollapsed
                ? strings.collapsible.expand
                : strings.collapsible.collapse}
            </button>
            <button
              type="button"
              onClick={addManagedIngredient}
              className="shop-admin-pill border border-[#d2b15b] bg-[#fff4d9] px-4 py-2 text-sm font-semibold text-[#8b6f2f]"
            >
              {strings.ingredientPricing.add}
            </button>
            <button
              type="button"
              onClick={() => {
                setIngredientCatalogDraft(ingredientCatalogBaseline);
                setIngredientNotice(null);
              }}
              disabled={!hasUnsavedIngredientChanges || isSavingIngredients}
              className="shop-admin-pill border border-[#d7c8a5] px-4 py-2 text-sm font-semibold text-[#6b6658] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {strings.ingredientPricing.reset}
            </button>
            <button
              type="button"
              onClick={() => void handleIngredientSave()}
              disabled={
                !hasUnsavedIngredientChanges ||
                ingredientValidationErrors.length > 0 ||
                isSavingIngredients
              }
              className="shop-admin-pill border border-[#d2b15b] bg-[#fff0bf] px-5 py-2 text-sm font-semibold text-[#8b6f2f] shadow-[0_8px_20px_rgba(210,177,91,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingIngredients ? strings.ingredientPricing.saving : strings.ingredientPricing.save}
            </button>
          </div>
        </div>

        <div
          id={INGREDIENT_SECTION_CONTENT_ID}
          hidden={isIngredientSectionCollapsed}
        >

        <div className="mt-5 flex flex-wrap gap-2">
          {(
            [
              ["all", strings.ingredientPricing.filterAll],
              ["base", strings.ingredientPricing.filterBase],
              ["special", strings.ingredientPricing.filterSpecial],
              ["unused", strings.ingredientPricing.filterUnused],
            ] as const
          ).map(([filterValue, filterLabel]) => {
            const isActive = ingredientUsageFilter === filterValue;
            return (
              <button
                key={filterValue}
                type="button"
                title={filterLabel}
                onClick={() => setIngredientUsageFilter(filterValue)}
                className={`shop-admin-pill border px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "border-[#d2b15b] bg-[#fff0bf] text-[#8b6f2f] shadow-[0_8px_20px_rgba(210,177,91,0.18)]"
                    : "border-[#d7c8a5] bg-white text-[#6b6658]"
                }`}
              >
                {filterLabel}
              </button>
            );
          })}
        </div>

        {ingredientNotice ? (
          <p
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              ingredientNotice.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {ingredientNotice.message}
          </p>
        ) : null}

        {ingredientValidationErrors.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            <p className="font-semibold">{strings.ingredientPricing.validation}</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              {ingredientValidationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {filteredIngredientCatalogDraft.length === 0 ? (
          <p className="mt-6 rounded-xl border border-[#e4dac7] bg-white px-4 py-3 text-sm text-[#627665]">
            {strings.ingredientPricing.emptyState}
          </p>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredIngredientCatalogDraft.map((ingredient) => (
              <div
                key={ingredient.draftId}
                className="rounded-xl border border-[#e4dac7] bg-white p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[#eadfc1] bg-[#fffaf0]">
                    {ingredient.iconPath ? (
                      <img
                        src={ingredient.iconPath}
                        alt={ingredient.label[locale] || ingredient.key}
                        className="h-12 w-12 object-contain"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-[#9a8f79]">
                        {strings.ingredients.noIcon}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2">
                      {ingredient.usage.usedInBase ? (
                        <span className="rounded-full bg-[#eef3e8] px-2.5 py-1 text-[11px] font-semibold text-[#607451]">
                          {strings.ingredientPricing.baseBadge}
                        </span>
                      ) : null}
                      {ingredient.usage.usedInSpecial ? (
                        <span className="rounded-full bg-[#f4ebd3] px-2.5 py-1 text-[11px] font-semibold text-[#8b6f2f]">
                          {strings.ingredientPricing.specialBadge}
                        </span>
                      ) : null}
                      {!ingredient.usage.usedInBase && !ingredient.usage.usedInSpecial ? (
                        <span className="rounded-full bg-[#f8f4ea] px-2.5 py-1 text-[11px] font-semibold text-[#7c7464]">
                          {strings.ingredientPricing.unusedBadge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-[#7c7464]">
                      {ingredient.isPersisted
                        ? strings.ingredientPricing.keyReadonly
                        : strings.ingredientPricing.keyEditable}
                    </p>
                  </div>
                </div>

                <label className="mt-4 block">
                  <span className={LABEL}>{strings.ingredientPricing.key}</span>
                  <input
                    value={ingredient.key}
                    onChange={(event) =>
                      updateManagedIngredientKey(ingredient.draftId, event.target.value)
                    }
                    disabled={ingredient.isPersisted}
                    className={ingredient.isPersisted ? READONLY : INPUT}
                    placeholder={strings.ingredientPricing.keyPlaceholder}
                  />
                </label>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <label className="block">
                    <span className={LABEL}>{strings.ingredients.nameEnglish}</span>
                    <input
                      value={ingredient.label.en}
                      onChange={(event) =>
                        updateManagedIngredientLabel(ingredient.draftId, "en", event.target.value)
                      }
                      className={INPUT}
                      maxLength={60}
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL}>{strings.ingredients.nameChinese}</span>
                    <input
                      value={ingredient.label.zh}
                      onChange={(event) =>
                        updateManagedIngredientLabel(ingredient.draftId, "zh", event.target.value)
                      }
                      className={INPUT}
                      maxLength={60}
                    />
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className={LABEL}>{strings.ingredientPricing.iconPath}</span>
                  <input
                    value={ingredient.iconPath}
                    onChange={(event) =>
                      updateManagedIngredientIconPath(ingredient.draftId, event.target.value)
                    }
                    className={INPUT}
                    placeholder="/ingredients/example.png"
                  />
                </label>

                <label className="mt-4 block">
                  <span className={LABEL}>{strings.ingredientPricing.cost}</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={ingredient.costCoins}
                    onChange={(event) =>
                      updateManagedIngredientPrice(ingredient.draftId, event.target.value)
                    }
                    className={INPUT}
                  />
                </label>

                <div className="mt-4 border-t border-[#efe4d0] pt-4">
                  {isManagedIngredientInUse(ingredient) ? (
                    <p className="rounded-xl border border-[#f0d9b6] bg-[#fff7ea] px-3 py-2 text-sm text-[#8b6f2f]">
                      {strings.ingredientPricing.deleteInUseWarning}
                    </p>
                  ) : null}
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => deleteManagedIngredient(ingredient.draftId)}
                      className="shop-admin-pill border border-[#e7b8b2] bg-[#fff3f1] px-4 py-2 text-sm font-semibold text-[#a04f46]"
                    >
                      {strings.ingredientPricing.delete}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </section>

      <section className={`shop-admin-pane ${PANEL}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className={LABEL}>{strings.recipeManagement.title}</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#24423a]">
              {strings.recipeManagement.heading}
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-[#627665]">
              {strings.recipeManagement.helper}
            </p>
          </div>
          <div className="flex flex-wrap items-start justify-end gap-3">
            <button
              type="button"
              title={
                isRecipeSectionCollapsed ? strings.collapsible.expand : strings.collapsible.collapse
              }
              aria-controls={RECIPE_SECTION_CONTENT_ID}
              aria-expanded={!isRecipeSectionCollapsed}
              onClick={() => setIsRecipeSectionCollapsed((current) => !current)}
              className={TOGGLE_BUTTON}
            >
              {isRecipeSectionCollapsed ? strings.collapsible.expand : strings.collapsible.collapse}
            </button>
            <div className="rounded-2xl border border-[#e6dbc2] bg-white px-4 py-3 text-sm text-[#627665]">
              {selectedRecipe ? (
                <span>
                  {strings.selectedRecipe}:{" "}
                  <span className="font-semibold text-[#24423a]">
                    {localizedSelectedRecipe?.title ?? selectedRecipe.slug}
                  </span>
                </span>
              ) : (
                strings.empty
              )}
            </div>
          </div>
        </div>

        <div
          id={RECIPE_SECTION_CONTENT_ID}
          hidden={isRecipeSectionCollapsed}
        >

        {notice ? (
          <p
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              notice.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {notice.message}
          </p>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-[1.25rem] border border-[#e4dac7] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className={LABEL}>{strings.recipeListTitle}</p>
              <span className="text-xs font-semibold text-[#7c7464]">{recipes.length}</span>
            </div>

            {recipes.length === 0 ? (
              <p className="mt-4 text-sm text-[#627665]">{strings.empty}</p>
            ) : (
              <div className="mt-4 space-y-3">
                {recipes.map((recipe) => {
                  const localizedRecipe = getShopRecipeContentForLocale(recipe, locale);
                  const iconPath = getRecipeIconPath(recipe);
                  const isSelected = recipe.id === selectedRecipeId;

                  return (
                    <button
                      key={recipe.id}
                      type="button"
                      onClick={() => handleSelectRecipe(recipe.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? "border-[#d2b15b] bg-[#fff6de] shadow-[0_8px_20px_rgba(210,177,91,0.18)]"
                          : "border-[#e4dac7] bg-white hover:border-[#d7c8a5]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#eadfc1] bg-[#fffaf0]">
                          {iconPath ? (
                            <img
                              src={iconPath}
                              alt={localizedRecipe.title}
                              className="h-10 w-10 object-contain"
                            />
                          ) : (
                            <span className="text-[#9a8f79]">?</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-semibold text-[#24423a]">
                              {localizedRecipe.title}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                recipe.isActive
                                  ? "bg-[#eef3e8] text-[#607451]"
                                  : "bg-[#f8f4ea] text-[#7c7464]"
                              }`}
                            >
                              {recipe.isActive ? strings.activeBadge : strings.inactiveBadge}
                            </span>
                            {isSelected && hasUnsavedRecipeChanges ? (
                              <span className="rounded-full bg-[#fff0bf] px-2.5 py-1 text-[11px] font-semibold text-[#8b6f2f]">
                                {strings.unsavedBadge}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-xs text-[#7c7464]">{recipe.slug}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          {draft && selectedRecipe ? (
            <form
              className="rounded-[1.25rem] border border-[#e4dac7] bg-white p-5"
              onSubmit={(event) => {
                event.preventDefault();
                void handleRecipeSave();
              }}
            >
              {recipeValidationErrors.length > 0 ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                  <p className="font-semibold">{strings.saveBar.validation}</p>
                  <ul className="mt-3 list-disc space-y-2 pl-5">
                    {recipeValidationErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <p className={LABEL}>{strings.form.basicInfo}</p>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <label className="block">
                    <span className={LABEL}>{strings.fields.titleEnglish}</span>
                    <input
                      value={draft.title.en}
                      onChange={(event) => updateText("title", "en", event.target.value)}
                      className={INPUT}
                      maxLength={80}
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL}>{strings.fields.titleChinese}</span>
                    <input
                      value={draft.title.zh}
                      onChange={(event) => updateText("title", "zh", event.target.value)}
                      className={INPUT}
                      maxLength={80}
                    />
                  </label>
                  <label className="block xl:col-span-2">
                    <span className={LABEL}>{strings.fields.introEnglish}</span>
                    <textarea
                      value={draft.intro.en}
                      onChange={(event) => updateText("intro", "en", event.target.value)}
                      className={INPUT}
                      rows={3}
                      maxLength={240}
                    />
                  </label>
                  <label className="block xl:col-span-2">
                    <span className={LABEL}>{strings.fields.introChinese}</span>
                    <textarea
                      value={draft.intro.zh}
                      onChange={(event) => updateText("intro", "zh", event.target.value)}
                      className={INPUT}
                      rows={3}
                      maxLength={240}
                    />
                  </label>
                </div>
              </div>

              <div className="mt-8 border-t border-[#eee4d0] pt-8">
                <div className="flex flex-wrap items-center gap-3">
                  <p className={LABEL}>{strings.form.baseIngredients}</p>
                  <button
                    type="button"
                    onClick={() => addIngredientRow("baseIngredients")}
                    className="shop-admin-pill border border-[#d2b15b] bg-[#fff4d9] px-4 py-2 text-sm font-semibold text-[#8b6f2f]"
                  >
                    {strings.ingredients.add}
                  </button>
                </div>
                <p className="mt-2 text-sm leading-7 text-[#627665]">{strings.ingredients.helper}</p>

                <div className="mt-5 space-y-5">
                  {draft.baseIngredients.en.map((englishIngredient, ingredientIndex) => {
                    const chineseIngredient = draft.baseIngredients.zh[ingredientIndex];
                    const selectedIngredientCatalogEntry =
                      ingredientCatalogItemByKey.get(
                        canonicalizeShopIngredientKey(englishIngredient.ingredientKey)
                      ) ?? null;

                    return (
                      <div
                        key={`${selectedRecipe.id}-base-${ingredientIndex}`}
                        className="rounded-xl border border-[#e4dac7] bg-white p-4"
                      >
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_160px]">
                          <label className="block">
                            <span className={LABEL}>{strings.ingredients.catalogIngredient}</span>
                            <select
                              value={englishIngredient.ingredientKey ?? ""}
                              onChange={(event) =>
                                updateIngredientCatalogSelection(
                                  "baseIngredients",
                                  ingredientIndex,
                                  event.target.value
                                )
                              }
                              className={INPUT}
                            >
                              {!selectedIngredientCatalogEntry && englishIngredient.ingredientKey ? (
                                <option value={englishIngredient.ingredientKey}>
                                  {englishIngredient.name || englishIngredient.ingredientKey}
                                </option>
                              ) : null}
                              <option value="">{strings.ingredients.customOption}</option>
                              {availableIngredientCatalogItems.map((catalogEntry) => (
                                <option key={catalogEntry.key} value={catalogEntry.key}>
                                  {catalogEntry.label[locale]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className={LABEL}>{strings.ingredients.quantity}</span>
                            <input
                              type="number"
                              min={SHOP_INGREDIENT_QUANTITY_MIN}
                              max={SHOP_INGREDIENT_QUANTITY_MAX}
                              step={1}
                              value={englishIngredient.quantity}
                              onChange={(event) =>
                                updateIngredientQuantity(
                                  "baseIngredients",
                                  ingredientIndex,
                                  event.target.value
                                )
                              }
                              className={INPUT}
                            />
                          </label>
                          <div className="block">
                            <span className={LABEL}>{strings.ingredients.iconPreview}</span>
                            <div className={`${READONLY} flex min-h-[56px] items-center justify-center`}>
                              {selectedIngredientCatalogEntry?.iconPath ? (
                                <img
                                  src={selectedIngredientCatalogEntry.iconPath}
                                  alt={selectedIngredientCatalogEntry.label[locale]}
                                  className="h-12 w-12 object-contain"
                                />
                              ) : (
                                strings.ingredients.noIcon
                              )}
                            </div>
                          </div>
                        </div>

                        {selectedIngredientCatalogEntry ? null : (
                          <div className="mt-4 grid gap-4 xl:grid-cols-2">
                            <label className="block">
                              <span className={LABEL}>{strings.ingredients.nameEnglish}</span>
                              <input
                                value={englishIngredient.name}
                                onChange={(event) =>
                                  updateIngredientName(
                                    "baseIngredients",
                                    "en",
                                    ingredientIndex,
                                    event.target.value
                                  )
                                }
                                className={INPUT}
                                maxLength={60}
                              />
                            </label>
                            <label className="block">
                              <span className={LABEL}>{strings.ingredients.nameChinese}</span>
                              <input
                                value={chineseIngredient?.name ?? ""}
                                onChange={(event) =>
                                  updateIngredientName(
                                    "baseIngredients",
                                    "zh",
                                    ingredientIndex,
                                    event.target.value
                                  )
                                }
                                className={INPUT}
                                maxLength={60}
                              />
                            </label>
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => moveIngredientRow("baseIngredients", ingredientIndex, -1)}
                            disabled={ingredientIndex === 0}
                            className="shop-admin-pill border border-[#d7c8a5] px-3 py-2 text-xs font-semibold text-[#6b6658] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {strings.ingredients.moveUp}
                          </button>
                          <button
                            type="button"
                            onClick={() => moveIngredientRow("baseIngredients", ingredientIndex, 1)}
                            disabled={ingredientIndex === draft.baseIngredients.en.length - 1}
                            className="shop-admin-pill border border-[#d7c8a5] px-3 py-2 text-xs font-semibold text-[#6b6658] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {strings.ingredients.moveDown}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeIngredientRow("baseIngredients", ingredientIndex)}
                            className="shop-admin-pill border border-[#e7b8b2] bg-[#fff3f1] px-3 py-2 text-xs font-semibold text-[#a04f46]"
                          >
                            {strings.ingredients.remove}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 border-t border-[#eee4d0] pt-8">
                <div className="flex flex-wrap items-center gap-3">
                  <p className={LABEL}>{strings.form.specialtyIngredients}</p>
                  <button
                    type="button"
                    onClick={() => addIngredientRow("specialIngredients")}
                    className="shop-admin-pill border border-[#d2b15b] bg-[#fff4d9] px-4 py-2 text-sm font-semibold text-[#8b6f2f]"
                  >
                    {strings.ingredients.add}
                  </button>
                </div>
                <p className="mt-2 text-sm leading-7 text-[#627665]">{strings.specialty.helper}</p>

                <div className="mt-5 space-y-5">
                  {draft.specialIngredients.en.length === 0 ? (
                    <p className="rounded-xl border border-[#e4dac7] bg-white px-4 py-3 text-sm text-[#627665]">
                      {strings.specialty.noSlots}
                    </p>
                  ) : (
                    draft.specialIngredients.en.map((englishIngredient, ingredientIndex) => {
                      const chineseIngredient = draft.specialIngredients.zh[ingredientIndex];
                      const selectedIngredientCatalogEntry =
                        ingredientCatalogItemByKey.get(
                          canonicalizeShopIngredientKey(englishIngredient.ingredientKey)
                        ) ?? null;

                      return (
                        <div
                          key={`${selectedRecipe.id}-special-${ingredientIndex}`}
                          className="rounded-xl border border-[#e4dac7] bg-white p-4"
                        >
                          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_160px]">
                            <label className="block">
                              <span className={LABEL}>{strings.ingredients.catalogIngredient}</span>
                              <select
                                value={englishIngredient.ingredientKey ?? ""}
                                onChange={(event) =>
                                  updateIngredientCatalogSelection(
                                    "specialIngredients",
                                    ingredientIndex,
                                    event.target.value
                                  )
                                }
                                className={INPUT}
                              >
                                {!selectedIngredientCatalogEntry && englishIngredient.ingredientKey ? (
                                  <option value={englishIngredient.ingredientKey}>
                                    {englishIngredient.name || englishIngredient.ingredientKey}
                                  </option>
                                ) : null}
                                <option value="">{strings.ingredients.customOption}</option>
                                {availableIngredientCatalogItems.map((catalogEntry) => (
                                  <option key={catalogEntry.key} value={catalogEntry.key}>
                                    {catalogEntry.label[locale]}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className={LABEL}>{strings.ingredients.quantity}</span>
                              <input
                                type="number"
                                min={SHOP_INGREDIENT_QUANTITY_MIN}
                                max={SHOP_INGREDIENT_QUANTITY_MAX}
                                step={1}
                                value={englishIngredient.quantity}
                                onChange={(event) =>
                                  updateIngredientQuantity(
                                    "specialIngredients",
                                    ingredientIndex,
                                    event.target.value
                                  )
                                }
                                className={INPUT}
                              />
                            </label>
                            <div className="block">
                              <span className={LABEL}>{strings.ingredients.iconPreview}</span>
                              <div className={`${READONLY} flex min-h-[56px] items-center justify-center`}>
                                {selectedIngredientCatalogEntry?.iconPath ? (
                                  <img
                                    src={selectedIngredientCatalogEntry.iconPath}
                                    alt={selectedIngredientCatalogEntry.label[locale]}
                                    className="h-12 w-12 object-contain"
                                  />
                                ) : (
                                  strings.ingredients.noIcon
                                )}
                              </div>
                            </div>
                          </div>

                          {selectedIngredientCatalogEntry ? null : (
                            <div className="mt-4 grid gap-4 xl:grid-cols-2">
                              <label className="block">
                                <span className={LABEL}>{strings.ingredients.nameEnglish}</span>
                                <input
                                  value={englishIngredient.name}
                                  onChange={(event) =>
                                    updateIngredientName(
                                      "specialIngredients",
                                      "en",
                                      ingredientIndex,
                                      event.target.value
                                    )
                                  }
                                  className={INPUT}
                                  maxLength={60}
                                />
                              </label>
                              <label className="block">
                                <span className={LABEL}>{strings.ingredients.nameChinese}</span>
                                <input
                                  value={chineseIngredient?.name ?? ""}
                                  onChange={(event) =>
                                    updateIngredientName(
                                      "specialIngredients",
                                      "zh",
                                      ingredientIndex,
                                      event.target.value
                                    )
                                  }
                                  className={INPUT}
                                  maxLength={60}
                                />
                              </label>
                            </div>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                moveIngredientRow("specialIngredients", ingredientIndex, -1)
                              }
                              disabled={ingredientIndex === 0}
                              className="shop-admin-pill border border-[#d7c8a5] px-3 py-2 text-xs font-semibold text-[#6b6658] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {strings.ingredients.moveUp}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                moveIngredientRow("specialIngredients", ingredientIndex, 1)
                              }
                              disabled={ingredientIndex === draft.specialIngredients.en.length - 1}
                              className="shop-admin-pill border border-[#d7c8a5] px-3 py-2 text-xs font-semibold text-[#6b6658] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {strings.ingredients.moveDown}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                removeIngredientRow("specialIngredients", ingredientIndex)
                              }
                              className="shop-admin-pill border border-[#e7b8b2] bg-[#fff3f1] px-3 py-2 text-xs font-semibold text-[#a04f46]"
                            >
                              {strings.ingredients.remove}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-6">
                  <p className={LABEL}>{strings.form.variantPreview}</p>
                  <p className="mt-2 text-sm leading-7 text-[#627665]">
                    {strings.specialty.variantHelper}
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {draft.variantIconRules.length === 0 ? (
                      <p className="rounded-xl border border-[#e4dac7] bg-white px-4 py-3 text-sm text-[#627665]">
                        {strings.specialty.noVariants}
                      </p>
                    ) : (
                      draft.variantIconRules.map((rule, ruleIndex) => {
                        const isPlainRule =
                          isPlainVariantRuleIcon(rule.iconPath) && rule.match.length === 0;
                        return (
                          <div
                            key={`${selectedRecipe.id}-${ruleIndex}-${rule.iconPath}`}
                            className="rounded-xl border border-[#e4dac7] bg-white p-4"
                          >
                            <div className="flex h-24 items-center justify-center rounded-xl border border-[#efe4c8] bg-[#fffaf0] p-3">
                              <img
                                src={rule.iconPath}
                                alt={rule.iconPath}
                                className="h-full w-full object-contain"
                              />
                            </div>
                            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#8b6f2f]">
                              {strings.specialty.variantAssigned}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {isPlainRule ? (
                                <span className="rounded-full bg-[#eef3e8] px-3 py-1 text-xs font-semibold text-[#607451]">
                                  {strings.specialty.matchAll}
                                </span>
                              ) : rule.match.length === 0 ? (
                                <span className="rounded-full bg-[#f8f4ea] px-3 py-1 text-xs font-semibold text-[#7c7464]">
                                  {strings.specialty.variantNoMapped}
                                </span>
                              ) : (
                                rule.match.map((token) => {
                                  const option = variantIngredientOptionByKey.get(token);
                                  const localizedLabel =
                                    ingredientCatalogItemByKey.get(token)?.label[locale] ??
                                    option?.label[locale] ??
                                    token;
                                  return (
                                    <span
                                      key={`${rule.iconPath}-${token}`}
                                      className="rounded-full bg-[#f4ebd3] px-3 py-1 text-xs font-semibold text-[#8b6f2f]"
                                    >
                                      {localizedLabel}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#8b7c5a]">
                              {strings.specialty.variantPath}
                            </p>
                            <p className="mt-2 break-all text-xs text-[#7c7464]">{rule.iconPath}</p>

                            {variantIngredientOptions.length === 0 ? (
                              <p className="mt-4 rounded-xl border border-[#e4dac7] bg-[#fffaf0] px-3 py-2 text-sm text-[#627665]">
                                {strings.specialty.variantNoOptions}
                              </p>
                            ) : isPlainRule ? (
                              <p className="mt-4 rounded-xl border border-[#e4dac7] bg-[#fffaf0] px-3 py-2 text-sm text-[#627665]">
                                {strings.specialty.variantReadonly}
                              </p>
                            ) : null}

                            {variantIngredientOptions.length > 0 && !isPlainRule ? (
                              <div className="mt-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b7c5a]">
                                  {strings.specialty.variantAvailable}
                                </p>
                                {rule.match.length === 0 ? (
                                  <p className="mt-2 text-sm text-[#627665]">
                                    {strings.specialty.variantNoMapped}
                                  </p>
                                ) : null}
                                <div className="mt-3 grid gap-2">
                                  {variantIngredientOptions.map((option) => {
                                    const isChecked = rule.match.includes(option.key);
                                    const localizedLabel =
                                      ingredientCatalogItemByKey.get(option.key)?.label[locale] ??
                                      option.label[locale];
                                    return (
                                      <label
                                        key={`${rule.iconPath}-${option.key}`}
                                        className="flex items-start gap-3 rounded-xl border border-[#ece3d1] bg-[#fffdfa] px-3 py-3 text-sm text-[#445c4c]"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(event) =>
                                            updateVariantRuleMatch(
                                              ruleIndex,
                                              option.key,
                                              event.target.checked
                                            )
                                          }
                                          className="mt-1 h-4 w-4 rounded border-[#c9ae63] text-[#8b6f2f] focus:ring-[#e8d79b]"
                                        />
                                        <span className="min-w-0 flex-1">
                                          <span className="block font-semibold text-[#24423a]">
                                            {localizedLabel}
                                          </span>
                                          <span className="mt-1 block text-xs text-[#7c7464]">
                                            {option.key}
                                          </span>
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-[#eee4d0] bg-[#fffdf8] pt-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className={LABEL}>{strings.form.saveBar}</p>
                    <p className="mt-2 text-sm text-[#627665]">
                      {hasUnsavedRecipeChanges ? strings.saveBar.dirty : strings.saveBar.clean}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setDraft(baselineDraft)}
                      disabled={!hasUnsavedRecipeChanges || isSaving}
                      className="shop-admin-pill border border-[#d7c8a5] px-4 py-2 text-sm font-semibold text-[#6b6658] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {strings.saveBar.reset}
                    </button>
                    <button
                      type="submit"
                      disabled={
                        !hasUnsavedRecipeChanges ||
                        recipeValidationErrors.length > 0 ||
                        isSaving
                      }
                      className="shop-admin-pill border border-[#d2b15b] bg-[#fff0bf] px-5 py-2 text-sm font-semibold text-[#8b6f2f] shadow-[0_8px_20px_rgba(210,177,91,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSaving ? strings.saveBar.saving : strings.saveBar.save}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <div className="rounded-[1.25rem] border border-[#e4dac7] bg-white p-5">
              <p className="text-sm text-[#627665]">{strings.empty}</p>
            </div>
          )}
        </div>
        </div>
      </section>
    </div>
  );
}
