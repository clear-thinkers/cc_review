import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import type { DebugShopIngredientIconAuditResponse } from "@/app/words/debug/debug.types";
import {
  buildShopAdminIngredientCatalogItems,
  canonicalizeShopIngredientKey,
} from "@/app/words/shop/shopIngredients";
import type { ShopRecipe } from "@/app/words/shop/shop.types";
import {
  normalizeShopLocalizedIngredients,
  normalizeShopLocalizedSpecialIngredients,
  normalizeShopIngredientList,
  normalizeShopSpecialIngredientList,
} from "@/lib/shop";
import {
  auditShopIngredientCatalogItems,
  resolvePublicAssetFilePath,
  validateShopIngredientIconPath,
} from "@/lib/shopIngredientIconAudit";
import { getServerSupabaseClient, supabase } from "@/lib/supabaseClient";

type ShopIngredientPriceRow = {
  ingredient_key: string;
  cost_coins: number;
  label_i18n?: unknown;
  icon_path?: string | null;
};

type ShopRecipeIngredientReferenceRow = {
  base_ingredients: unknown;
  base_ingredients_i18n?: unknown;
  special_ingredient_slots: unknown;
  special_ingredient_slots_i18n?: unknown;
};

type IngredientIconAuditPatchBody =
  | {
      action?: "update_path";
      ingredientKey?: unknown;
      iconPath?: unknown;
    }
  | {
      action?: "clear_path";
      ingredientKey?: unknown;
      iconPath?: unknown;
    };

function isMissingIconPathColumnError(error: { message?: string } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("icon_path") && message.includes("column");
}

async function doesIngredientIconExist(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listAvailableIngredientIconPaths(): Promise<string[]> {
  const ingredientsDir = path.join(process.cwd(), "public", "ingredients");

  try {
    const fileNames = await readdir(ingredientsDir, { withFileTypes: true });
    return fileNames
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
      .map((entry) => `/ingredients/${entry.name}`)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

async function authorizePlatformAdmin(request: NextRequest): Promise<{
  adminClient: ReturnType<typeof getServerSupabaseClient> | null;
  error: NextResponse | null;
}> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Missing Authorization header." },
        { status: 401 }
      ),
      adminClient: null,
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
    };
  }

  return {
    error: null,
    adminClient,
  };
}

async function loadAuditResponse(
  adminClient: ReturnType<typeof getServerSupabaseClient>
): Promise<{ error: NextResponse | null; response: DebugShopIngredientIconAuditResponse | null }> {
  const { data: recipeData, error: recipeError } = await adminClient
    .from("shop_recipes")
    .select(
      "base_ingredients, base_ingredients_i18n, special_ingredient_slots, special_ingredient_slots_i18n"
    );

  let {
    data: priceData,
    error: priceError,
  }: { data: ShopIngredientPriceRow[] | null; error: { message?: string } | null } =
    await adminClient
      .from("shop_ingredient_prices")
      .select("ingredient_key, cost_coins, label_i18n, icon_path")
      .order("ingredient_key", { ascending: true });

  if (isMissingIconPathColumnError(priceError)) {
    const fallbackPriceResult = await adminClient
      .from("shop_ingredient_prices")
      .select("ingredient_key, cost_coins, label_i18n")
      .order("ingredient_key", { ascending: true });

    priceData = fallbackPriceResult.data;
    priceError = fallbackPriceResult.error;
  }

  if (recipeError || priceError) {
    return {
      error: NextResponse.json(
        { error: "Could not load shop ingredient icon audit data." },
        { status: 500 }
      ),
      response: null,
    };
  }

  const priceKeys = new Set(
    ((priceData ?? []) as ShopIngredientPriceRow[]).map((row) =>
      canonicalizeShopIngredientKey(row.ingredient_key)
    )
  );
  const ingredientCatalogRecipes: Pick<
    ShopRecipe,
    "baseIngredientsI18n" | "specialIngredientsI18n"
  >[] = ((recipeData ?? []) as ShopRecipeIngredientReferenceRow[]).map((row) => {
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

  const ingredientCatalogItems = buildShopAdminIngredientCatalogItems(
    ((priceData ?? []) as ShopIngredientPriceRow[]).map((row) => ({
      ingredientKey: canonicalizeShopIngredientKey(row.ingredient_key),
      costCoins: row.cost_coins,
      updatedAt: Date.now(),
      iconPath: typeof row.icon_path === "string" ? row.icon_path.trim() || null : null,
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
  ).map((item) => ({
    ...item,
    hasPriceRow: priceKeys.has(item.key),
  }));

  return {
    error: null,
    response: await auditShopIngredientCatalogItems(
      ingredientCatalogItems,
      doesIngredientIconExist,
      await listAvailableIngredientIconPaths()
    ),
  };
}

async function loadIngredientPriceState(params: {
  adminClient: ReturnType<typeof getServerSupabaseClient>;
  ingredientKey: string;
}): Promise<{
  row: Pick<ShopIngredientPriceRow, "ingredient_key" | "cost_coins"> | null;
  error: NextResponse | null;
}> {
  const { data, error } = await params.adminClient
    .from("shop_ingredient_prices")
    .select("ingredient_key, cost_coins")
    .eq("ingredient_key", params.ingredientKey)
    .maybeSingle();

  if (error) {
    return {
      row: null,
      error: NextResponse.json(
        { error: "Could not load the ingredient icon row." },
        { status: 500 }
      ),
    };
  }

  if (!data) {
    return {
      row: null,
      error: NextResponse.json(
        { error: "Ingredient icon path can only be managed for saved ingredient rows." },
        { status: 400 }
      ),
    };
  }

  return {
    row: data as Pick<ShopIngredientPriceRow, "ingredient_key" | "cost_coins">,
    error: null,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizePlatformAdmin(request);
  if (auth.error || !auth.adminClient) {
    return auth.error!;
  }

  const audit = await loadAuditResponse(auth.adminClient);
  if (audit.error || !audit.response) {
    return audit.error!;
  }

  return NextResponse.json(audit.response);
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
    rawBody && typeof rawBody === "object" ? (rawBody as IngredientIconAuditPatchBody) : {};
  const action = body.action;
  const ingredientKey =
    typeof body.ingredientKey === "string"
      ? canonicalizeShopIngredientKey(body.ingredientKey)
      : "";

  if (action !== "update_path" && action !== "clear_path") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  if (!ingredientKey) {
    return NextResponse.json({ error: "Ingredient key is required." }, { status: 400 });
  }

  const state = await loadIngredientPriceState({
    adminClient: auth.adminClient,
    ingredientKey,
  });
  if (state.error || !state.row) {
    return state.error!;
  }

  try {
    if (action === "update_path") {
      const iconPath = typeof body.iconPath === "string" ? body.iconPath : "";
      const validatedIconPath = validateShopIngredientIconPath(iconPath);
      const resolvedIconPath = resolvePublicAssetFilePath(validatedIconPath);
      const iconExists = resolvedIconPath ? await doesIngredientIconExist(resolvedIconPath) : false;

      if (!iconExists) {
        return NextResponse.json(
          { error: "Ingredient icon file not found in public/ingredients." },
          { status: 400 }
        );
      }

      const { error: updateError } = await auth.adminClient
        .from("shop_ingredient_prices")
        .update({
          icon_path: validatedIconPath,
          updated_at: new Date().toISOString(),
        })
        .eq("ingredient_key", state.row.ingredient_key);

      if (isMissingIconPathColumnError(updateError)) {
        return NextResponse.json(
          {
            error:
              "Ingredient icon paths cannot be updated until shop_ingredient_prices.icon_path exists.",
          },
          { status: 500 }
        );
      }
      if (updateError) {
        return NextResponse.json(
          { error: "Could not save the ingredient icon path." },
          { status: 500 }
        );
      }
    } else {
      const audit = await loadAuditResponse(auth.adminClient);
      if (audit.error || !audit.response) {
        return audit.error!;
      }

      const currentItem =
        audit.response.items.find((item) => item.key === ingredientKey) ?? null;
      if (!currentItem) {
        return NextResponse.json({ error: "Ingredient not found in audit." }, { status: 404 });
      }
      if (currentItem.iconPath === null || currentItem.exists !== false) {
        return NextResponse.json(
          { error: "Delete is only allowed for missing or broken ingredient icon rows." },
          { status: 400 }
        );
      }

      const { error: clearError } = await auth.adminClient
        .from("shop_ingredient_prices")
        .update({
          icon_path: null,
          updated_at: new Date().toISOString(),
        })
        .eq("ingredient_key", state.row.ingredient_key);

      if (isMissingIconPathColumnError(clearError)) {
        return NextResponse.json(
          {
            error:
              "Ingredient icon paths cannot be cleared until shop_ingredient_prices.icon_path exists.",
          },
          { status: 500 }
        );
      }
      if (clearError) {
        return NextResponse.json(
          { error: "Could not clear the ingredient icon path." },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Could not update the ingredient icon path.",
      },
      { status: 400 }
    );
  }

  const audit = await loadAuditResponse(auth.adminClient);
  if (audit.error || !audit.response) {
    return audit.error!;
  }

  return NextResponse.json(audit.response);
}
