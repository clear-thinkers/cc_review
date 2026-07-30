"use client";

import { useEffect, useId, useState } from "react";
import { createLessonTagIfNew, createTextbook, listLessonTags, listTextbooks } from "@/lib/supabase-service";
import type { LessonTag, Textbook } from "@/lib/tagging.types";

/**
 * Compact Textbook -> Grade -> Unit -> Lesson tag picker, resolving/creating
 * the underlying lesson_tags row via createLessonTagIfNew and handing its id
 * to onAssign. Reuses the same textbook/lesson-tag services and cascade
 * concept as the character tag section on /words/add (AddSection.tsx), but
 * as a small standalone component with its own local state rather than
 * sharing that page's vm-level addTag* state -- this picker is used in two
 * places (Content Admin's phrase view and /words/add's batch-phrase
 * section) that must not interfere with each other or with the character
 * add form's own tag section.
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
  assignButton: string;
  assigning: string;
};

export default function TagCascadePicker({
  strings,
  onAssign,
}: {
  strings: TagCascadePickerStrings;
  onAssign: (lessonTagId: string) => Promise<void>;
}) {
  const instanceId = useId();
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
      setGrade("");
      setUnit("");
      setLesson("");
    } finally {
      setTextbookCreating(false);
    }
  }

  async function handleAssign() {
    if (!textbookId || !grade.trim() || !unit.trim() || !lesson.trim()) return;
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

  const gradeOptions = [...new Set(lessonTags.map((tag) => tag.grade))].sort();
  const unitOptions = [...new Set(lessonTags.filter((tag) => tag.grade === grade).map((tag) => tag.unit))].sort();
  const lessonOptions = [
    ...new Set(
      lessonTags.filter((tag) => tag.grade === grade && tag.unit === unit).map((tag) => tag.lesson)
    ),
  ].sort();

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
              setGrade("");
              setUnit("");
              setLesson("");
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
        <div>
          <label className="block text-xs text-gray-500">{strings.gradePlaceholder}</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            list={`${instanceId}-grades`}
            value={grade}
            onChange={(event) => {
              setGrade(event.target.value);
              setUnit("");
              setLesson("");
            }}
            disabled={!textbookId}
            placeholder={strings.gradePlaceholder}
          />
          <datalist id={`${instanceId}-grades`}>
            {gradeOptions.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-xs text-gray-500">{strings.unitPlaceholder}</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            list={`${instanceId}-units`}
            value={unit}
            onChange={(event) => {
              setUnit(event.target.value);
              setLesson("");
            }}
            disabled={!grade.trim()}
            placeholder={strings.unitPlaceholder}
          />
          <datalist id={`${instanceId}-units`}>
            {unitOptions.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-xs text-gray-500">{strings.lessonPlaceholder}</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            list={`${instanceId}-lessons`}
            value={lesson}
            onChange={(event) => setLesson(event.target.value)}
            disabled={!unit.trim()}
            placeholder={strings.lessonPlaceholder}
          />
          <datalist id={`${instanceId}-lessons`}>
            {lessonOptions.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </div>
      </div>
      <button
        type="button"
        onClick={handleAssign}
        disabled={!textbookId || !grade.trim() || !unit.trim() || !lesson.trim() || assigning}
        className="btn-primary rounded-md border-2 px-4 py-2 text-sm disabled:opacity-50"
      >
        {assigning ? strings.assigning : strings.assignButton}
      </button>
    </div>
  );
}
