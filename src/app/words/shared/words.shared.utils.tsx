import type { ReactNode } from "react";
import {
  normalizeFlashcardLlmResponse,
  type FlashcardLlmRequest,
  type FlashcardLlmResponse,
  type FlashcardMeaningPhrase,
} from "@/lib/flashcardLlm";
import type { FillTest, Word } from "@/lib/types";
import type {
  FillTestCandidateRow,
  FlashcardExampleGenerationResponse,
  FlashcardExamplePinyinGenerationResponse,
  FlashcardMeaningDetailGenerationResponse,
  FlashcardPhraseDetailGenerationResponse,
  FlashcardPhraseGenerationResponse,
  NavItem,
  QuizSelectionMode,
  TestableWord,
  WordsLocaleStrings,
} from "./words.shared.types";

export const SLOT_INDICES: Array<0 | 1 | 2> = [0, 1, 2];
export const QUIZ_SELECTION_MODES = ["all", "10", "20", "30", "manual"] as const;
export const QUIZ_PHRASE_DRAG_MIME = "text/x-cc-review-phrase-index";

const DAY_MS = 24 * 60 * 60 * 1000;
const HANZI_CHAR_REGEX = /\p{Script=Han}/u;

const PINYIN_SYLLABLE_RE = /[a-zA-Z\u00FC\u00DCvV]+[1-5]?/g;
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

export function getNavItems(str: WordsLocaleStrings): NavItem[] {
  return [
    { href: "/words/add", label: `${str.nav.addCharacters}`, page: "add" },
    { href: "/words/all", label: `${str.nav.allCharacters}`, page: "all" },
    { href: "/words/admin", label: `${str.nav.contentAdmin}`, page: "admin" },
    { href: "/words/review", label: `${str.nav.dueReview}`, page: "review" },
  ];
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
    phrases: [...fillTest.phrases] as [string, string, string],
    sentences: fillTest.sentences.map((sentence) => ({ ...sentence })) as [
      FillTest["sentences"][0],
      FillTest["sentences"][1],
      FillTest["sentences"][2],
    ],
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
  const lastReviewAt = word.nextReviewAt - intervalDays * DAY_MS;
  const elapsedDays = Math.max(0, (now - lastReviewAt) / DAY_MS);
  const probability = Math.exp(-elapsedDays / stabilityDays);
  return Math.min(0.99, Math.max(0.01, probability));
}

export function formatProbability(value: number): string {
  return `${Math.round(value * 100)}%`;
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

export function parseQuizPhraseIndex(raw: string): 0 | 1 | 2 | null {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 2) {
    return null;
  }

  return parsed as 0 | 1 | 2;
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
  const dfs = (index: number, parts: string[]) => {
    if (results.length > 4) {
      return;
    }

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

function alignPinyinPartsForCount(partCount: number, pinyin: string): string[] {
  const normalized = pinyin.trim();
  if (!normalized) {
    return Array(partCount).fill("");
  }

  const tokens = normalized.match(PINYIN_SYLLABLE_RE) ?? [];
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
    return undefined;
  }

  const sentenceRows = shuffleArray(candidates).slice(0, 3);
  const optionPhrases = shuffleArray(sentenceRows.map((item) => item.phrase)) as [string, string, string];
  const answerIndexByPhrase = new Map<string, 0 | 1 | 2>();
  optionPhrases.forEach((phrase, index) => {
    answerIndexByPhrase.set(phrase, index as 0 | 1 | 2);
  });

  const sentences = sentenceRows.map((item) => ({
    text: buildBlankedSentence(item.example, item.phrase),
    answerIndex: answerIndexByPhrase.get(item.phrase) ?? 0,
  })) as [FillTest["sentences"][0], FillTest["sentences"][1], FillTest["sentences"][2]];

  return {
    phrases: optionPhrases,
    sentences,
  };
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

  return (
    <span className="inline-flex flex-wrap items-end gap-1">
      {chars.map((char, index) => (
        <ruby key={`${phrase}-${index}`} className="text-base leading-tight">
          {char}
          <rt className="text-[10px] text-gray-500">{pinyinParts[index] ?? ""}</rt>
        </ruby>
      ))}
    </span>
  );
}

export function renderSentenceWithPinyin(sentence: string, pinyin: string): ReactNode {
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

  return (
    <span className="inline-flex flex-wrap items-end gap-1">
      {chars.map((char, index) => {
        if (!isHanziCharacter(char)) {
          return (
            <span key={`${sentence}-${index}`} className="text-base leading-tight">
              {char}
            </span>
          );
        }

        const part = pinyinParts[hanziIndex] ?? "";
        hanziIndex += 1;
        return (
          <ruby key={`${sentence}-${index}`} className="text-base leading-tight">
            {char}
            <rt className="text-[10px] text-gray-500">{part}</rt>
          </ruby>
        );
      })}
    </span>
  );
}

