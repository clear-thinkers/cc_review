"use client";

import { useState } from "react";
import { useLocale } from "@/app/shared/locale";
import {
  addVocabPhrases,
  assignVocabPhraseLessonTags,
  getExistingVocabPhrasesByText,
} from "@/lib/supabase-service";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import TagCascadePicker from "../shared/TagCascadePicker";
import { taggingStrings } from "../shared/tagging.strings";
import { computePhraseIngestionResult, parseCommaSeparatedPhrases } from "./addIngestion";

/**
 * Batch phrase entry on /words/add, parallel to the single-hanzi character
 * textarea above it (AddSection.tsx) but for multi-character phrases. A
 * phrase stays intact as one unit -- parseCommaSeparatedPhrases splits on
 * commas only, never exploding a phrase into individual characters the way
 * the character flow's extractUniqueHanzi does.
 */
export default function AddVocabPhraseSection({ vm }: { vm: WordsWorkspaceVM }) {
  const { str } = vm;
  const locale = useLocale();
  const tagStr = taggingStrings[locale].add;
  const phraseStr = str.add.vocabPhrases;

  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastAddedIds, setLastAddedIds] = useState<string[]>([]);
  const [tagSectionOpen, setTagSectionOpen] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseCommaSeparatedPhrases(input);
    if (parsed.length === 0) {
      setNotice(phraseStr.noInput);
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
      setLastAddedIds(created.map((phrase) => phrase.id));
      setTagSectionOpen(false);

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
      setNotice(notices.join(" "));
      setInput("");
    } catch {
      setNotice(phraseStr.noNew);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignTag(lessonTagId: string) {
    if (lastAddedIds.length === 0) return;
    try {
      await assignVocabPhraseLessonTags(lastAddedIds, lessonTagId);
      setNotice(phraseStr.tagAssignSuccess);
    } catch {
      setNotice(phraseStr.tagAssignError);
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
        <button
          type="submit"
          className="btn-primary rounded-md border-2 px-4 py-2 disabled:opacity-50"
          disabled={submitting || !input.trim()}
        >
          {phraseStr.submitButton}
        </button>
      </form>

      {lastAddedIds.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setTagSectionOpen((open) => !open)}
            className="text-sm text-blue-600 underline"
          >
            {phraseStr.tagSectionTitle}
          </button>
          {tagSectionOpen ? (
            <div className="mt-2">
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
                  assignButton: phraseStr.tagSectionTitle,
                  assigning: phraseStr.tagSectionTitle,
                }}
                onAssign={handleAssignTag}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
