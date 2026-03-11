"use client";

import { useMemo, memo, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/authContext";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import type { WordsLocaleStrings } from "../shared/words.shared.types";
import type {
  AdminTableRenderRow,
  AdminTableRow,
  AdminTarget,
} from "./admin.types";
import { renderPhraseWithPinyin, renderSentenceWithPinyin, formatDateTime } from "../shared/words.shared.utils";
import {
  setWordContentReadyById,
} from "@/lib/supabase-service";

// Derived content readiness status for a single admin target.
// - pending: no flashcard_contents row saved yet
// - saved:   content is saved but word not yet approved (content_status = 'pending')
// - ready:   word has been approved (content_status = 'ready')
type AdminTargetApprovalStatus = "pending" | "saved" | "ready";

// ---------------------------------------------------------------------------
// Memoised table row â€” prevents re-render when only URL filter params change.
// React.memo does a shallow prop comparison; all handler props come from the
// vm object which is stable when only searchParams change (WordsWorkspace does
// not re-render on URL changes), so bailed-out rows skip renderPhraseWithPinyin
// and renderSentenceWithPinyin entirely.
// ---------------------------------------------------------------------------

type AdminTableRowComponentProps = {
  row: AdminTableRenderRow;
  target: AdminTarget | undefined;
  rawValue: string;
  isRegenerating: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  adminPreloading: boolean;
  isEditingThis: boolean;
  isPlatformAdmin: boolean;
  approvalStatus: AdminTargetApprovalStatus;
  canApprove: boolean;
  str: WordsLocaleStrings;
  onRegenerate: (target: AdminTarget) => void;
  onSave: (target: AdminTarget) => void;
  onApprove: (target: AdminTarget) => void;
  onDeleteTarget: (target: AdminTarget) => void;
  onAddMeaningRow: (targetKey: string) => void;
  onUpdatePendingMeaningInput: (
    pendingId: string,
    field: "meaningZhInput" | "phraseInput" | "exampleInput",
    value: string
  ) => void;
  onSavePendingMeaning: (row: AdminTableRow) => void;
  onRemovePendingMeaning: (pendingId: string) => void;
  onAddPhraseRow: (targetKey: string, meaningZh: string, meaningEn: string) => void;
  onUpdatePendingPhraseInput: (pendingId: string, value: string) => void;
  onSavePendingPhrase: (row: AdminTableRow) => void;
  onRemovePendingPhrase: (pendingId: string) => void;
  onToggleFillTestInclude: (row: AdminTableRow, include: boolean) => void;
  onRegeneratePhrase: (row: AdminTableRow) => void;
  onDeletePhrase: (row: AdminTableRow) => void;
  onInlineEditExample: (row: AdminTableRow, value: string) => void;
  onRegenerateExample: (row: AdminTableRow) => void;
  onEditExample: (row: AdminTableRow) => void;
  onDeleteExample: (row: AdminTableRow) => void;
};

const AdminTableRowComponent = memo(function AdminTableRowComponent({
  row,
  target,
  rawValue,
  isRegenerating,
  isSaving,
  isDeleting,
  adminPreloading,
  isEditingThis,
  isPlatformAdmin,
  approvalStatus,
  canApprove,
  str,
  onRegenerate,
  onSave,
  onApprove,
  onDeleteTarget,
  onAddMeaningRow,
  onUpdatePendingMeaningInput,
  onSavePendingMeaning,
  onRemovePendingMeaning,
  onAddPhraseRow,
  onUpdatePendingPhraseInput,
  onSavePendingPhrase,
  onRemovePendingPhrase,
  onToggleFillTestInclude,
  onRegeneratePhrase,
  onDeletePhrase,
  onInlineEditExample,
  onRegenerateExample,
  onEditExample,
  onDeleteExample,
}: AdminTableRowComponentProps) {
  const busy = adminPreloading || isRegenerating || isSaving || isDeleting;
  const canSave = Boolean(rawValue.trim());
  const isPendingPhraseRow = row.rowType === "pending_phrase";
  const isPendingMeaningRow = row.rowType === "pending_meaning";
  const isEmptyTargetRow = row.rowType === "empty_target";
  const isExistingRow = row.rowType === "existing";

  return (
    <tr key={row.rowKey} className="border-b align-top">
      {/* ── Hanzi column (spans all pronunciations of this character) ─── */}
      {row.showHanziCell ? (
        <td className="px-3 py-2 text-2xl font-medium" rowSpan={row.hanziRowSpan}>
          {row.character}
        </td>
      ) : null}
      {/* ── Pronunciation column (spans rows for this target only) ───── */}
      {row.showCharacterCell ? (
        <td className="px-3 py-2 text-sm" rowSpan={row.characterRowSpan}>
          <div className="flex min-h-[5rem] flex-col justify-between gap-2">
            <p className="font-medium">{row.pronunciation}</p>
            {!target ? null : (
              <div className="flex flex-wrap gap-1">
                {isPlatformAdmin && (
                  <button
                    type="button"
                    className="rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => onRegenerate(target)}
                    title={str.admin.table.actionTooltips.regenerate}
                  >
                    {str.admin.table.actionButtons.regenerate}
                  </button>
                )}
                {isPlatformAdmin && (
                  <button
                    type="button"
                    className="rounded border-2 border-emerald-600 bg-emerald-600 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white disabled:opacity-50"
                    disabled={busy || !canSave}
                    onClick={() => onSave(target)}
                    title={str.admin.table.actionTooltips.save}
                  >
                    {isSaving ? str.admin.table.actionButtons.save : str.admin.table.actionButtons.save}
                  </button>
                )}
                <button
                  type="button"
                  className="rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => onDeleteTarget(target)}
                  title={str.admin.table.actionTooltips.delete}
                >
                  {str.admin.table.actionButtons.delete}
                </button>
                {isPlatformAdmin && (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded border-2 border-sky-300 bg-sky-50 px-1.5 py-1 text-[11px] font-medium leading-tight text-sky-800 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => onAddMeaningRow(target.key)}
                    title={str.admin.table.actionTooltips.addMeaning}
                  >
                    {str.admin.table.actionButtons.addMeaning}
                  </button>
                )}
              </div>
            )}
          </div>
        </td>
      ) : null}
      {/* ── Content Status column (same rowSpan as hanzi cell) ────────── */}
      {row.showHanziCell ? (
        <td className="px-3 py-2 align-top" rowSpan={row.hanziRowSpan}>
          <div className="flex min-h-[5rem] flex-col justify-between gap-2">
            <span
              className={
                approvalStatus === "ready"
                  ? "inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                  : approvalStatus === "saved"
                  ? "inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                  : "inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600"
              }
            >
              {approvalStatus === "ready"
                ? str.admin.table.approvalStatus.ready
                : approvalStatus === "saved"
                ? str.admin.table.approvalStatus.saved
                : str.admin.table.approvalStatus.pending}
            </span>
            {isPlatformAdmin && target && approvalStatus === "saved" && (
              <button
                type="button"
                className="rounded border-2 border-emerald-600 bg-emerald-600 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white disabled:opacity-50"
                disabled={busy || !canApprove}
                onClick={() => onApprove(target)}
                title={str.admin.table.actionTooltips.approve}
              >
                {isSaving ? str.admin.table.actionButtons.approving : str.admin.table.actionButtons.approve}
              </button>
            )}
          </div>
        </td>
      ) : null}
      {row.showMeaningCell ? (
        <td className="px-3 py-2" rowSpan={row.meaningRowSpan}>
          {isPendingMeaningRow ? (
            <div className="space-y-2">
              <input
                className="w-full rounded-md border px-2 py-1 text-sm"
                value={row.meaningZh}
                onChange={(event) => {
                  if (!row.pendingId) return;
                  onUpdatePendingMeaningInput(row.pendingId, "meaningZhInput", event.target.value);
                }}
                placeholder={str.admin.table.placeholders.newMeaning}
              />
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className="rounded border-2 border-emerald-600 bg-emerald-600 px-2 py-0.5 text-xs font-medium leading-none text-white disabled:opacity-50"
                  disabled={busy || !row.meaningZh.trim() || !row.phrase.trim() || !row.example.trim()}
                  onClick={() => onSavePendingMeaning(row)}
                  title={str.admin.table.actionTooltips.saveNew}
                >
                  {str.admin.table.actionButtons.saveNew}
                </button>
                <button
                  type="button"
                  className="rounded border-2 border-rose-500 bg-rose-50 px-2 py-0.5 text-xs font-medium leading-none text-rose-700 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => { if (row.pendingId) onRemovePendingMeaning(row.pendingId); }}
                  title={str.admin.table.actionTooltips.cancelAdd}
                >
                  {str.admin.table.actionButtons.cancel}
                </button>
              </div>
            </div>
          ) : isEmptyTargetRow ? (
            <p className="text-xs text-gray-500">
              {str.admin.table.emptyMessages.noContent}
            </p>
          ) : (
            <>
              <p className="text-base leading-tight">{row.meaningZh}</p>
              {row.meaningEn ? <p className="mt-1 text-xs text-gray-500">{row.meaningEn}</p> : null}
              {!target ? null : (
                <button
                  type="button"
                  className="mt-2 rounded border-2 border-sky-300 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => onAddPhraseRow(row.targetKey, row.meaningZh, row.meaningEn)}
                  title={str.admin.table.actionTooltips.addPhrase}
                >
                  {str.admin.table.actionButtons.addPhrase}
                </button>
              )}
            </>
          )}
        </td>
      ) : null}
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          {isPendingPhraseRow ? (
            <input
              className="w-full rounded-md border px-2 py-1 text-sm"
              value={row.phrase}
              onChange={(event) => {
                if (!row.pendingId) return;
                onUpdatePendingPhraseInput(row.pendingId, event.target.value);
              }}
              placeholder={str.admin.table.placeholders.newPhrase.replace("{char}", row.character)}
            />
          ) : isPendingMeaningRow ? (
            <input
              className="w-full rounded-md border px-2 py-1 text-sm"
              value={row.phrase}
              onChange={(event) => {
                if (!row.pendingId) return;
                onUpdatePendingMeaningInput(row.pendingId, "phraseInput", event.target.value);
              }}
              placeholder={str.admin.table.placeholders.newPhrase.replace("{char}", row.character)}
            />
          ) : isEmptyTargetRow ? (
            <p className="text-xs text-gray-500">{str.admin.table.emptyMessages.addMeaningFirst}</p>
          ) : (
            <div className="text-base leading-tight">
              {renderPhraseWithPinyin(row.phrase, row.phrasePinyin)}
            </div>
          )}
          {!target || isEmptyTargetRow ? null : isPendingPhraseRow ? (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="rounded border-2 border-emerald-600 bg-emerald-600 px-2 py-0.5 text-xs font-medium leading-none text-white disabled:opacity-50"
                disabled={busy || !row.phrase.trim()}
                onClick={() => onSavePendingPhrase(row)}
                title={str.admin.table.actionTooltips.saveNew}
              >
                {str.admin.table.actionButtons.saveNew}
              </button>
              <button
                type="button"
                className="rounded border-2 border-rose-500 bg-rose-50 px-2 py-0.5 text-xs font-medium leading-none text-rose-700 disabled:opacity-50"
                disabled={busy}
                onClick={() => { if (row.pendingId) onRemovePendingPhrase(row.pendingId); }}
                title={str.admin.table.actionTooltips.cancelAdd}
              >
                {str.admin.table.actionButtons.cancel}
              </button>
            </div>
          ) : isPendingMeaningRow ? null : (
            <div className="flex flex-wrap gap-1">
              {isExistingRow ? (
                <button
                  type="button"
                  className={
                    row.includeInFillTest
                      ? "rounded border-2 border-teal-600 bg-teal-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-teal-700 disabled:opacity-50"
                      : "rounded border-2 border-gray-400 bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-gray-700 disabled:opacity-50"
                  }
                  disabled={busy}
                  onClick={() => { void onToggleFillTestInclude(row, !row.includeInFillTest); }}
                  title={
                    row.includeInFillTest
                      ? str.admin.table.actionTooltips.fillTestOn
                      : str.admin.table.actionTooltips.fillTestOff
                  }
                >
                  {row.includeInFillTest
                    ? str.admin.table.actionButtons.fillTestOn
                    : str.admin.table.actionButtons.fillTestOff}
                </button>
              ) : null}
              {isPlatformAdmin && (
                <button
                  type="button"
                  className="rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => onRegeneratePhrase(row)}
                  title={str.admin.table.actionTooltips.regeneratePhrase}
                >
                  {str.admin.table.actionButtons.regenerate}
                </button>
              )}
              <button
                type="button"
                className="rounded border-2 border-emerald-600 bg-emerald-600 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white disabled:opacity-50"
                disabled={busy || !canSave}
                onClick={() => onSave(target)}
                title={str.admin.table.actionTooltips.save}
              >
                {str.admin.table.actionButtons.save}
              </button>
              <button
                type="button"
                className="rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700 disabled:opacity-50"
                disabled={busy}
                onClick={() => onDeletePhrase(row)}
                title={str.admin.table.actionTooltips.deletePhrase}
              >
                {str.admin.table.actionButtons.delete}
              </button>
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          {isPendingPhraseRow || isPendingMeaningRow ? (
            isPendingMeaningRow ? (
              <input
                className="w-full rounded-md border px-2 py-1 text-sm"
                value={row.example}
                onChange={(event) => {
                  if (!row.pendingId) return;
                  onUpdatePendingMeaningInput(row.pendingId, "exampleInput", event.target.value);
                }}
                placeholder={str.admin.table.placeholders.matchingExample}
              />
            ) : (
              <p className="text-xs text-gray-500">
                {str.admin.table.helper.generatedOnSave}
              </p>
            )
          ) : isEmptyTargetRow ? (
            <p className="text-xs text-gray-500">
              {str.admin.table.emptyMessages.addMeaningAndPhraseFirst}
            </p>
          ) : isEditingThis ? (
            <input
              className="w-full rounded-md border px-2 py-1 text-sm"
              value={row.example}
              onChange={(event) => onInlineEditExample(row, event.target.value)}
              placeholder={str.admin.table.placeholders.editExample}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          ) : (
            <div className="text-base leading-tight">
              {renderSentenceWithPinyin(row.example, row.examplePinyin)}
            </div>
          )}
          {!target || isPendingPhraseRow || isPendingMeaningRow || isEmptyTargetRow ? null : (
            <div className="flex flex-wrap gap-1">
              {isPlatformAdmin && (
                <button
                  type="button"
                  className="rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => onRegenerateExample(row)}
                  title={str.admin.table.actionTooltips.regenerateExample}
                >
                  {str.admin.table.actionButtons.regenerate}
                </button>
              )}
              <button
                type="button"
                className="rounded border-2 border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-sky-800 disabled:opacity-50"
                disabled={busy}
                onClick={() => onEditExample(row)}
                title={str.admin.table.actionTooltips.editExample}
              >
                {str.admin.table.actionButtons.edit}
              </button>
              <button
                type="button"
                className="rounded border-2 border-emerald-600 bg-emerald-600 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white disabled:opacity-50"
                disabled={busy || !canSave}
                onClick={() => onSave(target)}
                title={str.admin.table.actionTooltips.save}
              >
                {str.admin.table.actionButtons.save}
              </button>
              <button
                type="button"
                className="rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700 disabled:opacity-50"
                disabled={busy}
                onClick={() => onDeleteExample(row)}
                title={str.admin.table.actionTooltips.deleteExample}
              >
                {str.admin.table.actionButtons.delete}
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
});

export default function AdminSection({ vm }: { vm: WordsWorkspaceVM }) {
  const {
    page,
    str,
    getAdminStatsCardClass,
    handleAdminStatsFilterClick,
    isAdminStatsFilterActive,
    adminUniqueCharacterCount,
    adminTargets,
    adminTargetsWithContentCount,
    adminMissingCount,
    adminTargetsReadyForTestingCount,
    adminTargetsExcludedForTestingCount,
    handleAdminPreloadAll,
    cancelAdminPreload,
    adminPreloadCancelling,
    handleAdminRefreshAllPinyin,
    adminLoading,
    adminPreloading,
    adminRefreshingAllPinyin,
    adminProgressText,
    adminNotice,
    adminTableRenderRows,
    adminVisibleTargetKeySet,
    adminEmptyTableMessage,
    adminTargetByKey,
    adminJsonByKey,
    adminRegeneratingKey,
    adminSavingKey,
    adminDeletingKey,
    handleAdminRegenerate,
    handleAdminSave,
    handleAdminDeleteTarget,
    handleAdminAddMeaningRow,
    updateAdminPendingMeaningInput,
    handleAdminSavePendingMeaning,
    removeAdminPendingMeaning,
    handleAdminAddPhraseRow,
    updateAdminPendingPhraseInput,
    handleAdminSavePendingPhrase,
    removeAdminPendingPhrase,
    handleAdminToggleFillTestInclude,
    handleAdminRegeneratePhrase,
    handleAdminDeletePhrase,
    adminEditingExampleRowKey,
    handleAdminInlineEditExample,
    handleAdminRegenerateExample,
    handleAdminEditExample,
    handleAdminDeleteExample,
    adminSavedByKey,
    handleAdminApprove,
    injectAdminTargetByHanzi,
    words,
  } = vm;

  const vmRef = useRef(vm);
  vmRef.current = vm;

  // Stable callback wrappers — identity never changes so React.memo on
  // AdminTableRowComponent bails out correctly for unaffected rows.
  const stableOnRegenerate = useCallback((target: AdminTarget) => vmRef.current.handleAdminRegenerate(target), []);
  const stableOnSave = useCallback((target: AdminTarget) => vmRef.current.handleAdminSave(target), []);
  const stableOnDeleteTarget = useCallback((target: AdminTarget) => vmRef.current.handleAdminDeleteTarget(target), []);
  const stableOnAddMeaningRow = useCallback((targetKey: string) => vmRef.current.handleAdminAddMeaningRow(targetKey), []);
  const stableOnUpdatePendingMeaningInput = useCallback(
    (pendingId: string, field: "meaningZhInput" | "phraseInput" | "exampleInput", value: string) =>
      vmRef.current.updateAdminPendingMeaningInput(pendingId, field, value),
    []
  );
  const stableOnSavePendingMeaning = useCallback((row: AdminTableRow) => vmRef.current.handleAdminSavePendingMeaning(row), []);
  const stableOnRemovePendingMeaning = useCallback((pendingId: string) => vmRef.current.removeAdminPendingMeaning(pendingId), []);
  const stableOnAddPhraseRow = useCallback(
    (targetKey: string, meaningZh: string, meaningEn: string) =>
      vmRef.current.handleAdminAddPhraseRow(targetKey, meaningZh, meaningEn),
    []
  );
  const stableOnUpdatePendingPhraseInput = useCallback(
    (pendingId: string, value: string) => vmRef.current.updateAdminPendingPhraseInput(pendingId, value),
    []
  );
  const stableOnSavePendingPhrase = useCallback((row: AdminTableRow) => vmRef.current.handleAdminSavePendingPhrase(row), []);
  const stableOnRemovePendingPhrase = useCallback((pendingId: string) => vmRef.current.removeAdminPendingPhrase(pendingId), []);
  const stableOnToggleFillTestInclude = useCallback(
    (row: AdminTableRow, include: boolean) => vmRef.current.handleAdminToggleFillTestInclude(row, include),
    []
  );
  const stableOnRegeneratePhrase = useCallback((row: AdminTableRow) => vmRef.current.handleAdminRegeneratePhrase(row), []);
  const stableOnDeletePhrase = useCallback((row: AdminTableRow) => vmRef.current.handleAdminDeletePhrase(row), []);
  const stableOnInlineEditExample = useCallback(
    (row: AdminTableRow, value: string) => vmRef.current.handleAdminInlineEditExample(row, value),
    []
  );
  const stableOnRegenerateExample = useCallback((row: AdminTableRow) => vmRef.current.handleAdminRegenerateExample(row), []);
  const stableOnEditExample = useCallback((row: AdminTableRow) => vmRef.current.handleAdminEditExample(row), []);
  const stableOnDeleteExample = useCallback((row: AdminTableRow) => vmRef.current.handleAdminDeleteExample(row), []);

  const filteredAdminRenderRows = useMemo(
    () => adminTableRenderRows.filter((r) => adminVisibleTargetKeySet.has(r.targetKey)),
    [adminTableRenderRows, adminVisibleTargetKeySet]
  );

  const session = useSession();
  const isPlatformAdmin = session?.isPlatformAdmin ?? false;
  const searchParams = useSearchParams();
  const router = useRouter();

  // Cross-family curation context (set when navigating from Content Queue)
  const curateWordId = searchParams.get("curateWordId");
  const curateFamilyId = searchParams.get("curateFamilyId");
  const curateHanzi = searchParams.get("curateHanzi");

  // Inject cross-family target into the table when navigated from Content Queue
  useEffect(() => {
    if (isPlatformAdmin && curateHanzi) {
      void injectAdminTargetByHanzi(curateHanzi);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curateHanzi, isPlatformAdmin]);

  // Stable approve callback — cross-family targets use setWordContentReadyById + clear URL
  const stableOnApprove = useCallback((target: AdminTarget) => {
    const xfKey = curateHanzi
      ? vmRef.current.adminTargets.find((t) => t.character === curateHanzi)?.key
      : undefined;
    if (xfKey && target.key === xfKey && curateWordId && curateFamilyId) {
      void (async () => {
        try {
          await setWordContentReadyById(curateWordId);
          router.replace("/words/admin");
        } catch (err) {
          console.error(err);
        }
      })();
      return;
    }
    void vmRef.current.handleAdminApprove(target);
  }, [curateHanzi, curateWordId, curateFamilyId, router]);

  // Approval status per character: pending → saved → ready
  const approvalStatusByCharacter = useMemo((): Map<string, AdminTargetApprovalStatus> => {
    const map = new Map<string, AdminTargetApprovalStatus>();
    const characters = [...new Set(adminTargets.map((t) => t.character))];
    for (const character of characters) {
      const word = words.find((w) => w.hanzi === character);
      if (word?.contentStatus === "ready") { map.set(character, "ready"); continue; }
      const anySaved = adminTargets.filter((t) => t.character === character).some((t) => adminSavedByKey[t.key] ?? false);
      map.set(character, anySaved ? "saved" : "pending");
    }
    return map;
  }, [adminSavedByKey, adminTargets, words]);

  // canApprove per character: requires ≥1 meaning + ≥1 phrase + ≥1 example on any saved target
  const canApproveByCharacter = useMemo((): Map<string, boolean> => {
    const map = new Map<string, boolean>();
    const characters = [...new Set(adminTargets.map((t) => t.character))];
    for (const character of characters) {
      const targets = adminTargets.filter((t) => t.character === character);
      const canApprove = targets.some((target) => {
        const raw = adminJsonByKey[target.key];
        if (!raw?.trim()) return false;
        try {
          const parsed = JSON.parse(raw) as { meanings?: Array<{ phrases?: Array<{ example?: string }> }> };
          const hasMeaning = Array.isArray(parsed.meanings) && parsed.meanings.length > 0;
          const hasPhrase = hasMeaning && parsed.meanings!.some((m) => Array.isArray(m.phrases) && m.phrases.length > 0);
          const hasExample = hasPhrase && parsed.meanings!.some((m) => m.phrases!.some((p) => p.example?.trim()));
          return hasMeaning && hasPhrase && hasExample;
        } catch {
          return false;
        }
      });
      map.set(character, canApprove);
    }
    return map;
  }, [adminJsonByKey, adminTargets]);

  if (page !== "admin") {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{str.admin.pageTitle}</h2>
      <p className="text-sm text-gray-700">{str.admin.pageDescription}</p>

      <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          className={getAdminStatsCardClass("characters")}
          onClick={() => handleAdminStatsFilterClick("characters")}
          aria-pressed={isAdminStatsFilterActive("characters")}
          title={str.admin.filterTooltips.characters}
        >
          <p className="text-sm uppercase text-gray-600">
            {str.admin.stats.characters}
            {isAdminStatsFilterActive("characters") ? str.admin.filterStateOn : ""}
          </p>
          <p className="text-2xl font-semibold">{adminUniqueCharacterCount}</p>
        </button>
        <button
          type="button"
          className={getAdminStatsCardClass("targets")}
          onClick={() => handleAdminStatsFilterClick("targets")}
          aria-pressed={isAdminStatsFilterActive("targets")}
          title={str.admin.filterTooltips.allTargets}
        >
          <p className="text-sm uppercase text-gray-600">
            {str.admin.stats.allTargets}
            {isAdminStatsFilterActive("targets") ? str.admin.filterStateOn : ""}
          </p>
          <p className="text-2xl font-semibold">{adminTargets.length}</p>
        </button>
        <button
          type="button"
          className={getAdminStatsCardClass("with_content")}
          onClick={() => handleAdminStatsFilterClick("with_content")}
          aria-pressed={isAdminStatsFilterActive("with_content")}
          title={str.admin.filterTooltips.withContent}
        >
          <p className="text-sm uppercase text-gray-600">
            {str.admin.stats.withContent}
            {isAdminStatsFilterActive("with_content") ? str.admin.filterStateOn : ""}
          </p>
          <p className="text-2xl font-semibold">{adminTargetsWithContentCount}</p>
        </button>
        <button
          type="button"
          className={getAdminStatsCardClass("missing_content")}
          onClick={() => handleAdminStatsFilterClick("missing_content")}
          aria-pressed={isAdminStatsFilterActive("missing_content")}
          title={str.admin.filterTooltips.missingContent}
        >
          <p className="text-sm uppercase text-gray-600">
            {str.admin.stats.missingContent}
            {isAdminStatsFilterActive("missing_content") ? str.admin.filterStateOn : ""}
          </p>
          <p className="text-2xl font-semibold">{adminMissingCount}</p>
        </button>
      </div>
      <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
        <button
          type="button"
          className={getAdminStatsCardClass("ready_for_testing")}
          onClick={() => handleAdminStatsFilterClick("ready_for_testing")}
          aria-pressed={isAdminStatsFilterActive("ready_for_testing")}
          title={str.admin.filterTooltips.readyForTesting}
        >
          <p className="text-sm uppercase text-gray-600">
            {str.admin.stats.readyForTesting}
            {isAdminStatsFilterActive("ready_for_testing") ? str.admin.filterStateOn : ""}
          </p>
          <p className="text-2xl font-semibold">{adminTargetsReadyForTestingCount}</p>
        </button>
        <button
          type="button"
          className={getAdminStatsCardClass("excluded_for_testing")}
          onClick={() => handleAdminStatsFilterClick("excluded_for_testing")}
          aria-pressed={isAdminStatsFilterActive("excluded_for_testing")}
          title={str.admin.filterTooltips.excludedForTesting}
        >
          <p className="text-sm uppercase text-gray-600">
            {str.admin.stats.excludedForTesting}
            {isAdminStatsFilterActive("excluded_for_testing") ? str.admin.filterStateOn : ""}
          </p>
          <p className="text-2xl font-semibold">{adminTargetsExcludedForTestingCount}</p>
        </button>
      </div>

      {isPlatformAdmin && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border-2 border-amber-400 bg-amber-100 px-4 py-2 font-medium text-amber-900 disabled:opacity-50"
            onClick={handleAdminPreloadAll}
            disabled={adminLoading || adminPreloading || adminRefreshingAllPinyin || adminTargets.length === 0}
          >
            {adminPreloading ? str.admin.buttons.preloading : str.admin.buttons.preload}
          </button>
          {adminPreloading ? (
            <button
              type="button"
              className="rounded-md border-2 border-gray-400 bg-gray-100 px-4 py-2 font-medium text-gray-700 disabled:opacity-50"
              onClick={cancelAdminPreload}
              disabled={adminPreloadCancelling}
            >
              {adminPreloadCancelling ? str.admin.buttons.cancellingPreload : str.admin.buttons.cancelPreload}
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md border-2 border-purple-300 bg-purple-100 px-4 py-2 font-medium text-purple-700 disabled:opacity-50"
            onClick={handleAdminRefreshAllPinyin}
            disabled={adminLoading || adminPreloading || adminRefreshingAllPinyin || adminTargets.length === 0}
            title={str.admin.buttonTooltips.refreshAllPinyin}
          >
            {adminRefreshingAllPinyin ? str.admin.buttons.refreshingAllPinyin : str.admin.buttons.refreshAllPinyin}
          </button>
        </div>
      )}

      {adminProgressText ? <p className="text-sm text-gray-600">{adminProgressText}</p> : null}
      {adminNotice ? <p className="text-sm text-blue-700">{adminNotice}</p> : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="w-[8%] px-3 py-2 text-left">
                {str.admin.table.headers.character}
              </th>
              <th className="w-[10%] px-3 py-2 text-left">{str.admin.table.headers.pronunciation}</th>
              <th className="w-[10%] px-3 py-2 text-left">{str.admin.table.headers.status}</th>
              <th className="w-[22%] px-3 py-2 text-left">{str.admin.table.headers.meaningZh}</th>
              <th className="px-3 py-2 text-left">{str.admin.table.headers.phrase}</th>
              <th className="px-3 py-2 text-left">{str.admin.table.headers.example}</th>
            </tr>
          </thead>
          <tbody>
            {filteredAdminRenderRows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-gray-600" colSpan={6}>
                  {adminEmptyTableMessage}
                </td>
              </tr>
            ) : (
              filteredAdminRenderRows.map((row) => {
                const target = adminTargetByKey.get(row.targetKey);
                const rawValue = target ? adminJsonByKey[target.key] ?? "" : "";
                const isRegenerating = target ? adminRegeneratingKey === target.key : false;
                const isSaving = target ? adminSavingKey === target.key : false;
                const isDeleting = target ? adminDeletingKey === target.key : false;
                const isEditingThis = row.rowKey === adminEditingExampleRowKey;
                const approvalStatus = approvalStatusByCharacter.get(row.character) ?? "pending";
                const canApprove = canApproveByCharacter.get(row.character) ?? false;

                return (
                  <AdminTableRowComponent
                    key={row.rowKey}
                    row={row}
                    target={target}
                    rawValue={rawValue}
                    isRegenerating={isRegenerating}
                    isSaving={isSaving}
                    isDeleting={isDeleting}
                    adminPreloading={adminPreloading}
                    isEditingThis={isEditingThis}
                    isPlatformAdmin={isPlatformAdmin}
                    str={str}
                    approvalStatus={approvalStatus}
                    canApprove={canApprove}
                    onApprove={stableOnApprove}
                    onRegenerate={stableOnRegenerate}
                    onSave={stableOnSave}
                    onDeleteTarget={stableOnDeleteTarget}
                    onAddMeaningRow={stableOnAddMeaningRow}
                    onUpdatePendingMeaningInput={stableOnUpdatePendingMeaningInput}
                    onSavePendingMeaning={stableOnSavePendingMeaning}
                    onRemovePendingMeaning={stableOnRemovePendingMeaning}
                    onAddPhraseRow={stableOnAddPhraseRow}
                    onUpdatePendingPhraseInput={stableOnUpdatePendingPhraseInput}
                    onSavePendingPhrase={stableOnSavePendingPhrase}
                    onRemovePendingPhrase={stableOnRemovePendingPhrase}
                    onToggleFillTestInclude={stableOnToggleFillTestInclude}
                    onRegeneratePhrase={stableOnRegeneratePhrase}
                    onDeletePhrase={stableOnDeletePhrase}
                    onInlineEditExample={stableOnInlineEditExample}
                    onRegenerateExample={stableOnRegenerateExample}
                    onEditExample={stableOnEditExample}
                    onDeleteExample={stableOnDeleteExample}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {adminLoading ? (
        <p className="text-sm text-gray-600">{str.admin.loading}</p>
      ) : adminTargets.length === 0 ? (
        <p className="text-sm text-gray-600">{str.admin.noTargets}</p>
      ) : null}

      {/* ── Awaiting Content (family view only) ─────────────────────────── */}
      {!isPlatformAdmin && <AwaitingContentSection words={words} str={str} />}
    </section>
  );
}

// ─── Awaiting Content sub-section ───────────────────────────────────────────

import type { Word } from "@/lib/types";

function AwaitingContentSection({
  words,
  str,
}: {
  words: Word[];
  str: WordsLocaleStrings;
}) {
  const pendingWords = useMemo(
    () => words.filter((w) => w.contentStatus === "pending"),
    [words]
  );

  const awaitStr = str.admin.awaitingContent;

  if (pendingWords.length === 0) return null;

  return (
    <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-medium text-amber-900">{awaitStr.sectionTitle}</h3>
      <p className="mt-1 text-sm text-amber-800">{awaitStr.sectionDescription}</p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-amber-700">
            <th className="px-2 py-1">{awaitStr.tableHeaders.character}</th>
            <th className="px-2 py-1">{awaitStr.tableHeaders.dateAdded}</th>
          </tr>
        </thead>
        <tbody>
          {pendingWords.map((w) => (
            <tr key={w.id} className="border-b last:border-0">
              <td className="px-2 py-1.5 text-base font-medium text-amber-900">{w.hanzi}</td>
              <td className="px-2 py-1.5 text-xs text-amber-700">
                {formatDateTime(w.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


