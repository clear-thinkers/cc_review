import { NextRequest, NextResponse } from "next/server";
import {
  buildShopAdminIngredientCatalogItems,
  canonicalizeShopIngredientKey,
  type ShopAdminIngredientPricesResponse,
} from "@/lib/shopIngredients";
import type { ShopRecipe } from "@/lib/shop.types";
import {
  SHOP_ADMIN_INGREDIENT_SAVE_ERROR_CODES,
  removeDeletedIngredientKeysFromLocalizedIngredientRows,
  removeDeletedIngredientKeysFromVariantIconRules,
} from "@/lib/shopAdmin.types";
import {
  normalizeShopLocalizedSpecialIngredients,
  normalizeShopLocalizedIngredients,
  normalizeShopIngredientList,
  normalizeShopVariantIconRules,
  normalizeShopSpecialIngredientList,
} from "@/lib/shop";
import { getServerSupabaseClient, supabase } from "@/lib/supabaseClient";

type ShopIngredientPriceRow = {
  ingredient_key: string;
  cost_coins: number;
  label_i18n?: unknown;
  icon_path?: string | null;
};

type ShopRecipeSpecialIngredientRow = {
  id: string;
  base_ingredients: unknown;
  base_ingredients_i18n?: unknown;
  special_ingredient_slots: unknown;
  special_ingredient_slots_i18n?: unknown;
  variant_icon_rules?: unknown;
};

function isMissingIconPathColumnError(error: { message?: string } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("icon_path") && message.includes("column");
}

const SHOP_ADMIN_ICON_PATH_MIGRATION = "20260325193000_shop_ingredient_icon_paths.sql";

async function authorizePlatformAdmin(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Missing Authorization header." },
        { status: 401 }
      ),
      adminClient: null,
      profileId: null,
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "Invalid or expired session." },
        { status: 401 }
      ),
      adminClient: null,
      profileId: null,
    };
  }

  const profileId =
    typeof user.app_metadata.user_id === "string" ? user.app_metadata.user_id : null;
  if (!profileId || user.app_metadata.is_platform_admin !== true) {
    return {
      error: NextResponse.json(
        { error: "Platform admin access is required." },
        { status: 403 }
      ),
      adminClient: null,
      profileId: null,
    };
  }

  let adminClient;
  try {
    adminClient = getServerSupabaseClient();
  } catch {
    return {
      error: NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      ),
      adminClient: null,
      profileId: null,
    };
  }

  const { data: profileRow, error: profileError } = await adminClient
    .from("users")
    .select("id, is_platform_admin")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError || !profileRow || profileRow.is_platform_admin !== true) {
    return {
      error: NextResponse.json(
        { error: "Platform admin access is required." },
        { status: 403 }
      ),
      adminClient: null,
      profileId: null,
    };
  }

  return {
    error: null,
    adminClient,
    profileId,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizePlatformAdmin(request);
  if (auth.error || !auth.adminClient) {
    return auth.error!;
  }

  const { data: recipeData, error: recipeError } = await auth.adminClient
    .from("shop_recipes")
    .select(
      "base_ingredients, base_ingredients_i18n, special_ingredient_slots, special_ingredient_slots_i18n"
    );

  let {
    data: priceData,
    error: priceError,
  }: { data: ShopIngredientPriceRow[] | null; error: { message?: string } | null } =
    await auth.adminClient
    .from("shop_ingredient_prices")
    .select("ingredient_key, cost_coins, label_i18n, icon_path")
    .order("ingredient_key", { ascending: true });

  if (isMissingIconPathColumnError(priceError)) {
    const fallbackPriceResult = await auth.adminClient
      .from("shop_ingredient_prices")
      .select("ingredient_key, cost_coins, label_i18n")
      .order("ingredient_key", { ascending: true });

    priceData = fallbackPriceResult.data;
    priceError = fallbackPriceResult.error;
  }

  if (priceError || recipeError) {
    return NextResponse.json(
      { error: "Could not load ingredient prices." },
      { status: 500 }
    );
  }

  const ingredientCatalogRecipes: Pick<
    ShopRecipe,
    "baseIngredientsI18n" | "specialIngredientsI18n"
  >[] = (
    (recipeData ?? []) as ShopRecipeSpecialIngredientRow[]
  ).map((row) => {
    const baseIngredients = normalizeShopIngredientList(row.base_ingredients, []);
    const specialIngredients = normalizeShopSpecialIngredientList(
      row.special_ingredient_slots,
      []
    );
    return {
      baseIngredientsI18n: normalizeShopLocalizedIngredients(
        row.base_ingredients_i18n,
        baseIngredients
      ),
      specialIngredientsI18n: normalizeShopLocalizedSpecialIngredients(
        row.special_ingredient_slots_i18n,
        specialIngredients
      ),
    };
  });

  const response: ShopAdminIngredientPricesResponse = {
    ingredients: buildShopAdminIngredientCatalogItems(
      ((priceData ?? []) as ShopIngredientPriceRow[]).map((row) => ({
        ingredientKey: canonicalizeShopIngredientKey(row.ingredient_key),
        costCoins: row.cost_coins,
        updatedAt: Date.now(),
        iconPath:
          typeof row.icon_path === "string" ? row.icon_path.trim() || null : null,
        labelI18n:
          row.label_i18n && typeof row.label_i18n === "object"
            ? {
                en:
                  typeof (row.label_i18n as { en?: unknown }).en === "string"
                    ? ((row.label_i18n as { en: string }).en ?? "").trim()
                    : "",
                zh:
                  typeof (row.label_i18n as { zh?: unknown }).zh === "string"
                    ? ((row.label_i18n as { zh: string }).zh ?? "").trim()
                    : "",
              }
            : undefined,
      })),
      ingredientCatalogRecipes
    ),
  };

  return NextResponse.json(response);
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizePlatformAdmin(request);
  if (auth.error || !auth.adminClient) {
    return auth.error!;
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const body =
    rawBody && typeof rawBody === "object" ? (rawBody as { ingredients?: unknown }) : {};
  const rawIngredients = Array.isArray(body.ingredients) ? body.ingredients : [];
  const normalizedIngredients = rawIngredients
    .map((ingredient) => {
      const source =
        ingredient && typeof ingredient === "object"
          ? (ingredient as Record<string, unknown>)
          : {};
      return {
        ingredientKey:
          canonicalizeShopIngredientKey(
            typeof source.key === "string"
              ? source.key
              : typeof source.ingredientKey === "string"
                ? source.ingredientKey
                : ""
          ),
        costCoins:
          typeof source.costCoins === "number" && Number.isFinite(source.costCoins)
            ? source.costCoins
            : NaN,
        labelI18n:
          source.label && typeof source.label === "object"
            ? {
                en:
                  typeof (source.label as { en?: unknown }).en === "string"
                    ? ((source.label as { en: string }).en ?? "").trim()
                    : "",
                zh:
                  typeof (source.label as { zh?: unknown }).zh === "string"
                    ? ((source.label as { zh: string }).zh ?? "").trim()
                    : "",
              }
            : { en: "", zh: "" },
        iconPath:
          typeof source.iconPath === "string"
            ? source.iconPath.trim() || null
            : null,
      };
    })
    .filter((ingredient) => ingredient.ingredientKey);

  const invalidIngredient = normalizedIngredients.find(
    (ingredient) => !Number.isInteger(ingredient.costCoins) || ingredient.costCoins < 0
  );
  if (invalidIngredient) {
    return NextResponse.json(
      { error: `Ingredient ${invalidIngredient.ingredientKey} must have a whole-number cost.` },
      { status: 400 }
    );
  }

  const upsertRows = normalizedIngredients.map((ingredient) => ({
    ingredient_key: ingredient.ingredientKey,
    cost_coins: ingredient.costCoins,
    label_i18n: ingredient.labelI18n,
    icon_path: ingredient.iconPath,
    updated_at: new Date().toISOString(),
  }));

  const { data: currentPriceRows, error: currentPriceError } = await auth.adminClient
    .from("shop_ingredient_prices")
    .select("ingredient_key");

  if (currentPriceError) {
    return NextResponse.json(
      { error: "Could not load current ingredient prices." },
      { status: 500 }
    );
  }

  const persistedPriceRows = (currentPriceRows ?? []) as Pick<
    ShopIngredientPriceRow,
    "ingredient_key"
  >[];
  const nextIngredientKeys = new Set(
    normalizedIngredients.map((ingredient) => ingredient.ingredientKey)
  );
  const deletedIngredientKeys = persistedPriceRows
    .map((row) => canonicalizeShopIngredientKey(row.ingredient_key))
    .filter((ingredientKey) => ingredientKey && !nextIngredientKeys.has(ingredientKey));
  const deletedIngredientRowKeys = persistedPriceRows
    .map((row) => row.ingredient_key)
    .filter((ingredientKey) => {
      const canonicalKey = canonicalizeShopIngredientKey(ingredientKey);
      return canonicalKey && !nextIngredientKeys.has(canonicalKey);
    });

  if (deletedIngredientKeys.length > 0) {
    const { data: recipeRows, error: recipeLoadError } = await auth.adminClient
      .from("shop_recipes")
      .select(
        "id, base_ingredients, base_ingredients_i18n, special_ingredient_slots, special_ingredient_slots_i18n, variant_icon_rules"
      );

    if (recipeLoadError) {
      return NextResponse.json(
        { error: "Could not load recipes for ingredient cleanup." },
        { status: 500 }
      );
    }

    const changedRecipes = ((recipeRows ?? []) as ShopRecipeSpecialIngredientRow[])
      .map((row) => {
        const baseIngredients = normalizeShopIngredientList(row.base_ingredients, []);
        const specialIngredients = normalizeShopSpecialIngredientList(
          row.special_ingredient_slots,
          []
        );
        const currentBaseIngredientsI18n = normalizeShopLocalizedIngredients(
          row.base_ingredients_i18n,
          baseIngredients
        );
        const currentSpecialIngredientsI18n = normalizeShopLocalizedSpecialIngredients(
          row.special_ingredient_slots_i18n,
          specialIngredients
        );
        const currentVariantIconRules = normalizeShopVariantIconRules(
          row.variant_icon_rules
        );

        const nextBaseIngredientsI18n = removeDeletedIngredientKeysFromLocalizedIngredientRows(
          currentBaseIngredientsI18n,
          deletedIngredientKeys
        );
        const nextSpecialIngredientsI18n = removeDeletedIngredientKeysFromLocalizedIngredientRows(
          currentSpecialIngredientsI18n,
          deletedIngredientKeys
        );
        const nextVariantIconRules = removeDeletedIngredientKeysFromVariantIconRules(
          currentVariantIconRules,
          deletedIngredientKeys
        );

        const hasIngredientChanges =
          JSON.stringify(nextBaseIngredientsI18n) !==
            JSON.stringify(currentBaseIngredientsI18n) ||
          JSON.stringify(nextSpecialIngredientsI18n) !==
            JSON.stringify(currentSpecialIngredientsI18n) ||
          JSON.stringify(nextVariantIconRules) !== JSON.stringify(currentVariantIconRules);

        if (!hasIngredientChanges) {
          return null;
        }

        return {
          id: row.id,
          base_ingredients: nextBaseIngredientsI18n.en,
          base_ingredients_i18n: nextBaseIngredientsI18n,
          special_ingredient_slots: nextSpecialIngredientsI18n.en,
          special_ingredient_slots_i18n: nextSpecialIngredientsI18n,
          variant_icon_rules: nextVariantIconRules,
          updated_at: new Date().toISOString(),
        };
      })
      .filter(
        (
          recipe
        ): recipe is {
          id: string;
          base_ingredients: ShopRecipe["baseIngredients"];
          base_ingredients_i18n: ShopRecipe["baseIngredientsI18n"];
          special_ingredient_slots: ShopRecipe["specialIngredients"];
          special_ingredient_slots_i18n: ShopRecipe["specialIngredientsI18n"];
          variant_icon_rules: ShopRecipe["variantIconRules"];
          updated_at: string;
        } => recipe !== null
      );

    for (const recipe of changedRecipes) {
      const { error: recipeUpdateError } = await auth.adminClient
        .from("shop_recipes")
        .update({
          base_ingredients: recipe.base_ingredients,
          base_ingredients_i18n: recipe.base_ingredients_i18n,
          special_ingredient_slots: recipe.special_ingredient_slots,
          special_ingredient_slots_i18n: recipe.special_ingredient_slots_i18n,
          variant_icon_rules: recipe.variant_icon_rules,
          updated_at: recipe.updated_at,
        })
        .eq("id", recipe.id);

      if (recipeUpdateError) {
        return NextResponse.json(
          { error: "Could not remove deleted ingredients from recipes." },
          { status: 500 }
        );
      }
    }
  }

  if (upsertRows.length > 0) {
    let { error } = await auth.adminClient.from("shop_ingredient_prices").upsert(upsertRows, {
      onConflict: "ingredient_key",
    });

    if (isMissingIconPathColumnError(error)) {
      return NextResponse.json(
        {
          error:
            "Ingredient icon paths cannot be saved until shop_ingredient_prices.icon_path exists. Run migration " +
            `${SHOP_ADMIN_ICON_PATH_MIGRATION} and try again.`,
          errorCode: SHOP_ADMIN_INGREDIENT_SAVE_ERROR_CODES.missingIconPathColumn,
        },
        { status: 500 }
      );
    }

    if (error) {
      return NextResponse.json(
        { error: "Could not save ingredient prices." },
        { status: 500 }
      );
    }
  }

  if (deletedIngredientRowKeys.length > 0) {
    const { error: deleteError } = await auth.adminClient
      .from("shop_ingredient_prices")
      .delete()
      .in("ingredient_key", deletedIngredientRowKeys);

    if (deleteError) {
      return NextResponse.json(
        { error: "Could not delete removed ingredients." },
        { status: 500 }
      );
    }
  }

  return GET(request);
}
