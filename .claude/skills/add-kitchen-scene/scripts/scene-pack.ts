/**
 * Kitchen-scene reference pack builder (add-kitchen-scene skill, Phase 1-2).
 *
 * READ-ONLY against the dev database (.env.local); never reads
 * .env.production.local and never writes to any database.
 *
 * Usage:
 *   npx tsx .claude/skills/add-kitchen-scene/scripts/scene-pack.ts --list
 *       Every cookable recipe with its scene status (none / plain / interactive)
 *       and how many active chef-challenge questions it has.
 *
 *   npx tsx .claude/skills/add-kitchen-scene/scripts/scene-pack.ts <slug> [<slug> ...]
 *   npx tsx .claude/skills/add-kitchen-scene/scripts/scene-pack.ts --all-missing
 *       For each recipe, writes into public/kitchen/staging/<slug>/ (gitignored):
 *         refs/NN-<name>.<ext>   the numbered reference images, in the exact
 *                                order the prompt's "Reference images" list uses
 *         contact-sheet.png      dish + ingredients side by side, labelled, so
 *                                Claude can view them in ONE read and describe
 *                                each one accurately in the prompt
 *       and prints a JSON manifest (titles, cook method, ingredients in recipe
 *       order, reference order, example scene) for drafting the prompt.
 *
 * The real RECIPE_KITCHEN_SCENES is imported, so "has a scene" can never drift
 * from what the app actually renders.
 */
import { createClient } from "@supabase/supabase-js";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { RECIPE_KITCHEN_SCENES } from "../../../../src/app/words/shop/kitchen/kitchen.types";

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, "public");

/** The base room and the chef: always references 1 and 2. */
const EMPTY_KITCHEN = "/kitchen/kitchen_empty.png";
const CHEF = "/kitchen/chef_idle.png";
/**
 * The finished example scene the prompt points at ("follow how it adds..."). Always
 * Crystal Pear Dew, for oven recipes too (the owner's own Golden Mooncake prompt did
 * the same): it keeps every scene at its 1600 x 1391 framing.
 */
const EXAMPLE_SCENE = { path: "/kitchen/kitchen_crystal-pear-dew.png", name: "Crystal Pear Dew scene" };

function loadEnvFile(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
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

type Recipe = {
  id: string;
  slug: string;
  title_i18n: { en: string; zh: string };
  is_active: boolean;
  is_mystery: boolean | null;
  cook_method: "stove" | "oven" | null;
  food_type: string | null;
  base_ingredients: { ingredientKey: string; quantity: number }[] | null;
  special_ingredient_slots: { ingredientKey: string; quantity: number }[] | null;
  variant_icon_rules: { match: string[] | string; iconPath: string }[] | null;
};

type Ingredient = { ingredient_key: string; label_i18n: { en: string; zh: string }; icon_path: string | null };

function sceneStatus(slug: string): "none" | "plain" | "interactive" {
  const scene = RECIPE_KITCHEN_SCENES[slug];
  if (!scene) return "none";
  return scene.effects ? "interactive" : "plain";
}

function plainIconPath(recipe: Recipe): string | null {
  const rules = recipe.variant_icon_rules ?? [];
  const plain = rules.find((rule) => (Array.isArray(rule.match) ? rule.match.length === 0 : !rule.match));
  return plain?.iconPath ?? null;
}

function slugName(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function contactSheet(tiles: { file: string; label: string }[], out: string): Promise<void> {
  const size = 320;
  const labelHeight = 34;
  const gap = 10;
  const width = tiles.length * (size + gap) + gap;
  const height = size + labelHeight + gap * 2;
  const composites: sharp.OverlayOptions[] = [];
  for (const [index, tile] of tiles.entries()) {
    const left = gap + index * (size + gap);
    const image = await sharp(tile.file).resize(size, size, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).toBuffer();
    composites.push({ input: image, left, top: gap });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${labelHeight}"><text x="${size / 2}" y="22" font-size="17" font-family="sans-serif" text-anchor="middle" fill="#222">${escapeXml(tile.label)}</text></svg>`;
    composites.push({ input: Buffer.from(svg), left, top: gap + size });
  }
  await sharp({ create: { width, height, channels: 3, background: "#e9e4da" } }).composite(composites).png().toFile(out);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (!loadEnvFile(path.join(ROOT, ".env.local"))) console.warn("Warning: .env.local not found. Falling back to process env.");
  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [{ data: recipes, error: recipeError }, { data: ingredients, error: ingredientError }, { data: questions, error: questionError }] =
    await Promise.all([
      supabase
        .from("shop_recipes")
        .select("id,slug,title_i18n,is_active,is_mystery,cook_method,food_type,base_ingredients,special_ingredient_slots,variant_icon_rules")
        .order("display_order"),
      supabase.from("shop_ingredient_prices").select("ingredient_key,label_i18n,icon_path"),
      supabase.from("chef_challenge_questions").select("recipe_id,is_active"),
    ]);
  if (recipeError) throw new Error(`Failed to load shop_recipes: ${recipeError.message}`);
  if (ingredientError) throw new Error(`Failed to load shop_ingredient_prices: ${ingredientError.message}`);
  if (questionError) throw new Error(`Failed to load chef_challenge_questions: ${questionError.message}`);

  const ingredientByKey = new Map((ingredients as Ingredient[]).map((row) => [row.ingredient_key, row]));
  const activeQuestions = new Map<string, number>();
  for (const row of questions ?? []) {
    if (row.is_active) activeQuestions.set(row.recipe_id, (activeQuestions.get(row.recipe_id) ?? 0) + 1);
  }
  const cookable = (recipes as Recipe[]).filter((recipe) => recipe.cook_method === "stove" || recipe.cook_method === "oven");

  if (args.includes("--list") || args.length === 0) {
    console.log("slug | cook | scene | active questions | mystery | active");
    for (const recipe of cookable) {
      console.log(
        [recipe.slug, recipe.cook_method, sceneStatus(recipe.slug), activeQuestions.get(recipe.id) ?? 0, recipe.is_mystery ? "mystery" : "", recipe.is_active ? "" : "INACTIVE"].join(" | ")
      );
    }
    return;
  }

  const wanted = args.includes("--all-missing")
    ? cookable.filter((recipe) => sceneStatus(recipe.slug) === "none")
    : args.map((slug) => {
        const recipe = (recipes as Recipe[]).find((row) => row.slug === slug);
        if (!recipe) throw new Error(`No recipe with slug "${slug}".`);
        if (!recipe.cook_method) throw new Error(`"${slug}" isn't cookable (no cook_method), so it never shows a kitchen scene.`);
        return recipe;
      });

  const manifests = [];
  for (const recipe of wanted) {
    const dishIcon = plainIconPath(recipe);
    if (!dishIcon) throw new Error(`"${recipe.slug}" has no plain icon in variant_icon_rules.`);
    const base = (recipe.base_ingredients ?? []).map((item) => {
      const row = ingredientByKey.get(item.ingredientKey);
      return {
        key: item.ingredientKey,
        quantity: item.quantity,
        labelEn: row?.label_i18n?.en ?? item.ingredientKey,
        labelZh: row?.label_i18n?.zh ?? "",
        iconPath: row?.icon_path ?? null,
      };
    });
    const missingIcons = base.filter((item) => !item.iconPath || !existsSync(path.join(PUBLIC, item.iconPath)));
    if (missingIcons.length > 0) {
      throw new Error(`"${recipe.slug}": no icon file for ${missingIcons.map((item) => item.key).join(", ")}.`);
    }

    const example = EXAMPLE_SCENE;
    const references = [
      { name: "Empty kitchen", path: EMPTY_KITCHEN },
      { name: "Shrewy", path: CHEF },
      { name: recipe.title_i18n.en, path: dishIcon },
      ...base.map((item) => ({ name: item.labelEn, path: item.iconPath as string })),
      { name: example.name, path: example.path },
    ].map((ref, index) => ({ number: index + 1, ...ref }));

    const outDir = path.join(PUBLIC, "kitchen", "staging", recipe.slug);
    const refsDir = path.join(outDir, "refs");
    mkdirSync(refsDir, { recursive: true });
    const refFiles = references.map((ref) => {
      const source = path.join(PUBLIC, ref.path);
      const target = path.join(refsDir, `${String(ref.number).padStart(2, "0")}-${slugName(ref.name)}${path.extname(ref.path)}`);
      copyFileSync(source, target);
      return path.relative(ROOT, target).replace(/\\/g, "/");
    });
    const sheet = path.join(outDir, "contact-sheet.png");
    await contactSheet(
      [{ file: path.join(PUBLIC, dishIcon), label: `DISH: ${recipe.title_i18n.en}` }, ...base.map((item) => ({ file: path.join(PUBLIC, item.iconPath as string), label: item.labelEn }))],
      sheet
    );

    manifests.push({
      slug: recipe.slug,
      title: recipe.title_i18n,
      cookMethod: recipe.cook_method,
      foodType: recipe.food_type,
      mystery: Boolean(recipe.is_mystery),
      activeQuestions: activeQuestions.get(recipe.id) ?? 0,
      currentScene: sceneStatus(recipe.slug),
      baseIngredientsInRecipeOrder: base,
      specialIngredients: (recipe.special_ingredient_slots ?? []).map((item) => ingredientByKey.get(item.ingredientKey)?.label_i18n?.en ?? item.ingredientKey),
      references: references.map((ref, index) => ({ number: ref.number, name: ref.name, file: refFiles[index] })),
      contactSheet: path.relative(ROOT, sheet).replace(/\\/g, "/"),
    });
  }
  console.log(JSON.stringify(manifests, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
