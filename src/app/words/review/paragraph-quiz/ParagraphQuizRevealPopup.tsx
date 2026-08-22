"use client";

import { useMemo } from "react";
import type { ParagraphQuizBlank } from "@/lib/paragraphQuizBuilder";
import type { Word, VocabPhrase } from "@/lib/types";
import type { FlashcardContentEntry } from "@/lib/supabase-service";
import type { WordsLocaleStrings } from "../../shared/words.shared.types";
import { renderPhraseWithPinyin, renderSentenceWithPinyin } from "../../shared/words.shared.utils";
import { resolveCharacterRevealContent, resolvePhraseRevealContent } from "./paragraphQuiz.utils";

export interface ParagraphQuizRevealPopupProps {
  blank: ParagraphQuizBlank;
  words: Word[];
  vocabPhrases: VocabPhrase[];
  allFlashcardContents: FlashcardContentEntry[];
  str: WordsLocaleStrings;
  onClose: () => void;
}

/**
 * Reveal-after-3-bounces popup (feature spec 2026-08-22). Read-only --
 * mounting/unmounting this component never calls gradeWord/gradeVocabPhrase/
 * nudgeWordFamiliarity or touches blankState/retryCount; ParagraphQuizReviewSection.tsx's
 * revealOpenSpanId is the only state this popup's presence depends on.
 *
 * Centered Tailwind-only portal-style overlay, deliberately NOT
 * results/results.module.css (that CSS module exception is scoped to
 * results/ only per 0_BUILD_CONVENTIONS.md §7).
 */
export default function ParagraphQuizRevealPopup({
  blank,
  words,
  vocabPhrases,
  allFlashcardContents,
  str,
  onClose,
}: ParagraphQuizRevealPopupProps) {
  const revealStr = str.paragraphQuiz.reveal;

  const content = useMemo(() => {
    if (blank.wordId) {
      const word = words.find((item) => item.id === blank.wordId);
      return word ? resolveCharacterRevealContent(word, allFlashcardContents) : null;
    }
    if (blank.vocabPhraseId) {
      const vocabPhrase = vocabPhrases.find((item) => item.id === blank.vocabPhraseId);
      return vocabPhrase ? resolvePhraseRevealContent(vocabPhrase) : null;
    }
    return null;
  }, [blank, words, vocabPhrases, allFlashcardContents]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-xl">
        {!content ? (
          <p className="text-sm text-gray-600">{revealStr.noContentMessage}</p>
        ) : content.kind === "character" ? (
          <div className="space-y-4">
            {content.entries.map((entry, entryIndex) => (
              <div key={`${entry.pronunciation}-${entryIndex}`} className="space-y-2">
                {content.entries.length > 1 ? (
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {revealStr.pronunciationLabel}
                  </p>
                ) : null}
                <p className="text-2xl font-bold">{renderPhraseWithPinyin(content.hanzi, entry.pronunciation)}</p>
                {entry.meanings.map((meaning, meaningIndex) => (
                  <div key={meaningIndex} className="space-y-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {meaning.definition}
                      {meaning.definition_en ? ` / ${meaning.definition_en}` : ""}
                    </p>
                    {meaning.phrases
                      .filter((phrase) => phrase.include_in_fill_test)
                      .map((phrase, phraseIndex) => (
                        <div key={phraseIndex} className="rounded-md border border-gray-200 p-2 text-sm">
                          <p>{renderPhraseWithPinyin(phrase.phrase, phrase.pinyin)}</p>
                          {phrase.example ? (
                            <p className="text-gray-600">
                              {renderSentenceWithPinyin(phrase.example, phrase.example_pinyin ?? "")}
                            </p>
                          ) : null}
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-2xl font-bold">{renderPhraseWithPinyin(content.phrase, content.pinyin)}</p>
            {content.meaningZh ? <p className="text-sm font-semibold text-gray-900">{content.meaningZh}</p> : null}
            {content.meaningEn ? <p className="text-xs italic text-gray-500">{content.meaningEn}</p> : null}
            {content.example ? (
              <p className="text-sm text-gray-600">
                {renderSentenceWithPinyin(content.example.zh, content.example.pinyin)}
              </p>
            ) : null}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="btn-neutral mt-4 rounded-md border px-3 py-2 text-sm font-medium"
        >
          {revealStr.popupCloseButton}
        </button>
      </div>
    </div>
  );
}
