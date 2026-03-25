import { NextRequest, NextResponse } from "next/server";
import {
  buildShopAdminIngredientCatalogItems,
  type ShopAdminIngredientPricesResponse,
} from "@/app/words/shop/shopIngredients";
import { getServerSupabaseClient, supabase } from "@/lib/supabaseClient";

type ShopIngredientPriceRow = {
  ingredient_key: string;
  cost_coins: number;
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

  const { data, error } = await auth.adminClient
    .from("shop_ingredient_prices")
    .select("ingredient_key, cost_coins")
    .order("ingredient_key", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Could not load ingredient prices." },
      { status: 500 }
    );
  }

  const response: ShopAdminIngredientPricesResponse = {
    ingredients: buildShopAdminIngredientCatalogItems(
      ((data ?? []) as ShopIngredientPriceRow[]).map((row) => ({
        ingredientKey: row.ingredient_key,
        costCoins: row.cost_coins,
        updatedAt: Date.now(),
      }))
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
