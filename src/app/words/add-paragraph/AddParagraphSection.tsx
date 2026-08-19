"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/app/shared/locale";
import {
  addVocabPhrases,
  addWords,
  assignVocabPhraseLessonTags,
  assignWordLessonTags,
  createLessonTagIfNew,
  createParagraph,
} from "@/lib/supabase-service";
import { makeId } from "@/lib/id";
import type { Word } from "@/lib/types";
import { buildParagraphSentences, truncateParagraphInput } from "@/lib/paragraphParsing";
import { triageParagraphCharacters, triagePhrasesInText } from "@/lib/paragraphTriage";
import type { CharacterTriageMatch, PhraseTriageMatch } from "@/lib/paragraphTriage";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import TagCascadePicker, { type TagCascadeSelection } from "../shared/TagCascadePicker";
import { taggingStrings } from "../shared/tagging.strings";
import { addParagraphStrings } from "./addParagraph.strings";
import ParagraphSpanSelector from "./ParagraphSpanSelector";
import type { ParagraphSpanRange } from "./addParagraph.types";
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

export default function AddParagraphSection({ vm }: { vm: WordsWorkspaceVM }) {
  const locale = useLocale();
  const str = addParagraphStrings[locale];
  const tagStr = taggingStrings[locale].add;

  const {
    paragraphInput,
    setParagraphInput,
    paragraphTitle,
    setParagraphTitle,
    paragraphTruncated,
    setParagraphTruncated,
    paragraphSentences,
    setParagraphSentences,
    paragraphCharacterMatches,
    setParagraphCharacterMatches,
    paragraphPhraseMatches,
    setParagraphPhraseMatches,
    paragraphSelection,
    setParagraphSelection,
    paragraphSubmitting,
    setParagraphSubmitting,
    paragraphNotice,
    setParagraphNotice,
    paragraphTagSectionOpen,
    setParagraphTagSectionOpen,
    paragraphTagSelection,
    setParagraphTagSelection,
  } = vm;

  const [charMatchesBySentence, setCharMatchesBySentence] = useState<Map<number, CharacterTriageMatch[]>>(
    new Map()
  );
  const [phraseMatchesBySentence, setPhraseMatchesBySentence] = useState<Map<number, PhraseTriageMatch[]>>(
    new Map()
  );

  const vocabPhrasePinyinByPhrase = useMemo(
    () => new Map(vm.vocabPhrases.filter((p) => p.pinyin).map((p) => [p.phrase, p.pinyin as string])),
    [vm.vocabPhrases]
  );

  function handleToggleTagSection() {
    setParagraphTagSectionOpen((open: boolean) => !open);
    setParagraphTagSelection(EMPTY_TAG_SELECTION);
  }

  function groupBySentence<T extends { sentenceIndex: number }>(matches: T[]): Map<number, T[]> {
    const map = new Map<number, T[]>();
    for (const match of matches) {
      const list = map.get(match.sentenceIndex) ?? [];
      list.push(match);
      map.set(match.sentenceIndex, list);
    }
    return map;
  }

  function handleParse() {
    const { text, truncated } = truncateParagraphInput(paragraphInput);
    setParagraphTruncated(truncated);
    setParagraphSelection([]);
    setParagraphNotice(null);

    if (!text.trim()) {
      setParagraphSentences([]);
      setParagraphCharacterMatches([]);
      setParagraphPhraseMatches([]);
      setCharMatchesBySentence(new Map());
      setPhraseMatchesBySentence(new Map());
      setParagraphNotice(str.noInput);
      return;
    }

    const sentences = buildParagraphSentences(text);
    setParagraphSentences(sentences);

    const existingHanzi = new Map(vm.words.map((word) => [word.hanzi, word.id]));
    const existingPhrases = new Map(vm.vocabPhrases.map((phrase) => [phrase.phrase, phrase.id]));
    const sentenceTexts = sentences.map((sentence) => sentence.text);
    const characterMatches = triageParagraphCharacters(sentenceTexts, existingHanzi);
    const phraseMatches = triagePhrasesInText(sentenceTexts, existingPhrases);

    setParagraphCharacterMatches(characterMatches);
    setParagraphPhraseMatches(phraseMatches);
    setCharMatchesBySentence(groupBySentence(characterMatches));
    setPhraseMatchesBySentence(groupBySentence(phraseMatches));

    if (characterMatches.length === 0) {
      setParagraphNotice(str.noHanziContent);
    }
  }

  function getSentenceSelection(sentenceIndex: number): ParagraphSpanRange[] {
    return paragraphSelection
      .filter((range) => range.sentenceIndex === sentenceIndex)
      .map((range) => ({ startOffset: range.startOffset, endOffset: range.endOffset }));
  }

  function handleSentenceSelectionChange(sentenceIndex: number, ranges: ParagraphSpanRange[]) {
    setParagraphSelection((previous) => [
      ...previous.filter((range) => range.sentenceIndex !== sentenceIndex),
      ...ranges.map((range) => ({ sentenceIndex, ...range })),
    ]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (paragraphSentences.length === 0) {
      setParagraphNotice(str.noInput);
      return;
    }

    const resolvedTagSectionOpen = paragraphTagSectionOpen;
    if (
      resolvedTagSectionOpen &&
      (!paragraphTagSelection.textbookId ||
        !paragraphTagSelection.grade ||
        !paragraphTagSelection.unit ||
        !paragraphTagSelection.lesson)
    ) {
      setParagraphNotice(tagStr.partialTagError);
      return;
    }

    setParagraphSubmitting(true);
    setParagraphNotice(null);

    const sentenceTextsByIndex = new Map(paragraphSentences.map((sentence) => [sentence.index, sentence.text]));
    const resolved = resolveSelectedSpans(
      paragraphSelection,
      sentenceTextsByIndex,
      paragraphCharacterMatches,
      paragraphPhraseMatches
    );
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
      setParagraphNotice(str.saveError);
      setParagraphSubmitting(false);
      return;
    }

    if (newWords.length > 0 || createdPhraseIds.size > 0) {
      // vm.words/vm.vocabPhrases are stale the moment new rows are inserted
      // above -- without this, a second submission later in the same
      // browser session (e.g. Continue Import on this very paragraph)
      // re-triages against outdated data, treats what was just added as
      // still unknown, and tries to re-insert it -- which fails with a real
      // Postgres unique-constraint conflict rather than the intended
      // silent-skip, since addWords' upsert onConflict target is `id`
      // (always fresh), not `hanzi`.
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

    if (
      resolvedTagSectionOpen &&
      paragraphTagSelection.textbookId &&
      paragraphTagSelection.grade &&
      paragraphTagSelection.unit &&
      paragraphTagSelection.lesson
    ) {
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
            paragraphTagSelection.textbookId,
            paragraphTagSelection.grade,
            paragraphTagSelection.unit,
            paragraphTagSelection.lesson
          );
          if (wordIds.length > 0) await assignWordLessonTags(wordIds, lessonTag.id);
          if (phraseIds.length > 0) await assignVocabPhraseLessonTags(phraseIds, lessonTag.id);
        } catch {
          notices.push(str.tagAssignError);
        }
      }
    }

    const finalSentences = mergeResolvedSpansIntoSentences(
      paragraphSentences,
      resolved,
      wordIdByHanzi,
      createdPhraseIds
    );

    let saveFailed = false;
    try {
      const created = await createParagraph(paragraphInput, paragraphTitle.trim() || null, finalSentences);
      vm.setParagraphs((previous) => [created, ...previous]);
    } catch {
      saveFailed = true;
      notices.push(str.saveError);
    }

    setParagraphNotice(notices.join(" "));
    setParagraphSelection([]);
    setParagraphTagSectionOpen(false);
    setParagraphTagSelection(EMPTY_TAG_SELECTION);

    if (!saveFailed) {
      setParagraphInput("");
      setParagraphTitle("");
      setParagraphSentences([]);
      setParagraphCharacterMatches([]);
      setParagraphPhraseMatches([]);
      setCharMatchesBySentence(new Map());
      setPhraseMatchesBySentence(new Map());
      setParagraphTruncated(false);
    }

    setParagraphSubmitting(false);
  }

  if (vm.page !== "addParagraph" || vm.paragraphViewMode !== "import") {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      {vm.paragraphs.length > 0 ? (
        <button
          type="button"
          onClick={() => vm.setParagraphViewMode("library")}
          className="text-sm text-blue-600 underline"
        >
          {str.library.browseLibraryButton}
        </button>
      ) : null}
      <h2 className="font-medium">{str.pageTitle}</h2>
      <p className="text-sm text-gray-700">{str.pageDescription}</p>
      {paragraphNotice ? <p className="text-sm text-blue-700">{paragraphNotice}</p> : null}
      {paragraphTruncated ? (
        <p className="text-sm text-orange-700">{str.truncatedNotice.replace("{count}", String(paragraphInput.length))}</p>
      ) : null}

      <div className="space-y-3 rounded-md border p-3">
        <input
          className="w-full rounded-md border px-3 py-2"
          placeholder={str.titlePlaceholder}
          aria-label={str.titleLabel}
          value={paragraphTitle}
          onChange={(event) => setParagraphTitle(event.target.value)}
          disabled={paragraphSubmitting}
        />
        <textarea
          className="w-full rounded-md border px-3 py-2"
          placeholder={str.inputPlaceholder}
          value={paragraphInput}
          onChange={(event) => setParagraphInput(event.target.value)}
          disabled={paragraphSubmitting}
          rows={6}
        />
        <button
          type="button"
          onClick={handleParse}
          disabled={paragraphSubmitting || !paragraphInput.trim()}
          className="btn-primary rounded-md border-2 px-4 py-2 disabled:opacity-50"
        >
          {paragraphSentences.length > 0 ? str.reparseButton : str.parseButton}
        </button>
      </div>

      {paragraphSentences.length > 0 ? (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-3">
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
            {paragraphSentences.map((sentence) => (
              <div key={sentence.index} className={sentence.paragraphBreakBefore ? "pt-3 border-t" : ""}>
                <ParagraphSpanSelector
                  sentence={sentence}
                  characterMatches={charMatchesBySentence.get(sentence.index) ?? []}
                  phraseMatches={phraseMatchesBySentence.get(sentence.index) ?? []}
                  selectedRanges={getSentenceSelection(sentence.index)}
                  onSelectionChange={(ranges) => handleSentenceSelectionChange(sentence.index, ranges)}
                  vocabPhrasePinyinByPhrase={vocabPhrasePinyinByPhrase}
                  str={str.selector}
                />
              </div>
            ))}
          </div>

          {/* Lesson tag section — pre-submit placement, mirrors AddVocabPhraseSection */}
          <div>
            <button type="button" onClick={handleToggleTagSection} className="text-sm text-blue-600 underline">
              {paragraphTagSectionOpen ? tagStr.collapseButton : tagStr.expandButton}
            </button>

            {paragraphTagSectionOpen ? (
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
                  onSelectionChange={setParagraphTagSelection}
                />
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            className="btn-primary rounded-md border-2 px-4 py-2 disabled:opacity-50"
            disabled={paragraphSubmitting}
          >
            {str.submitButton}
          </button>
        </form>
      ) : null}
    </section>
  );
}
