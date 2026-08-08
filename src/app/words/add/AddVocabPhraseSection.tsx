"use client";

import { useState } from "react";
import { useLocale } from "@/app/shared/locale";
import {
  addVocabPhrases,
  assignVocabPhraseLessonTags,
  createLessonTagIfNew,
  getExistingVocabPhrasesByText,
} from "@/lib/supabase-service";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import TagCascadePicker, { type TagCascadeSelection } from "../shared/TagCascadePicker";
import { taggingStrings } from "../shared/tagging.strings";
import {
  computePhraseIngestionResult,
  isTagFormComplete,
  parseCommaSeparatedPhrases,
} from "./addIngestion";

const EMPTY_TAG_SELECTION: TagCascadeSelection = {
  textbookId: null,
  grade: "",
  unit: "",
  lesson: "",
};

/**
 * Batch phrase entry on /words/add, parallel to the single-hanzi character
 * textarea above it (AddSection.tsx) but for multi-character phrases. A
 * phrase stays intact as one unit -- parseCommaSeparatedPhrases splits on
 * commas, spaces, and line breaks (same delimiter tolerance as the
 * character flow), never exploding a phrase into individual characters the
 * way the character flow's extractUniqueHanzi does.
 *
 * The tag section mirrors the character form's pre-submit placement: the
 * "Add tags" link sits above the submit button, not after it, and the
 * selected tag is resolved/created and applied together with the phrase
 * batch on submit -- to both newly-added phrases and already-existing
 * phrases in the same submitted batch, matching the character ingestion
 * rule (0_ARCHITECTURE.md, Ingestion Rules #11).
 */
export default function AddVocabPhraseSection({ vm }: { vm: WordsWorkspaceVM }) {
  const { str } = vm;
  const locale = useLocale();
  const tagStr = taggingStrings[locale].add;
  const phraseStr = str.add.vocabPhrases;

  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tagSectionOpen, setTagSectionOpen] = useState(false);
  const [tagSelection, setTagSelection] = useState<TagCascadeSelection>(EMPTY_TAG_SELECTION);

  function handleToggleTagSection() {
    setTagSectionOpen((open) => !open);
    setTagSelection(EMPTY_TAG_SELECTION);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseCommaSeparatedPhrases(input);
    if (parsed.length === 0) {
      setNotice(phraseStr.noInput);
      return;
    }

    if (
      !isTagFormComplete(
        tagSectionOpen,
        tagSelection.textbookId,
        tagSelection.grade,
        tagSelection.unit,
        tagSelection.lesson
      )
    ) {
      setNotice(tagStr.partialTagError);
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const existing = await getExistingVocabPhrasesByText(parsed);
      const { phrasesToAdd, invalidPhrases, skippedCount } = computePhraseIngestionResult(
        parsed,
        existing.map((phrase) => phrase.phrase)
      );

      const created = await addVocabPhrases(phrasesToAdd);

      const notices: string[] = [];
      if (created.length === 0) {
        notices.push(phraseStr.noNew);
      } else if (skippedCount > 0) {
        notices.push(
          phraseStr.partialSuccess
            .replace("{count}", String(created.length))
            .replace("{skipped}", String(skippedCount))
        );
      } else {
        notices.push(phraseStr.allSuccess.replace("{count}", String(created.length)));
      }
      if (invalidPhrases.length > 0) {
        notices.push(
          phraseStr.invalidSkipped
            .replace("{count}", String(invalidPhrases.length))
            .replace("{phrases}", invalidPhrases.join("、"))
        );
      }

      // Assign the tag to every submitted phrase in this batch, new and
      // already-existing alike -- mirrors the character add form.
      if (tagSectionOpen && tagSelection.textbookId && tagSelection.grade && tagSelection.unit && tagSelection.lesson) {
        const allTargetIds = [...created.map((phrase) => phrase.id), ...existing.map((phrase) => phrase.id)];
        if (allTargetIds.length > 0) {
          try {
            const lessonTag = await createLessonTagIfNew(
              tagSelection.textbookId,
              tagSelection.grade,
              tagSelection.unit,
              tagSelection.lesson
            );
            await assignVocabPhraseLessonTags(allTargetIds, lessonTag.id);
          } catch {
            notices.push(phraseStr.tagAssignError);
          }
        }
      }

      setNotice(notices.join(" "));
      setInput("");
      setTagSectionOpen(false);
      setTagSelection(EMPTY_TAG_SELECTION);
    } catch {
      setNotice(phraseStr.noNew);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{phraseStr.pageTitle}</h2>
      <p className="text-sm text-gray-700">{phraseStr.pageDescription}</p>
      {notice ? <p className="text-sm text-blue-700">{notice}</p> : null}

      <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-3">
        <textarea
          className="w-full rounded-md border px-3 py-2"
          placeholder={phraseStr.inputPlaceholder}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={submitting}
          rows={3}
        />

        {/* Lesson tag section -- set up before submitting, applied on submit */}
        <div>
          <button
            type="button"
            onClick={handleToggleTagSection}
            className="text-sm text-blue-600 underline"
          >
            {tagSectionOpen ? tagStr.collapseButton : tagStr.expandButton}
          </button>

          {tagSectionOpen ? (
            <div className="mt-2 space-y-2">
              <p className="text-xs font-medium text-gray-600">{tagStr.sectionLabel}</p>
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
                }}
                mode="controlled"
                onSelectionChange={setTagSelection}
              />
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          className="btn-primary rounded-md border-2 px-4 py-2 disabled:opacity-50"
          disabled={submitting || !input.trim()}
        >
          {phraseStr.submitButton}
        </button>
      </form>
    </div>
  );
}
