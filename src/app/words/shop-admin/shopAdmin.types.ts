import type {
  ShopIngredient,
  ShopLocalizedValue,
  ShopRecipe,
  ShopSpecialIngredientSlot,
} from "../shop/shop.types";

export const SHOP_RECIPE_TITLE_MAX = 80;
export const SHOP_RECIPE_INTRO_MAX = 240;
export const SHOP_RECIPE_INGREDIENT_NAME_MAX = 60;
export const SHOP_RECIPE_INGREDIENT_QUANTITY_MAX = 20;
export const SHOP_RECIPE_INGREDIENT_UNIT_MAX = 20;
export const SHOP_RECIPE_SPECIAL_LABEL_MAX = 60;
export const SHOP_RECIPE_SPECIAL_EFFECT_MAX = 120;

export type ShopRecipeAdminDraft = {
  recipeId: string;
  title: ShopLocalizedValue<string>;
  intro: ShopLocalizedValue<string>;
  baseIngredients: ShopLocalizedValue<ShopIngredient[]>;
  specialIngredientSlots: ShopLocalizedValue<ShopSpecialIngredientSlot[]>;
};

export type ShopAdminRecipesResponse = {
  recipes: ShopRecipe[];
};

export function buildShopRecipeAdminDraft(recipe: ShopRecipe): ShopRecipeAdminDraft {
  return {
    recipeId: recipe.id,
    title: { ...recipe.titleI18n },
    intro: { ...recipe.introI18n },
    baseIngredients: {
      en: recipe.baseIngredientsI18n.en.map((ingredient) => ({ ...ingredient })),
      zh: recipe.baseIngredientsI18n.zh.map((ingredient) => ({ ...ingredient })),
    },
    specialIngredientSlots: {
      en: recipe.specialIngredientSlotsI18n.en.map((slot) => ({
        ...slot,
        options: slot.options.map((option) => ({ ...option })),
      })),
      zh: recipe.specialIngredientSlotsI18n.zh.map((slot) => ({
        ...slot,
        options: slot.options.map((option) => ({ ...option })),
      })),
    },
  };
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
    const unit = typeof source.unit === "string" ? source.unit.trim() : "";
    return {
      name: typeof source.name === "string" ? source.name.trim() : "",
      quantity: typeof source.quantity === "string" ? source.quantity.trim() : "",
      ...(unit ? { unit } : {}),
    };
  });
}

function normalizeLocalizedIngredientList(
  raw: unknown
): ShopLocalizedValue<ShopIngredient[]> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    en: normalizeIngredientList(source.en),
    zh: normalizeIngredientList(source.zh),
  };
}

function normalizeSpecialIngredientSlotList(raw: unknown): ShopSpecialIngredientSlot[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((slot) => {
    const source = slot && typeof slot === "object" ? (slot as Record<string, unknown>) : {};
    const options = Array.isArray(source.options) ? source.options : [];
    return {
      slotKey: typeof source.slotKey === "string" ? source.slotKey.trim() : "",
      label: typeof source.label === "string" ? source.label.trim() : "",
      maxSelections:
        typeof source.maxSelections === "number" && Number.isFinite(source.maxSelections)
          ? source.maxSelections
          : 0,
      options: options.map((option) => {
        const optionSource =
          option && typeof option === "object" ? (option as Record<string, unknown>) : {};
        return {
          key: typeof optionSource.key === "string" ? optionSource.key.trim() : "",
          label: typeof optionSource.label === "string" ? optionSource.label.trim() : "",
          effect:
            typeof optionSource.effect === "string" ? optionSource.effect.trim() : "",
        };
      }),
    };
  });
}

function normalizeLocalizedSpecialIngredientSlotList(
  raw: unknown
): ShopLocalizedValue<ShopSpecialIngredientSlot[]> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    en: normalizeSpecialIngredientSlotList(source.en),
    zh: normalizeSpecialIngredientSlotList(source.zh),
  };
}

export function normalizeShopRecipeAdminDraft(draft: {
  recipeId?: unknown;
  title?: unknown;
  intro?: unknown;
  baseIngredients?: unknown;
  specialIngredientSlots?: unknown;
}): ShopRecipeAdminDraft {
  return {
    recipeId: typeof draft.recipeId === "string" ? draft.recipeId.trim() : "",
    title: normalizeLocalizedStringValue(draft.title),
    intro: normalizeLocalizedStringValue(draft.intro),
    baseIngredients: normalizeLocalizedIngredientList(draft.baseIngredients),
    specialIngredientSlots: normalizeLocalizedSpecialIngredientSlotList(
      draft.specialIngredientSlots
    ),
  };
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
  if (normalized.baseIngredients.en.length !== normalized.baseIngredients.zh.length) {
    errors.push("English and Chinese base ingredient rows must stay aligned.");
  }

  normalized.baseIngredients.en.forEach((ingredient, index) => {
    const rowNumber = index + 1;
    const zhIngredient = normalized.baseIngredients.zh[index];
    if (!ingredient.name) {
      errors.push(`EN ingredient ${rowNumber}: name is required.`);
    } else if (ingredient.name.length > SHOP_RECIPE_INGREDIENT_NAME_MAX) {
      errors.push(
        `EN ingredient ${rowNumber}: name must be ${SHOP_RECIPE_INGREDIENT_NAME_MAX} characters or fewer.`
      );
    }

    if (!zhIngredient?.name) {
      errors.push(`ZH ingredient ${rowNumber}: name is required.`);
    } else if (zhIngredient.name.length > SHOP_RECIPE_INGREDIENT_NAME_MAX) {
      errors.push(
        `ZH ingredient ${rowNumber}: name must be ${SHOP_RECIPE_INGREDIENT_NAME_MAX} characters or fewer.`
      );
    }

    if (!ingredient.quantity) {
      errors.push(`Ingredient ${rowNumber}: quantity is required.`);
    } else if (ingredient.quantity.length > SHOP_RECIPE_INGREDIENT_QUANTITY_MAX) {
      errors.push(
        `Ingredient ${rowNumber}: quantity must be ${SHOP_RECIPE_INGREDIENT_QUANTITY_MAX} characters or fewer.`
      );
    }

    if (ingredient.unit && ingredient.unit.length > SHOP_RECIPE_INGREDIENT_UNIT_MAX) {
      errors.push(
        `EN ingredient ${rowNumber}: unit must be ${SHOP_RECIPE_INGREDIENT_UNIT_MAX} characters or fewer.`
      );
    }
    if (zhIngredient?.unit && zhIngredient.unit.length > SHOP_RECIPE_INGREDIENT_UNIT_MAX) {
      errors.push(
        `ZH ingredient ${rowNumber}: unit must be ${SHOP_RECIPE_INGREDIENT_UNIT_MAX} characters or fewer.`
      );
    }
  });

  if (
    normalized.specialIngredientSlots.en.length !==
    normalized.specialIngredientSlots.zh.length
  ) {
    errors.push("English and Chinese specialty ingredient slots must stay aligned.");
  }

  normalized.specialIngredientSlots.en.forEach((slot, slotIndex) => {
    const slotNumber = slotIndex + 1;
    const zhSlot = normalized.specialIngredientSlots.zh[slotIndex];
    if (!slot.slotKey.trim()) {
      errors.push(`Special ingredient slot ${slotNumber}: slot key is required.`);
    }

    if (!slot.label) {
      errors.push(`EN special ingredient slot ${slotNumber}: label is required.`);
    } else if (slot.label.length > SHOP_RECIPE_SPECIAL_LABEL_MAX) {
      errors.push(
        `EN special ingredient slot ${slotNumber}: label must be ${SHOP_RECIPE_SPECIAL_LABEL_MAX} characters or fewer.`
      );
    }

    if (!zhSlot?.label) {
      errors.push(`ZH special ingredient slot ${slotNumber}: label is required.`);
    } else if (zhSlot.label.length > SHOP_RECIPE_SPECIAL_LABEL_MAX) {
      errors.push(
        `ZH special ingredient slot ${slotNumber}: label must be ${SHOP_RECIPE_SPECIAL_LABEL_MAX} characters or fewer.`
      );
    }

    slot.options.forEach((option, optionIndex) => {
      const optionNumber = optionIndex + 1;
      const zhOption = zhSlot?.options[optionIndex];
      if (!option.key.trim()) {
        errors.push(
          `Special ingredient slot ${slotNumber}, option ${optionNumber}: option key is required.`
        );
      }

      if (!option.label) {
        errors.push(
          `EN special ingredient slot ${slotNumber}, option ${optionNumber}: label is required.`
        );
      } else if (option.label.length > SHOP_RECIPE_SPECIAL_LABEL_MAX) {
        errors.push(
          `EN special ingredient slot ${slotNumber}, option ${optionNumber}: label must be ${SHOP_RECIPE_SPECIAL_LABEL_MAX} characters or fewer.`
        );
      }

      if (!zhOption?.label) {
        errors.push(
          `ZH special ingredient slot ${slotNumber}, option ${optionNumber}: label is required.`
        );
      } else if (zhOption.label.length > SHOP_RECIPE_SPECIAL_LABEL_MAX) {
        errors.push(
          `ZH special ingredient slot ${slotNumber}, option ${optionNumber}: label must be ${SHOP_RECIPE_SPECIAL_LABEL_MAX} characters or fewer.`
        );
      }

      if (!option.effect) {
        errors.push(
          `EN special ingredient slot ${slotNumber}, option ${optionNumber}: note is required.`
        );
      } else if (option.effect.length > SHOP_RECIPE_SPECIAL_EFFECT_MAX) {
        errors.push(
          `EN special ingredient slot ${slotNumber}, option ${optionNumber}: note must be ${SHOP_RECIPE_SPECIAL_EFFECT_MAX} characters or fewer.`
        );
      }

      if (!zhOption?.effect) {
        errors.push(
          `ZH special ingredient slot ${slotNumber}, option ${optionNumber}: note is required.`
        );
      } else if (zhOption.effect.length > SHOP_RECIPE_SPECIAL_EFFECT_MAX) {
        errors.push(
          `ZH special ingredient slot ${slotNumber}, option ${optionNumber}: note must be ${SHOP_RECIPE_SPECIAL_EFFECT_MAX} characters or fewer.`
        );
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

function mergeReadonlySlotLogicForLocale(params: {
  persistedSlots: ShopSpecialIngredientSlot[];
  draftSlots: ShopSpecialIngredientSlot[];
}): ShopSpecialIngredientSlot[] {
  const draftBySlotKey = new Map(params.draftSlots.map((slot) => [slot.slotKey, slot] as const));
  if (draftBySlotKey.size !== params.draftSlots.length) {
    throw new Error("Duplicate special ingredient slot keys are not allowed.");
  }

  return params.persistedSlots.map((persistedSlot) => {
    const matchingDraftSlot = draftBySlotKey.get(persistedSlot.slotKey);
    if (!matchingDraftSlot) {
      throw new Error(`Special ingredient slot ${persistedSlot.slotKey} is missing from the draft.`);
    }

    const draftOptionByKey = new Map(
      matchingDraftSlot.options.map((option) => [option.key, option] as const)
    );
    if (draftOptionByKey.size !== matchingDraftSlot.options.length) {
      throw new Error(`Special ingredient slot ${persistedSlot.slotKey} contains duplicate option keys.`);
    }

    return {
      slotKey: persistedSlot.slotKey,
      label: matchingDraftSlot.label.trim(),
      maxSelections: persistedSlot.maxSelections,
      options: persistedSlot.options.map((persistedOption) => {
        const matchingDraftOption = draftOptionByKey.get(persistedOption.key);
        if (!matchingDraftOption) {
          throw new Error(
            `Special ingredient option ${persistedOption.key} is missing from slot ${persistedSlot.slotKey}.`
          );
        }

        return {
          key: persistedOption.key,
          label: matchingDraftOption.label.trim(),
          effect: matchingDraftOption.effect.trim(),
        };
      }),
    };
  });
}

export function mergeReadonlySpecialIngredientLogic(params: {
  persistedSlots: ShopSpecialIngredientSlot[];
  draftSlots: ShopLocalizedValue<ShopSpecialIngredientSlot[]>;
}): ShopLocalizedValue<ShopSpecialIngredientSlot[]> {
  return {
    en: mergeReadonlySlotLogicForLocale({
      persistedSlots: params.persistedSlots,
      draftSlots: params.draftSlots.en,
    }),
    zh: mergeReadonlySlotLogicForLocale({
      persistedSlots: params.persistedSlots,
      draftSlots: params.draftSlots.zh,
    }),
  };
}

export function mergeReadonlyShopLocalizedIngredientRows(params: {
  draftIngredients: ShopLocalizedValue<ShopIngredient[]>;
}): ShopLocalizedValue<ShopIngredient[]> {
  if (params.draftIngredients.en.length !== params.draftIngredients.zh.length) {
    throw new Error("English and Chinese base ingredient rows must stay aligned.");
  }

  return {
    en: params.draftIngredients.en.map((ingredient) => ({
      name: ingredient.name.trim(),
      quantity: ingredient.quantity.trim(),
      ...(ingredient.unit?.trim() ? { unit: ingredient.unit.trim() } : {}),
    })),
    zh: params.draftIngredients.zh.map((ingredient, index) => ({
      name: ingredient.name.trim(),
      quantity:
        ingredient.quantity.trim() || params.draftIngredients.en[index]?.quantity.trim() || "",
      ...(ingredient.unit?.trim() ? { unit: ingredient.unit.trim() } : {}),
    })),
  };
}
