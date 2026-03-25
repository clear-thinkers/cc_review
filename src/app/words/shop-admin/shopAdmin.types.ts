import type {
  ShopIngredient,
  ShopLocalizedValue,
  ShopRecipe,
  ShopVariantIconRule,
} from "../shop/shop.types";
import { getShopIngredientCatalogEntry } from "../shop/shopIngredients";
import {
  SHOP_INGREDIENT_QUANTITY_MAX,
  SHOP_INGREDIENT_QUANTITY_MIN,
  parseShopIngredientQuantity,
} from "@/lib/shop";

export const SHOP_RECIPE_TITLE_MAX = 80;
export const SHOP_RECIPE_INTRO_MAX = 240;
export const SHOP_RECIPE_INGREDIENT_NAME_MAX = 60;

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

type ShopIngredientLabelLookup = ReadonlyMap<string, ShopLocalizedValue<string>>;

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
  if (!Array.isArray(raw)) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
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
    const ingredientKey =
      typeof source.ingredientKey === "string" ? source.ingredientKey.trim() : "";
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

export function listShopAdminVariantIngredientOptions(
  specialIngredients: ShopLocalizedValue<ShopIngredient[]>
): ShopAdminVariantIngredientOption[] {
  const optionsByKey = new Map<string, ShopAdminVariantIngredientOption>();

  specialIngredients.en.forEach((englishIngredient, ingredientIndex) => {
    const chineseIngredient = specialIngredients.zh[ingredientIndex];
    const key = englishIngredient.ingredientKey?.trim() ?? "";
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
  requireKnownCatalogKey: boolean;
}): string[] {
  const errors: string[] = [];

  if (params.rows.en.length !== params.rows.zh.length) {
    errors.push(`English and Chinese ${params.rowLabel} rows must stay aligned.`);
    return errors;
  }

  const seenSpecialKeys = new Set<string>();

  params.rows.en.forEach((ingredient, index) => {
    const rowNumber = index + 1;
    const zhIngredient = params.rows.zh[index];
    const ingredientKey = ingredient.ingredientKey?.trim() ?? "";
    const zhIngredientKey = zhIngredient?.ingredientKey?.trim() ?? "";
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
      if (params.requireKnownCatalogKey && !getShopIngredientCatalogEntry(ingredientKey)) {
        errors.push(`${params.rowLabel} ${rowNumber}: unknown ingredient key "${ingredientKey}".`);
      }
      if (!params.requireKnownCatalogKey) {
        if (seenSpecialKeys.has(ingredientKey)) {
          errors.push(`${params.rowLabel} ${rowNumber}: duplicate ingredient key "${ingredientKey}".`);
        } else {
          seenSpecialKeys.add(ingredientKey);
        }
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
      requireKnownCatalogKey: true,
    })
  );
  errors.push(
    ...validateLocalizedIngredientRows({
      rows: normalized.specialIngredients,
      rowLabel: "Special ingredient",
      requireKnownCatalogKey: false,
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
  requireKnownCatalogKey: boolean;
}): ShopLocalizedValue<ShopIngredient[]> {
  if (params.draftIngredients.en.length !== params.draftIngredients.zh.length) {
    throw new Error("English and Chinese ingredient rows must stay aligned.");
  }

  const normalizedRows = params.draftIngredients.en.map((ingredient, index) => {
    const zhIngredient = params.draftIngredients.zh[index];
    const ingredientKey = ingredient.ingredientKey?.trim() ?? "";
    const zhIngredientKey = zhIngredient?.ingredientKey?.trim() ?? "";
    if (ingredientKey !== zhIngredientKey) {
      throw new Error(`Ingredient ${index + 1}: ingredient keys must stay aligned.`);
    }

    if (params.requireKnownCatalogKey && ingredientKey && !getShopIngredientCatalogEntry(ingredientKey)) {
      throw new Error(`Ingredient ${index + 1}: unknown ingredient key "${ingredientKey}".`);
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
    requireKnownCatalogKey: true,
  });
}

export function mergeShopLocalizedSpecialIngredientRows(params: {
  draftIngredients: ShopLocalizedValue<ShopIngredient[]>;
  labelByKey?: ShopIngredientLabelLookup;
}): ShopLocalizedValue<ShopIngredient[]> {
  return mergeLocalizedIngredientRows({
    draftIngredients: params.draftIngredients,
    labelByKey: params.labelByKey,
    requireKnownCatalogKey: false,
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
