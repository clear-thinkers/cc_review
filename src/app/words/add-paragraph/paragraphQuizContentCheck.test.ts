import { describe, expect, it } from "vitest";
import { spanHasHintableContent } from "./paragraphQuizContentCheck";
import type { ParagraphSpan } from "@/lib/paragraph.types";
import type { Word, VocabPhrase } from "@/lib/types";
import type { FlashcardContentEntry } from "@/lib/supabase-service";

function makeSpan(overrides: Partial<ParagraphSpan>): ParagraphSpan {
  return {
    id: "span-1",
    text: "字",
    startOffset: 0,
    endOffset: 1,
    kind: "character",
    fillTestEligible: true,
    ...overrides,
  };
}

function makeWord(overrides: Partial<Word>): Word {
  return {
    id: "word-1",
    hanzi: "字",
    createdAt: 0,
    repetitions: 0,
    intervalDays: 0,
    ease: 2.5,
    nextReviewAt: 0,
    ...overrides,
  };
}

function makeFlashcardEntry(overrides: Partial<FlashcardContentEntry>): FlashcardContentEntry {
  return {
    key: "字|zi4",
    character: "字",
    pronunciation: "zi4",
    content: { character: "字", pronunciation: "zi4", meanings: [] },
    updatedAt: 0,
    ...overrides,
  };
}

function makeVocabPhrase(overrides: Partial<VocabPhrase>): VocabPhrase {
  return {
    id: "phrase-1",
    phrase: "帮助",
    examples: [],
    testCount: 0,
    createdAt: 0,
    ...overrides,
  };
}

describe("spanHasHintableContent", () => {
  it("a word-backed span with a matching flashcard_contents row has content", () => {
    const span = makeSpan({ resolvedWordId: "word-1" });
    const words = [makeWord({ id: "word-1", hanzi: "字" })];
    const entries = [makeFlashcardEntry({ character: "字" })];
    expect(spanHasHintableContent(span, words, [], entries)).toBe(true);
  });

  it("a word-backed span with no matching flashcard_contents row is missing content -- the bug scenario", () => {
    const span = makeSpan({ resolvedWordId: "word-1" });
    const words = [makeWord({ id: "word-1", hanzi: "字" })];
    expect(spanHasHintableContent(span, words, [], [])).toBe(false);
  });

  it("a word-backed span whose word can't be found is missing content", () => {
    const span = makeSpan({ resolvedWordId: "missing-word" });
    expect(spanHasHintableContent(span, [], [], [])).toBe(false);
  });

  it("a phrase-backed span with full phrase content (pinyin, both meanings, an example) has content", () => {
    const span = makeSpan({ resolvedVocabPhraseId: "phrase-1", kind: "phrase", text: "帮助" });
    const phrases = [
      makeVocabPhrase({
        id: "phrase-1",
        pinyin: "bang1zhu4",
        meaningZh: "帮忙",
        meaningEn: "to help",
        examples: [{ zh: "我帮助他。", pinyin: "wo3 bang1zhu4 ta1", includeInFillTest: true }],
      }),
    ];
    expect(spanHasHintableContent(span, [], phrases, [])).toBe(true);
  });

  it("a phrase-backed span missing pinyin/meanings/examples is missing content", () => {
    const span = makeSpan({ resolvedVocabPhraseId: "phrase-1", kind: "phrase", text: "帮助" });
    const phrases = [makeVocabPhrase({ id: "phrase-1" })];
    expect(spanHasHintableContent(span, [], phrases, [])).toBe(false);
  });

  it("a phrase-backed span whose phrase can't be found is missing content", () => {
    const span = makeSpan({ resolvedVocabPhraseId: "missing-phrase", kind: "phrase" });
    expect(spanHasHintableContent(span, [], [], [])).toBe(false);
  });

  it("an unresolved span (neither resolvedWordId nor resolvedVocabPhraseId) is missing content", () => {
    const span = makeSpan({});
    expect(spanHasHintableContent(span, [], [], [])).toBe(false);
  });
});
