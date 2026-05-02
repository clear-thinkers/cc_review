"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/authContext";
import { useLocale } from "@/app/shared/locale";
import { taggingStrings } from "../shared/tagging.strings";
import { assignWordLessonTags, clearWordLessonTags, createLessonTagIfNew, createTextbook, listLessonTags, listTextbooks, putWord } from "@/lib/supabase-service";
import type { LessonTag, Textbook } from "../shared/tagging.types";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import {
  getAllTagFilterOptionIds,
  matchesSelectedTagFilter,
  NO_TAG_FILTER_ID,
  toggleTagFilterId,
} from "../shared/tagFilter.utils";
import { matchesCharacterSearchFilter } from "../shared/words.shared.utils";
import { matchesFamiliarityFilter } from "./all.utils";

function appendSelectedOption(options: string[], selectedValue: string | null): string[] {
  const trimmedValue = selectedValue?.trim();
  if (!trimmedValue || options.includes(trimmedValue)) {
    return options;
  }

  return [...options, trimmedValue].sort();
}

export default function AllWordsSection({ vm }: { vm: WordsWorkspaceVM }) {
  const {
    page,
    str,
    allFlashcardContents,
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
  const [batchResetting, setBatchResetting] = useState(false);
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
  const [filterTagTextbooks, setFilterTagTextbooks] = useState<string[]>([]);
  const [filterTagGrades, setFilterTagGrades] = useState<string[]>([]);
  const [filterTagUnits, setFilterTagUnits] = useState<string[]>([]);
  const [filterTagLessons, setFilterTagLessons] = useState<string[]>([]);
  const [filterHasContent, setFilterHasContent] = useState<"" | "yes" | "no">("");
  const [filterCharacterSearch, setFilterCharacterSearch] = useState("");
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

  const hanziWithContent = useMemo(
    () => new Set(allFlashcardContents.map((e) => e.character)),
    [allFlashcardContents]
  );

  // Cascade options for partial tag filter
  const partialFilterTextbookOptions = useMemo(
    () => Array.from(new Set(availableTagsWithIds.map((t) => t.textbookName))),
    [availableTagsWithIds]
  );
  const partialFilterGradeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          availableTagsWithIds
            .filter((t) => filterTagTextbooks.length === 0 || filterTagTextbooks.includes(t.textbookName))
            .map((t) => t.grade)
        )
      ),
    [availableTagsWithIds, filterTagTextbooks]
  );
  const partialFilterUnitOptions = useMemo(
    () =>
      Array.from(
        new Set(
          availableTagsWithIds
            .filter(
              (t) =>
                (filterTagTextbooks.length === 0 || filterTagTextbooks.includes(t.textbookName)) &&
                (filterTagGrades.length === 0 || filterTagGrades.includes(t.grade))
            )
            .map((t) => t.unit)
        )
      ),
    [availableTagsWithIds, filterTagTextbooks, filterTagGrades]
  );
  const partialFilterLessonOptions = useMemo(
    () =>
      Array.from(
        new Set(
          availableTagsWithIds
            .filter(
              (t) =>
                (filterTagTextbooks.length === 0 || filterTagTextbooks.includes(t.textbookName)) &&
                (filterTagGrades.length === 0 || filterTagGrades.includes(t.grade)) &&
                (filterTagUnits.length === 0 || filterTagUnits.includes(t.unit))
            )
            .map((t) => t.lesson)
        )
      ),
    [availableTagsWithIds, filterTagTextbooks, filterTagGrades, filterTagUnits]
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
      if (!matchesFamiliarityFilter(familiarity, filterFamiliarityOperator, filterFamiliarityValue)) {
        return false;
      }

      // Filter: Tags (OR logic - word must have any selected tag)
      if (filterSelectedTagIds.length > 0) {
        const wordTags = wordTagsMap.get(word.id) ?? [];
        const wordTagIds = new Set(wordTags.map((t) => t.lessonTagId));
        if (!matchesSelectedTagFilter(wordTagIds, filterSelectedTagIds)) return false;
      }

      // Filter: Partial tag (textbook/grade/unit/lesson) — AND with full tag filter
      if (filterTagTextbooks.length > 0 || filterTagGrades.length > 0 || filterTagUnits.length > 0 || filterTagLessons.length > 0) {
        const wordTags = wordTagsMap.get(word.id) ?? [];
        const hasMatchingTag = wordTags.some(
          (t) =>
            (filterTagTextbooks.length === 0 || filterTagTextbooks.includes(t.textbookName)) &&
            (filterTagGrades.length === 0 || filterTagGrades.includes(t.grade)) &&
            (filterTagUnits.length === 0 || filterTagUnits.includes(t.unit)) &&
            (filterTagLessons.length === 0 || filterTagLessons.includes(t.lesson))
        );
        if (!hasMatchingTag) return false;
      }

      // Filter: Has Content
      if (filterHasContent === "yes" && !hanziWithContent.has(word.hanzi)) return false;
      if (filterHasContent === "no" && hanziWithContent.has(word.hanzi)) return false;

      // Filter: Character search
      if (!matchesCharacterSearchFilter(word.hanzi, filterCharacterSearch)) return false;

      return true;
    });
  }, [
    sortedAllWords,
    filterDueNow,
    filterFamiliarityOperator,
    filterFamiliarityValue,
    filterSelectedTagIds,
    filterTagTextbooks,
    filterTagGrades,
    filterTagUnits,
    filterTagLessons,
    filterHasContent,
    filterCharacterSearch,
    wordTagsMap,
    hanziWithContent,
  ]);

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
  }, [filterDueNow, filterFamiliarityValue, filterSelectedTagIds, filterTagTextbooks, filterTagGrades, filterTagUnits, filterTagLessons, filterHasContent, filterCharacterSearch]);

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
  const hasActivePartialTagFilter = filterTagTextbooks.length > 0 || filterTagGrades.length > 0 || filterTagUnits.length > 0 || filterTagLessons.length > 0;
  const hasActiveFilters =
    filterDueNow ||
    filterFamiliarityValue !== "" ||
    filterSelectedTagIds.length > 0 ||
    hasActivePartialTagFilter ||
    filterHasContent !== "" ||
    filterCharacterSearch.trim() !== "";

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
    ? appendSelectedOption([...new Set(lessonTags.map((item) => item.grade))].sort(), batchGrade)
    : [];
  const unitOptions =
    batchTextbookId && batchGrade
      ? appendSelectedOption(
          [...new Set(lessonTags.filter((item) => item.grade === batchGrade).map((item) => item.unit))].sort(),
          batchUnit
        )
      : [];
  const lessonOptions =
    batchTextbookId && batchGrade && batchUnit
      ? appendSelectedOption(
          [
            ...new Set(
              lessonTags
                .filter((item) => item.grade === batchGrade && item.unit === batchUnit)
                .map((item) => item.lesson)
            ),
          ].sort(),
          batchLesson
        )
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

  async function handleBatchResetSelected(): Promise<void> {
    if (selectedWordIds.length === 0) {
      return;
    }

    const selectedWords = words.filter((word) => selectedWordIds.includes(word.id));
    if (selectedWords.length === 0) {
      setSelectedWordIds([]);
      return;
    }

    setBatchResetting(true);
    try {
      const resetTimestamp = Date.now();
      await Promise.all(
        selectedWords.map((word) =>
          putWord({
            ...word,
            createdAt: resetTimestamp,
            repetitions: 0,
            intervalDays: 0,
            ease: 21,
            nextReviewAt: 0,
            reviewCount: 0,
            testCount: 0,
          })
        )
      );
      await refreshAllData();
      setSelectedWordIds([]);
    } catch (error) {
      console.error("[all-reset] Batch reset failed", error);
    } finally {
      setBatchResetting(false);
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
    setFilterTagTextbooks([]);
    setFilterTagGrades([]);
    setFilterTagUnits([]);
    setFilterTagLessons([]);
    setFilterHasContent("");
    setFilterCharacterSearch("");
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
            disabled={!hasActiveFilters}
          >
            {str.all.filters.clearButton}
          </button>
        </div>

        {filterSectionOpen && (
          <div className="space-y-4">
            {/* Character Search */}
            <div className="space-y-1">
              <label className="block text-xs text-gray-600">
                {str.all.filters.characterSearch.label}
              </label>
              <input
                type="text"
                className="rounded-md border px-2 py-1 text-sm w-full max-w-xs"
                placeholder={str.all.filters.characterSearch.placeholder}
                value={filterCharacterSearch}
                onChange={(e) => setFilterCharacterSearch(e.target.value)}
              />
            </div>

            {/* Row 1: Tag-related filters */}
            <div className="flex gap-6 items-start">
              {/* Tags (full multi-select) */}
              <div className="space-y-1 flex-1">
                <label className="block text-xs text-gray-600">{str.all.filters.tags.label}</label>
                <details className="group">
                  <summary className="cursor-pointer rounded-md border px-2 py-1 text-sm bg-gray-50 hover:bg-gray-100">
                    {filterSelectedTagIds.length === 0
                      ? str.all.filters.tags.placeholder
                      : str.all.filters.tags.selectedCount.replace("{count}", String(filterSelectedTagIds.length))}
                  </summary>
                  <div className="mt-2 space-y-1 max-h-96 overflow-y-auto border rounded-md p-2 bg-white">
                    <div className="mb-2 flex flex-wrap items-center gap-2 border-b pb-2">
                      <button
                        type="button"
                        className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-secondary disabled:opacity-50"
                        onClick={() => setFilterSelectedTagIds(getAllTagFilterOptionIds(availableTagsWithIds))}
                        disabled={availableTagsWithIds.length === 0}
                      >
                        {str.all.filters.tags.selectAll}
                      </button>
                      <button
                        type="button"
                        className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-neutral disabled:opacity-50"
                        onClick={() => setFilterSelectedTagIds([])}
                        disabled={filterSelectedTagIds.length === 0}
                      >
                        {str.all.filters.tags.clearAll}
                      </button>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded text-xs">
                      <input
                        type="checkbox"
                        checked={filterSelectedTagIds.includes(NO_TAG_FILTER_ID)}
                        onChange={(e) =>
                          setFilterSelectedTagIds((prev) =>
                            toggleTagFilterId(prev, NO_TAG_FILTER_ID, e.target.checked)
                          )
                        }
                      />
                      <span>{str.all.filters.tags.noneOption}</span>
                    </label>
                    {availableTagsWithIds.map((tag) => {
                      const tagDisplay = `${tag.textbookName} · ${tag.grade} · ${tag.unit} · ${tag.lesson}`;
                      const isSelected = filterSelectedTagIds.includes(tag.id);
                      return (
                        <label key={tag.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded text-xs">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) =>
                              setFilterSelectedTagIds((prev) =>
                                toggleTagFilterId(prev, tag.id, e.target.checked)
                              )
                            }
                          />
                          <span>{tagDisplay}</span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              </div>

              {/* Filter by Tag Part (2×2 cascade multi-select) */}
              <div className="space-y-1 flex-1">
                <label className="block text-xs text-gray-600">{str.all.filters.partialTag.label}</label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Textbook */}
                  <div className="space-y-0.5">
                    <label className="block text-[11px] text-gray-500">{str.all.filters.partialTag.textbookLabel}</label>
                    <details className="group">
                      <summary className="cursor-pointer rounded-md border px-2 py-1 text-xs bg-gray-50 hover:bg-gray-100">
                        {filterTagTextbooks.length === 0
                          ? str.all.filters.partialTag.allOption
                          : str.all.filters.partialTag.selectedCount.replace("{count}", String(filterTagTextbooks.length))}
                      </summary>
                      <div className="mt-1 space-y-1 max-h-48 overflow-y-auto border rounded-md p-1.5 bg-white z-10 relative">
                        {partialFilterTextbookOptions.map((tb) => (
                          <label key={tb} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded text-xs">
                            <input
                              type="checkbox"
                              checked={filterTagTextbooks.includes(tb)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...filterTagTextbooks, tb]
                                  : filterTagTextbooks.filter((x) => x !== tb);
                                setFilterTagTextbooks(next);
                                setFilterTagGrades((prev) => prev.filter((g) => partialFilterGradeOptions.includes(g)));
                                setFilterTagUnits((prev) => prev.filter((u) => partialFilterUnitOptions.includes(u)));
                                setFilterTagLessons((prev) => prev.filter((l) => partialFilterLessonOptions.includes(l)));
                              }}
                            />
                            <span>{tb}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>
                  {/* Grade */}
                  <div className="space-y-0.5">
                    <label className="block text-[11px] text-gray-500">{str.all.filters.partialTag.gradeLabel}</label>
                    <details className="group">
                      <summary className="cursor-pointer rounded-md border px-2 py-1 text-xs bg-gray-50 hover:bg-gray-100">
                        {filterTagGrades.length === 0
                          ? str.all.filters.partialTag.allOption
                          : str.all.filters.partialTag.selectedCount.replace("{count}", String(filterTagGrades.length))}
                      </summary>
                      <div className="mt-1 space-y-1 max-h-48 overflow-y-auto border rounded-md p-1.5 bg-white z-10 relative">
                        {partialFilterGradeOptions.map((g) => (
                          <label key={g} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded text-xs">
                            <input
                              type="checkbox"
                              checked={filterTagGrades.includes(g)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...filterTagGrades, g]
                                  : filterTagGrades.filter((x) => x !== g);
                                setFilterTagGrades(next);
                                setFilterTagUnits((prev) => prev.filter((u) => partialFilterUnitOptions.includes(u)));
                                setFilterTagLessons((prev) => prev.filter((l) => partialFilterLessonOptions.includes(l)));
                              }}
                            />
                            <span>{g}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>
                  {/* Unit */}
                  <div className="space-y-0.5">
                    <label className="block text-[11px] text-gray-500">{str.all.filters.partialTag.unitLabel}</label>
                    <details className="group">
                      <summary className="cursor-pointer rounded-md border px-2 py-1 text-xs bg-gray-50 hover:bg-gray-100">
                        {filterTagUnits.length === 0
                          ? str.all.filters.partialTag.allOption
                          : str.all.filters.partialTag.selectedCount.replace("{count}", String(filterTagUnits.length))}
                      </summary>
                      <div className="mt-1 space-y-1 max-h-48 overflow-y-auto border rounded-md p-1.5 bg-white z-10 relative">
                        {partialFilterUnitOptions.map((u) => (
                          <label key={u} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded text-xs">
                            <input
                              type="checkbox"
                              checked={filterTagUnits.includes(u)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...filterTagUnits, u]
                                  : filterTagUnits.filter((x) => x !== u);
                                setFilterTagUnits(next);
                                setFilterTagLessons((prev) => prev.filter((l) => partialFilterLessonOptions.includes(l)));
                              }}
                            />
                            <span>{u}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>
                  {/* Lesson */}
                  <div className="space-y-0.5">
                    <label className="block text-[11px] text-gray-500">{str.all.filters.partialTag.lessonLabel}</label>
                    <details className="group">
                      <summary className="cursor-pointer rounded-md border px-2 py-1 text-xs bg-gray-50 hover:bg-gray-100">
                        {filterTagLessons.length === 0
                          ? str.all.filters.partialTag.allOption
                          : str.all.filters.partialTag.selectedCount.replace("{count}", String(filterTagLessons.length))}
                      </summary>
                      <div className="mt-1 space-y-1 max-h-48 overflow-y-auto border rounded-md p-1.5 bg-white z-10 relative">
                        {partialFilterLessonOptions.map((l) => (
                          <label key={l} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded text-xs">
                            <input
                              type="checkbox"
                              checked={filterTagLessons.includes(l)}
                              onChange={(e) => {
                                setFilterTagLessons((prev) =>
                                  e.target.checked ? [...prev, l] : prev.filter((x) => x !== l)
                                );
                              }}
                            />
                            <span>{l}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              </div>

            </div>

            {/* Row 2: Due Now + Familiarity + Has Content */}
            <div className="flex flex-wrap gap-8 items-start border-t pt-3">
              <div className="pt-5">
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
              <div className="space-y-1">
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
                    className="w-44 rounded-md border px-2 py-1 text-sm"
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
              {/* Has Content filter */}
              <div className="space-y-1">
                <label className="block text-xs text-gray-600">{str.all.filters.hasContent.label}</label>
                <select
                  className="rounded-md border px-2 py-1 text-sm bg-white"
                  value={filterHasContent}
                  onChange={(e) => setFilterHasContent(e.target.value as "" | "yes" | "no")}
                >
                  <option value="">{str.all.filters.hasContent.all}</option>
                  <option value="yes">{str.all.filters.hasContent.yes}</option>
                  <option value="no">{str.all.filters.hasContent.no}</option>
                </select>
              </div>
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
                        className="rounded border-2 px-2 py-1 text-xs font-medium btn-primary disabled:opacity-50"
                        onClick={() => void handleCreateNewTextbook()}
                        disabled={!textbookInputValue.trim() || textbookCreating || editorSaving}
                      >
                        {textbookCreating ? addTagStr.creatingTextbook : addTagStr.createNewConfirm}
                      </button>
                      <button
                        type="button"
                        className="rounded border-2 px-2 py-1 text-xs font-medium btn-neutral disabled:opacity-50"
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
                        className="rounded border-2 px-2 py-1 text-xs font-medium btn-primary disabled:opacity-50"
                        onClick={() => {
                          const customGrade = batchGradeInputValue.trim();
                          setBatchGrade(customGrade || null);
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
                        className="rounded border-2 px-2 py-1 text-xs font-medium btn-neutral disabled:opacity-50"
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
                        className="rounded border-2 px-2 py-1 text-xs font-medium btn-primary disabled:opacity-50"
                        onClick={() => {
                          const customUnit = batchUnitInputValue.trim();
                          setBatchUnit(customUnit || null);
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
                        className="rounded border-2 px-2 py-1 text-xs font-medium btn-neutral disabled:opacity-50"
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
                        className="rounded border-2 px-2 py-1 text-xs font-medium btn-primary disabled:opacity-50"
                        onClick={() => {
                          const customLesson = batchLessonInputValue.trim();
                          setBatchLesson(customLesson || null);
                          setBatchLessonCreateMode(false);
                          setBatchLessonInputValue("");
                        }}
                        disabled={!batchLessonInputValue.trim() || editorSaving}
                      >
                        {addTagStr.createNewConfirm}
                      </button>
                      <button
                        type="button"
                        className="rounded border-2 px-2 py-1 text-xs font-medium btn-neutral disabled:opacity-50"
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
                  className="rounded-md border-2 px-4 py-2 font-medium btn-primary disabled:opacity-50"
                  onClick={() => void handleBatchSave()}
                  disabled={editorSaving || tagClearing}
                  title={allEditorStr.tooltips.saveBatch}
                >
                  {editorSaving && editorAction === "add" ? allEditorStr.savingBatch : allEditorStr.saveBatch}
                </button>
                <button
                  type="button"
                  className="rounded-md border-2 px-4 py-2 font-medium btn-secondary disabled:opacity-50"
                  onClick={() => void handleBatchUpdateTags()}
                  disabled={selectedWordIds.length === 0 || editorSaving || tagClearing}
                  title={allEditorStr.tooltips.updateTags}
                >
                  {editorSaving && editorAction === "update" ? allEditorStr.updatingTags : allEditorStr.updateTags}
                </button>
                <button
                  type="button"
                  className="rounded-md border-2 px-4 py-2 font-medium btn-destructive disabled:opacity-50"
                  onClick={() => void handleBatchClearTags()}
                  disabled={tagClearing || selectedWordIds.length === 0 || editorSaving}
                  title={allEditorStr.tooltips.clearTags}
                >
                  {tagClearing ? allEditorStr.clearingTags : allEditorStr.clearTags}
                </button>
                <button
                  type="button"
                  className="rounded-md border-2 px-4 py-2 font-medium btn-neutral disabled:opacity-50"
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
      ) : filteredWords.length === 0 && hasActiveFilters ? (
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
            <div className="flex flex-wrap items-center gap-3">
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
              <button
                type="button"
                className="rounded-full border-2 px-4 py-1 text-sm font-medium btn-caution disabled:opacity-50"
                onClick={() => void handleBatchResetSelected()}
                disabled={selectedWordIds.length === 0 || batchResetting || editorSaving || tagClearing}
                title={str.all.table.tooltips.reset}
              >
                {batchResetting ? str.all.table.buttons.resetting : str.all.table.buttons.reset}
              </button>
            </div>
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
                        className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-caution"
                        onClick={() => resetWord(word)}
                        title={str.all.table.tooltips.reset}
                        aria-label={str.all.table.buttons.reset}
                      >
                        {str.all.table.buttons.reset}
                      </button>
                      <button
                        type="button"
                        className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-destructive"
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
                  className="btn-nav rounded border-2 px-3 py-1 text-sm hover:bg-[#fff1cd] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setCurrentPage(1)}
                  disabled={validPage === 1}
                  title={str.all.pagination.firstButton}
                >
                  {str.all.pagination.firstButton}
                </button>
                <button
                  type="button"
                  className="btn-nav rounded border-2 px-3 py-1 text-sm hover:bg-[#fff1cd] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setCurrentPage(validPage - 1)}
                  disabled={validPage === 1}
                  title={str.all.pagination.previousButton}
                >
                  {str.all.pagination.previousButton}
                </button>
                <button
                  type="button"
                  className="btn-nav rounded border-2 px-3 py-1 text-sm hover:bg-[#fff1cd] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setCurrentPage(validPage + 1)}
                  disabled={validPage === totalPages}
                  title={str.all.pagination.nextButton}
                >
                  {str.all.pagination.nextButton}
                </button>
                <button
                  type="button"
                  className="btn-nav rounded border-2 px-3 py-1 text-sm hover:bg-[#fff1cd] disabled:cursor-not-allowed disabled:opacity-50"
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
