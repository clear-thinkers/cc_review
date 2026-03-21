"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/authContext";
import { useLocale } from "@/app/shared/locale";
import { taggingStrings } from "../shared/tagging.strings";
import { assignWordLessonTags, clearWordLessonTags, createLessonTagIfNew, createTextbook, listLessonTags, listTextbooks } from "@/lib/supabase-service";
import type { LessonTag, Textbook } from "../shared/tagging.types";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";

export default function AllWordsSection({ vm }: { vm: WordsWorkspaceVM }) {
  const {
    page,
    str,
    allWordsSummary,
    formatProbability,
    loading,
    words,
    toggleAllWordsSort,
    getSortIndicator,
    sortedAllWords,
    refreshAllData,
    formatDateTime,
    resetWord,
    removeWord,
    wordTagsMap,
  } = vm;

  const session = useSession();
  const locale = useLocale();
  const tagStr = taggingStrings[locale].column;
  const allEditorStr = taggingStrings[locale].allEditor;
  const addTagStr = taggingStrings[locale].add;
  const isChild = session?.role === "child";

  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorAction, setEditorAction] = useState<"add" | "update" | null>(null);
  const [tagClearing, setTagClearing] = useState(false);
  const [batchTagSectionOpen, setBatchTagSectionOpen] = useState(false);

  const [batchGradeCreateMode, setBatchGradeCreateMode] = useState(false);
  const [batchGradeInputValue, setBatchGradeInputValue] = useState("");
  const [batchUnitCreateMode, setBatchUnitCreateMode] = useState(false);
  const [batchUnitInputValue, setBatchUnitInputValue] = useState("");
  const [batchLessonCreateMode, setBatchLessonCreateMode] = useState(false);
  const [batchLessonInputValue, setBatchLessonInputValue] = useState("");

  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [textbooksLoading, setTextbooksLoading] = useState(false);
  const [textbookCreateMode, setTextbookCreateMode] = useState(false);
  const [textbookInputValue, setTextbookInputValue] = useState("");
  const [textbookCreating, setTextbookCreating] = useState(false);
  const [lessonTags, setLessonTags] = useState<LessonTag[]>([]);

  const [batchTextbookId, setBatchTextbookId] = useState<string | null>(null);
  const [batchTextbookName, setBatchTextbookName] = useState("");
  const [batchGrade, setBatchGrade] = useState<string | null>(null);
  const [batchUnit, setBatchUnit] = useState<string | null>(null);
  const [batchLesson, setBatchLesson] = useState<string | null>(null);

  // Filter state
  const [filterDueNow, setFilterDueNow] = useState(false);
  const [filterFamiliarityOperator, setFilterFamiliarityOperator] = useState<"<=" | ">=">("<=");
  const [filterFamiliarityValue, setFilterFamiliarityValue] = useState<number | "">("");
  const [filterSelectedTagIds, setFilterSelectedTagIds] = useState<string[]>([]);
  const [filterSectionOpen, setFilterSectionOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Extract unique tags from wordTagsMap for filter UI
  const availableTagsWithIds = useMemo(() => {
    const tagMap = new Map<string, { id: string; textbookName: string; grade: string; unit: string; lesson: string }>();
    wordTagsMap.forEach((tags) => {
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
  }, [wordTagsMap]);

  const visibleWordIds = useMemo(
    () => sortedAllWords.map(({ word }) => word.id),
    [sortedAllWords]
  );

  // Apply filters to sorted words
  const filteredWords = useMemo(() => {
    const now = Date.now();
    return sortedAllWords.filter(({ word, familiarity }) => {
      // Filter: Due now
      if (filterDueNow) {
        const isDue = (word.nextReviewAt || 0) <= now;
        if (!isDue) return false;
      }

      // Filter: Familiarity
      if (filterFamiliarityValue !== "") {
        const threshold = Number(filterFamiliarityValue);
        if (filterFamiliarityOperator === "<=") {
          if (familiarity > threshold) return false;
        } else if (filterFamiliarityOperator === ">=") {
          if (familiarity < threshold) return false;
        }
      }

      // Filter: Tags (AND logic - word must have all selected tags)
      if (filterSelectedTagIds.length > 0) {
        const wordTags = wordTagsMap.get(word.id) ?? [];
        const wordTagIds = new Set(wordTags.map((t) => t.lessonTagId));
        const hasAllSelectedTags = filterSelectedTagIds.every((tagId) => wordTagIds.has(tagId));
        if (!hasAllSelectedTags) return false;
      }

      return true;
    });
  }, [sortedAllWords, filterDueNow, filterFamiliarityOperator, filterFamiliarityValue, filterSelectedTagIds, wordTagsMap]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredWords.length / ITEMS_PER_PAGE);
  const validPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const paginatedWords = useMemo(() => {
    const startIdx = (validPage - 1) * ITEMS_PER_PAGE;
    return filteredWords.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [filteredWords, validPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterDueNow, filterFamiliarityValue, filterSelectedTagIds]);

  // Update the visibleWordIds to use paginatedWords instead of sortedAllWords
  useEffect(() => {
    setSelectedWordIds((previous) => {
      const paginatedWordIds = paginatedWords.map(({ word }) => word.id);
      return previous.filter((id) => paginatedWordIds.includes(id));
    });
  }, [paginatedWords]);

  useEffect(() => {
    if (isChild) {
      return;
    }

    setTextbooksLoading(true);
    listTextbooks()
      .then(setTextbooks)
      .catch(() => setTextbooks([]))
      .finally(() => setTextbooksLoading(false));
  }, [isChild]);

  const paginatedWordIds = useMemo(() => paginatedWords.map(({ word }) => word.id), [paginatedWords]);
  const hasActiveFilters =
    filterDueNow || filterFamiliarityValue !== "" || filterSelectedTagIds.length > 0;

  useEffect(() => {
    if (!batchTextbookId) {
      setLessonTags([]);
      return;
    }

    listLessonTags(batchTextbookId)
      .then(setLessonTags)
      .catch(() => setLessonTags([]));
  }, [batchTextbookId]);

  const gradeOptions = batchTextbookId
    ? [...new Set(lessonTags.map((item) => item.grade))].sort()
    : [];
  const unitOptions =
    batchTextbookId && batchGrade
      ? [...new Set(lessonTags.filter((item) => item.grade === batchGrade).map((item) => item.unit))].sort()
      : [];
  const lessonOptions =
    batchTextbookId && batchGrade && batchUnit
      ? [
          ...new Set(
            lessonTags
              .filter((item) => item.grade === batchGrade && item.unit === batchUnit)
              .map((item) => item.lesson)
          ),
        ].sort()
      : [];

  const allVisibleSelected =
    paginatedWordIds.length > 0 && paginatedWordIds.every((id) => selectedWordIds.includes(id));

  function toggleWordSelection(wordId: string, checked: boolean): void {
    setSelectedWordIds((previous) => {
      if (checked) {
        return previous.includes(wordId) ? previous : [...previous, wordId];
      }

      return previous.filter((id) => id !== wordId);
    });
  }

  function toggleAllVisibleSelection(checked: boolean): void {
    setSelectedWordIds((previous) => {
      if (checked) {
        const merged = new Set([...previous, ...paginatedWordIds]);
        return [...merged];
      }

      return previous.filter((id) => !paginatedWordIds.includes(id));
    });
  }

  function handleBatchTextbookSelect(id: string): void {
    const selected = textbooks.find((tb) => tb.id === id);
    if (!selected) {
      setBatchTextbookId(null);
      setBatchTextbookName("");
    } else {
      setBatchTextbookId(selected.id);
      setBatchTextbookName(selected.name);
    }
    setBatchGrade(null);
    setBatchUnit(null);
    setBatchLesson(null);
    setBatchGradeCreateMode(false);
    setBatchGradeInputValue("");
    setBatchUnitCreateMode(false);
    setBatchUnitInputValue("");
    setBatchLessonCreateMode(false);
    setBatchLessonInputValue("");
  }

  async function handleCreateNewTextbook(): Promise<void> {
    const trimmed = textbookInputValue.trim();
    if (!trimmed) {
      return;
    }

    setTextbookCreating(true);
    try {
      const created = await createTextbook(trimmed);
      setTextbooks((previous) =>
        previous.some((tb) => tb.id === created.id) ? previous : [...previous, created]
      );
      setBatchTextbookId(created.id);
      setBatchTextbookName(created.name);
      setBatchGrade(null);
      setBatchUnit(null);
      setBatchLesson(null);
      setBatchGradeCreateMode(false);
      setBatchGradeInputValue("");
      setBatchUnitCreateMode(false);
      setBatchUnitInputValue("");
      setBatchLessonCreateMode(false);
      setBatchLessonInputValue("");
      setTextbookInputValue("");
      setTextbookCreateMode(false);
    } finally {
      setTextbookCreating(false);
    }
  }

  async function handleBatchClearTags(): Promise<void> {
    setEditorNotice(null);

    if (selectedWordIds.length === 0) {
      setEditorNotice(allEditorStr.noSelection);
      return;
    }

    setTagClearing(true);
    try {
      await clearWordLessonTags(selectedWordIds);
      await refreshAllData();
      setEditorNotice(allEditorStr.clearTagsSuccess.replace("{count}", String(selectedWordIds.length)));
    } catch (error) {
      console.error("[all-tags] Batch clear failed", error);
      setEditorNotice(allEditorStr.clearTagsError);
    } finally {
      setTagClearing(false);
    }
  }

  async function resolveBatchLessonTag(): Promise<LessonTag | null> {
    let resolvedTextbookId = batchTextbookId;
    if (!resolvedTextbookId && batchTextbookName.trim()) {
      try {
        const created = await createTextbook(batchTextbookName.trim());
        resolvedTextbookId = created.id;
        setBatchTextbookId(created.id);
      } catch {
        // Validation will surface message below if textbook remains unresolved.
      }
    }

    if (!resolvedTextbookId || !batchGrade || !batchUnit || !batchLesson) {
      setEditorNotice(allEditorStr.incompleteTagError);
      return null;
    }

    const selectedTextbook = textbooks.find((tb) => tb.id === resolvedTextbookId);
    if (selectedTextbook?.isShared) {
      // Shared textbook lesson tags can conflict across families under RLS.
      // Resolve to a family-owned textbook with the same name for safe writes.
      const familyOwned = await createTextbook(selectedTextbook.name);
      resolvedTextbookId = familyOwned.id;
      setBatchTextbookId(familyOwned.id);
      setBatchTextbookName(familyOwned.name);
      setTextbooks((previous) =>
        previous.some((tb) => tb.id === familyOwned.id) ? previous : [...previous, familyOwned]
      );
    }

    return createLessonTagIfNew(resolvedTextbookId, batchGrade, batchUnit, batchLesson);
  }

  async function handleBatchSave(): Promise<void> {
    setEditorNotice(null);

    if (selectedWordIds.length === 0) {
      setEditorNotice(allEditorStr.noSelection);
      return;
    }

    setEditorSaving(true);
    setEditorAction("add");
    try {
      const lessonTag = await resolveBatchLessonTag();
      if (!lessonTag) {
        return;
      }
      await assignWordLessonTags(selectedWordIds, lessonTag.id);
      await refreshAllData();
      setEditorNotice(allEditorStr.saveSuccess.replace("{count}", String(selectedWordIds.length)));
    } catch (error) {
      console.error("[all-tags] Batch save failed", error);
      setEditorNotice(allEditorStr.saveError);
    } finally {
      setEditorSaving(false);
      setEditorAction(null);
    }
  }

  async function handleBatchUpdateTags(): Promise<void> {
    setEditorNotice(null);

    if (selectedWordIds.length === 0) {
      setEditorNotice(allEditorStr.noSelection);
      return;
    }

    setEditorSaving(true);
    setEditorAction("update");
    try {
      const lessonTag = await resolveBatchLessonTag();
      if (!lessonTag) {
        return;
      }

      await clearWordLessonTags(selectedWordIds);
      await assignWordLessonTags(selectedWordIds, lessonTag.id);
      await refreshAllData();
      setEditorNotice(allEditorStr.updateTagsSuccess.replace("{count}", String(selectedWordIds.length)));
    } catch (error) {
      console.error("[all-tags] Batch update failed", error);
      setEditorNotice(allEditorStr.updateTagsError);
    } finally {
      setEditorSaving(false);
      setEditorAction(null);
    }
  }

  function handleBatchTagToggle(): void {
    if (batchTagSectionOpen) {
      setBatchGradeCreateMode(false);
      setBatchGradeInputValue("");
      setBatchUnitCreateMode(false);
      setBatchUnitInputValue("");
      setBatchLessonCreateMode(false);
      setBatchLessonInputValue("");
    }
    setBatchTagSectionOpen((open) => !open);
  }

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

  if (page !== "all") {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{str.all.pageTitle}</h2>
      <p className="text-sm text-gray-700">{str.all.pageDescription}</p>

      <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex min-h-[76px] w-full flex-col items-center justify-center rounded-md border px-2 py-2 text-center">
          <p className="text-sm uppercase text-gray-600">{str.all.stats.totalCharacters}</p>
          <p className="text-2xl font-semibold">{allWordsSummary.totalWords}</p>
        </div>
        <div className="flex min-h-[76px] w-full flex-col items-center justify-center rounded-md border px-2 py-2 text-center">
          <p className="text-sm uppercase text-gray-600">{str.all.stats.timesReviewed}</p>
          <p className="text-2xl font-semibold">{allWordsSummary.totalReviewed}</p>
        </div>
        <div className="flex min-h-[76px] w-full flex-col items-center justify-center rounded-md border px-2 py-2 text-center">
          <p className="text-sm uppercase text-gray-600">{str.all.stats.timesTested}</p>
          <p className="text-2xl font-semibold">{allWordsSummary.totalTested}</p>
        </div>
        <div className="flex min-h-[76px] w-full flex-col items-center justify-center rounded-md border px-2 py-2 text-center">
          <p className="text-sm uppercase text-gray-600">{str.all.stats.avgFamiliarity}</p>
          <p className="text-2xl font-semibold">{formatProbability(allWordsSummary.averageFamiliarity)}</p>
        </div>
      </div>

      {/* Default Filters Bar */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleFilterSectionToggle}
            className="text-sm text-blue-600 underline"
          >
            {str.all.filters.title}
          </button>
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs text-blue-600 underline disabled:opacity-50"
            disabled={!filterDueNow && filterFamiliarityValue === "" && filterSelectedTagIds.length === 0}
          >
            {str.all.filters.clearButton}
          </button>
        </div>

        {filterSectionOpen && (
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
            {/* Due Now + Familiarity in flex row on the left */}
            <div className="flex gap-12 items-start">
              {/* Due Now Filter */}
              <div className="pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterDueNow}
                  onChange={(e) => setFilterDueNow(e.target.checked)}
                  title={str.all.filters.dueNow.tooltip}
                />
                <span className="text-sm">{str.all.filters.dueNow.label}</span>
              </label>
            </div>

            {/* Familiarity Filter */}
            <div className="flex-grow space-y-1">
              <label className="block text-xs text-gray-600">{str.all.filters.familiarity.label}</label>
              <div className="flex gap-2 items-center">
                <select
                  className="flex-shrink-0 rounded-md border px-2 py-1 text-sm"
                  value={filterFamiliarityOperator}
                  onChange={(e) => setFilterFamiliarityOperator(e.target.value as "<=" | ">=")}
                  title={str.all.filters.familiarity.tooltip}
                >
                  <option value="<=">{str.all.filters.familiarity.operators.lessThanOrEqual}</option>
                  <option value=">=">{str.all.filters.familiarity.operators.greaterThanOrEqual}</option>
                </select>
                <input
                  type="number"
                  className="flex-grow rounded-md border px-2 py-1 text-sm"
                  min="0"
                  max="100"
                  placeholder={str.all.filters.familiarity.valueLabel}
                  value={filterFamiliarityValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterFamiliarityValue(val === "" ? "" : Math.max(0, Math.min(100, Number(val))));
                  }}
                  title={str.all.filters.familiarity.tooltip}
                />
              </div>
            </div>
          </div>

          {/* Tags Filter */}
          <div className="space-y-1 pt-0">
            <label className="block text-xs text-gray-600">{str.all.filters.tags.label}</label>
            <details className="group">
              <summary className="cursor-pointer rounded-md border px-2 py-1 text-sm bg-gray-50 hover:bg-gray-100">
                {filterSelectedTagIds.length === 0
                  ? str.all.filters.tags.placeholder
                  : `${filterSelectedTagIds.length} selected`}
              </summary>
              <div className="mt-2 space-y-1 max-h-96 overflow-y-auto border rounded-md p-2 bg-white">
                {availableTagsWithIds.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2">{str.all.filters.tags.placeholder}</p>
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

      {/* Batch tag editor — hidden for child role */}

      {!isChild && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleBatchTagToggle}
              className="text-sm text-blue-600 underline"
            >
              {allEditorStr.title}
            </button>
          </div>

          {batchTagSectionOpen && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-600">
                  {allEditorStr.selectedCount.replace("{count}", String(selectedWordIds.length))}
                </p>
              </div>

              {editorNotice ? <p className="text-sm text-blue-700">{editorNotice}</p> : null}

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <label className="block text-xs text-gray-500">{addTagStr.textbookPlaceholder}</label>
                  {!textbookCreateMode ? (
                    <select
                      className="w-full rounded-md border px-2 py-1 text-sm disabled:opacity-50"
                      value={batchTextbookId ?? ""}
                      onChange={(event) => {
                        if (event.target.value === "__create__") {
                          setTextbookCreateMode(true);
                          return;
                        }

                        handleBatchTextbookSelect(event.target.value);
                      }}
                      disabled={textbooksLoading || editorSaving}
                    >
                      <option value="">
                        {textbooksLoading ? addTagStr.loadingTextbooks : addTagStr.textbookPlaceholder}
                      </option>
                      {textbooks.map((tb) => (
                        <option key={tb.id} value={tb.id}>
                          {tb.name}
                        </option>
                      ))}
                      <option value="__create__">{addTagStr.createNewOption}</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        className="w-full rounded-md border px-2 py-1 text-sm disabled:opacity-50"
                        placeholder={addTagStr.createNewPlaceholder}
                        value={textbookInputValue}
                        onChange={(event) => setTextbookInputValue(event.target.value)}
                        disabled={textbookCreating || editorSaving}
                      />
                      <button
                        type="button"
                        className="rounded border-2 border-emerald-600 bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                        onClick={() => void handleCreateNewTextbook()}
                        disabled={!textbookInputValue.trim() || textbookCreating || editorSaving}
                      >
                        {textbookCreating ? addTagStr.creatingTextbook : addTagStr.createNewConfirm}
                      </button>
                      <button
                        type="button"
                        className="rounded border-2 border-gray-400 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 disabled:opacity-50"
                        onClick={() => {
                          setTextbookCreateMode(false);
                          setTextbookInputValue("");
                        }}
                        disabled={textbookCreating || editorSaving}
                      >
                        {addTagStr.createNewCancel}
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-500">{addTagStr.gradePlaceholder}</label>
                  {!batchGradeCreateMode ? (
                    <select
                      className="w-full rounded-md border px-2 py-1 text-sm disabled:opacity-50"
                      value={batchGrade ?? ""}
                      onChange={(event) => {
                        if (event.target.value === "__custom__") {
                          setBatchGradeCreateMode(true);
                          return;
                        }
                        setBatchGrade(event.target.value || null);
                        setBatchUnit(null);
                        setBatchLesson(null);
                        setBatchUnitCreateMode(false);
                        setBatchUnitInputValue("");
                        setBatchLessonCreateMode(false);
                        setBatchLessonInputValue("");
                      }}
                      disabled={!batchTextbookId || editorSaving}
                    >
                      <option value="">{addTagStr.gradePlaceholder}</option>
                      {gradeOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                      <option value="__custom__">{addTagStr.customValueOption}</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        className="w-full rounded-md border px-2 py-1 text-sm disabled:opacity-50"
                        placeholder={addTagStr.gradePlaceholder}
                        value={batchGradeInputValue}
                        onChange={(event) => setBatchGradeInputValue(event.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="rounded border-2 border-emerald-600 bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                        onClick={() => {
                          setBatchGrade(batchGradeInputValue || null);
                          setBatchUnit(null);
                          setBatchLesson(null);
                          setBatchUnitCreateMode(false);
                          setBatchUnitInputValue("");
                          setBatchLessonCreateMode(false);
                          setBatchLessonInputValue("");
                          setBatchGradeCreateMode(false);
                          setBatchGradeInputValue("");
                        }}
                        disabled={!batchGradeInputValue.trim() || editorSaving}
                      >
                        {addTagStr.createNewConfirm}
                      </button>
                      <button
                        type="button"
                        className="rounded border-2 border-gray-400 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 disabled:opacity-50"
                        onClick={() => {
                          setBatchGradeCreateMode(false);
                          setBatchGradeInputValue("");
                        }}
                        disabled={editorSaving}
                      >
                        {addTagStr.createNewCancel}
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-500">{addTagStr.unitPlaceholder}</label>
                  {!batchUnitCreateMode ? (
                    <select
                      className="w-full rounded-md border px-2 py-1 text-sm disabled:opacity-50"
                      value={batchUnit ?? ""}
                      onChange={(event) => {
                        if (event.target.value === "__custom__") {
                          setBatchUnitCreateMode(true);
                          return;
                        }
                        setBatchUnit(event.target.value || null);
                        setBatchLesson(null);
                        setBatchLessonCreateMode(false);
                        setBatchLessonInputValue("");
                      }}
                      disabled={!batchGrade || editorSaving}
                    >
                      <option value="">{addTagStr.unitPlaceholder}</option>
                      {unitOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                      <option value="__custom__">{addTagStr.customValueOption}</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        className="w-full rounded-md border px-2 py-1 text-sm disabled:opacity-50"
                        placeholder={addTagStr.unitPlaceholder}
                        value={batchUnitInputValue}
                        onChange={(event) => setBatchUnitInputValue(event.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="rounded border-2 border-emerald-600 bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                        onClick={() => {
                          setBatchUnit(batchUnitInputValue || null);
                          setBatchLesson(null);
                          setBatchLessonCreateMode(false);
                          setBatchLessonInputValue("");
                          setBatchUnitCreateMode(false);
                          setBatchUnitInputValue("");
                        }}
                        disabled={!batchUnitInputValue.trim() || editorSaving}
                      >
                        {addTagStr.createNewConfirm}
                      </button>
                      <button
                        type="button"
                        className="rounded border-2 border-gray-400 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 disabled:opacity-50"
                        onClick={() => {
                          setBatchUnitCreateMode(false);
                          setBatchUnitInputValue("");
                        }}
                        disabled={editorSaving}
                      >
                        {addTagStr.createNewCancel}
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-500">{addTagStr.lessonPlaceholder}</label>
                  {!batchLessonCreateMode ? (
                    <select
                      className="w-full rounded-md border px-2 py-1 text-sm disabled:opacity-50"
                      value={batchLesson ?? ""}
                      onChange={(event) => {
                        if (event.target.value === "__custom__") {
                          setBatchLessonCreateMode(true);
                          return;
                        }
                        setBatchLesson(event.target.value || null);
                      }}
                      disabled={!batchUnit || editorSaving}
                    >
                      <option value="">{addTagStr.lessonPlaceholder}</option>
                      {lessonOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                      <option value="__custom__">{addTagStr.customValueOption}</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        className="w-full rounded-md border px-2 py-1 text-sm disabled:opacity-50"
                        placeholder={addTagStr.lessonPlaceholder}
                        value={batchLessonInputValue}
                        onChange={(event) => setBatchLessonInputValue(event.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="rounded border-2 border-emerald-600 bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                        onClick={() => {
                          setBatchLesson(batchLessonInputValue || null);
                          setBatchLessonCreateMode(false);
                          setBatchLessonInputValue("");
                        }}
                        disabled={!batchLessonInputValue.trim() || editorSaving}
                      >
                        {addTagStr.createNewConfirm}
                      </button>
                      <button
                        type="button"
                        className="rounded border-2 border-gray-400 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 disabled:opacity-50"
                        onClick={() => {
                          setBatchLessonCreateMode(false);
                          setBatchLessonInputValue("");
                        }}
                        disabled={editorSaving}
                      >
                        {addTagStr.createNewCancel}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border-2 border-emerald-600 bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
                  onClick={() => void handleBatchSave()}
                  disabled={editorSaving || tagClearing}
                  title={allEditorStr.tooltips.saveBatch}
                >
                  {editorSaving && editorAction === "add" ? allEditorStr.savingBatch : allEditorStr.saveBatch}
                </button>
                <button
                  type="button"
                  className="rounded-md border-2 border-sky-300 bg-sky-50 px-4 py-2 font-medium text-sky-800 disabled:opacity-50"
                  onClick={() => void handleBatchUpdateTags()}
                  disabled={selectedWordIds.length === 0 || editorSaving || tagClearing}
                  title={allEditorStr.tooltips.updateTags}
                >
                  {editorSaving && editorAction === "update" ? allEditorStr.updatingTags : allEditorStr.updateTags}
                </button>
                <button
                  type="button"
                  className="rounded-md border-2 border-rose-500 bg-rose-50 px-4 py-2 font-medium text-rose-700 disabled:opacity-50"
                  onClick={() => void handleBatchClearTags()}
                  disabled={tagClearing || selectedWordIds.length === 0 || editorSaving}
                  title={allEditorStr.tooltips.clearTags}
                >
                  {tagClearing ? allEditorStr.clearingTags : allEditorStr.clearTags}
                </button>
                <button
                  type="button"
                  className="rounded-md border-2 border-gray-400 bg-gray-100 px-4 py-2 font-medium text-gray-700 disabled:opacity-50"
                  onClick={() => setSelectedWordIds([])}
                  disabled={selectedWordIds.length === 0 || editorSaving || tagClearing}
                  title={allEditorStr.tooltips.clearSelection}
                >
                  {allEditorStr.clearSelection}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p>{str.common.loading}</p>
      ) : words.length === 0 ? (
        <p>{str.all.noCharacters}</p>
      ) : filteredWords.length === 0 && (filterDueNow || filterFamiliarityValue !== "" || filterSelectedTagIds.length > 0) ? (
        <div className="flex items-center justify-between rounded-lg border p-4 bg-blue-50">
          <p>{str.all.filters.noMatch}</p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-sm text-blue-600 underline font-medium"
          >
            {str.all.filters.clearButton}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {!isChild ? (
            <p className="text-sm text-gray-600">
              {hasActiveFilters ? (
                <>
                  {str.all.table.summary.filteredLabel}{" "}
                  <span className="font-semibold text-blue-700">{filteredWords.length}</span>
                </>
              ) : (
                str.all.table.summary.noFiltersApplied
              )}
              {str.all.table.summary.separator}
              {str.all.table.summary.selectedLabel}{" "}
              <span className="font-semibold text-blue-700">{selectedWordIds.length}</span>
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                {!isChild && (
                  <th className="px-3 py-2 text-left">
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(event) => toggleAllVisibleSelection(event.target.checked)}
                        title={allEditorStr.tooltips.selectAllVisible}
                      />
                      {allEditorStr.selectAllVisible}
                    </label>
                  </th>
                )}
                <th className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleAllWordsSort("hanzi")}
                  >
                    {str.all.table.headers.character} <span aria-hidden>{getSortIndicator("hanzi")}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleAllWordsSort("createdAt")}
                  >
                    {str.all.table.headers.dateAdded} <span aria-hidden>{getSortIndicator("createdAt")}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleAllWordsSort("nextReviewAt")}
                  >
                    {str.all.table.headers.nextReviewDate}{" "}
                    <span aria-hidden>{getSortIndicator("nextReviewAt")}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleAllWordsSort("reviewCount")}
                  >
                    {str.all.table.headers.reviewCount} <span aria-hidden>{getSortIndicator("reviewCount")}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleAllWordsSort("testCount")}
                  >
                    {str.all.table.headers.testCount} <span aria-hidden>{getSortIndicator("testCount")}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleAllWordsSort("familiarity")}
                  >
                    {str.all.table.headers.familiarity} <span aria-hidden>{getSortIndicator("familiarity")}</span>
                  </button>
                </th>
                {!isChild && (
                  <th className="px-3 py-2 text-left">{tagStr.header}</th>
                )}
                {!isChild && <th className="px-3 py-2 text-left">{str.all.table.headers.actions}</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedWords.map(({ word, reviewCount, testCount, familiarity }) => (
                <tr key={word.id} className="border-b align-top">
                  {!isChild && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedWordIds.includes(word.id)}
                        onChange={(event) => toggleWordSelection(word.id, event.target.checked)}
                        aria-label={`${allEditorStr.title}: ${word.hanzi}`}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2">{word.hanzi}</td>
                  <td className="px-3 py-2">{formatDateTime(word.createdAt)}</td>
                  <td className="px-3 py-2">{formatDateTime(word.nextReviewAt)}</td>
                  <td className="px-3 py-2">{reviewCount}</td>
                  <td className="px-3 py-2">{testCount}</td>
                  <td className="px-3 py-2">{formatProbability(familiarity)}</td>
                  {!isChild && (
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        {(wordTagsMap.get(word.id) ?? []).map((tag) => (
                          <span
                            key={tag.lessonTagId}
                            className="inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-800"
                          >
                            {tag.textbookName} · {tag.grade} · {tag.unit} · {tag.lesson}
                          </span>
                        ))}
                      </div>
                    </td>
                  )}
                  {!isChild && (
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        className="rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900"
                        onClick={() => resetWord(word)}
                        title={str.all.table.tooltips.reset}
                        aria-label={str.all.table.buttons.reset}
                      >
                        {str.all.table.buttons.reset}
                      </button>
                      <button
                        type="button"
                        className="rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700"
                        onClick={() => removeWord(word)}
                        title={str.all.table.tooltips.delete}
                        aria-label={str.all.table.buttons.delete}
                      >
                        {str.all.table.buttons.delete}
                      </button>
                    </div>
                  </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-3">
              <div className="text-sm text-gray-600">
                {str.all.pagination.pageInfo
                  .replace("{current}", String(validPage))
                  .replace("{total}", String(totalPages))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
                  onClick={() => setCurrentPage(1)}
                  disabled={validPage === 1}
                  title={str.all.pagination.firstButton}
                >
                  {str.all.pagination.firstButton}
                </button>
                <button
                  type="button"
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
                  onClick={() => setCurrentPage(validPage - 1)}
                  disabled={validPage === 1}
                  title={str.all.pagination.previousButton}
                >
                  {str.all.pagination.previousButton}
                </button>
                <button
                  type="button"
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
                  onClick={() => setCurrentPage(validPage + 1)}
                  disabled={validPage === totalPages}
                  title={str.all.pagination.nextButton}
                >
                  {str.all.pagination.nextButton}
                </button>
                <button
                  type="button"
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={validPage === totalPages}
                  title={str.all.pagination.lastButton}
                >
                  {str.all.pagination.lastButton}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
