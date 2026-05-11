"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth, useSession } from "@/lib/authContext";
import { useLocale } from "@/app/shared/locale";
import { resolveChildProfileTarget } from "@/lib/child-profile-target";
import type {
  CoinBreakdown,
  CoinRedemption,
  ShopIngredient,
  ShopIngredientPrice,
  ShopRecipe,
  ShopTransaction,
  ShopRecipeUnlock,
} from "./shop.types";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import {
  getCoinBreakdown,
  listCoinRedemptions,
  listShopIngredientPrices,
  listShopRecipeUnlocks,
  listShopRecipes,
  listShopTransactions,
  redeemCoins,
  unlockShopRecipe,
} from "@/lib/supabase-service";
import {
  buildShopIngredientRecordMap,
  SHOP_WALL_SIZE,
  canAffordRecipeUnlock,
  getShopRecipeContentForLocale,
  resolvePlainShopRecipeIconPath,
  resolveShopIngredientIconPath,
  resolveShopRecipeIconPath,
} from "@/lib/shop";

type LoadState = "idle" | "loading" | "ready" | "error";
type CashOutStep = "form" | "confirm" | "submitting";

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
    case "plain_icon_missing":
      return strings.recipeNotOpenYet;
    case "recipe_not_available":
      return strings.recipeUnavailable;
    case "forbidden":
      return strings.childOnly;
    default:
      return strings.unlockFailed;
  }
}

function formatShopDateTime(timestamp: number, locale: "en" | "zh"): string {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatIngredientAmount(ingredient: ShopIngredient): string {
  return `x${ingredient.quantity}`;
}

function buildShopTransactionActionLabel(
  transaction: ShopTransaction,
  recipesById: Map<string, ShopRecipe>,
  locale: "en" | "zh",
  strings: WordsWorkspaceVM["str"]["shop"]
): string {
  if (transaction.actionType === "unlock_recipe") {
    const recipeTitle =
      (transaction.recipeId
        ? recipesById.get(transaction.recipeId)
          ? getShopRecipeContentForLocale(recipesById.get(transaction.recipeId)!, locale).title
          : null
        : null) ?? strings.history.unknownRecipe;
    return formatWithToken(strings.history.actionUnlockRecipe, "{title}", recipeTitle);
  }
  return strings.history.unknownRecipe;
}

function getTileCardClassName(recipeState: "reserved" | "locked" | "unlocked"): string {
  if (recipeState === "reserved") {
    return "flex h-full min-h-[250px] flex-col gap-4 rounded-[1.75rem] border border-[#d8d1c1] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(242,238,228,0.96))] p-5 text-gray-600 shadow-[0_16px_34px_rgba(115,92,40,0.08)]";
  }
  if (recipeState === "locked") {
    return "flex h-full min-h-[250px] flex-col gap-4 rounded-[1.75rem] border border-[#d7d2c6] bg-[linear-gradient(180deg,rgba(245,245,244,0.96),rgba(232,232,231,0.98))] p-5 shadow-[0_16px_34px_rgba(115,92,40,0.08)]";
  }
  return "flex h-full min-h-[250px] flex-col gap-4 !rounded-[1.75rem] border border-[#dcc38a] bg-[linear-gradient(180deg,rgba(255,252,244,0.98),rgba(249,242,224,0.98))] p-5 text-left shadow-[0_18px_38px_rgba(166,128,42,0.1)]";
}

function getTileArtClassName(recipeState: "reserved" | "locked" | "unlocked"): string {
  if (recipeState === "unlocked") {
    return "relative flex min-h-[138px] items-center justify-center overflow-hidden rounded-[1.4rem] border border-[#eadfbe] bg-[linear-gradient(180deg,rgba(255,255,255,0.28),rgba(255,255,255,0.08))] p-4";
  }
  return "flex min-h-[138px] items-center justify-center rounded-[1.4rem] border border-dashed border-gray-400/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.45),rgba(214,214,214,0.75))] p-4";
}

function RecipeModal({
  recipe,
  ingredientRecordsByKey,
  locale,
  strings,
  onClose,
}: {
  recipe: ShopRecipe;
  ingredientRecordsByKey: ReadonlyMap<string, ShopIngredientPrice>;
  locale: "en" | "zh";
  strings: WordsWorkspaceVM["str"]["shop"];
  onClose: () => void;
}) {
  const [selectedIngredient, setSelectedIngredient] = useState<ShopIngredient | null>(null);
  if (typeof document === "undefined") return null;

  const localizedRecipe = getShopRecipeContentForLocale(recipe, locale);
  const selectedIngredientIconPath = selectedIngredient
    ? resolveShopIngredientIconPath(selectedIngredient, ingredientRecordsByKey)
    : null;

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
            <h2 id="shop-recipe-title" className="text-xl font-semibold text-gray-900">
              {localizedRecipe.title}
            </h2>
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
              <p className="text-sm text-gray-700">{localizedRecipe.intro}</p>
            </div>

            <div className="space-y-2 rounded-lg border p-4">
              <h3 className="text-lg font-semibold text-[#24423a]">{strings.modal.baseIngredients}</h3>
              <p className="text-xs text-gray-500">{strings.modal.ingredientTapHint}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {localizedRecipe.baseIngredients.map((ingredient, index) => {
                  const iconPath = resolveShopIngredientIconPath(ingredient, ingredientRecordsByKey);
                  return (
                    <button
                      key={`${recipe.id}-${index}`}
                      type="button"
                      onClick={() => setSelectedIngredient(ingredient)}
                      className="rounded-xl border border-[#eadfbe] bg-white px-3 py-3 text-sm text-gray-700 shadow-sm transition hover:border-[#d2b15b] hover:shadow-md"
                    >
                      {iconPath ? (
                        <div className="flex h-full flex-col items-center gap-2 text-center">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#eadfbe] bg-[#fff8ea] p-1.5 sm:h-16 sm:w-16">
                            <img src={iconPath} alt={ingredient.name} className="h-full w-full object-contain" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[1.45rem] font-bold leading-tight text-gray-900 sm:text-[1.65rem]">{ingredient.name}</div>
                            <div className="mt-0.5 text-base font-medium text-gray-600 sm:text-lg">{formatIngredientAmount(ingredient)}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full flex-col justify-center text-center">
                          <div className="text-[1.45rem] font-bold leading-tight text-gray-900 sm:text-[1.65rem]">{ingredient.name}</div>
                          <div className="mt-0.5 text-base font-medium text-gray-600 sm:text-lg">{formatIngredientAmount(ingredient)}</div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-4">
              <h3 className="text-lg font-semibold text-[#24423a]">{strings.modal.specialSlots}</h3>
              {localizedRecipe.specialIngredients.length === 0 ? (
                <p className="text-sm text-gray-600">{strings.modal.noSpecialSlots}</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {localizedRecipe.specialIngredients.map((ingredient, index) => {
                    const iconPath = resolveShopIngredientIconPath(ingredient, ingredientRecordsByKey);
                    return (
                      <button
                        key={`${recipe.id}-special-${ingredient.ingredientKey ?? ingredient.name}-${index}`}
                        type="button"
                        onClick={() => setSelectedIngredient(ingredient)}
                        className="flex min-h-[92px] items-center gap-3 rounded-lg border bg-white px-4 py-3 text-left transition hover:border-[#dcc38a] hover:shadow-[0_10px_24px_rgba(166,128,42,0.12)]"
                      >
                        {iconPath ? (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#eadfbe] bg-[#fff8ea] p-1.5 sm:h-14 sm:w-14">
                            <img src={iconPath} alt={ingredient.name} className="h-full w-full object-contain" />
                          </div>
                        ) : null}
                        <div className="min-w-0">
                          <div className="text-[1.35rem] font-bold leading-tight text-gray-900 sm:text-[1.5rem]">{ingredient.name}</div>
                          <div className="mt-0.5 text-base font-medium text-gray-600 sm:text-lg">{formatIngredientAmount(ingredient)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {selectedIngredient ? (
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/35 p-4"
              onClick={() => setSelectedIngredient(null)}
            >
              <div
                className="w-full max-w-md rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 shadow-[0_24px_60px_rgba(85,122,84,0.18)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#eadfbe] bg-white p-2">
                      {selectedIngredientIconPath ? (
                        <img src={selectedIngredientIconPath} alt={selectedIngredient.name} className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-xs font-semibold text-[#9a8f79]">{selectedIngredient.name}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#8b6f2f]">{strings.modal.ingredientDetailsTitle}</p>
                      <h3 className="mt-1 text-[1.75rem] font-bold leading-tight text-gray-900">{selectedIngredient.name}</h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-md border-2 border-gray-400 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700"
                    onClick={() => setSelectedIngredient(null)}
                  >
                    {strings.modal.close}
                  </button>
                </div>
                <div className="mt-4 space-y-4">
                  <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-[#eadfbe] bg-white p-6">
                    {selectedIngredientIconPath ? (
                      <img src={selectedIngredientIconPath} alt={selectedIngredient.name} className="max-h-[180px] w-auto object-contain" />
                    ) : (
                      <div className="text-sm text-gray-500">{selectedIngredient.name}</div>
                    )}
                  </div>
                  <div className="rounded-xl border border-[#eadfbe] bg-white px-4 py-3">
                    <div className="text-sm font-semibold text-gray-900">{strings.modal.ingredientQuantityNeeded}</div>
                    <div className="mt-1 text-lg font-semibold text-[#8b6f2f]">{formatIngredientAmount(selectedIngredient)}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
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
  if (typeof document === "undefined") return null;

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
                    <th className="px-3 py-2 font-semibold">{strings.history.headers.dateTime}</th>
                    <th className="px-3 py-2 font-semibold">{strings.history.headers.action}</th>
                    <th className="px-3 py-2 font-semibold">{strings.history.headers.cost}</th>
                    <th className="px-3 py-2 font-semibold">{strings.history.headers.beginningBalance}</th>
                    <th className="px-3 py-2 font-semibold">{strings.history.headers.endingBalance}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-t border-[#f0e2c2]">
                      <td className="px-3 py-2">{formatShopDateTime(transaction.createdAt, locale)}</td>
                      <td className="px-3 py-2">
                        {buildShopTransactionActionLabel(transaction, recipesById, locale, strings)}
                      </td>
                      <td className="px-3 py-2 font-semibold text-[#a24d1f]">-{transaction.coinsSpent}</td>
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

function CashOutConfirmModal({
  coins,
  note,
  signature,
  strings,
  onConfirm,
  onCancel,
}: {
  coins: number;
  note: string;
  signature: string;
  strings: WordsWorkspaceVM["str"]["shop"];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (typeof document === "undefined") return null;
  const dollars = (coins / 100).toFixed(2);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/35 p-4"
      onClick={onCancel}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="w-full max-w-md rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 shadow-[0_24px_60px_rgba(85,122,84,0.18)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cashout-confirm-title"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 id="cashout-confirm-title" className="text-xl font-semibold text-gray-900">
            {strings.cashOut.confirm.title}
          </h2>
          <div className="mt-4 space-y-2 rounded-xl border border-[#eadfbe] bg-white px-4 py-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="font-medium text-gray-600">{strings.cashOut.confirm.coinsRow}</span>
              <span className="font-semibold text-[#8b6f2f]">{coins.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-2 border-t border-[#f0e2c2] pt-2">
              <span className="font-medium text-gray-600">{strings.cashOut.confirm.dollarsRow}</span>
              <span className="font-semibold text-green-700">${dollars}</span>
            </div>
            <div className="flex justify-between gap-2 border-t border-[#f0e2c2] pt-2">
              <span className="font-medium text-gray-600">{strings.cashOut.confirm.noteRow}</span>
              <span className="max-w-[60%] text-right text-gray-800">{note}</span>
            </div>
            <div className="flex justify-between gap-2 border-t border-[#f0e2c2] pt-2">
              <span className="font-medium text-gray-600">{strings.cashOut.confirm.signatureRow}</span>
              <span className="font-semibold italic text-gray-800">{signature}</span>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              className="flex-1 rounded-md border-2 border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700"
              onClick={onCancel}
            >
              {strings.cashOut.confirm.cancelButton}
            </button>
            <button
              type="button"
              className="flex-1 rounded-md border-2 border-green-400 bg-green-100 px-4 py-2 text-sm font-semibold text-green-900"
              onClick={onConfirm}
            >
              {strings.cashOut.confirm.confirmButton}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ShopSection({ vm }: { vm: WordsWorkspaceVM }) {
  const session = useSession();
  const { familyProfiles } = useAuth();
  const locale = useLocale();
  const str = vm.str.shop;

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [recipes, setRecipes] = useState<ShopRecipe[]>([]);
  const [ingredientRecords, setIngredientRecords] = useState<ShopIngredientPrice[]>([]);
  const [breakdown, setBreakdown] = useState<CoinBreakdown>({
    totalEarned: 0,
    spentOnRecipes: 0,
    redeemed: 0,
    available: 0,
  });
  const [unlocks, setUnlocks] = useState<ShopRecipeUnlock[]>([]);
  const [transactions, setTransactions] = useState<ShopTransaction[]>([]);
  const [redemptions, setRedemptions] = useState<CoinRedemption[]>([]);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<ShopRecipe | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [unlockingRecipeId, setUnlockingRecipeId] = useState<string | null>(null);

  // Cash-out form state
  const [cashOutCoins, setCashOutCoins] = useState("");
  const [cashOutNote, setCashOutNote] = useState("");
  const [cashOutSignature, setCashOutSignature] = useState("");
  const [cashOutErrors, setCashOutErrors] = useState<{
    coins?: string;
    note?: string;
    signature?: string;
  }>({});
  const [cashOutStep, setCashOutStep] = useState<CashOutStep>("form");

  const childTarget = useMemo(
    () => resolveChildProfileTarget(session, familyProfiles),
    [familyProfiles, session]
  );
  const canActOnWallet =
    Boolean(childTarget?.isCurrentSessionTarget) &&
    (session?.role === "child" || session?.isPlatformAdmin === true);

  useEffect(() => {
    if (vm.page !== "shop") return;

    let isCancelled = false;

    async function loadShop(): Promise<void> {
      setLoadState("loading");

      try {
        const [
          breakdownData,
          ingredientPriceRows,
          recipeRows,
          unlockRows,
          transactionRows,
          redemptionRows,
        ] = await Promise.all([
          getCoinBreakdown(childTarget?.userId),
          listShopIngredientPrices(),
          listShopRecipes(),
          listShopRecipeUnlocks(childTarget?.userId),
          listShopTransactions(childTarget?.userId),
          listCoinRedemptions(childTarget?.userId),
        ]);

        if (isCancelled) return;

        setBreakdown(breakdownData);
        setIngredientRecords(ingredientPriceRows);
        setRecipes(recipeRows);
        setUnlocks(unlockRows);
        setTransactions(transactionRows);
        setRedemptions(redemptionRows);
        setLoadState("ready");
      } catch (error) {
        console.error("Failed to load shop:", error);
        if (!isCancelled) setLoadState("error");
      }
    }

    void loadShop();

    return () => {
      isCancelled = true;
    };
  }, [childTarget?.userId, vm.page]);

  useEffect(() => {
    if (!selectedRecipe && !isHistoryOpen && cashOutStep !== "confirm") return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedRecipe(null);
        setIsHistoryOpen(false);
        if (cashOutStep === "confirm") setCashOutStep("form");
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isHistoryOpen, selectedRecipe, cashOutStep]);

  const unlockedRecipeIds = useMemo(
    () => new Set(unlocks.map((unlock) => unlock.recipeId)),
    [unlocks]
  );

  const recipesByOrder = useMemo(() => {
    const map = new Map<number, ShopRecipe>();
    for (const recipe of recipes) map.set(recipe.displayOrder, recipe);
    return map;
  }, [recipes]);

  const recipesById = useMemo(() => {
    const map = new Map<string, ShopRecipe>();
    for (const recipe of recipes) map.set(recipe.id, recipe);
    return map;
  }, [recipes]);

  const ingredientRecordsByKey = useMemo(
    () => buildShopIngredientRecordMap(ingredientRecords),
    [ingredientRecords]
  );

  if (vm.page !== "shop") return null;

  async function handleUnlock(recipe: ShopRecipe): Promise<void> {
    setNotice(null);
    setUnlockingRecipeId(recipe.id);

    try {
      if (!resolvePlainShopRecipeIconPath(recipe.variantIconRules)) {
        throw new Error(`Plain icon missing for recipe unlock: ${recipe.slug}`);
      }

      const result = await unlockShopRecipe(recipe.id);
      if (!result.success) {
        if (result.code === "already_unlocked") {
          setUnlocks((current) =>
            current.some((u) => u.recipeId === recipe.id)
              ? current
              : [
                  ...current,
                  {
                    userId: childTarget?.userId ?? session?.userId ?? "",
                    recipeId: recipe.id,
                    coinsSpent: result.coinsSpent,
                    unlockedAt: Date.now(),
                  },
                ]
          );
        }
        setNotice({ tone: "error", text: buildUnlockNotice(result.code, str) });
        if (typeof result.remainingCoins === "number") {
          setBreakdown((prev) => ({ ...prev, available: result.remainingCoins as number }));
        }
        return;
      }

      setBreakdown((prev) => ({
        ...prev,
        available: result.remainingCoins,
        spentOnRecipes: prev.spentOnRecipes + result.coinsSpent,
      }));
      setUnlocks((current) =>
        current.some((u) => u.recipeId === result.recipeId)
          ? current
          : [
              ...current,
              {
                userId: childTarget?.userId ?? session?.userId ?? "",
                recipeId: result.recipeId,
                coinsSpent: result.coinsSpent,
                unlockedAt: Date.now(),
              },
            ]
      );
      setNotice({
        tone: "success",
        text: formatWithToken(
          str.unlockSuccess,
          "{title}",
          getShopRecipeContentForLocale(recipe, locale).title
        ),
      });
      try {
        const transactionRows = await listShopTransactions(childTarget?.userId);
        setTransactions(transactionRows);
      } catch (transactionError) {
        console.error("Failed to refresh shop transactions:", transactionError);
      }
    } catch (error) {
      console.error("Failed to unlock recipe:", error);
      setNotice({
        tone: "error",
        text:
          error instanceof Error && error.message.includes("Plain icon missing")
            ? str.recipeNotOpenYet
            : str.unlockFailed,
      });
    } finally {
      setUnlockingRecipeId(null);
    }
  }

  function validateCashOutForm(): boolean {
    const errors: { coins?: string; note?: string; signature?: string } = {};
    const coinsNum = parseInt(cashOutCoins, 10);

    if (!cashOutCoins || isNaN(coinsNum) || coinsNum <= 0 || coinsNum % 100 !== 0) {
      errors.coins = str.cashOut.errorNotMultiple;
    } else if (coinsNum > breakdown.available) {
      errors.coins = str.cashOut.errorExceedsBalance;
    }

    if (!cashOutNote.trim()) {
      errors.note = str.cashOut.errorNoteRequired;
    } else if (cashOutNote.trim().length > 200) {
      errors.note = str.cashOut.errorNoteTooLong;
    }

    if (!cashOutSignature.trim()) {
      errors.signature = str.cashOut.errorSignatureRequired;
    }

    setCashOutErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleCashOutSubmit(): void {
    if (validateCashOutForm()) {
      setCashOutStep("confirm");
    }
  }

  async function handleCashOutConfirm(): Promise<void> {
    setCashOutStep("submitting");
    const coins = parseInt(cashOutCoins, 10);

    try {
      const result = await redeemCoins(coins, cashOutNote.trim(), cashOutSignature.trim());

      if (!result.success) {
        setCashOutStep("form");
        if (result.code === "insufficient_coins") {
          setNotice({ tone: "error", text: str.cashOut.errorInsufficient });
          if (typeof result.remainingCoins === "number") {
            setBreakdown((prev) => ({ ...prev, available: result.remainingCoins as number }));
          }
        } else if (result.code === "forbidden") {
          setNotice({ tone: "error", text: str.cashOut.errorForbidden });
        } else {
          setNotice({ tone: "error", text: str.cashOut.errorFailed });
        }
        return;
      }

      const dollars = (result.coinsRedeemed / 100).toFixed(2);
      setBreakdown((prev) => ({
        ...prev,
        available: result.remainingCoins,
        redeemed: prev.redeemed + result.coinsRedeemed,
      }));
      setNotice({
        tone: "success",
        text: str.cashOut.successMessage
          .replace("{coins}", result.coinsRedeemed.toLocaleString())
          .replace("{dollars}", dollars),
      });
      setCashOutCoins("");
      setCashOutNote("");
      setCashOutSignature("");
      setCashOutErrors({});
      setCashOutStep("form");

      try {
        const [updatedRedemptions, updatedBreakdown] = await Promise.all([
          listCoinRedemptions(childTarget?.userId),
          getCoinBreakdown(childTarget?.userId),
        ]);
        setRedemptions(updatedRedemptions);
        setBreakdown(updatedBreakdown);
      } catch (refreshError) {
        console.error("Failed to refresh redemption data:", refreshError);
      }
    } catch (error) {
      console.error("Failed to redeem coins:", error);
      setCashOutStep("form");
      setNotice({ tone: "error", text: str.cashOut.errorFailed });
    }
  }

  const cashOutCoinsNum = parseInt(cashOutCoins, 10);

  return (
    <section className="space-y-4 rounded-lg border p-4">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h2 className="font-medium">{str.pageTitle}</h2>
          <p className="max-w-3xl text-sm text-gray-700">{str.pageDescription}</p>
          {childTarget && !childTarget.isCurrentSessionTarget ? (
            <>
              <p className="text-sm text-gray-600">{str.viewingProfile.replace("{name}", childTarget.userName)}</p>
              <p className="text-sm text-gray-600">{str.parentViewHint}</p>
            </>
          ) : null}
        </div>

        {/* Coin breakdown card */}
        <div className="w-full min-w-[220px] max-w-xs rounded-[1.5rem] border border-[#dcc38a] bg-[linear-gradient(180deg,rgba(255,252,244,0.98),rgba(249,242,224,0.98))] p-4 shadow-[0_16px_34px_rgba(115,92,40,0.08)] lg:w-[240px]">
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{str.breakdown.totalEarned}</span>
              <span className="font-semibold text-gray-800">{breakdown.totalEarned.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{str.breakdown.spentOnRecipes}</span>
              <span className="font-semibold text-gray-800">-{breakdown.spentOnRecipes.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{str.breakdown.redeemed}</span>
              <span className="font-semibold text-gray-800">-{breakdown.redeemed.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between border-t border-[#eadfbe] pt-1">
              <span className="font-semibold text-[#8b6f2f]">{str.breakdown.available}</span>
              <span className="text-xl font-extrabold text-[#9f6027]">{breakdown.available.toLocaleString()}</span>
            </div>
          </div>
          <button
            type="button"
            title={str.history.tooltip}
            aria-label={str.openHistory}
            className="mt-3 w-full rounded-md border border-[#d2b15b] bg-[#fff6dc] py-1.5 text-xs font-medium text-[#7b5b24] transition hover:bg-[#fff0c6]"
            onClick={() => setIsHistoryOpen(true)}
          >
            {str.history.title}
          </button>
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
        <p className="text-sm text-gray-600">{str.loading}</p>
      ) : loadState === "error" ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {str.loadError}
        </p>
      ) : (
        <div className="space-y-6">
          {/* Recipe wall */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">{str.wallLabel}</h3>
              <p className="text-sm text-gray-600">
                {recipes.filter((r) => r.isActive).length}/{SHOP_WALL_SIZE}
              </p>
            </div>

            <div className="grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {Array.from({ length: SHOP_WALL_SIZE }, (_, index) => {
                const displayOrder = index + 1;
                const recipe = recipesByOrder.get(displayOrder);

                if (!recipe || !recipe.isActive) {
                  return (
                    <article key={`shop-slot-${displayOrder}`} className={getTileCardClassName("reserved")}>
                      <div className={getTileArtClassName("reserved")}>
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl font-semibold text-gray-500">?</div>
                      </div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">{str.reserved}</p>
                      <p className="text-sm font-medium text-gray-600">#{displayOrder}</p>
                    </article>
                  );
                }

                const isUnlocked = unlockedRecipeIds.has(recipe.id);
                const plainIconPath = resolvePlainShopRecipeIconPath(recipe.variantIconRules);
                const iconPath = plainIconPath ?? resolveShopRecipeIconPath(recipe.variantIconRules, []);
                const localizedRecipe = getShopRecipeContentForLocale(recipe, locale);

                if (isUnlocked) {
                  return (
                    <article key={recipe.id} className={getTileCardClassName("unlocked")}>
                      <div className={getTileArtClassName("unlocked")}>
                        <div className="pointer-events-none absolute inset-x-6 bottom-4 h-5 rounded-full bg-[radial-gradient(circle,rgba(181,138,56,0.22),rgba(181,138,56,0))] blur-md" />
                        {iconPath ? (
                          <img src={iconPath} alt={localizedRecipe.title} className="relative z-[1] h-28 w-28 object-contain drop-shadow-[0_10px_18px_rgba(113,78,28,0.18)] sm:h-32 sm:w-32" />
                        ) : null}
                      </div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#8d7a55]">{str.unlocked}</p>
                      <p className="text-xl leading-tight font-semibold text-[#203529]">{localizedRecipe.title}</p>
                      <p className="text-sm leading-6 text-[#6f8266]">{localizedRecipe.intro}</p>
                      <button
                        type="button"
                        className="mt-auto border-2 border-[#d8bc76] bg-[#fff6dc] px-4 py-2.5 text-sm font-semibold text-[#7b5b24] shadow-[0_8px_18px_rgba(168,127,43,0.12)] transition hover:bg-[#fff0c6]"
                        onClick={() => setSelectedRecipe(recipe)}
                      >
                        {str.showIngredients}
                      </button>
                    </article>
                  );
                }

                const canAfford = canAffordRecipeUnlock(breakdown.available, recipe);
                const isOpenForUnlocking = Boolean(plainIconPath);

                return (
                  <article key={recipe.id} className={getTileCardClassName("locked")}>
                    <div className={getTileArtClassName("locked")}>
                      <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white/85 text-3xl font-semibold text-gray-500 shadow-inner">?</div>
                    </div>
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{str.locked}</p>
                    <p className="text-xl leading-tight font-semibold text-[#576c58]">{localizedRecipe.title}</p>
                    <p className="text-sm leading-6 text-gray-600">{localizedRecipe.intro}</p>
                    <p className="text-sm leading-6 text-gray-600">
                      {isOpenForUnlocking
                        ? formatWithToken(
                            canAfford ? str.unlockCost : str.notEnoughCoins,
                            "{coins}",
                            String(recipe.unlockCostCoins)
                          )
                        : str.recipeNotOpenYet}
                    </p>
                    <button
                      type="button"
                      className="rounded-md border-2 border-amber-400 bg-amber-100 px-4 py-2 font-medium text-amber-900 disabled:opacity-50"
                      disabled={
                        !isOpenForUnlocking ||
                        !canAfford ||
                        unlockingRecipeId === recipe.id ||
                        !canActOnWallet
                      }
                      onClick={() => void handleUnlock(recipe)}
                    >
                      {unlockingRecipeId === recipe.id ? `${str.unlock}...` : str.unlock}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Cash-out section — child / platform admin only */}
          {canActOnWallet ? (
            <div className="space-y-3 rounded-[1.5rem] border border-[#dcc38a] bg-[linear-gradient(180deg,rgba(255,252,244,0.98),rgba(249,242,224,0.98))] p-5">
              <div>
                <h3 className="font-semibold text-[#7b5b24]">{str.cashOut.sectionTitle}</h3>
                <p className="mt-1 text-sm text-gray-600">{str.cashOut.sectionDescription}</p>
              </div>

              {breakdown.available < 100 ? (
                <p className="text-sm text-gray-500">{str.cashOut.disabledNotEnoughCoins}</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700" htmlFor="cashout-coins">
                      {str.cashOut.coinsLabel}
                    </label>
                    <input
                      id="cashout-coins"
                      type="number"
                      min={100}
                      step={100}
                      max={breakdown.available}
                      value={cashOutCoins}
                      onChange={(e) => setCashOutCoins(e.target.value)}
                      placeholder={str.cashOut.coinsPlaceholder}
                      className="mt-1 w-full max-w-[200px] rounded-md border border-[#d2b15b] bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                    {!isNaN(cashOutCoinsNum) && cashOutCoinsNum > 0 && cashOutCoinsNum % 100 === 0 && cashOutCoinsNum <= breakdown.available ? (
                      <p className="mt-1 text-xs text-green-700">
                        = ${(cashOutCoinsNum / 100).toFixed(2)}
                      </p>
                    ) : null}
                    {cashOutErrors.coins ? (
                      <p className="mt-1 text-xs text-red-600">{cashOutErrors.coins}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700" htmlFor="cashout-note">
                      {str.cashOut.noteLabel}
                    </label>
                    <textarea
                      id="cashout-note"
                      rows={2}
                      maxLength={200}
                      value={cashOutNote}
                      onChange={(e) => setCashOutNote(e.target.value)}
                      placeholder={str.cashOut.notePlaceholder}
                      className="mt-1 w-full max-w-md rounded-md border border-[#d2b15b] bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                    {cashOutErrors.note ? (
                      <p className="mt-1 text-xs text-red-600">{cashOutErrors.note}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700" htmlFor="cashout-signature">
                      {str.cashOut.signatureLabel}
                    </label>
                    <input
                      id="cashout-signature"
                      type="text"
                      value={cashOutSignature}
                      onChange={(e) => setCashOutSignature(e.target.value)}
                      placeholder={str.cashOut.signaturePlaceholder}
                      className="mt-1 w-full max-w-[280px] rounded-md border border-[#d2b15b] bg-white px-3 py-2 text-sm italic text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                    {cashOutErrors.signature ? (
                      <p className="mt-1 text-xs text-red-600">{cashOutErrors.signature}</p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className="rounded-md border-2 border-green-400 bg-green-100 px-5 py-2 text-sm font-semibold text-green-900 transition hover:bg-green-200 disabled:opacity-50"
                    disabled={cashOutStep === "submitting"}
                    onClick={handleCashOutSubmit}
                  >
                    {cashOutStep === "submitting" ? str.cashOut.submitting : str.cashOut.submitButton}
                  </button>
                </div>
              )}

              {/* Redemption history */}
              <div className="pt-2">
                <h4 className="text-sm font-semibold text-[#7b5b24]">{str.redemptionHistory.title}</h4>
                {redemptions.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">{str.redemptionHistory.empty}</p>
                ) : (
                  <div className="mt-2 overflow-x-auto rounded-lg border border-[#e7d2aa] bg-white">
                    <table className="min-w-full text-left text-sm text-gray-700">
                      <thead className="bg-[#f7ead0] text-[#8f5e2c]">
                        <tr>
                          <th className="px-3 py-2 font-semibold">{str.redemptionHistory.headers.date}</th>
                          <th className="px-3 py-2 font-semibold">{str.redemptionHistory.headers.coins}</th>
                          <th className="px-3 py-2 font-semibold">{str.redemptionHistory.headers.dollars}</th>
                          <th className="px-3 py-2 font-semibold">{str.redemptionHistory.headers.note}</th>
                          <th className="px-3 py-2 font-semibold">{str.redemptionHistory.headers.signature}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {redemptions.map((redemption) => (
                          <tr key={redemption.id} className="border-t border-[#f0e2c2]">
                            <td className="px-3 py-2 whitespace-nowrap">{formatShopDateTime(redemption.createdAt, locale)}</td>
                            <td className="px-3 py-2 font-semibold text-[#a24d1f]">-{redemption.coinsRedeemed.toLocaleString()}</td>
                            <td className="px-3 py-2 font-semibold text-green-700">${redemption.dollarValue.toFixed(2)}</td>
                            <td className="px-3 py-2 max-w-[180px] truncate">{redemption.note}</td>
                            <td className="px-3 py-2 italic">{redemption.childSignature}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {selectedRecipe ? (
        <RecipeModal
          recipe={selectedRecipe}
          ingredientRecordsByKey={ingredientRecordsByKey}
          locale={locale}
          strings={str}
          onClose={() => setSelectedRecipe(null)}
        />
      ) : null}

      {isHistoryOpen ? (
        <HistoryModal
          transactions={transactions}
          recipesById={recipesById}
          strings={str}
          locale={locale}
          onClose={() => setIsHistoryOpen(false)}
        />
      ) : null}

      {cashOutStep === "confirm" ? (
        <CashOutConfirmModal
          coins={parseInt(cashOutCoins, 10)}
          note={cashOutNote.trim()}
          signature={cashOutSignature.trim()}
          strings={str}
          onConfirm={() => void handleCashOutConfirm()}
          onCancel={() => setCashOutStep("form")}
        />
      ) : null}
    </section>
  );
}
