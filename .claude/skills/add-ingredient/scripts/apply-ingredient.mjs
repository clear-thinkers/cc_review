#!/usr/bin/env node
/**
 * Preview (default) or apply (--apply) adding one new ingredient row to one
 * shop_recipes row, plus upserting its shop_ingredient_prices catalog row.
 *
 * Scope is intentionally narrow: exactly one recipe, exactly one ingredient,
 * exactly one slot (base or special) per invocation -- this only ever
 * touches the two JSON columns for the chosen slot, never the recipe's
 * title/intro/other fields, and never any other recipe.
 *
 * Always operates against .env.local (dev). There is no --prod flag --
 * this skill must never write to production.
 *
 * Usage:
 *   node apply-ingredient.mjs \
 *     --recipe-slug milkshake \
 *     --ingredient-key cinnamon \
 *     --label-en "Cinnamon" --label-zh "肉桂" \
 *     --cost 3 --slot base --quantity 1 \
 *     --icon-file cinnamon.png
 *   # prints the SQL preview only, writes nothing.
 *
 * --icon-file takes a bare filename (e.g. "cinnamon.png"), not a path -- the
 * "/ingredients/" prefix is added internally. This is deliberate: Git Bash
 * on Windows (MSYS) silently rewrites a leading-slash CLI argument like
 * "/ingredients/cinnamon.png" into a Windows path (e.g.
 * "C:/.../Git/ingredients/cinnamon.png") before Node ever sees it, and
 * MSYS_NO_PATHCONV=1 isn't a safe workaround here since it also breaks the
 * real file-path argument (the script path itself). A bare filename has no
 * leading slash, so MSYS never touches it.
 *
 *   ...same flags... --apply
 *   # actually upserts shop_ingredient_prices and updates shop_recipes.
 *
 * Pass --force to overwrite an existing ingredient's label/cost/icon in
 * shop_ingredient_prices; without it, an existing ingredient's catalog row
 * is left untouched and only the recipe link is added.
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(filePath) {
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

function requireEnv(key) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function escapeSqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function toJsonbSql(value) {
  return `${escapeSqlLiteral(JSON.stringify(value))}::jsonb`;
}

function parseArgs(argv) {
  const args = { apply: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--apply") {
      args.apply = true;
    } else if (token === "--force") {
      args.force = true;
    } else if (token.startsWith("--")) {
      const key = token.slice(2);
      const value = argv[i + 1];
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

function canonicalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const recipeSlug = args["recipe-slug"];
  const ingredientKeyRaw = args["ingredient-key"];
  const labelEn = args["label-en"];
  const labelZh = args["label-zh"];
  const cost = Number(args.cost);
  const slot = args.slot;
  const quantity = Number(args.quantity);
  const iconFile = args["icon-file"] ?? null;
  const iconPath = iconFile ? `/ingredients/${iconFile}` : null;

  const missing = [];
  if (!recipeSlug) missing.push("--recipe-slug");
  if (!ingredientKeyRaw) missing.push("--ingredient-key");
  if (!labelEn) missing.push("--label-en");
  if (!labelZh) missing.push("--label-zh");
  if (!args.cost) missing.push("--cost");
  if (!slot) missing.push("--slot");
  if (!args.quantity) missing.push("--quantity");
  if (missing.length > 0) {
    throw new Error(`Missing required flag(s): ${missing.join(", ")}`);
  }
  if (slot !== "base" && slot !== "special") {
    throw new Error(`--slot must be "base" or "special", got: ${slot}`);
  }
  if (!Number.isInteger(cost) || cost < 0) {
    throw new Error(`--cost must be a non-negative integer, got: ${args.cost}`);
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`--quantity must be a positive integer, got: ${args.quantity}`);
  }
  if (iconFile && !/^[a-z0-9_-]+\.png$/i.test(iconFile)) {
    throw new Error(
      `--icon-file must be a bare filename like "cinnamon.png" (no slashes), got: ${iconFile}`
    );
  }

  const ingredientKey = canonicalizeKey(ingredientKeyRaw);
  if (!ingredientKey) {
    throw new Error(`--ingredient-key "${ingredientKeyRaw}" canonicalizes to empty string`);
  }

  const loaded = loadEnvFile(".env.local");
  if (!loaded) console.warn("Warning: .env.local not found. Falling back to process env.");

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: recipeRow, error: recipeError } = await supabase
    .from("shop_recipes")
    .select("id,slug,title,base_ingredients_i18n,special_ingredient_slots_i18n")
    .eq("slug", recipeSlug)
    .maybeSingle();

  if (recipeError) throw new Error(`Failed to load recipe: ${recipeError.message}`);
  if (!recipeRow) throw new Error(`No shop_recipes row with slug "${recipeSlug}"`);

  const { data: existingIngredientRow, error: ingredientLookupError } = await supabase
    .from("shop_ingredient_prices")
    .select("ingredient_key,cost_coins,label_i18n,icon_path")
    .eq("ingredient_key", ingredientKey)
    .maybeSingle();

  if (ingredientLookupError) {
    throw new Error(`Failed to check existing ingredient: ${ingredientLookupError.message}`);
  }

  if (existingIngredientRow && !args.force) {
    console.log(
      `Ingredient "${ingredientKey}" already exists in shop_ingredient_prices -- leaving its catalog row unchanged (pass --force to overwrite it). Only linking it into the recipe.`
    );
  }

  const i18nColumn = slot === "base" ? "base_ingredients_i18n" : "special_ingredient_slots_i18n";
  const legacyColumn = slot === "base" ? "base_ingredients" : "special_ingredient_slots";
  const currentI18n = recipeRow[i18nColumn] ?? { en: [], zh: [] };
  const currentEn = Array.isArray(currentI18n.en) ? currentI18n.en : [];
  const currentZh = Array.isArray(currentI18n.zh) ? currentI18n.zh : [];

  const alreadyLinked = currentEn.some(
    (row) => canonicalizeKey(row.ingredientKey) === ingredientKey
  );
  if (alreadyLinked) {
    throw new Error(
      `Recipe "${recipeSlug}" already has "${ingredientKey}" in its ${slot} ingredients -- nothing to do.`
    );
  }

  const newEnRow = { ingredientKey, name: labelEn, quantity };
  const newZhRow = { ingredientKey, name: labelZh, quantity };
  const nextEn = [...currentEn, newEnRow];
  const nextZh = [...currentZh, newZhRow];
  const nextI18n = { en: nextEn, zh: nextZh };

  const ingredientUpsertSql = `insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  ${escapeSqlLiteral(ingredientKey)},
  ${cost},
  ${toJsonbSql({ en: labelEn, zh: labelZh })},
  ${iconPath ? escapeSqlLiteral(iconPath) : "null"}
)
on conflict (ingredient_key) do ${args.force ? "update set\n  cost_coins = excluded.cost_coins,\n  label_i18n = excluded.label_i18n,\n  icon_path = excluded.icon_path,\n  updated_at = now()" : "nothing"};`;

  const recipeUpdateSql = `update shop_recipes
set
  ${legacyColumn} = ${toJsonbSql(nextEn)},
  ${i18nColumn} = ${toJsonbSql(nextI18n)},
  updated_at = now()
where slug = ${escapeSqlLiteral(recipeSlug)};`;

  console.log("-- Preview: shop_ingredient_prices");
  console.log(ingredientUpsertSql);
  console.log("");
  console.log(`-- Preview: shop_recipes (slug = ${recipeSlug}, ${slot} ingredients only)`);
  console.log(recipeUpdateSql);

  if (!args.apply) {
    console.log("\n(dry run -- re-run with --apply to write these changes to the dev database)");
    return;
  }

  if (!existingIngredientRow || args.force) {
    const { error: upsertError } = await supabase.from("shop_ingredient_prices").upsert(
      {
        ingredient_key: ingredientKey,
        cost_coins: cost,
        label_i18n: { en: labelEn, zh: labelZh },
        icon_path: iconPath,
      },
      { onConflict: "ingredient_key" }
    );
    if (upsertError) throw new Error(`Failed to upsert ingredient: ${upsertError.message}`);
  }

  const { error: updateError } = await supabase
    .from("shop_recipes")
    .update({
      [legacyColumn]: nextEn,
      [i18nColumn]: nextI18n,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", recipeSlug);

  if (updateError) throw new Error(`Failed to update recipe: ${updateError.message}`);

  console.log(
    `\nApplied: "${ingredientKey}" added to "${recipeSlug}"'s ${slot} ingredients (qty ${quantity}).`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
