import type { ShopCookedDish, ShopShelfCategory } from "@/lib/shop.types";
import { SHOP_SHELF_CATEGORIES } from "@/lib/shop.types";

export type { ShopShelfCategory };
export { SHOP_SHELF_CATEGORIES };

export type KitchenLoadState = "idle" | "loading" | "ready" | "error";

/** One shelf's rendered tiles: a count of cooked dishes per recipe, in first-cooked order. */
export type KitchenShelfTile = {
  recipeId: string;
  count: number;
};

export type KitchenShelvesByCategory = Record<ShopShelfCategory, KitchenShelfTile[]>;

/**
 * Groups cooked-dish rows (one row per cook, per shop_cooked_dishes) into
 * per-shelf tiles aggregated by recipe -- the same "stack same dish, show a
 * count badge" behavior as the reviewed mockup, now driven by real
 * shop_cooked_dishes rows instead of client-only demo state. Tile order
 * within a shelf follows first-cooked-to-that-shelf order (stable across
 * re-renders), not last-cooked-first, so dragging a dish onto a shelf with
 * an existing tile of that recipe doesn't reorder the shelf.
 */
export function buildKitchenShelvesByCategory(dishes: ShopCookedDish[]): KitchenShelvesByCategory {
  const shelves: KitchenShelvesByCategory = {
    default: [],
    drinks: [],
    desserts: [],
    hotmeal: [],
  };

  for (const dish of dishes) {
    const tiles = shelves[dish.shelfCategory];
    const existingTile = tiles.find((tile) => tile.recipeId === dish.recipeId);
    if (existingTile) {
      existingTile.count += 1;
    } else {
      tiles.push({ recipeId: dish.recipeId, count: 1 });
    }
  }

  return shelves;
}

/** Total dishes ever cooked, across all shelves -- for the "N dishes made" summary line. */
export function countTotalCookedDishes(dishes: ShopCookedDish[]): number {
  return dishes.length;
}
