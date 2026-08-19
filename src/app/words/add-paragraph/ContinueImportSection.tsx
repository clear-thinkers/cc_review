"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/app/shared/locale";
import {
  addVocabPhrases,
  addWords,
  assignVocabPhraseLessonTags,
  assignWordLessonTags,
  createLessonTagIfNew,
  updateParagraph,
} from "@/lib/supabase-service";
import { makeId } from "@/lib/id";
import type { Word } from "@/lib/types";
import { triageParagraphCharacters, triagePhrasesInText } from "@/lib/paragraphTriage";
import type { CharacterTriageMatch, PhraseTriageMatch } from "@/lib/paragraphTriage";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import TagCascadePicker, { type TagCascadeSelection } from "../shared/TagCascadePicker";
import { taggingStrings } from "../shared/tagging.strings";
import { addParagraphStrings } from "./addParagraph.strings";
import ParagraphSpanSelector from "./ParagraphSpanSelector";
import type { ParagraphSpanRange, SelectedParagraphSpan } from "./addParagraph.types";
import {
  mergeResolvedSpansIntoSentences,
  resolveSelectedSpans,
  splitSpansNeedingInsert,
} from "./addParagraphIngestion";

const EMPTY_TAG_SELECTION: TagCascadeSelection = {
  textbookId: null,
  grade: "",
  unit: "",
  lesson: "",
};

function groupBySentence<T extends { sentenceIndex: number }>(matches: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const match of matches) {
    const list = map.get(match.sentenceIndex) ?? [];
    list.push(match);
    map.set(match.sentenceIndex, list);
  }
  return map;
}

export default function ContinueImportSection({ vm }: { vm: WordsWorkspaceVM }) {
  const locale = useLocale();
  const str = addParagraphStrings[locale];
  const continueStr = str.continueImport;
  const tagStr = taggingStrings[locale].add;

  const paragraph = useMemo(
    () => vm.paragraphs.find((p) => p.id === vm.paragraphSelectedId) ?? null,
    [vm.paragraphs, vm.paragraphSelectedId]
  );

  const [title, setTitle] = useState("");
  const [selection, setSelection] = useState<SelectedParagraphSpan[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tagSectionOpen, setTagSectionOpen] = useState(false);
  const [tagSelection, setTagSelection] = useState<TagCascadeSelection>(EMPTY_TAG_SELECTION);

  // Reset the form when the selected paragraph changes -- setState during
  // render (React's documented pattern for "adjusting state when a prop
  // changes") rather than a useEffect, which would cause an extra
  // cascading render.
  const [resetForParagraphId, setResetForParagraphId] = useState<string | null>(null);
  if (paragraph && paragraph.id !== resetForParagraphId) {
    setResetForParagraphId(paragraph.id);
    setTitle(paragraph.title ?? "");
    setSelection([]);
    setNotice(null);
    setTagSectionOpen(false);
    setTagSelection(EMPTY_TAG_SELECTION);
  }

  const vocabPhrasePinyinByPhrase = useMemo(
    () => new Map(vm.vocabPhrases.filter((p) => p.pinyin).map((p) => [p.phrase, p.pinyin as string])),
    [vm.vocabPhrases]
  );

  const { characterMatches, phraseMatches, characterMatchesBySentence, phraseMatchesBySentence } = useMemo(() => {
    if (!paragraph) {
      return {
        characterMatches: [] as CharacterTriageMatch[],
        phraseMatches: [] as PhraseTriageMatch[],
        characterMatchesBySentence: new Map<number, CharacterTriageMatch[]>(),
        phraseMatchesBySentence: new Map<number, PhraseTriageMatch[]>(),
      };
    }
    const existingHanzi = new Map(vm.words.map((word) => [word.hanzi, word.id]));
    const existingPhrases = new Map(vm.vocabPhrases.map((phrase) => [phrase.phrase, phrase.id]));
    const sentenceTexts = paragraph.sentences.map((sentence) => sentence.text);
    const cMatches = triageParagraphCharacters(sentenceTexts, existingHanzi);
    const pMatches = triagePhrasesInText(sentenceTexts, existingPhrases);
    return {
      characterMatches: cMatches,
      phraseMatches: pMatches,
      characterMatchesBySentence: groupBySentence(cMatches),
      phraseMatchesBySentence: groupBySentence(pMatches),
    };
  }, [paragraph, vm.words, vm.vocabPhrases]);

  function handleBack() {
    vm.setParagraphViewMode("library");
    vm.setParagraphSelectedId(null);
  }

  function getSentenceSelection(sentenceIndex: number): ParagraphSpanRange[] {
    return selection
      .filter((range) => range.sentenceIndex === sentenceIndex)
      .map((range) => ({ startOffset: range.startOffset, endOffset: range.endOffset }));
  }

  function handleSentenceSelectionChange(sentenceIndex: number, ranges: ParagraphSpanRange[]) {
    setSelection((previous) => [
      ...previous.filter((range) => range.sentenceIndex !== sentenceIndex),
      ...ranges.map((range) => ({ sentenceIndex, ...range })),
    ]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!paragraph) return;

    if (
      tagSectionOpen &&
      (!tagSelection.textbookId || !tagSelection.grade || !tagSelection.unit || !tagSelection.lesson)
    ) {
      setNotice(tagStr.partialTagError);
      return;
    }

    setSubmitting(true);
    setNotice(null);

    const sentenceTextsByIndex = new Map(paragraph.sentences.map((sentence) => [sentence.index, sentence.text]));
    const resolved = resolveSelectedSpans(selection, sentenceTextsByIndex, characterMatches, phraseMatches);
    const { charactersToAdd, phrasesToAdd } = splitSpansNeedingInsert(resolved);

    let newWords: Word[] = [];
    let createdPhraseIds = new Map<string, string>();
    try {
      const now = Date.now();
      newWords = charactersToAdd.map((character, index) => ({
        id: makeId(),
        hanzi: character,
        fillTest: undefined,
        createdAt: now + index,
        repetitions: 0,
        intervalDays: 0,
        ease: 21,
        nextReviewAt: 0,
        reviewCount: 0,
        testCount: 0,
      }));
      if (newWords.length > 0) {
        await addWords(newWords);
      }
      const createdPhrases = phrasesToAdd.length > 0 ? await addVocabPhrases(phrasesToAdd) : [];
      createdPhraseIds = new Map(createdPhrases.map((phrase) => [phrase.phrase, phrase.id]));
    } catch {
      setNotice(str.saveError);
      setSubmitting(false);
      return;
    }

    if (newWords.length > 0 || createdPhraseIds.size > 0) {
      // See AddParagraphSection.tsx's identical call for why this is
      // required -- vm.words/vm.vocabPhrases go stale the moment new rows
      // are inserted above, and a second submission later in the same
      // session (re-triaging this same paragraph again, or a different
      // one) would otherwise treat what was just added as still unknown.
      await vm.refreshAllData();
    }

    const wordIdByHanzi = new Map(newWords.map((word) => [word.hanzi, word.id]));
    const notices: string[] = [];
    const selectedCount = resolved.length;
    const addedCount = newWords.length + createdPhraseIds.size;
    const skippedCount = selectedCount - addedCount;

    if (selectedCount === 0) {
      notices.push(str.noSelectionSaved);
    } else if (addedCount === 0) {
      notices.push(str.noNew);
    } else if (skippedCount > 0) {
      notices.push(
        str.partialSuccess.replace("{count}", String(addedCount)).replace("{skipped}", String(skippedCount))
      );
    } else {
      notices.push(str.allSuccess.replace("{count}", String(addedCount)));
    }

    if (tagSectionOpen && tagSelection.textbookId && tagSelection.grade && tagSelection.unit && tagSelection.lesson) {
      const wordIds = resolved
        .filter((span) => span.kind === "character")
        .map((span) => span.existingId ?? wordIdByHanzi.get(span.text))
        .filter((id): id is string => Boolean(id));
      const phraseIds = resolved
        .filter((span) => span.kind === "phrase")
        .map((span) => span.existingId ?? createdPhraseIds.get(span.text))
        .filter((id): id is string => Boolean(id));

      if (wordIds.length > 0 || phraseIds.length > 0) {
        try {
          const lessonTag = await createLessonTagIfNew(
            tagSelection.textbookId,
            tagSelection.grade,
            tagSelection.unit,
            tagSelection.lesson
          );
          if (wordIds.length > 0) await assignWordLessonTags(wordIds, lessonTag.id);
          if (phraseIds.length > 0) await assignVocabPhraseLessonTags(phraseIds, lessonTag.id);
        } catch {
          notices.push(str.tagAssignError);
        }
      }
    }

    const finalSentences = mergeResolvedSpansIntoSentences(
      paragraph.sentences,
      resolved,
      wordIdByHanzi,
      createdPhraseIds
    );

    let saveFailed = false;
    try {
      const updated = await updateParagraph(paragraph.id, { title: title.trim() || null, sentences: finalSentences });
      vm.setParagraphs((previous) => previous.map((p) => (p.id === updated.id ? updated : p)));
    } catch {
      saveFailed = true;
      notices.push(str.saveError);
    }

    setNotice(notices.join(" "));
    setSelection([]);
    setTagSectionOpen(false);
    setTagSelection(EMPTY_TAG_SELECTION);
    setSubmitting(false);

    if (!saveFailed) {
      handleBack();
    }
  }

  if (vm.page !== "addParagraph" || vm.paragraphViewMode !== "continueImport" || !paragraph) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <button type="button" onClick={handleBack} className="text-sm text-blue-600 underline">
        {continueStr.backLink}
      </button>
      <h2 className="font-medium">{continueStr.pageTitle}</h2>
      <p className="text-sm text-gray-700">{continueStr.pageDescription}</p>
      {notice ? <p className="text-sm text-blue-700">{notice}</p> : null}

      <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-3">
        <input
          className="w-full rounded-md border px-3 py-2"
          placeholder={str.titlePlaceholder}
          aria-label={str.titleLabel}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={submitting}
        />
        <textarea
          className="w-full cursor-not-allowed rounded-md border bg-gray-50 px-3 py-2 text-gray-600"
          value={paragraph.rawText}
          readOnly
          rows={4}
        />

        <p className="text-xs text-gray-500">{str.selectionHint}</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border-2 border-transparent bg-[#e8f6e8]" />
            {str.selector.legendKnown}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border-2 border-transparent bg-[#fff1cd]" />
            {str.selector.legendUnknown}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border-2 border-[#3d6cff] bg-[#dbe6ff]" />
            {str.selector.legendSelected}
          </span>
        </div>

        <div className="space-y-2 rounded-md border bg-white p-3">
          {paragraph.sentences.map((sentence) => (
            <div key={sentence.index} className={sentence.paragraphBreakBefore ? "border-t pt-3" : ""}>
              <ParagraphSpanSelector
                sentence={sentence}
                characterMatches={characterMatchesBySentence.get(sentence.index) ?? []}
                phraseMatches={phraseMatchesBySentence.get(sentence.index) ?? []}
                selectedRanges={getSentenceSelection(sentence.index)}
                onSelectionChange={(ranges) => handleSentenceSelectionChange(sentence.index, ranges)}
                vocabPhrasePinyinByPhrase={vocabPhrasePinyinByPhrase}
                str={str.selector}
              />
            </div>
          ))}
        </div>

        <div>
          <button
            type="button"
            onClick={() => {
              setTagSectionOpen((open) => !open);
              setTagSelection(EMPTY_TAG_SELECTION);
            }}
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
          disabled={submitting}
        >
          {continueStr.saveButton}
        </button>
      </form>
    </section>
  );
}
