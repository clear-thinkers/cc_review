"use client";

import { useMemo, useEffect, useState, memo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import type { ResolvedLessonTag } from "../shared/tagging.types";
import type { WordsLocaleStrings } from "../shared/words.shared.types";
import type {
  AdminTableRenderRow,
  AdminTableRow,
  AdminTarget,
} from "./admin.types";
import { renderPhraseWithPinyin, renderSentenceWithPinyin } from "../shared/words.shared.utils";
import { useLocale } from "@/app/shared/locale";
import { taggingStrings } from "../shared/tagging.strings";

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
  str: WordsLocaleStrings;
  onRegenerate: (target: AdminTarget) => void;
  onSave: (target: AdminTarget) => void;
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
  str,
  onRegenerate,
  onSave,
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
      {row.showCharacterCell ? (
        <td className="px-3 py-2 text-base" rowSpan={row.characterRowSpan}>
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
                  className="rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => onDeleteTarget(target)}
                  title={str.admin.table.actionTooltips.delete}
                >
                  {str.admin.table.actionButtons.delete}
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
    words,
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
  } = vm;

  const vmRef = useRef(vm);
  vmRef.current = vm;

  const locale = useLocale();
  const tagStr = taggingStrings[locale];

  const router = useRouter();
  const searchParams = useSearchParams();

  const filterTextbook = searchParams.get("textbook") ?? "";
  const filterGrade = searchParams.get("grade") ?? "";
  const filterUnit = searchParams.get("unit") ?? "";
  const filterLesson = searchParams.get("lesson") ?? "";

  const { wordTagsMap } = vm;

  const hanziToWordId = useMemo(
    () => new Map(words.map((w) => [w.hanzi, w.id])),
    [words]
  );

  const allTags = useMemo<ResolvedLessonTag[]>(() => {
    const tags: ResolvedLessonTag[] = [];
    for (const list of wordTagsMap.values()) {
      for (const t of list) {
        if (!tags.some((x) => x.lessonTagId === t.lessonTagId)) tags.push(t);
      }
    }
    return tags;
  }, [wordTagsMap]);

  const textbookOptions = useMemo(
    () =>
      [...new Map(allTags.map((t) => [t.textbookId, t.textbookName])).entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id, name]) => ({ id, name })),
    [allTags]
  );

  const gradeOptions = useMemo(
    () =>
      filterTextbook
        ? [...new Set(allTags.filter((t) => t.textbookId === filterTextbook).map((t) => t.grade))].sort()
        : [],
    [allTags, filterTextbook]
  );

  const unitOptions = useMemo(
    () =>
      filterTextbook && filterGrade
        ? [
            ...new Set(
              allTags
                .filter((t) => t.textbookId === filterTextbook && t.grade === filterGrade)
                .map((t) => t.unit)
            ),
          ].sort()
        : [],
    [allTags, filterTextbook, filterGrade]
  );

  const lessonOptions = useMemo(
    () =>
      filterTextbook && filterGrade && filterUnit
        ? [
            ...new Set(
              allTags
                .filter(
                  (t) =>
                    t.textbookId === filterTextbook &&
                    t.grade === filterGrade &&
                    t.unit === filterUnit
                )
                .map((t) => t.lesson)
            ),
          ].sort()
        : [],
    [allTags, filterTextbook, filterGrade, filterUnit]
  );

  const SAVED_FILTER_KEY = "cc_filter_admin";

  // On first mount: restore saved filters into URL if no params are active
  useEffect(() => {
    if (filterTextbook || filterGrade || filterUnit || filterLesson) return;
    try {
      const saved = localStorage.getItem(SAVED_FILTER_KEY);
      if (saved) {
        const p = JSON.parse(saved) as Record<string, string>;
        if (p.textbook) setParam(p);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [savedNotice, setAdminSavedNotice] = useState(false);

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

  function saveFilters() {
    try {
      localStorage.setItem(SAVED_FILTER_KEY, JSON.stringify({ textbook: filterTextbook, grade: filterGrade, unit: filterUnit, lesson: filterLesson }));
    } catch { /* ignore */ }
    setAdminSavedNotice(true);
    setTimeout(() => setAdminSavedNotice(false), 2000);
  }

  function setParam(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function clearFilters() {
    router.replace("?", { scroll: false });
  }

  const anyFilterActive = filterTextbook || filterGrade || filterUnit || filterLesson;

  // Determine which targetKeys pass the tag filter
  const visibleTargetKeys = useMemo(() => {
    if (!anyFilterActive) return null; // null = show all
    const passing = new Set<string>();
    for (const row of adminTableRenderRows) {
      const wordId = hanziToWordId.get(row.character);
      if (!wordId) continue;
      const tags = wordTagsMap.get(wordId) ?? [];
      const matches = tags.some(
        (t) =>
          (!filterTextbook || t.textbookId === filterTextbook) &&
          (!filterGrade || t.grade === filterGrade) &&
          (!filterUnit || t.unit === filterUnit) &&
          (!filterLesson || t.lesson === filterLesson)
      );
      if (matches) passing.add(row.targetKey);
    }
    return passing;
  }, [adminTableRenderRows, hanziToWordId, wordTagsMap, filterTextbook, filterGrade, filterUnit, filterLesson, anyFilterActive]);

  const filteredAdminRenderRows = useMemo(
    () =>
      adminTableRenderRows.filter(
        (r) =>
          adminVisibleTargetKeySet.has(r.targetKey) &&
          (visibleTargetKeys === null || visibleTargetKeys.has(r.targetKey))
      ),
    [adminTableRenderRows, adminVisibleTargetKeySet, visibleTargetKeys]
  );

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

      {adminProgressText ? <p className="text-sm text-gray-600">{adminProgressText}</p> : null}
      {adminNotice ? <p className="text-sm text-blue-700">{adminNotice}</p> : null}

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
          <select
            className="rounded border px-2 py-1"
            value={filterTextbook}
            onChange={(e) => setParam({ textbook: e.target.value, grade: "", unit: "", lesson: "" })}
            aria-label={tagStr.filter.textbookLabel}
          >
            <option value="">{tagStr.filter.allOption}</option>
            {textbookOptions.map((tb) => (
              <option key={tb.id} value={tb.id}>
                {tb.name}
              </option>
            ))}
          </select>

          <select
            className="rounded border px-2 py-1 disabled:opacity-50"
            value={filterGrade}
            onChange={(e) => setParam({ grade: e.target.value, unit: "", lesson: "" })}
            disabled={!filterTextbook}
            aria-label={tagStr.filter.gradeLabel}
          >
            <option value="">{tagStr.filter.allOption}</option>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <select
            className="rounded border px-2 py-1 disabled:opacity-50"
            value={filterUnit}
            onChange={(e) => setParam({ unit: e.target.value, lesson: "" })}
            disabled={!filterGrade}
            aria-label={tagStr.filter.unitLabel}
          >
            <option value="">{tagStr.filter.allOption}</option>
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          <select
            className="rounded border px-2 py-1 disabled:opacity-50"
            value={filterLesson}
            onChange={(e) => setParam({ lesson: e.target.value })}
            disabled={!filterUnit}
            aria-label={tagStr.filter.lessonLabel}
          >
            <option value="">{tagStr.filter.allOption}</option>
            {lessonOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          {anyFilterActive && (
            <>
              <button
                type="button"
                onClick={saveFilters}
                className="rounded border px-2 py-1 text-blue-600 hover:bg-blue-50"
              >
                {savedNotice ? tagStr.filter.filtersSaved : tagStr.filter.saveFilters}
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded border px-2 py-1 text-gray-600 hover:bg-gray-100"
              >
                {tagStr.filter.clearFilters}
              </button>
            </>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="w-[15%] px-3 py-2 text-left">
                {str.admin.table.headers.character} ({str.admin.table.headers.pronunciation})
              </th>
              <th className="w-[25%] px-3 py-2 text-left">{str.admin.table.headers.meaningZh}</th>
              <th className="px-3 py-2 text-left">{str.admin.table.headers.phrase}</th>
              <th className="px-3 py-2 text-left">{str.admin.table.headers.example}</th>
            </tr>
          </thead>
          <tbody>
            {filteredAdminRenderRows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-gray-600" colSpan={4}>
                  {anyFilterActive ? (
                    <span>
                      {tagStr.filter.emptyState}{" "}
                      <button type="button" onClick={clearFilters} className="underline">
                        {tagStr.filter.clearFilters}
                      </button>
                    </span>
                  ) : (
                    adminEmptyTableMessage
                  )}
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
                    str={str}
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
    </section>
  );
}


