import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import type {
  DebugShopRewardIconAuditResponse,
  DebugShopRewardRecipeOption,
} from "@/app/words/debug/debug.types";
import type { ShopVariantIconRule } from "@/app/words/shop/shop.types";
import { normalizeShopLocalizedTitle } from "@/lib/shop";
import { resolvePublicAssetFilePath } from "@/lib/shopIngredientIconAudit";
import {
  auditShopRewardIcons,
  createShopRewardIconRule,
  deleteShopRewardIconRule,
  type ShopRewardIconAuditRecipe,
  updateShopRewardIconRule,
} from "@/lib/shopRewardIconAudit";
import { getServerSupabaseClient, supabase } from "@/lib/supabaseClient";

type ShopRecipeRewardAuditRow = {
  id: string;
  slug: string;
  title: string;
  title_i18n?: unknown;
  display_order: number;
  variant_icon_rules: unknown;
};

type RewardIconAuditPatchBody =
  | {
      action?: "update_path";
      recipeId?: unknown;
      ruleIndex?: unknown;
      iconPath?: unknown;
    }
  | {
      action?: "delete_rule";
      recipeId?: unknown;
      ruleIndex?: unknown;
      iconPath?: unknown;
    }
  | {
      action?: "create_rule";
      recipeId?: unknown;
      iconPath?: unknown;
      match?: unknown;
    };

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

function toShopRewardAuditRecipe(row: ShopRecipeRewardAuditRow): ShopRewardIconAuditRecipe {
  return {
    id: row.id,
    slug: row.slug,
    title: normalizeShopLocalizedTitle(row.title_i18n, row.title),
    variantIconRules: Array.isArray(row.variant_icon_rules)
      ? (row.variant_icon_rules as ShopVariantIconRule[])
      : [],
  };
}

async function doesRewardIconExist(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listAvailableRewardIconPaths(): Promise<string[]> {
  const rewardsDir = path.join(process.cwd(), "public", "rewards");

  try {
    const fileNames = await readdir(rewardsDir, { withFileTypes: true });
    return fileNames
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
      .map((entry) => `/rewards/${entry.name}`)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

function buildRecipeOption(row: ShopRecipeRewardAuditRow): DebugShopRewardRecipeOption {
  return {
    recipeId: row.id,
    recipeSlug: row.slug,
    recipeTitle: normalizeShopLocalizedTitle(row.title_i18n, row.title),
  };
}

async function loadAuditResponse(
  adminClient: ReturnType<typeof getServerSupabaseClient>
): Promise<{ error: NextResponse | null; response: DebugShopRewardIconAuditResponse | null }> {
  const { data, error } = await adminClient
    .from("shop_recipes")
    .select("id, slug, title, title_i18n, display_order, variant_icon_rules")
    .order("display_order", { ascending: true });

  if (error) {
    return {
      error: NextResponse.json(
        { error: "Could not load shop reward icons." },
        { status: 500 }
      ),
      response: null,
    };
  }

  const availableIconPaths = await listAvailableRewardIconPaths();
  const rows = (data ?? []) as ShopRecipeRewardAuditRow[];
  return {
    error: null,
    response: await auditShopRewardIcons(
      rows.map(toShopRewardAuditRecipe),
      doesRewardIconExist,
      availableIconPaths,
      rows.map(buildRecipeOption)
    ),
  };
}

async function loadRecipeRuleState(params: {
  adminClient: ReturnType<typeof getServerSupabaseClient>;
  recipeId: string;
}): Promise<{
  currentRules: ShopVariantIconRule[] | null;
  error: NextResponse | null;
}> {
  const { data, error } = await params.adminClient
    .from("shop_recipes")
    .select("variant_icon_rules")
    .eq("id", params.recipeId)
    .maybeSingle();

  if (error) {
    return {
      currentRules: null,
      error: NextResponse.json(
        { error: "Could not load the reward icon rules." },
        { status: 500 }
      ),
    };
  }

  const currentRules = Array.isArray(data?.variant_icon_rules)
    ? (data.variant_icon_rules as ShopVariantIconRule[])
    : [];
  if (!data) {
    return {
      currentRules,
      error: NextResponse.json(
        { error: "Recipe not found." },
        { status: 404 }
      ),
    };
  }

  return {
    currentRules,
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
    rawBody && typeof rawBody === "object" ? (rawBody as RewardIconAuditPatchBody) : {};
  const action = body.action;
  const recipeId = typeof body.recipeId === "string" ? body.recipeId.trim() : "";
  const rawRuleIndex = "ruleIndex" in body ? body.ruleIndex : undefined;

  if (action !== "update_path" && action !== "delete_rule" && action !== "create_rule") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  if (!recipeId) {
    return NextResponse.json({ error: "Recipe id is required." }, { status: 400 });
  }

  const ruleIndex =
    typeof rawRuleIndex === "number" && Number.isInteger(rawRuleIndex)
      ? rawRuleIndex
      : NaN;
  if (action !== "create_rule" && !Number.isInteger(ruleIndex)) {
    return NextResponse.json({ error: "Rule index is required." }, { status: 400 });
  }

  const state = await loadRecipeRuleState({
    adminClient: auth.adminClient,
    recipeId,
  });
  if (state.error || !state.currentRules) {
    return state.error!;
  }

  let nextRules: ShopVariantIconRule[];
  try {
    if (action === "create_rule") {
      const iconPath = typeof body.iconPath === "string" ? body.iconPath.trim() : "";
      const match = typeof body.match === "string" ? body.match : "";
      const resolvedIconPath = resolvePublicAssetFilePath(iconPath);
      const iconExists = resolvedIconPath ? await doesRewardIconExist(resolvedIconPath) : false;
      if (!iconExists) {
        return NextResponse.json(
          { error: "Reward icon file not found in public/rewards." },
          { status: 400 }
        );
      }
      nextRules = createShopRewardIconRule(state.currentRules, iconPath, match);
    } else if (action === "update_path") {
      const iconPath = typeof body.iconPath === "string" ? body.iconPath : "";
      nextRules = updateShopRewardIconRule(state.currentRules, ruleIndex, iconPath);
    } else {
      const currentRule = state.currentRules[ruleIndex] ?? null;
      if (!currentRule) {
        return NextResponse.json(
          { error: "Reward icon rule not found." },
          { status: 404 }
        );
      }
      const currentFilePath = resolvePublicAssetFilePath(currentRule.iconPath);
      const currentExists = currentFilePath ? await doesRewardIconExist(currentFilePath) : false;
      if (currentExists) {
        return NextResponse.json(
          { error: "Delete is only allowed for missing or broken reward icon rules." },
          { status: 400 }
        );
      }
      nextRules = deleteShopRewardIconRule(state.currentRules, ruleIndex);
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Could not update the reward icon rule.",
      },
      { status: 400 }
    );
  }

  const { error: updateError } = await auth.adminClient
    .from("shop_recipes")
    .update({
      variant_icon_rules: nextRules,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recipeId);

  if (updateError) {
    return NextResponse.json(
      { error: "Could not save reward icon rules." },
      { status: 500 }
    );
  }

  const audit = await loadAuditResponse(auth.adminClient);
  if (audit.error || !audit.response) {
    return audit.error!;
  }

  return NextResponse.json(audit.response);
}
