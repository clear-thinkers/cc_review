import { NextRequest, NextResponse } from "next/server";
import type { ShopRecipe } from "@/app/words/shop/shop.types";
import {
  mergeReadonlySpecialIngredientLogic,
  mergeReadonlyShopLocalizedIngredientRows,
  normalizeShopRecipeAdminDraft,
  validateShopRecipeAdminDraft,
  type ShopAdminRecipesResponse,
  type ShopRecipeAdminDraft,
} from "@/app/words/shop-admin/shopAdmin.types";
import {
  normalizeShopIngredientList,
  normalizeShopLocalizedIngredients,
  normalizeShopLocalizedIntro,
  normalizeShopLocalizedSpecialIngredientSlots,
  normalizeShopLocalizedTitle,
} from "@/lib/shop";
import { getServerSupabaseClient, supabase } from "@/lib/supabaseClient";

interface SupabaseShopRecipeRow {
  id: string;
  slug: string;
  title: string;
  title_i18n?: unknown;
  display_order: number;
  is_active: boolean;
  variant_icon_rules: unknown;
  intro: string;
  intro_i18n?: unknown;
  unlock_cost_coins: number;
  base_ingredients: unknown;
  base_ingredients_i18n?: unknown;
  special_ingredient_slots: unknown;
  special_ingredient_slots_i18n?: unknown;
}

function toShopRecipe(row: SupabaseShopRecipeRow): ShopRecipe {
  const baseIngredients = normalizeShopIngredientList(row.base_ingredients, []);
  const specialIngredientSlots = Array.isArray(row.special_ingredient_slots)
    ? (row.special_ingredient_slots as ShopRecipe["specialIngredientSlots"])
    : [];

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    titleI18n: normalizeShopLocalizedTitle(row.title_i18n, row.title),
    displayOrder: row.display_order,
    isActive: row.is_active,
    intro: row.intro,
    introI18n: normalizeShopLocalizedIntro(row.intro_i18n, row.intro),
    unlockCostCoins: row.unlock_cost_coins,
    baseIngredients,
    baseIngredientsI18n: normalizeShopLocalizedIngredients(
      row.base_ingredients_i18n,
      baseIngredients
    ),
    specialIngredientSlots,
    specialIngredientSlotsI18n: normalizeShopLocalizedSpecialIngredientSlots(
      row.special_ingredient_slots_i18n,
      specialIngredientSlots
    ),
    variantIconRules: Array.isArray(row.variant_icon_rules)
      ? (row.variant_icon_rules as ShopRecipe["variantIconRules"])
      : [],
  };
}

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

  const { data, error } = await auth.adminClient
    .from("shop_recipes")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Could not load shop recipes." },
      { status: 500 }
    );
  }

  const response: ShopAdminRecipesResponse = {
    recipes: ((data ?? []) as SupabaseShopRecipeRow[]).map(toShopRecipe),
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
    rawBody && typeof rawBody === "object" ? (rawBody as Partial<ShopRecipeAdminDraft>) : {};

  const normalizedDraft = normalizeShopRecipeAdminDraft({
    recipeId: typeof body.recipeId === "string" ? body.recipeId : "",
    title: body.title,
    intro: body.intro,
    baseIngredients: body.baseIngredients,
    specialIngredientSlots: body.specialIngredientSlots,
  });

  const validationErrors = validateShopRecipeAdminDraft(normalizedDraft);
  if (validationErrors.length > 0) {
    return NextResponse.json(
      { error: validationErrors[0], validationErrors },
      { status: 400 }
    );
  }

  const { data: existingRow, error: existingError } = await auth.adminClient
    .from("shop_recipes")
    .select("*")
    .eq("id", normalizedDraft.recipeId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: "Could not load the recipe to update." },
      { status: 500 }
    );
  }

  if (!existingRow) {
    return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  }

  const existingRecipe = toShopRecipe(existingRow as SupabaseShopRecipeRow);
  let mergedSpecialIngredientSlots;
  let mergedBaseIngredients;
  try {
    mergedSpecialIngredientSlots = mergeReadonlySpecialIngredientLogic({
      persistedSlots: existingRecipe.specialIngredientSlots,
      draftSlots: normalizedDraft.specialIngredientSlots,
    });
    mergedBaseIngredients = mergeReadonlyShopLocalizedIngredientRows({
      draftIngredients: normalizedDraft.baseIngredients,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Invalid specialty ingredient update.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data: updatedRow, error: updateError } = await auth.adminClient
    .from("shop_recipes")
    .update({
      title: normalizedDraft.title.en,
      title_i18n: normalizedDraft.title,
      intro: normalizedDraft.intro.en,
      intro_i18n: normalizedDraft.intro,
      base_ingredients: mergedBaseIngredients.en,
      base_ingredients_i18n: mergedBaseIngredients,
      special_ingredient_slots: mergedSpecialIngredientSlots,
      special_ingredient_slots_i18n: normalizedDraft.specialIngredientSlots,
      updated_at: new Date().toISOString(),
    })
    .eq("id", normalizedDraft.recipeId)
    .select("*")
    .single();

  if (updateError || !updatedRow) {
    return NextResponse.json(
      { error: "Could not save recipe metadata." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    recipe: toShopRecipe(updatedRow as SupabaseShopRecipeRow),
  });
}
