"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/authContext";
import { useLocale } from "@/app/shared/locale";
import { taggingStrings } from "../shared/tagging.strings";
import { assignWordLessonTags, createLessonTagIfNew, createTextbook, listLessonTags, listTextbooks } from "@/lib/supabase-service";
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

  const visibleWordIds = useMemo(
    () => sortedAllWords.map(({ word }) => word.id),
    [sortedAllWords]
  );

  useEffect(() => {
    setSelectedWordIds((previous) => previous.filter((id) => visibleWordIds.includes(id)));
  }, [visibleWordIds]);

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
    visibleWordIds.length > 0 && visibleWordIds.every((id) => selectedWordIds.includes(id));

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
        const merged = new Set([...previous, ...visibleWordIds]);
        return [...merged];
      }

      return previous.filter((id) => !visibleWordIds.includes(id));
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
      setTextbookInputValue("");
      setTextbookCreateMode(false);
    } finally {
      setTextbookCreating(false);
    }
  }

  async function handleBatchSave(): Promise<void> {
    setEditorNotice(null);

    if (selectedWordIds.length === 0) {
      setEditorNotice(allEditorStr.noSelection);
      return;
    }

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
      return;
    }

    setEditorSaving(true);
    try {
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

      const lessonTag = await createLessonTagIfNew(resolvedTextbookId, batchGrade, batchUnit, batchLesson);
      await assignWordLessonTags(selectedWordIds, lessonTag.id);
      await refreshAllData();
      setEditorNotice(allEditorStr.saveSuccess.replace("{count}", String(selectedWordIds.length)));
    } catch (error) {
      console.error("[all-tags] Batch save failed", error);
      setEditorNotice(allEditorStr.saveError);
    } finally {
      setEditorSaving(false);
    }
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

      {/* Filter bar — hidden for child role */}

      {!isChild && (
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{allEditorStr.title}</p>
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
              <input
                list="all-tag-grade-list"
                className="w-full rounded-md border px-2 py-1 text-sm disabled:opacity-50"
                placeholder={addTagStr.gradePlaceholder}
                value={batchGrade ?? ""}
                onChange={(event) => {
                  setBatchGrade(event.target.value || null);
                  setBatchUnit(null);
                  setBatchLesson(null);
                }}
                disabled={!batchTextbookId || editorSaving}
              />
              <datalist id="all-tag-grade-list">
                {gradeOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs text-gray-500">{addTagStr.unitPlaceholder}</label>
              <input
                list="all-tag-unit-list"
                className="w-full rounded-md border px-2 py-1 text-sm disabled:opacity-50"
                placeholder={addTagStr.unitPlaceholder}
                value={batchUnit ?? ""}
                onChange={(event) => {
                  setBatchUnit(event.target.value || null);
                  setBatchLesson(null);
                }}
                disabled={!batchGrade || editorSaving}
              />
              <datalist id="all-tag-unit-list">
                {unitOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs text-gray-500">{addTagStr.lessonPlaceholder}</label>
              <input
                list="all-tag-lesson-list"
                className="w-full rounded-md border px-2 py-1 text-sm disabled:opacity-50"
                placeholder={addTagStr.lessonPlaceholder}
                value={batchLesson ?? ""}
                onChange={(event) => setBatchLesson(event.target.value || null)}
                disabled={!batchUnit || editorSaving}
              />
              <datalist id="all-tag-lesson-list">
                {lessonOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border-2 border-emerald-600 bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
              onClick={() => void handleBatchSave()}
              disabled={editorSaving}
              title={allEditorStr.tooltips.saveBatch}
            >
              {editorSaving ? allEditorStr.savingBatch : allEditorStr.saveBatch}
            </button>
            <button
              type="button"
              className="rounded-md border-2 border-gray-400 bg-gray-100 px-4 py-2 font-medium text-gray-700 disabled:opacity-50"
              onClick={() => setSelectedWordIds([])}
              disabled={selectedWordIds.length === 0 || editorSaving}
              title={allEditorStr.tooltips.clearSelection}
            >
              {allEditorStr.clearSelection}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p>{str.common.loading}</p>
      ) : words.length === 0 ? (
        <p>{str.all.noCharacters}</p>
      ) : (
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
              {sortedAllWords.map(({ word, reviewCount, testCount, familiarity }) => (
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
      )}
    </section>
  );
}
