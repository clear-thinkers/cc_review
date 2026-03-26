import type {
  ShopIngredient,
  ShopLocalizedValue,
  ShopRecipe,
  ShopVariantIconRule,
} from "../shop/shop.types";
import {
  canonicalizeShopIngredientKey,
  getShopIngredientCatalogEntry,
  type ShopAdminIngredientCatalogItem,
  type ShopAdminIngredientUsage,
} from "../shop/shopIngredients";
import {
  SHOP_INGREDIENT_QUANTITY_MAX,
  SHOP_INGREDIENT_QUANTITY_MIN,
  normalizeShopVariantMatchKeys,
  parseShopIngredientQuantity,
} from "@/lib/shop";

export const SHOP_RECIPE_TITLE_MAX = 80;
export const SHOP_RECIPE_INTRO_MAX = 240;
export const SHOP_RECIPE_INGREDIENT_NAME_MAX = 60;
export const SHOP_ADMIN_INGREDIENT_PRICE_MAX = 999;

export type ShopRecipeAdminDraft = {
  recipeId: string;
  title: ShopLocalizedValue<string>;
  intro: ShopLocalizedValue<string>;
  baseIngredients: ShopLocalizedValue<ShopIngredient[]>;
  specialIngredients: ShopLocalizedValue<ShopIngredient[]>;
  variantIconRules: ShopVariantIconRule[];
};

export type ShopAdminVariantIngredientOption = {
  key: string;
  label: ShopLocalizedValue<string>;
};

export type ShopAdminRecipesResponse = {
  recipes: ShopRecipe[];
};

export type ShopAdminIngredientDraft = {
  draftId: string;
  key: string;
  label: ShopLocalizedValue<string>;
  iconPath: string;
  defaultCostCoins: number;
  costCoins: number;
  usage: ShopAdminIngredientUsage;
  isPersisted: boolean;
};

type ShopIngredientLabelLookup = ReadonlyMap<string, ShopLocalizedValue<string>>;

export function buildShopAdminIngredientDrafts(
  items: ShopAdminIngredientCatalogItem[]
): ShopAdminIngredientDraft[] {
  return items.map((item) => ({
    draftId: item.key,
    key: item.key,
    label: { ...item.label },
    iconPath: item.iconPath ?? "",
    defaultCostCoins: item.defaultCostCoins,
    costCoins: item.costCoins,
    usage: { ...item.usage },
    isPersisted: true,
  }));
}

export function createEmptyShopAdminIngredientDraft(draftId: string): ShopAdminIngredientDraft {
  return {
    draftId,
    key: "",
    label: { en: "", zh: "" },
    iconPath: "",
    defaultCostCoins: 0,
    costCoins: 0,
    usage: {
      usedInBase: false,
      usedInSpecial: false,
    },
    isPersisted: false,
  };
}

function normalizeLocalizedIngredientDraftLabel(raw: unknown): ShopLocalizedValue<string> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    en: typeof source.en === "string" ? source.en.trim() : "",
    zh: typeof source.zh === "string" ? source.zh.trim() : "",
  };
}

function normalizeShopAdminIngredientUsage(raw: unknown): ShopAdminIngredientUsage {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    usedInBase: source.usedInBase === true,
    usedInSpecial: source.usedInSpecial === true,
  };
}

export function normalizeShopAdminIngredientDraft(raw: unknown): ShopAdminIngredientDraft {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    draftId: typeof source.draftId === "string" ? source.draftId.trim() : "",
    key: typeof source.key === "string" ? source.key.trim() : "",
    label: normalizeLocalizedIngredientDraftLabel(source.label),
    iconPath: typeof source.iconPath === "string" ? source.iconPath.trim() : "",
    defaultCostCoins:
      typeof source.defaultCostCoins === "number" && Number.isFinite(source.defaultCostCoins)
        ? source.defaultCostCoins
        : 0,
    costCoins:
      typeof source.costCoins === "number" && Number.isFinite(source.costCoins)
        ? source.costCoins
        : 0,
    usage: normalizeShopAdminIngredientUsage(source.usage),
    isPersisted: source.isPersisted === true,
  };
}

export function normalizeShopAdminIngredientDrafts(raw: unknown): ShopAdminIngredientDraft[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((item) => normalizeShopAdminIngredientDraft(item));
}

export function validateShopAdminIngredientDrafts(
  drafts: ShopAdminIngredientDraft[]
): string[] {
  const normalizedDrafts = normalizeShopAdminIngredientDrafts(drafts);
  const errors: string[] = [];
  const seenKeys = new Set<string>();

  normalizedDrafts.forEach((draft, index) => {
    const rowNumber = index + 1;
    const canonicalKey = canonicalizeShopIngredientKey(draft.key);
    if (!canonicalKey) {
      errors.push(`Ingredient ${rowNumber}: key is required.`);
    } else if (seenKeys.has(canonicalKey)) {
      errors.push(`Ingredient ${rowNumber}: duplicate ingredient key "${canonicalKey}".`);
    } else {
      seenKeys.add(canonicalKey);
    }

    if (!draft.label.en) {
      errors.push(`Ingredient ${rowNumber}: English name is required.`);
    } else if (draft.label.en.length > SHOP_RECIPE_INGREDIENT_NAME_MAX) {
      errors.push(
        `Ingredient ${rowNumber}: English name must be ${SHOP_RECIPE_INGREDIENT_NAME_MAX} characters or fewer.`
      );
    }

    if (!draft.label.zh) {
      errors.push(`Ingredient ${rowNumber}: Chinese name is required.`);
    } else if (draft.label.zh.length > SHOP_RECIPE_INGREDIENT_NAME_MAX) {
      errors.push(
        `Ingredient ${rowNumber}: Chinese name must be ${SHOP_RECIPE_INGREDIENT_NAME_MAX} characters or fewer.`
      );
    }

    if (!Number.isInteger(draft.costCoins) || draft.costCoins < 0) {
      errors.push(`Ingredient ${rowNumber}: price must be a whole number from 0 and up.`);
    } else if (draft.costCoins > SHOP_ADMIN_INGREDIENT_PRICE_MAX) {
      errors.push(
        `Ingredient ${rowNumber}: price must be ${SHOP_ADMIN_INGREDIENT_PRICE_MAX} or less.`
      );
    }

    if (draft.iconPath && !draft.iconPath.startsWith("/")) {
      errors.push(`Ingredient ${rowNumber}: icon path must start with "/".`);
    }
  });

  return errors;
}

export function serializeShopAdminIngredientDrafts(
  drafts: ShopAdminIngredientDraft[]
): ShopAdminIngredientCatalogItem[] {
  return normalizeShopAdminIngredientDrafts(drafts).map((draft) => ({
    key: canonicalizeShopIngredientKey(draft.key),
    label: {
      en: draft.label.en.trim(),
      zh: draft.label.zh.trim(),
    },
    defaultCostCoins: draft.defaultCostCoins,
    iconPath: draft.iconPath.trim() || null,
    costCoins: draft.costCoins,
    usage: { ...draft.usage },
  }));
}

export function areShopAdminIngredientDraftsEqual(
  left: ShopAdminIngredientDraft[],
  right: ShopAdminIngredientDraft[]
): boolean {
  return (
    JSON.stringify(serializeShopAdminIngredientDrafts(left)) ===
    JSON.stringify(serializeShopAdminIngredientDrafts(right))
  );
}

export function buildShopRecipeAdminDraft(recipe: ShopRecipe): ShopRecipeAdminDraft {
  return {
    recipeId: recipe.id,
    title: { ...recipe.titleI18n },
    intro: { ...recipe.introI18n },
    baseIngredients: {
      en: recipe.baseIngredientsI18n.en.map((ingredient) => ({ ...ingredient })),
      zh: recipe.baseIngredientsI18n.zh.map((ingredient) => ({ ...ingredient })),
    },
    specialIngredients: {
      en: recipe.specialIngredientsI18n.en.map((ingredient) => ({ ...ingredient })),
      zh: recipe.specialIngredientsI18n.zh.map((ingredient) => ({ ...ingredient })),
    },
    variantIconRules: recipe.variantIconRules.map((rule) => ({
      iconPath: rule.iconPath,
      match: normalizeVariantMatchKeys(rule.match),
    })),
  };
}

function normalizeVariantMatchKeys(raw: unknown): string[] {
  return normalizeShopVariantMatchKeys(raw);
}

function normalizeLocalizedStringValue(raw: unknown): ShopLocalizedValue<string> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    en: typeof source.en === "string" ? source.en.trim() : "",
    zh: typeof source.zh === "string" ? source.zh.trim() : "",
  };
}

function normalizeIngredientList(raw: unknown): ShopIngredient[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((ingredient) => {
    const source =
      ingredient && typeof ingredient === "object"
        ? (ingredient as Record<string, unknown>)
        : {};
    const ingredientKey = canonicalizeShopIngredientKey(
      typeof source.ingredientKey === "string"
        ? source.ingredientKey
        : typeof source.key === "string"
          ? source.key
          : ""
    );
    return {
      ...(ingredientKey ? { ingredientKey } : {}),
      name: typeof source.name === "string" ? source.name.trim() : "",
      quantity: parseShopIngredientQuantity(source.quantity) ?? 0,
    };
  });
}

function normalizeLocalizedIngredientList(raw: unknown): ShopLocalizedValue<ShopIngredient[]> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    en: normalizeIngredientList(source.en),
    zh: normalizeIngredientList(source.zh),
  };
}

function normalizeVariantIconRules(raw: unknown): ShopVariantIconRule[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((rule) => {
    const source = rule && typeof rule === "object" ? (rule as Record<string, unknown>) : {};
    return {
      iconPath: typeof source.iconPath === "string" ? source.iconPath.trim() : "",
      match: normalizeVariantMatchKeys(source.match),
    };
  });
}

function buildDeletedIngredientKeySet(
  deletedIngredientKeys: readonly string[]
): ReadonlySet<string> {
  return new Set(
    deletedIngredientKeys
      .map((ingredientKey) => canonicalizeShopIngredientKey(ingredientKey))
      .filter(Boolean)
  );
}

export function removeDeletedIngredientKeysFromLocalizedIngredientRows(
  rows: ShopLocalizedValue<ShopIngredient[]>,
  deletedIngredientKeys: readonly string[]
): ShopLocalizedValue<ShopIngredient[]> {
  const deletedKeySet = buildDeletedIngredientKeySet(deletedIngredientKeys);
  if (deletedKeySet.size === 0) {
    return {
      en: rows.en.map((ingredient) => ({ ...ingredient })),
      zh: rows.zh.map((ingredient) => ({ ...ingredient })),
    };
  }

  const nextEn: ShopIngredient[] = [];
  const nextZh: ShopIngredient[] = [];

  rows.en.forEach((englishIngredient, ingredientIndex) => {
    const chineseIngredient = rows.zh[ingredientIndex];
    const englishKey = canonicalizeShopIngredientKey(englishIngredient.ingredientKey);
    const chineseKey = canonicalizeShopIngredientKey(chineseIngredient?.ingredientKey);
    const resolvedKey = englishKey || chineseKey;

    if (resolvedKey && deletedKeySet.has(resolvedKey)) {
      return;
    }

    nextEn.push({ ...englishIngredient });
    if (chineseIngredient) {
      nextZh.push({ ...chineseIngredient });
      return;
    }

    nextZh.push({
      ...(englishIngredient.ingredientKey
        ? { ingredientKey: englishIngredient.ingredientKey }
        : {}),
      name: "",
      quantity: englishIngredient.quantity,
    });
  });

  return {
    en: nextEn,
    zh: nextZh,
  };
}

export function removeDeletedIngredientKeysFromVariantIconRules(
  rules: ShopVariantIconRule[],
  deletedIngredientKeys: readonly string[]
): ShopVariantIconRule[] {
  const deletedKeySet = buildDeletedIngredientKeySet(deletedIngredientKeys);
  const seenSignatures = new Set<string>();

  return rules.reduce<ShopVariantIconRule[]>((result, rule) => {
    const nextMatch = normalizeVariantMatchKeys(rule.match).filter(
      (ingredientKey) => !deletedKeySet.has(ingredientKey)
    );
    const signature = nextMatch.join("|");
    if (seenSignatures.has(signature)) {
      return result;
    }

    seenSignatures.add(signature);
    result.push({
      iconPath: rule.iconPath,
      match: nextMatch,
    });
    return result;
  }, []);
}

export function removeDeletedIngredientKeysFromRecipe(
  recipe: ShopRecipe,
  deletedIngredientKeys: readonly string[]
): ShopRecipe {
  const nextBaseIngredientsI18n = removeDeletedIngredientKeysFromLocalizedIngredientRows(
    recipe.baseIngredientsI18n,
    deletedIngredientKeys
  );
  const nextSpecialIngredientsI18n = removeDeletedIngredientKeysFromLocalizedIngredientRows(
    recipe.specialIngredientsI18n,
    deletedIngredientKeys
  );

  return {
    ...recipe,
    baseIngredients: nextBaseIngredientsI18n.en.map((ingredient) => ({ ...ingredient })),
    baseIngredientsI18n: nextBaseIngredientsI18n,
    specialIngredients: nextSpecialIngredientsI18n.en.map((ingredient) => ({ ...ingredient })),
    specialIngredientsI18n: nextSpecialIngredientsI18n,
    variantIconRules: removeDeletedIngredientKeysFromVariantIconRules(
      recipe.variantIconRules,
      deletedIngredientKeys
    ),
  };
}

export function removeDeletedIngredientKeysFromRecipeAdminDraft(
  draft: ShopRecipeAdminDraft,
  deletedIngredientKeys: readonly string[]
): ShopRecipeAdminDraft {
  return {
    ...draft,
    baseIngredients: removeDeletedIngredientKeysFromLocalizedIngredientRows(
      draft.baseIngredients,
      deletedIngredientKeys
    ),
    specialIngredients: removeDeletedIngredientKeysFromLocalizedIngredientRows(
      draft.specialIngredients,
      deletedIngredientKeys
    ),
    variantIconRules: removeDeletedIngredientKeysFromVariantIconRules(
      draft.variantIconRules,
      deletedIngredientKeys
    ),
  };
}

export function listShopAdminVariantIngredientOptions(
  specialIngredients: ShopLocalizedValue<ShopIngredient[]>
): ShopAdminVariantIngredientOption[] {
  const optionsByKey = new Map<string, ShopAdminVariantIngredientOption>();

  specialIngredients.en.forEach((englishIngredient, ingredientIndex) => {
    const chineseIngredient = specialIngredients.zh[ingredientIndex];
    const key = canonicalizeShopIngredientKey(englishIngredient.ingredientKey);
    if (!key || optionsByKey.has(key)) {
      return;
    }

    optionsByKey.set(key, {
      key,
      label: {
        en: englishIngredient.name.trim() || key,
        zh: chineseIngredient?.name.trim() || englishIngredient.name.trim() || key,
      },
    });
  });

  return [...optionsByKey.values()].sort((left, right) =>
    left.label.en.localeCompare(right.label.en)
  );
}

export function normalizeShopRecipeAdminDraft(draft: {
  recipeId?: unknown;
  title?: unknown;
  intro?: unknown;
  baseIngredients?: unknown;
  specialIngredients?: unknown;
  variantIconRules?: unknown;
}): ShopRecipeAdminDraft {
  return {
    recipeId: typeof draft.recipeId === "string" ? draft.recipeId.trim() : "",
    title: normalizeLocalizedStringValue(draft.title),
    intro: normalizeLocalizedStringValue(draft.intro),
    baseIngredients: normalizeLocalizedIngredientList(draft.baseIngredients),
    specialIngredients: normalizeLocalizedIngredientList(draft.specialIngredients),
    variantIconRules: normalizeVariantIconRules(draft.variantIconRules),
  };
}

function validateLocalizedIngredientRows(params: {
  rows: ShopLocalizedValue<ShopIngredient[]>;
  rowLabel: string;
}): string[] {
  const errors: string[] = [];

  if (params.rows.en.length !== params.rows.zh.length) {
    errors.push(`English and Chinese ${params.rowLabel} rows must stay aligned.`);
    return errors;
  }

  const seenKeys = new Set<string>();

  params.rows.en.forEach((ingredient, index) => {
    const rowNumber = index + 1;
    const zhIngredient = params.rows.zh[index];
    const ingredientKey = canonicalizeShopIngredientKey(ingredient.ingredientKey);
    const zhIngredientKey = canonicalizeShopIngredientKey(zhIngredient?.ingredientKey);
    if (ingredientKey !== zhIngredientKey) {
      errors.push(`${params.rowLabel} ${rowNumber}: ingredient keys must stay aligned.`);
    }

    if (!ingredient.quantity) {
      errors.push(`${params.rowLabel} ${rowNumber}: quantity is required.`);
    } else if (
      !Number.isInteger(ingredient.quantity) ||
      ingredient.quantity < SHOP_INGREDIENT_QUANTITY_MIN ||
      ingredient.quantity > SHOP_INGREDIENT_QUANTITY_MAX
    ) {
      errors.push(
        `${params.rowLabel} ${rowNumber}: quantity must be a whole number from ${SHOP_INGREDIENT_QUANTITY_MIN} to ${SHOP_INGREDIENT_QUANTITY_MAX}.`
      );
    }

    if (ingredientKey) {
      if (seenKeys.has(ingredientKey)) {
        errors.push(`${params.rowLabel} ${rowNumber}: duplicate ingredient key "${ingredientKey}".`);
      } else {
        seenKeys.add(ingredientKey);
      }
      return;
    }

    if (!ingredient.name) {
      errors.push(`EN ${params.rowLabel.toLowerCase()} ${rowNumber}: name is required.`);
    } else if (ingredient.name.length > SHOP_RECIPE_INGREDIENT_NAME_MAX) {
      errors.push(
        `EN ${params.rowLabel.toLowerCase()} ${rowNumber}: name must be ${SHOP_RECIPE_INGREDIENT_NAME_MAX} characters or fewer.`
      );
    }

    if (!zhIngredient?.name) {
      errors.push(`ZH ${params.rowLabel.toLowerCase()} ${rowNumber}: name is required.`);
    } else if (zhIngredient.name.length > SHOP_RECIPE_INGREDIENT_NAME_MAX) {
      errors.push(
        `ZH ${params.rowLabel.toLowerCase()} ${rowNumber}: name must be ${SHOP_RECIPE_INGREDIENT_NAME_MAX} characters or fewer.`
      );
    }
  });

  return errors;
}

export function validateShopRecipeAdminDraft(draft: ShopRecipeAdminDraft): string[] {
  const normalized = normalizeShopRecipeAdminDraft(draft);
  const errors: string[] = [];

  if (!normalized.recipeId.trim()) {
    errors.push("Recipe id is required.");
  }

  for (const locale of ["en", "zh"] as const) {
    const localeLabel = locale.toUpperCase();
    if (!normalized.title[locale]) {
      errors.push(`${localeLabel} title is required.`);
    } else if (normalized.title[locale].length > SHOP_RECIPE_TITLE_MAX) {
      errors.push(
        `${localeLabel} title must be ${SHOP_RECIPE_TITLE_MAX} characters or fewer.`
      );
    }

    if (!normalized.intro[locale]) {
      errors.push(`${localeLabel} intro is required.`);
    } else if (normalized.intro[locale].length > SHOP_RECIPE_INTRO_MAX) {
      errors.push(
        `${localeLabel} intro must be ${SHOP_RECIPE_INTRO_MAX} characters or fewer.`
      );
    }
  }

  if (normalized.baseIngredients.en.length === 0) {
    errors.push("Add at least one base ingredient.");
  }

  errors.push(
    ...validateLocalizedIngredientRows({
      rows: normalized.baseIngredients,
      rowLabel: "Ingredient",
    })
  );
  errors.push(
    ...validateLocalizedIngredientRows({
      rows: normalized.specialIngredients,
      rowLabel: "Special ingredient",
    })
  );

  const allowedVariantOptionKeys = new Set(
    listShopAdminVariantIngredientOptions(normalized.specialIngredients).map((option) => option.key)
  );
  const seenVariantSignatures = new Set<string>();
  normalized.variantIconRules.forEach((rule, ruleIndex) => {
    const ruleNumber = ruleIndex + 1;
    if (!rule.iconPath) {
      errors.push(`Variant ${ruleNumber}: icon path is required.`);
    }

    const signature = rule.match.join("|");
    if (seenVariantSignatures.has(signature)) {
      errors.push(`Variant ${ruleNumber}: duplicate ingredient combination.`);
    } else {
      seenVariantSignatures.add(signature);
    }

    rule.match.forEach((matchKey) => {
      if (!allowedVariantOptionKeys.has(matchKey)) {
        errors.push(`Variant ${ruleNumber}: unknown special ingredient key "${matchKey}".`);
      }
    });
  });

  return errors;
}

export function areShopRecipeAdminDraftsEqual(
  left: ShopRecipeAdminDraft,
  right: ShopRecipeAdminDraft
): boolean {
  return (
    JSON.stringify(normalizeShopRecipeAdminDraft(left)) ===
    JSON.stringify(normalizeShopRecipeAdminDraft(right))
  );
}

function mergeLocalizedIngredientRows(params: {
  draftIngredients: ShopLocalizedValue<ShopIngredient[]>;
  labelByKey?: ShopIngredientLabelLookup;
}): ShopLocalizedValue<ShopIngredient[]> {
  if (params.draftIngredients.en.length !== params.draftIngredients.zh.length) {
    throw new Error("English and Chinese ingredient rows must stay aligned.");
  }

  const normalizedRows = params.draftIngredients.en.map((ingredient, index) => {
    const zhIngredient = params.draftIngredients.zh[index];
    const ingredientKey = canonicalizeShopIngredientKey(ingredient.ingredientKey);
    const zhIngredientKey = canonicalizeShopIngredientKey(zhIngredient?.ingredientKey);
    if (ingredientKey !== zhIngredientKey) {
      throw new Error(`Ingredient ${index + 1}: ingredient keys must stay aligned.`);
    }

    return {
      ingredientKey,
      enIngredient: ingredient,
      zhIngredient,
    };
  });

  return {
    en: normalizedRows.map(({ ingredientKey, enIngredient }) => {
      const localizedLabel = ingredientKey
        ? params.labelByKey?.get(ingredientKey) ?? getShopIngredientCatalogEntry(ingredientKey)?.label ?? null
        : null;

      return {
        ...(ingredientKey ? { ingredientKey } : {}),
        name: localizedLabel ? localizedLabel.en : enIngredient.name.trim(),
        quantity:
          parseShopIngredientQuantity(enIngredient.quantity) ?? SHOP_INGREDIENT_QUANTITY_MIN,
      };
    }),
    zh: normalizedRows.map(({ ingredientKey, enIngredient, zhIngredient }) => {
      const localizedLabel = ingredientKey
        ? params.labelByKey?.get(ingredientKey) ?? getShopIngredientCatalogEntry(ingredientKey)?.label ?? null
        : null;

      return {
        ...(ingredientKey ? { ingredientKey } : {}),
        name: localizedLabel
          ? localizedLabel.zh
          : zhIngredient.name.trim(),
        quantity:
          parseShopIngredientQuantity(zhIngredient.quantity) ??
          parseShopIngredientQuantity(enIngredient.quantity) ??
          SHOP_INGREDIENT_QUANTITY_MIN,
      };
    }),
  };
}

export function mergeReadonlyShopLocalizedIngredientRows(params: {
  draftIngredients: ShopLocalizedValue<ShopIngredient[]>;
  labelByKey?: ShopIngredientLabelLookup;
}): ShopLocalizedValue<ShopIngredient[]> {
  return mergeLocalizedIngredientRows({
    draftIngredients: params.draftIngredients,
    labelByKey: params.labelByKey,
  });
}

export function mergeShopLocalizedSpecialIngredientRows(params: {
  draftIngredients: ShopLocalizedValue<ShopIngredient[]>;
  labelByKey?: ShopIngredientLabelLookup;
}): ShopLocalizedValue<ShopIngredient[]> {
  return mergeLocalizedIngredientRows({
    draftIngredients: params.draftIngredients,
    labelByKey: params.labelByKey,
  });
}

export function mergeReadonlyVariantIconRules(params: {
  persistedRules: ShopVariantIconRule[];
  draftRules: ShopVariantIconRule[];
}): ShopVariantIconRule[] {
  if (params.persistedRules.length !== params.draftRules.length) {
    throw new Error("Variant icon rules must stay aligned.");
  }

  return params.persistedRules.map((persistedRule, index) => {
    const draftRule = params.draftRules[index];
    if (!draftRule) {
      throw new Error(`Variant icon rule ${index + 1} is missing from the draft.`);
    }

    return {
      iconPath: persistedRule.iconPath,
      match: normalizeVariantMatchKeys(draftRule.match),
    };
  });
}
