#!/usr/bin/env tsx
/**
 * Find an ingredient by key, alias, or label -- checking BOTH the checked-in
 * static catalog (src/lib/shopIngredients.ts, the offline fallback) and the
 * live shop_ingredient_prices table (the authoritative source once an
 * ingredient has been added through this skill or Shop Admin).
 *
 * Imports the real catalog module instead of re-implementing canonicalization
 * so this never drifts from src/lib/shopIngredients.ts's actual behavior.
 *
 * Always reads from .env.local (dev). Never touches production.
 *
 * Usage:
 *   npx tsx find-ingredient.ts "cinnamon"
 *   npx tsx find-ingredient.ts            # lists the full merged catalog
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import {
  canonicalizeShopIngredientKey,
  findShopIngredientCatalogEntryByAlias,
  getShopIngredientCatalogEntry,
  listShopIngredientCatalog,
} from "../../../../src/lib/shopIngredients";

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

type IngredientPriceRow = {
  ingredient_key: string;
  cost_coins: number;
  label_i18n: { en?: string; zh?: string } | null;
  icon_path: string | null;
};

type MergedIngredient = {
  key: string;
  label: { en: string; zh: string } | null;
  costCoins: number | null;
  iconPath: string | null;
  aliases: string[];
  source: "db" | "static" | "db+static";
};

async function main() {
  const searchTerm = process.argv[2]?.trim() ?? "";
  const canonicalSearchTerm = searchTerm ? canonicalizeShopIngredientKey(searchTerm) : "";

  const loaded = loadEnvFile(".env.local");
  if (!loaded) console.warn("Warning: .env.local not found. Falling back to process env.");

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("shop_ingredient_prices")
    .select("ingredient_key,cost_coins,label_i18n,icon_path")
    .order("ingredient_key", { ascending: true });

  if (error) throw new Error(`Failed to load shop_ingredient_prices: ${error.message}`);

  const dbRows = (data ?? []) as IngredientPriceRow[];
  const merged = new Map<string, MergedIngredient>();

  for (const entry of listShopIngredientCatalog()) {
    merged.set(entry.key, {
      key: entry.key,
      label: entry.label,
      costCoins: entry.defaultCostCoins,
      iconPath: entry.iconPath,
      aliases: entry.aliases ?? [],
      source: "static",
    });
  }

  for (const row of dbRows) {
    const key = canonicalizeShopIngredientKey(row.ingredient_key);
    const existing = merged.get(key);
    merged.set(key, {
      key,
      label: row.label_i18n?.en || row.label_i18n?.zh ? { en: row.label_i18n?.en ?? "", zh: row.label_i18n?.zh ?? "" } : existing?.label ?? null,
      costCoins: row.cost_coins ?? existing?.costCoins ?? null,
      iconPath: row.icon_path ?? existing?.iconPath ?? null,
      aliases: existing?.aliases ?? [],
      source: existing ? "db+static" : "db",
    });
  }

  const all = [...merged.values()];
  let matches = all;
  if (searchTerm) {
    const exactByKeyOrAlias =
      getShopIngredientCatalogEntry(searchTerm) ?? findShopIngredientCatalogEntryByAlias(searchTerm);
    matches = all.filter((entry) => {
      if (exactByKeyOrAlias && entry.key === exactByKeyOrAlias.key) return true;
      if (!canonicalSearchTerm) {
        // Search term canonicalizes to nothing (e.g. pure Chinese, or
        // punctuation-only) -- a key/alias match is meaningless here since
        // every key would otherwise match via `"".includes("")`. Fall back
        // to a literal label substring match only.
        const term = searchTerm.toLowerCase();
        return entry.label?.en?.toLowerCase().includes(term) || entry.label?.zh?.toLowerCase().includes(term);
      }
      if (entry.key === canonicalSearchTerm) return true;
      if (entry.aliases.some((alias) => canonicalizeShopIngredientKey(alias) === canonicalSearchTerm)) return true;
      const term = searchTerm.toLowerCase();
      return (
        entry.label?.en?.toLowerCase().includes(term) ||
        entry.label?.zh?.toLowerCase().includes(term) ||
        entry.key.includes(canonicalSearchTerm)
      );
    });
  }

  process.stdout.write(
    JSON.stringify(
      {
        query: searchTerm || null,
        canonicalKeyIfNew: searchTerm ? canonicalSearchTerm : null,
        count: matches.length,
        matches,
      },
      null,
      2
    )
  );
  process.stdout.write("\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
