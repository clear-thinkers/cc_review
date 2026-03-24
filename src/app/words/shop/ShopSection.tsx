"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "@/lib/authContext";
import { useLocale } from "@/app/shared/locale";
import type {
  ShopRecipe,
  ShopTransaction,
  ShopRecipeUnlock,
  ShopSpecialIngredientSlot,
} from "./shop.types";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import {
  getOrCreateWallet,
  listShopRecipeUnlocks,
  listShopRecipes,
  listShopTransactions,
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

function formatShopTransactionDateTime(timestamp: number, locale: "en" | "zh"): string {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function buildShopTransactionActionLabel(
  transaction: ShopTransaction,
  recipesById: Map<string, ShopRecipe>,
  strings: WordsWorkspaceVM["str"]["shop"]
): string {
  if (transaction.actionType === "unlock_recipe") {
    const recipeTitle =
      (transaction.recipeId ? recipesById.get(transaction.recipeId)?.title : null) ??
      strings.history.unknownRecipe;
    return formatWithToken(strings.history.actionUnlockRecipe, "{title}", recipeTitle);
  }

  return strings.history.unknownRecipe;
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
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/35 p-4"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 shadow-[0_24px_60px_rgba(85,122,84,0.18)]"
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
                      <div className="text-sm font-semibold text-gray-900">
                        {slot.label}
                      </div>
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
    </div>,
    document.body
  );
}

function HistoryModal({
  transactions,
  recipesById,
  strings,
  locale,
  onClose,
}: {
  transactions: ShopTransaction[];
  recipesById: Map<string, ShopRecipe>;
  strings: WordsWorkspaceVM["str"]["shop"];
  locale: "en" | "zh";
  onClose: () => void;
}) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/35 p-4"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 shadow-[0_24px_60px_rgba(85,122,84,0.18)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shop-history-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 id="shop-history-title" className="text-xl font-semibold text-gray-900">
                {strings.history.title}
              </h2>
              <p className="text-sm text-gray-600">{strings.history.description}</p>
            </div>
            <button
              type="button"
              className="rounded-md border-2 border-gray-400 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700"
              onClick={onClose}
            >
              {strings.modal.close}
            </button>
          </div>

          {transactions.length === 0 ? (
            <div className="mt-4 rounded-lg border bg-white px-4 py-5 text-sm text-gray-600">
              {strings.history.empty}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-[#e7d2aa] bg-white">
              <table className="min-w-full text-left text-sm text-gray-700">
                <thead className="bg-[#f7ead0] text-[#8f5e2c]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">
                      {strings.history.headers.dateTime}
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      {strings.history.headers.action}
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      {strings.history.headers.cost}
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      {strings.history.headers.beginningBalance}
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      {strings.history.headers.endingBalance}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-t border-[#f0e2c2]">
                      <td className="px-3 py-2">
                        {formatShopTransactionDateTime(transaction.createdAt, locale)}
                      </td>
                      <td className="px-3 py-2">
                        {buildShopTransactionActionLabel(
                          transaction,
                          recipesById,
                          strings
                        )}
                      </td>
                      <td className="px-3 py-2 font-semibold text-[#a24d1f]">
                        -{transaction.coinsSpent}
                      </td>
                      <td className="px-3 py-2">{transaction.beginningBalance}</td>
                      <td className="px-3 py-2">{transaction.endingBalance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ShopSection({ vm }: { vm: WordsWorkspaceVM }) {
  const session = useSession();
  const locale = useLocale();
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [recipes, setRecipes] = useState<ShopRecipe[]>([]);
  const [walletCoins, setWalletCoins] = useState(0);
  const [unlocks, setUnlocks] = useState<ShopRecipeUnlock[]>([]);
  const [transactions, setTransactions] = useState<ShopTransaction[]>([]);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(
    null
  );
  const [selectedRecipe, setSelectedRecipe] = useState<ShopRecipe | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [unlockingRecipeId, setUnlockingRecipeId] = useState<string | null>(null);

  useEffect(() => {
    if (vm.page !== "shop") {
      return;
    }

    let isCancelled = false;

    async function loadShop(): Promise<void> {
      setLoadState("loading");

      try {
        const [wallet, recipeRows, unlockRows, transactionRows] = await Promise.all([
          getOrCreateWallet(),
          listShopRecipes(),
          listShopRecipeUnlocks(),
          listShopTransactions(),
        ]);

        if (isCancelled) {
          return;
        }

        setWalletCoins(wallet.totalCoins);
        setRecipes(recipeRows);
        setUnlocks(unlockRows);
        setTransactions(transactionRows);
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

  useEffect(() => {
    if (!selectedRecipe && !isHistoryOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedRecipe(null);
        setIsHistoryOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isHistoryOpen, selectedRecipe]);

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

  const recipesById = useMemo(() => {
    const map = new Map<string, ShopRecipe>();
    for (const recipe of recipes) {
      map.set(recipe.id, recipe);
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
      try {
        const transactionRows = await listShopTransactions();
        setTransactions(transactionRows);
      } catch (transactionError) {
        console.error("Failed to refresh shop transactions:", transactionError);
      }
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
        <button
          type="button"
          title={vm.str.shop.history.tooltip}
          aria-label={vm.str.shop.openHistory}
          className="relative h-[90px] w-full max-w-[200px] cursor-pointer rounded-[1.5rem] text-left transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 lg:w-[200px]"
          onClick={() => setIsHistoryOpen(true)}
        >
          <img
            src="/icon/coin-card.svg"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-fill"
          />
          <img
            src="/icon/coin-bag.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[10%] left-[-1%] w-[58%] object-contain drop-shadow-[0_8px_14px_rgba(125,80,18,0.22)]"
          />
          <div className="pointer-events-none absolute inset-y-0 left-[30%] right-[9%] flex items-center justify-center text-center">
            <p className="text-xl font-extrabold leading-none tracking-tight text-[#9f6027] drop-shadow-[0_3px_4px_rgba(123,66,16,0.18)] sm:text-[1.5rem]">
              {walletCoins.toLocaleString()}
            </p>
          </div>
        </button>
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

          <div className="grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
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
                    {unlockingRecipeId === recipe.id
                      ? `${vm.str.shop.unlock}...`
                      : vm.str.shop.unlock}
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

      {isHistoryOpen ? (
        <HistoryModal
          transactions={transactions}
          recipesById={recipesById}
          strings={vm.str.shop}
          locale={locale}
          onClose={() => setIsHistoryOpen(false)}
        />
      ) : null}
    </section>
  );
}
