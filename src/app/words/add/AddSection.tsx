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
  const [textbookCreateMode, setTextbookCreateMode] = useState(false);
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
    if (!addTagTextbookId) {
      setTextbookInputValue("");
      setTextbookCreateMode(false);
    }
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

  function handleTextbookSelect(id: string) {
    const match = textbooks.find((tb) => tb.id === id);
    if (match) {
      setAddTagTextbookId(match.id);
      setAddTagTextbookName(match.name);
    } else {
      setAddTagTextbookId(null);
      setAddTagTextbookName("");
    }
    setAddTagGrade(null);
    setAddTagUnit(null);
    setAddTagLesson(null);
  }

  async function handleCreateNewTextbook() {
    const trimmed = textbookInputValue.trim();
    if (!trimmed) return;
    setTextbookCreating(true);
    try {
      const created = await createTextbook(trimmed);
      setTextbooks((prev) =>
        prev.some((tb) => tb.id === created.id) ? prev : [...prev, created]
      );
      setTextbookInputValue("");
      setTextbookCreateMode(false);
      setAddTagTextbookId(created.id);
      setAddTagTextbookName(created.name);
      setAddTagGrade(null);
      setAddTagUnit(null);
      setAddTagLesson(null);
    } catch {
      // leave input so user can retry
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
      setTextbookCreateMode(false);
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
                {!textbookCreateMode ? (
                  <select
                    className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                    value={addTagTextbookId ?? ""}
                    onChange={(e) => {
                      if (e.target.value === "__create__") {
                        setTextbookCreateMode(true);
                      } else {
                        handleTextbookSelect(e.target.value);
                      }
                    }}
                    disabled={textbooksLoading}
                  >
                    <option value="">
                      {textbooksLoading ? tagStr.loadingTextbooks : tagStr.textbookPlaceholder}
                    </option>
                    {textbooks.map((tb) => (
                      <option key={tb.id} value={tb.id}>
                        {tb.name}
                      </option>
                    ))}
                    <option value="__create__">{tagStr.createNewOption}</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                      placeholder={tagStr.createNewPlaceholder}
                      value={textbookInputValue}
                      onChange={(e) => setTextbookInputValue(e.target.value)}
                      disabled={textbookCreating}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreateNewTextbook}
                      disabled={!textbookInputValue.trim() || textbookCreating}
                      className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      {textbookCreating ? tagStr.creatingTextbook : tagStr.createNewConfirm}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTextbookCreateMode(false);
                        setTextbookInputValue("");
                      }}
                      disabled={textbookCreating}
                      className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                    >
                      {tagStr.createNewCancel}
                    </button>
                  </div>
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
