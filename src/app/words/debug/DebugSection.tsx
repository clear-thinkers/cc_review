"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import { useLocale } from "@/app/shared/locale";
import { useSession } from "@/lib/authContext";
import { normalizeDebugBulkAddAmount, normalizeDebugIngredientTargetQuantity } from "@/lib/debugIngredientQuantities";
import { SHOP_INGREDIENT_QUANTITY_MAX } from "@/lib/shop";
import type {
  DebugErrorResponse,
  DebugShopIngredientQuantitiesResponse,
  DebugShopIngredientQuantityItem,
  DebugShopIngredientIconAuditItem,
  DebugShopIngredientIconAuditResponse,
  DebugShopRewardIconAuditItem,
  DebugShopRewardIconAuditResponse,
  DebugToolMessage,
} from "./debug.types";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";

export default function DebugSection({ vm }: { vm: WordsWorkspaceVM }): ReactElement | null {
  const { page, str } = vm;
  const s = str.debug;
  const session = useSession();
  const [cleanupResult, setCleanupResult] = useState<DebugToolMessage | null>(null);
  const [ingredientIconAuditResult, setIngredientIconAuditResult] =
    useState<DebugToolMessage | null>(null);
  const [ingredientIconAudit, setIngredientIconAudit] =
    useState<DebugShopIngredientIconAuditResponse | null>(null);
  const [ingredientIconActionNotice, setIngredientIconActionNotice] =
    useState<DebugToolMessage | null>(null);
  const [rewardIconAuditResult, setRewardIconAuditResult] =
    useState<DebugToolMessage | null>(null);
  const [rewardIconAudit, setRewardIconAudit] =
    useState<DebugShopRewardIconAuditResponse | null>(null);
  const [rewardIconActionNotice, setRewardIconActionNotice] =
    useState<DebugToolMessage | null>(null);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [runningIngredientIconAudit, setRunningIngredientIconAudit] = useState(false);
  const [runningRewardIconAudit, setRunningRewardIconAudit] = useState(false);
  const [editingIngredientKey, setEditingIngredientKey] = useState<string | null>(null);
  const [editingIngredientIconPath, setEditingIngredientIconPath] = useState("");
  const [savingIngredientKey, setSavingIngredientKey] = useState<string | null>(null);
  const [editingRewardRuleKey, setEditingRewardRuleKey] = useState<string | null>(null);
  const [editingRewardIconPath, setEditingRewardIconPath] = useState("");
  const [savingRewardRuleKey, setSavingRewardRuleKey] = useState<string | null>(null);
  const [creatingRewardIconPath, setCreatingRewardIconPath] = useState<string | null>(null);
  const [creatingRewardRecipeId, setCreatingRewardRecipeId] = useState("");
  const [creatingRewardMatchInput, setCreatingRewardMatchInput] = useState("");
  const locale = useLocale();
  const [quantityItems, setQuantityItems] = useState<DebugShopIngredientQuantityItem[] | null>(null);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [quantityFilter, setQuantityFilter] = useState("");
  const [quantityMysteryOnly, setQuantityMysteryOnly] = useState(false);
  const [loadingQuantities, setLoadingQuantities] = useState(false);
  const [savingQuantityKey, setSavingQuantityKey] = useState<string | null>(null);
  const [quantityNotice, setQuantityNotice] = useState<DebugToolMessage | null>(null);
  const [bulkAddAmount, setBulkAddAmount] = useState("10");
  const [bulkAdding, setBulkAdding] = useState(false);

  if (page !== "debug") return null;

  function applyQuantityResponse(json: DebugShopIngredientQuantitiesResponse): void {
    setQuantityItems(json.items);
    setQuantityDrafts(Object.fromEntries(json.items.map((item) => [item.key, String(item.quantity)])));
  }

  async function requestQuantities(init?: RequestInit): Promise<DebugShopIngredientQuantitiesResponse> {
    const accessToken = session?.supabaseSession.access_token;
    if (!accessToken) throw new Error(s.ingredientIconsAuthRequired);
    const response = await fetch("/api/debug/shop-ingredient-quantities", {
      ...init,
      headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${accessToken}` },
    });
    const json = (await response.json()) as DebugShopIngredientQuantitiesResponse | DebugErrorResponse;
    if (!response.ok || !("items" in json) || !Array.isArray(json.items)) {
      throw new Error("error" in json ? json.error || str.common.error : str.common.error);
    }
    return json;
  }

  async function handleLoadQuantities(): Promise<void> {
    setLoadingQuantities(true);
    setQuantityNotice(null);
    try {
      const json = await requestQuantities();
      applyQuantityResponse(json);
      setQuantityNotice({ tone: "success", text: s.ingredientQtyLoaded(json.items.length) });
    } catch (error) {
      setQuantityNotice({
        tone: "error",
        text: s.ingredientQtyError(error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setLoadingQuantities(false);
    }
  }

  async function handleSaveQuantity(item: DebugShopIngredientQuantityItem): Promise<void> {
    const quantity = normalizeDebugIngredientTargetQuantity(quantityDrafts[item.key] ?? "");
    if (quantity === null) {
      setQuantityNotice({ tone: "error", text: s.ingredientQtyInvalid(SHOP_INGREDIENT_QUANTITY_MAX) });
      return;
    }

    setSavingQuantityKey(item.key);
    setQuantityNotice(null);
    try {
      const json = await requestQuantities({
        method: "PATCH",
        body: JSON.stringify({ ingredientKey: item.key, quantity }),
      });
      applyQuantityResponse(json);
      const saved = s.ingredientQtySaved(item.label[locale], quantity);
      const unlocked = (json.unlockedRecipes ?? []).map((recipe) => recipe.title[locale]);
      setQuantityNotice({
        tone: "success",
        text: unlocked.length > 0 ? `${saved} ${s.ingredientQtyUnlocked(unlocked.join(", "))}` : saved,
      });
    } catch (error) {
      setQuantityNotice({
        tone: "error",
        text: s.ingredientQtyError(error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setSavingQuantityKey(null);
    }
  }

  // Adds the same amount to every ingredient the filter is showing (all of them when unfiltered).
  async function handleBulkAdd(): Promise<void> {
    const amount = normalizeDebugBulkAddAmount(bulkAddAmount);
    if (amount === null) {
      setQuantityNotice({ tone: "error", text: s.ingredientQtyBulkInvalid(SHOP_INGREDIENT_QUANTITY_MAX) });
      return;
    }

    setBulkAdding(true);
    setQuantityNotice(null);
    try {
      const json = await requestQuantities({
        method: "PATCH",
        body: JSON.stringify({ addToKeys: visibleQuantityItems.map((item) => item.key), amount }),
      });
      applyQuantityResponse(json);
      const parts = [s.ingredientQtyBulkDone(amount, json.bulk?.changedCount ?? 0)];
      if (json.bulk && json.bulk.skippedKeys.length > 0) parts.push(s.ingredientQtyBulkSkipped(json.bulk.skippedKeys.join(", ")));
      const unlocked = (json.unlockedRecipes ?? []).map((recipe) => recipe.title[locale]);
      if (unlocked.length > 0) parts.push(s.ingredientQtyUnlocked(unlocked.join(", ")));
      setQuantityNotice({ tone: "success", text: parts.join(" ") });
    } catch (error) {
      setQuantityNotice({
        tone: "error",
        text: s.ingredientQtyError(error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setBulkAdding(false);
    }
  }

  const normalizedQuantityFilter = quantityFilter.trim().toLowerCase();
  const visibleQuantityItems = (quantityItems ?? []).filter(
    (item) =>
      (!quantityMysteryOnly || item.isMystery) &&
      (normalizedQuantityFilter === "" ||
        [item.key, item.label.en, item.label.zh].some((text) => text.toLowerCase().includes(normalizedQuantityFilter)))
  );

  function getIngredientIconAuditStatusLabel(
    item: DebugShopIngredientIconAuditItem
  ): string {
    if (item.iconPath === null) {
      return s.ingredientIconsStatus.noIcon;
    }

    return item.exists ? s.ingredientIconsStatus.present : s.ingredientIconsStatus.missing;
  }

  function getRewardIconAuditStatusLabel(item: DebugShopRewardIconAuditItem): string {
    if (item.filePath === null) {
      return s.rewardIconsStatus.invalidPath;
    }

    return item.exists ? s.rewardIconsStatus.present : s.rewardIconsStatus.missing;
  }

  function buildIngredientAuditSummary(
    audit: DebugShopIngredientIconAuditResponse
  ): DebugToolMessage {
    const iconBackedCount = audit.items.filter((item) => item.iconPath !== null).length;
    return {
      tone: audit.missingItems.length === 0 ? "success" : "error",
      text:
        audit.missingItems.length === 0
          ? s.ingredientIconsAllPresent(iconBackedCount)
          : s.ingredientIconsMissing(audit.missingItems.length, iconBackedCount),
    };
  }

  function getRewardRuleKey(item: DebugShopRewardIconAuditItem): string {
    return `${item.recipeId}:${item.ruleIndex}`;
  }

  function buildRewardAuditSummary(
    audit: DebugShopRewardIconAuditResponse
  ): DebugToolMessage {
    if (audit.missingItems.length > 0 && audit.unreferencedItems.length > 0) {
      return {
        tone: "error",
        text: s.rewardIconsMixedSummary(
          audit.missingItems.length,
          audit.items.length,
          audit.unreferencedItems.length
        ),
      };
    }

    if (audit.missingItems.length > 0) {
      return {
        tone: "error",
        text: s.rewardIconsMissing(audit.missingItems.length, audit.items.length),
      };
    }

    if (audit.unreferencedItems.length > 0) {
      return {
        tone: "error",
        text: s.rewardIconsUnreferenced(audit.unreferencedItems.length),
      };
    }

    return {
      tone: "success",
      text: s.rewardIconsAllPresent(audit.items.length),
    };
  }

  function resetRewardCreateState(): void {
    setCreatingRewardIconPath(null);
    setCreatingRewardRecipeId("");
    setCreatingRewardMatchInput("");
  }

  async function handleCleanOrphanedContent(): Promise<void> {
    setRunningCleanup(true);
    setCleanupResult(null);
    try {
      const {
        getAllFlashcardContents,
        deleteFlashcardContentByHanzi,
        getAllWords,
      } = await import("@/lib/supabase-service");

      const [words, contents] = await Promise.all([
        getAllWords(),
        getAllFlashcardContents(),
      ]);

      const validHanziSet = new Set(words.map((w) => w.hanzi));
      const orphans = contents.filter((c) => !validHanziSet.has(c.character));

      if (orphans.length === 0) {
        setCleanupResult({ tone: "success", text: s.noOrphans });
        return;
      }

      const chars = orphans.map((o) => o.character).join(", ");
      const confirmed = window.confirm(s.confirmOrphans(orphans.length, chars));
      if (!confirmed) {
        setCleanupResult({ tone: "success", text: s.cancelled });
        return;
      }

      await Promise.all(
        [...new Set(orphans.map((o) => o.character))].map((hanzi) =>
          deleteFlashcardContentByHanzi(hanzi)
        )
      );

      setCleanupResult({
        tone: "success",
        text: s.deleted(orphans.length, chars),
      });
    } catch (err) {
      setCleanupResult({
        tone: "error",
        text: s.error(err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setRunningCleanup(false);
    }
  }

  async function handleIngredientIconAudit(): Promise<void> {
    const accessToken = session?.supabaseSession.access_token;
    if (!accessToken) {
      setIngredientIconAuditResult({
        tone: "error",
        text: s.ingredientIconsAuthRequired,
      });
      return;
    }

    setRunningIngredientIconAudit(true);
    setIngredientIconAuditResult(null);
    setIngredientIconActionNotice(null);
    setEditingIngredientKey(null);
    setEditingIngredientIconPath("");
    try {
      const response = await fetch("/api/debug/shop-ingredient-icons", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const json = (await response.json()) as
        | DebugShopIngredientIconAuditResponse
        | DebugErrorResponse;

      if (!response.ok || !("items" in json) || !Array.isArray(json.items)) {
        throw new Error("error" in json ? json.error || str.common.error : str.common.error);
      }

      setIngredientIconAudit(json);
      setIngredientIconAuditResult(buildIngredientAuditSummary(json));
      setIngredientIconActionNotice(null);
    } catch (error) {
      setIngredientIconAudit(null);
      setIngredientIconAuditResult({
        tone: "error",
        text: s.ingredientIconsError(
          error instanceof Error ? error.message : String(error)
        ),
      });
    } finally {
      setRunningIngredientIconAudit(false);
    }
  }

  async function handleIngredientIconAction(params: {
    action: "update_path" | "clear_path";
    item: DebugShopIngredientIconAuditItem;
    iconPath?: string;
  }): Promise<void> {
    const accessToken = session?.supabaseSession.access_token;
    if (!accessToken) {
      setIngredientIconActionNotice({
        tone: "error",
        text: s.ingredientIconsAuthRequired,
      });
      return;
    }

    setSavingIngredientKey(params.item.key);
    setIngredientIconActionNotice(null);
    try {
      const response = await fetch("/api/debug/shop-ingredient-icons", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: params.action,
          ingredientKey: params.item.key,
          ...(params.action === "update_path"
            ? { iconPath: params.iconPath ?? editingIngredientIconPath }
            : {}),
        }),
      });
      const json = (await response.json()) as
        | DebugShopIngredientIconAuditResponse
        | DebugErrorResponse;

      if (!response.ok || !("items" in json) || !Array.isArray(json.items)) {
        throw new Error("error" in json ? json.error || str.common.error : str.common.error);
      }

      setIngredientIconAudit(json);
      setIngredientIconAuditResult(buildIngredientAuditSummary(json));
      setIngredientIconActionNotice({
        tone: "success",
        text:
          params.action === "update_path"
            ? s.ingredientIconsPathSaved
            : s.ingredientIconsRowDeleted,
      });
      setEditingIngredientKey(null);
      setEditingIngredientIconPath("");
    } catch (error) {
      setIngredientIconActionNotice({
        tone: "error",
        text: s.ingredientIconsActionError(
          error instanceof Error ? error.message : String(error)
        ),
      });
    } finally {
      setSavingIngredientKey(null);
    }
  }

  async function handleRewardIconAudit(): Promise<void> {
    const accessToken = session?.supabaseSession.access_token;
    if (!accessToken) {
      setRewardIconAuditResult({
        tone: "error",
        text: s.rewardIconsAuthRequired,
      });
      return;
    }

    setRunningRewardIconAudit(true);
    setRewardIconAuditResult(null);
    setRewardIconActionNotice(null);
    try {
      const response = await fetch("/api/debug/shop-reward-icons", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const json = (await response.json()) as
        | DebugShopRewardIconAuditResponse
        | DebugErrorResponse;

      if (!response.ok || !("items" in json) || !Array.isArray(json.items)) {
        throw new Error("error" in json ? json.error || str.common.error : str.common.error);
      }

      setRewardIconAudit(json);
      setRewardIconAuditResult(buildRewardAuditSummary(json));
    } catch (error) {
      setRewardIconAudit(null);
      setRewardIconAuditResult({
        tone: "error",
        text: s.rewardIconsError(
          error instanceof Error ? error.message : String(error)
        ),
      });
    } finally {
      setRunningRewardIconAudit(false);
    }
  }

  async function handleRewardIconAction(params: {
    action: "update_path" | "delete_rule";
    item: DebugShopRewardIconAuditItem;
    iconPath?: string;
  }): Promise<void> {
    const accessToken = session?.supabaseSession.access_token;
    if (!accessToken) {
      setRewardIconActionNotice({
        tone: "error",
        text: s.rewardIconsAuthRequired,
      });
      return;
    }

    const rowKey = getRewardRuleKey(params.item);
    setSavingRewardRuleKey(rowKey);
    setRewardIconActionNotice(null);
    try {
      const response = await fetch("/api/debug/shop-reward-icons", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: params.action,
          recipeId: params.item.recipeId,
          ruleIndex: params.item.ruleIndex,
          ...(params.action === "update_path"
            ? { iconPath: params.iconPath ?? editingRewardIconPath }
            : {}),
        }),
      });
      const json = (await response.json()) as
        | DebugShopRewardIconAuditResponse
        | DebugErrorResponse;

      if (!response.ok || !("items" in json) || !Array.isArray(json.items)) {
        throw new Error("error" in json ? json.error || str.common.error : str.common.error);
      }

      setRewardIconAudit(json);
      setRewardIconAuditResult(buildRewardAuditSummary(json));
      setRewardIconActionNotice({
        tone: "success",
        text:
          params.action === "update_path"
            ? s.rewardIconsPathSaved
            : s.rewardIconsRuleDeleted,
      });
      setEditingRewardRuleKey(null);
      setEditingRewardIconPath("");
      resetRewardCreateState();
    } catch (error) {
      setRewardIconActionNotice({
        tone: "error",
        text: s.rewardIconsActionError(
          error instanceof Error ? error.message : String(error)
        ),
      });
    } finally {
      setSavingRewardRuleKey(null);
    }
  }

  async function handleCreateRewardRule(iconPath: string): Promise<void> {
    const accessToken = session?.supabaseSession.access_token;
    if (!accessToken) {
      setRewardIconActionNotice({
        tone: "error",
        text: s.rewardIconsAuthRequired,
      });
      return;
    }

    setSavingRewardRuleKey(iconPath);
    setRewardIconActionNotice(null);
    try {
      const response = await fetch("/api/debug/shop-reward-icons", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: "create_rule",
          recipeId: creatingRewardRecipeId,
          iconPath,
          match: creatingRewardMatchInput,
        }),
      });
      const json = (await response.json()) as
        | DebugShopRewardIconAuditResponse
        | DebugErrorResponse;

      if (!response.ok || !("items" in json) || !Array.isArray(json.items)) {
        throw new Error("error" in json ? json.error || str.common.error : str.common.error);
      }

      setRewardIconAudit(json);
      setRewardIconAuditResult(buildRewardAuditSummary(json));
      setRewardIconActionNotice({
        tone: "success",
        text: s.rewardIconsRuleCreated,
      });
      resetRewardCreateState();
    } catch (error) {
      setRewardIconActionNotice({
        tone: "error",
        text: s.rewardIconsActionError(
          error instanceof Error ? error.message : String(error)
        ),
      });
    } finally {
      setSavingRewardRuleKey(null);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h2 className="font-medium">{s.pageTitle}</h2>
      <p className="text-sm text-gray-700">{s.pageDescription}</p>

      <div className="space-y-3">
        <div className="rounded-md border p-3">
          <h3 className="text-sm font-medium">{s.ingredientQtyTitle}</h3>
          <p className="mt-1 text-sm text-gray-600">{s.ingredientQtyDescription}</p>
          <button
            type="button"
            disabled={loadingQuantities}
            onClick={() => void handleLoadQuantities()}
            className="mt-3 rounded-md border-2 px-4 py-2 font-medium btn-secondary disabled:opacity-50"
          >
            {loadingQuantities ? s.ingredientQtyLoading : s.ingredientQtyLoadButton}
          </button>

          {quantityNotice ? (
            <p
              className={`mt-3 text-sm ${quantityNotice.tone === "error" ? "text-red-700" : "text-blue-700"}`}
            >
              {quantityNotice.text}
            </p>
          ) : quantityItems === null ? (
            <p className="mt-3 text-sm text-gray-600">{s.ingredientQtyIdle}</p>
          ) : null}

          {quantityItems ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <span>{s.ingredientQtyFilterLabel}</span>
                  <input
                    type="text"
                    value={quantityFilter}
                    placeholder={s.ingredientQtyFilterPlaceholder}
                    onChange={(event) => setQuantityFilter(event.target.value)}
                    className="rounded-md border px-2 py-1"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={quantityMysteryOnly}
                    onChange={(event) => setQuantityMysteryOnly(event.target.checked)}
                  />
                  <span>{s.ingredientQtyMysteryOnly}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span>{s.ingredientQtyBulkLabel}</span>
                  <input
                    type="number"
                    min={1}
                    max={SHOP_INGREDIENT_QUANTITY_MAX}
                    value={bulkAddAmount}
                    onChange={(event) => setBulkAddAmount(event.target.value)}
                    className="w-20 rounded-md border px-2 py-1"
                  />
                </label>
                <button
                  type="button"
                  title={s.ingredientQtyBulkTooltip}
                  disabled={bulkAdding || savingQuantityKey !== null || visibleQuantityItems.length === 0}
                  onClick={() => void handleBulkAdd()}
                  className="rounded border-2 px-3 py-1 text-sm font-medium btn-primary disabled:opacity-50"
                >
                  {bulkAdding ? s.ingredientQtyBulkAdding : s.ingredientQtyBulkButton(visibleQuantityItems.length)}
                </button>
              </div>

              <div className="mt-3 max-h-96 overflow-auto rounded-md border">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 border-b bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{s.ingredientQtyTable.ingredient}</th>
                      <th className="px-3 py-2 text-left font-medium">{s.ingredientQtyTable.ingredientKey}</th>
                      <th className="px-3 py-2 text-left font-medium">{s.ingredientQtyTable.quantity}</th>
                      <th className="px-3 py-2 text-left font-medium">{s.ingredientQtyTable.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleQuantityItems.map((item) => (
                      <tr key={item.key} className="border-b align-middle">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {item.iconPath ? (
                              <img src={item.iconPath} alt="" className="h-8 w-8 object-contain" />
                            ) : null}
                            <div>
                              <div className="font-medium text-gray-900">
                                {item.label.en}
                                {item.isMystery ? (
                                  <span className="ml-2 rounded border border-amber-400 bg-amber-100 px-1 text-[11px] font-medium text-amber-900">
                                    {s.ingredientQtyMysteryBadge}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-xs text-gray-500">{item.label.zh}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">{item.key}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            max={SHOP_INGREDIENT_QUANTITY_MAX}
                            step={1}
                            value={quantityDrafts[item.key] ?? ""}
                            onChange={(event) =>
                              setQuantityDrafts((current) => ({ ...current, [item.key]: event.target.value }))
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") void handleSaveQuantity(item);
                            }}
                            aria-label={`${s.ingredientQtyTable.quantity}: ${item.label[locale]}`}
                            className="w-20 rounded-md border px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            title={s.ingredientQtySaveTooltip}
                            disabled={
                              savingQuantityKey !== null || quantityDrafts[item.key] === String(item.quantity)
                            }
                            onClick={() => void handleSaveQuantity(item)}
                            className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-primary disabled:opacity-50"
                          >
                            {savingQuantityKey === item.key ? s.ingredientQtySaving : s.ingredientQtySave}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        <div className="rounded-md border p-3">
          <h3 className="text-sm font-medium">{s.cleanOrphanedTitle}</h3>
          <p className="mt-1 text-sm text-gray-600">{s.cleanOrphanedDescription}</p>
          <button
            type="button"
            title={s.cleanOrphanedTooltip}
            disabled={runningCleanup}
            onClick={handleCleanOrphanedContent}
            className="mt-3 rounded-md border-2 px-4 py-2 font-medium btn-destructive disabled:opacity-50"
          >
            {runningCleanup ? s.running : s.runCleanup}
          </button>
          {cleanupResult ? (
            <p
              className={`mt-3 text-sm ${
                cleanupResult.tone === "error" ? "text-red-700" : "text-blue-700"
              }`}
            >
              {cleanupResult.text}
            </p>
          ) : null}
        </div>

        <div className="rounded-md border p-3">
          <h3 className="text-sm font-medium">{s.ingredientIconsTitle}</h3>
          <p className="mt-1 text-sm text-gray-600">{s.ingredientIconsDescription}</p>
          <button
            type="button"
            title={s.ingredientIconsTooltip}
            disabled={runningIngredientIconAudit}
            onClick={() => void handleIngredientIconAudit()}
            className="mt-3 rounded-md border-2 px-4 py-2 font-medium btn-caution disabled:opacity-50"
          >
            {runningIngredientIconAudit
              ? s.ingredientIconsRunning
              : s.ingredientIconsButton}
          </button>

          {ingredientIconAuditResult ? (
            <p
              className={`mt-3 text-sm ${
                ingredientIconAuditResult.tone === "error"
                  ? "text-red-700"
                  : "text-blue-700"
              }`}
            >
              {ingredientIconAuditResult.text}
            </p>
          ) : (
            <p className="mt-3 text-sm text-gray-600">{s.ingredientIconsIdle}</p>
          )}

          <p className="mt-2 text-sm text-gray-600">{s.ingredientIconsPickerHint}</p>
          {ingredientIconActionNotice ? (
            <p
              className={`mt-3 text-sm ${
                ingredientIconActionNotice.tone === "error"
                  ? "text-red-700"
                  : "text-blue-700"
              }`}
            >
              {ingredientIconActionNotice.text}
            </p>
          ) : null}

          {ingredientIconAudit ? (
            <div className="mt-4 overflow-x-auto rounded-md border">
              <table className="min-w-full table-fixed border-collapse text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">
                      {s.ingredientIconsTable.ingredient}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {s.ingredientIconsTable.ingredientKey}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {s.ingredientIconsTable.status}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {s.ingredientIconsTable.iconPath}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {s.ingredientIconsTable.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ingredientIconAudit.items.map((item) => (
                    <tr key={item.key} className="border-b align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{item.label.en}</div>
                        <div className="text-xs text-gray-500">{item.label.zh}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">{item.key}</td>
                      <td
                        className={`px-3 py-2 ${
                          item.iconPath !== null && item.exists === false
                            ? "font-medium text-red-700"
                            : "text-gray-700"
                        }`}
                      >
                        {getIngredientIconAuditStatusLabel(item)}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {item.iconPath ?? s.ingredientIconsStatus.noIcon}
                      </td>
                      <td className="px-3 py-2">
                        {!item.hasPriceRow ? (
                          <span className="text-xs text-gray-500">
                            {s.ingredientIconsNoDirectAction}
                          </span>
                        ) : editingIngredientKey === item.key ? (
                          <div className="space-y-2">
                            <label className="block">
                              <span className="text-xs text-gray-500">
                                {s.ingredientIconsPathLabel}
                              </span>
                              <input
                                value={editingIngredientIconPath}
                                onChange={(event) =>
                                  setEditingIngredientIconPath(event.target.value)
                                }
                                list="ingredient-icon-path-options"
                                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                title={s.ingredientIconsTooltips.save}
                                disabled={savingIngredientKey === item.key}
                                onClick={() =>
                                  void handleIngredientIconAction({
                                    action: "update_path",
                                    item,
                                  })
                                }
                                className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-primary disabled:opacity-50"
                              >
                                {savingIngredientKey === item.key
                                  ? s.ingredientIconsActionSaving
                                  : s.ingredientIconsActions.save}
                              </button>
                              <button
                                type="button"
                                title={s.ingredientIconsTooltips.cancel}
                                disabled={savingIngredientKey === item.key}
                                onClick={() => {
                                  setEditingIngredientKey(null);
                                  setEditingIngredientIconPath("");
                                }}
                                className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-neutral disabled:opacity-50"
                              >
                                {s.ingredientIconsActions.cancel}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              title={s.ingredientIconsTooltips.edit}
                              onClick={() => {
                                setEditingIngredientKey(item.key);
                                setEditingIngredientIconPath(item.iconPath ?? "");
                                setIngredientIconActionNotice(null);
                              }}
                              className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-secondary"
                            >
                              {s.ingredientIconsActions.edit}
                            </button>
                            {item.iconPath !== null && item.exists === false ? (
                              <button
                                type="button"
                                title={s.ingredientIconsTooltips.delete}
                                disabled={savingIngredientKey === item.key}
                                onClick={() =>
                                  void handleIngredientIconAction({
                                    action: "clear_path",
                                    item,
                                  })
                                }
                                className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-destructive disabled:opacity-50"
                              >
                                {savingIngredientKey === item.key
                                  ? s.ingredientIconsActionSaving
                                  : s.ingredientIconsActions.delete}
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <datalist id="ingredient-icon-path-options">
            {(ingredientIconAudit?.availableIconPaths ?? []).map((iconPath) => (
              <option key={iconPath} value={iconPath} />
            ))}
          </datalist>
        </div>

        <div className="rounded-md border p-3">
          <h3 className="text-sm font-medium">{s.rewardIconsTitle}</h3>
          <p className="mt-1 text-sm text-gray-600">{s.rewardIconsDescription}</p>
          <button
            type="button"
            title={s.rewardIconsTooltip}
            disabled={runningRewardIconAudit}
            onClick={() => void handleRewardIconAudit()}
            className="mt-3 rounded-md border-2 px-4 py-2 font-medium btn-secondary disabled:opacity-50"
          >
            {runningRewardIconAudit ? s.rewardIconsRunning : s.rewardIconsButton}
          </button>

          {rewardIconAuditResult ? (
            <p
              className={`mt-3 text-sm ${
                rewardIconAuditResult.tone === "error"
                  ? "text-red-700"
                  : "text-blue-700"
              }`}
            >
              {rewardIconAuditResult.text}
            </p>
          ) : (
            <p className="mt-3 text-sm text-gray-600">{s.rewardIconsIdle}</p>
          )}
          <p className="mt-2 text-sm text-gray-600">{s.rewardIconsPickerHint}</p>
          {rewardIconActionNotice ? (
            <p
              className={`mt-3 text-sm ${
                rewardIconActionNotice.tone === "error"
                  ? "text-red-700"
                  : "text-blue-700"
              }`}
            >
              {rewardIconActionNotice.text}
            </p>
          ) : null}

          {rewardIconAudit ? (
            <div className="mt-4 overflow-x-auto rounded-md border">
              <table className="min-w-full table-fixed border-collapse text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">
                      {s.rewardIconsTable.recipe}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {s.rewardIconsTable.match}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {s.rewardIconsTable.status}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {s.rewardIconsTable.iconPath}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {s.rewardIconsTable.filePath}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {s.rewardIconsTable.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rewardIconAudit.items.map((item) => (
                    <tr
                      key={`${item.recipeId}-${item.ruleIndex}-${item.iconPath}-${item.match.join("+")}`}
                      className="border-b align-top"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{item.recipeTitle.en}</div>
                        <div className="text-xs text-gray-500">{item.recipeSlug}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {item.match.length > 0
                          ? item.match.join(", ")
                          : s.rewardIconsStatus.matchAll}
                      </td>
                      <td
                        className={`px-3 py-2 ${
                          item.exists === false || item.filePath === null
                            ? "font-medium text-red-700"
                            : "text-gray-700"
                        }`}
                      >
                        {getRewardIconAuditStatusLabel(item)}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{item.iconPath}</td>
                      <td className="px-3 py-2 break-all text-xs text-gray-600">
                        {item.filePath ?? s.rewardIconsStatus.invalidPath}
                      </td>
                      <td className="px-3 py-2">
                        {editingRewardRuleKey === getRewardRuleKey(item) ? (
                          <div className="space-y-2">
                            <label className="block">
                              <span className="text-xs text-gray-500">
                                {s.rewardIconsPathLabel}
                              </span>
                              <input
                                value={editingRewardIconPath}
                                onChange={(event) =>
                                  setEditingRewardIconPath(event.target.value)
                                }
                                list="reward-icon-path-options"
                                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                title={s.rewardIconsTooltips.save}
                                disabled={savingRewardRuleKey === getRewardRuleKey(item)}
                                onClick={() =>
                                  void handleRewardIconAction({
                                    action: "update_path",
                                    item,
                                  })
                                }
                                className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-primary disabled:opacity-50"
                              >
                                {savingRewardRuleKey === getRewardRuleKey(item)
                                  ? s.rewardIconsActionSaving
                                  : s.rewardIconsActions.save}
                              </button>
                              <button
                                type="button"
                                title={s.rewardIconsTooltips.cancel}
                                disabled={savingRewardRuleKey === getRewardRuleKey(item)}
                                onClick={() => {
                                  setEditingRewardRuleKey(null);
                                  setEditingRewardIconPath("");
                                }}
                                className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-neutral disabled:opacity-50"
                              >
                                {s.rewardIconsActions.cancel}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              title={s.rewardIconsTooltips.edit}
                              onClick={() => {
                                setEditingRewardRuleKey(getRewardRuleKey(item));
                                setEditingRewardIconPath(item.iconPath);
                                setRewardIconActionNotice(null);
                              }}
                              className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-secondary"
                            >
                              {s.rewardIconsActions.edit}
                            </button>
                            {item.exists === false || item.filePath === null ? (
                              <button
                                type="button"
                                title={s.rewardIconsTooltips.delete}
                                disabled={savingRewardRuleKey === getRewardRuleKey(item)}
                                onClick={() =>
                                  void handleRewardIconAction({
                                    action: "delete_rule",
                                    item,
                                  })
                                }
                                className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-destructive disabled:opacity-50"
                              >
                                {savingRewardRuleKey === getRewardRuleKey(item)
                                  ? s.rewardIconsActionSaving
                                  : s.rewardIconsActions.delete}
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rewardIconAudit.unreferencedItems.map((item) => (
                    <tr
                      key={`unreferenced-${item.iconPath}`}
                      className="border-b align-top"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">
                          {s.rewardIconsStatus.unreferenced}
                        </div>
                        <div className="text-xs text-gray-500">public/rewards</div>
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {s.rewardIconsStatus.unreferenced}
                      </td>
                      <td className="px-3 py-2 font-medium text-red-700">
                        {s.rewardIconsStatus.unreferenced}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{item.iconPath}</td>
                      <td className="px-3 py-2 break-all text-xs text-gray-600">
                        {item.filePath ?? s.rewardIconsStatus.invalidPath}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {creatingRewardIconPath === item.iconPath ? (
                          <div className="space-y-2">
                            <label className="block">
                              <span className="text-xs text-gray-500">
                                {s.rewardIconsRecipeLabel}
                              </span>
                              <select
                                value={creatingRewardRecipeId}
                                onChange={(event) =>
                                  setCreatingRewardRecipeId(event.target.value)
                                }
                                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                              >
                                <option value="">{s.rewardIconsRecipePlaceholder}</option>
                                {rewardIconAudit.recipeOptions.map((recipe) => (
                                  <option key={recipe.recipeId} value={recipe.recipeId}>
                                    {recipe.recipeTitle.en}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="text-xs text-gray-500">
                                {s.rewardIconsMatchLabel}
                              </span>
                              <input
                                value={creatingRewardMatchInput}
                                onChange={(event) =>
                                  setCreatingRewardMatchInput(event.target.value)
                                }
                                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                                placeholder={s.rewardIconsMatchPlaceholder}
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                title={s.rewardIconsTooltips.create}
                                disabled={
                                  savingRewardRuleKey === item.iconPath ||
                                  !creatingRewardRecipeId.trim()
                                }
                                onClick={() => void handleCreateRewardRule(item.iconPath)}
                                className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-primary disabled:opacity-50"
                              >
                                {savingRewardRuleKey === item.iconPath
                                  ? s.rewardIconsActionSaving
                                  : s.rewardIconsActions.create}
                              </button>
                              <button
                                type="button"
                                title={s.rewardIconsTooltips.cancel}
                                disabled={savingRewardRuleKey === item.iconPath}
                                onClick={resetRewardCreateState}
                                className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-neutral disabled:opacity-50"
                              >
                                {s.rewardIconsActions.cancel}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            title={s.rewardIconsTooltips.create}
                            onClick={() => {
                              setCreatingRewardIconPath(item.iconPath);
                              setCreatingRewardRecipeId("");
                              setCreatingRewardMatchInput("");
                              setRewardIconActionNotice(null);
                            }}
                            className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-primary"
                          >
                            {s.rewardIconsActions.create}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="reward-icon-path-options">
                {rewardIconAudit.availableIconPaths.map((iconPath) => (
                  <option key={iconPath} value={iconPath} />
                ))}
              </datalist>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
