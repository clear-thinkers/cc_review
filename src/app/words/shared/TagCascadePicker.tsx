"use client";

import { useEffect, useState } from "react";
import { createLessonTagIfNew, createTextbook, listLessonTags, listTextbooks } from "@/lib/supabase-service";
import type { LessonTag, Textbook } from "@/lib/tagging.types";

/**
 * Compact Textbook -> Grade -> Unit -> Lesson tag picker. Reuses the same
 * textbook/lesson-tag services and cascade concept as the character tag
 * section on /words/add (AddSection.tsx), but as a small standalone
 * component with its own local state rather than sharing that page's
 * vm-level addTag* state -- this picker is used in multiple places
 * (Content Admin's phrase view, /words/add's batch-phrase section) that
 * must not interfere with each other or with the character add form's own
 * tag section.
 *
 * Two modes:
 * - "immediate" (default): resolves/creates the underlying lesson_tags row
 *   via createLessonTagIfNew as soon as its own Assign button is clicked,
 *   handing the id to onAssign. Used where tagging acts on already-persisted
 *   rows (Content Admin's selected/batch phrase tagging).
 * - "controlled": no internal Assign button or tag creation -- reports the
 *   raw in-progress selection via onSelectionChange on every change, and
 *   lets the caller decide when to resolve/create the tag (e.g. together
 *   with a form submission, mirroring the character add form's pre-submit
 *   tag section).
 */
export type TagCascadePickerStrings = {
  textbookPlaceholder: string;
  gradePlaceholder: string;
  unitPlaceholder: string;
  lessonPlaceholder: string;
  createNewOption: string;
  createNewPlaceholder: string;
  createNewConfirm: string;
  createNewCancel: string;
  loadingTextbooks: string;
  customValueOption: string;
  assignButton?: string;
  assigning?: string;
};

export type TagCascadeSelection = {
  textbookId: string | null;
  grade: string;
  unit: string;
  lesson: string;
};

/**
 * Ensures the currently-selected value always has a matching <option>, even
 * when it's a not-yet-persisted custom value the parent just typed (grade/
 * unit/lesson don't exist in `lessonTags` until the underlying lesson_tags
 * row is actually created at final Assign/submit time). Without this, the
 * <select>'s `value` prop has no matching <option>, so the browser renders
 * it blank -- the state is set correctly, but it looks like the value was
 * never captured. Mirrors AddSection.tsx's own inline cascade, which
 * already carries this fix; TagCascadePicker (this shared component) never
 * got it.
 */
export function appendSelectedOption(options: string[], selectedValue: string | null): string[] {
  const trimmedValue = selectedValue?.trim();
  if (!trimmedValue || options.includes(trimmedValue)) {
    return options;
  }
  return [...options, trimmedValue].sort();
}

type TagCascadePickerProps =
  | {
      strings: TagCascadePickerStrings;
      mode?: "immediate";
      onAssign: (lessonTagId: string) => Promise<void>;
      onSelectionChange?: never;
    }
  | {
      strings: TagCascadePickerStrings;
      mode: "controlled";
      onAssign?: never;
      onSelectionChange: (selection: TagCascadeSelection) => void;
    };

export default function TagCascadePicker({
  strings,
  mode = "immediate",
  onAssign,
  onSelectionChange,
}: TagCascadePickerProps) {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [textbooksLoading, setTextbooksLoading] = useState(true);
  const [textbookId, setTextbookId] = useState<string | null>(null);
  const [textbookCreateMode, setTextbookCreateMode] = useState(false);
  const [textbookInputValue, setTextbookInputValue] = useState("");
  const [textbookCreating, setTextbookCreating] = useState(false);
  const [lessonTags, setLessonTags] = useState<LessonTag[]>([]);
  const [grade, setGrade] = useState("");
  const [unit, setUnit] = useState("");
  const [lesson, setLesson] = useState("");
  const [assigning, setAssigning] = useState(false);

  const [gradeCreateMode, setGradeCreateMode] = useState(false);
  const [gradeInputValue, setGradeInputValue] = useState("");
  const [unitCreateMode, setUnitCreateMode] = useState(false);
  const [unitInputValue, setUnitInputValue] = useState("");
  const [lessonCreateMode, setLessonCreateMode] = useState(false);
  const [lessonInputValue, setLessonInputValue] = useState("");

  useEffect(() => {
    listTextbooks()
      .then(setTextbooks)
      .catch(() => setTextbooks([]))
      .finally(() => setTextbooksLoading(false));
  }, []);

  useEffect(() => {
    if (!textbookId) {
      setLessonTags([]);
      return;
    }
    listLessonTags(textbookId).then(setLessonTags).catch(() => setLessonTags([]));
  }, [textbookId]);

  useEffect(() => {
    if (mode !== "controlled" || !onSelectionChange) return;
    onSelectionChange({ textbookId, grade, unit, lesson });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, textbookId, grade, unit, lesson]);

  function resetCascadeBelowTextbook() {
    setGrade("");
    setUnit("");
    setLesson("");
    setGradeCreateMode(false);
    setGradeInputValue("");
    setUnitCreateMode(false);
    setUnitInputValue("");
    setLessonCreateMode(false);
    setLessonInputValue("");
  }

  async function handleCreateTextbook() {
    const trimmed = textbookInputValue.trim();
    if (!trimmed) return;
    setTextbookCreating(true);
    try {
      const created = await createTextbook(trimmed);
      setTextbooks((prev) => (prev.some((tb) => tb.id === created.id) ? prev : [...prev, created]));
      setTextbookId(created.id);
      setTextbookCreateMode(false);
      setTextbookInputValue("");
      resetCascadeBelowTextbook();
    } finally {
      setTextbookCreating(false);
    }
  }

  function handleGradeChange(nextGrade: string) {
    setGrade(nextGrade);
    setUnit("");
    setLesson("");
    setUnitCreateMode(false);
    setUnitInputValue("");
    setLessonCreateMode(false);
    setLessonInputValue("");
  }

  function handleUnitChange(nextUnit: string) {
    setUnit(nextUnit);
    setLesson("");
    setLessonCreateMode(false);
    setLessonInputValue("");
  }

  async function handleAssign() {
    if (!onAssign || !textbookId || !grade.trim() || !unit.trim() || !lesson.trim()) return;
    setAssigning(true);
    try {
      const tag = await createLessonTagIfNew(textbookId, grade.trim(), unit.trim(), lesson.trim());
      await onAssign(tag.id);
      setGrade("");
      setUnit("");
      setLesson("");
    } finally {
      setAssigning(false);
    }
  }

  const gradeOptions = appendSelectedOption(
    [...new Set(lessonTags.map((tag) => tag.grade))].sort(),
    grade
  );
  const unitOptions = appendSelectedOption(
    [...new Set(lessonTags.filter((tag) => tag.grade === grade).map((tag) => tag.unit))].sort(),
    unit
  );
  const lessonOptions = appendSelectedOption(
    [
      ...new Set(
        lessonTags.filter((tag) => tag.grade === grade && tag.unit === unit).map((tag) => tag.lesson)
      ),
    ].sort(),
    lesson
  );

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div>
        <label className="block text-xs text-gray-500">{strings.textbookPlaceholder}</label>
        {!textbookCreateMode ? (
          <select
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            value={textbookId ?? ""}
            onChange={(event) => {
              if (event.target.value === "__create__") {
                setTextbookCreateMode(true);
                return;
              }
              setTextbookId(event.target.value || null);
              resetCascadeBelowTextbook();
            }}
            disabled={textbooksLoading}
          >
            <option value="">{textbooksLoading ? strings.loadingTextbooks : strings.textbookPlaceholder}</option>
            {textbooks.map((tb) => (
              <option key={tb.id} value={tb.id}>
                {tb.name}
              </option>
            ))}
            <option value="__create__">{strings.createNewOption}</option>
          </select>
        ) : (
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
              placeholder={strings.createNewPlaceholder}
              value={textbookInputValue}
              onChange={(event) => setTextbookInputValue(event.target.value)}
              disabled={textbookCreating}
              autoFocus
            />
            <button
              type="button"
              onClick={handleCreateTextbook}
              disabled={!textbookInputValue.trim() || textbookCreating}
              className="btn-primary rounded-md border-2 px-3 py-2 text-sm disabled:opacity-50"
            >
              {strings.createNewConfirm}
            </button>
            <button
              type="button"
              onClick={() => {
                setTextbookCreateMode(false);
                setTextbookInputValue("");
              }}
              disabled={textbookCreating}
              className="btn-nav rounded-md border-2 px-3 py-2 text-sm disabled:opacity-50"
            >
              {strings.createNewCancel}
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {/* Grade */}
        <div>
          <label className="block text-xs text-gray-500">{strings.gradePlaceholder}</label>
          {!gradeCreateMode ? (
            <select
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
              value={grade}
              onChange={(event) => {
                if (event.target.value === "__custom__") {
                  setGradeCreateMode(true);
                  return;
                }
                handleGradeChange(event.target.value);
              }}
              disabled={!textbookId}
            >
              <option value="">{strings.gradePlaceholder}</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
              <option value="__custom__">{strings.customValueOption}</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                placeholder={strings.gradePlaceholder}
                value={gradeInputValue}
                onChange={(event) => setGradeInputValue(event.target.value)}
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  const customGrade = gradeInputValue.trim();
                  handleGradeChange(customGrade);
                  setGradeCreateMode(false);
                  setGradeInputValue("");
                }}
                disabled={!gradeInputValue.trim()}
                className="btn-primary rounded-md border-2 px-3 py-2 text-sm disabled:opacity-50"
              >
                {strings.createNewConfirm}
              </button>
              <button
                type="button"
                onClick={() => {
                  setGradeCreateMode(false);
                  setGradeInputValue("");
                }}
                className="btn-nav rounded-md border-2 px-3 py-2 text-sm disabled:opacity-50"
              >
                {strings.createNewCancel}
              </button>
            </div>
          )}
        </div>

        {/* Unit */}
        <div>
          <label className="block text-xs text-gray-500">{strings.unitPlaceholder}</label>
          {!unitCreateMode ? (
            <select
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
              value={unit}
              onChange={(event) => {
                if (event.target.value === "__custom__") {
                  setUnitCreateMode(true);
                  return;
                }
                handleUnitChange(event.target.value);
              }}
              disabled={!grade.trim()}
            >
              <option value="">{strings.unitPlaceholder}</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
              <option value="__custom__">{strings.customValueOption}</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                placeholder={strings.unitPlaceholder}
                value={unitInputValue}
                onChange={(event) => setUnitInputValue(event.target.value)}
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  const customUnit = unitInputValue.trim();
                  handleUnitChange(customUnit);
                  setUnitCreateMode(false);
                  setUnitInputValue("");
                }}
                disabled={!unitInputValue.trim()}
                className="btn-primary rounded-md border-2 px-3 py-2 text-sm disabled:opacity-50"
              >
                {strings.createNewConfirm}
              </button>
              <button
                type="button"
                onClick={() => {
                  setUnitCreateMode(false);
                  setUnitInputValue("");
                }}
                className="btn-nav rounded-md border-2 px-3 py-2 text-sm disabled:opacity-50"
              >
                {strings.createNewCancel}
              </button>
            </div>
          )}
        </div>

        {/* Lesson */}
        <div>
          <label className="block text-xs text-gray-500">{strings.lessonPlaceholder}</label>
          {!lessonCreateMode ? (
            <select
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
              value={lesson}
              onChange={(event) => {
                if (event.target.value === "__custom__") {
                  setLessonCreateMode(true);
                  return;
                }
                setLesson(event.target.value);
              }}
              disabled={!unit.trim()}
            >
              <option value="">{strings.lessonPlaceholder}</option>
              {lessonOptions.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
              <option value="__custom__">{strings.customValueOption}</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                placeholder={strings.lessonPlaceholder}
                value={lessonInputValue}
                onChange={(event) => setLessonInputValue(event.target.value)}
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  const customLesson = lessonInputValue.trim();
                  setLesson(customLesson);
                  setLessonCreateMode(false);
                  setLessonInputValue("");
                }}
                disabled={!lessonInputValue.trim()}
                className="btn-primary rounded-md border-2 px-3 py-2 text-sm disabled:opacity-50"
              >
                {strings.createNewConfirm}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLessonCreateMode(false);
                  setLessonInputValue("");
                }}
                className="btn-nav rounded-md border-2 px-3 py-2 text-sm disabled:opacity-50"
              >
                {strings.createNewCancel}
              </button>
            </div>
          )}
        </div>
      </div>
      {mode === "immediate" ? (
        <button
          type="button"
          onClick={handleAssign}
          disabled={!textbookId || !grade.trim() || !unit.trim() || !lesson.trim() || assigning}
          className="btn-primary rounded-md border-2 px-4 py-2 text-sm disabled:opacity-50"
        >
          {assigning ? strings.assigning : strings.assignButton}
        </button>
      ) : null}
    </div>
  );
}
