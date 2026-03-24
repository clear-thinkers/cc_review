"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/authContext";
import type {
  ShopRecipe,
  ShopRecipeUnlock,
  ShopSpecialIngredientSlot,
} from "./shop.types";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import {
  getOrCreateWallet,
  listShopRecipeUnlocks,
  listShopRecipes,
  unlockShopRecipe,
} from "@/lib/supabase-service";
import {
  SHOP_WALL_SIZE,
  canAffordRecipeUnlock,
  resolveShopRecipeIconPath,
} from "@/lib/shop";

type LoadState = "idle" | "loading" | "ready" | "error";

function formatWithToken(template: string, token: string, value: string): string {
  return template.replace(token, value);
}

function buildUnlockNotice(
  resultCode: string,
  strings: WordsWorkspaceVM["str"]["shop"]
): string {
  switch (resultCode) {
    case "already_unlocked":
      return strings.alreadyUnlocked;
    case "insufficient_coins":
      return strings.insufficientCoins;
    case "recipe_not_available":
      return strings.recipeUnavailable;
    case "forbidden":
      return strings.childOnly;
    default:
      return strings.unlockFailed;
  }
}

function getTileCardClassName(
  recipeState: "reserved" | "locked" | "unlocked"
): string {
  if (recipeState === "reserved") {
    return "flex h-full min-h-[220px] flex-col gap-3 rounded-lg border-2 border-gray-300 bg-gray-100 p-4 text-gray-600";
  }

  if (recipeState === "locked") {
    return "flex h-full min-h-[220px] flex-col gap-3 rounded-lg border-2 border-gray-300 bg-gray-100 p-4";
  }

  return "flex h-full min-h-[220px] flex-col gap-3 rounded-lg border-2 border-[#dcc38a] bg-[#fcf8ef] p-4 text-left";
}

function getTileArtClassName(recipeState: "reserved" | "locked" | "unlocked"): string {
  if (recipeState === "unlocked") {
    return "flex min-h-[120px] items-center justify-center rounded-md border bg-white p-3";
  }

  return "flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-gray-400 bg-gray-200 p-3";
}

function RecipeModal({
  recipe,
  strings,
  onClose,
}: {
  recipe: ShopRecipe;
  strings: WordsWorkspaceVM["str"]["shop"];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 shadow-[0_24px_60px_rgba(85,122,84,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shop-recipe-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="shop-recipe-title" className="text-xl font-semibold text-gray-900">
              {recipe.title}
            </h2>
          </div>
          <button
            type="button"
            className="rounded-md border-2 border-gray-400 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700"
            onClick={onClose}
          >
            {strings.modal.close}
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="space-y-2 rounded-lg border p-4">
            <h3 className="font-medium">{strings.modal.intro}</h3>
            <p className="text-sm text-gray-700">{recipe.intro}</p>
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <h3 className="font-medium">{strings.modal.baseIngredients}</h3>
            <div className="space-y-2">
              {recipe.baseIngredients.map((ingredient) => (
                <div
                  key={`${recipe.id}-${ingredient.name}`}
                  className="rounded-md border bg-white px-3 py-2 text-sm text-gray-700"
                >
                  <strong>{ingredient.name}</strong>{" "}
                  <span>
                    {ingredient.quantity}
                    {ingredient.unit ? ` ${ingredient.unit}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <h3 className="font-medium">{strings.modal.specialSlots}</h3>
            {recipe.specialIngredientSlots.length === 0 ? (
              <p className="text-sm text-gray-600">{strings.modal.noSpecialSlots}</p>
            ) : (
              <div className="space-y-2">
                {recipe.specialIngredientSlots.map((slot: ShopSpecialIngredientSlot) => (
                  <div
                    key={`${recipe.id}-${slot.slotKey}`}
                    className="rounded-md border bg-white px-3 py-3"
                  >
                    <div className="text-sm font-semibold text-gray-900">{slot.label}</div>
                    <div className="text-xs text-gray-500">
                      {formatWithToken(
                        strings.modal.slotLimit,
                        "{count}",
                        String(slot.maxSelections)
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      {slot.options.map((option) => (
                        <div
                          key={`${slot.slotKey}-${option.key}`}
                          className="text-sm text-gray-700"
                        >
                          <strong>{option.label}</strong>: {option.effect}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShopSection({ vm }: { vm: WordsWorkspaceVM }) {
  const session = useSession();
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [recipes, setRecipes] = useState<ShopRecipe[]>([]);
  const [walletCoins, setWalletCoins] = useState(0);
  const [unlocks, setUnlocks] = useState<ShopRecipeUnlock[]>([]);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(
    null
  );
  const [selectedRecipe, setSelectedRecipe] = useState<ShopRecipe | null>(null);
  const [unlockingRecipeId, setUnlockingRecipeId] = useState<string | null>(null);

  useEffect(() => {
    if (vm.page !== "shop") {
      return;
    }

    let isCancelled = false;

    async function loadShop(): Promise<void> {
      setLoadState("loading");

      try {
        const [wallet, recipeRows, unlockRows] = await Promise.all([
          getOrCreateWallet(),
          listShopRecipes(),
          listShopRecipeUnlocks(),
        ]);

        if (isCancelled) {
          return;
        }

        setWalletCoins(wallet.totalCoins);
        setRecipes(recipeRows);
        setUnlocks(unlockRows);
        setLoadState("ready");
      } catch (error) {
        console.error("Failed to load shop:", error);
        if (!isCancelled) {
          setLoadState("error");
        }
      }
    }

    void loadShop();

    return () => {
      isCancelled = true;
    };
  }, [vm.page]);

  const unlockedRecipeIds = useMemo(
    () => new Set(unlocks.map((unlock) => unlock.recipeId)),
    [unlocks]
  );

  const recipesByOrder = useMemo(() => {
    const map = new Map<number, ShopRecipe>();
    for (const recipe of recipes) {
      map.set(recipe.displayOrder, recipe);
    }
    return map;
  }, [recipes]);

  if (vm.page !== "shop") {
    return null;
  }

  async function handleUnlock(recipe: ShopRecipe): Promise<void> {
    setNotice(null);
    setUnlockingRecipeId(recipe.id);

    try {
      const result = await unlockShopRecipe(recipe.id);
      if (!result.success) {
        if (result.code === "already_unlocked") {
          setUnlocks((current) =>
            current.some((unlock) => unlock.recipeId === recipe.id)
              ? current
              : [
                  ...current,
                  {
                    userId: session?.userId ?? "",
                    recipeId: recipe.id,
                    coinsSpent: result.coinsSpent,
                    unlockedAt: Date.now(),
                  },
                ]
          );
        }
        setNotice({
          tone: "error",
          text: buildUnlockNotice(result.code, vm.str.shop),
        });
        if (typeof result.remainingCoins === "number") {
          setWalletCoins(result.remainingCoins);
        }
        return;
      }

      setWalletCoins(result.remainingCoins);
      setUnlocks((current) =>
        current.some((unlock) => unlock.recipeId === result.recipeId)
          ? current
          : [
              ...current,
              {
                userId: session?.userId ?? "",
                recipeId: result.recipeId,
                coinsSpent: result.coinsSpent,
                unlockedAt: Date.now(),
              },
            ]
      );
      setNotice({
        tone: "success",
        text: formatWithToken(vm.str.shop.unlockSuccess, "{title}", recipe.title),
      });
    } catch (error) {
      console.error("Failed to unlock recipe:", error);
      setNotice({
        tone: "error",
        text: vm.str.shop.unlockFailed,
      });
    } finally {
      setUnlockingRecipeId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h2 className="font-medium">{vm.str.shop.pageTitle}</h2>
          <p className="max-w-3xl text-sm text-gray-700">{vm.str.shop.pageDescription}</p>
        </div>
        <div className="stats-gold rounded-lg border p-4 lg:min-w-[220px]">
          <p className="text-sm uppercase text-gray-600">{vm.str.shop.coinBag}</p>
          <p className="text-2xl font-semibold">🪙 {walletCoins}</p>
        </div>
      </div>

      {notice ? (
        <p
          className={
            notice.tone === "success"
              ? "text-sm text-blue-700"
              : "rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
          }
        >
          {notice.text}
        </p>
      ) : null}

      {loadState === "loading" || loadState === "idle" ? (
        <p className="text-sm text-gray-600">{vm.str.shop.loading}</p>
      ) : loadState === "error" ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {vm.str.shop.loadError}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium">{vm.str.shop.wallLabel}</h3>
            <p className="text-sm text-gray-600">
              {recipes.filter((recipe) => recipe.isActive).length}/{SHOP_WALL_SIZE}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: SHOP_WALL_SIZE }, (_, index) => {
              const displayOrder = index + 1;
              const recipe = recipesByOrder.get(displayOrder);

              if (!recipe || !recipe.isActive) {
                return (
                  <article
                    key={`shop-slot-${displayOrder}`}
                    className={getTileCardClassName("reserved")}
                  >
                    <div className={getTileArtClassName("reserved")}>
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl font-semibold text-gray-500">
                        ?
                      </div>
                    </div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      {vm.str.shop.reserved}
                    </p>
                    <p className="text-sm font-medium text-gray-600">#{displayOrder}</p>
                  </article>
                );
              }

              const isUnlocked = unlockedRecipeIds.has(recipe.id);
              const iconPath = resolveShopRecipeIconPath(recipe.variantIconRules, []);

              if (isUnlocked) {
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    className={getTileCardClassName("unlocked")}
                    onClick={() => setSelectedRecipe(recipe)}
                  >
                    <div className={getTileArtClassName("unlocked")}>
                      {iconPath ? (
                        <img
                          src={iconPath}
                          alt={recipe.title}
                          className="h-28 w-28 object-contain"
                        />
                      ) : null}
                    </div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      {vm.str.shop.unlocked}
                    </p>
                    <p className="text-base leading-tight font-semibold text-gray-900">
                      {recipe.title}
                    </p>
                    <p className="text-sm text-gray-600">{vm.str.shop.modal.baseIngredients}</p>
                  </button>
                );
              }

              const canAfford = canAffordRecipeUnlock(walletCoins, recipe);

              return (
                <article key={recipe.id} className={getTileCardClassName("locked")}>
                  <div className={getTileArtClassName("locked")}>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl font-semibold text-gray-500">
                      ?
                    </div>
                  </div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    {vm.str.shop.locked}
                  </p>
                  <p className="text-base leading-tight font-semibold text-gray-700">
                    {recipe.title}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatWithToken(
                      canAfford ? vm.str.shop.unlockCost : vm.str.shop.notEnoughCoins,
                      "{coins}",
                      String(recipe.unlockCostCoins)
                    )}
                  </p>
                  <button
                    type="button"
                    className="rounded-md border-2 border-amber-400 bg-amber-100 px-4 py-2 font-medium text-amber-900 disabled:opacity-50"
                    disabled={!canAfford || unlockingRecipeId === recipe.id}
                    onClick={() => void handleUnlock(recipe)}
                  >
                    {unlockingRecipeId === recipe.id ? `${vm.str.shop.unlock}...` : vm.str.shop.unlock}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {selectedRecipe ? (
        <RecipeModal
          recipe={selectedRecipe}
          strings={vm.str.shop}
          onClose={() => setSelectedRecipe(null)}
        />
      ) : null}
    </section>
  );
}
