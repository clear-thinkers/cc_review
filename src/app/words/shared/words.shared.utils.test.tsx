import { Children, isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  applyAdminMeaningEdit,
  buildBundledFillTestPlan,
  buildContentByCharacterMap,
  buildDueReviewAutosavePayload,
  buildFillTestPlanForVocabPhrases,
  cloneFillTest,
  filterPausedSessionsForViewer,
  findFlashcardPhrasePinyin,
  getPausedParagraphQuizRemainingBlankCount,
  getPausedSessionRemainingCount,
  isVocabPhraseFillTestReady,
  isVocabPhraseRoundQuizWord,
  renderPhraseWithPinyin,
  renderSentenceWithPinyin,
  resolveDueReviewResume,
  resolveParagraphQuizResume,
  resolvePackagedReviewResume,
  resolveQuizCompletionNotice,
  revalidateSavedQuizQueue,
  selectLowestFamiliarityWords,
  tokenizePinyinSyllables,
  VOCAB_PHRASE_ROUND_ID_PREFIX,
  wrapVocabPhraseRoundAsQuizWord,
} from "./words.shared.utils";
import type { TestableVocabPhrase, TestableWord } from "../review/fill-test/fillTest.types";
import type { FlashcardContentEntry } from "@/lib/supabase-service";
import type { FlashcardLlmResponse } from "@/lib/flashcardLlm";
import type { ReviewSessionProgress } from "@/lib/reviewSessionProgress.types";
import type { ParagraphQuizPage } from "@/lib/paragraphQuizBuilder";
import type { VocabPhrase, Word } from "@/lib/types";
import { wordsStrings } from "../words.strings";

type NodeWithChildren = {
  children?: ReactNode;
};

function collectRtTexts(node: ReactNode): string[] {
  const texts: string[] = [];

  const walk = (current: ReactNode): void => {
    if (current == null || typeof current === "boolean") {
      return;
    }

    if (typeof current === "string" || typeof current === "number") {
      return;
    }

    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }

    if (!isValidElement(current)) {
      return;
    }

    const children = (current.props as NodeWithChildren).children;

    if (typeof current.type === "string" && current.type === "rt") {
      const text = Children.toArray(children)
        .map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
        .join("");
      texts.push(text);
    }

    Children.forEach(children, walk);
  };

  walk(node);
  return texts;
}

function getRootClassName(node: ReactNode): string {
  if (!isValidElement(node)) {
    return "";
  }

  const className = (node.props as { className?: string }).className;
  return typeof className === "string" ? className : "";
}

describe("tokenizePinyinSyllables", () => {
  it("keeps full syllables when pinyin contains tone-mark vowels", () => {
    expect(tokenizePinyinSyllables("l\u0101 ch\u0113")).toEqual(["l\u0101", "ch\u0113"]);
    expect(tokenizePinyinSyllables("xu\u00e9 x\u00ed")).toEqual(["xu\u00e9", "x\u00ed"]);
  });
});

describe("pinyin rendering regression guard", () => {
  it("renders full tone-marked syllables for phrase ruby text", () => {
    const rtTexts = collectRtTexts(renderPhraseWithPinyin("\u62c9\u8f66", "l\u0101 ch\u0113"));
    expect(rtTexts).toEqual(["l\u0101", "ch\u0113"]);
  });

  it("renders full tone-marked syllables for sentence ruby text", () => {
    const rtTexts = collectRtTexts(
      renderSentenceWithPinyin("\u6211\u62c9\u8f66\u3002", "w\u01d2 l\u0101 ch\u0113")
    );
    expect(rtTexts).toEqual(["w\u01d2", "l\u0101", "ch\u0113"]);
  });

  it("allows wrapped sentence layout when requested", () => {
    const className = getRootClassName(
      renderSentenceWithPinyin(
        "\u8fd9\u573a\u767e\u7c73\u8d5b\u8dd1\u4e2d\uff0c\u4e24\u4f4d\u9009\u624b\u5e76\u9a7e\u9f50\u9a71\u3002",
        "zh\u00e8 ch\u01ceng b\u01cei m\u01d0 s\u00e0i p\u01ceo zh\u014dng li\u01ceng w\u00e8i xu\u01cen sh\u01d2u b\u00ecng ji\u00e0 q\u00ed q\u016b",
        { allowWrap: true }
      )
    );

    expect(className).toContain("flex-wrap");
    expect(className).toContain("max-w-full");
  });
});

describe("applyAdminMeaningEdit", () => {
  it("updates a meaning label and replaces its English translation", () => {
    const updated = applyAdminMeaningEdit({
      content: {
        character: "兵",
        pronunciation: "bing",
        meanings: [
          {
            definition: "士兵",
            definition_en: "soldier",
            phrases: [
              {
                phrase: "士兵",
                pinyin: "shi bing",
                example: "士兵在训练。",
                example_pinyin: "shi bing zai xun lian。",
              },
            ],
          },
        ],
      },
      currentMeaningZh: "士兵",
      currentMeaningEn: "soldier",
      nextMeaningZh: "军人",
      nextMeaningEn: "service member",
    });

    expect(updated.meanings).toHaveLength(1);
    expect(updated.meanings[0].definition).toBe("军人");
    expect(updated.meanings[0].definition_en).toBe("service member");
  });

  it("merges phrases/examples when the edited meaning matches another saved meaning", () => {
    const updated = applyAdminMeaningEdit({
      content: {
        character: "兵",
        pronunciation: "bing",
        meanings: [
          {
            definition: "士兵",
            definition_en: "soldier",
            phrases: [
              {
                phrase: "士兵",
                pinyin: "shi bing",
                example: "士兵在训练。",
                example_pinyin: "shi bing zai xun lian。",
              },
              {
                phrase: "兵营",
                pinyin: "bing ying",
                example: "兵营很整齐。",
                example_pinyin: "bing ying hen zheng qi。",
              },
            ],
          },
          {
            definition: "军人",
            definition_en: "military person",
            phrases: [
              {
                phrase: "士兵",
                pinyin: "shi bing",
                example: "士兵在训练。",
                example_pinyin: "shi bing zai xun lian。",
              },
              {
                phrase: "兵种",
                pinyin: "bing zhong",
                example: "这个兵种很重要。",
                example_pinyin: "zhe ge bing zhong hen zhong yao。",
              },
            ],
          },
        ],
      },
      currentMeaningZh: "士兵",
      currentMeaningEn: "soldier",
      nextMeaningZh: "军人",
      nextMeaningEn: "service member",
    });

    expect(updated.meanings).toHaveLength(1);
    expect(updated.meanings[0].definition).toBe("军人");
    expect(updated.meanings[0].definition_en).toBe("service member");
    expect(updated.meanings[0].phrases.map((phrase) => phrase.phrase)).toEqual(["士兵", "兵种", "兵营"]);
  });
});

function makeQuizWord(id: string, hanzi: string, phrases: string[]): TestableWord {
  return {
    id,
    hanzi,
    createdAt: 1,
    repetitions: 0,
    intervalDays: 0,
    ease: 0,
    nextReviewAt: 0,
    fillTest: {
      phrases,
      sentences: phrases.map((phrase, index) => ({
        text: `${hanzi}${index}___。`,
        answerIndex: index,
      })),
    },
  };
}

describe("buildBundledFillTestPlan", () => {
  it("builds standard-partner bundles before ordinary quizzes", () => {
    const onePhrase = makeQuizWord("w1", "\u4e00", ["\u4e00\u4e2a"]);
    const twoPhrase = makeQuizWord("w2", "\u4e8c", ["\u4e8c\u6708", "\u4e8c\u5341"]);
    const standardA = makeQuizWord("w3", "\u4e09", ["\u4e09\u4e2a", "\u4e09\u5929", "\u4e09\u5c81"]);
    const standardB = makeQuizWord("w4", "\u56db", ["\u56db\u4e2a", "\u56db\u5929", "\u56db\u5c81"]);
    const standardC = makeQuizWord("w5", "\u4e94", ["\u4e94\u4e2a", "\u4e94\u5929", "\u4e94\u5c81"]);

    const plan = buildBundledFillTestPlan([onePhrase, twoPhrase, standardA, standardB, standardC]);

    expect(plan.quizWords.map((word) => word.fillTest.sentences.length)).toEqual([4, 5, 3]);
    expect(plan.quizWords[0]?.fillTest.members?.map((member) => member.wordId)).toEqual(["w1", "w3"]);
    expect(plan.quizWords[1]?.fillTest.members?.map((member) => member.wordId)).toEqual(["w2", "w4"]);
    expect(plan.quizWords[2]?.fillTest.members?.map((member) => member.wordId)).toEqual(["w5"]);
  });

  it("builds low-plus-low, terminal, and solo bundled quizzes", () => {
    const oneA = makeQuizWord("w1", "\u4e00", ["\u4e00\u4e2a"]);
    const twoA = makeQuizWord("w2", "\u4e8c", ["\u4e8c\u6708", "\u4e8c\u5341"]);
    const oneB = makeQuizWord("w3", "\u4e09", ["\u4e09\u4e2a"]);
    const oneC = makeQuizWord("w4", "\u56db", ["\u56db\u4e2a"]);
    const oneD = makeQuizWord("w5", "\u4e94", ["\u4e94\u4e2a"]);

    const plan = buildBundledFillTestPlan([oneA, twoA, oneB, oneC, oneD]);

    expect(plan.quizWords.map((word) => word.fillTest.sentences.length)).toEqual([3, 2, 1]);
    expect(plan.quizWords[0]?.fillTest.members?.map((member) => member.wordId)).toEqual(["w1", "w2"]);
    expect(plan.quizWords[1]?.fillTest.members?.map((member) => member.wordId)).toEqual(["w3", "w4"]);
    expect(plan.quizWords[2]?.fillTest.members?.map((member) => member.wordId)).toEqual(["w5"]);
    expect(plan.skippedCharacters).toEqual([]);
  });

  it("builds a solo one-blank quiz when one one-phrase character remains", () => {
    const oneA = makeQuizWord("w1", "\u4e00", ["\u4e00\u4e2a"]);

    const plan = buildBundledFillTestPlan([oneA]);

    expect(plan.quizWords).toHaveLength(1);
    expect(plan.quizWords[0]?.fillTest.sentences).toHaveLength(1);
    expect(plan.quizWords[0]?.fillTest.members?.map((member) => member.wordId)).toEqual(["w1"]);
  });
});

function makeVocabPhrase(
  id: string,
  phrase: string,
  exampleTexts: string[],
  options?: { includeInFillTest?: boolean }
): VocabPhrase {
  return {
    id,
    phrase,
    examples: exampleTexts.map((zh) => ({
      zh,
      pinyin: "py",
      includeInFillTest: options?.includeInFillTest ?? true,
    })),
    testCount: 0,
    createdAt: 1,
  };
}

function makeVocabPhraseRound(
  members: Array<{ vocabPhraseId: string; phrase: string }>
): TestableVocabPhrase {
  return {
    id: members.map((member) => member.vocabPhraseId).join("|"),
    phrase: members.map((member) => member.phrase).join("、"),
    examples: [],
    testCount: 0,
    createdAt: 1,
    fillTest: {
      phrases: members.map((member) => member.phrase),
      sentences: members.map((member, index) => ({
        text: `___sentence${index}`,
        answerIndex: index,
        vocabPhraseId: member.vocabPhraseId,
      })),
      vocabPhraseMembers: members.map((member) => ({
        vocabPhraseId: member.vocabPhraseId,
        phrase: member.phrase,
        phraseCount: 1,
      })),
    },
  };
}

describe("buildFillTestPlanForVocabPhrases", () => {
  it("chunks phrases into rounds of up to 3, each row tagged with its own vocabPhraseId", () => {
    const phrases = [
      makeVocabPhrase("p1", "谢谢", ["谢谢你。"]),
      makeVocabPhrase("p2", "对不起", ["对不起，我错了。"]),
      makeVocabPhrase("p3", "没关系", ["没关系，别担心。"]),
      makeVocabPhrase("p4", "你好", ["你好，很高兴认识你。"]),
    ];

    const plan = buildFillTestPlanForVocabPhrases(phrases);

    expect(plan.skippedPhrases).toEqual([]);
    expect(plan.quizPhrases.map((round) => round.fillTest.sentences.length)).toEqual([3, 1]);

    const firstRound = plan.quizPhrases[0];
    expect(firstRound?.fillTest.vocabPhraseMembers?.map((member) => member.vocabPhraseId)).toEqual([
      "p1",
      "p2",
      "p3",
    ]);
    // Each sentence's own vocabPhraseId must resolve back to the correct bank phrase.
    for (const sentence of firstRound?.fillTest.sentences ?? []) {
      const answerPhrase = firstRound?.fillTest.phrases[sentence.answerIndex];
      const member = phrases.find((phrase) => phrase.id === sentence.vocabPhraseId);
      expect(answerPhrase).toBe(member?.phrase);
    }
    // Three distinct phrases in the round means three distinct bank options.
    expect(new Set(firstRound?.fillTest.phrases).size).toBe(3);

    const secondRound = plan.quizPhrases[1];
    expect(secondRound?.fillTest.vocabPhraseMembers?.map((member) => member.vocabPhraseId)).toEqual(["p4"]);
  });

  it("skips a phrase with no fill-test-eligible example and reports it back", () => {
    const eligible = makeVocabPhrase("p1", "谢谢", ["谢谢你。"]);
    const noExamples = makeVocabPhrase("p2", "对不起", []);
    const allExcluded = makeVocabPhrase("p3", "没关系", ["没关系。"], { includeInFillTest: false });

    const plan = buildFillTestPlanForVocabPhrases([eligible, noExamples, allExcluded]);

    expect(plan.skippedPhrases.sort()).toEqual(["对不起", "没关系"]);
    expect(plan.quizPhrases).toHaveLength(1);
    expect(plan.quizPhrases[0]?.fillTest.vocabPhraseMembers?.map((member) => member.vocabPhraseId)).toEqual([
      "p1",
    ]);
  });

  it("returns no rounds and no skips for an empty input", () => {
    const plan = buildFillTestPlanForVocabPhrases([]);
    expect(plan.quizPhrases).toEqual([]);
    expect(plan.skippedPhrases).toEqual([]);
  });
});

describe("cloneFillTest", () => {
  it("preserves vocabPhraseMembers (regression: quiz queue silently lost phrase-round grading)", () => {
    const original = {
      phrases: ["谢谢", "对不起"],
      sentences: [
        { text: "___你。", answerIndex: 0, vocabPhraseId: "p1" },
        { text: "___，我错了。", answerIndex: 1, vocabPhraseId: "p2" },
      ],
      vocabPhraseMembers: [
        { vocabPhraseId: "p1", phrase: "谢谢", phraseCount: 1 },
        { vocabPhraseId: "p2", phrase: "对不起", phraseCount: 1 },
      ],
    };

    const cloned = cloneFillTest(original);

    expect(cloned.vocabPhraseMembers).toEqual(original.vocabPhraseMembers);
    // A real clone, not the same reference -- mutating the clone must not
    // affect the original round definition still held elsewhere.
    expect(cloned.vocabPhraseMembers).not.toBe(original.vocabPhraseMembers);
  });

  it("preserves members (character rounds) unaffected by the vocabPhraseMembers fix", () => {
    const original = {
      phrases: ["谢"],
      sentences: [{ text: "___。", answerIndex: 0, characterId: "w1" }],
      members: [{ wordId: "w1", hanzi: "谢", phraseCount: 1 }],
    };

    const cloned = cloneFillTest(original);

    expect(cloned.members).toEqual(original.members);
    expect(cloned.vocabPhraseMembers).toBeUndefined();
  });
});

describe("isVocabPhraseFillTestReady", () => {
  it("is true when at least one example is fill-test-eligible", () => {
    const phrase = makeVocabPhrase("p1", "谢谢", ["谢谢你。"]);
    expect(isVocabPhraseFillTestReady(phrase)).toBe(true);
  });

  it("is false when the phrase has no examples", () => {
    const phrase = makeVocabPhrase("p2", "对不起", []);
    expect(isVocabPhraseFillTestReady(phrase)).toBe(false);
  });

  it("is false when every example is excluded from fill-test", () => {
    const phrase = makeVocabPhrase("p3", "没关系", ["没关系。"], { includeInFillTest: false });
    expect(isVocabPhraseFillTestReady(phrase)).toBe(false);
  });
});

describe("findFlashcardPhrasePinyin", () => {
  it("finds the pinyin for a phrase saved under any character's content", () => {
    const entries = [
      makeContentEntry("城", "城市", "北京是一座美丽的城市。"),
      makeContentEntry("河", "银河", "夜晚的银河非常美丽。"),
    ];
    expect(findFlashcardPhrasePinyin("银河", entries)).toBe("py");
  });

  it("matches after trimming whitespace, the same equivalence buildFillTestFromSavedContent uses to dedupe candidates", () => {
    const entries = [makeContentEntry("城", "城市", "北京是一座美丽的城市。")];
    expect(findFlashcardPhrasePinyin("  城市  ", entries)).toBe("py");
  });

  it("returns undefined when no saved phrase matches", () => {
    const entries = [makeContentEntry("城", "城市", "北京是一座美丽的城市。")];
    expect(findFlashcardPhrasePinyin("银河", entries)).toBeUndefined();
  });

  it("returns undefined for an empty phrase", () => {
    expect(findFlashcardPhrasePinyin("", [])).toBeUndefined();
  });
});

function makeWord(id: string, hanzi: string): Word {
  return {
    id,
    hanzi,
    createdAt: 1,
    repetitions: 0,
    intervalDays: 0,
    ease: 0,
    nextReviewAt: 0,
  };
}

function makeContent(character: string, phrase: string, example: string): FlashcardLlmResponse {
  return {
    character,
    pronunciation: "ce4",
    meanings: [
      {
        definition: "def",
        phrases: [{ phrase, pinyin: "py", example, example_pinyin: "py" }],
      },
    ],
  };
}

function makeContentEntry(character: string, phrase: string, example: string): FlashcardContentEntry {
  return {
    key: `${character}|ce4`,
    character,
    pronunciation: "ce4",
    content: makeContent(character, phrase, example),
    updatedAt: 0,
  };
}

function makeBundledQuizWord(members: Array<{ wordId: string; hanzi: string }>): TestableWord {
  return {
    id: members.map((member) => member.wordId).join("|"),
    hanzi: members.map((member) => member.hanzi).join(""),
    createdAt: 1,
    repetitions: 0,
    intervalDays: 0,
    ease: 0,
    nextReviewAt: 0,
    fillTest: {
      phrases: members.map((member) => `${member.hanzi}phrase`),
      sentences: members.map((member, index) => ({
        text: `${member.hanzi}___sentence`,
        answerIndex: index,
        characterId: member.wordId,
      })),
      members: members.map((member) => ({ wordId: member.wordId, hanzi: member.hanzi, phraseCount: 1 })),
    },
  };
}

describe("buildContentByCharacterMap", () => {
  it("groups saved content entries by character", () => {
    const entries = [
      makeContentEntry("\u4e00", "\u4e00\u4e2a", "\u8fd9\u662f\u4e00\u4e2a\u4e2a\u3002"),
      makeContentEntry("\u4e8c", "\u4e8c\u6708", "\u73b0\u5728\u662f\u4e8c\u6708\u3002"),
    ];

    const map = buildContentByCharacterMap(entries);

    expect(map.get("\u4e00")).toHaveLength(1);
    expect(map.get("\u4e8c")).toHaveLength(1);
    expect(map.get("\u4e09")).toBeUndefined();
  });
});

describe("revalidateSavedQuizQueue", () => {
  it("keeps a single-member item whose word still exists and content is still eligible", () => {
    const savedItem = makeQuizWord("w1", "\u4e00", ["\u4e00\u4e2a"]);
    const currentWords = [makeWord("w1", "\u4e00")];
    const contentByCharacter = buildContentByCharacterMap([
      makeContentEntry("\u4e00", "\u4e00\u4e2a", "\u8fd9\u662f\u4e00\u4e2a\u4e2a\u3002"),
    ]);

    const result = revalidateSavedQuizQueue([savedItem], currentWords, contentByCharacter);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("w1");
  });

  it("drops an item whose underlying word no longer exists", () => {
    const savedItem = makeQuizWord("w1", "\u4e00", ["\u4e00\u4e2a"]);
    const contentByCharacter = buildContentByCharacterMap([
      makeContentEntry("\u4e00", "\u4e00\u4e2a", "\u8fd9\u662f\u4e00\u4e2a\u4e2a\u3002"),
    ]);

    const result = revalidateSavedQuizQueue([savedItem], [], contentByCharacter);

    expect(result).toHaveLength(0);
  });

  it("drops an item whose word exists but has lost fill-test eligible content", () => {
    const savedItem = makeQuizWord("w1", "\u4e00", ["\u4e00\u4e2a"]);
    const currentWords = [makeWord("w1", "\u4e00")];
    const contentByCharacter = buildContentByCharacterMap([]);

    const result = revalidateSavedQuizQueue([savedItem], currentWords, contentByCharacter);

    expect(result).toHaveLength(0);
  });

  it("drops a whole bundled item when any one member is invalid", () => {
    const bundled = makeBundledQuizWord([
      { wordId: "w1", hanzi: "\u4e00" },
      { wordId: "w2", hanzi: "\u4e8c" },
    ]);
    // w1 still exists with eligible content, w2's word row was deleted.
    const currentWords = [makeWord("w1", "\u4e00")];
    const contentByCharacter = buildContentByCharacterMap([
      makeContentEntry("\u4e00", "\u4e00phrase", "\u4e00phrase___sentence"),
      makeContentEntry("\u4e8c", "\u4e8cphrase", "\u4e8cphrase___sentence"),
    ]);

    const result = revalidateSavedQuizQueue([bundled], currentWords, contentByCharacter);

    expect(result).toHaveLength(0);
  });

  it("passes through a fully-valid queue unchanged", () => {
    const first = makeQuizWord("w1", "\u4e00", ["\u4e00\u4e2a"]);
    const second = makeQuizWord("w2", "\u4e8c", ["\u4e8c\u6708"]);
    const currentWords = [makeWord("w1", "\u4e00"), makeWord("w2", "\u4e8c")];
    const contentByCharacter = buildContentByCharacterMap([
      makeContentEntry("\u4e00", "\u4e00\u4e2a", "\u8fd9\u662f\u4e00\u4e2a\u4e2a\u3002"),
      makeContentEntry("\u4e8c", "\u4e8c\u6708", "\u73b0\u5728\u662f\u4e8c\u6708\u3002"),
    ]);

    const result = revalidateSavedQuizQueue([first, second], currentWords, contentByCharacter);

    expect(result.map((word) => word.id)).toEqual(["w1", "w2"]);
  });

  // Packaged-session-only check: allowedWordIds, when passed, adds an extra
  // "still one of the session's CURRENT quiz-ready targets" filter on top of
  // the word-exists/content-eligible checks above.
  it("drops an item that's still content-eligible but no longer in allowedWordIds (packaged target removed)", () => {
    const savedItem = makeQuizWord("w1", "\u4e00", ["\u4e00\u4e2a"]);
    const currentWords = [makeWord("w1", "\u4e00")];
    const contentByCharacter = buildContentByCharacterMap([
      makeContentEntry("\u4e00", "\u4e00\u4e2a", "\u8fd9\u662f\u4e00\u4e2a\u4e2a\u3002"),
    ]);

    const result = revalidateSavedQuizQueue(
      [savedItem],
      currentWords,
      contentByCharacter,
      new Set(["w2"]) // w1 is not a current packaged quiz-ready target
    );

    expect(result).toHaveLength(0);
  });

  it("keeps an item present in allowedWordIds when the set is provided", () => {
    const savedItem = makeQuizWord("w1", "\u4e00", ["\u4e00\u4e2a"]);
    const currentWords = [makeWord("w1", "\u4e00")];
    const contentByCharacter = buildContentByCharacterMap([
      makeContentEntry("\u4e00", "\u4e00\u4e2a", "\u8fd9\u662f\u4e00\u4e2a\u4e2a\u3002"),
    ]);

    const result = revalidateSavedQuizQueue(
      [savedItem],
      currentWords,
      contentByCharacter,
      new Set(["w1"])
    );

    expect(result).toHaveLength(1);
  });

  it("drops a whole bundled item when only some members remain in allowedWordIds", () => {
    const bundled = makeBundledQuizWord([
      { wordId: "w1", hanzi: "\u4e00" },
      { wordId: "w2", hanzi: "\u4e8c" },
    ]);
    const currentWords = [makeWord("w1", "\u4e00"), makeWord("w2", "\u4e8c")];
    const contentByCharacter = buildContentByCharacterMap([
      makeContentEntry("\u4e00", "\u4e00phrase", "\u4e00phrase___sentence"),
      makeContentEntry("\u4e8c", "\u4e8cphrase", "\u4e8cphrase___sentence"),
    ]);

    // Parent removed w2's target from the packaged session -- w1 alone is
    // still a current quiz-ready target, but the whole bundled grading unit
    // must be dropped since resuming it would try to grade a removed word.
    const result = revalidateSavedQuizQueue(
      [bundled],
      currentWords,
      contentByCharacter,
      new Set(["w1"])
    );

    expect(result).toHaveLength(0);
  });

  it("keeps a wrapped phrase round when every member phrase is still current", () => {
    const round = wrapVocabPhraseRoundAsQuizWord(
      makeVocabPhraseRound([
        { vocabPhraseId: "p1", phrase: "谢谢" },
        { vocabPhraseId: "p2", phrase: "对不起" },
      ])
    );

    const result = revalidateSavedQuizQueue([round], [], new Map(), undefined, new Set(["p1", "p2"]));

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(round.id);
  });

  it("drops a wrapped phrase round when any member phrase was deleted", () => {
    const round = wrapVocabPhraseRoundAsQuizWord(
      makeVocabPhraseRound([
        { vocabPhraseId: "p1", phrase: "谢谢" },
        { vocabPhraseId: "p2", phrase: "对不起" },
      ])
    );

    // p2 was deleted by the parent while the session was paused.
    const result = revalidateSavedQuizQueue([round], [], new Map(), undefined, new Set(["p1"]));

    expect(result).toHaveLength(0);
  });

  it("drops a wrapped phrase round when no currentVocabPhraseIds set is supplied at all", () => {
    const round = wrapVocabPhraseRoundAsQuizWord(makeVocabPhraseRound([{ vocabPhraseId: "p1", phrase: "谢谢" }]));

    // The ad-hoc due-review path never passes currentVocabPhraseIds since it
    // never produces phrase rounds -- a phrase round showing up there is
    // treated as stale rather than trusted blindly.
    const result = revalidateSavedQuizQueue([round], [], new Map());

    expect(result).toHaveLength(0);
  });

  it("never confuses a wrapped phrase round's synthetic id with a real word id", () => {
    const round = wrapVocabPhraseRoundAsQuizWord(makeVocabPhraseRound([{ vocabPhraseId: "p1", phrase: "谢谢" }]));
    expect(isVocabPhraseRoundQuizWord(round)).toBe(true);
    expect(round.id.startsWith(VOCAB_PHRASE_ROUND_ID_PREFIX)).toBe(true);
  });
});

describe("resolveDueReviewResume", () => {
  const currentWords = [makeWord("w1", "\u4e00"), makeWord("w2", "\u4e8c")];
  const allFlashcardContents = [
    makeContentEntry("\u4e00", "\u4e00\u4e2a", "\u8fd9\u662f\u4e00\u4e2a\u4e2a\u3002"),
    makeContentEntry("\u4e8c", "\u4e8c\u6708", "\u73b0\u5728\u662f\u4e8c\u6708\u3002"),
  ];

  it("returns invalid for a malformed payload", () => {
    expect(
      resolveDueReviewResume({ progressData: { not: "shaped right" }, currentWords, allFlashcardContents })
    ).toEqual({ status: "invalid" });
    expect(
      resolveDueReviewResume({ progressData: null, currentWords, allFlashcardContents })
    ).toEqual({ status: "invalid" });
  });

  it("only re-validates the unanswered tail from resumeIndex onward", () => {
    const alreadyGraded = makeQuizWord("gone", "\u4e09", ["\u4e09\u4e2a"]); // word no longer exists, but already answered
    const notYetAnswered = makeQuizWord("w1", "\u4e00", ["\u4e00\u4e2a"]);

    const resolved = resolveDueReviewResume({
      progressData: {
        quizQueue: [alreadyGraded, notYetAnswered],
        resumeIndex: 1,
        quizHistory: [
          { wordId: "gone", hanzi: "\u4e09", tier: "easy", correctCount: 1, totalCount: 1 },
        ],
        quizSelectionMode: "all",
        quizSessionStartTime: 1000,
      },
      currentWords,
      allFlashcardContents,
    });

    expect(resolved.status).toBe("ready");
    if (resolved.status === "ready") {
      expect(resolved.quizQueue.map((word) => word.id)).toEqual(["w1"]);
      expect(resolved.quizHistory).toHaveLength(1);
      expect(resolved.quizSessionStartTime).toBe(1000);
    }
  });

  it("returns empty when resumeIndex already reached the end of the saved queue", () => {
    const item = makeQuizWord("w1", "\u4e00", ["\u4e00\u4e2a"]);

    const resolved = resolveDueReviewResume({
      progressData: {
        quizQueue: [item],
        resumeIndex: 1,
        quizHistory: [],
        quizSelectionMode: "all",
        quizSessionStartTime: null,
      },
      currentWords,
      allFlashcardContents,
    });

    expect(resolved).toEqual({ status: "empty" });
  });

  it("returns empty when every remaining item fails re-validation", () => {
    const invalidItem = makeQuizWord("gone", "\u4e09", ["\u4e09\u4e2a"]);

    const resolved = resolveDueReviewResume({
      progressData: {
        quizQueue: [invalidItem],
        resumeIndex: 0,
        quizHistory: [],
        quizSelectionMode: "all",
        quizSessionStartTime: null,
      },
      currentWords,
      allFlashcardContents,
    });

    expect(resolved).toEqual({ status: "empty" });
  });
});

describe("resolvePackagedReviewResume", () => {
  const currentWords = [makeWord("w1", "\u4e00"), makeWord("w2", "\u4e8c")];
  const allFlashcardContents = [
    makeContentEntry("\u4e00", "\u4e00\u4e2a", "\u8fd9\u662f\u4e00\u4e2a\u4e2a\u3002"),
    makeContentEntry("\u4e8c", "\u4e8c\u6708", "\u73b0\u5728\u662f\u4e8c\u6708\u3002"),
  ];

  it("returns invalid for a malformed payload, same as resolveDueReviewResume", () => {
    expect(
      resolvePackagedReviewResume({
        progressData: { not: "shaped right" },
        currentWords,
        allFlashcardContents,
        quizWordIds: new Set(["w1", "w2"]),
        vocabPhraseIds: new Set(),
      })
    ).toEqual({ status: "invalid" });
  });

  it("resumes normally when every remaining item is still a current quiz-ready target", () => {
    const notYetAnswered = makeQuizWord("w1", "\u4e00", ["\u4e00\u4e2a"]);

    const resolved = resolvePackagedReviewResume({
      progressData: {
        quizQueue: [notYetAnswered],
        resumeIndex: 0,
        quizHistory: [],
        quizSelectionMode: "all",
        quizSessionStartTime: 1000,
      },
      currentWords,
      allFlashcardContents,
      quizWordIds: new Set(["w1", "w2"]),
      vocabPhraseIds: new Set(),
    });

    expect(resolved.status).toBe("ready");
    if (resolved.status === "ready") {
      expect(resolved.quizQueue.map((word) => word.id)).toEqual(["w1"]);
    }
  });

  it("drops a saved item that's still content-eligible but no longer a current quiz-ready target (parent removed it)", () => {
    const notYetAnswered = makeQuizWord("w1", "\u4e00", ["\u4e00\u4e2a"]);

    const resolved = resolvePackagedReviewResume({
      progressData: {
        quizQueue: [notYetAnswered],
        resumeIndex: 0,
        quizHistory: [],
        quizSelectionMode: "all",
        quizSessionStartTime: null,
      },
      currentWords,
      allFlashcardContents,
      // Parent removed w1's packaged target -- it's no longer in the
      // session's current quiz-ready set, even though the word and its
      // content are both still otherwise valid.
      quizWordIds: new Set(["w2"]),
      vocabPhraseIds: new Set(),
    });

    expect(resolved).toEqual({ status: "empty" });
  });

  it("only re-validates the unanswered tail from resumeIndex onward, same as resolveDueReviewResume", () => {
    const alreadyGraded = makeQuizWord("gone", "\u4e09", ["\u4e09\u4e2a"]); // graded before pause, then removed
    const notYetAnswered = makeQuizWord("w1", "\u4e00", ["\u4e00\u4e2a"]);

    const resolved = resolvePackagedReviewResume({
      progressData: {
        quizQueue: [alreadyGraded, notYetAnswered],
        resumeIndex: 1,
        quizHistory: [
          { wordId: "gone", hanzi: "\u4e09", tier: "easy", correctCount: 1, totalCount: 1 },
        ],
        quizSelectionMode: "all",
        quizSessionStartTime: 1000,
      },
      currentWords,
      allFlashcardContents,
      // "gone" is not a current quiz-ready target, but it's before
      // resumeIndex so it must never be re-validated or replayed.
      quizWordIds: new Set(["w1"]),
      vocabPhraseIds: new Set(),
    });

    expect(resolved.status).toBe("ready");
    if (resolved.status === "ready") {
      expect(resolved.quizQueue.map((word) => word.id)).toEqual(["w1"]);
      expect(resolved.quizHistory).toHaveLength(1);
    }
  });
});

describe("buildDueReviewAutosavePayload", () => {
  const quizQueue = [
    makeQuizWord("w1", "\u4e00", ["\u4e00\u4e2a"]),
    makeQuizWord("w2", "\u4e8c", ["\u4e8c\u6708"]),
  ];

  it("saves resumeIndex as quizIndex + 1, the NEXT unanswered word", () => {
    const payload = buildDueReviewAutosavePayload({
      quizQueue,
      quizIndex: 0,
      quizHistory: [{ wordId: "w1", hanzi: "\u4e00", tier: "easy", correctCount: 1, totalCount: 1 }],
      quizSelectionMode: "all",
      quizSessionStartTime: 500,
    });

    expect(payload?.resumeIndex).toBe(1);
    expect(payload?.resumeIndex).not.toBe(0);
  });

  it("returns null when the just-graded word was the last item (avoids a useless row)", () => {
    const payload = buildDueReviewAutosavePayload({
      quizQueue,
      quizIndex: 1,
      quizHistory: [],
      quizSelectionMode: "all",
      quizSessionStartTime: 500,
    });

    expect(payload).toBeNull();
  });
});

describe("due.pausedSessions string parity", () => {
  it("keeps identical EN/ZH key sets", () => {
    expect(Object.keys(wordsStrings.en.due.pausedSessions).sort()).toEqual(
      Object.keys(wordsStrings.zh.due.pausedSessions).sort()
    );
  });

  it("keeps the {time} and {count} interpolation placeholders in both locales", () => {
    expect(wordsStrings.en.due.pausedSessions.lastSaved).toContain("{time}");
    expect(wordsStrings.zh.due.pausedSessions.lastSaved).toContain("{time}");
    expect(wordsStrings.en.due.pausedSessions.remaining).toContain("{count}");
    expect(wordsStrings.zh.due.pausedSessions.remaining).toContain("{count}");
  });
});

describe("getPausedSessionRemainingCount", () => {
  it("subtracts resumeIndex from the full saved queue length", () => {
    // 3 items saved, 2 already graded before the session was paused --
    // only 1 is actually left to answer.
    const progressData = { quizQueue: [{}, {}, {}], resumeIndex: 2 };
    expect(getPausedSessionRemainingCount(progressData)).toBe(1);
  });

  it("returns the full queue length when resumeIndex is 0 (nothing graded yet)", () => {
    const progressData = { quizQueue: [{}, {}], resumeIndex: 0 };
    expect(getPausedSessionRemainingCount(progressData)).toBe(2);
  });

  it("treats a missing/invalid resumeIndex as 0", () => {
    const progressData = { quizQueue: [{}, {}] };
    expect(getPausedSessionRemainingCount(progressData)).toBe(2);
  });

  it("returns 0 for malformed progressData", () => {
    expect(getPausedSessionRemainingCount(null)).toBe(0);
    expect(getPausedSessionRemainingCount({})).toBe(0);
    expect(getPausedSessionRemainingCount({ quizQueue: "not-an-array" })).toBe(0);
  });

  it("returns 0 for a paragraph-quiz-shaped progressData (no quizQueue at all -- see getPausedParagraphQuizRemainingBlankCount)", () => {
    const paragraphQuizProgressData = {
      testModeId: "tm-1",
      currentPageIndex: 0,
      sessionStartTime: 0,
      blankState: { "s0-0-1": { status: "correct", retryCount: 0 } },
    };
    expect(getPausedSessionRemainingCount(paragraphQuizProgressData)).toBe(0);
  });
});

describe("getPausedParagraphQuizRemainingBlankCount", () => {
  it("subtracts the correct-status blank count from the total", () => {
    const progressData = {
      testModeId: "tm-1",
      currentPageIndex: 0,
      sessionStartTime: 0,
      blankState: {
        "s0-0-1": { status: "correct", retryCount: 0 },
        "s0-2-3": { status: "unfilled", retryCount: 1 },
      },
    };
    // 5 total blanks, 1 answered correctly so far -- 4 remain.
    expect(getPausedParagraphQuizRemainingBlankCount(progressData, 5)).toBe(4);
  });

  it("returns the full total when blankState is empty (nothing attempted yet)", () => {
    const progressData = { testModeId: "tm-1", currentPageIndex: 0, sessionStartTime: null, blankState: {} };
    expect(getPausedParagraphQuizRemainingBlankCount(progressData, 3)).toBe(3);
  });

  it("returns 0 (not negative) when every blank is already correct", () => {
    const progressData = {
      testModeId: "tm-1",
      currentPageIndex: 1,
      sessionStartTime: 0,
      blankState: {
        "s0-0-1": { status: "correct", retryCount: 0 },
        "s0-2-3": { status: "correct", retryCount: 2 },
      },
    };
    expect(getPausedParagraphQuizRemainingBlankCount(progressData, 2)).toBe(0);
  });

  it("returns 0 for progressData that isn't paragraph-quiz-shaped (e.g. the ordinary quizQueue shape)", () => {
    expect(getPausedParagraphQuizRemainingBlankCount({ quizQueue: [{}, {}], resumeIndex: 0 }, 5)).toBe(0);
    expect(getPausedParagraphQuizRemainingBlankCount(null, 5)).toBe(0);
    expect(getPausedParagraphQuizRemainingBlankCount({}, 5)).toBe(0);
  });
});

describe("resolveParagraphQuizResume", () => {
  const PAGES: ParagraphQuizPage[] = [
    {
      pageIndex: 0,
      sentences: [{ index: 0, text: "你好。", blankSpanIds: ["s0-0", "s0-1"] }],
      bankSpanIds: ["s0-0", "s0-1"],
    },
    {
      pageIndex: 1,
      sentences: [{ index: 1, text: "再见。", blankSpanIds: ["s1-0"] }],
      bankSpanIds: ["s1-0"],
    },
  ];

  it("returns invalid for a malformed payload", () => {
    expect(
      resolveParagraphQuizResume({ progressData: { not: "shaped right" }, testModeId: "tm1", pages: PAGES })
    ).toEqual({ status: "invalid" });
    expect(resolveParagraphQuizResume({ progressData: null, testModeId: "tm1", pages: PAGES })).toEqual({
      status: "invalid",
    });
  });

  it("returns invalid when wrongDragCounts is present but malformed (non-number value)", () => {
    const progressData = {
      testModeId: "tm1",
      currentPageIndex: 0,
      blankState: {},
      wrongDragCounts: { "s0-0": "three" },
      sessionStartTime: null,
    };
    expect(resolveParagraphQuizResume({ progressData, testModeId: "tm1", pages: PAGES })).toEqual({
      status: "invalid",
    });
  });

  it("returns invalid when the saved testModeId doesn't match the session being resumed", () => {
    const progressData = {
      testModeId: "different-test-mode",
      currentPageIndex: 0,
      blankState: {},
      sessionStartTime: null,
    };
    expect(resolveParagraphQuizResume({ progressData, testModeId: "tm1", pages: PAGES })).toEqual({
      status: "invalid",
    });
  });

  it("resumes on the saved page when it still has an unfilled blank", () => {
    const progressData = {
      testModeId: "tm1",
      currentPageIndex: 0,
      blankState: { "s0-0": { status: "correct", retryCount: 0 } },
      sessionStartTime: 1000,
    };
    const resolved = resolveParagraphQuizResume({ progressData, testModeId: "tm1", pages: PAGES });
    expect(resolved).toEqual({
      status: "ready",
      currentPageIndex: 0,
      blankState: { "s0-0": { status: "correct", retryCount: 0 } },
      wrongDragCounts: {},
      sessionStartTime: 1000,
    });
  });

  it("advances to the next page with remaining work when the saved page is now fully correct", () => {
    const progressData = {
      testModeId: "tm1",
      currentPageIndex: 0,
      blankState: {
        "s0-0": { status: "correct", retryCount: 0 },
        "s0-1": { status: "correct", retryCount: 1 },
      },
      sessionStartTime: null,
    };
    const resolved = resolveParagraphQuizResume({ progressData, testModeId: "tm1", pages: PAGES });
    expect(resolved.status).toBe("ready");
    expect(resolved.status === "ready" && resolved.currentPageIndex).toBe(1);
  });

  it("silently drops a saved blank id that no longer resolves in the current pages (deleted span)", () => {
    const progressData = {
      testModeId: "tm1",
      currentPageIndex: 0,
      blankState: { "s0-0": { status: "correct", retryCount: 0 }, "ghost-span": { status: "correct", retryCount: 0 } },
      sessionStartTime: null,
    };
    const resolved = resolveParagraphQuizResume({ progressData, testModeId: "tm1", pages: PAGES });
    expect(resolved.status).toBe("ready");
    expect(resolved.status === "ready" && resolved.blankState).toEqual({
      "s0-0": { status: "correct", retryCount: 0 },
    });
  });

  it("returns empty when every blank across every page is already correct", () => {
    const progressData = {
      testModeId: "tm1",
      currentPageIndex: 0,
      blankState: {
        "s0-0": { status: "correct", retryCount: 0 },
        "s0-1": { status: "correct", retryCount: 0 },
        "s1-0": { status: "correct", retryCount: 0 },
      },
      sessionStartTime: null,
    };
    expect(resolveParagraphQuizResume({ progressData, testModeId: "tm1", pages: PAGES })).toEqual({
      status: "empty",
    });
  });

  it("still resumes ready when the only saved blank state was for a since-deleted span, since the page's other blanks default to unfilled", () => {
    const singlePage: ParagraphQuizPage[] = [
      { pageIndex: 0, sentences: [{ index: 0, text: "你好。", blankSpanIds: ["s0-0"] }], bankSpanIds: ["s0-0"] },
    ];
    const progressData = {
      testModeId: "tm1",
      currentPageIndex: 0,
      blankState: { "deleted-span": { status: "unfilled", retryCount: 0 } },
      sessionStartTime: null,
    };
    expect(resolveParagraphQuizResume({ progressData, testModeId: "tm1", pages: singlePage })).toEqual({
      status: "ready",
      currentPageIndex: 0,
      blankState: {},
      wrongDragCounts: {},
      sessionStartTime: null,
    });
  });

  it("carries wrongDragCounts through for still-valid span ids and drops stale ones (fix 2, feature spec 2026-08-22)", () => {
    const progressData = {
      testModeId: "tm1",
      currentPageIndex: 0,
      blankState: {},
      wrongDragCounts: { "s0-0": 3, "s0-1": 1, "ghost-span": 5 },
      sessionStartTime: null,
    };
    const resolved = resolveParagraphQuizResume({ progressData, testModeId: "tm1", pages: PAGES });
    expect(resolved.status).toBe("ready");
    expect(resolved.status === "ready" && resolved.wrongDragCounts).toEqual({ "s0-0": 3, "s0-1": 1 });
  });

  it("defaults wrongDragCounts to {} when resuming a progress row saved before this field existed", () => {
    const progressData = {
      testModeId: "tm1",
      currentPageIndex: 0,
      blankState: { "s0-0": { status: "correct", retryCount: 0 } },
      sessionStartTime: null,
    };
    const resolved = resolveParagraphQuizResume({ progressData, testModeId: "tm1", pages: PAGES });
    expect(resolved.status).toBe("ready");
    expect(resolved.status === "ready" && resolved.wrongDragCounts).toEqual({});
  });
});

describe("filterPausedSessionsForViewer", () => {
  function makeProgressRow(
    userId: string,
    clientSessionKey: string,
    sourceType: ReviewSessionProgress["sourceType"] = "due_review"
  ): ReviewSessionProgress {
    return {
      id: clientSessionKey,
      userId,
      clientSessionKey,
      sourceType,
      packagedSessionId: sourceType === "packaged" ? clientSessionKey : null,
      progressData: {},
      startedAt: 0,
      lastSavedAt: 0,
    };
  }

  it("returns the full family list unfiltered for a read-only (parent) viewer", () => {
    const rows = [makeProgressRow("child-a", "key-a"), makeProgressRow("child-b", "key-b")];

    const result = filterPausedSessionsForViewer(rows, "parent-user", false);

    expect(result).toHaveLength(2);
  });

  it("restricts an actionable (child/admin) viewer to only their own rows", () => {
    const rows = [makeProgressRow("child-a", "key-a"), makeProgressRow("child-b", "key-b")];

    const result = filterPausedSessionsForViewer(rows, "child-a", true);

    expect(result).toEqual([makeProgressRow("child-a", "key-a")]);
  });

  it("filters by owning user regardless of source type -- packaged and due-review rows are treated identically", () => {
    const rows = [
      makeProgressRow("child-a", "due-key", "due_review"),
      makeProgressRow("child-a", "packaged-key", "packaged"),
      makeProgressRow("child-b", "sibling-key", "packaged"),
    ];

    const result = filterPausedSessionsForViewer(rows, "child-a", true);

    expect(result.map((row) => row.clientSessionKey).sort()).toEqual(["due-key", "packaged-key"]);
  });
});

describe("selectLowestFamiliarityWords", () => {
  const NOW = 1_700_000_000_000;

  function makeWord(overrides: Partial<Word> = {}): Word {
    return {
      id: "word-1",
      hanzi: "错",
      createdAt: 1,
      repetitions: 5,
      intervalDays: 1,
      ease: 1,
      nextReviewAt: NOW,
      reviewCount: 0,
      testCount: 0,
      ...overrides,
    };
  }

  it("orders words by ascending familiarity, weakest first", () => {
    const strong = makeWord({ id: "strong", ease: 10, createdAt: 1 });
    const medium = makeWord({ id: "medium", ease: 1, createdAt: 2 });
    const weak = makeWord({ id: "weak", ease: 0.5, createdAt: 3 });

    const result = selectLowestFamiliarityWords([strong, medium, weak], 3, NOW);

    expect(result.map((word) => word.id)).toEqual(["weak", "medium", "strong"]);
  });

  it("caps the result at the requested count", () => {
    const strong = makeWord({ id: "strong", ease: 10 });
    const medium = makeWord({ id: "medium", ease: 1 });
    const weak = makeWord({ id: "weak", ease: 0.5 });

    const result = selectLowestFamiliarityWords([strong, medium, weak], 2, NOW);

    expect(result.map((word) => word.id)).toEqual(["weak", "medium"]);
  });

  it("breaks a familiarity tie by createdAt ascending", () => {
    // Both words are unreviewed (repetitions=0), which getMemorizationProbability
    // treats as a flat 0.25 -- so this exercises the tie-break path only.
    const later = makeWord({ id: "later", repetitions: 0, nextReviewAt: 0, createdAt: 200 });
    const earlier = makeWord({ id: "earlier", repetitions: 0, nextReviewAt: 0, createdAt: 100 });

    const result = selectLowestFamiliarityWords([later, earlier], 2, NOW);

    expect(result.map((word) => word.id)).toEqual(["earlier", "later"]);
  });

  it("returns the whole pool, ranked, when count exceeds its size", () => {
    const strong = makeWord({ id: "strong", ease: 10 });
    const weak = makeWord({ id: "weak", ease: 0.5 });

    const result = selectLowestFamiliarityWords([strong, weak], 25, NOW);

    expect(result.map((word) => word.id)).toEqual(["weak", "strong"]);
  });
});

describe("resolveQuizCompletionNotice", () => {
  const completedNoticeTemplate = "Completed session {name}!";
  const adHocNoticeMessage = "Quiz complete!";

  it("returns null instead of a success message when review test session completion failed", () => {
    // Regression test: moveQuizForward used to call setQuizNotice
    // unconditionally after this decision, clobbering the real error notice
    // set by the completeReviewTestSession catch block with a false
    // "completed" message -- see
    // build-fix-log-2026-07-30-packaged-session-limbo.md.
    const result = resolveQuizCompletionNotice({
      reviewTestSessionCompletionFailed: true,
      completedReviewTestSessionName: "2.3.543",
      completedNoticeTemplate,
      adHocNoticeMessage,
    });

    expect(result).toBeNull();
  });

  it("returns the packaged-session completed message, with the name interpolated, on success", () => {
    const result = resolveQuizCompletionNotice({
      reviewTestSessionCompletionFailed: false,
      completedReviewTestSessionName: "2.3.543",
      completedNoticeTemplate,
      adHocNoticeMessage,
    });

    expect(result).toBe("Completed session 2.3.543!");
  });

  it("returns the ad-hoc completion message when there is no review test session", () => {
    const result = resolveQuizCompletionNotice({
      reviewTestSessionCompletionFailed: false,
      completedReviewTestSessionName: null,
      completedNoticeTemplate,
      adHocNoticeMessage,
    });

    expect(result).toBe(adHocNoticeMessage);
  });
});
