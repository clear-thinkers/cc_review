"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/app/shared/locale";
import { useSession } from "@/lib/authContext";
import { getShopRecipeContentForLocale, resolvePlainShopRecipeIconPath } from "@/lib/shop";
import type { ShopIngredient, ShopLocale, ShopRecipe } from "../shop/shop.types";
import {
  type ShopAdminIngredientCatalogItem,
  type ShopAdminIngredientPricesResponse,
  buildShopIngredientFromCatalog,
  getShopIngredientCatalogEntry,
  listShopIngredientCatalog,
} from "../shop/shopIngredients";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import {
  areShopRecipeAdminDraftsEqual,
  buildShopRecipeAdminDraft,
  validateShopRecipeAdminDraft,
  type ShopAdminRecipesResponse,
  type ShopRecipeAdminDraft,
} from "./shopAdmin.types";

type LoadState = "idle" | "loading" | "ready" | "error";
type NoticeState = { kind: "success" | "error"; message: string } | null;

const PANEL = "rounded-[1.5rem] border border-[#e3dac6] bg-[#fffdf8] p-5 md:p-6";
const LABEL = "shop-admin-label text-sm font-semibold leading-6 text-[#8b7c5a]";
const INPUT =
  "mt-2 w-full rounded-xl border border-[#d8cfba] bg-white px-4 py-3 text-sm text-[#24423a] outline-none transition focus:border-[#c9ae63] focus:ring-1 focus:ring-[#e8d79b]";
const READONLY =
  "mt-2 rounded-xl border border-[#e5dcc9] bg-[#f8f4ea] px-4 py-3 text-sm text-[#536859]";

function getRecipeIconPath(recipe: ShopRecipe): string | null {
  return resolvePlainShopRecipeIconPath(recipe.variantIconRules) ?? recipe.variantIconRules[0]?.iconPath ?? null;
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

export default function ShopAdminSection({ vm }: { vm: WordsWorkspaceVM }) {
  const locale = useLocale();
  const session = useSession();
  const strings = vm.str.shopAdmin;
  const ingredientCatalog = listShopIngredientCatalog();
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [recipes, setRecipes] = useState<ShopRecipe[]>([]);
  const [ingredientCatalogBaseline, setIngredientCatalogBaseline] = useState<
    ShopAdminIngredientCatalogItem[]
  >([]);
  const [ingredientCatalogDraft, setIngredientCatalogDraft] = useState<
    ShopAdminIngredientCatalogItem[]
  >([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [baselineDraft, setBaselineDraft] = useState<ShopRecipeAdminDraft | null>(null);
  const [draft, setDraft] = useState<ShopRecipeAdminDraft | null>(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [ingredientNotice, setIngredientNotice] = useState<NoticeState>(null);
  const [isSavingIngredientPrices, setIsSavingIngredientPrices] = useState(false);

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null,
    [recipes, selectedRecipeId]
  );
  const localizedSelectedRecipe = useMemo(
    () => (selectedRecipe ? getShopRecipeContentForLocale(selectedRecipe, locale) : null),
    [selectedRecipe, locale]
  );
  const validationErrors = useMemo(() => (draft ? validateShopRecipeAdminDraft(draft) : []), [draft]);
  const hasUnsavedChanges = useMemo(
    () => draft !== null && baselineDraft !== null && !areShopRecipeAdminDraftsEqual(draft, baselineDraft),
    [draft, baselineDraft]
  );
  const hasIngredientPriceChanges = useMemo(
    () =>
      JSON.stringify(
        ingredientCatalogDraft.map((ingredient) => ({
          key: ingredient.key,
          costCoins: ingredient.costCoins,
        }))
      ) !==
      JSON.stringify(
        ingredientCatalogBaseline.map((ingredient) => ({
          key: ingredient.key,
          costCoins: ingredient.costCoins,
        }))
      ),
    [ingredientCatalogBaseline, ingredientCatalogDraft]
  );

  useEffect(() => {
    if (vm.page !== "shopAdmin" || !session?.isPlatformAdmin) {
      return;
    }
    const accessToken = session.supabaseSession.access_token;
    let isCancelled = false;

    async function loadRecipes() {
      setLoadState("loading");
      setLoadError("");
      try {
        const [recipesResponse, ingredientPricesResponse] = await Promise.all([
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
        const ingredientPricesJson = (await ingredientPricesResponse.json()) as
          | ShopAdminIngredientPricesResponse
          | { error?: string };
        if (!recipesResponse.ok) {
          throw new Error(
            typeof recipesJson === "object" && recipesJson && "error" in recipesJson
              ? recipesJson.error || strings.loadError
              : strings.loadError
          );
        }
        if (!ingredientPricesResponse.ok) {
          throw new Error(
            typeof ingredientPricesJson === "object" &&
              ingredientPricesJson &&
              "error" in ingredientPricesJson
              ? ingredientPricesJson.error || strings.ingredientPricing.loadError
              : strings.ingredientPricing.loadError
          );
        }
        const nextRecipes =
          "recipes" in recipesJson && Array.isArray(recipesJson.recipes)
            ? recipesJson.recipes
            : [];
        const nextIngredientCatalog =
          "ingredients" in ingredientPricesJson &&
          Array.isArray(ingredientPricesJson.ingredients)
            ? ingredientPricesJson.ingredients
            : [];
        if (isCancelled) {
          return;
        }
        setRecipes(nextRecipes);
        setIngredientCatalogBaseline(nextIngredientCatalog);
        setIngredientCatalogDraft(nextIngredientCatalog);
        const nextRecipe = nextRecipes.find((recipe) => recipe.id === selectedRecipeId) ?? nextRecipes[0] ?? null;
        setSelectedRecipeId(nextRecipe?.id ?? null);
        const nextDraft = nextRecipe ? buildShopRecipeAdminDraft(nextRecipe) : null;
        setBaselineDraft(nextDraft);
        setDraft(nextDraft);
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

    void loadRecipes();
    return () => {
      isCancelled = true;
    };
  }, [
    selectedRecipeId,
    session?.isPlatformAdmin,
    session?.supabaseSession.access_token,
    strings.loadError,
    vm.page,
  ]);

  if (vm.page !== "shopAdmin") {
    return null;
  }

  function resetToRecipe(recipe: ShopRecipe | null) {
    setSelectedRecipeId(recipe?.id ?? null);
    const nextDraft = recipe ? buildShopRecipeAdminDraft(recipe) : null;
    setBaselineDraft(nextDraft);
    setDraft(nextDraft);
    setNotice(null);
  }

  function updateDraft(updater: (current: ShopRecipeAdminDraft) => ShopRecipeAdminDraft) {
    setDraft((current) => (current ? updater(current) : current));
    setNotice(null);
  }

  function updateText(field: "title" | "intro", targetLocale: ShopLocale, value: string) {
    updateDraft((current) => ({
      ...current,
      [field]: {
        ...current[field],
        [targetLocale]: value,
      },
    }));
  }

  function updateIngredient(
    targetLocale: ShopLocale,
    index: number,
    field: keyof ShopIngredient,
    value: string
  ) {
    updateDraft((current) => {
      const next = {
        ...current,
        baseIngredients: {
          en: current.baseIngredients.en.map((ingredient) => ({ ...ingredient })),
          zh: current.baseIngredients.zh.map((ingredient) => ({ ...ingredient })),
        },
      };

      if (field === "quantity") {
        next.baseIngredients.en[index] = {
          ...next.baseIngredients.en[index],
          quantity: value,
        };
        next.baseIngredients.zh[index] = {
          ...next.baseIngredients.zh[index],
          quantity: value,
        };
        return next;
      }

      next.baseIngredients[targetLocale][index] = {
        ...next.baseIngredients[targetLocale][index],
        [field]: value,
      };
      return next;
    });
  }

  function addIngredientRow() {
    updateDraft((current) => ({
      ...current,
      baseIngredients: {
        en: [...current.baseIngredients.en, { name: "", quantity: "", unit: "" }],
        zh: [...current.baseIngredients.zh, { name: "", quantity: "", unit: "" }],
      },
    }));
  }

  function updateIngredientCatalogSelection(index: number, ingredientKey: string) {
    updateDraft((current) => {
      const next = {
        ...current,
        baseIngredients: {
          en: current.baseIngredients.en.map((ingredient) => ({ ...ingredient })),
          zh: current.baseIngredients.zh.map((ingredient) => ({ ...ingredient })),
        },
      };
      const quantity = next.baseIngredients.en[index]?.quantity ?? "";

      if (!ingredientKey) {
        next.baseIngredients.en[index] = clearIngredientKey(next.baseIngredients.en[index]);
        next.baseIngredients.zh[index] = clearIngredientKey(next.baseIngredients.zh[index]);
        return next;
      }

      const entry = getShopIngredientCatalogEntry(ingredientKey);
      if (!entry) {
        return current;
      }

      next.baseIngredients.en[index] = buildShopIngredientFromCatalog(entry, "en", quantity);
      next.baseIngredients.zh[index] = buildShopIngredientFromCatalog(entry, "zh", quantity);
      return next;
    });
  }

  function moveIngredient(index: number, direction: -1 | 1) {
    updateDraft((current) => ({
      ...current,
      baseIngredients: {
        en: swapItems(current.baseIngredients.en, index, direction),
        zh: swapItems(current.baseIngredients.zh, index, direction),
      },
    }));
  }

  function removeIngredient(index: number) {
    updateDraft((current) => ({
      ...current,
      baseIngredients: {
        en: current.baseIngredients.en.filter((_, rowIndex) => rowIndex !== index),
        zh: current.baseIngredients.zh.filter((_, rowIndex) => rowIndex !== index),
      },
    }));
  }

  function updateSlotLabel(targetLocale: ShopLocale, slotIndex: number, value: string) {
    updateDraft((current) => ({
      ...current,
      specialIngredientSlots: {
        ...current.specialIngredientSlots,
        [targetLocale]: current.specialIngredientSlots[targetLocale].map((slot, currentIndex) =>
          currentIndex === slotIndex ? { ...slot, label: value } : slot
        ),
      },
    }));
  }

  function updateOptionField(
    targetLocale: ShopLocale,
    slotIndex: number,
    optionIndex: number,
    field: "label" | "effect",
    value: string
  ) {
    updateDraft((current) => ({
      ...current,
      specialIngredientSlots: {
        ...current.specialIngredientSlots,
        [targetLocale]: current.specialIngredientSlots[targetLocale].map((slot, currentSlotIndex) =>
          currentSlotIndex === slotIndex
            ? {
                ...slot,
                options: slot.options.map((option, currentOptionIndex) =>
                  currentOptionIndex === optionIndex ? { ...option, [field]: value } : option
                ),
              }
            : slot
        ),
      },
    }));
  }

  function handleSelectRecipe(recipeId: string) {
    if (recipeId === selectedRecipeId) {
      return;
    }
    if (hasUnsavedChanges && !window.confirm(strings.notices.discardChanges)) {
      return;
    }
    resetToRecipe(recipes.find((recipe) => recipe.id === recipeId) ?? null);
  }

  async function handleSave() {
    if (!draft || validationErrors.length > 0 || isSaving) {
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

  function updateIngredientCatalogPrice(index: number, rawValue: string) {
    const parsedValue = Number.parseInt(rawValue, 10);
    setIngredientCatalogDraft((current) =>
      current.map((ingredient, currentIndex) =>
        currentIndex === index
          ? {
              ...ingredient,
              costCoins:
                Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : ingredient.costCoins,
            }
          : ingredient
      )
    );
    setIngredientNotice(null);
  }

  async function handleIngredientPriceSave() {
    if (isSavingIngredientPrices) {
      return;
    }

    setIsSavingIngredientPrices(true);
    setIngredientNotice(null);
    try {
      const response = await fetch("/api/shop-admin/ingredient-prices", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.supabaseSession.access_token ?? ""}`,
        },
        body: JSON.stringify({
          ingredients: ingredientCatalogDraft.map((ingredient) => ({
            key: ingredient.key,
            costCoins: ingredient.costCoins,
          })),
        }),
      });
      const json = (await response.json()) as
        | ShopAdminIngredientPricesResponse
        | { error?: string };
      if (!response.ok || !("ingredients" in json) || !Array.isArray(json.ingredients)) {
        throw new Error(
          "error" in json ? json.error || strings.ingredientPricing.saveError : strings.ingredientPricing.saveError
        );
      }
      setIngredientCatalogBaseline(json.ingredients);
      setIngredientCatalogDraft(json.ingredients);
      setIngredientNotice({ kind: "success", message: strings.ingredientPricing.saveSuccess });
    } catch (error) {
      setIngredientNotice({
        kind: "error",
        message: getErrorMessage(error, strings.ingredientPricing.saveError),
      });
    } finally {
      setIsSavingIngredientPrices(false);
    }
  }

  if (!session?.isPlatformAdmin) {
    return (
      <section className={`shop-admin-pane ${PANEL}`}>
        <h2 className="text-2xl font-semibold text-[#24423a]">{strings.pageTitle}</h2>
        <p className="mt-2 text-sm text-[#627665]">{strings.platformAdminOnly}</p>
      </section>
    );
  }

  if (loadState === "idle" || loadState === "loading") {
    return (
      <section className={`shop-admin-pane ${PANEL}`}>
        <h2 className="text-2xl font-semibold text-[#24423a]">{strings.pageTitle}</h2>
        <p className="mt-2 text-sm text-[#627665]">{strings.loading}</p>
      </section>
    );
  }

  if (loadState === "error") {
    return (
      <section className={`shop-admin-pane ${PANEL}`}>
        <h2 className="text-2xl font-semibold text-[#24423a]">{strings.pageTitle}</h2>
        <p className="mt-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError || strings.loadError}
        </p>
      </section>
    );
  }

  if (!selectedRecipe || !draft || !localizedSelectedRecipe) {
    return (
      <section className={`shop-admin-pane ${PANEL}`}>
        <h2 className="text-2xl font-semibold text-[#24423a]">{strings.pageTitle}</h2>
        <p className="mt-2 text-sm text-[#627665]">{strings.empty}</p>
      </section>
    );
  }

  const selectedIconPath = getRecipeIconPath(selectedRecipe);

  return (
    <div className="shop-admin-root space-y-6">
      <header className="px-1">
        <h2 className="text-2xl font-semibold text-[#24423a]">{strings.pageTitle}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[#627665]">{strings.pageDescription}</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={`shop-admin-pane ${PANEL} xl:sticky xl:top-6 xl:self-start`}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[#24423a]">{strings.recipeListTitle}</h3>
            <span className="rounded-full bg-[#f4ebd3] px-3 py-1 text-xs font-semibold text-[#8b6f2f]">{recipes.length}</span>
          </div>
          <div className="mt-4 space-y-3">
            {recipes.map((recipe) => {
              const isSelected = recipe.id === selectedRecipeId;
              const iconPath = getRecipeIconPath(recipe);
              const localizedRecipe = getShopRecipeContentForLocale(recipe, locale);
              return (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => handleSelectRecipe(recipe.id)}
                  className={`shop-admin-recipe-card w-full border px-4 py-4 text-left transition ${
                    isSelected
                      ? "border-[#d2b15b] bg-[#fff8e8]"
                      : "border-[#e5dcc9] bg-white hover:border-[#d2c19a] hover:bg-[#fcfaf4]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[#eadfc1] bg-[#fffaf0]">
                      {iconPath ? <img src={iconPath} alt={localizedRecipe.title} className="h-12 w-12 object-contain" /> : <span className="text-xl text-[#9a8f79]">?</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-[#24423a]">{localizedRecipe.title}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${recipe.isActive ? "bg-[#e4f1df] text-[#3f6842]" : "bg-[#ece7dc] text-[#776c5b]"}`}>
                          {recipe.isActive ? strings.activeBadge : strings.inactiveBadge}
                        </span>
                        {isSelected && hasUnsavedChanges ? (
                          <span className="rounded-full bg-[#f7d9d6] px-2.5 py-1 text-[11px] font-semibold text-[#a04f46]">{strings.unsavedBadge}</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-[#7c7464]">{recipe.slug}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <form
          className={`shop-admin-pane ${PANEL} space-y-0 overflow-visible`}
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          {notice ? (
            <p className={`rounded-2xl border px-4 py-3 text-sm ${notice.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
              {notice.message}
            </p>
          ) : null}

          {validationErrors.length > 0 ? (
            <div className="rounded-[1.75rem] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              <p className="font-semibold">{strings.saveBar.validation}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {validationErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className={LABEL}>{strings.form.basicInfo}</p>
                <h3 className="mt-2 text-xl font-semibold text-[#24423a]">{localizedSelectedRecipe.title}</h3>
              </div>
              <div className="flex items-center gap-4 px-1 py-1">
                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white">
                  {selectedIconPath ? <img src={selectedIconPath} alt={localizedSelectedRecipe.title} className="h-16 w-16 object-contain" /> : <span className="text-2xl text-[#9a8f79]">?</span>}
                </div>
                <div className="space-y-1">
                  <p className={LABEL}>{strings.canonicalIcon}</p>
                  <p className="text-sm font-medium text-[#445c4c]">{selectedIconPath || strings.fallbackIcon}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className={LABEL}>{strings.fields.slug}</span>
                <div className={READONLY}>{selectedRecipe.slug}</div>
              </label>
              <div />
              <label className="block">
                <span className={LABEL}>{strings.fields.titleEnglish}</span>
                <input value={draft.title.en} onChange={(event) => updateText("title", "en", event.target.value)} className={INPUT} maxLength={80} />
              </label>
              <label className="block">
                <span className={LABEL}>{strings.fields.titleChinese}</span>
                <input value={draft.title.zh} onChange={(event) => updateText("title", "zh", event.target.value)} className={INPUT} maxLength={80} />
              </label>
              <label className="block">
                <span className={LABEL}>{strings.fields.introEnglish}</span>
                <textarea value={draft.intro.en} onChange={(event) => updateText("intro", "en", event.target.value)} className={`${INPUT} min-h-[120px] resize-y`} maxLength={240} />
              </label>
              <label className="block">
                <span className={LABEL}>{strings.fields.introChinese}</span>
                <textarea value={draft.intro.zh} onChange={(event) => updateText("intro", "zh", event.target.value)} className={`${INPUT} min-h-[120px] resize-y`} maxLength={240} />
              </label>
              <label className="block">
                <span className={LABEL}>{strings.fields.displayOrder}</span>
                <div className={READONLY}>{selectedRecipe.displayOrder}</div>
              </label>
              <label className="block">
                <span className={LABEL}>{strings.fields.unlockCost}</span>
                <div className={READONLY}>{selectedRecipe.unlockCostCoins}</div>
              </label>
              <label className="block">
                <span className={LABEL}>{strings.fields.isActive}</span>
                <div className={READONLY}>{selectedRecipe.isActive ? strings.fields.yes : strings.fields.no}</div>
              </label>
            </div>
          </div>

          <div className="mt-8 border-t border-[#eee4d0] pt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={LABEL}>{strings.form.baseIngredients}</p>
                <p className="mt-2 text-sm text-[#627665]">{strings.ingredients.helper}</p>
              </div>
              <button type="button" onClick={addIngredientRow} className="shop-admin-pill border border-[#d2b15b] bg-[#fff4d9] px-4 py-2 text-sm font-semibold text-[#8b6f2f]">
                {strings.ingredients.add}
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {draft.baseIngredients.en.map((englishIngredient, ingredientIndex) => {
                const chineseIngredient = draft.baseIngredients.zh[ingredientIndex];
                const selectedIngredientCatalogEntry = getShopIngredientCatalogEntry(
                  englishIngredient.ingredientKey
                );
                return (
                  <div key={`${selectedRecipe.id}-${ingredientIndex}`} className="rounded-xl border border-[#e4dac7] bg-white p-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_150px]">
                      <label className="block">
                        <span className={LABEL}>{strings.ingredients.iconIngredient}</span>
                        <select
                          value={englishIngredient.ingredientKey ?? ""}
                          onChange={(event) =>
                            updateIngredientCatalogSelection(ingredientIndex, event.target.value)
                          }
                          className={INPUT}
                        >
                          <option value="">{strings.ingredients.customOption}</option>
                          {ingredientCatalog.map((catalogEntry) => (
                            <option key={catalogEntry.key} value={catalogEntry.key}>
                              {catalogEntry.label[locale]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className={LABEL}>{strings.ingredients.quantity}</span>
                        <input value={englishIngredient.quantity} onChange={(event) => updateIngredient("en", ingredientIndex, "quantity", event.target.value)} className={INPUT} maxLength={20} />
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

                    {selectedIngredientCatalogEntry ? (
                      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
                        <label className="block">
                          <span className={LABEL}>{strings.ingredients.nameEnglish}</span>
                          <div className={READONLY}>{selectedIngredientCatalogEntry.label.en}</div>
                        </label>
                        <label className="block">
                          <span className={LABEL}>{strings.ingredients.nameChinese}</span>
                          <div className={READONLY}>{selectedIngredientCatalogEntry.label.zh}</div>
                        </label>
                        <label className="block">
                          <span className={LABEL}>{strings.ingredients.unitEnglish}</span>
                          <div className={READONLY}>{selectedIngredientCatalogEntry.defaultUnit.en}</div>
                        </label>
                        <label className="block">
                          <span className={LABEL}>{strings.ingredients.unitChinese}</span>
                          <div className={READONLY}>{selectedIngredientCatalogEntry.defaultUnit.zh}</div>
                        </label>
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
                        <label className="block">
                          <span className={LABEL}>{strings.ingredients.nameEnglish}</span>
                          <input value={englishIngredient.name} onChange={(event) => updateIngredient("en", ingredientIndex, "name", event.target.value)} className={INPUT} maxLength={60} />
                        </label>
                        <label className="block">
                          <span className={LABEL}>{strings.ingredients.nameChinese}</span>
                          <input value={chineseIngredient?.name ?? ""} onChange={(event) => updateIngredient("zh", ingredientIndex, "name", event.target.value)} className={INPUT} maxLength={60} />
                        </label>
                        <label className="block">
                          <span className={LABEL}>{strings.ingredients.unitEnglish}</span>
                          <input value={englishIngredient.unit ?? ""} onChange={(event) => updateIngredient("en", ingredientIndex, "unit", event.target.value)} className={INPUT} maxLength={20} />
                        </label>
                        <label className="block">
                          <span className={LABEL}>{strings.ingredients.unitChinese}</span>
                          <input value={chineseIngredient?.unit ?? ""} onChange={(event) => updateIngredient("zh", ingredientIndex, "unit", event.target.value)} className={INPUT} maxLength={20} />
                        </label>
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => moveIngredient(ingredientIndex, -1)} disabled={ingredientIndex === 0} className="shop-admin-pill border border-[#d7c8a5] px-3 py-2 text-xs font-semibold text-[#6b6658] disabled:cursor-not-allowed disabled:opacity-50">{strings.ingredients.moveUp}</button>
                      <button type="button" onClick={() => moveIngredient(ingredientIndex, 1)} disabled={ingredientIndex === draft.baseIngredients.en.length - 1} className="shop-admin-pill border border-[#d7c8a5] px-3 py-2 text-xs font-semibold text-[#6b6658] disabled:cursor-not-allowed disabled:opacity-50">{strings.ingredients.moveDown}</button>
                      <button type="button" onClick={() => removeIngredient(ingredientIndex)} className="shop-admin-pill border border-[#e7b8b2] bg-[#fff3f1] px-3 py-2 text-xs font-semibold text-[#a04f46]">{strings.ingredients.remove}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 border-t border-[#eee4d0] pt-8">
            <div className="flex flex-wrap items-center gap-3">
              <p className={LABEL}>{strings.form.specialtyIngredients}</p>
              <span className="rounded-full bg-[#eef3e8] px-3 py-1 text-xs font-semibold text-[#607451]">{strings.generatedFromAssets}</span>
            </div>
            <p className="mt-2 text-sm leading-7 text-[#627665]">{strings.specialty.helper}</p>

            <div className="mt-5 space-y-5">
              {draft.specialIngredientSlots.en.length === 0 ? (
                <p className="rounded-xl border border-[#e4dac7] bg-white px-4 py-3 text-sm text-[#627665]">{strings.specialty.noSlots}</p>
              ) : (
                draft.specialIngredientSlots.en.map((englishSlot, slotIndex) => {
                  const chineseSlot = draft.specialIngredientSlots.zh[slotIndex];
                  return (
                    <div key={`${selectedRecipe.id}-${englishSlot.slotKey}`} className="rounded-xl border border-[#e4dac7] bg-white p-4">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px]">
                        <label className="block">
                          <span className={LABEL}>{strings.specialty.slotLabelEnglish}</span>
                          <input value={englishSlot.label} onChange={(event) => updateSlotLabel("en", slotIndex, event.target.value)} className={INPUT} maxLength={60} />
                        </label>
                        <label className="block">
                          <span className={LABEL}>{strings.specialty.slotLabelChinese}</span>
                          <input value={chineseSlot?.label ?? ""} onChange={(event) => updateSlotLabel("zh", slotIndex, event.target.value)} className={INPUT} maxLength={60} />
                        </label>
                        <div className={READONLY}>{strings.specialty.maxSelections.replace("{count}", String(englishSlot.maxSelections))}</div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {englishSlot.options.map((englishOption, optionIndex) => {
                          const chineseOption = chineseSlot?.options[optionIndex];
                          return (
                            <div key={`${englishSlot.slotKey}-${englishOption.key}`} className="rounded-xl border border-[#ece3d1] bg-[#fffdfa] p-4">
                              <div className="grid gap-4 md:grid-cols-3">
                                <label className="block">
                                  <span className={LABEL}>{strings.specialty.optionKey}</span>
                                  <div className={READONLY}>{englishOption.key}</div>
                                </label>
                                <label className="block">
                                  <span className={LABEL}>{strings.specialty.optionLabelEnglish}</span>
                                  <input value={englishOption.label} onChange={(event) => updateOptionField("en", slotIndex, optionIndex, "label", event.target.value)} className={INPUT} maxLength={60} />
                                </label>
                                <label className="block">
                                  <span className={LABEL}>{strings.specialty.optionLabelChinese}</span>
                                  <input value={chineseOption?.label ?? ""} onChange={(event) => updateOptionField("zh", slotIndex, optionIndex, "label", event.target.value)} className={INPUT} maxLength={60} />
                                </label>
                              </div>
                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <label className="block">
                                  <span className={LABEL}>{strings.specialty.optionEffectEnglish}</span>
                                  <textarea value={englishOption.effect} onChange={(event) => updateOptionField("en", slotIndex, optionIndex, "effect", event.target.value)} className={`${INPUT} min-h-[96px] resize-y`} maxLength={120} />
                                </label>
                                <label className="block">
                                  <span className={LABEL}>{strings.specialty.optionEffectChinese}</span>
                                  <textarea value={chineseOption?.effect ?? ""} onChange={(event) => updateOptionField("zh", slotIndex, optionIndex, "effect", event.target.value)} className={`${INPUT} min-h-[96px] resize-y`} maxLength={120} />
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-6">
              <p className={LABEL}>{strings.form.variantPreview}</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {selectedRecipe.variantIconRules.length === 0 ? (
                  <p className="rounded-xl border border-[#e4dac7] bg-white px-4 py-3 text-sm text-[#627665]">{strings.specialty.noVariants}</p>
                ) : (
                  selectedRecipe.variantIconRules.map((rule) => (
                    <div key={`${selectedRecipe.id}-${rule.iconPath}`} className="rounded-xl border border-[#e4dac7] bg-white p-4">
                      <div className="flex h-24 items-center justify-center rounded-xl border border-[#efe4c8] bg-[#fffaf0] p-3">
                        <img src={rule.iconPath} alt={rule.iconPath} className="h-full w-full object-contain" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {rule.match.length === 0 ? (
                          <span className="rounded-full bg-[#eef3e8] px-3 py-1 text-xs font-semibold text-[#607451]">{strings.specialty.matchAll}</span>
                        ) : (
                          rule.match.map((token) => (
                            <span key={`${rule.iconPath}-${token}`} className="rounded-full bg-[#f4ebd3] px-3 py-1 text-xs font-semibold text-[#8b6f2f]">{token}</span>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-[#eee4d0] bg-[#fffdf8] pt-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className={LABEL}>{strings.form.saveBar}</p>
                <p className="mt-2 text-sm text-[#627665]">{hasUnsavedChanges ? strings.saveBar.dirty : strings.saveBar.clean}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => setDraft(baselineDraft)} disabled={!hasUnsavedChanges || isSaving} className="shop-admin-pill border border-[#d7c8a5] px-4 py-2 text-sm font-semibold text-[#6b6658] disabled:cursor-not-allowed disabled:opacity-50">{strings.saveBar.reset}</button>
                <button type="submit" disabled={!hasUnsavedChanges || validationErrors.length > 0 || isSaving} className="shop-admin-pill border border-[#d2b15b] bg-[#fff0bf] px-5 py-2 text-sm font-semibold text-[#8b6f2f] shadow-[0_8px_20px_rgba(210,177,91,0.18)] disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? strings.saveBar.saving : strings.saveBar.save}</button>
              </div>
            </div>
          </div>
        </form>
      </div>

      <section className={`shop-admin-pane ${PANEL}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className={LABEL}>{strings.ingredientPricing.title}</p>
            <h3 className="mt-2 text-xl font-semibold text-[#24423a]">
              {strings.ingredientPricing.heading}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[#627665]">
              {strings.ingredientPricing.helper}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setIngredientCatalogDraft(ingredientCatalogBaseline);
                setIngredientNotice(null);
              }}
              disabled={!hasIngredientPriceChanges || isSavingIngredientPrices}
              className="shop-admin-pill border border-[#d7c8a5] px-4 py-2 text-sm font-semibold text-[#6b6658] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {strings.ingredientPricing.reset}
            </button>
            <button
              type="button"
              onClick={() => void handleIngredientPriceSave()}
              disabled={!hasIngredientPriceChanges || isSavingIngredientPrices}
              className="shop-admin-pill border border-[#d2b15b] bg-[#fff0bf] px-5 py-2 text-sm font-semibold text-[#8b6f2f] shadow-[0_8px_20px_rgba(210,177,91,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingIngredientPrices
                ? strings.ingredientPricing.saving
                : strings.ingredientPricing.save}
            </button>
          </div>
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

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ingredientCatalogDraft.map((ingredient, index) => (
            <div
              key={ingredient.key}
              className="rounded-xl border border-[#e4dac7] bg-white p-4"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[#eadfc1] bg-[#fffaf0]">
                  {ingredient.iconPath ? (
                    <img
                      src={ingredient.iconPath}
                      alt={ingredient.label[locale]}
                      className="h-12 w-12 object-contain"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-[#9a8f79]">
                      {strings.ingredients.noIcon}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-[#24423a]">
                    {ingredient.label[locale]}
                  </p>
                  <p className="mt-1 text-xs text-[#7c7464]">{ingredient.key}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>{strings.ingredientPricing.unitEnglish}</span>
                  <div className={READONLY}>{ingredient.defaultUnit.en || strings.ingredientPricing.noUnit}</div>
                </label>
                <label className="block">
                  <span className={LABEL}>{strings.ingredientPricing.unitChinese}</span>
                  <div className={READONLY}>{ingredient.defaultUnit.zh || strings.ingredientPricing.noUnit}</div>
                </label>
              </div>

              <label className="mt-4 block">
                <span className={LABEL}>{strings.ingredientPricing.cost}</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={ingredient.costCoins}
                  onChange={(event) => updateIngredientCatalogPrice(index, event.target.value)}
                  className={INPUT}
                />
              </label>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
