"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/authContext";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import type { ResolvedLessonTag } from "../shared/tagging.types";
import { useLocale } from "@/app/shared/locale";
import { taggingStrings } from "../shared/tagging.strings";

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
    formatDateTime,
    resetWord,
    removeWord,
    wordTagsMap,
  } = vm;

  const session = useSession();
  const isChild = session?.role === "child";
  const locale = useLocale();
  const tagStr = taggingStrings[locale];

  const router = useRouter();
  const searchParams = useSearchParams();

  const filterTextbook = searchParams.get("textbook") ?? "";
  const filterGrade = searchParams.get("grade") ?? "";
  const filterUnit = searchParams.get("unit") ?? "";
  const filterLesson = searchParams.get("lesson") ?? "";

  // Build filter dropdown options from loaded tag data
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

  const SAVED_FILTER_KEY = "cc_filter_all";

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

  const [savedNotice, setSavedNotice] = useState(false);

  function saveFilters() {
    try {
      localStorage.setItem(SAVED_FILTER_KEY, JSON.stringify({ textbook: filterTextbook, grade: filterGrade, unit: filterUnit, lesson: filterLesson }));
    } catch { /* ignore */ }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
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

  function handleTextbookChange(id: string) {
    setParam({ textbook: id, grade: "", unit: "", lesson: "" });
  }
  function handleGradeChange(grade: string) {
    setParam({ grade, unit: "", lesson: "" });
  }
  function handleUnitChange(unit: string) {
    setParam({ unit, lesson: "" });
  }
  function clearFilters() {
    router.replace("?", { scroll: false });
  }

  const anyFilterActive = filterTextbook || filterGrade || filterUnit || filterLesson;

  // AND-filter sortedAllWords using selected tag filters
  const filteredWords = useMemo(() => {
    if (!anyFilterActive) return sortedAllWords;
    return sortedAllWords.filter(({ word }) => {
      const tags = wordTagsMap.get(word.id) ?? [];
      return tags.some(
        (t) =>
          (!filterTextbook || t.textbookId === filterTextbook) &&
          (!filterGrade || t.grade === filterGrade) &&
          (!filterUnit || t.unit === filterUnit) &&
          (!filterLesson || t.lesson === filterLesson)
      );
    });
  }, [sortedAllWords, wordTagsMap, filterTextbook, filterGrade, filterUnit, filterLesson, anyFilterActive]);

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

      {/* Filter bar — hidden for child role */}
      {!isChild && allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
          <select
            className="rounded border px-2 py-1"
            value={filterTextbook}
            onChange={(e) => handleTextbookChange(e.target.value)}
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
            onChange={(e) => handleGradeChange(e.target.value)}
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
            onChange={(e) => handleUnitChange(e.target.value)}
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

      {loading ? (
        <p>{str.common.loading}</p>
      ) : words.length === 0 ? (
        <p>{str.all.noCharacters}</p>
      ) : filteredWords.length === 0 && anyFilterActive ? (
        <p className="text-sm text-gray-500">
          {tagStr.filter.emptyState}{" "}
          <button type="button" onClick={clearFilters} className="underline">
            {tagStr.filter.clearFilters}
          </button>
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
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
                  <th className="px-3 py-2 text-left">{tagStr.column.header}</th>
                )}
                {!isChild && <th className="px-3 py-2 text-left">{str.all.table.headers.actions}</th>}
              </tr>
            </thead>
            <tbody>
              {filteredWords.map(({ word, reviewCount, testCount, familiarity }) => (
                <tr key={word.id} className="border-b align-top">
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
                        onClick={() => removeWord(word.id)}
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
      )}
    </section>
  );
}
