#!/usr/bin/env node
/**
 * Find a shop_recipes row ("food") by title, in either locale -- same
 * lookup as the add-ingredient skill's find-recipe.mjs, but additionally
 * returns variant_icon_rules and the full special_ingredient_slots_i18n
 * array, since this skill needs to check which special ingredients are
 * already linked and which match combinations already have a named variant.
 *
 * Read-only dev-database lookup. Always reads from .env.local (dev) and
 * never accepts a --prod flag -- this skill must never touch production.
 *
 * Usage:
 *   node find-recipe.mjs "zongzi"
 *   node find-recipe.mjs            # lists every recipe
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

function textIncludes(haystack, needle) {
  return typeof haystack === "string" && haystack.toLowerCase().includes(needle);
}

async function main() {
  const searchTerm = process.argv[2]?.trim().toLowerCase() ?? "";

  const loaded = loadEnvFile(".env.local");
  if (!loaded) console.warn("Warning: .env.local not found. Falling back to process env.");

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("shop_recipes")
    .select(
      "id,slug,title,title_i18n,special_ingredient_slots_i18n,variant_icon_rules,food_type,cook_method"
    )
    .order("display_order", { ascending: true });

  if (error) throw new Error(`Failed to load shop_recipes: ${error.message}`);

  const rows = data ?? [];
  const matches = searchTerm
    ? rows.filter(
        (row) =>
          textIncludes(row.title, searchTerm) ||
          textIncludes(row.title_i18n?.en, searchTerm) ||
          textIncludes(row.title_i18n?.zh, searchTerm) ||
          textIncludes(row.slug, searchTerm)
      )
    : rows;

  process.stdout.write(JSON.stringify({ query: process.argv[2] ?? null, count: matches.length, matches }, null, 2));
  process.stdout.write("\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
