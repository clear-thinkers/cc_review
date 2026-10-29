import { describe, expect, it } from "vitest";
import type { ShopCookedDish, ShopRecipe } from "@/lib/shop.types";
import {
  buildCountertopTiles,
  buildShelfTilesByFoodType,
  countCountertopDishes,
  countShelfDishes,
  countTotalCookedDishes,
  buildKitchenScenePrepRequirements,
  buildKitchenScenePrepTokens,
  HAND_WASH_VIDEO_SRC,
  isChefChallengePrepPhase,
  isKitchenScenePrepComplete,
  KITCHEN_SCENE_IMAGE_PATHS,
  shouldPlayHandWashVideo,
  resolveApplianceLabel,
  resolveAvailableSpecialIngredients,
  resolveKitchenScene,
  resolveKitchenSceneImagePath,
  RECIPE_KITCHEN_SCENES,
  SHOP_FOOD_TYPES,
} from "./kitchen.types";
import { kitchenStrings } from "./kitchen.strings";

function dish(overrides: Partial<ShopCookedDish>): ShopCookedDish {
  return {
    id: "dish-1",
    userId: "user-1",
    recipeId: "recipe-1",
    location: "countertop",
    specialIngredientKeys: [],
    cookedAt: 0,
    ...overrides,
  };
}

function recipe(overrides: Partial<ShopRecipe>): ShopRecipe {
  return {
    id: overrides.id ?? "recipe-1",
    slug: overrides.id ?? "recipe-1",
    title: overrides.id ?? "recipe-1",
    titleI18n: { en: overrides.id ?? "recipe-1", zh: overrides.id ?? "recipe-1" },
    displayOrder: 0,
    isActive: true,
    intro: "",
    introI18n: { en: "", zh: "" },
    unlockCostCoins: 0,
    baseIngredients: [],
    baseIngredientsI18n: { en: [], zh: [] },
    specialIngredients: [],
    specialIngredientsI18n: { en: [], zh: [] },
    variantIconRules: [],
    cookMethod: "stove",
    foodType: "drinks",
    isMystery: false,
    teaserI18n: null,
    ...overrides,
  };
}

describe("buildCountertopTiles", () => {
  const recipesById = new Map([
    [
      "donut",
      recipe({
        id: "donut",
        variantIconRules: [
          { match: [], iconPath: "/rewards/donut_plain.png" },
          { match: ["strawberry"], iconPath: "/rewards/donut_strawberry.png" },
        ],
      }),
    ],
  ]);

  it("includes only countertop dishes, aggregated by recipe", () => {
    const tiles = buildCountertopTiles(
      [
        dish({ id: "d1", recipeId: "bubble-tea", location: "countertop" }),
        dish({ id: "d2", recipeId: "bubble-tea", location: "countertop" }),
        dish({ id: "d3", recipeId: "onigiri", location: "shelf" }),
      ],
      new Map(),
      "en"
    );
    expect(tiles).toEqual([{ recipeId: "bubble-tea", iconPath: null, title: "bubble-tea", count: 2 }]);
  });

  it("stacks two dishes of the same recipe cooked with the same special-ingredient combo into one tile", () => {
    const tiles = buildCountertopTiles(
      [
        dish({ id: "d1", recipeId: "donut", specialIngredientKeys: ["strawberry"] }),
        dish({ id: "d2", recipeId: "donut", specialIngredientKeys: ["strawberry"] }),
      ],
      recipesById,
      "en"
    );
    expect(tiles).toEqual([
      { recipeId: "donut", iconPath: "/rewards/donut_strawberry.png", title: "donut", count: 2 },
    ]);
  });

  it("splits the same recipe into separate tiles when the resolved variant icon differs", () => {
    const tiles = buildCountertopTiles(
      [
        dish({ id: "d1", recipeId: "donut", specialIngredientKeys: [] }),
        dish({ id: "d2", recipeId: "donut", specialIngredientKeys: ["strawberry"] }),
      ],
      recipesById,
      "en"
    );
    expect(tiles).toEqual([
      { recipeId: "donut", iconPath: "/rewards/donut_plain.png", title: "donut", count: 1 },
      { recipeId: "donut", iconPath: "/rewards/donut_strawberry.png", title: "donut", count: 1 },
    ]);
  });

  it("merges an unmatched combination into the same tile as a truly-plain dish, since both fall back to the plain icon", () => {
    const tiles = buildCountertopTiles(
      [
        dish({ id: "d1", recipeId: "donut", specialIngredientKeys: [] }),
        dish({ id: "d2", recipeId: "donut", specialIngredientKeys: ["cinnamon"] }), // no rule matches "cinnamon" alone
      ],
      recipesById,
      "en"
    );
    expect(tiles).toEqual([
      { recipeId: "donut", iconPath: "/rewards/donut_plain.png", title: "donut", count: 2 },
    ]);
  });

  it("preserves first-cooked order rather than reordering on repeat cooks", () => {
    const tiles = buildCountertopTiles(
      [
        dish({ id: "d1", recipeId: "onigiri" }),
        dish({ id: "d2", recipeId: "bubble-tea" }),
        dish({ id: "d3", recipeId: "onigiri" }),
      ],
      new Map(),
      "en"
    );
    expect(tiles.map((tile) => tile.recipeId)).toEqual(["onigiri", "bubble-tea"]);
    expect(tiles.find((tile) => tile.recipeId === "onigiri")?.count).toBe(2);
  });

  it("is empty for no dishes or when everything has already been organized to the shelf", () => {
    expect(buildCountertopTiles([], new Map(), "en")).toEqual([]);
    expect(buildCountertopTiles([dish({ location: "shelf" })], new Map(), "en")).toEqual([]);
  });

  it("uses a variant rule's own titleI18n for the requested locale instead of the recipe's name", () => {
    const recipesWithNamedVariant = new Map([
      [
        "tea",
        recipe({
          id: "tea",
          title: "Bubble Tea",
          titleI18n: { en: "Bubble Tea", zh: "珍珠奶茶" },
          variantIconRules: [
            { match: [], iconPath: "/rewards/tea_plain.png" },
            {
              match: ["brown-sugar"],
              iconPath: "/rewards/tea_brown-sugar.png",
              titleI18n: { en: "Brown Sugar Milk Tea", zh: "黑糖奶茶" },
            },
          ],
        }),
      ],
    ]);

    const tilesEn = buildCountertopTiles(
      [dish({ id: "d1", recipeId: "tea", specialIngredientKeys: ["brown-sugar"] })],
      recipesWithNamedVariant,
      "en"
    );
    expect(tilesEn[0].title).toBe("Brown Sugar Milk Tea");

    const tilesZh = buildCountertopTiles(
      [dish({ id: "d1", recipeId: "tea", specialIngredientKeys: ["brown-sugar"] })],
      recipesWithNamedVariant,
      "zh"
    );
    expect(tilesZh[0].title).toBe("黑糖奶茶");

    const plainTiles = buildCountertopTiles(
      [dish({ id: "d2", recipeId: "tea", specialIngredientKeys: [] })],
      recipesWithNamedVariant,
      "en"
    );
    expect(plainTiles[0].title).toBe("Bubble Tea");
  });
});

describe("countCountertopDishes", () => {
  it("counts only countertop dishes", () => {
    expect(
      countCountertopDishes([
        dish({ id: "d1", location: "countertop" }),
        dish({ id: "d2", location: "countertop" }),
        dish({ id: "d3", location: "shelf" }),
      ])
    ).toBe(2);
  });

  it("is zero for no dishes", () => {
    expect(countCountertopDishes([])).toBe(0);
  });
});

describe("buildShelfTilesByFoodType", () => {
  const recipesById = new Map([
    ["bubble-tea", recipe({ id: "bubble-tea", foodType: "drinks" })],
    ["onigiri", recipe({ id: "onigiri", foodType: "hotmeal" })],
    ["mochi", recipe({ id: "mochi", foodType: "desserts" })],
  ]);

  it("groups shelved dishes into the tab matching their recipe's foodType", () => {
    const shelves = buildShelfTilesByFoodType(
      [dish({ id: "d1", recipeId: "bubble-tea", location: "shelf" })],
      recipesById,
      "en"
    );
    expect(shelves.drinks).toEqual([{ recipeId: "bubble-tea", iconPath: null, title: "bubble-tea", count: 1 }]);
    expect(shelves.hotmeal).toEqual([]);
    expect(shelves.desserts).toEqual([]);
  });

  it("excludes countertop dishes -- only organized (shelf) dishes are grouped", () => {
    const shelves = buildShelfTilesByFoodType(
      [dish({ id: "d1", recipeId: "bubble-tea", location: "countertop" })],
      recipesById,
      "en"
    );
    expect(shelves.drinks).toEqual([]);
  });

  it("stacks repeated cooks of the same recipe into one tile with a count", () => {
    const shelves = buildShelfTilesByFoodType(
      [
        dish({ id: "d1", recipeId: "mochi", location: "shelf" }),
        dish({ id: "d2", recipeId: "mochi", location: "shelf" }),
      ],
      recipesById,
      "en"
    );
    expect(shelves.desserts).toEqual([{ recipeId: "mochi", iconPath: null, title: "mochi", count: 2 }]);
  });

  it("skips a dish whose recipe can't be resolved or has no foodType, rather than guessing a tab", () => {
    const shelves = buildShelfTilesByFoodType(
      [dish({ id: "d1", recipeId: "unknown-recipe", location: "shelf" })],
      recipesById,
      "en"
    );
    for (const foodType of SHOP_FOOD_TYPES) {
      expect(shelves[foodType]).toEqual([]);
    }
  });

  it("returns all three empty tabs for no dishes", () => {
    const shelves = buildShelfTilesByFoodType([], recipesById, "en");
    for (const foodType of SHOP_FOOD_TYPES) {
      expect(shelves[foodType]).toEqual([]);
    }
  });
});

describe("countTotalCookedDishes", () => {
  it("counts every cook event across countertop and shelf, not distinct recipes", () => {
    expect(
      countTotalCookedDishes([
        dish({ id: "d1", recipeId: "bubble-tea", location: "countertop" }),
        dish({ id: "d2", recipeId: "bubble-tea", location: "shelf" }),
        dish({ id: "d3", recipeId: "onigiri", location: "shelf" }),
      ])
    ).toBe(3);
  });

  it("is zero for no dishes", () => {
    expect(countTotalCookedDishes([])).toBe(0);
  });
});

describe("countShelfDishes", () => {
  it("counts only shelved dishes", () => {
    expect(
      countShelfDishes([
        dish({ id: "d1", location: "shelf" }),
        dish({ id: "d2", location: "shelf" }),
        dish({ id: "d3", location: "countertop" }),
      ])
    ).toBe(2);
  });

  it("is zero for no dishes", () => {
    expect(countShelfDishes([])).toBe(0);
  });
});

describe("resolveKitchenSceneImagePath", () => {
  it("returns the empty scene for zero shelved dishes", () => {
    expect(resolveKitchenSceneImagePath(0)).toBe(KITCHEN_SCENE_IMAGE_PATHS.empty);
  });

  it("returns the half-stocked scene for 1 to 5 shelved dishes", () => {
    expect(resolveKitchenSceneImagePath(1)).toBe(KITCHEN_SCENE_IMAGE_PATHS.halfStocked);
    expect(resolveKitchenSceneImagePath(5)).toBe(KITCHEN_SCENE_IMAGE_PATHS.halfStocked);
  });

  it("returns the stocked scene for more than 5 shelved dishes", () => {
    expect(resolveKitchenSceneImagePath(6)).toBe(KITCHEN_SCENE_IMAGE_PATHS.stocked);
    expect(resolveKitchenSceneImagePath(20)).toBe(KITCHEN_SCENE_IMAGE_PATHS.stocked);
  });
});

describe("resolveKitchenScene", () => {
  it("uses the shelf-stock scene with the chef when no recipe is selected", () => {
    const scene = resolveKitchenScene(3, null);
    expect(scene.imagePath).toBe(KITCHEN_SCENE_IMAGE_PATHS.halfStocked);
    expect(scene.showChef).toBe(true);
  });

  it("uses the shelf-stock scene for a selected recipe without a special scene", () => {
    expect(resolveKitchenScene(0, "pancake").imagePath).toBe(KITCHEN_SCENE_IMAGE_PATHS.empty);
  });

  it("swaps in a recipe's special scene, layout and all, while it is selected", () => {
    const scene = resolveKitchenScene(20, "rainbow-macarons");
    expect(scene).toBe(RECIPE_KITCHEN_SCENES["rainbow-macarons"]);
    expect(scene.imagePath).toBe("/kitchen/kitchen_rainbow-macarons.png");
    expect(scene.showChef).toBe(false);
  });

  it("gives Crystal Pear Dew its own scene with animation anchors", () => {
    const scene = resolveKitchenScene(0, "crystal-pear-dew");
    expect(scene.imagePath).toBe("/kitchen/kitchen_crystal-pear-dew.png");
    expect(scene.showChef).toBe(false);
    expect(scene.effects?.ingredientOrigins.length).toBeGreaterThan(0);
  });

  it("gives Golden Mooncake its own scene with a spot for each of its four ingredients", () => {
    const scene = resolveKitchenScene(0, "golden-mooncake");
    expect(scene.imagePath).toBe("/kitchen/kitchen_golden_mooncakes.jpg");
    expect(scene.showChef).toBe(false);
    expect(scene.effects?.ingredientOrigins).toHaveLength(4);
  });

  it("keeps every scene's painted-chef tap area clear of its hotspots", () => {
    const box = (b: { left: string; top: string; width: string; height: string }) => {
      const [left, top, width, height] = [b.left, b.top, b.width, b.height].map(parseFloat);
      return { left, top, right: left + width, bottom: top + height };
    };
    for (const scene of Object.values(RECIPE_KITCHEN_SCENES)) {
      if (!scene.effects) continue;
      const chef = box(scene.effects.chef);
      for (const hotspot of Object.values(scene.hotspots).map(box)) {
        const overlaps =
          chef.left < hotspot.right && hotspot.left < chef.right && chef.top < hotspot.bottom && hotspot.top < chef.bottom;
        expect(overlaps).toBe(false);
      }
    }
  });
});

describe("kitchen scene prep", () => {
  const origins = [
    { left: "10%", top: "10%" },
    { left: "20%", top: "20%" },
  ];
  const icons: Record<string, string | null> = { pear: "/pear.png", sugar: "/sugar.png", salt: null, goji: "/goji.png" };
  const requirements = buildKitchenScenePrepRequirements({
    baseRequirements: new Map([
      ["pear", 2],
      ["salt", 1],
      ["sugar", 1],
    ]),
    specialIngredients: [
      { key: "goji", quantity: 1 },
      { key: "pear", quantity: 1 },
    ],
    resolveIngredient: (key) => ({ label: key.toUpperCase(), iconPath: icons[key] ?? null }),
  });

  it("asks for base units plus chosen specials, skipping iconless ingredients", () => {
    expect(requirements.map((r) => [r.key, r.quantity, r.label])).toEqual([
      ["pear", 3, "PEAR"],
      ["sugar", 1, "SUGAR"],
      ["goji", 1, "GOJI"],
    ]);
  });

  it("keeps each token on its own origin as others finish, with what's left", () => {
    const tokens = buildKitchenScenePrepTokens(requirements, origins, { pear: 1, sugar: 1 });
    expect(tokens.map((t) => [t.key, t.remaining, t.from])).toEqual([
      ["pear", 2, origins[0]],
      ["goji", 1, origins[0]],
    ]);
    expect(buildKitchenScenePrepTokens(requirements, [], {})).toEqual([]);
  });

  it("is complete only once every unit is in the pot", () => {
    expect(isKitchenScenePrepComplete(requirements, { pear: 3, sugar: 1 })).toBe(false);
    expect(isKitchenScenePrepComplete(requirements, { pear: 3, sugar: 1, goji: 1 })).toBe(true);
    expect(isKitchenScenePrepComplete([], {})).toBe(true);
  });
});

describe("resolveAvailableSpecialIngredients", () => {
  const specialIngredients = [
    { ingredientKey: "chocolate", name: "Chocolate", quantity: 1 },
    { ingredientKey: "strawberry", name: "Strawberry", quantity: 2 },
    { name: "No Key", quantity: 1 },
  ];

  it("includes only slots the child has enough of", () => {
    const availabilityByKey = new Map([["chocolate", 3], ["strawberry", 1]]);
    const options = resolveAvailableSpecialIngredients(specialIngredients, availabilityByKey);
    expect(options).toEqual([{ ingredientKey: "chocolate", name: "Chocolate", quantity: 1, available: 3 }]);
  });

  it("excludes a slot with no resolvable ingredientKey", () => {
    const options = resolveAvailableSpecialIngredients(
      [{ name: "No Key", quantity: 1 }],
      new Map([["no-key", 5]])
    );
    expect(options).toEqual([]);
  });

  it("is empty when the child has none of any offered special ingredient", () => {
    expect(resolveAvailableSpecialIngredients(specialIngredients, new Map())).toEqual([]);
  });

  it("includes a slot exactly at its required quantity, not just strictly above it", () => {
    const options = resolveAvailableSpecialIngredients(
      [{ ingredientKey: "chocolate", name: "Chocolate", quantity: 2 }],
      new Map([["chocolate", 2]])
    );
    expect(options).toEqual([{ ingredientKey: "chocolate", name: "Chocolate", quantity: 2, available: 2 }]);
  });
});

describe("resolveApplianceLabel", () => {
  const labels = { stovetopLabel: "Stovetop", ovenLabel: "Oven" };

  it("names the appliance the recipe itself requires, not any other appliance", () => {
    expect(resolveApplianceLabel("stove", labels)).toBe("Stovetop");
    expect(resolveApplianceLabel("oven", labels)).toBe("Oven");
  });
});

describe("kitchen.strings parity", () => {
  it("EN and ZH top-level keys match", () => {
    const enKeys = Object.keys(kitchenStrings.en).sort();
    const zhKeys = Object.keys(kitchenStrings.zh).sort();
    expect(enKeys).toEqual(zhKeys);
  });
});

describe("chef challenge prep phase (roadmap item T)", () => {
  const prep = {
    sceneIsInteractive: true,
    selectedRecipeId: "crystal-pear-dew",
    cookingRecipeId: null,
    isCookCommitting: false,
    hasDishReveal: false,
  };

  it("offers the challenge while prepping an interactive scene", () => {
    expect(isChefChallengePrepPhase(prep)).toBe(true);
  });

  it("never offers it on a plain or default scene, with no recipe, or once cooking starts", () => {
    expect(isChefChallengePrepPhase({ ...prep, sceneIsInteractive: false })).toBe(false);
    expect(isChefChallengePrepPhase({ ...prep, selectedRecipeId: null })).toBe(false);
    expect(isChefChallengePrepPhase({ ...prep, cookingRecipeId: "crystal-pear-dew" })).toBe(false);
    expect(isChefChallengePrepPhase({ ...prep, isCookCommitting: true })).toBe(false);
    expect(isChefChallengePrepPhase({ ...prep, hasDishReveal: true })).toBe(false);
  });
});

describe("hand-wash reward video (roadmap item T)", () => {
  it("plays after a new recipe choice only once unlocked", () => {
    expect(shouldPlayHandWashVideo({ isUnlocked: true, isDeselecting: false })).toBe(true);
    expect(shouldPlayHandWashVideo({ isUnlocked: false, isDeselecting: false })).toBe(false);
  });

  it("never plays when a recipe is deselected", () => {
    expect(shouldPlayHandWashVideo({ isUnlocked: true, isDeselecting: true })).toBe(false);
  });

  it("points at the shipped video file", () => {
    expect(HAND_WASH_VIDEO_SRC).toBe("/video/shrewy_hand_wash.mp4");
  });
});
