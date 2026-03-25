import { access } from "node:fs/promises";
import path from "node:path";
import type {
  DebugShopIngredientIconAuditItem,
  DebugShopIngredientIconAuditResponse,
} from "@/app/words/debug/debug.types";
import { listShopIngredientCatalog } from "@/app/words/shop/shopIngredients";

type ShopIngredientIconExists = (filePath: string) => Promise<boolean>;

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

export async function auditShopIngredientIcons(
  iconExists: ShopIngredientIconExists = defaultShopIngredientIconExists
): Promise<DebugShopIngredientIconAuditResponse> {
  const items: DebugShopIngredientIconAuditItem[] = await Promise.all(
    listShopIngredientCatalog().map(async (entry) => {
      const filePath = resolvePublicAssetFilePath(entry.iconPath);
      const exists = filePath ? await iconExists(filePath) : null;

      return {
        key: entry.key,
        label: entry.label,
        iconPath: entry.iconPath,
        filePath,
        exists,
      };
    })
  );

  return {
    checkedAt: Date.now(),
    items,
    missingItems: items.filter((item) => item.iconPath !== null && item.exists === false),
  };
}
