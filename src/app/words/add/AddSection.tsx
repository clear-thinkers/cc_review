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
    addTagSlot1Value,
    setAddTagSlot1Value,
    addTagSlot2Value,
    setAddTagSlot2Value,
    addTagSlot3Value,
    setAddTagSlot3Value,
    setAddTagSlot1Label,
  } = vm;

  const locale = useLocale();
  const tagStr = taggingStrings[locale].add;

  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [textbooksLoading, setTextbooksLoading] = useState(false);
  const [textbookInputValue, setTextbookInputValue] = useState("");
  const [textbookCreating, setTextbookCreating] = useState(false);
  const [textbookCreateMode, setTextbookCreateMode] = useState(false);
  const [textbookCreateError, setTextbookCreateError] = useState<string | null>(null);
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
      setAddTagSlot1Label(match.slot1Label);
    } else {
      setAddTagTextbookId(null);
      setAddTagTextbookName("");
      setAddTagSlot1Label(null);
    }
    setAddTagSlot1Value(null);
    setAddTagSlot2Value(null);
    setAddTagSlot3Value(null);
  }

  async function handleCreateNewTextbook() {
    const trimmed = textbookInputValue.trim();
    if (!trimmed) return;
    setTextbookCreating(true);
    setTextbookCreateError(null);
    try {
      const created = await createTextbook(trimmed);
      setTextbooks((prev) =>
        prev.some((tb) => tb.id === created.id) ? prev : [...prev, created]
      );
      setTextbookInputValue("");
      setTextbookCreateMode(false);
      setTextbookCreateError(null);
      setAddTagTextbookId(created.id);
      setAddTagTextbookName(created.name);
      setAddTagSlot1Label(created.slot1Label);
      setAddTagSlot1Value(null);
      setAddTagSlot2Value(null);
      setAddTagSlot3Value(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("createTextbook failed:", msg);
      setTextbookCreateError(msg);
    } finally {
      setTextbookCreating(false);
    }
  }

  function handleSlot1Change(value: string) {
    setAddTagSlot1Value(value || null);
    setAddTagSlot2Value(null);
    setAddTagSlot3Value(null);
  }

  function handleSlot2Change(value: string) {
    setAddTagSlot2Value(value || null);
    setAddTagSlot3Value(null);
  }

  function handleToggleSection() {
    if (addTagSectionOpen) {
      // Collapse — clear all tag state
      setAddTagSectionOpen(false);
      setAddTagTextbookId(null);
      setAddTagTextbookName("");
      setAddTagSlot1Label(null);
      setAddTagSlot1Value(null);
      setAddTagSlot2Value(null);
      setAddTagSlot3Value(null);
      setTextbookInputValue("");
      setTextbookCreateMode(false);
    } else {
      setAddTagSectionOpen(true);
    }
  }

  // Derive selected textbook and locale-appropriate slot labels
  const selectedTextbook = textbooks.find((tb) => tb.id === addTagTextbookId) ?? null;
  const tagFilterStr = taggingStrings[locale].filter;
  const slotLabel = (en: string | null, zh: string | null): string | null => {
    const label = locale === "zh" ? (zh ?? en) : (en ?? zh);
    return label;
  };
  const slot1LabelDisplay = selectedTextbook
    ? (slotLabel(selectedTextbook.slot1Label, selectedTextbook.slot1LabelZh) ?? tagFilterStr.slot1Label)
    : null;
  const slot2LabelDisplay = selectedTextbook
    ? (slotLabel(selectedTextbook.slot2Label, selectedTextbook.slot2LabelZh) ?? tagFilterStr.slot2Label)
    : null;
  const slot3LabelDisplay = selectedTextbook
    ? (slotLabel(selectedTextbook.slot3Label, selectedTextbook.slot3LabelZh) ?? tagFilterStr.slot3Label)
    : null;
  const slot1Options = addTagTextbookId
    ? [...new Set(lessonTags.map((t) => t.slot1Value).filter((v): v is string => v !== null))].sort()
    : [];
  const slot2Options =
    addTagTextbookId && addTagSlot1Value
      ? [...new Set(lessonTags.filter((t) => t.slot1Value === addTagSlot1Value).map((t) => t.slot2Value).filter((v): v is string => v !== null))].sort()
      : [];
  const slot3Options =
    addTagTextbookId && addTagSlot1Value && addTagSlot2Value
      ? [...new Set(lessonTags.filter((t) => t.slot1Value === addTagSlot1Value && t.slot2Value === addTagSlot2Value).map((t) => t.slot3Value).filter((v): v is string => v !== null))].sort()
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
                {textbookCreateMode && textbookCreateError && (
                  <p className="mt-1 text-xs text-red-600">{textbookCreateError}</p>
                )}
              </div>

              {/* Slot 1 — shown only if textbook defines a slot 1 label */}
              {slot1LabelDisplay && (
                <div>
                  <label className="block text-xs text-gray-500">{slot1LabelDisplay}</label>
                  <input
                    list="tag-slot1-list"
                    className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                    placeholder={slot1LabelDisplay}
                    value={addTagSlot1Value ?? ""}
                    onChange={(e) => handleSlot1Change(e.target.value)}
                    disabled={!addTagTextbookId && !textbookInputValue.trim()}
                  />
                  <datalist id="tag-slot1-list">
                    {slot1Options.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
              )}

              {/* Slot 2 — shown only if textbook defines a slot 2 label */}
              {slot2LabelDisplay && (
                <div>
                  <label className="block text-xs text-gray-500">{slot2LabelDisplay}</label>
                  <input
                    list="tag-slot2-list"
                    className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                    placeholder={slot2LabelDisplay}
                    value={addTagSlot2Value ?? ""}
                    onChange={(e) => handleSlot2Change(e.target.value)}
                    disabled={!addTagSlot1Value}
                  />
                  <datalist id="tag-slot2-list">
                    {slot2Options.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
              )}

              {/* Slot 3 — shown only if textbook defines a slot 3 label */}
              {slot3LabelDisplay && (
                <div>
                  <label className="block text-xs text-gray-500">{slot3LabelDisplay}</label>
                  <input
                    list="tag-slot3-list"
                    className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                    placeholder={slot3LabelDisplay}
                    value={addTagSlot3Value ?? ""}
                    onChange={(e) => setAddTagSlot3Value(e.target.value || null)}
                    disabled={!addTagSlot2Value}
                  />
                  <datalist id="tag-slot3-list">
                    {slot3Options.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
              )}
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
