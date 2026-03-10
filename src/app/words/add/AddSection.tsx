"use client";

import { useEffect, useState } from "react";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import { listTextbooks, listLessonTags, createTextbook } from "@/lib/supabase-service";
import type { Textbook, LessonTag } from "../shared/tagging.types";
import { useLocale } from "@/app/shared/locale";
import { taggingStrings } from "../shared/tagging.strings";

export default function AddSection({ vm }: { vm: WordsWorkspaceVM }) {
  const {
    page,
    str,
    formNotice,
    addWord,
    hanzi,
    setHanzi,
    addTagSectionOpen,
    setAddTagSectionOpen,
    addTagTextbookId,
    setAddTagTextbookId,
    addTagTextbookName: _addTagTextbookName,
    setAddTagTextbookName,
    addTagGrade,
    setAddTagGrade,
    addTagUnit,
    setAddTagUnit,
    addTagLesson,
    setAddTagLesson,
  } = vm;

  const locale = useLocale();
  const tagStr = taggingStrings[locale].add;

  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [textbooksLoading, setTextbooksLoading] = useState(false);
  const [textbookInputValue, setTextbookInputValue] = useState("");
  const [textbookCreating, setTextbookCreating] = useState(false);
  const [lessonTags, setLessonTags] = useState<LessonTag[]>([]);

  // Load textbooks when section opens
  useEffect(() => {
    if (!addTagSectionOpen) return;
    setTextbooksLoading(true);
    listTextbooks()
      .then(setTextbooks)
      .catch(() => setTextbooks([]))
      .finally(() => setTextbooksLoading(false));
  }, [addTagSectionOpen]);

  // Sync display input when textbookId is cleared from outside (e.g. form reset)
  useEffect(() => {
    if (!addTagTextbookId) setTextbookInputValue("");
  }, [addTagTextbookId]);

  // Load all lesson_tags for selected textbook when textbook changes
  useEffect(() => {
    if (!addTagTextbookId) {
      setLessonTags([]);
      return;
    }
    listLessonTags(addTagTextbookId)
      .then(setLessonTags)
      .catch(() => setLessonTags([]));
  }, [addTagTextbookId]);

  function handleTextbookInputChange(value: string) {
    setTextbookInputValue(value);
    setAddTagTextbookName(value);
    // Check if the typed name matches an existing textbook
    const match = textbooks.find((tb) => tb.name.toLowerCase() === value.trim().toLowerCase());
    if (match) {
      setAddTagTextbookId(match.id);
      setAddTagGrade(null);
      setAddTagUnit(null);
      setAddTagLesson(null);
    } else {
      setAddTagTextbookId(null);
      setAddTagGrade(null);
      setAddTagUnit(null);
      setAddTagLesson(null);
    }
  }

  async function handleTextbookBlur() {
    const trimmed = textbookInputValue.trim();
    if (!trimmed || addTagTextbookId) return; // already resolved or empty
    // No match — create a new family textbook
    setTextbookCreating(true);
    try {
      const created = await createTextbook(trimmed);
      setTextbooks((prev) =>
        prev.some((tb) => tb.id === created.id) ? prev : [...prev, created]
      );
      setTextbookInputValue(created.name);
      setAddTagTextbookId(created.id);
      setAddTagGrade(null);
      setAddTagUnit(null);
      setAddTagLesson(null);
    } catch {
      // leave input value so user can retry; don't clear it
    } finally {
      setTextbookCreating(false);
    }
  }

  function handleGradeChange(grade: string) {
    setAddTagGrade(grade || null);
    setAddTagUnit(null);
    setAddTagLesson(null);
  }

  function handleUnitChange(unit: string) {
    setAddTagUnit(unit || null);
    setAddTagLesson(null);
  }

  function handleToggleSection() {
    if (addTagSectionOpen) {
      // Collapse — clear all tag state
      setAddTagSectionOpen(false);
      setAddTagTextbookId(null);
      setAddTagTextbookName("");
      setAddTagGrade(null);
      setAddTagUnit(null);
      setAddTagLesson(null);
      setTextbookInputValue("");
    } else {
      setAddTagSectionOpen(true);
    }
  }

  // Derive unique sorted values for datalists
  const gradeOptions = addTagTextbookId
    ? [...new Set(lessonTags.map((t) => t.grade))].sort()
    : [];
  const unitOptions =
    addTagTextbookId && addTagGrade
      ? [...new Set(lessonTags.filter((t) => t.grade === addTagGrade).map((t) => t.unit))].sort()
      : [];
  const lessonOptions =
    addTagTextbookId && addTagGrade && addTagUnit
      ? [
          ...new Set(
            lessonTags
              .filter((t) => t.grade === addTagGrade && t.unit === addTagUnit)
              .map((t) => t.lesson)
          ),
        ].sort()
      : [];

  if (page !== "add") {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{str.add.pageTitle}</h2>
      <p className="text-sm text-gray-700">{str.add.pageDescription}</p>
      {formNotice ? <p className="text-sm text-blue-700">{formNotice}</p> : null}

      <form onSubmit={addWord} className="space-y-3 rounded-md border p-3">
        <input
          className="w-full rounded-md border px-3 py-2"
          placeholder={str.add.inputPlaceholder}
          value={hanzi}
          onChange={(e) => setHanzi(e.target.value)}
        />

        {/* Lesson tag section */}
        <div>
          <button
            type="button"
            onClick={handleToggleSection}
            className="text-sm text-blue-600 underline"
          >
            {addTagSectionOpen ? tagStr.collapseButton : tagStr.expandButton}
          </button>

          {addTagSectionOpen && (
            <div className="mt-2 space-y-2">
              <p className="text-xs font-medium text-gray-600">{tagStr.sectionLabel}</p>

              {/* Textbook */}
              <div>
                <label className="block text-xs text-gray-500">{tagStr.textbookPlaceholder}</label>
                <input
                  list="tag-textbook-list"
                  className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                  placeholder={
                    textbooksLoading ? tagStr.loadingTextbooks : tagStr.textbookPlaceholder
                  }
                  value={textbookInputValue}
                  onChange={(e) => handleTextbookInputChange(e.target.value)}
                  onBlur={handleTextbookBlur}
                  disabled={textbooksLoading || textbookCreating}
                />
                <datalist id="tag-textbook-list">
                  {textbooks.map((tb) => (
                    <option key={tb.id} value={tb.name} />
                  ))}
                </datalist>
                {textbookCreating && (
                  <p className="mt-0.5 text-xs text-gray-500">{tagStr.creatingTextbook}</p>
                )}
                {textbookInputValue.trim() &&
                  !addTagTextbookId &&
                  !textbooksLoading &&
                  !textbookCreating && (
                    <p className="mt-0.5 text-xs text-blue-600">{tagStr.willCreateTextbook}</p>
                  )}
              </div>

              {/* Grade */}
              <div>
                <label className="block text-xs text-gray-500">{tagStr.gradePlaceholder}</label>
                <input
                  list="tag-grade-list"
                  className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                  placeholder={tagStr.gradePlaceholder}
                  value={addTagGrade ?? ""}
                  onChange={(e) => handleGradeChange(e.target.value)}
                  disabled={!addTagTextbookId && !textbookInputValue.trim()}
                />
                <datalist id="tag-grade-list">
                  {gradeOptions.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>

              {/* Unit */}
              <div>
                <label className="block text-xs text-gray-500">{tagStr.unitPlaceholder}</label>
                <input
                  list="tag-unit-list"
                  className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                  placeholder={tagStr.unitPlaceholder}
                  value={addTagUnit ?? ""}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  disabled={!addTagGrade}
                />
                <datalist id="tag-unit-list">
                  {unitOptions.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>

              {/* Lesson */}
              <div>
                <label className="block text-xs text-gray-500">{tagStr.lessonPlaceholder}</label>
                <input
                  list="tag-lesson-list"
                  className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                  placeholder={tagStr.lessonPlaceholder}
                  value={addTagLesson ?? ""}
                  onChange={(e) => setAddTagLesson(e.target.value || null)}
                  disabled={!addTagUnit}
                />
                <datalist id="tag-lesson-list">
                  {lessonOptions.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </div>
            </div>
          )}
        </div>

        <button type="submit" className="rounded-md bg-black px-4 py-2 text-white">
          {str.add.submitButton}
        </button>
      </form>
    </section>
  );
}
