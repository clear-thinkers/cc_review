import type { ReactNode } from "react";
import {
  normalizeFlashcardLlmResponse,
  type FlashcardLlmRequest,
  type FlashcardMeaning,
  type FlashcardLlmResponse,
  type FlashcardMeaningPhrase,
} from "@/lib/flashcardLlm";
import type { FillTest, VocabPhrase, Word } from "@/lib/types";
import type {
  FlashcardExampleGenerationResponse,
  FlashcardExamplePinyinGenerationResponse,
  FlashcardMeaningDetailGenerationResponse,
  FlashcardPhraseDetailGenerationResponse,
  FlashcardPhraseGenerationResponse,
} from "../admin/admin.types";
import type {
  DueReviewProgressData,
  FillTestCandidateRow,
  QuizHistoryItem,
  QuizSelectionMode,
  TestableVocabPhrase,
  TestableWord,
} from "../review/fill-test/fillTest.types";
import type { NavItem } from "./shell.types";
import type { WordsLocaleStrings } from "./words.shared.types";
import { canAccessRoute } from "@/lib/permissions";
import type { UserRole } from "@/lib/auth.types";
import type { FlashcardContentEntry } from "@/lib/supabase-service";
import type { ReviewSessionProgress } from "@/lib/reviewSessionProgress.types";
import type { ParagraphQuizPage } from "@/lib/paragraphQuizBuilder";
import type { ParagraphQuizBlankProgress, ParagraphQuizProgressData } from "../review/paragraph-quiz/paragraphQuiz.types";

export const SLOT_INDICES: Array<0 | 1 | 2> = [0, 1, 2];
export const QUIZ_SELECTION_MODES = ["all", "10", "20", "30", "manual"] as const;
export const QUIZ_PHRASE_DRAG_MIME = "text/x-cc-review-phrase-index";

const DAY_MS = 24 * 60 * 60 * 1000;
const HANZI_CHAR_REGEX = /\p{Script=Han}/u;

// GUARDRAIL: Pinyin syllable regex must handle diphthongs and final consonants correctly.
// Requirements:
// 1. Match tone-marked vowels: à á ǎ ā è é ě ē ... (for proper tone rendering)
// 2. Match vowel clusters (diphthongs/triphthongs): ao, ou, ai, ei, ia, ie, ua, uo, üe, etc.
// 3. Match final consonants: ng (guang), r (er), n (ren), m (rare) — but avoid over-matching
// 4. Handle compact pinyin: xiǎogǒu should split to ["xiǎo", "gǒu"], not ["xiǎog", "ǒu"]
//
// Pattern: [consonants][vowel-cluster][ending][tone]
// Final consonant handling:
//   - "ng" and "r" are always endings (never start new syllables in Mandarin)
//   - "n" is ending only if NOT followed by a vowel (since nǐ, nǚ, etc. are separate syllables)
//   - "m" is included but rare
// Uppercase consonants: [a-zA-Z]* handles both lowercase and uppercase-starting pinyin (e.g., Xiáo, QING3)
const PINYIN_SYLLABLE_RE = /[a-zA-Z]*[àáǎāèéěēìíǐīòóǒōùúǔūǜǚǖǘvüaeiou]+(?:ng|r|m|n(?![àáǎāèéěēìíǐīòóǒōùúǔūǜǚǖǘvüaeiou]))?[1-5]?/gu;
const PINYIN_TONE_MAP: Record<string, string> = {
  "\u0101": "a1",
  "\u00E1": "a2",
  "\u01CE": "a3",
  "\u00E0": "a4",
  "\u0113": "e1",
  "\u00E9": "e2",
  "\u011B": "e3",
  "\u00E8": "e4",
  "\u012B": "i1",
  "\u00ED": "i2",
  "\u01D0": "i3",
  "\u00EC": "i4",
  "\u014D": "o1",
  "\u00F3": "o2",
  "\u01D2": "o3",
  "\u00F2": "o4",
  "\u016B": "u1",
  "\u00FA": "u2",
  "\u01D4": "u3",
  "\u00F9": "u4",
  "\u01D6": "v1",
  "\u01D8": "v2",
  "\u01DA": "v3",
  "\u01DC": "v4",
  "\u00FC": "v",
  "\u00DC": "V",
};

export function getNavItems(
  str: WordsLocaleStrings,
  role: UserRole | undefined,
  isPlatformAdmin: boolean
): NavItem[] {
  const allItems: NavItem[] = [
    { href: "/words", label: `${str.nav.appFlow}`, page: "home" },
    { href: "/words/add", label: `${str.nav.addCharacters}`, page: "add" },
    { href: "/words/all", label: `${str.nav.allCharacters}`, page: "all" },
    { href: "/words/admin", label: `${str.nav.contentAdmin}`, page: "admin" },
    { href: "/words/add-paragraph", label: `${str.nav.addParagraph}`, page: "addParagraph" },
    { href: "/words/review", label: `${str.nav.dueReview}`, page: "review" },
    { href: "/words/results", label: `${str.nav.quizResults}`, page: "results" },
    { href: "/words/prompts", label: `${str.nav.aiPrompts}`, page: "prompts" },
    { href: "/words/debug", label: `${str.nav.debug}`, page: "debug" },
    { href: "/words/shop", label: `${str.nav.shop}`, page: "shop" },
    { href: "/words/shop-admin", label: `${str.nav.shopAdmin}`, page: "shopAdmin" },
  ];

  return allItems.filter(item => 
    canAccessRoute(item.href, role, isPlatformAdmin)
  );
}

export function getGradeLabels(str: WordsLocaleStrings) {
  return {
    again: str.grades.again,
    hard: str.grades.hard,
    good: str.grades.good,
    easy: str.grades.easy,
  } as const;
}

export function cloneFillTest(fillTest: FillTest): FillTest {
  return {
    phrases: [...fillTest.phrases],
    sentences: fillTest.sentences.map((sentence) => ({ ...sentence })),
    ...(fillTest.members ? { members: fillTest.members.map((member) => ({ ...member })) } : {}),
    ...(fillTest.vocabPhraseMembers
      ? { vocabPhraseMembers: fillTest.vocabPhraseMembers.map((member) => ({ ...member })) }
      : {}),
  };
}

export function cloneWord(word: Word): Word {
  return {
    ...word,
    fillTest: word.fillTest ? cloneFillTest(word.fillTest) : undefined,
  };
}

export function cloneFlashcardLlmResponse(content: FlashcardLlmResponse): FlashcardLlmResponse {
  return {
    ...content,
    meanings: content.meanings.map((meaning) => ({
      ...meaning,
      phrases: meaning.phrases.map((phrase) => ({ ...phrase })),
    })),
  };
}

export function applyAdminMeaningEdit(params: {
  content: FlashcardLlmResponse;
  currentMeaningZh: string;
  currentMeaningEn: string;
  nextMeaningZh: string;
  nextMeaningEn: string;
}): FlashcardLlmResponse {
  const nextMeaningZh = params.nextMeaningZh.trim();
  const nextMeaningEn = params.nextMeaningEn.trim();
  if (!nextMeaningZh) {
    throw new Error("Meaning is required.");
  }

  const nextDraft = cloneFlashcardLlmResponse(params.content);
  const currentMeaningIndex = nextDraft.meanings.findIndex(
    (meaning) =>
      meaning.definition.trim() === params.currentMeaningZh.trim() &&
      (meaning.definition_en ?? "").trim() === params.currentMeaningEn.trim()
  );
  if (currentMeaningIndex < 0) {
    throw new Error("Meaning row not found in current draft.");
  }

  const currentMeaning = nextDraft.meanings[currentMeaningIndex];
  currentMeaning.definition = nextMeaningZh;
  if (nextMeaningEn) {
    currentMeaning.definition_en = nextMeaningEn;
  } else {
    delete currentMeaning.definition_en;
  }

  const mergeMeaningIndex = nextDraft.meanings.findIndex(
    (meaning, index) => index !== currentMeaningIndex && meaning.definition.trim() === nextMeaningZh
  );
  if (mergeMeaningIndex >= 0) {
    const mergeMeaningSource = nextDraft.meanings[mergeMeaningIndex];
    const mergedMeaning: FlashcardMeaning = {
      definition: nextMeaningZh,
      ...(nextMeaningEn ? { definition_en: nextMeaningEn } : {}),
      phrases: [
        ...mergeMeaningSource.phrases,
        ...currentMeaning.phrases,
      ],
    };

    const mergedPosition = Math.min(currentMeaningIndex, mergeMeaningIndex);
    const mergedMeanings = nextDraft.meanings.filter(
      (_, index) => index !== currentMeaningIndex && index !== mergeMeaningIndex
    );
    mergedMeanings.splice(mergedPosition, 0, mergedMeaning);
    nextDraft.meanings = mergedMeanings;
  }

  return normalizeAdminDraftResponse(nextDraft, {
    character: params.content.character,
    pronunciation: params.content.pronunciation,
  });
}

export function hasFillTest(word: Word): word is TestableWord {
  return Boolean(word.fillTest);
}

export function formatDateTime(timestamp: number): string {
  if (!timestamp) {
    return "Now";
  }

  return new Date(timestamp).toLocaleString();
}

export function getFamiliarity(word: Word): string {
  if (word.repetitions >= 10) {
    return "Strong";
  }

  if (word.repetitions >= 5) {
    return "Familiar";
  }

  if (word.repetitions >= 2) {
    return "Learning";
  }

  return "New";
}

export function getReviewCount(word: Word): number {
  return word.reviewCount ?? word.repetitions ?? 0;
}

export function getTestCount(word: Word): number {
  return word.testCount ?? 0;
}

export function getMemorizationProbability(word: Word, now = Date.now()): number {
  if (!word.repetitions || !word.nextReviewAt) {
    return 0.25;
  }

  const stabilityDays = Math.max(0.5, word.ease || 0.5);
  const intervalDays = Math.max(1, word.intervalDays || 1);

  // Calculate retention probability as of EOD today (current moment).
  // This metric refreshes continuously and shows natural memory decay over time using the forgetting curve.
  //
  // Example progression for a word graded "hard" on day 0:
  //   - Day 0 (just reviewed): 99% retention
  //   - Day 1: ~95% retention (some decay from stability)
  //   - Day 2 (scheduled review): ~91% retention (scheduler's target)
  //   - Day 3 (if missed): ~87% retention
  //   - Day 5 (if really missed): ~78% retention
  //
  // This provides meaningful variation users can act on:
  // - Words approaching their due date show declining retention
  // - Words past due show significant drops (visual urgency)
  // - Just-reviewed words start high, giving positive feedback
  //
  // The metric is recalculated on each page load/refresh, so variation emerges naturally
  // as time passes and memory decays according to the forgetting curve.
  const lastReviewAt = word.nextReviewAt - intervalDays * DAY_MS;
  const elapsedDays = Math.max(0, (now - lastReviewAt) / DAY_MS);
  const probability = Math.exp(-elapsedDays / stabilityDays);

  // Clamp to [0.01, 0.99] to keep values in a reasonable display range
  return Math.min(0.99, Math.max(0.01, probability));
}

export function formatProbability(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Ranks `words` by familiarity ascending (weakest first, same metric and
 * createdAt tie-break as the due-review table's familiarity column) and
 * returns the lowest `count`. Used by Due Review's "Quick Add 25" action to
 * auto-select the due characters most in need of review before handing off
 * to the existing selected-characters -> review-test-session flow.
 */
export function selectLowestFamiliarityWords(words: Word[], count: number, now = Date.now()): Word[] {
  return [...words]
    .sort((left, right) => {
      const comparison = getMemorizationProbability(left, now) - getMemorizationProbability(right, now);
      if (comparison !== 0) {
        return comparison;
      }
      return left.createdAt - right.createdAt;
    })
    .slice(0, Math.max(0, count));
}

export function getSelectionModeLabel(mode: QuizSelectionMode, str: WordsLocaleStrings): string {
  if (mode === "all") {
    return str.fillTest.selectionModes.all;
  }

  if (mode === "manual") {
    return str.fillTest.selectionModes.manualSelection;
  }

  return str.fillTest.selectionModes.custom.replace("{count}", mode);
}

export function parseQuizPhraseIndex(raw: string, phraseCount = 3): number | null {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= phraseCount) {
    return null;
  }

  return parsed;
}

export function isHanziCharacter(char: string): boolean {
  return HANZI_CHAR_REGEX.test(char);
}

export function extractUniqueHanzi(input: string): string[] {
  const source = input.trim();
  if (!source) {
    return [];
  }

  const chars = Array.from(source).filter((char) => isHanziCharacter(char));
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const char of chars) {
    if (seen.has(char)) {
      continue;
    }
    seen.add(char);
    unique.push(char);
  }
  return unique;
}

export function matchesCharacterSearchFilter(hanzi: string, searchInput: string): boolean {
  const trimmed = searchInput.trim();
  if (!trimmed) return true;
  const chars = extractUniqueHanzi(trimmed);
  if (chars.length === 0) return true;
  return chars.includes(hanzi);
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function shouldShowManualEditPopup(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("manual") ||
    normalized.includes("duplicate") ||
    normalized.includes("same") ||
    normalized.includes("already exists")
  );
}

export function isFlashcardLlmResponse(value: unknown): value is FlashcardLlmResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  try {
    normalizeFlashcardLlmResponse(value as FlashcardLlmResponse, {
      character: "?",
      pronunciation: "ce4",
    });
    return true;
  } catch {
    return false;
  }
}

export function isFlashcardPhraseGenerationResponse(
  value: unknown
): value is FlashcardPhraseGenerationResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Record<string, unknown>;
  return (
    typeof source.phrase === "string" &&
    typeof source.pinyin === "string" &&
    typeof source.example === "string" &&
    typeof source.example_pinyin === "string"
  );
}

export function isFlashcardExampleGenerationResponse(
  value: unknown
): value is FlashcardExampleGenerationResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Record<string, unknown>;
  return typeof source.example === "string" && typeof source.example_pinyin === "string";
}

export function isFlashcardPhraseDetailGenerationResponse(
  value: unknown
): value is FlashcardPhraseDetailGenerationResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Record<string, unknown>;
  return (
    typeof source.pinyin === "string" &&
    typeof source.example === "string" &&
    typeof source.example_pinyin === "string"
  );
}

export function isFlashcardMeaningDetailGenerationResponse(
  value: unknown
): value is FlashcardMeaningDetailGenerationResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Record<string, unknown>;
  return typeof source.definition_en === "string";
}

export function isFlashcardExamplePinyinGenerationResponse(
  value: unknown
): value is FlashcardExamplePinyinGenerationResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Record<string, unknown>;
  return typeof source.example_pinyin === "string";
}

function normalizePinyinBase(input: string): string {
  let normalized = input;
  Object.entries(PINYIN_TONE_MAP).forEach(([toneChar, replacement]) => {
    normalized = normalized.replaceAll(toneChar, replacement);
  });
  return normalized;
}

function isLikelyPinyinSyllable(syllable: string): boolean {
  const trimmed = syllable.trim();
  if (!trimmed) {
    return false;
  }

  const normalized = normalizePinyinBase(trimmed).toLowerCase();
  return /[a-zv]+[1-5]?$/.test(normalized);
}

function segmentCompactPinyin(compactPinyin: string, syllableCount: number): string[] | null {
  if (syllableCount <= 0) {
    return [];
  }

  const source = normalizePinyinBase(compactPinyin.trim());
  if (!source) {
    return null;
  }

  const results: string[][] = [];
  let visits = 0;
  const MAX_VISITS = 300;

  const dfs = (index: number, parts: string[]) => {
    if (results.length > 4 || visits > MAX_VISITS) {
      return;
    }
    visits += 1;

    if (parts.length > syllableCount) {
      return;
    }

    if (index === source.length) {
      if (parts.length === syllableCount) {
        results.push(parts.slice());
      }
      return;
    }

    const remainingParts = syllableCount - parts.length;
    const remainingChars = source.length - index;
    if (remainingChars < remainingParts) {
      return;
    }

    const maxLen = Math.min(7, remainingChars - (remainingParts - 1));
    for (let len = 1; len <= maxLen; len += 1) {
      if (visits > MAX_VISITS) {
        return;
      }
      const next = source.slice(index, index + len);
      if (!isLikelyPinyinSyllable(next)) {
        continue;
      }

      parts.push(next);
      dfs(index + len, parts);
      parts.pop();
    }
  };

  dfs(0, []);
  return results[0] ?? null;
}

export function tokenizePinyinSyllables(pinyin: string): string[] {
  const normalized = pinyin.trim();
  if (!normalized) {
    return [];
  }

  return normalized.match(PINYIN_SYLLABLE_RE) ?? [];
}

export function alignPinyinPartsForCount(partCount: number, pinyin: string): string[] {
  const normalized = pinyin.trim();
  if (!normalized) {
    return Array(partCount).fill("");
  }

  const tokens = tokenizePinyinSyllables(normalized);
  if (tokens.length === partCount) {
    return tokens;
  }

  if (tokens.length > partCount) {
    return tokens.slice(0, partCount);
  }

  const compact = normalized.replace(/\s+/g, "");
  const segmented = segmentCompactPinyin(compact, partCount);
  if (segmented && segmented.length === partCount) {
    return segmented;
  }

  if (tokens.length > 0 && tokens.length < partCount) {
    return [...tokens, ...Array(partCount - tokens.length).fill(tokens[tokens.length - 1] ?? "")];
  }

  return Array(partCount).fill("");
}

function alignPinyinParts(phrase: string, pinyin: string): string[] {
  return alignPinyinPartsForCount(Array.from(phrase).length, pinyin);
}

export function buildAdminMeaningKey(targetKey: string, meaningZh: string, meaningEn: string): string {
  return `${targetKey}||${meaningZh.trim()}||${meaningEn.trim()}`;
}

export function normalizePhraseCompareKey(input: string): string {
  return input.trim().replace(/\s+/g, "");
}

export function isPhraseIncludedInFillTest(phrase: FlashcardMeaningPhrase): boolean {
  return phrase.include_in_fill_test !== false;
}

/**
 * Looks up a character-phrase's saved pinyin by phrase text, scanning every
 * saved meaning/phrase across all flashcard content -- FillTest.phrases is
 * just string[] (no pinyin travels with the runtime quiz plan), and a
 * bundled round's sentences don't reliably carry a per-sentence characterId
 * (only buildBundledFillTestPlan sets one; the ordinary single-character
 * path from buildFillTestFromSavedContent does not), so text is the one
 * identifier guaranteed present either way. Same equivalence
 * (normalizePhraseCompareKey) buildFillTestFromSavedContent already uses to
 * dedupe candidates, so this matches the same phrase that function would.
 * Used by the fill-test review step's correct-answer reveal.
 */
export function findFlashcardPhrasePinyin(
  phrase: string,
  allFlashcardContents: FlashcardContentEntry[]
): string | undefined {
  const targetKey = normalizePhraseCompareKey(phrase);
  if (!targetKey) {
    return undefined;
  }

  for (const entry of allFlashcardContents) {
    for (const meaning of entry.content.meanings) {
      for (const phraseItem of meaning.phrases) {
        if (normalizePhraseCompareKey(phraseItem.phrase) === targetKey) {
          return phraseItem.pinyin;
        }
      }
    }
  }

  return undefined;
}

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildBlankedSentence(example: string, phrase: string): string {
  return example.replace(new RegExp(escapeRegExp(phrase)), "___");
}

function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function buildFillTestFromSavedContent(contentEntries: FlashcardLlmResponse[]): FillTest | undefined {
  const candidates: FillTestCandidateRow[] = [];
  const seenPhraseKeys = new Set<string>();

  for (const content of contentEntries) {
    for (const meaning of content.meanings) {
      for (const phraseItem of meaning.phrases) {
        if (!isPhraseIncludedInFillTest(phraseItem)) {
          continue;
        }

        const phrase = phraseItem.phrase.trim();
        const example = phraseItem.example.trim();
        if (!phrase || !example || !example.includes(phrase)) {
          continue;
        }

        const phraseKey = normalizePhraseCompareKey(phrase);
        if (!phraseKey || seenPhraseKeys.has(phraseKey)) {
          continue;
        }

        seenPhraseKeys.add(phraseKey);
        candidates.push({ phrase, example });
      }
    }
  }

  if (candidates.length < 3) {
    if (candidates.length === 0) {
      return undefined;
    }
  }

  const sentenceRows = shuffleArray(candidates).slice(0, 3);
  const optionPhrases = shuffleArray(sentenceRows.map((item) => item.phrase));
  const answerIndexByPhrase = new Map<string, number>();
  optionPhrases.forEach((phrase, index) => {
    answerIndexByPhrase.set(phrase, index);
  });

  const sentences = sentenceRows.map((item) => ({
    text: buildBlankedSentence(item.example, item.phrase),
    answerIndex: answerIndexByPhrase.get(item.phrase) ?? 0,
  }));

  return {
    phrases: optionPhrases,
    sentences,
  };
}

type BundledCandidateRow = {
  phrase: string;
  text: string;
  characterId: string;
};

type BundledPlanAttempt = {
  word: TestableWord;
  rows: BundledCandidateRow[];
};

export type BundledFillTestPlan = {
  quizWords: TestableWord[];
  skippedCharacters: string[];
};

function rowsFromTestableWord(word: TestableWord): BundledCandidateRow[] {
  return word.fillTest.sentences.flatMap((sentence) => {
    const phrase = word.fillTest.phrases[sentence.answerIndex]?.trim() ?? "";
    if (!phrase) {
      return [];
    }

    return [{
      phrase,
      text: sentence.text,
      characterId: word.id,
    }];
  });
}

function hasUniquePhrases(rows: BundledCandidateRow[]): boolean {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = normalizePhraseCompareKey(row.phrase);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
  }
  return true;
}

function createBundledQuizWord(words: TestableWord[], rows: BundledCandidateRow[]): TestableWord | null {
  if (rows.length === 0 || !hasUniquePhrases(rows)) {
    return null;
  }

  const optionPhrases = shuffleArray(rows.map((row) => row.phrase));
  const answerIndexByPhrase = new Map<string, number>();
  optionPhrases.forEach((phrase, index) => {
    answerIndexByPhrase.set(phrase, index);
  });

  const baseWord = words[0];
  if (!baseWord) {
    return null;
  }

  const hanzi = words.map((word) => word.hanzi).join("");

  return {
    ...baseWord,
    id: words.map((word) => word.id).join("|"),
    hanzi,
    fillTest: {
      phrases: optionPhrases,
      sentences: rows.map((row) => ({
        text: row.text,
        answerIndex: answerIndexByPhrase.get(row.phrase) ?? 0,
        characterId: row.characterId,
      })),
      members: words.map((word) => ({
        wordId: word.id,
        hanzi: word.hanzi,
        phraseCount: rows.filter((row) => row.characterId === word.id).length,
      })),
    },
  };
}

function restoreSingleQuizWord(word: TestableWord): TestableWord | null {
  const rows = rowsFromTestableWord(word).slice(0, Math.min(3, word.fillTest.sentences.length));
  return createBundledQuizWord([word], rows);
}

function tryCreateBundle(left: BundledPlanAttempt, right: BundledPlanAttempt): TestableWord | null {
  return createBundledQuizWord([left.word, right.word], [...left.rows, ...right.rows]);
}

export function buildBundledFillTestPlan(words: TestableWord[]): BundledFillTestPlan {
  const attempts = words.map((word) => ({
    word,
    rows: rowsFromTestableWord(word),
  }));
  const standardAttempts = attempts.filter((attempt) => attempt.rows.length >= 3);
  const lowAttempts = attempts.filter((attempt) => attempt.rows.length > 0 && attempt.rows.length < 3);
  const usedWordIds = new Set<string>();
  const skippedCharacters: string[] = [];
  const bundledQuizWords: TestableWord[] = [];

  for (const lowAttempt of lowAttempts) {
    let paired = false;
    for (const standardAttempt of standardAttempts) {
      if (usedWordIds.has(standardAttempt.word.id)) {
        continue;
      }

      const bundle = tryCreateBundle(lowAttempt, standardAttempt);
      if (!bundle) {
        continue;
      }

      bundledQuizWords.push(bundle);
      usedWordIds.add(lowAttempt.word.id);
      usedWordIds.add(standardAttempt.word.id);
      paired = true;
      break;
    }

    if (!paired) {
      continue;
    }
  }

  const remainingLow = lowAttempts.filter((attempt) => !usedWordIds.has(attempt.word.id));
  const consumedLowIds = new Set<string>();

  for (let leftIndex = 0; leftIndex < remainingLow.length; leftIndex += 1) {
    const leftAttempt = remainingLow[leftIndex];
    if (!leftAttempt || consumedLowIds.has(leftAttempt.word.id)) {
      continue;
    }

    for (let rightIndex = leftIndex + 1; rightIndex < remainingLow.length; rightIndex += 1) {
      const rightAttempt = remainingLow[rightIndex];
      if (!rightAttempt || consumedLowIds.has(rightAttempt.word.id)) {
        continue;
      }

      if (leftAttempt.rows.length + rightAttempt.rows.length < 3) {
        continue;
      }

      const bundle = tryCreateBundle(leftAttempt, rightAttempt);
      if (!bundle) {
        continue;
      }

      bundledQuizWords.push(bundle);
      consumedLowIds.add(leftAttempt.word.id);
      consumedLowIds.add(rightAttempt.word.id);
      usedWordIds.add(leftAttempt.word.id);
      usedWordIds.add(rightAttempt.word.id);
      break;
    }
  }

  const remainingOnePhrase = remainingLow.filter(
    (attempt) => !consumedLowIds.has(attempt.word.id) && attempt.rows.length === 1
  );

  for (let index = 0; index + 1 < remainingOnePhrase.length; index += 2) {
    const leftAttempt = remainingOnePhrase[index];
    const rightAttempt = remainingOnePhrase[index + 1];
    if (!leftAttempt || !rightAttempt) {
      continue;
    }

    const bundle = tryCreateBundle(leftAttempt, rightAttempt);
    if (bundle) {
      bundledQuizWords.push(bundle);
      consumedLowIds.add(leftAttempt.word.id);
      consumedLowIds.add(rightAttempt.word.id);
      usedWordIds.add(leftAttempt.word.id);
      usedWordIds.add(rightAttempt.word.id);
    }
  }

  const soloOnePhrase = remainingOnePhrase.find((attempt) => !consumedLowIds.has(attempt.word.id));
  if (soloOnePhrase) {
    const solo = createBundledQuizWord([soloOnePhrase.word], soloOnePhrase.rows);
    if (solo) {
      bundledQuizWords.push(solo);
      consumedLowIds.add(soloOnePhrase.word.id);
      usedWordIds.add(soloOnePhrase.word.id);
    }
  }

  for (const lowAttempt of lowAttempts) {
    if (!usedWordIds.has(lowAttempt.word.id)) {
      skippedCharacters.push(lowAttempt.word.hanzi);
    }
  }

  const ordinaryQuizWords = standardAttempts
    .filter((attempt) => !usedWordIds.has(attempt.word.id))
    .map((attempt) => restoreSingleQuizWord(attempt.word))
    .filter((word): word is TestableWord => Boolean(word));

  return {
    quizWords: [...bundledQuizWords, ...ordinaryQuizWords],
    skippedCharacters,
  };
}

// ─── Vocab Phrase Fill-Test Rounds ──────────────────────────────────────────
//
// Standalone from buildBundledFillTestPlan above by design (per the resolved
// "phrases always form their own round" gate — see
// docs/feature-specs/2026-07-26-phrase-keyed-input.md) — the character
// bundler is never touched. Structurally simpler than the character path,
// too: a character can have 1-3+ of its own phrases, so bundling has to
// pair "low content" characters together to reach a usable round size. A
// vocab phrase always contributes exactly ONE row per round no matter how
// many examples it has (only one is shown per presentation, and every
// example for a given phrase shares the same answer, so a phrase can never
// supply its own distractors) — so phrases are simply chunked into
// same-size groups; there is no low/standard split to reconcile.

const VOCAB_PHRASE_ROUND_SIZE = 3;

type VocabPhraseCandidateRow = {
  phrase: string;
  text: string;
  vocabPhraseId: string;
};

function eligibleVocabPhraseExamples(phrase: VocabPhrase) {
  return phrase.examples.filter(
    (example) => example.includeInFillTest && example.zh.includes(phrase.phrase)
  );
}

// Exported so callers that only need a ready/not-ready check (e.g. the Due
// Review "quiz-ready" count) don't have to duplicate this eligibility rule
// or pull in the full round-building path just to count.
export function isVocabPhraseFillTestReady(phrase: VocabPhrase): boolean {
  return eligibleVocabPhraseExamples(phrase).length > 0;
}

function pickRandomEligibleExample(phrase: VocabPhrase): string | null {
  const eligible = eligibleVocabPhraseExamples(phrase);
  if (eligible.length === 0) {
    return null;
  }
  const chosen = eligible[Math.floor(Math.random() * eligible.length)];
  return chosen ? chosen.zh : null;
}

function rowFromVocabPhrase(phrase: VocabPhrase): VocabPhraseCandidateRow | null {
  const example = pickRandomEligibleExample(phrase);
  if (!example) {
    return null;
  }
  return {
    phrase: phrase.phrase,
    text: buildBlankedSentence(example, phrase.phrase),
    vocabPhraseId: phrase.id,
  };
}

function createVocabPhraseQuizBundle(rows: VocabPhraseCandidateRow[]): TestableVocabPhrase | null {
  if (rows.length === 0) {
    return null;
  }

  const optionPhrases = shuffleArray(rows.map((row) => row.phrase));
  const answerIndexByPhrase = new Map<string, number>();
  optionPhrases.forEach((phrase, index) => {
    answerIndexByPhrase.set(phrase, index);
  });

  return {
    id: rows.map((row) => row.vocabPhraseId).join("|"),
    phrase: rows.map((row) => row.phrase).join("、"),
    examples: [],
    testCount: 0,
    createdAt: Date.now(),
    fillTest: {
      phrases: optionPhrases,
      sentences: rows.map((row) => ({
        text: row.text,
        answerIndex: answerIndexByPhrase.get(row.phrase) ?? 0,
        vocabPhraseId: row.vocabPhraseId,
      })),
      vocabPhraseMembers: rows.map((row) => ({
        vocabPhraseId: row.vocabPhraseId,
        phrase: row.phrase,
        phraseCount: 1,
      })),
    },
  };
}

export type VocabPhraseFillTestPlan = {
  quizPhrases: TestableVocabPhrase[];
  skippedPhrases: string[];
};

/**
 * Builds one or more phrase-only quiz rounds from a set of packaged vocab
 * phrases. Each round bundles up to VOCAB_PHRASE_ROUND_SIZE phrases
 * together so each has other phrases' text to serve as drag-and-match
 * distractors — mirroring the round-size convention already used for
 * characters (buildFillTestFromSavedContent's own slice(0, 3)), not a new
 * number. A phrase with no fill-test-eligible example is skipped and
 * reported back rather than silently dropped.
 */
export function buildFillTestPlanForVocabPhrases(phrases: VocabPhrase[]): VocabPhraseFillTestPlan {
  const skippedPhrases: string[] = [];
  const rows: VocabPhraseCandidateRow[] = [];

  for (const phrase of phrases) {
    const row = rowFromVocabPhrase(phrase);
    if (!row) {
      skippedPhrases.push(phrase.phrase);
      continue;
    }
    rows.push(row);
  }

  const quizPhrases: TestableVocabPhrase[] = [];
  for (let index = 0; index < rows.length; index += VOCAB_PHRASE_ROUND_SIZE) {
    const bundle = createVocabPhraseQuizBundle(rows.slice(index, index + VOCAB_PHRASE_ROUND_SIZE));
    if (bundle) {
      quizPhrases.push(bundle);
    }
  }

  return { quizPhrases, skippedPhrases };
}

/**
 * A phrase-only round has to travel through the SAME quiz queue as
 * character rounds (`quizQueue: TestableWord[]`) — rendering, history,
 * autosave, and resume all iterate that one list. Rather than turning that
 * list into a union type across every call site, a phrase round is wrapped
 * as a `TestableWord`-shaped placeholder: its `fillTest` is the real,
 * already-built phrase round (tagged with `vocabPhraseId`, never
 * `characterId`), and its SRS fields are inert zeros that are never read —
 * grading for a wrapped round always dispatches to gradeVocabPhrase/
 * nudgeWordFamiliarity, never gradeWord, so those zeros never reach
 * `words`. The id is prefixed distinctively so it can never collide with a
 * real word id and so downstream code (grading dispatch, resume
 * revalidation) can recognize it without inspecting fillTest shape.
 */
export const VOCAB_PHRASE_ROUND_ID_PREFIX = "vocab-phrase-round:";

export function wrapVocabPhraseRoundAsQuizWord(round: TestableVocabPhrase): TestableWord {
  return {
    id: `${VOCAB_PHRASE_ROUND_ID_PREFIX}${round.id}`,
    hanzi: round.phrase,
    fillTest: round.fillTest,
    createdAt: round.createdAt,
    repetitions: 0,
    intervalDays: 0,
    ease: 0,
    nextReviewAt: 0,
    reviewCount: 0,
    testCount: 0,
  };
}

export function isVocabPhraseRoundQuizWord(word: TestableWord): boolean {
  return word.id.startsWith(VOCAB_PHRASE_ROUND_ID_PREFIX);
}

// ─── Review Session Progress (save/resume) ─────────────────────────────────
//
// These helpers live alongside buildBundledFillTestPlan/buildFillTestFromSavedContent
// (rather than in the domain module src/lib/fillTest.ts) because re-validating a
// saved quiz queue against current content requires buildFillTestFromSavedContent,
// which already lives in this UI-adjacent module. Keeping src/lib/fillTest.ts free
// of FlashcardLlmResponse/content-shape dependencies preserves the domain/UI layer
// boundary described in 0_ARCHITECTURE.md §2.
//
// Shared by both ad-hoc due-review sessions and packaged review test
// sessions (E3 extends E2's original ad-hoc-only helpers) -- see
// resolvePackagedReviewResume for the one packaged-only extra check.

export function buildContentByCharacterMap(
  entries: FlashcardContentEntry[]
): Map<string, FlashcardLlmResponse[]> {
  const contentByCharacter = new Map<string, FlashcardLlmResponse[]>();
  for (const entry of entries) {
    const list = contentByCharacter.get(entry.character) ?? [];
    list.push(entry.content);
    contentByCharacter.set(entry.character, list);
  }
  return contentByCharacter;
}

/**
 * Drops any queued fill-test item whose underlying word (or, for bundled
 * items, any member word) no longer exists or is no longer fill-test
 * eligible against CURRENT word/content state. Mirrors the existing
 * skip-invalid-silently precedent used by "Send Failed to Test Session"
 * (see src/lib/resultsReviewTestSession.ts) rather than erroring.
 *
 * `allowedWordIds`, when provided, adds ONE extra check on top of the
 * word-exists/content-eligible checks above: every member word's id must
 * also be present in the set, or the whole item is dropped. This is the
 * packaged-session-only check ("is this word still one of the session's
 * CURRENT quiz-ready targets") layered onto the same generic validation --
 * see resolvePackagedReviewResume, which passes the packaged session's
 * `activeReviewTestSessionRuntime.quizWords` ids here. Omitted (the
 * ad-hoc due-review path) it is a no-op, matching the pre-existing behavior.
 */
export function revalidateSavedQuizQueue(
  savedQueue: TestableWord[],
  currentWords: Word[],
  contentByCharacter: Map<string, FlashcardLlmResponse[]>,
  allowedWordIds?: Set<string>,
  currentVocabPhraseIds?: Set<string>
): TestableWord[] {
  const wordsById = new Map(currentWords.map((word) => [word.id, word]));

  return savedQueue.filter((queuedWord) => {
    if (isVocabPhraseRoundQuizWord(queuedWord)) {
      // A phrase round's "members" live under vocabPhraseMembers, not
      // members, and each must still exist as a current vocab_phrases row
      // (a parent may have deleted a packaged phrase while it was paused,
      // same reasoning as a deleted character target). No id set at all
      // (e.g. the ad-hoc due-review path, which never produces phrase
      // rounds) means treat as stale rather than trust a saved round blind.
      const vocabPhraseMembers = queuedWord.fillTest.vocabPhraseMembers ?? [];
      if (vocabPhraseMembers.length === 0 || !currentVocabPhraseIds) {
        return false;
      }
      return vocabPhraseMembers.every((member) => currentVocabPhraseIds.has(member.vocabPhraseId));
    }

    const members = queuedWord.fillTest.members?.length
      ? queuedWord.fillTest.members
      : [
          {
            wordId: queuedWord.id,
            hanzi: queuedWord.hanzi,
            phraseCount: queuedWord.fillTest.sentences.length,
          },
        ];

    return members.every((member) => {
      if (!wordsById.has(member.wordId)) {
        return false;
      }

      if (allowedWordIds && !allowedWordIds.has(member.wordId)) {
        return false;
      }

      return Boolean(buildFillTestFromSavedContent(contentByCharacter.get(member.hanzi) ?? []));
    });
  });
}

function isDueReviewProgressData(value: unknown): value is DueReviewProgressData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Record<string, unknown>;
  return (
    Array.isArray(source.quizQueue) &&
    typeof source.resumeIndex === "number" &&
    Number.isInteger(source.resumeIndex) &&
    Array.isArray(source.quizHistory) &&
    typeof source.quizSelectionMode === "string" &&
    (QUIZ_SELECTION_MODES as readonly string[]).includes(source.quizSelectionMode) &&
    (source.quizSessionStartTime === null || typeof source.quizSessionStartTime === "number")
  );
}

export type DueReviewResumeResolution =
  | {
      status: "ready";
      quizQueue: TestableWord[];
      quizHistory: QuizHistoryItem[];
      quizSelectionMode: QuizSelectionMode;
      quizSessionStartTime: number | null;
    }
  | { status: "empty" }
  | { status: "invalid" };

/**
 * Shared resolution core for both resolveDueReviewResume (ad-hoc due-review)
 * and resolvePackagedReviewResume (packaged sessions) below: re-validates
 * the not-yet-answered TAIL of a saved queue (from resumeIndex onward)
 * against current word/content state. Items before resumeIndex were already
 * graded before the session was paused and are intentionally never
 * replayed here -- see buildDueReviewAutosavePayload for why that would
 * double-grade them. `allowedWordIds`, when passed through, is forwarded to
 * revalidateSavedQuizQueue for the packaged-only "still a current quiz-ready
 * target" check.
 */
function resolveReviewResume(params: {
  progressData: unknown;
  currentWords: Word[];
  allFlashcardContents: FlashcardContentEntry[];
  allowedWordIds?: Set<string>;
  currentVocabPhraseIds?: Set<string>;
}): DueReviewResumeResolution {
  if (!isDueReviewProgressData(params.progressData)) {
    return { status: "invalid" };
  }

  const parsed = params.progressData;
  const boundedResumeIndex = Math.min(Math.max(0, parsed.resumeIndex), parsed.quizQueue.length);
  const remainingQueue = parsed.quizQueue.slice(boundedResumeIndex);
  if (remainingQueue.length === 0) {
    return { status: "empty" };
  }

  const contentByCharacter = buildContentByCharacterMap(params.allFlashcardContents);
  const validatedQueue = revalidateSavedQuizQueue(
    remainingQueue,
    params.currentWords,
    contentByCharacter,
    params.allowedWordIds,
    params.currentVocabPhraseIds
  );
  if (validatedQueue.length === 0) {
    return { status: "empty" };
  }

  return {
    status: "ready",
    quizQueue: validatedQueue,
    quizHistory: parsed.quizHistory,
    quizSelectionMode: parsed.quizSelectionMode,
    quizSessionStartTime: parsed.quizSessionStartTime,
  };
}

/**
 * Resolves a saved ad-hoc due-review review_session_progress row's
 * progress_data into runtime state ready to resume. See resolveReviewResume
 * for the shared re-validation core.
 */
export function resolveDueReviewResume(params: {
  progressData: unknown;
  currentWords: Word[];
  allFlashcardContents: FlashcardContentEntry[];
}): DueReviewResumeResolution {
  return resolveReviewResume(params);
}

/**
 * Packaged-session flavor of resolveDueReviewResume. Adds TWO extra
 * re-validation checks beyond the ad-hoc path: every member word of each
 * queued character item must still be present in `quizWordIds` (pass
 * `activeReviewTestSessionRuntime.quizWords.map((word) => word.id)` for the
 * packaged session being resumed), and every member phrase of each queued
 * phrase round must still be present in `vocabPhraseIds` (pass
 * `activeReviewTestSessionRuntime.vocabPhrases.map((phrase) => phrase.id)`)
 * -- a parent may have removed a target (or a whole phrase) while the
 * child had the session paused. Composes with
 * resolveReviewResume/revalidateSavedQuizQueue rather than duplicating the
 * resumeIndex-slicing or per-item validation logic.
 */
export function resolvePackagedReviewResume(params: {
  progressData: unknown;
  currentWords: Word[];
  allFlashcardContents: FlashcardContentEntry[];
  quizWordIds: Set<string>;
  vocabPhraseIds: Set<string>;
}): DueReviewResumeResolution {
  return resolveReviewResume({
    progressData: params.progressData,
    currentWords: params.currentWords,
    allFlashcardContents: params.allFlashcardContents,
    allowedWordIds: params.quizWordIds,
    currentVocabPhraseIds: params.vocabPhraseIds,
  });
}

/**
 * Builds the autosave payload for a fill-test session immediately after a
 * word has been graded. Despite the name, this is now shared by BOTH ad-hoc
 * due-review sessions and packaged review test sessions -- it only touches
 * `quizQueue`/`quizIndex`/`quizHistory`/`quizSelectionMode`/
 * `quizSessionStartTime`, none of which differ by source type. Kept under
 * its original name to avoid an unrelated rename across call sites; the
 * `source_type`/`packaged_session_id` distinction lives one layer up, in
 * the `saveReviewSessionProgress` call site (see
 * `activeProgressSourceRef` in words.shared.state.ts).
 *
 * `resumeIndex` is deliberately `quizIndex + 1` (the NEXT unanswered word),
 * never the just-graded `quizIndex`: `gradeWord()` has already mutated the
 * scheduler for that word the moment it was graded, independent of whether
 * the user later clicks "Next" -- if resume replayed the same word again it
 * would double-grade it. Returns null when the just-graded word was the
 * last item in the queue, since a session that is about to complete should
 * not get a saved-progress row (the normal completion-cleanup path handles
 * that word instead).
 */
export function buildDueReviewAutosavePayload(params: {
  quizQueue: TestableWord[];
  quizIndex: number;
  quizHistory: QuizHistoryItem[];
  quizSelectionMode: QuizSelectionMode;
  quizSessionStartTime: number | null;
}): DueReviewProgressData | null {
  const resumeIndex = params.quizIndex + 1;
  if (resumeIndex >= params.quizQueue.length) {
    return null;
  }

  return {
    quizQueue: params.quizQueue,
    resumeIndex,
    quizHistory: params.quizHistory,
    quizSelectionMode: params.quizSelectionMode,
    quizSessionStartTime: params.quizSessionStartTime,
  };
}

/**
 * The "characters remaining" count for a paused-session row. `progressData`
 * (as saved by buildDueReviewAutosavePayload) stores the FULL original
 * `quizQueue` plus a separate `resumeIndex` pointer to the next unanswered
 * item -- the true remaining count is the tail length (quizQueue.length -
 * resumeIndex), not the raw queue length, which would still count words
 * already graded before the session was paused.
 */
export function getPausedSessionRemainingCount(progressData: unknown): number {
  if (
    !progressData ||
    typeof progressData !== "object" ||
    !Array.isArray((progressData as { quizQueue?: unknown }).quizQueue)
  ) {
    return 0;
  }

  const { quizQueue, resumeIndex } = progressData as {
    quizQueue: unknown[];
    resumeIndex?: unknown;
  };
  const boundedResumeIndex =
    typeof resumeIndex === "number" && Number.isInteger(resumeIndex)
      ? Math.min(Math.max(0, resumeIndex), quizQueue.length)
      : 0;
  return quizQueue.length - boundedResumeIndex;
}

/**
 * The "blanks remaining" count for a paused PARAGRAPH-QUIZ session row.
 * getPausedSessionRemainingCount above only understands the ordinary
 * quizQueue/resumeIndex shape -- a paragraph-quiz row's progress_data is
 * shaped as ParagraphQuizProgressData (testModeId/currentPageIndex/
 * blankState) instead, which has no quizQueue at all, so that function
 * always silently fell through to 0 for these rows.
 *
 * blankState only ever gains an entry once a blank has been attempted (see
 * ParagraphQuizReviewSection.tsx's handlePlacement) -- an untouched blank
 * has no entry -- so remaining is simply totalBlanks (the session's full
 * blank count, from the already-resolved runtime paragraphQuiz.pages, the
 * same source the quiz itself plays from) minus however many entries are
 * currently marked "correct".
 */
export function getPausedParagraphQuizRemainingBlankCount(
  progressData: unknown,
  totalBlanks: number
): number {
  if (!isParagraphQuizProgressData(progressData)) return 0;
  const correctCount = Object.values(progressData.blankState).filter(
    (entry) => entry.status === "correct"
  ).length;
  return Math.max(0, totalBlanks - correctCount);
}

// ─── Paragraph-quiz resume (Phase 3) ────────────────────────────────────────

export function isParagraphQuizProgressData(value: unknown): value is ParagraphQuizProgressData {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  if (typeof source.testModeId !== "string") return false;
  if (typeof source.currentPageIndex !== "number" || !Number.isInteger(source.currentPageIndex)) return false;
  if (source.sessionStartTime !== null && typeof source.sessionStartTime !== "number") return false;
  if (!source.blankState || typeof source.blankState !== "object") return false;

  return Object.values(source.blankState as Record<string, unknown>).every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const blank = entry as Record<string, unknown>;
    return (
      (blank.status === "correct" || blank.status === "unfilled") &&
      typeof blank.retryCount === "number"
    );
  });
}

export type ParagraphQuizResumeResolution =
  | {
      status: "ready";
      currentPageIndex: number;
      blankState: Record<string, ParagraphQuizBlankProgress>;
      sessionStartTime: number | null;
    }
  | { status: "empty" }
  | { status: "invalid" };

/**
 * Resolves a saved paragraph-quiz review_session_progress row's
 * progress_data into runtime state ready to resume. Re-validates the
 * remaining (not-yet-correct) blanks against the paragraph's CURRENT pages
 * (already re-resolved from the paragraph's current spans by
 * buildReviewTestSessionRuntime/buildParagraphQuizPages -- a span deleted
 * since packaging simply won't appear there) -- a stale saved blank id is
 * dropped rather than trusted blind, mirroring revalidateSavedQuizQueue's
 * precedent for the ordinary character/phrase path. If this empties the
 * saved current page, resume advances to the first page that still has an
 * unfilled blank rather than landing on a dead end; if the whole quiz has
 * no remaining work at all, reports "empty".
 */
export function resolveParagraphQuizResume(params: {
  progressData: unknown;
  testModeId: string;
  pages: ParagraphQuizPage[];
}): ParagraphQuizResumeResolution {
  if (!isParagraphQuizProgressData(params.progressData)) {
    return { status: "invalid" };
  }

  const parsed = params.progressData;
  if (parsed.testModeId !== params.testModeId) {
    return { status: "invalid" };
  }

  const validSpanIds = new Set(params.pages.flatMap((page) => page.bankSpanIds));
  const blankState: Record<string, ParagraphQuizBlankProgress> = {};
  for (const [spanId, state] of Object.entries(parsed.blankState)) {
    if (validSpanIds.has(spanId)) {
      blankState[spanId] = state;
    }
  }

  const pageHasRemainingBlank = (page: ParagraphQuizPage) =>
    page.bankSpanIds.some((spanId) => (blankState[spanId]?.status ?? "unfilled") !== "correct");

  const savedPage = params.pages[parsed.currentPageIndex];
  let currentPageIndex = savedPage && pageHasRemainingBlank(savedPage) ? parsed.currentPageIndex : -1;

  if (currentPageIndex === -1) {
    currentPageIndex = params.pages.findIndex(pageHasRemainingBlank);
  }

  if (currentPageIndex === -1) {
    return { status: "empty" };
  }

  return {
    status: "ready",
    currentPageIndex,
    blankState,
    sessionStartTime: parsed.sessionStartTime,
  };
}

/**
 * Filters family-scoped paused-session rows (from listReviewSessionProgress,
 * which returns every family member's rows under the family-scoped read RLS
 * policy) for display. Child/platform-admin viewers only ever see and act on
 * their OWN rows -- one child must never resume or discard a sibling's
 * in-progress quiz, even though RLS would independently reject the write.
 * Parents get the full unfiltered family list (read-only visibility, per the
 * feature spec).
 */
export function filterPausedSessionsForViewer(
  rows: ReviewSessionProgress[],
  viewerUserId: string | undefined,
  isActionableViewer: boolean
): ReviewSessionProgress[] {
  if (!isActionableViewer) {
    return rows;
  }

  return rows.filter((row) => row.userId === viewerUserId);
}

/**
 * Resolves the quiz-notice text to show once a fill-test run finishes.
 * Returns `null` when `completeReviewTestSession` failed -- in that case the
 * caller must leave the error notice already set by the failed-completion
 * catch block in place, rather than overwriting it with a false "completed"
 * message. Before this helper existed, moveQuizForward unconditionally called
 * setQuizNotice with a success message after the completion try/catch,
 * clobbering the real error notice on every packaged-completion failure --
 * see build-fix-log-2026-07-30-packaged-session-limbo.md.
 */
export function resolveQuizCompletionNotice(params: {
  reviewTestSessionCompletionFailed: boolean;
  completedReviewTestSessionName: string | null;
  completedNoticeTemplate: string;
  adHocNoticeMessage: string;
}): string | null {
  if (params.reviewTestSessionCompletionFailed) {
    return null;
  }

  return params.completedReviewTestSessionName
    ? params.completedNoticeTemplate.replace("{name}", params.completedReviewTestSessionName)
    : params.adHocNoticeMessage;
}

export function normalizeAdminDraftResponse(raw: unknown, request: FlashcardLlmRequest): FlashcardLlmResponse {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawMeanings = Array.isArray(source.meanings) ? source.meanings : [];
  const meanings: FlashcardLlmResponse["meanings"] = [];

  for (const meaningItem of rawMeanings) {
    if (!meaningItem || typeof meaningItem !== "object") {
      continue;
    }

    const meaningSource = meaningItem as Record<string, unknown>;
    const definition = typeof meaningSource.definition === "string" ? meaningSource.definition.trim() : "";
    const definitionEn =
      typeof meaningSource.definition_en === "string" ? meaningSource.definition_en.trim() : "";
    if (!definition) {
      continue;
    }

    const rawPhrases = Array.isArray(meaningSource.phrases) ? meaningSource.phrases : [];
    const phraseSeen = new Set<string>();
    const phrases: FlashcardMeaningPhrase[] = [];

    for (const phraseItem of rawPhrases) {
      if (!phraseItem || typeof phraseItem !== "object") {
        continue;
      }

      const phraseSource = phraseItem as Record<string, unknown>;
      const phrase = typeof phraseSource.phrase === "string" ? phraseSource.phrase.trim() : "";
      const pinyin = typeof phraseSource.pinyin === "string" ? phraseSource.pinyin.trim() : "";
      const example = typeof phraseSource.example === "string" ? phraseSource.example.trim() : "";
      const examplePinyin =
        typeof phraseSource.example_pinyin === "string"
          ? phraseSource.example_pinyin.trim()
          : typeof phraseSource.examplePinyin === "string"
            ? phraseSource.examplePinyin.trim()
            : "";
      const includeInFillTest =
        typeof phraseSource.include_in_fill_test === "boolean"
          ? phraseSource.include_in_fill_test
          : typeof phraseSource.includeInFillTest === "boolean"
            ? phraseSource.includeInFillTest
            : true;
      if (!phrase || !example) {
        continue;
      }

      const dedupeKey = `${phrase}|${pinyin}|${example}`;
      if (phraseSeen.has(dedupeKey)) {
        continue;
      }

      phraseSeen.add(dedupeKey);
      phrases.push({
        phrase,
        pinyin,
        example,
        // GUARDRAIL: Always preserve example_pinyin if present, even if empty string.
        // This ensures the field is consistent and can be regenerated via refresh-all-pinyin.
        ...(examplePinyin ? { example_pinyin: examplePinyin } : {}),
        include_in_fill_test: includeInFillTest,
      });
    }

    if (phrases.length === 0) {
      continue;
    }

    meanings.push({
      definition,
      ...(definitionEn ? { definition_en: definitionEn } : {}),
      phrases,
    });
  }

  return {
    character: request.character,
    pronunciation: request.pronunciation,
    meanings,
  };
}

export function renderPhraseWithPinyin(phrase: string, pinyin: string): ReactNode {
  if (!pinyin.trim()) {
    return phrase;
  }

  const chars = Array.from(phrase);
  const pinyinParts = alignPinyinParts(phrase, pinyin);

  if (chars.length === 0) {
    return phrase;
  }

  // GUARDRAIL: Pinyin rendering uses flex-nowrap (not flex-wrap) to prevent ruby element breaking.
  // Previous issue: flex-wrap caused ruby (<rt> pinyin) to separate from base characters, truncating display.
  // Fix: Use flex-nowrap + overflow-x-auto and flex-shrink-0 on ruby elements.
  // Keep <rt> styling minimal to preserve natural ruby text positioning (above characters).
  // Use items-end to align baseline with character baseline (not top with pinyin).
  return (
    <span className="inline-flex flex-nowrap items-end gap-0.5 overflow-x-auto">
      {chars.map((char, index) => (
        <ruby key={`${phrase}-${index}`} className="inline-flex flex-col items-center flex-shrink-0">
          <rt className="text-[10px] text-gray-500 leading-none whitespace-nowrap">{(pinyinParts[index] ?? "").toLowerCase()}</rt>
          <span className="text-base">{char}</span>
        </ruby>
      ))}
    </span>
  );
}

export function renderSentenceWithPinyin(
  sentence: string,
  pinyin: string,
  options?: {
    allowWrap?: boolean;
  }
): ReactNode {
  if (!pinyin.trim()) {
    return sentence;
  }

  const chars = Array.from(sentence);
  const hanziCount = chars.reduce((count, char) => (isHanziCharacter(char) ? count + 1 : count), 0);
  if (hanziCount === 0) {
    return sentence;
  }

  const pinyinParts = alignPinyinPartsForCount(hanziCount, pinyin);
  let hanziIndex = 0;
  const allowWrap = options?.allowWrap ?? false;
  const containerClassName = allowWrap
    ? "flex max-w-full flex-wrap items-end gap-x-0.5 gap-y-1"
    : "inline-flex flex-nowrap items-end gap-0.5 overflow-x-auto";

  // GUARDRAIL: Default to flex-nowrap to keep ruby text attached to each Hanzi token.
  // Admin examples can opt into wrapping so long sentences break across rows without
  // allowing individual ruby/punctuation nodes to split apart mid-token.
  return (
    <span className={containerClassName}>
      {chars.map((char, index) => {
        if (!isHanziCharacter(char)) {
          return (
            <span key={`${sentence}-${index}`} className="text-base flex-shrink-0">{char}</span>
          );
        }

        const part = pinyinParts[hanziIndex] ?? "";
        hanziIndex += 1;
        return (
          <ruby key={`${sentence}-${index}`} className="inline-flex flex-col items-center flex-shrink-0">
            <rt className="text-[10px] text-gray-500 leading-none whitespace-nowrap">{part.toLowerCase()}</rt>
            <span className="text-base">{char}</span>
          </ruby>
        );
      })}
    </span>
  );
}
