"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/authContext";
import { useLocale } from "@/app/shared/locale";
import {
  assignVocabPhraseLessonTags,
  deleteVocabPhrase,
  getVocabPhraseLessonTagsForFamily,
  listVocabPhrases,
} from "@/lib/supabase-service";
import type { VocabPhrase } from "@/lib/types";
import type { VocabPhraseLessonTagsMap } from "@/lib/tagging.types";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import TagCascadePicker from "../shared/TagCascadePicker";
import { taggingStrings } from "../shared/tagging.strings";
import {
  getAllTagFilterOptionIds,
  hasActivePartialTagFilter,
  matchesPartialTagFilter,
  matchesSelectedTagFilter,
  NO_TAG_FILTER_ID,
  toggleTagFilterId,
} from "../shared/tagFilter.utils";
import { vocabPhraseHasContent } from "../admin/vocabPhraseAdmin.utils";
import { getAddedCharactersInPhrase } from "./all.utils";

const ITEMS_PER_PAGE = 50;

type PhraseSortKey = "phrase" | "addedCharacters" | "createdAt" | "testCount";

export default function AllVocabPhraseSection({ vm }: { vm: WordsWorkspaceVM }) {
  const { str, words, formatDateTime } = vm;
  const locale = useLocale();
  const tagStr = taggingStrings[locale].add;
  const allEditorStr = taggingStrings[locale].allEditor;
  const phraseAllStr = str.all.vocabPhrases;
  const session = useSession();
  const isChild = session?.role === "child";

  const [phrases, setPhrases] = useState<VocabPhrase[]>([]);
  const [phraseTagsMap, setPhraseTagsMap] = useState<VocabPhraseLessonTagsMap>(new Map());
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const [filterPhraseSearch, setFilterPhraseSearch] = useState("");
  const [filterHasContent, setFilterHasContent] = useState<"" | "yes" | "no">("");
  const [filterSelectedTagIds, setFilterSelectedTagIds] = useState<string[]>([]);
  const [filterTagTextbooks, setFilterTagTextbooks] = useState<string[]>([]);
  const [filterTagGrades, setFilterTagGrades] = useState<string[]>([]);
  const [filterTagUnits, setFilterTagUnits] = useState<string[]>([]);
  const [filterTagLessons, setFilterTagLessons] = useState<string[]>([]);
  const [filterSectionOpen, setFilterSectionOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tagSectionOpen, setTagSectionOpen] = useState(false);

  const [sortKey, setSortKey] = useState<PhraseSortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [phraseRows, tagsMap] = await Promise.all([listVocabPhrases(), getVocabPhraseLessonTagsForFamily()]);
      setPhrases(phraseRows);
      setPhraseTagsMap(tagsMap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addedHanziSet = useMemo(() => new Set(words.map((word) => word.hanzi)), [words]);

  const addedCharactersByPhraseId = useMemo(() => {
    const map = new Map<string, string[]>();
    phrases.forEach((phrase) => {
      map.set(phrase.id, getAddedCharactersInPhrase(phrase.phrase, addedHanziSet));
    });
    return map;
  }, [phrases, addedHanziSet]);

  const totalPhrases = phrases.length;
  const timesTested = useMemo(() => phrases.reduce((sum, phrase) => sum + phrase.testCount, 0), [phrases]);
  const withContentCount = useMemo(() => phrases.filter(vocabPhraseHasContent).length, [phrases]);
  const containsAddedCharactersCount = useMemo(
    () => phrases.filter((phrase) => (addedCharactersByPhraseId.get(phrase.id) ?? []).length > 0).length,
    [phrases, addedCharactersByPhraseId]
  );

  // Extract unique tags from phraseTagsMap for filter UI — mirrors AllWordsSection's availableTagsWithIds exactly.
  const availableTagsWithIds = useMemo(() => {
    const tagMap = new Map<string, { id: string; textbookName: string; grade: string; unit: string; lesson: string }>();
    phraseTagsMap.forEach((tags) => {
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
  }, [phraseTagsMap]);

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

  const partialTagFilterSelection = {
    textbooks: filterTagTextbooks,
    grades: filterTagGrades,
    units: filterTagUnits,
    lessons: filterTagLessons,
  };
  const isPartialTagFilterActive = hasActivePartialTagFilter(partialTagFilterSelection);

  const filteredPhrases = useMemo(() => {
    return phrases.filter((phrase) => {
      if (!phrase.phrase.includes(filterPhraseSearch.trim())) return false;

      if (filterHasContent === "yes" && !vocabPhraseHasContent(phrase)) return false;
      if (filterHasContent === "no" && vocabPhraseHasContent(phrase)) return false;

      const phraseTags = phraseTagsMap.get(phrase.id) ?? [];
      const phraseTagIds = new Set(phraseTags.map((t) => t.lessonTagId));
      if (!matchesSelectedTagFilter(phraseTagIds, filterSelectedTagIds)) return false;
      if (!matchesPartialTagFilter(phraseTags, partialTagFilterSelection)) return false;

      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    phrases,
    filterPhraseSearch,
    filterHasContent,
    filterSelectedTagIds,
    filterTagTextbooks,
    filterTagGrades,
    filterTagUnits,
    filterTagLessons,
    phraseTagsMap,
  ]);

  const sortedPhrases = useMemo(() => {
    const prepared = [...filteredPhrases];
    prepared.sort((left, right) => {
      let comparison = 0;
      switch (sortKey) {
        case "phrase":
          comparison = left.phrase.localeCompare(right.phrase, "zh-Hans-CN");
          break;
        case "addedCharacters":
          comparison =
            (addedCharactersByPhraseId.get(left.id) ?? []).length -
            (addedCharactersByPhraseId.get(right.id) ?? []).length;
          break;
        case "createdAt":
          comparison = left.createdAt - right.createdAt;
          break;
        case "testCount":
          comparison = left.testCount - right.testCount;
          break;
        default:
          comparison = 0;
      }

      if (comparison === 0) {
        return left.createdAt - right.createdAt;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
    return prepared;
  }, [filteredPhrases, sortKey, sortDirection, addedCharactersByPhraseId]);

  function toggleSort(nextKey: PhraseSortKey): void {
    if (sortKey === nextKey) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "phrase" ? "asc" : "desc");
  }

  function getSortIndicator(key: PhraseSortKey): string {
    if (sortKey !== key) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  const totalPages = Math.ceil(sortedPhrases.length / ITEMS_PER_PAGE);
  const validPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const paginatedPhrases = useMemo(() => {
    const startIdx = (validPage - 1) * ITEMS_PER_PAGE;
    return sortedPhrases.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [sortedPhrases, validPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterPhraseSearch, filterHasContent, filterSelectedTagIds, filterTagTextbooks, filterTagGrades, filterTagUnits, filterTagLessons]);

  useEffect(() => {
    const paginatedIds = new Set(paginatedPhrases.map((phrase) => phrase.id));
    setSelectedIds((previous) => previous.filter((id) => paginatedIds.has(id)));
  }, [paginatedPhrases]);

  const hasActiveFilters =
    filterPhraseSearch.trim() !== "" ||
    filterHasContent !== "" ||
    filterSelectedTagIds.length > 0 ||
    isPartialTagFilterActive;

  function clearAllFilters(): void {
    setFilterPhraseSearch("");
    setFilterHasContent("");
    setFilterSelectedTagIds([]);
    setFilterTagTextbooks([]);
    setFilterTagGrades([]);
    setFilterTagUnits([]);
    setFilterTagLessons([]);
  }

  function toggleSelected(id: string): void {
    setSelectedIds((previous) => (previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id]));
  }

  const paginatedPhraseIds = useMemo(() => paginatedPhrases.map((phrase) => phrase.id), [paginatedPhrases]);
  const allVisibleSelected =
    paginatedPhraseIds.length > 0 && paginatedPhraseIds.every((id) => selectedIds.includes(id));

  function toggleAllVisibleSelection(checked: boolean): void {
    setSelectedIds((previous) => {
      if (checked) {
        const merged = new Set([...previous, ...paginatedPhraseIds]);
        return [...merged];
      }
      return previous.filter((id) => !paginatedPhraseIds.includes(id));
    });
  }

  async function handleDeletePhrase(phrase: VocabPhrase): Promise<void> {
    try {
      await deleteVocabPhrase(phrase.id);
      setPhrases((previous) => previous.filter((item) => item.id !== phrase.id));
      setSelectedIds((previous) => previous.filter((id) => id !== phrase.id));
    } catch {
      setNotice(phraseAllStr.deleteError);
    }
  }

  async function handleAssignTag(lessonTagId: string): Promise<void> {
    if (selectedIds.length === 0) {
      setNotice(str.admin.vocabPhrases.packageSection.noSelection);
      return;
    }
    try {
      await assignVocabPhraseLessonTags(selectedIds, lessonTagId);
      setNotice(str.admin.vocabPhrases.tagSection.assignSuccess);
      await refresh();
    } catch {
      setNotice(str.admin.vocabPhrases.tagSection.assignError);
    }
  }

  if (vm.page !== "all") {
    return null;
  }

  return (
    <div className="space-y-3">
      {notice ? <p className="text-sm text-blue-700">{notice}</p> : null}

      <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex min-h-[76px] w-full flex-col items-center justify-center rounded-md border px-2 py-2 text-center">
          <p className="text-sm uppercase text-gray-600">{phraseAllStr.stats.totalPhrases}</p>
          <p className="text-2xl font-semibold">{totalPhrases}</p>
        </div>
        <div className="flex min-h-[76px] w-full flex-col items-center justify-center rounded-md border px-2 py-2 text-center">
          <p className="text-sm uppercase text-gray-600">{phraseAllStr.stats.timesTested}</p>
          <p className="text-2xl font-semibold">{timesTested}</p>
        </div>
        <div className="flex min-h-[76px] w-full flex-col items-center justify-center rounded-md border px-2 py-2 text-center">
          <p className="text-sm uppercase text-gray-600">{phraseAllStr.stats.withContent}</p>
          <p className="text-2xl font-semibold">{withContentCount}</p>
        </div>
        <div className="flex min-h-[76px] w-full flex-col items-center justify-center rounded-md border px-2 py-2 text-center">
          <p className="text-sm uppercase text-gray-600">{phraseAllStr.stats.containsAddedCharacters}</p>
          <p className="text-2xl font-semibold">{containsAddedCharactersCount}</p>
        </div>
      </div>

      {/* Default Filters Bar */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setFilterSectionOpen((open) => !open)}
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
            {/* Phrase Search */}
            <div className="space-y-1">
              <label className="block text-xs text-gray-600">{phraseAllStr.filters.phraseSearch.label}</label>
              <input
                type="text"
                className="rounded-md border px-2 py-1 text-sm w-full max-w-xs"
                placeholder={phraseAllStr.filters.phraseSearch.placeholder}
                value={filterPhraseSearch}
                onChange={(e) => setFilterPhraseSearch(e.target.value)}
              />
            </div>

            {/* Row 1: Tag-related filters — identical structure to the Characters tab */}
            <div className="flex gap-6 items-start">
              {/* Tags (full multi-select, with None option) */}
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
                          setFilterSelectedTagIds((prev) => toggleTagFilterId(prev, NO_TAG_FILTER_ID, e.target.checked))
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
                            onChange={(e) => setFilterSelectedTagIds((prev) => toggleTagFilterId(prev, tag.id, e.target.checked))}
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
                                const next = e.target.checked
                                  ? [...filterTagLessons, l]
                                  : filterTagLessons.filter((x) => x !== l);
                                setFilterTagLessons(next);
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

            {/* Row 2: Has Content? — Due Now / Familiarity are structurally inapplicable to phrases (no SRS state) */}
            <div className="flex flex-wrap gap-8 items-start border-t pt-3">
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

      {/* Batch tag assignment — hidden for child role */}
      {!isChild && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setTagSectionOpen((open) => !open)} className="text-sm text-blue-600 underline">
              {allEditorStr.title}
            </button>
          </div>
          {tagSectionOpen && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                {str.admin.table.summary.selectedLabel}: <span className="font-semibold text-blue-600">{selectedIds.length}</span>
              </p>
              <TagCascadePicker
                strings={{
                  textbookPlaceholder: tagStr.textbookPlaceholder,
                  gradePlaceholder: tagStr.gradePlaceholder,
                  unitPlaceholder: tagStr.unitPlaceholder,
                  lessonPlaceholder: tagStr.lessonPlaceholder,
                  createNewOption: tagStr.createNewOption,
                  createNewPlaceholder: tagStr.createNewPlaceholder,
                  createNewConfirm: tagStr.createNewConfirm,
                  createNewCancel: tagStr.createNewCancel,
                  loadingTextbooks: tagStr.loadingTextbooks,
                  customValueOption: tagStr.customValueOption,
                  assignButton: str.admin.vocabPhrases.tagSection.title,
                  assigning: str.admin.vocabPhrases.generating,
                }}
                onAssign={handleAssignTag}
              />
            </div>
          )}
        </div>
      )}

      {!isChild ? (
        <p className="text-sm text-gray-600">
          {hasActiveFilters ? (
            <>
              {str.all.table.summary.filteredLabel} <span className="font-semibold text-blue-700">{filteredPhrases.length}</span>
            </>
          ) : (
            str.all.table.summary.noFiltersApplied
          )}
          {str.all.table.summary.separator}
          {str.all.table.summary.selectedLabel} <span className="font-semibold text-blue-700">{selectedIds.length}</span>
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-600">{phraseAllStr.noPhrases}</p>
      ) : paginatedPhrases.length === 0 ? (
        <p className="text-sm text-gray-600">{phraseAllStr.noPhrases}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
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
                <th className="px-3 py-2">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("phrase")}>
                    {phraseAllStr.table.headers.phrase} <span aria-hidden>{getSortIndicator("phrase")}</span>
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("addedCharacters")}>
                    {phraseAllStr.table.headers.addedCharacters} <span aria-hidden>{getSortIndicator("addedCharacters")}</span>
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("createdAt")}>
                    {str.all.table.headers.dateAdded} <span aria-hidden>{getSortIndicator("createdAt")}</span>
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("testCount")}>
                    {str.all.table.headers.testCount} <span aria-hidden>{getSortIndicator("testCount")}</span>
                  </button>
                </th>
                {!isChild && <th className="px-3 py-2">{taggingStrings[locale].column.header}</th>}
                {!isChild && <th className="px-3 py-2">{str.all.table.headers.actions}</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedPhrases.map((phrase) => {
                const addedChars = addedCharactersByPhraseId.get(phrase.id) ?? [];
                const tags = phraseTagsMap.get(phrase.id) ?? [];
                return (
                  <tr key={phrase.id} className="border-b align-top">
                    {!isChild && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(phrase.id)}
                          onChange={() => toggleSelected(phrase.id)}
                          aria-label={phrase.phrase}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2">{phrase.phrase}</td>
                    <td className="px-3 py-2">{addedChars.length > 0 ? addedChars.join("、") : <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2">{formatDateTime(phrase.createdAt)}</td>
                    <td className="px-3 py-2">{phrase.testCount}</td>
                    {!isChild && (
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          {tags.map((tag) => (
                            <span key={tag.lessonTagId} className="inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-800">
                              {tag.textbookName} · {tag.grade} · {tag.unit} · {tag.lesson}
                            </span>
                          ))}
                        </div>
                      </td>
                    )}
                    {!isChild && (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-destructive"
                          onClick={() => void handleDeletePhrase(phrase)}
                          title={str.all.table.tooltips.delete}
                          aria-label={str.all.table.buttons.delete}
                        >
                          {str.all.table.buttons.delete}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-3">
          <div className="text-sm text-gray-600">
            {str.all.pagination.pageInfo.replace("{current}", String(validPage)).replace("{total}", String(totalPages))}
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
  );
}
