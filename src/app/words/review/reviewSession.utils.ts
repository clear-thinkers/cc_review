import type { FlashcardContentEntry } from "@/lib/supabase-service";
import type { Word } from "@/lib/types";
import type {
  ReviewTestSession,
  ReviewTestSessionRuntime,
  ReviewTestSessionTargetDraft,
} from "./review.types";
import { buildFillTestFromSavedContent, getMemorizationProbability } from "../shared/words.shared.utils";

export function sortReviewTestSessionTargets(
  targets: ReviewTestSessionTargetDraft[],
  words: Word[],
  now = Date.now()
): ReviewTestSessionTargetDraft[] {
  const familiarityByCharacter = new Map<string, number>();

  for (const word of words) {
    familiarityByCharacter.set(word.hanzi, getMemorizationProbability(word, now));
  }

  return [...targets].sort((left, right) => {
    const leftFamiliarity = familiarityByCharacter.get(left.character) ?? Number.POSITIVE_INFINITY;
    const rightFamiliarity = familiarityByCharacter.get(right.character) ?? Number.POSITIVE_INFINITY;
    if (leftFamiliarity !== rightFamiliarity) {
      return leftFamiliarity - rightFamiliarity;
    }

    const characterComparison = left.character.localeCompare(right.character, "zh-Hans-CN");
    if (characterComparison !== 0) {
      return characterComparison;
    }

    return left.pronunciation.localeCompare(right.pronunciation, "zh-Hans-CN");
  });
}

export function buildReviewTestSessionRuntime(
  session: ReviewTestSession,
  words: Word[],
  allFlashcardContents: FlashcardContentEntry[]
): ReviewTestSessionRuntime {
  const wordsByCharacter = new Map<string, Word[]>();
  const contentByKey = new Map<string, FlashcardContentEntry>();
  const groupedTargets = new Map<string, ReviewTestSession["targets"]>();
  const packagedPronunciationsByCharacter: Record<string, string[]> = {};
  const skippedQuizCharacters: string[] = [];

  for (const word of words) {
    const list = wordsByCharacter.get(word.hanzi) ?? [];
    list.push(word);
    wordsByCharacter.set(word.hanzi, list);
  }

  for (const entry of allFlashcardContents) {
    contentByKey.set(entry.key, entry);
  }

  const orderedTargets = [...session.targets].sort(
    (left, right) => left.displayOrder - right.displayOrder
  );

  for (const target of orderedTargets) {
    const list = groupedTargets.get(target.character) ?? [];
    list.push(target);
    groupedTargets.set(target.character, list);
  }

  const orderedWords: Word[] = [];
  const quizWords: ReviewTestSessionRuntime["quizWords"] = [];

  for (const [character, targets] of groupedTargets.entries()) {
    const matchingWords = wordsByCharacter.get(character) ?? [];
    if (matchingWords.length === 0) {
      return {
        orderedWords: [],
        quizWords: [],
        packagedPronunciationsByCharacter: {},
        skippedQuizCharacters: [],
        errorCode: "missing_word",
        errorCharacter: character,
      };
    }

    if (matchingWords.length > 1) {
      return {
        orderedWords: [],
        quizWords: [],
        packagedPronunciationsByCharacter: {},
        skippedQuizCharacters: [],
        errorCode: "duplicate_word",
        errorCharacter: character,
      };
    }

    packagedPronunciationsByCharacter[character] = targets.map((target) => target.pronunciation);

    const word = matchingWords[0];
    if (!word) {
      continue;
    }

    orderedWords.push(word);

    const fillTestContentEntries = targets
      .map((target) => contentByKey.get(target.key))
      .filter((entry): entry is FlashcardContentEntry => Boolean(entry));
    const fillTest = buildFillTestFromSavedContent(
      fillTestContentEntries.map((entry) => entry.content)
    );

    if (!fillTest) {
      skippedQuizCharacters.push(character);
      continue;
    }

    quizWords.push({
      ...word,
      fillTest,
    });
  }

  return {
    orderedWords,
    quizWords,
    packagedPronunciationsByCharacter,
    skippedQuizCharacters,
    errorCode: null,
    errorCharacter: null,
  };
}
