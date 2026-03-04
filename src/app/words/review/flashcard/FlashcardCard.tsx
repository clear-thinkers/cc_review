"use client";

import type { Word } from "@/lib/types";
import type { FlashcardLlmResponse } from "@/lib/flashcardLlm";
import type { WordsLocaleStrings } from "../../shared/words.shared.types";
import "./flashcard.styles.css";

export interface FlashcardCardProps {
  word: Word;
  flashcardContent: FlashcardLlmResponse | undefined;
  str: WordsLocaleStrings;
  pronunciationLabel: string;
  showPinyin?: boolean;
}

const HANZI_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const PINYIN_CLEAN_REGEX = /[^\p{L}\p{M}0-9]/gu;

function isHanziCharacter(character: string): boolean {
  return HANZI_REGEX.test(character);
}

function splitPinyinTokens(pinyin: string): string[] {
  return pinyin
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(PINYIN_CLEAN_REGEX, ""))
    .filter(Boolean);
}

function renderRubyLine(
  text: string,
  pinyin: string,
  variant: "character" | "phrase" | "example",
  showPinyin: boolean = false
) {
  const characters = Array.from(text || "");
  const pinyinTokens = splitPinyinTokens(pinyin || "");
  let pinyinIndex = 0;

  return (
    <div className={`flashcard-ruby-line flashcard-ruby-line-${variant}`}>
      {characters.map((character, index) => {
        const isHanzi = isHanziCharacter(character);
        const pinyinForCharacter =
          isHanzi && pinyinIndex < pinyinTokens.length ? pinyinTokens[pinyinIndex++] : "";

        return (
          <span
            key={`${variant}-${index}-${character}`}
            className={`flashcard-ruby-unit ${isHanzi ? "flashcard-ruby-unit-hanzi" : "flashcard-ruby-unit-plain"}`}
          >
            {showPinyin ? (
              pinyinForCharacter ? (
                <span className={`flashcard-ruby-pinyin flashcard-ruby-pinyin-${variant}`}>
                  {pinyinForCharacter.toLowerCase()}
                </span>
              ) : (
                <span className="flashcard-ruby-pinyin-placeholder" aria-hidden="true">
                  ·
                </span>
              )
            ) : null}
            <span className={`flashcard-ruby-text flashcard-ruby-text-${variant}`}>
              {character}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default function FlashcardCard({
  word,
  flashcardContent,
  str,
  pronunciationLabel,
  showPinyin = false,
}: FlashcardCardProps) {

  if (!flashcardContent) {
    return (
      <div className="flashcard-card">
        <div className="flashcard-loading">
          <p>{str.flashcard.loadingContent}</p>
        </div>
      </div>
    );
  }

  // Extract character pinyin and meanings
  const characterPinyin = pronunciationLabel || "";
  const meanings = flashcardContent.meanings || [];

  // Check if there are any phrases marked for fill-test across all meanings
  const hasPhrasesForTesting = meanings.some((meaning) =>
    (meaning.phrases || []).some((phrase) => phrase.include_in_fill_test === true)
  );

  // Don't render card if no phrases are marked for testing
  if (!hasPhrasesForTesting) {
    return null;
  }

  return (
    <div className={`flashcard-card ${!showPinyin ? "hide-pinyin" : ""}`}>
      {/* Character section (always visible) */}
      <div className="flashcard-character-section">
        {renderRubyLine(word.hanzi, characterPinyin, "character", showPinyin)}
      </div>

      {/* Meaning sub-blocks section */}
      {meanings.length > 0 ? (
        <div className="flashcard-meanings-container">
          {meanings.map((meaning, meaningIndex) => {
            // Collect phrase-example pairs for this specific meaning marked for fill-test
            const phraseExamplePairs = (meaning.phrases || [])
              .filter((phrase) => phrase.include_in_fill_test === true)
              .map((phrase) => ({
                phrasePinyin: phrase.pinyin || "",
                phrase: phrase.phrase || "",
                examplePinyin: phrase.example_pinyin || "",
                example: phrase.example || "",
              }));

            return (
              <div key={meaningIndex} className="flashcard-meaning-block">
                {/* Meaning definition */}
                {meaning.definition && (
                  <div className="flashcard-meaning-section">
                    <p className="flashcard-meaning-text">
                      {meaning.definition}
                      {meaning.definition_en && ` / ${meaning.definition_en}`}
                    </p>
                  </div>
                )}

                {/* Phrase-example blocks for this meaning */}
                <div className="flashcard-details-section">
                  {phraseExamplePairs.length > 0 ? (
                    <div className="flashcard-blocks-container">
                      {phraseExamplePairs.map((pair, pairIndex) => (
                        <div
                          key={pairIndex}
                          className="flashcard-phrase-example-block"
                        >
                          {/* Phrase with per-character pinyin */}
                          {pair.phrase
                            ? renderRubyLine(pair.phrase, pair.phrasePinyin, "phrase", showPinyin)
                            : null}

                          {/* Gap between phrase and example */}
                          <div className="flashcard-block-gap" />

                          {/* Example with per-character pinyin */}
                          {pair.example
                            ? renderRubyLine(pair.example, pair.examplePinyin, "example", showPinyin)
                            : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
