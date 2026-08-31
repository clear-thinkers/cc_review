#!/usr/bin/env tsx
/**
 * Preview (default) or apply (--apply) creating one brand-new shop_recipes
 * row ("food") in one shot: bilingual title/intro, base ingredients,
 * optional special ingredients, and a variant_icon_rules array seeded with
 * the mandatory plain rule (match: []) plus any launch-day named variants.
 *
 * Scope is deliberately narrow, mirroring add-ingredient/add-food-variation:
 * this INSERTs exactly one new shop_recipes row (plus, optionally, new
 * shop_ingredient_prices rows for genuinely new ingredients this food
 * introduces) and nothing else. It never touches an existing recipe (use
 * add-ingredient/add-food-variation for that).
 *
 * Every key in --base-ingredients / --special-ingredients / a --variants
 * match must already exist in shop_ingredient_prices UNLESS it's also
 * listed in --new-ingredients -- in that case this script upserts its
 * catalog row as part of the same apply. A genuinely new ingredient still
 * requires its icon file to already exist on disk (see below); this script
 * never drafts art for ingredients any more than it does for the food's own
 * reward icon.
 *
 * Every reward icon referenced (the plain icon, and each variant's icon)
 * must already exist on disk under public/rewards/, and every new
 * ingredient's icon must already exist under public/ingredients/ -- this
 * script never generates or stages art, unlike the sibling skills'
 * art-prompt phases. Per the add-food skill's Hard rules, the user places
 * these files BEFORE running this skill at all; this script's own
 * existence check is a second, narrower backstop scoped to exactly the
 * files this specific food needs.
 *
 * Always operates against .env.local (dev). There is no --prod flag -- this
 * script must never *connect to* production. On a successful --apply it
 * additionally writes a scoped migration file to supabase/migrations/,
 * ready for this repo's normal db:push:prod flow -- writing that SQL to
 * disk is not the same as running it.
 *
 * Usage:
 *   npx tsx apply-food.ts \
 *     --slug pancake \
 *     --title-en "Pancake" --title-zh "松饼" \
 *     --intro-en "Fluffy stacked pancakes." --intro-zh "松软的叠叠松饼。" \
 *     --unlock-cost 15 \
 *     --cook-method stove --food-type hotmeal \
 *     --base-ingredients "flour:2,egg:1,milk:1,butter:1,syrup:1" \
 *     --special-ingredients "strawberry:1" \
 *     --new-ingredients '[{"key":"syrup","labelEn":"Syrup","labelZh":"糖浆","cost":3,"iconFile":"syrup.png","quantity":1,"slot":"base"}]' \
 *     --plain-icon-file pancake_plain.png \
 *     --variants '[{"match":"strawberry","titleEn":"Strawberry Pancake","titleZh":"草莓松饼","iconFile":"pancake_strawberry_wink.png"}]'
 *   # prints the SQL preview only, writes nothing.
 *
 *   ...same flags... --apply
 *   # actually inserts the row (and any --new-ingredients catalog rows) into dev.
 *
 * --new-ingredients takes a JSON array; each entry's "key" must ALSO appear
 * in --base-ingredients or --special-ingredients (matching its "slot") with
 * the same quantity -- this flag only supplies the catalog-row content
 * (label/cost/icon) for a key that doesn't resolve in the shared catalog
 * yet, it doesn't add the ingredient to the recipe by itself.
 *
 * --cook-method / --food-type: omit both (or pass "none") for a
 * catalog-only, not-yet-cookable food. If --cook-method is stove/oven,
 * --food-type is required (drinks/hotmeal/desserts) -- Shop Admin Rule 10.
 *
 * --display-order is optional; omitted, it's computed as
 * max(existing display_order) + 1. The Recipe Wall is a FIXED-size grid
 * (SHOP_WALL_SIZE in src/lib/shop.ts) -- an active recipe landing at a
 * display_order beyond that size is a real bug (it exists in the DB but is
 * unreachable on the wall, not merely "unlisted"), so this script refuses
 * to create one that way. Pass --is-active false to land it off-wall on
 * purpose instead, or bump SHOP_WALL_SIZE first if it should actually
 * grow the wall.
 *
 * --is-active defaults to true; pass --is-active false to land the food as
 * a reserved/inactive wall slot instead (Recipe Shop Rule 7).
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canonicalizeShopIngredientKey, getShopIngredientCatalogEntry } from "../../../../src/lib/shopIngredients";
import { createShopRewardIconRule } from "../../../../src/lib/shopRewardIconAudit";
import { SHOP_WALL_SIZE } from "../../../../src/lib/shop";
import type { ShopIngredient, ShopLocalizedValue, ShopVariantIconRule } from "../../../../src/lib/shop.types";

type VariantInput = {
  match: string;
  titleEn: string;
  titleZh: string;
  iconFile: string;
};

type NewIngredientInput = {
  key: string;
  labelEn: string;
  labelZh: string;
  cost: number;
  iconFile: string;
  quantity: number;
  slot: "base" | "special";
};

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

function canonicalizeSlug(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseIngredientList(input: string | undefined): { key: string; quantity: number }[] {
  if (!input) return [];
  return input
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const [rawKey, rawQuantity] = token.split(":").map((part) => part.trim());
      const quantity = Number(rawQuantity);
      if (!rawKey || !Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(
          `Invalid ingredient entry "${token}" -- expected "key:quantity" with a positive integer quantity.`
        );
      }
      return { key: canonicalizeShopIngredientKey(rawKey), quantity };
    });
}

function migrationTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
  );
}

function writeProdMigrationFile({
  slug,
  ingredientUpsertSqls,
  insertSql,
  prodStateVerified,
}: {
  slug: string;
  ingredientUpsertSqls: string[];
  insertSql: string;
  prodStateVerified: boolean;
}): string {
  const fileName = `${migrationTimestamp()}_shop_add_${slug.replaceAll("-", "_")}_food.sql`;
  const filePath = path.join("supabase", "migrations", fileName);

  const caveat = prodStateVerified
    ? `-- Verified production has no existing row for slug = '${slug}' before writing this file.`
    : [
        `-- NOT separately verified against production for slug = '${slug}'.`,
        "-- The recipe insert is a plain INSERT, so it only fails (not silently",
        "-- overwrites) if production already has a row with this slug -- but",
        "-- confirm that's actually true before running db:push:prod. Any new",
        "-- ingredient upserts below use ON CONFLICT DO NOTHING, so they're safe",
        "-- to run even if prod already has that ingredient key from elsewhere.",
      ].join("\n");

  const ingredientSection =
    ingredientUpsertSqls.length > 0
      ? `-- New ingredient catalog rows this food introduces:\n${ingredientUpsertSqls.join("\n\n")}\n\n`
      : "";

  const sql = `-- Create the new "${slug}" food (shop_recipes row)${
    ingredientUpsertSqls.length > 0 ? ", plus its new ingredient catalog row(s)" : ""
  }.
--
-- Generated by the add-food skill. Scoped deliberately: this only inserts
-- one new shop_recipes row${
    ingredientUpsertSqls.length > 0 ? " and the new ingredient row(s) it introduces" : ""
  } -- it does not touch any other recipe or ingredient row.
--
${caveat}
--
-- This file is NOT applied automatically. Review it, then run:
--   npm run db:push:prod:dry
--   npm run db:push:prod

begin;

${ingredientSection}${insertSql}

commit;
`;

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, sql, "utf8");
  return filePath;
}

async function resolveIngredientLabel(
  supabase: ReturnType<typeof createClient>,
  key: string,
  pendingNewIngredients: Map<string, NewIngredientInput>
): Promise<ShopLocalizedValue<string>> {
  const pending = pendingNewIngredients.get(key);
  if (pending) return { en: pending.labelEn, zh: pending.labelZh };

  const { data, error } = await supabase
    .from("shop_ingredient_prices")
    .select("label_i18n")
    .eq("ingredient_key", key)
    .maybeSingle();
  if (error) throw new Error(`Failed to look up ingredient "${key}": ${error.message}`);

  if (data?.label_i18n?.en || data?.label_i18n?.zh) {
    return { en: data.label_i18n.en ?? "", zh: data.label_i18n.zh ?? "" };
  }

  const staticEntry = getShopIngredientCatalogEntry(key);
  if (staticEntry?.label) return staticEntry.label;

  throw new Error(
    `Ingredient "${key}" does not exist yet in shop_ingredient_prices or the static catalog, and it's not ` +
      `listed in --new-ingredients either. Either it's a typo, or this is a genuinely new ingredient that ` +
      `needs a --new-ingredients entry (key, labelEn, labelZh, cost, iconFile, quantity, slot).`
  );
}

async function buildIngredientRows(
  supabase: ReturnType<typeof createClient>,
  entries: { key: string; quantity: number }[],
  pendingNewIngredients: Map<string, NewIngredientInput>
): Promise<{ en: ShopIngredient[]; zh: ShopIngredient[] }> {
  const en: ShopIngredient[] = [];
  const zh: ShopIngredient[] = [];
  for (const entry of entries) {
    const label = await resolveIngredientLabel(supabase, entry.key, pendingNewIngredients);
    en.push({ ingredientKey: entry.key, name: label.en, quantity: entry.quantity });
    zh.push({ ingredientKey: entry.key, name: label.zh, quantity: entry.quantity });
  }
  return { en, zh };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const slugRaw = args.slug as string | undefined;
  const titleEn = args["title-en"] as string | undefined;
  const titleZh = args["title-zh"] as string | undefined;
  const introEn = (args["intro-en"] as string | undefined) ?? "";
  const introZh = (args["intro-zh"] as string | undefined) ?? "";
  const unlockCost = Number(args["unlock-cost"]);
  const cookMethodRaw = ((args["cook-method"] as string | undefined) ?? "none").toLowerCase();
  const foodTypeRaw = ((args["food-type"] as string | undefined) ?? "none").toLowerCase();
  const isActive = ((args["is-active"] as string | undefined) ?? "true").toLowerCase() !== "false";
  const plainIconFile = args["plain-icon-file"] as string | undefined;
  const variantsRaw = args.variants as string | undefined;

  const missing: string[] = [];
  if (!slugRaw) missing.push("--slug");
  if (!titleEn) missing.push("--title-en");
  if (!titleZh) missing.push("--title-zh");
  if (!args["unlock-cost"]) missing.push("--unlock-cost");
  if (!plainIconFile) missing.push("--plain-icon-file");
  if (!args["base-ingredients"]) missing.push("--base-ingredients");
  if (missing.length > 0) {
    throw new Error(`Missing required flag(s): ${missing.join(", ")}`);
  }

  if (!Number.isInteger(unlockCost) || unlockCost < 0) {
    throw new Error(`--unlock-cost must be a non-negative integer, got: ${args["unlock-cost"]}`);
  }
  if (plainIconFile && !/^[a-z0-9_+-]+\.png$/i.test(plainIconFile)) {
    throw new Error(`--plain-icon-file must be a bare filename like "pancake_plain.png" (no slashes), got: ${plainIconFile}`);
  }

  const cookMethod = cookMethodRaw === "none" ? null : cookMethodRaw;
  if (cookMethod !== null && cookMethod !== "stove" && cookMethod !== "oven") {
    throw new Error(`--cook-method must be "stove", "oven", or "none", got: ${cookMethodRaw}`);
  }
  const foodType = foodTypeRaw === "none" ? null : foodTypeRaw;
  if (foodType !== null && !["drinks", "hotmeal", "desserts"].includes(foodType)) {
    throw new Error(`--food-type must be "drinks", "hotmeal", "desserts", or "none", got: ${foodTypeRaw}`);
  }
  if (cookMethod !== null && foodType === null) {
    throw new Error(`--cook-method "${cookMethod}" requires --food-type to also be set (Shop Admin Rule 10).`);
  }

  const slug = canonicalizeSlug(slugRaw!);
  if (!slug) throw new Error(`--slug "${slugRaw}" canonicalizes to an empty string`);

  // Hard precondition: the plain reward icon (and every variant's icon) must
  // already be on disk. This skill never generates or stages art -- the
  // user places these files before invoking it at all.
  const rewardsDir = path.join("public", "rewards");
  const plainIconRelPath = `/rewards/${plainIconFile}`;
  const plainIconDiskPath = path.join(rewardsDir, plainIconFile!);
  if (!existsSync(plainIconDiskPath)) {
    throw new Error(
      `Missing plain reward icon: ${plainIconDiskPath}. Place the finished PNG there before running this skill -- it never generates art itself.`
    );
  }

  let variants: VariantInput[] = [];
  if (variantsRaw) {
    try {
      variants = JSON.parse(variantsRaw);
    } catch {
      throw new Error(`--variants is not valid JSON: ${variantsRaw}`);
    }
    for (const variant of variants) {
      const missingVariantFields: string[] = [];
      if (!variant.match) missingVariantFields.push("match");
      if (!variant.titleEn) missingVariantFields.push("titleEn");
      if (!variant.titleZh) missingVariantFields.push("titleZh");
      if (!variant.iconFile) missingVariantFields.push("iconFile");
      if (missingVariantFields.length > 0) {
        throw new Error(`--variants entry ${JSON.stringify(variant)} is missing: ${missingVariantFields.join(", ")}`);
      }
      const variantIconDiskPath = path.join(rewardsDir, variant.iconFile);
      if (!existsSync(variantIconDiskPath)) {
        throw new Error(
          `Missing variant reward icon: ${variantIconDiskPath}. Place the finished PNG there before running this skill.`
        );
      }
    }
  }

  const baseEntries = parseIngredientList(args["base-ingredients"] as string);
  const specialEntries = parseIngredientList(args["special-ingredients"] as string | undefined);
  if (baseEntries.length === 0) {
    throw new Error("At least one base ingredient is required (Shop Admin Rule 6).");
  }

  const ingredientsDir = path.join("public", "ingredients");
  const newIngredientsRaw = args["new-ingredients"] as string | undefined;
  let newIngredients: NewIngredientInput[] = [];
  if (newIngredientsRaw) {
    try {
      newIngredients = JSON.parse(newIngredientsRaw);
    } catch {
      throw new Error(`--new-ingredients is not valid JSON: ${newIngredientsRaw}`);
    }
    for (const ingredient of newIngredients) {
      const missingFields: string[] = [];
      if (!ingredient.key) missingFields.push("key");
      if (!ingredient.labelEn) missingFields.push("labelEn");
      if (!ingredient.labelZh) missingFields.push("labelZh");
      if (ingredient.cost === undefined || ingredient.cost === null) missingFields.push("cost");
      if (!ingredient.iconFile) missingFields.push("iconFile");
      if (!ingredient.quantity) missingFields.push("quantity");
      if (!ingredient.slot) missingFields.push("slot");
      if (missingFields.length > 0) {
        throw new Error(`--new-ingredients entry ${JSON.stringify(ingredient)} is missing: ${missingFields.join(", ")}`);
      }
      ingredient.key = canonicalizeShopIngredientKey(ingredient.key);
      if (!Number.isInteger(ingredient.cost) || ingredient.cost < 0) {
        throw new Error(`--new-ingredients entry "${ingredient.key}": cost must be a non-negative integer, got: ${ingredient.cost}`);
      }
      if (!Number.isInteger(ingredient.quantity) || ingredient.quantity <= 0) {
        throw new Error(`--new-ingredients entry "${ingredient.key}": quantity must be a positive integer, got: ${ingredient.quantity}`);
      }
      if (ingredient.slot !== "base" && ingredient.slot !== "special") {
        throw new Error(`--new-ingredients entry "${ingredient.key}": slot must be "base" or "special", got: ${ingredient.slot}`);
      }
      if (!/^[a-z0-9_+-]+\.png$/i.test(ingredient.iconFile)) {
        throw new Error(`--new-ingredients entry "${ingredient.key}": iconFile must be a bare filename like "syrup.png" (no slashes), got: ${ingredient.iconFile}`);
      }
      const iconDiskPath = path.join(ingredientsDir, ingredient.iconFile);
      if (!existsSync(iconDiskPath)) {
        throw new Error(
          `Missing new ingredient icon: ${iconDiskPath}. Place the finished PNG there before running this skill -- it never generates ingredient art itself.`
        );
      }
      const targetEntries = ingredient.slot === "base" ? baseEntries : specialEntries;
      const matchingEntry = targetEntries.find((entry) => entry.key === ingredient.key);
      if (!matchingEntry) {
        throw new Error(
          `--new-ingredients entry "${ingredient.key}" (slot: ${ingredient.slot}) must also appear in --${
            ingredient.slot === "base" ? "base-ingredients" : "special-ingredients"
          } with a matching quantity -- --new-ingredients only supplies its catalog content, it doesn't add it to the recipe by itself.`
        );
      }
      if (matchingEntry.quantity !== ingredient.quantity) {
        throw new Error(
          `--new-ingredients entry "${ingredient.key}" quantity (${ingredient.quantity}) doesn't match its ${ingredient.slot} ingredient list quantity (${matchingEntry.quantity}) -- they must agree.`
        );
      }
    }
  }
  const pendingNewIngredients = new Map(newIngredients.map((ingredient) => [ingredient.key, ingredient]));

  const specialKeySet = new Set(specialEntries.map((entry) => entry.key));
  for (const variant of variants) {
    const variantKeys = variant.match.split(",").map((key) => canonicalizeShopIngredientKey(key.trim()));
    const unlinked = variantKeys.filter((key) => !specialKeySet.has(key));
    if (unlinked.length > 0) {
      throw new Error(
        `Variant match [${variant.match}] references special ingredient(s) [${unlinked.join(", ")}] not listed in --special-ingredients. ` +
          `Every variant match key must also be one of this food's special ingredients.`
      );
    }
  }

  const loaded = loadEnvFile(".env.local");
  if (!loaded) console.warn("Warning: .env.local not found. Falling back to process env.");

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existingRow, error: existingError } = await supabase
    .from("shop_recipes")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existingError) throw new Error(`Failed to check for existing recipe: ${existingError.message}`);
  if (existingRow) {
    throw new Error(`A shop_recipes row with slug "${slug}" already exists -- this script only creates NEW foods.`);
  }

  for (const ingredient of newIngredients) {
    const { data: existingIngredientRow, error: existingIngredientError } = await supabase
      .from("shop_ingredient_prices")
      .select("ingredient_key")
      .eq("ingredient_key", ingredient.key)
      .maybeSingle();
    if (existingIngredientError) {
      throw new Error(`Failed to check for existing ingredient "${ingredient.key}": ${existingIngredientError.message}`);
    }
    if (existingIngredientRow || getShopIngredientCatalogEntry(ingredient.key)) {
      throw new Error(
        `--new-ingredients entry "${ingredient.key}" already exists in the catalog -- drop it from --new-ingredients ` +
          `and let it resolve normally via --base-ingredients/--special-ingredients instead.`
      );
    }
  }

  const ingredientUpsertSqls = newIngredients.map(
    (ingredient) => `insert into shop_ingredient_prices (
  ingredient_key,
  cost_coins,
  label_i18n,
  icon_path
)
values (
  ${escapeSqlLiteral(ingredient.key)},
  ${ingredient.cost},
  ${toJsonbSql({ en: ingredient.labelEn, zh: ingredient.labelZh })},
  ${escapeSqlLiteral(`/ingredients/${ingredient.iconFile}`)}
)
on conflict (ingredient_key) do nothing;`
  );

  const baseIngredients = await buildIngredientRows(supabase, baseEntries, pendingNewIngredients);
  const specialIngredients = await buildIngredientRows(supabase, specialEntries, pendingNewIngredients);

  let displayOrder = Number(args["display-order"]);
  if (!args["display-order"]) {
    const { data: maxRow, error: maxError } = await supabase
      .from("shop_recipes")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxError) throw new Error(`Failed to compute next display_order: ${maxError.message}`);
    displayOrder = (maxRow?.display_order ?? 0) + 1;
  }

  if (isActive && displayOrder > SHOP_WALL_SIZE) {
    throw new Error(
      `display_order ${displayOrder} exceeds SHOP_WALL_SIZE (${SHOP_WALL_SIZE}) -- the Recipe Wall is a fixed-size ` +
        `grid (src/lib/shop.ts), so an active recipe here would exist in the DB but never render on the wall. ` +
        `Either bump SHOP_WALL_SIZE first (if the wall should actually grow to fit this food), or pass ` +
        `--is-active false to land it off-wall on purpose.`
    );
  }

  let variantIconRules: ShopVariantIconRule[] = createShopRewardIconRule([], plainIconRelPath, "");
  for (const variant of variants) {
    const withoutTitle = createShopRewardIconRule(variantIconRules, `/rewards/${variant.iconFile}`, variant.match);
    variantIconRules = withoutTitle.map((rule, index) =>
      index === withoutTitle.length - 1 ? { ...rule, titleI18n: { en: variant.titleEn, zh: variant.titleZh } } : rule
    );
  }

  const row = {
    slug,
    title: titleEn,
    title_i18n: { en: titleEn, zh: titleZh },
    display_order: displayOrder,
    is_active: isActive,
    intro: introEn,
    intro_i18n: { en: introEn, zh: introZh },
    unlock_cost_coins: unlockCost,
    base_ingredients: baseIngredients.en,
    base_ingredients_i18n: baseIngredients,
    special_ingredient_slots: specialIngredients.en,
    special_ingredient_slots_i18n: specialIngredients,
    variant_icon_rules: variantIconRules,
    cook_method: cookMethod,
    food_type: foodType,
  };

  const insertSql = `insert into shop_recipes (
  slug, title, title_i18n, display_order, is_active,
  intro, intro_i18n, unlock_cost_coins,
  base_ingredients, base_ingredients_i18n,
  special_ingredient_slots, special_ingredient_slots_i18n,
  variant_icon_rules, cook_method, food_type
)
values (
  ${escapeSqlLiteral(slug)},
  ${escapeSqlLiteral(titleEn!)},
  ${toJsonbSql(row.title_i18n)},
  ${displayOrder},
  ${isActive},
  ${escapeSqlLiteral(introEn)},
  ${toJsonbSql(row.intro_i18n)},
  ${unlockCost},
  ${toJsonbSql(row.base_ingredients)},
  ${toJsonbSql(row.base_ingredients_i18n)},
  ${toJsonbSql(row.special_ingredient_slots)},
  ${toJsonbSql(row.special_ingredient_slots_i18n)},
  ${toJsonbSql(row.variant_icon_rules)},
  ${cookMethod ? escapeSqlLiteral(cookMethod) : "null"},
  ${foodType ? escapeSqlLiteral(foodType) : "null"}
);`;

  if (ingredientUpsertSqls.length > 0) {
    console.log(`-- Preview: ${ingredientUpsertSqls.length} new shop_ingredient_prices row(s)`);
    console.log(ingredientUpsertSqls.join("\n\n"));
    console.log("");
  }
  console.log(`-- Preview: new shop_recipes row (slug = ${slug})`);
  console.log(insertSql);

  if (!args.apply) {
    console.log("\n(dry run -- re-run with --apply to write this row to the dev database)");
    return;
  }

  if (newIngredients.length > 0) {
    const { error: ingredientInsertError } = await supabase.from("shop_ingredient_prices").insert(
      newIngredients.map((ingredient) => ({
        ingredient_key: ingredient.key,
        cost_coins: ingredient.cost,
        label_i18n: { en: ingredient.labelEn, zh: ingredient.labelZh },
        icon_path: `/ingredients/${ingredient.iconFile}`,
      }))
    );
    if (ingredientInsertError) throw new Error(`Failed to insert new ingredient(s): ${ingredientInsertError.message}`);
  }

  const { error: insertError } = await supabase.from("shop_recipes").insert(row);
  if (insertError) throw new Error(`Failed to insert recipe: ${insertError.message}`);

  console.log(
    `\nApplied: "${slug}" created in dev (display_order ${displayOrder}, active=${isActive})` +
      (newIngredients.length > 0 ? `, plus ${newIngredients.length} new ingredient(s): ${newIngredients.map((i) => i.key).join(", ")}.` : ".")
  );

  if (!args["no-prod-migration"]) {
    const migrationPath = writeProdMigrationFile({
      slug,
      ingredientUpsertSqls,
      insertSql,
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
