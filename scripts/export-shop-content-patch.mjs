#!/usr/bin/env node

/**
 * Export shop content from a Supabase environment as SQL updates/upserts.
 *
 * Usage:
 *   node scripts/export-shop-content-patch.mjs
 *   node scripts/export-shop-content-patch.mjs --prod
 *   node scripts/export-shop-content-patch.mjs --prod --output supabase/migrations/20260326000000_shop_content_promote_from_prod.sql
 *
 * Default source env:
 *   - dev  -> .env.local
 *   - prod -> .env.production.local (when --prod is passed)
 *
 * Exported tables:
 *   - shop_ingredient_prices
 *   - shop_recipes
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const isProd = process.argv.includes("--prod");
const envFile = isProd ? ".env.production.local" : ".env.local";
const outputIndex = process.argv.indexOf("--output");
const outputPath =
  outputIndex >= 0 && process.argv[outputIndex + 1]
    ? process.argv[outputIndex + 1]
    : null;

function loadEnvFile(filePath) {
  try {
    if (!existsSync(filePath)) {
      return false;
    }
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq === -1) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function escapeSqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function toNullableTextSql(value) {
  return typeof value === "string" ? escapeSqlLiteral(value) : "null";
}

function toNullableJsonbSql(value) {
  return value === null || typeof value === "undefined"
    ? "null"
    : `${escapeSqlLiteral(JSON.stringify(value))}::jsonb`;
}

function toJsonbSql(value) {
  return `${escapeSqlLiteral(JSON.stringify(value))}::jsonb`;
}

function toIntegerSql(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected finite number, received: ${value}`);
  }
  return String(Math.trunc(value));
}

function toBooleanSql(value) {
  return value ? "true" : "false";
}

function buildIngredientUpsertSql(row) {
  return `insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  ${escapeSqlLiteral(row.ingredient_key)},
  ${toIntegerSql(row.cost_coins)},
  ${toNullableJsonbSql(row.label_i18n)},
  ${toNullableTextSql(row.icon_path)}
)
on conflict (ingredient_key) do update
set
  cost_coins = excluded.cost_coins,
  label_i18n = excluded.label_i18n,
  icon_path = excluded.icon_path,
  updated_at = now();`;
}

function buildRecipeUpdateSql(row) {
  return `update shop_recipes
set
  title = ${escapeSqlLiteral(row.title)},
  title_i18n = ${toJsonbSql(row.title_i18n ?? { en: row.title, zh: row.title })},
  intro = ${escapeSqlLiteral(row.intro)},
  intro_i18n = ${toJsonbSql(row.intro_i18n ?? { en: row.intro, zh: row.intro })},
  display_order = ${toIntegerSql(row.display_order)},
  is_active = ${toBooleanSql(row.is_active)},
  unlock_cost_coins = ${toIntegerSql(row.unlock_cost_coins)},
  base_ingredients = ${toJsonbSql(row.base_ingredients ?? [])},
  base_ingredients_i18n = ${toJsonbSql(
    row.base_ingredients_i18n ?? { en: row.base_ingredients ?? [], zh: row.base_ingredients ?? [] }
  )},
  special_ingredient_slots = ${toJsonbSql(row.special_ingredient_slots ?? [])},
  special_ingredient_slots_i18n = ${toJsonbSql(
    row.special_ingredient_slots_i18n ??
      {
        en: row.special_ingredient_slots ?? [],
        zh: row.special_ingredient_slots ?? [],
      }
  )},
  variant_icon_rules = ${toJsonbSql(row.variant_icon_rules ?? [])},
  updated_at = now()
where slug = ${escapeSqlLiteral(row.slug)};`;
}

function buildSqlFile({ ingredientRows, recipeRows, environmentLabel }) {
  const header = [
    `-- Exported from ${environmentLabel} shop content`,
    `-- Generated at ${new Date().toISOString()}`,
    "-- Review before applying to another environment.",
    "",
    "begin;",
    "",
    "-- shop_ingredient_prices",
    "",
  ].join("\n");

  const ingredientBody = ingredientRows.map(buildIngredientUpsertSql).join("\n\n");
  const recipeHeader = [
    "",
    "-- shop_recipes",
    "",
  ].join("\n");
  const recipeBody = recipeRows.map(buildRecipeUpdateSql).join("\n\n");

  return `${header}${ingredientBody}${recipeHeader}${recipeBody}\n\ncommit;\n`;
}

async function main() {
  const loaded = loadEnvFile(envFile);
  if (!loaded) {
    console.warn(`Warning: ${envFile} not found. Falling back to process env.`);
  }

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [ingredientResult, recipeResult] = await Promise.all([
    supabase
      .from("shop_ingredient_prices")
      .select("ingredient_key,cost_coins,label_i18n,icon_path")
      .order("ingredient_key", { ascending: true }),
    supabase
      .from("shop_recipes")
      .select(
        "slug,title,title_i18n,intro,intro_i18n,display_order,is_active,unlock_cost_coins,base_ingredients,base_ingredients_i18n,special_ingredient_slots,special_ingredient_slots_i18n,variant_icon_rules"
      )
      .order("display_order", { ascending: true }),
  ]);

  if (ingredientResult.error) {
    throw new Error(`Failed to load shop_ingredient_prices: ${ingredientResult.error.message}`);
  }

  if (recipeResult.error) {
    throw new Error(`Failed to load shop_recipes: ${recipeResult.error.message}`);
  }

  const ingredientRows = ingredientResult.data ?? [];
  const recipeRows = recipeResult.data ?? [];
  const sql = buildSqlFile({
    ingredientRows,
    recipeRows,
    environmentLabel: isProd ? "PRODUCTION" : "DEV",
  });

  if (outputPath) {
    const absoluteOutputPath = path.resolve(outputPath);
    mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
    writeFileSync(absoluteOutputPath, sql, "utf8");
    console.log(
      `Wrote ${ingredientRows.length} ingredient upsert(s) and ${recipeRows.length} recipe update(s) to ${absoluteOutputPath}`
    );
    return;
  }

  process.stdout.write(sql);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
