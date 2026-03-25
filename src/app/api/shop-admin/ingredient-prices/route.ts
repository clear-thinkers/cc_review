import { NextRequest, NextResponse } from "next/server";
import {
  buildShopAdminIngredientCatalogItems,
  type ShopAdminIngredientPricesResponse,
} from "@/app/words/shop/shopIngredients";
import type { ShopRecipe } from "@/app/words/shop/shop.types";
import { normalizeShopLocalizedSpecialIngredients } from "@/lib/shop";
import { getServerSupabaseClient, supabase } from "@/lib/supabaseClient";

type ShopIngredientPriceRow = {
  ingredient_key: string;
  cost_coins: number;
  label_i18n?: unknown;
};

type ShopRecipeSpecialIngredientRow = {
  special_ingredient_slots: unknown;
  special_ingredient_slots_i18n?: unknown;
};

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

  const [{ data: priceData, error: priceError }, { data: recipeData, error: recipeError }] =
    await Promise.all([
      auth.adminClient
        .from("shop_ingredient_prices")
        .select("ingredient_key, cost_coins, label_i18n")
        .order("ingredient_key", { ascending: true }),
      auth.adminClient
        .from("shop_recipes")
        .select("special_ingredient_slots, special_ingredient_slots_i18n"),
    ]);

  if (priceError || recipeError) {
    return NextResponse.json(
      { error: "Could not load ingredient prices." },
      { status: 500 }
    );
  }

  const specialIngredientRecipes: Pick<ShopRecipe, "specialIngredientsI18n">[] = (
    (recipeData ?? []) as ShopRecipeSpecialIngredientRow[]
  ).map((row) => {
    const specialIngredients = Array.isArray(row.special_ingredient_slots)
      ? (row.special_ingredient_slots as ShopRecipe["specialIngredients"])
      : [];
    return {
      specialIngredientsI18n: normalizeShopLocalizedSpecialIngredients(
        row.special_ingredient_slots_i18n,
        specialIngredients
      ),
    };
  });

  const response: ShopAdminIngredientPricesResponse = {
    ingredients: buildShopAdminIngredientCatalogItems(
      ((priceData ?? []) as ShopIngredientPriceRow[]).map((row) => ({
        ingredientKey: row.ingredient_key,
        costCoins: row.cost_coins,
        updatedAt: Date.now(),
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
      specialIngredientRecipes
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
          typeof source.key === "string"
            ? source.key.trim()
            : typeof source.ingredientKey === "string"
              ? source.ingredientKey.trim()
              : "",
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
      };
    })
    .filter((ingredient) => ingredient.ingredientKey);

  if (normalizedIngredients.length === 0) {
    return NextResponse.json({ error: "No ingredient prices provided." }, { status: 400 });
  }

  const invalidIngredient = normalizedIngredients.find(
    (ingredient) => !Number.isInteger(ingredient.costCoins) || ingredient.costCoins < 0
  );
  if (invalidIngredient) {
    return NextResponse.json(
      { error: `Ingredient ${invalidIngredient.ingredientKey} must have a whole-number cost.` },
      { status: 400 }
    );
  }

  const { error } = await auth.adminClient.from("shop_ingredient_prices").upsert(
    normalizedIngredients.map((ingredient) => ({
      ingredient_key: ingredient.ingredientKey,
      cost_coins: ingredient.costCoins,
      label_i18n: ingredient.labelI18n,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "ingredient_key" }
  );

  if (error) {
    return NextResponse.json(
      { error: "Could not save ingredient prices." },
      { status: 500 }
    );
  }

  return GET(request);
}
