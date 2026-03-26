import { access } from "node:fs/promises";
import path from "node:path";
import type {
  DebugShopIngredientIconAuditItem,
  DebugShopIngredientIconAuditResponse,
} from "@/app/words/debug/debug.types";
import {
  listShopIngredientCatalog,
  type ShopAdminIngredientCatalogItem,
  type ShopIngredientCatalogEntry,
} from "@/app/words/shop/shopIngredients";

type ShopIngredientIconExists = (filePath: string) => Promise<boolean>;
type ShopIngredientIconAuditSourceItem = Pick<
  ShopIngredientCatalogEntry | ShopAdminIngredientCatalogItem,
  "key" | "label" | "iconPath"
> & {
  hasPriceRow?: boolean;
};

async function defaultShopIngredientIconExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function resolvePublicAssetFilePath(iconPath: string | null): string | null {
  if (!iconPath) {
    return null;
  }

  const normalizedIconPath = iconPath.trim();
  if (!normalizedIconPath.startsWith("/")) {
    return null;
  }

  const relativeIconPath = normalizedIconPath.slice(1);
  if (!relativeIconPath) {
    return null;
  }

  return path.join(process.cwd(), "public", relativeIconPath);
}

export function resolveShopIngredientIconFilePath(iconPath: string | null): string | null {
  return resolvePublicAssetFilePath(iconPath);
}

export function normalizeShopIngredientIconPath(iconPath: string): string {
  return iconPath.trim();
}

export function validateShopIngredientIconPath(iconPath: string): string {
  const normalizedIconPath = normalizeShopIngredientIconPath(iconPath);
  if (
    !normalizedIconPath.startsWith("/ingredients/") ||
    !normalizedIconPath.toLowerCase().endsWith(".png")
  ) {
    throw new Error('Ingredient icon path must start with "/ingredients/" and end with ".png".');
  }

  return normalizedIconPath;
}

export async function auditShopIngredientCatalogItems(
  items: ShopIngredientIconAuditSourceItem[],
  iconExists: ShopIngredientIconExists = defaultShopIngredientIconExists,
  availableIconPaths: string[] = []
): Promise<DebugShopIngredientIconAuditResponse> {
  const auditItems: DebugShopIngredientIconAuditItem[] = await Promise.all(
    items.map(async (entry) => {
      const filePath = resolvePublicAssetFilePath(entry.iconPath);
      const exists = filePath ? await iconExists(filePath) : null;

      return {
        key: entry.key,
        label: entry.label,
        iconPath: entry.iconPath,
        exists,
        hasPriceRow: entry.hasPriceRow ?? true,
      };
    })
  );

  return {
    checkedAt: Date.now(),
    availableIconPaths: [...availableIconPaths],
    items: auditItems,
    missingItems: auditItems.filter((item) => item.iconPath !== null && item.exists === false),
  };
}

export async function auditShopIngredientIcons(
  iconExists: ShopIngredientIconExists = defaultShopIngredientIconExists
): Promise<DebugShopIngredientIconAuditResponse> {
  return auditShopIngredientCatalogItems(listShopIngredientCatalog(), iconExists);
}
