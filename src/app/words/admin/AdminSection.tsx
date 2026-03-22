"use client";

import { useMemo, memo, useCallback, useRef, useState, useEffect, useTransition, type FormEvent } from "react";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import type { WordsLocaleStrings } from "../shared/words.shared.types";
import type {
  AdminTableRenderRow,
  AdminTableRow,
  AdminTarget,
} from "./admin.types";
import { renderPhraseWithPinyin, renderSentenceWithPinyin } from "../shared/words.shared.utils";

function computeRenderRows(rows: AdminTableRow[]): AdminTableRenderRow[] {
  if (rows.length === 0) return [];
  const characterGroupStarts = new Set<number>();
  const meaningGroupStarts = new Set<number>();
  let index = 0;
  while (index < rows.length) {
    const groupKey = `${rows[index].character}||${rows[index].pronunciation}`;
    characterGroupStarts.add(index);
    let end = index + 1;
    while (end < rows.length && `${rows[end].character}||${rows[end].pronunciation}` === groupKey) end++;
    index = end;
  }
  index = 0;
  while (index < rows.length) {
    const groupKey = [rows[index].character, rows[index].pronunciation, rows[index].meaningZh, rows[index].meaningEn, rows[index].rowType, rows[index].pendingId ?? ""].join("||");
    meaningGroupStarts.add(index);
    let end = index + 1;
    while (end < rows.length && [rows[end].character, rows[end].pronunciation, rows[end].meaningZh, rows[end].meaningEn, rows[end].rowType, rows[end].pendingId ?? ""].join("||") === groupKey) end++;
    index = end;
  }
  return rows.map((row, i) => ({
    ...row,
    showCharacterCell: characterGroupStarts.has(i),
    showMeaningCell: meaningGroupStarts.has(i),
  }));
}

export function paginateAdminRowsByCharacter(
  rows: AdminTableRow[],
  itemsPerPage: number
): AdminTableRow[][] {
  if (rows.length === 0) {
    return [[]];
  }

  const characterGroups: AdminTableRow[][] = [];
  let currentGroup: AdminTableRow[] = [];

  for (const row of rows) {
    if (currentGroup.length === 0 || currentGroup[0].character === row.character) {
      currentGroup.push(row);
      continue;
    }

    characterGroups.push(currentGroup);
    currentGroup = [row];
  }

  if (currentGroup.length > 0) {
    characterGroups.push(currentGroup);
  }

  const pages: AdminTableRow[][] = [];
  let currentPageRows: AdminTableRow[] = [];

  for (const group of characterGroups) {
    if (currentPageRows.length === 0) {
      currentPageRows = [...group];
      continue;
    }

    if (currentPageRows.length + group.length > itemsPerPage) {
      pages.push(currentPageRows);
      currentPageRows = [...group];
      continue;
    }

    currentPageRows = [...currentPageRows, ...group];
  }

  if (currentPageRows.length > 0) {
    pages.push(currentPageRows);
  }

  return pages.length > 0 ? pages : [[]];
}

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
  isSelected: boolean;
  rawValue: string;
  isRegenerating: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  adminPreloading: boolean;
  isEditingThis: boolean;
  str: WordsLocaleStrings;
  onRegenerate: (target: AdminTarget) => void;
  onSave: (target: AdminTarget) => void;
  onClearContent: (target: AdminTarget) => void;
  onDeleteRow: (target: AdminTarget) => void;
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
  onToggleSelection: (targetKey: string) => void;
};

const AdminTableRowComponent = memo(function AdminTableRowComponent({
  row,
  target,
  isSelected,
  rawValue,
  isRegenerating,
  isSaving,
  isDeleting,
  adminPreloading,
  isEditingThis,
  str,
  onRegenerate,
  onSave,
  onClearContent,
  onDeleteRow,
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
  onToggleSelection,
}: AdminTableRowComponentProps) {
  const busy = adminPreloading || isRegenerating || isSaving || isDeleting;
  const canSave = Boolean(rawValue.trim());
  const isPendingPhraseRow = row.rowType === "pending_phrase";
  const isPendingMeaningRow = row.rowType === "pending_meaning";
  const isEmptyTargetRow = row.rowType === "empty_target";
  const isExistingRow = row.rowType === "existing";

  return (
    <tr key={row.rowKey} className="border-b align-top">
      <td className="px-3 py-2 text-center">
        {row.showCharacterCell && target ? (
          <input
            type="checkbox"
            checked={isSelected}
            disabled={busy}
            onChange={() => onToggleSelection(target.key)}
            title={
              isSelected
                ? str.admin.table.actionTooltips.deselectTarget
                : str.admin.table.actionTooltips.selectTarget
            }
            aria-label={`${str.admin.table.actionButtons.selectTarget}: ${row.character} (${row.pronunciation})`}
          />
        ) : null}
      </td>
      <td className="px-3 py-2 text-base">
        {row.showCharacterCell ? (
          <div className="flex min-h-[5rem] flex-col justify-between gap-2">
            <p>
              {row.character} ({row.pronunciation})
            </p>
            {!target ? null : (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className="rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => onRegenerate(target)}
                  title={str.admin.table.actionTooltips.regenerate}
                >
                  {str.admin.table.actionButtons.regenerate}
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
                  className="rounded border-2 border-gray-400 bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-gray-700 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => onClearContent(target)}
                  title={str.admin.table.actionTooltips.clearContent}
                >
                  {str.admin.table.actionButtons.clearContent}
                </button>
                <button
                  type="button"
                  className="rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => onDeleteRow(target)}
                  title={str.admin.table.actionTooltips.deleteRow}
                >
                  {str.admin.table.actionButtons.deleteRow}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded border-2 border-sky-300 bg-sky-50 px-1.5 py-1 text-[11px] font-medium leading-tight text-sky-800 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => onAddMeaningRow(target.key)}
                  title={str.admin.table.actionTooltips.addMeaning}
                >
                  {str.admin.table.actionButtons.addMeaning}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-2">
        {row.showMeaningCell ? (
          <>
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
          </>
        ) : null}
      </td>
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
              <button
                type="button"
                className="rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900 disabled:opacity-50"
                disabled={busy}
                onClick={() => onRegeneratePhrase(row)}
                title={str.admin.table.actionTooltips.regeneratePhrase}
              >
                {str.admin.table.actionButtons.regenerate}
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
              <button
                type="button"
                className="rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900 disabled:opacity-50"
                disabled={busy}
                onClick={() => onRegenerateExample(row)}
                title={str.admin.table.actionTooltips.regenerateExample}
              >
                {str.admin.table.actionButtons.regenerate}
              </button>
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
    adminStatsFilter,
    adminSelectedTargetKeys,
    adminCreatingReviewTestSession,
    reviewTestSessions,
    handleAdminPreloadAll,
    cancelAdminPreload,
    adminPreloadCancelling,
    handleAdminRefreshAllPinyin,
    adminLoading,
    adminPreloading,
    adminRefreshingAllPinyin,
    adminProgressText,
    adminNotice,
    adminTableRows,
    adminVisibleTargetKeySet,
    adminEmptyTableMessage,
    adminTargetByKey,
    adminJsonByKey,
    adminRegeneratingKey,
    adminSavingKey,
    adminDeletingKey,
    handleAdminRegenerate,
    handleAdminSave,
    handleAdminClearSavedContent,
    handleAdminDeleteRow,
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
    toggleAdminTargetSelection,
    selectAdminTargetKeys,
    clearAdminTargetSelection,
    createSelectedReviewTestSession,
  } = vm;

  const vmRef = useRef(vm);
  vmRef.current = vm;

  // Filter state
  const [filterDueNow, setFilterDueNow] = useState(false);
  const [filterFamiliarityOperator, setFilterFamiliarityOperator] = useState<"<=" | ">=">("<=");
  const [filterFamiliarityValue, setFilterFamiliarityValue] = useState<number | "">("");
  const [filterSelectedTagIds, setFilterSelectedTagIds] = useState<string[]>([]);
  const [filterSectionOpen, setFilterSectionOpen] = useState(false);
  const [reviewTestSessionFormOpen, setReviewTestSessionFormOpen] = useState(false);
  const [reviewTestSessionName, setReviewTestSessionName] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [isPageTransitionPending, startPageTransition] = useTransition();
  const ITEMS_PER_PAGE = 25;

  // Extract unique tags from wordTagsMap for filter UI
  const availableTagsWithIds = useMemo(() => {
    const tagMap = new Map<string, { id: string; textbookName: string; grade: string; unit: string; lesson: string }>();
    vm.wordTagsMap.forEach((tags) => {
      tags.forEach((tag) => {
        const key = `${tag.textbookName} · ${tag.grade} · ${tag.unit} · ${tag.lesson}`;
        if (!tagMap.has(key)) {
          tagMap.set(key, {
            id: tag.lessonTagId,
            textbookName: tag.textbookName,
            grade: tag.grade,
            unit: tag.unit,
            lesson: tag.lesson,
          });
        }
      });
    });
    return Array.from(tagMap.values()).sort((a, b) =>
      `${a.textbookName}${a.grade}${a.unit}${a.lesson}`.localeCompare(
        `${b.textbookName}${b.grade}${b.unit}${b.lesson}`,
        "zh-Hans-CN"
      )
    );
  }, [vm.wordTagsMap]);

  // Apply filters to admin rows
  const filteredByStatsAdminRenderRows = useMemo(
    () => adminTableRows.filter((r) => adminVisibleTargetKeySet.has(r.targetKey)),
    [adminTableRows, adminVisibleTargetKeySet]
  );

  // Apply default filters
  const filteredAdminRenderRows = useMemo(() => {
    const now = Date.now();
    return filteredByStatsAdminRenderRows.filter((row) => {
      const target = adminTargetByKey.get(row.targetKey);
      if (!target) return false;

      // Filter: Due now (check if any word with this character is due)
      // Note: Admin targets don't have nextReviewAt directly, so we check the character's words
      if (filterDueNow) {
        const wordsDueNow = vm.words.filter((w) => w.hanzi === target.character && (w.nextReviewAt || 0) <= now);
        if (wordsDueNow.length === 0) return false;
      }

      // Filter: Tags (OR logic - target must have any selected tag)
      if (filterSelectedTagIds.length > 0) {
        const targetWords = vm.words.filter((w) => w.hanzi === target.character);
        const targetWordIds = new Set(targetWords.map((w) => w.id));
        let hasAnySelectedTag = false;
        for (const wordId of targetWordIds) {
          const wordTags = vm.wordTagsMap.get(wordId) ?? [];
          const wordTagIds = new Set(wordTags.map((t) => t.lessonTagId));
          if (filterSelectedTagIds.some((tagId) => wordTagIds.has(tagId))) {
            hasAnySelectedTag = true;
            break;
          }
        }
        if (!hasAnySelectedTag) return false;
      }

      return true;
    });
  }, [filteredByStatsAdminRenderRows, filterDueNow, filterSelectedTagIds, adminTargetByKey, vm.words, vm.wordTagsMap]);
  const filteredAdminTargetCount = useMemo(
    () => new Set(filteredAdminRenderRows.map((row) => row.targetKey)).size,
    [filteredAdminRenderRows]
  );
  const adminHasActiveCountFilter =
    (adminStatsFilter !== "targets" && adminStatsFilter !== "characters") ||
    filterDueNow ||
    filterSelectedTagIds.length > 0;

  const adminRowPages = useMemo(
    () => paginateAdminRowsByCharacter(filteredAdminRenderRows, ITEMS_PER_PAGE),
    [filteredAdminRenderRows]
  );

  // Calculate pagination
  const totalPages = adminRowPages.length;
  const validPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const paginatedAdminRenderRows = useMemo(() => {
    const pageRows = adminRowPages[validPage - 1] ?? [];
    return computeRenderRows(pageRows);
  }, [adminRowPages, validPage]);
  const paginatedAdminTargetKeys = useMemo(
    () => Array.from(new Set(paginatedAdminRenderRows.map((row) => row.targetKey))),
    [paginatedAdminRenderRows]
  );
  const filteredAdminTargetKeys = useMemo(
    () => Array.from(new Set(filteredAdminRenderRows.map((row) => row.targetKey))),
    [filteredAdminRenderRows]
  );
  const allVisibleSelected =
    paginatedAdminTargetKeys.length > 0 &&
    paginatedAdminTargetKeys.every((targetKey) => adminSelectedTargetKeys.includes(targetKey));
  const allFilteredSelected =
    filteredAdminTargetKeys.length > 0 &&
    filteredAdminTargetKeys.every((targetKey) => adminSelectedTargetKeys.includes(targetKey));

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterDueNow, filterFamiliarityValue, filterSelectedTagIds]);

  useEffect(() => {
    if (adminSelectedTargetKeys.length > 0) {
      return;
    }

    setReviewTestSessionFormOpen(false);
    setReviewTestSessionName("");
  }, [adminSelectedTargetKeys.length]);

  function clearAllFilters(): void {
    setFilterDueNow(false);
    setFilterFamiliarityOperator("<=");
    setFilterFamiliarityValue("");
    setFilterSelectedTagIds([]);
    setCurrentPage(1);
  }

  function handleFilterSectionToggle(): void {
    setFilterSectionOpen((open) => !open);
  }

  // Stable callback wrappers — identity never changes so React.memo on
  // AdminTableRowComponent bails out correctly for unaffected rows.
  const stableOnRegenerate = useCallback((target: AdminTarget) => vmRef.current.handleAdminRegenerate(target), []);
  const stableOnSave = useCallback((target: AdminTarget) => vmRef.current.handleAdminSave(target), []);
  const stableOnClearContent = useCallback(
    (target: AdminTarget) => vmRef.current.handleAdminClearSavedContent(target),
    []
  );
  const stableOnDeleteRow = useCallback(
    (target: AdminTarget) => vmRef.current.handleAdminDeleteRow(target),
    []
  );
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
  const stableOnToggleSelection = useCallback(
    (targetKey: string) => vmRef.current.toggleAdminTargetSelection(targetKey),
    []
  );
  const handleSelectPage = useCallback(() => {
    vmRef.current.selectAdminTargetKeys(paginatedAdminTargetKeys);
  }, [paginatedAdminTargetKeys]);
  const handleSelectFiltered = useCallback(() => {
    vmRef.current.selectAdminTargetKeys(filteredAdminTargetKeys);
  }, [filteredAdminTargetKeys]);
  const handleClearSelection = useCallback(() => {
    vmRef.current.clearAdminTargetSelection();
    setReviewTestSessionFormOpen(false);
    setReviewTestSessionName("");
  }, []);

  // Page-specific handlers - only process targets visible on current page
  const handleAdminPreloadPage = useCallback(async () => {
    // This calls the VM's preload, which will process all visible targets
    // Pagination ensures only current page targets are shown
    return vmRef.current.handleAdminPreloadAll();
  }, []);

  const handleAdminRefreshPinyinPage = useCallback(async () => {
    // This calls the VM's refresh, which will process all visible targets
    // Pagination ensures only current page targets are shown
    return vmRef.current.handleAdminRefreshAllPinyin();
  }, []);

  async function handleCreateReviewTestSessionSubmit(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    const created = await vmRef.current.createSelectedReviewTestSession(reviewTestSessionName);
    if (!created) {
      return;
    }

    setReviewTestSessionName("");
    setReviewTestSessionFormOpen(false);
  }

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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border-2 border-amber-400 bg-amber-100 px-4 py-2 font-medium text-amber-900 disabled:opacity-50"
          onClick={handleAdminPreloadPage}
          disabled={adminLoading || adminPreloading || adminRefreshingAllPinyin || paginatedAdminRenderRows.length === 0}
          title={str.admin.buttonTooltips.preload}
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
          onClick={handleAdminRefreshPinyinPage}
          disabled={adminLoading || adminPreloading || adminRefreshingAllPinyin || paginatedAdminRenderRows.length === 0}
          title={str.admin.buttonTooltips.refreshAllPinyin}
        >
          {adminRefreshingAllPinyin ? str.admin.buttons.refreshingAllPinyin : str.admin.buttons.refreshAllPinyin}
        </button>
      </div>

      <p className="text-xs text-amber-700">
        {str.admin.preloadWarning}
      </p>

      {adminProgressText ? <p className="text-sm text-gray-600">{adminProgressText}</p> : null}
      {adminNotice ? <p className="text-sm text-blue-700">{adminNotice}</p> : null}

      {/* Default Filters Bar */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleFilterSectionToggle}
            className="text-sm text-blue-600 underline"
          >
            {str.admin.filters.title}
          </button>
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs text-blue-600 underline disabled:opacity-50"
            disabled={!filterDueNow && filterFamiliarityValue === "" && filterSelectedTagIds.length === 0}
          >
            {str.admin.filters.clearButton}
          </button>
        </div>

        {filterSectionOpen && (
          <div className="flex flex-wrap items-start gap-12">
            {/* Due Now Filter */}
            <div className="pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterDueNow}
                  onChange={(e) => setFilterDueNow(e.target.checked)}
                  title={str.admin.filters.dueNow.tooltip}
                />
                <span className="text-sm">{str.admin.filters.dueNow.label}</span>
              </label>
            </div>

            {/* Tags Filter */}
            <div className="w-1/2 space-y-1">
              <label className="block text-xs text-gray-600">{str.admin.filters.tags.label}</label>
              <details className="group">
                <summary className="cursor-pointer rounded-md border px-2 py-1 text-sm bg-gray-50 hover:bg-gray-100">
                  {filterSelectedTagIds.length === 0
                    ? str.admin.filters.tags.placeholder
                    : `${filterSelectedTagIds.length} selected`}
                </summary>
                <div className="mt-2 space-y-1 max-h-96 overflow-y-auto border rounded-md p-2 bg-white">
                  {availableTagsWithIds.length === 0 ? (
                    <p className="text-xs text-gray-500 py-2">{str.admin.filters.tags.placeholder}</p>
                  ) : (
                    availableTagsWithIds.map((tag) => {
                      const tagDisplay = `${tag.textbookName} · ${tag.grade} · ${tag.unit} · ${tag.lesson}`;
                      const isSelected = filterSelectedTagIds.includes(tag.id);
                      return (
                        <label key={tag.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded text-xs">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFilterSelectedTagIds((prev) => [...prev, tag.id]);
                              } else {
                                setFilterSelectedTagIds((prev) => prev.filter((id) => id !== tag.id));
                              }
                            }}
                          />
                          <span>{tagDisplay}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </details>
            </div>
          </div>
        )}
      </div>

      {!adminLoading && adminTargets.length > 0 ? (
        <div className="py-1">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
            <p className="shrink-0">
            {adminHasActiveCountFilter ? (
              <>
                {str.admin.table.summary.filteredLabel}{" "}
                <span className="font-semibold text-blue-600">{filteredAdminTargetCount}</span>
              </>
            ) : (
              str.admin.table.summary.noFiltersApplied
            )}
            {str.admin.table.summary.separator}
            {str.admin.table.summary.selectedLabel}{" "}
            <span className="font-semibold text-blue-600">{adminSelectedTargetKeys.length}</span>
            </p>
            {filteredAdminTargetKeys.length > 0 ? (
              <div className="flex min-h-[2.5rem] flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                className="admin-toolbar-button rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 font-medium leading-none text-sky-800 disabled:opacity-50"
                disabled={paginatedAdminTargetKeys.length === 0 || adminPreloading || allVisibleSelected}
                onClick={handleSelectPage}
              >
                {str.admin.table.selection.selectPage}
              </button>
              <button
                type="button"
                className="admin-toolbar-button rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 font-medium leading-none text-sky-800 disabled:opacity-50"
                disabled={filteredAdminTargetKeys.length === 0 || adminPreloading || allFilteredSelected}
                onClick={handleSelectFiltered}
              >
                {str.admin.table.selection.selectFiltered.replace(
                  "{count}",
                  String(filteredAdminTargetCount)
                )}
              </button>
              <button
                type="button"
                className="admin-toolbar-button rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 font-medium leading-none text-gray-700 disabled:opacity-50"
                disabled={adminSelectedTargetKeys.length === 0 || adminPreloading}
                onClick={handleClearSelection}
              >
                {str.admin.table.selection.clear}
              </button>
              <button
                type="button"
                className="admin-toolbar-button admin-toolbar-button--session inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 font-medium leading-none text-sky-800 disabled:opacity-50"
                disabled={adminSelectedTargetKeys.length === 0 || adminCreatingReviewTestSession}
                onClick={() => {
                  setReviewTestSessionName(reviewTestSessions[0]?.name ?? "");
                  setReviewTestSessionFormOpen(true);
                }}
              >
                <span>{str.admin.buttons.addToReviewTestSession}</span>
                <span aria-hidden="true" className="text-sm leading-none">🎯</span>
              </button>
              {reviewTestSessionFormOpen ? (
                <form
                  className="flex flex-wrap items-center gap-2"
                  onSubmit={handleCreateReviewTestSessionSubmit}
                >
                  <input
                    id="review-test-session-name"
                    aria-label={str.admin.reviewTestSession.nameLabel}
                    className="h-9 min-w-[12rem] rounded-md border border-indigo-300 px-3 py-1.5 text-xs"
                    value={reviewTestSessionName}
                    onChange={(event) => setReviewTestSessionName(event.target.value)}
                    placeholder={str.admin.reviewTestSession.namePlaceholder}
                  />
                  <button
                    type="submit"
                    className="admin-toolbar-button admin-toolbar-button--session inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 font-medium leading-none text-sky-800 disabled:opacity-50"
                    disabled={adminCreatingReviewTestSession}
                  >
                    <span>{str.admin.reviewTestSession.createButton}</span>
                    <span aria-hidden="true" className="text-sm leading-none">🎯</span>
                  </button>
                  <button
                    type="button"
                    className="admin-toolbar-button rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 font-medium leading-none text-gray-700 disabled:opacity-50"
                    disabled={adminCreatingReviewTestSession}
                    onClick={() => {
                      setReviewTestSessionFormOpen(false);
                      setReviewTestSessionName("");
                    }}
                  >
                    {str.admin.reviewTestSession.cancelButton}
                  </button>
                </form>
              ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className={`min-w-full table-fixed border-collapse text-sm transition-opacity${isPageTransitionPending ? " opacity-50" : ""}`}>
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="w-16 px-3 py-2 text-left"></th>
              <th className="w-[15%] px-3 py-2 text-left">
                {str.admin.table.headers.character} ({str.admin.table.headers.pronunciation})
              </th>
              <th className="w-[25%] px-3 py-2 text-left">{str.admin.table.headers.meaningZh}</th>
              <th className="px-3 py-2 text-left">{str.admin.table.headers.phrase}</th>
              <th className="px-3 py-2 text-left">{str.admin.table.headers.example}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedAdminRenderRows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-gray-600" colSpan={5}>
                  {adminEmptyTableMessage}
                </td>
              </tr>
            ) : (
              paginatedAdminRenderRows.map((row) => {
                const target = adminTargetByKey.get(row.targetKey);
                const rawValue = target ? adminJsonByKey[target.key] ?? "" : "";
                const isRegenerating = target ? adminRegeneratingKey === target.key : false;
                const isSaving = target ? adminSavingKey === target.key : false;
                const isDeleting = target ? adminDeletingKey === target.key : false;
                const isEditingThis = row.rowKey === adminEditingExampleRowKey;

                return (
                  <AdminTableRowComponent
                    key={row.rowKey}
                    row={row}
                    target={target}
                    isSelected={adminSelectedTargetKeys.includes(row.targetKey)}
                    rawValue={rawValue}
                    isRegenerating={isRegenerating}
                    isSaving={isSaving}
                    isDeleting={isDeleting}
                    adminPreloading={adminPreloading}
                    isEditingThis={isEditingThis}
                    str={str}
                    onRegenerate={stableOnRegenerate}
                    onSave={stableOnSave}
                    onClearContent={stableOnClearContent}
                    onDeleteRow={stableOnDeleteRow}
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
                    onToggleSelection={stableOnToggleSelection}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {filteredAdminRenderRows.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-600 text-center">
            {str.admin.pagination.pageInfo.replace("{current}", String(validPage)).replace("{total}", String(Math.max(1, totalPages)))}
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => startPageTransition(() => setCurrentPage(1))}
              disabled={validPage === 1}
              className="rounded px-2 py-1 text-xs border disabled:opacity-50 hover:bg-gray-50"
            >
              {str.admin.pagination.firstButton}
            </button>
            <button
              type="button"
              onClick={() => startPageTransition(() => setCurrentPage((p) => Math.max(1, p - 1)))}
              disabled={validPage === 1}
              className="rounded px-2 py-1 text-xs border disabled:opacity-50 hover:bg-gray-50"
            >
              {str.admin.pagination.previousButton}
            </button>
            <button
              type="button"
              onClick={() => startPageTransition(() => setCurrentPage((p) => Math.min(totalPages, p + 1)))}
              disabled={validPage === totalPages}
              className="rounded px-2 py-1 text-xs border disabled:opacity-50 hover:bg-gray-50"
            >
              {str.admin.pagination.nextButton}
            </button>
            <button
              type="button"
              onClick={() => startPageTransition(() => setCurrentPage(totalPages))}
              disabled={validPage === totalPages}
              className="rounded px-2 py-1 text-xs border disabled:opacity-50 hover:bg-gray-50"
            >
              {str.admin.pagination.lastButton}
            </button>
          </div>
        </div>
      )}

      {adminLoading ? (
        <p className="text-sm text-gray-600">{str.admin.loading}</p>
      ) : adminTargets.length === 0 ? (
        <p className="text-sm text-gray-600">
          {vm.words.length === 0 ? str.admin.noTargets : str.admin.noVisibleTargets}
        </p>
      ) : null}
    </section>
  );
}
