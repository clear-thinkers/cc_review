import type {
  ShopIngredient,
  ShopIngredientPrice,
  ShopLocale,
  ShopLocalizedValue,
  ShopRecipe,
} from "./shop.types";

export type ShopIngredientCatalogEntry = {
  key: string;
  label: ShopLocalizedValue<string>;
  defaultCostCoins: number;
  iconPath: string | null;
  aliases?: string[];
};

export type ShopAdminIngredientCatalogKind = "basic" | "special";

export type ShopAdminIngredientCatalogItem = {
  key: string;
  label: ShopLocalizedValue<string>;
  defaultCostCoins: number;
  iconPath: string | null;
  kind: ShopAdminIngredientCatalogKind;
  costCoins: number;
};

export type ShopAdminIngredientPricesResponse = {
  ingredients: ShopAdminIngredientCatalogItem[];
};

const SHOP_INGREDIENT_CATALOG: ShopIngredientCatalogEntry[] = [
  {
    key: "butter",
    label: { en: "Butter", zh: "黄油" },
    defaultCostCoins: 5,
    iconPath: "/ingredients/butter_base.png",
    aliases: ["butter"],
  },
  {
    key: "egg",
    label: { en: "Egg", zh: "鸡蛋" },
    defaultCostCoins: 3,
    iconPath: "/ingredients/egg_base.png",
    aliases: ["egg", "eggs"],
  },
  {
    key: "flour",
    label: { en: "Flour", zh: "面粉" },
    defaultCostCoins: 3,
    iconPath: "/ingredients/flour_base.png",
    aliases: ["flour"],
  },
  {
    key: "milk",
    label: { en: "Milk", zh: "牛奶" },
    defaultCostCoins: 4,
    iconPath: "/ingredients/milk_base.png",
    aliases: ["milk"],
  },
  {
    key: "strawberry",
    label: { en: "Strawberry", zh: "草莓" },
    defaultCostCoins: 6,
    iconPath: "/ingredients/strawberry_base.png",
    aliases: ["strawberry", "strawberries"],
  },
  {
    key: "sugar",
    label: { en: "Sugar", zh: "糖" },
    defaultCostCoins: 2,
    iconPath: "/ingredients/sugar_base.png",
    aliases: ["sugar"],
  },
  {
    key: "sugar-sprinkles",
    label: { en: "Sugar Sprinkles", zh: "糖针" },
    defaultCostCoins: 4,
    iconPath: "/ingredients/sugar-sprinkles_base.png",
    aliases: ["sugar sprinkles", "sprinkles"],
  },
  {
    key: "black-tea",
    label: { en: "Black Tea", zh: "红茶" },
    defaultCostCoins: 3,
    iconPath: null,
    aliases: ["black tea", "tea"],
  },
  {
    key: "tapioca-pearls",
    label: { en: "Tapioca Pearls", zh: "珍珠" },
    defaultCostCoins: 5,
    iconPath: null,
    aliases: ["tapioca pearls", "pearls"],
  },
  {
    key: "yeast",
    label: { en: "Yeast", zh: "酵母" },
    defaultCostCoins: 2,
    iconPath: null,
    aliases: ["yeast"],
  },
  {
    key: "warm-water",
    label: { en: "Warm Water", zh: "温水" },
    defaultCostCoins: 1,
    iconPath: null,
    aliases: ["warm water"],
  },
  {
    key: "ice-cream",
    label: { en: "Ice Cream", zh: "冰淇淋" },
    defaultCostCoins: 4,
    iconPath: null,
    aliases: ["ice cream"],
  },
  {
    key: "noodles",
    label: { en: "Noodles", zh: "面条" },
    defaultCostCoins: 4,
    iconPath: null,
    aliases: ["noodles"],
  },
  {
    key: "broth",
    label: { en: "Broth", zh: "高汤" },
    defaultCostCoins: 3,
    iconPath: null,
    aliases: ["broth"],
  },
  {
    key: "cooked-rice",
    label: { en: "Cooked Rice", zh: "米饭" },
    defaultCostCoins: 2,
    iconPath: null,
    aliases: ["cooked rice"],
  },
  {
    key: "seaweed",
    label: { en: "Seaweed", zh: "海苔" },
    defaultCostCoins: 2,
    iconPath: null,
    aliases: ["seaweed"],
  },
  {
    key: "salt",
    label: { en: "Salt", zh: "盐" },
    defaultCostCoins: 1,
    iconPath: null,
    aliases: ["salt"],
  },
  {
    key: "glutinous-rice-flour",
    label: { en: "Glutinous Rice Flour", zh: "糯米粉" },
    defaultCostCoins: 4,
    iconPath: null,
    aliases: ["glutinous rice flour"],
  },
  {
    key: "water",
    label: { en: "Water", zh: "水" },
    defaultCostCoins: 1,
    iconPath: null,
    aliases: ["water"],
  },
  {
    key: "sesame-filling",
    label: { en: "Sesame Filling", zh: "芝麻馅" },
    defaultCostCoins: 5,
    iconPath: null,
    aliases: ["sesame filling"],
  },
  {
    key: "sticky-rice",
    label: { en: "Sticky Rice", zh: "糯米" },
    defaultCostCoins: 3,
    iconPath: null,
    aliases: ["sticky rice"],
  },
  {
    key: "bamboo-leaves",
    label: { en: "Bamboo Leaves", zh: "粽叶" },
    defaultCostCoins: 2,
    iconPath: null,
    aliases: ["bamboo leaves"],
  },
  {
    key: "red-bean-filling",
    label: { en: "Red Bean Filling", zh: "红豆馅" },
    defaultCostCoins: 5,
    iconPath: null,
    aliases: ["red bean filling"],
  },
];

const SHOP_INGREDIENT_CATALOG_BY_KEY = new Map(
  SHOP_INGREDIENT_CATALOG.map((entry) => [entry.key, entry] as const)
);

const SHOP_INGREDIENT_CATALOG_BY_ALIAS = new Map<string, ShopIngredientCatalogEntry>();

for (const entry of SHOP_INGREDIENT_CATALOG) {
  SHOP_INGREDIENT_CATALOG_BY_ALIAS.set(normalizeIngredientAlias(entry.key), entry);
  for (const alias of entry.aliases ?? []) {
    SHOP_INGREDIENT_CATALOG_BY_ALIAS.set(normalizeIngredientAlias(alias), entry);
  }
}

function normalizeIngredientAlias(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function listShopIngredientCatalog(): ShopIngredientCatalogEntry[] {
  return SHOP_INGREDIENT_CATALOG;
}

export function getShopIngredientCatalogEntry(
  ingredientKey: string | null | undefined
): ShopIngredientCatalogEntry | null {
  if (!ingredientKey) {
    return null;
  }
  return SHOP_INGREDIENT_CATALOG_BY_KEY.get(ingredientKey.trim()) ?? null;
}

export function findShopIngredientCatalogEntryByAlias(
  name: string | null | undefined
): ShopIngredientCatalogEntry | null {
  if (!name) {
    return null;
  }
  return SHOP_INGREDIENT_CATALOG_BY_ALIAS.get(normalizeIngredientAlias(name)) ?? null;
}

export function buildShopIngredientFromCatalog(
  entry: ShopIngredientCatalogEntry,
  locale: ShopLocale,
  quantity: number
): ShopIngredient {
  return {
    ingredientKey: entry.key,
    name: entry.label[locale],
    quantity,
  };
}

function mergeLocalizedValue(
  current: ShopLocalizedValue<string>,
  incoming: ShopLocalizedValue<string>
): ShopLocalizedValue<string> {
  return {
    en: current.en || incoming.en,
    zh: current.zh || incoming.zh,
  };
}

function resolveIngredientLabelOverride(
  entryKey: string,
  fallbackLabel: ShopLocalizedValue<string>,
  prices: ShopIngredientPrice[]
): ShopLocalizedValue<string> {
  const matchingPrice = prices.find((price) => price.ingredientKey === entryKey);
  if (!matchingPrice?.labelI18n) {
    return fallbackLabel;
  }

  return {
    en: matchingPrice.labelI18n.en.trim() || fallbackLabel.en,
    zh: matchingPrice.labelI18n.zh.trim() || fallbackLabel.zh,
  };
}

function listShopSpecialIngredientCatalogEntries(
  recipes: Pick<ShopRecipe, "specialIngredientsI18n">[]
): Array<{
  key: string;
  label: ShopLocalizedValue<string>;
}> {
  const entriesByKey = new Map<
    string,
    {
      key: string;
      label: ShopLocalizedValue<string>;
    }
  >();

  for (const recipe of recipes) {
    recipe.specialIngredientsI18n.en.forEach((englishIngredient, ingredientIndex) => {
      const chineseIngredient = recipe.specialIngredientsI18n.zh[ingredientIndex];
      const key = englishIngredient.ingredientKey?.trim() ?? "";
        if (!key) {
          return;
        }

        const nextEntry = {
          key,
          label: {
            en: englishIngredient.name.trim() || key,
            zh: chineseIngredient?.name.trim() || englishIngredient.name.trim() || key,
          },
        };

        const existingEntry = entriesByKey.get(key);
        if (!existingEntry) {
          entriesByKey.set(key, nextEntry);
          return;
        }

        entriesByKey.set(key, {
          key,
          label: mergeLocalizedValue(existingEntry.label, nextEntry.label),
        });
    });
  }

  return [...entriesByKey.values()].sort((left, right) => left.label.en.localeCompare(right.label.en));
}

export function buildShopAdminIngredientCatalogItems(
  prices: ShopIngredientPrice[],
  recipes: Pick<ShopRecipe, "specialIngredientsI18n">[] = []
): ShopAdminIngredientCatalogItem[] {
  const priceByKey = new Map(prices.map((price) => [price.ingredientKey, price.costCoins] as const));

  const basicIngredients = SHOP_INGREDIENT_CATALOG.map((entry) => ({
    key: entry.key,
    label: resolveIngredientLabelOverride(entry.key, entry.label, prices),
    defaultCostCoins: entry.defaultCostCoins,
    iconPath: entry.iconPath,
    kind: "basic" as const,
    costCoins: priceByKey.get(entry.key) ?? entry.defaultCostCoins,
  }));
  const specialIngredients = listShopSpecialIngredientCatalogEntries(recipes)
    .filter((entry) => !SHOP_INGREDIENT_CATALOG_BY_KEY.has(entry.key))
    .map((entry) => ({
      key: entry.key,
      label: resolveIngredientLabelOverride(entry.key, entry.label, prices),
      defaultCostCoins: 0,
      iconPath: null,
      kind: "special" as const,
      costCoins: priceByKey.get(entry.key) ?? 0,
    }));

  return [...basicIngredients, ...specialIngredients];
}
