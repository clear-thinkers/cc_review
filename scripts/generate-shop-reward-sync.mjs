import fs from "node:fs";
import path from "node:path";

const REWARDS_DIR = path.resolve("public", "rewards");
const EXPECTED_RECIPE_SLUGS = [
  "bubble_tea",
  "bun",
  "cake",
  "donut",
  "milkshake",
  "ramen",
  "rice_ball",
  "tangyuan",
  "zongzi",
];

function toRecipeSlug(foodToken) {
  return foodToken.trim().replaceAll("-", "_");
}

function toTitleCase(value) {
  return value
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function parseRewardFileName(fileName) {
  if (!fileName.endsWith(".png")) {
    return null;
  }

  const stem = fileName.slice(0, -4);
  const parts = stem.split("_");
  if (parts.length < 2 || parts.length > 3) {
    throw new Error(
      `Unsupported reward filename "${fileName}". Expected food_ingredients[_mood].png`
    );
  }

  const [foodToken, ingredientsToken, moodToken] = parts;
  const recipeSlug = toRecipeSlug(foodToken);
  const ingredientKeys =
    ingredientsToken === "plain" ? [] : ingredientsToken.split("+").filter(Boolean);

  return {
    fileName,
    recipeSlug,
    ingredientKeys,
    mood: moodToken ?? null,
    isPlain: ingredientsToken === "plain",
  };
}

function buildUpdateSql(recipeSlug, entries) {
  const sortedEntries = [...entries].sort((left, right) => {
    if (left.isPlain !== right.isPlain) {
      return left.isPlain ? -1 : 1;
    }

    if (left.ingredientKeys.length !== right.ingredientKeys.length) {
      return left.ingredientKeys.length - right.ingredientKeys.length;
    }

    return left.fileName.localeCompare(right.fileName);
  });

  const variantIconRules = sortedEntries.map((entry) => ({
    match: entry.ingredientKeys,
    iconPath: `/rewards/${entry.fileName}`,
  }));

  const uniqueIngredientKeys = Array.from(
    new Set(
      sortedEntries.flatMap((entry) => entry.ingredientKeys)
    )
  ).sort();

  const maxSelections = sortedEntries.reduce(
    (highest, entry) => Math.max(highest, entry.ingredientKeys.length),
    1
  );

  const specialIngredientSlots =
    uniqueIngredientKeys.length === 0
      ? []
      : [
          {
            slotKey: "specialty_ingredients",
            label: "Special Ingredients",
            maxSelections,
            options: uniqueIngredientKeys.map((key) => ({
              key,
              label: toTitleCase(key),
              effect: "used in specialty recipes",
            })),
          },
        ];

  const variantIconRulesSql = `$$${JSON.stringify(variantIconRules, null, 2)}$$::jsonb`;
  const specialIngredientSlotsSql =
    uniqueIngredientKeys.length === 0
      ? "'[]'::jsonb"
      : `$$${JSON.stringify(specialIngredientSlots, null, 2)}$$::jsonb`;

  return `update shop_recipes
set
  variant_icon_rules = ${variantIconRulesSql},
  special_ingredient_slots = ${specialIngredientSlotsSql},
  updated_at = now()
where slug = '${recipeSlug}';`;
}

function main() {
  const files = fs.readdirSync(REWARDS_DIR).filter((name) => name.endsWith(".png")).sort();
  const parsedEntries = files.map(parseRewardFileName).filter(Boolean);
  const grouped = new Map();

  for (const entry of parsedEntries) {
    const current = grouped.get(entry.recipeSlug) ?? [];
    current.push(entry);
    grouped.set(entry.recipeSlug, current);
  }

  const sqlBlocks = [];
  for (const recipeSlug of EXPECTED_RECIPE_SLUGS) {
    const entries = grouped.get(recipeSlug) ?? [];
    if (entries.length === 0) {
      sqlBlocks.push(`-- No reward assets found for ${recipeSlug}`);
      continue;
    }

    sqlBlocks.push(buildUpdateSql(recipeSlug, entries));
  }

  const recipesMissingPlain = EXPECTED_RECIPE_SLUGS.filter((recipeSlug) => {
    const entries = grouped.get(recipeSlug) ?? [];
    return !entries.some((entry) => entry.isPlain);
  });

  console.log("-- Generated from public/rewards");
  console.log("-- Recipes missing a plain asset:", recipesMissingPlain.join(", ") || "none");
  console.log("");
  console.log(sqlBlocks.join("\n\n"));
}

main();
