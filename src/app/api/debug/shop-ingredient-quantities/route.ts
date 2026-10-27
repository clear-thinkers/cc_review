import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { DebugShopIngredientQuantitiesResponse } from "@/lib/debug.types";
import {
  buildDebugIngredientQuantityItems,
  findMysteryRecipesUsingIngredient,
  findRecipeIdUsingIngredient,
  normalizeDebugIngredientLabel,
  normalizeDebugIngredientTargetQuantity,
  planDebugIngredientQuantityChange,
  type DebugQuantityRecipe,
} from "@/lib/debugIngredientQuantities";
import { getJwtAppMetadataUserId } from "@/lib/decodeJwtPayload";
import { normalizeShopIngredientList, normalizeShopSpecialIngredientList } from "@/lib/shop";
import { canonicalizeShopIngredientKey } from "@/lib/shopIngredients";
import {
  getCallerScopedSupabaseClient,
  getServerSupabaseClient,
  supabase,
} from "@/lib/supabaseClient";

/**
 * Debug Tools Rule 6: a platform admin sets their OWN spendable count of any
 * ingredient, to test the kitchen. Raising appends free (`coins_spent = 0`)
 * `shop_ingredient_purchases` rows; lowering appends `shop_ingredient_consumptions`
 * rows with a fresh `cooked_dish_id` that matches no dish -- nothing is deleted.
 * After a raise, any active mystery food using the ingredient is offered to
 * `unlock_shop_recipe` AS the caller, so that RPC stays the only writer of
 * `shop_recipe_unlocks` (AI_CONTRACT.md §1) and only unlocks a complete set.
 *
 * The target profile is never taken from the request: it is the active profile
 * in the caller's own verified token, and its family comes from the users row.
 */

type ServiceClient = ReturnType<typeof getServerSupabaseClient>;

type Caller = { token: string; userId: string; familyId: string; adminClient: ServiceClient };

async function authorizeCaller(request: NextRequest): Promise<{ caller: Caller | null; error: NextResponse | null }> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return { caller: null, error: NextResponse.json({ error: "Missing Authorization header." }, { status: 401 }) };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { caller: null, error: NextResponse.json({ error: "Invalid or expired session." }, { status: 401 }) };
  }

  // The active profile from THIS token's own claims (not user.app_metadata, which
  // is the stale auth.users row -- see AI_CONTRACT.md §1, Auth / Session Claims).
  const userId = getJwtAppMetadataUserId(token);
  if (!userId) {
    return {
      caller: null,
      error: NextResponse.json({ error: "Profile session not established." }, { status: 403 }),
    };
  }

  let adminClient: ServiceClient;
  try {
    adminClient = getServerSupabaseClient();
  } catch {
    return { caller: null, error: NextResponse.json({ error: "Server configuration error." }, { status: 500 }) };
  }

  const { data: profileRow, error: profileError } = await adminClient
    .from("users")
    .select("id, family_id, is_platform_admin")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profileRow || profileRow.is_platform_admin !== true || !profileRow.family_id) {
    return {
      caller: null,
      error: NextResponse.json({ error: "Platform admin access is required." }, { status: 403 }),
    };
  }

  return { caller: { token, userId, familyId: profileRow.family_id as string, adminClient }, error: null };
}

async function loadLedgerKeys(adminClient: ServiceClient, userId: string, table: string): Promise<string[]> {
  const { data, error } = await adminClient.from(table).select("ingredient_key").eq("user_id", userId);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []).map((row) => String((row as { ingredient_key: unknown }).ingredient_key ?? ""));
}

async function loadResponse(caller: Caller): Promise<DebugShopIngredientQuantitiesResponse> {
  const { data: priceData, error: priceError } = await caller.adminClient
    .from("shop_ingredient_prices")
    .select("ingredient_key, label_i18n, icon_path, is_mystery");
  if (priceError) throw new Error(`shop_ingredient_prices: ${priceError.message}`);

  const [rewardKeys, purchaseKeys, consumptionKeys] = await Promise.all([
    loadLedgerKeys(caller.adminClient, caller.userId, "shop_ingredient_rewards"),
    loadLedgerKeys(caller.adminClient, caller.userId, "shop_ingredient_purchases"),
    loadLedgerKeys(caller.adminClient, caller.userId, "shop_ingredient_consumptions"),
  ]);

  const priceRows = (priceData ?? []).map((row) => {
    const key = String(row.ingredient_key ?? "");
    return {
      ingredientKey: key,
      label: normalizeDebugIngredientLabel(row.label_i18n, key),
      iconPath: typeof row.icon_path === "string" && row.icon_path ? row.icon_path : null,
      isMystery: row.is_mystery === true,
    };
  });

  return { items: buildDebugIngredientQuantityItems(priceRows, { rewardKeys, purchaseKeys, consumptionKeys }) };
}

type RecipeRow = {
  id: string;
  slug: string;
  is_active: boolean | null;
  is_mystery: boolean | null;
  title: string | null;
  title_i18n: unknown;
  base_ingredients: unknown;
  special_ingredient_slots: unknown;
};

async function loadRecipes(adminClient: ServiceClient): Promise<{ recipes: DebugQuantityRecipe[]; rows: RecipeRow[] }> {
  const { data, error } = await adminClient
    .from("shop_recipes")
    .select("id, slug, is_active, is_mystery, title, title_i18n, base_ingredients, special_ingredient_slots");
  if (error) throw new Error(`shop_recipes: ${error.message}`);
  const rows = (data ?? []) as RecipeRow[];
  return {
    rows,
    recipes: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      isActive: row.is_active === true,
      isMystery: row.is_mystery === true,
      baseIngredients: normalizeShopIngredientList(row.base_ingredients, []),
      specialIngredients: normalizeShopSpecialIngredientList(row.special_ingredient_slots, []),
    })),
  };
}

function errorResponse(error: unknown): NextResponse {
  return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { caller, error } = await authorizeCaller(request);
  if (!caller) return error!;

  try {
    return NextResponse.json(await loadResponse(caller));
  } catch (loadError) {
    return errorResponse(loadError);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const { caller, error } = await authorizeCaller(request);
  if (!caller) return error!;

  let body: { ingredientKey?: unknown; quantity?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const ingredientKey = canonicalizeShopIngredientKey(typeof body.ingredientKey === "string" ? body.ingredientKey : "");
  const target = normalizeDebugIngredientTargetQuantity(body.quantity);
  if (!ingredientKey || target === null) {
    return NextResponse.json({ error: "ingredientKey and a valid quantity are required." }, { status: 400 });
  }

  try {
    const before = await loadResponse(caller);
    const item = before.items.find((candidate) => candidate.key === ingredientKey);
    if (!item) {
      return NextResponse.json({ error: `Unknown ingredient: ${ingredientKey}` }, { status: 400 });
    }

    const { add, remove } = planDebugIngredientQuantityChange(item.quantity, target);
    const { recipes, rows } = await loadRecipes(caller.adminClient);

    if (add > 0) {
      const recipeId = findRecipeIdUsingIngredient(recipes, ingredientKey);
      if (!recipeId) {
        return NextResponse.json(
          { error: `No recipe uses ${ingredientKey}, so there is nothing to attribute a purchase row to.` },
          { status: 400 }
        );
      }
      const { error: insertError } = await caller.adminClient.from("shop_ingredient_purchases").insert(
        Array.from({ length: add }, () => ({
          user_id: caller.userId,
          family_id: caller.familyId,
          recipe_id: recipeId,
          ingredient_key: ingredientKey,
          coins_spent: 0,
        }))
      );
      if (insertError) throw new Error(`shop_ingredient_purchases: ${insertError.message}`);
    }

    if (remove > 0) {
      const cookedDishId = randomUUID();
      const { error: insertError } = await caller.adminClient.from("shop_ingredient_consumptions").insert(
        Array.from({ length: remove }, () => ({
          user_id: caller.userId,
          family_id: caller.familyId,
          ingredient_key: ingredientKey,
          cooked_dish_id: cookedDishId,
        }))
      );
      if (insertError) throw new Error(`shop_ingredient_consumptions: ${insertError.message}`);
    }

    const unlockedRecipes: NonNullable<DebugShopIngredientQuantitiesResponse["unlockedRecipes"]> = [];
    if (add > 0) {
      const callerClient = getCallerScopedSupabaseClient(caller.token);
      for (const recipe of findMysteryRecipesUsingIngredient(recipes, ingredientKey)) {
        // Returns mystery_not_ready / already_unlocked without writing anything.
        const { data } = await callerClient.rpc("unlock_shop_recipe", { p_recipe_id: recipe.id });
        if ((data as { code?: unknown } | null)?.code === "unlocked") {
          const row = rows.find((candidate) => candidate.id === recipe.id);
          unlockedRecipes.push({
            slug: recipe.slug,
            title: normalizeDebugIngredientLabel(row?.title_i18n, row?.title ?? recipe.slug),
          });
        }
      }
    }

    return NextResponse.json({ ...(await loadResponse(caller)), unlockedRecipes });
  } catch (patchError) {
    return errorResponse(patchError);
  }
}
