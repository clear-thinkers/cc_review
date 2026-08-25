import type { FlashcardContentEntry } from "@/lib/supabase-service";
import type { VocabPhrase, Word } from "@/lib/types";
import type { Paragraph } from "@/lib/paragraph.types";
import type { ParagraphTestMode } from "@/lib/paragraphTestMode.types";
import { buildParagraphQuizPages } from "@/lib/paragraphQuizBuilder";
import type {
  ReviewTestSession,
  ReviewTestSessionRuntime,
  ReviewTestSessionTargetDraft,
} from "./review.types";
import { buildFillTestFromSavedContent, getMemorizationProbability } from "../shared/words.shared.utils";

/** The 5 non-paragraphQuiz fields every early-return branch shares, empty/zeroed. */
function emptyRuntimeFields(): Pick<
  ReviewTestSessionRuntime,
  "orderedWords" | "quizWords" | "vocabPhrases" | "packagedPronunciationsByCharacter" | "skippedQuizCharacters"
> {
  return {
    orderedWords: [],
    quizWords: [],
    vocabPhrases: [],
    packagedPronunciationsByCharacter: {},
    skippedQuizCharacters: [],
  };
}

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
  allFlashcardContents: FlashcardContentEntry[],
  vocabPhrases: VocabPhrase[] = [],
  paragraphs: Paragraph[] = [],
  paragraphTestModes: ParagraphTestMode[] = []
): ReviewTestSessionRuntime {
  const orderedTargets = [...session.targets].sort(
    (left, right) => left.displayOrder - right.displayOrder
  );

  // A paragraph-quiz session is discriminated at the SESSION level (never
  // mixed with ordinary character/phrase targets), so it's resolved via a
  // third branch here, parallel to (not interleaved with) the
  // character/phrase resolution below.
  if (session.paragraphTestModeId) {
    const testMode = paragraphTestModes.find((mode) => mode.id === session.paragraphTestModeId);
    if (!testMode) {
      return {
        ...emptyRuntimeFields(),
        errorCode: "missing_paragraph_test_mode",
        errorCharacter: null,
        paragraphQuiz: null,
      };
    }

    const paragraph = paragraphs.find((candidate) => candidate.id === testMode.paragraphId);
    if (!paragraph) {
      return {
        ...emptyRuntimeFields(),
        errorCode: "missing_paragraph",
        errorCharacter: null,
        paragraphQuiz: null,
      };
    }

    // The packaged snapshot, not the test mode's current spanIds — editing
    // a test mode after packaging never retroactively changes an
    // already-packaged session (see feature spec, Out of Scope).
    const blankSpanIds = orderedTargets
      .map((target) => target.paragraphSpanId)
      .filter((id): id is string => Boolean(id));

    return {
      ...emptyRuntimeFields(),
      errorCode: null,
      errorCharacter: null,
      paragraphQuiz: { paragraph, testMode, pages: buildParagraphQuizPages(paragraph, blankSpanIds) },
    };
  }

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

  // Vocab-phrase targets are resolved separately from character targets —
  // a phrase target maps 1:1 to a vocab_phrases row via vocabPhraseId, so
  // there is no "group by character, then multiple pronunciations" step
  // for them the way there is for characters.
  const characterTargets = orderedTargets.filter((target) => !target.vocabPhraseId);
  const phraseTargets = orderedTargets.filter((target) => target.vocabPhraseId);
  const vocabPhrasesById = new Map(vocabPhrases.map((phrase) => [phrase.id, phrase]));
  const resolvedVocabPhrases: VocabPhrase[] = [];

  for (const target of phraseTargets) {
    const phrase = target.vocabPhraseId ? vocabPhrasesById.get(target.vocabPhraseId) : undefined;
    if (!phrase) {
      return {
        ...emptyRuntimeFields(),
        errorCode: "missing_vocab_phrase",
        errorCharacter: target.character,
        paragraphQuiz: null,
      };
    }
    resolvedVocabPhrases.push(phrase);
  }

  for (const target of characterTargets) {
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
        ...emptyRuntimeFields(),
        errorCode: "missing_word",
        errorCharacter: character,
        paragraphQuiz: null,
      };
    }

    if (matchingWords.length > 1) {
      return {
        ...emptyRuntimeFields(),
        errorCode: "duplicate_word",
        errorCharacter: character,
        paragraphQuiz: null,
      };
    }

    packagedPronunciationsByCharacter[character] = targets.map((target) => target.pronunciation);

    const word = matchingWords[0];
    if (!word) {
      continue;
    }

    orderedWords.push(word);

    // Look up by plain character|pronunciation, NOT target.key -- target.key
    // now carries a trailing |paragraphSpanId segment (added for paragraph-
    // quiz blank dedup), but flashcard_contents rows (and contentByKey,
    // built from getAllFlashcardContents()) are keyed by character|pronunciation
    // only. A character target's paragraphSpanId is always empty, so
    // target.key would never match and every character silently read as
    // not-quiz-ready.
    const fillTestContentEntries = targets
      .map((target) => contentByKey.get(`${target.character}|${target.pronunciation}`))
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
    vocabPhrases: resolvedVocabPhrases,
    packagedPronunciationsByCharacter,
    skippedQuizCharacters,
    errorCode: null,
    errorCharacter: null,
    paragraphQuiz: null,
  };
}

/**
 * Ingredient-reward panel headline, shared by every packaged-session
 * completion flow (fill-test and paragraph-quiz alike) -- singular/plural
 * English needs picking a different string, not just interpolating a count
 * into one template.
 */
export function buildRewardHeadline(
  count: number,
  strings: { headlineSingular: string; headlinePlural: string }
): string {
  return count === 1 ? strings.headlineSingular : strings.headlinePlural.replace("{count}", String(count));
}
