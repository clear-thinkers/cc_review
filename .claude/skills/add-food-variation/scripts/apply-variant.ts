#!/usr/bin/env tsx
/**
 * Preview (default) or apply (--apply) adding one new NAMED VARIANT rule to
 * one shop_recipes row's variant_icon_rules: a bilingual title plus a
 * reward icon for one already-linked special-ingredient combination.
 *
 * Scope is deliberately narrow: this script only ever touches
 * variant_icon_rules for exactly one recipe. It does NOT create ingredients
 * and does NOT link them into special_ingredient_slots -- every key passed
 * via --match must already appear in the recipe's
 * special_ingredient_slots_i18n (checked below), or this throws and tells
 * you to run the add-ingredient skill first.
 *
 * Reuses the real match-normalization/duplicate-check/path-validation logic
 * from src/lib/shopRewardIconAudit.ts (the same module Shop Admin's own
 * "add reward icon rule" UI action calls), so this can never drift from
 * actual app behavior or accept a match/path shape the app would reject.
 *
 * Always operates against .env.local (dev). There is no --prod flag -- this
 * script must never *connect to* production. On a successful --apply it
 * additionally writes a scoped migration file to supabase/migrations/,
 * ready for this repo's normal db:push:prod flow -- writing that SQL to
 * disk is not the same as running it.
 *
 * Usage:
 *   npx tsx apply-variant.ts \
 *     --recipe-slug zongzi \
 *     --match pork-filling \
 *     --title-en "Pork Zongzi" --title-zh "肉粽" \
 *     --icon-file zongzi_pork.png
 *   # prints the SQL preview only, writes nothing.
 *
 *   ...same flags... --apply
 *   # actually updates shop_recipes.variant_icon_rules in dev.
 *
 * --match takes a comma-separated list of special-ingredient keys already
 * linked to this recipe, e.g. --match chocolate,sugar-sprinkles for a
 * two-ingredient combo (order doesn't matter -- it's normalized/sorted the
 * same way Shop Admin's own UI does).
 *
 * --icon-file takes a bare filename (e.g. "zongzi_pork.png"), not a path --
 * the "/rewards/" prefix is added internally, for the same Git-Bash/MSYS
 * leading-slash path-rewriting reason documented in the add-ingredient
 * skill's apply-ingredient.mjs.
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canonicalizeShopIngredientKey } from "../../../../src/lib/shopIngredients";
import { createShopRewardIconRule, normalizeShopRewardMatchInput } from "../../../../src/lib/shopRewardIconAudit";
import type { ShopVariantIconRule } from "../../../../src/lib/shop.types";

function loadEnvFile(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
  return true;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function escapeSqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function toJsonbSql(value: unknown): string {
  return `${escapeSqlLiteral(JSON.stringify(value))}::jsonb`;
}

const BOOLEAN_FLAGS = new Set(["apply", "no-prod-migration", "prod-verified"]);

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {
    apply: false,
    "no-prod-migration": false,
    "prod-verified": false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--") && BOOLEAN_FLAGS.has(token.slice(2))) {
      args[token.slice(2)] = true;
    } else if (token.startsWith("--")) {
      const key = token.slice(2);
      args[key] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function migrationTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
  );
}

function writeProdMigrationFile({
  recipeSlug,
  matchSignature,
  updateSql,
  prodStateVerified,
}: {
  recipeSlug: string;
  matchSignature: string;
  updateSql: string;
  prodStateVerified: boolean;
}): string {
  const fileName = `${migrationTimestamp()}_shop_add_${recipeSlug}_${matchSignature.replaceAll(/[^a-z0-9]+/gi, "_")}_variant.sql`;
  const filePath = path.join("supabase", "migrations", fileName);

  const caveat = prodStateVerified
    ? `-- Verified against production's current variant_icon_rules for slug = '${recipeSlug}' before writing this file.`
    : [
        `-- NOT verified against production's current variant_icon_rules for slug = '${recipeSlug}'.`,
        "-- The base array below reflects DEV's state at the time this file was",
        "-- generated. If prod has diverged on this recipe's variant rules since",
        "-- then, review this diff carefully before running db:push:prod -- it will",
        "-- overwrite prod's variant_icon_rules for this recipe with the array",
        "-- below, not merge with whatever prod currently has.",
      ].join("\n");

  const sql = `-- Add a named variant rule (match = [${matchSignature}]) to "${recipeSlug}"'s
-- variant_icon_rules.
--
-- Generated by the add-food-variation skill. Scoped deliberately: this only
-- updates shop_recipes.variant_icon_rules for slug = '${recipeSlug}' -- it
-- does not touch any other recipe, ingredient, or column, and assumes every
-- ingredient key in the match was already linked to this recipe's
-- special_ingredient_slots by a prior (or companion) migration.
--
${caveat}
--
-- This file is NOT applied automatically. Review it, then run:
--   npm run db:push:prod:dry
--   npm run db:push:prod

begin;

${updateSql}

commit;
`;

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, sql, "utf8");
  return filePath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const recipeSlug = args["recipe-slug"] as string | undefined;
  const matchRaw = args.match as string | undefined;
  const titleEn = args["title-en"] as string | undefined;
  const titleZh = args["title-zh"] as string | undefined;
  const iconFile = args["icon-file"] as string | undefined;

  const missing: string[] = [];
  if (!recipeSlug) missing.push("--recipe-slug");
  if (!matchRaw) missing.push("--match");
  if (!titleEn) missing.push("--title-en");
  if (!titleZh) missing.push("--title-zh");
  if (!iconFile) missing.push("--icon-file");
  if (missing.length > 0) {
    throw new Error(`Missing required flag(s): ${missing.join(", ")}`);
  }
  if (iconFile && !/^[a-z0-9_+-]+\.png$/i.test(iconFile)) {
    throw new Error(`--icon-file must be a bare filename like "zongzi_pork.png" (no slashes), got: ${iconFile}`);
  }

  const matchKeys = normalizeShopRewardMatchInput(
    matchRaw!
      .split(",")
      .map((key) => canonicalizeShopIngredientKey(key.trim()))
      .join(",")
  );
  if (matchKeys.length === 0) {
    throw new Error(`--match "${matchRaw}" canonicalized to an empty list of ingredient keys`);
  }
  const matchSignature = matchKeys.join(",");

  const loaded = loadEnvFile(".env.local");
  if (!loaded) console.warn("Warning: .env.local not found. Falling back to process env.");

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: recipeRow, error: recipeError } = await supabase
    .from("shop_recipes")
    .select("id,slug,special_ingredient_slots_i18n,variant_icon_rules")
    .eq("slug", recipeSlug)
    .maybeSingle();

  if (recipeError) throw new Error(`Failed to load recipe: ${recipeError.message}`);
  if (!recipeRow) throw new Error(`No shop_recipes row with slug "${recipeSlug}"`);

  const linkedSpecialKeys = new Set(
    (recipeRow.special_ingredient_slots_i18n?.en ?? []).map((row: { ingredientKey?: string }) =>
      canonicalizeShopIngredientKey(row.ingredientKey ?? "")
    )
  );
  const unlinkedKeys = matchKeys.filter((key) => !linkedSpecialKeys.has(key));
  if (unlinkedKeys.length > 0) {
    throw new Error(
      `Recipe "${recipeSlug}" does not yet have special ingredient(s) [${unlinkedKeys.join(", ")}] linked. ` +
        `Link them first via the add-ingredient skill (slot: special), then re-run this script. ` +
        `This script never creates or links ingredients itself.`
    );
  }

  const currentRules = (recipeRow.variant_icon_rules ?? []) as ShopVariantIconRule[];

  // createShopRewardIconRule throws if a rule with this exact match already
  // exists -- same duplicate check Shop Admin's own UI enforces.
  const nextRulesWithoutTitle = createShopRewardIconRule(currentRules, `/rewards/${iconFile}`, matchSignature);
  const nextRules: ShopVariantIconRule[] = nextRulesWithoutTitle.map((rule, index) =>
    index === nextRulesWithoutTitle.length - 1 ? { ...rule, titleI18n: { en: titleEn!, zh: titleZh! } } : rule
  );

  const updateSql = `update shop_recipes
set
  variant_icon_rules = ${toJsonbSql(nextRules)},
  updated_at = now()
where slug = ${escapeSqlLiteral(recipeSlug!)};`;

  console.log(`-- Preview: shop_recipes.variant_icon_rules (slug = ${recipeSlug}, match = [${matchSignature}])`);
  console.log(updateSql);

  if (!args.apply) {
    console.log("\n(dry run -- re-run with --apply to write this change to the dev database)");
    return;
  }

  const { error: updateError } = await supabase
    .from("shop_recipes")
    .update({ variant_icon_rules: nextRules, updated_at: new Date().toISOString() })
    .eq("slug", recipeSlug!);
  if (updateError) throw new Error(`Failed to update recipe: ${updateError.message}`);

  console.log(`\nApplied: variant rule (match = [${matchSignature}]) added to "${recipeSlug}"'s variant_icon_rules.`);

  if (!args["no-prod-migration"]) {
    const migrationPath = writeProdMigrationFile({
      recipeSlug: recipeSlug!,
      matchSignature,
      updateSql,
      prodStateVerified: Boolean(args["prod-verified"]),
    });
    console.log(
      `Wrote ${migrationPath} (not applied -- review it, then run npm run db:push:prod:dry / npm run db:push:prod when ready to promote to production).`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
