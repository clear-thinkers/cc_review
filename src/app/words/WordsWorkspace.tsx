"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useXinhuaFlashcardInfo } from "@/hooks/useXinhuaFlashcardInfo";
import {
  db,
  deleteFlashcardContent,
  getAllFlashcardContents,
  getDueWords,
  getFlashcardContent,
  gradeWord,
  putFlashcardContent,
} from "@/lib/db";
import { gradeFillTest, type FillResult, type Placement, type Tier } from "@/lib/fillTest";
import {
  buildFlashcardLlmRequestKey,
  normalizeFlashcardLlmResponse,
  type FlashcardMeaningPhrase,
  type FlashcardLlmRequest,
  type FlashcardLlmResponse,
} from "@/lib/flashcardLlm";
import { makeId } from "@/lib/id";
import { calculateNextState, type Grade } from "@/lib/scheduler";
import type { FillTest, Word } from "@/lib/types";
import { getXinhuaFlashcardInfo, resetXinhuaCachesForTests } from "@/lib/xinhua";

const SLOT_INDICES: Array<0 | 1 | 2> = [0, 1, 2];
const QUIZ_SELECTION_MODES = ["all", "10", "20", "30", "manual"] as const;
const QUIZ_PHRASE_DRAG_MIME = "text/x-cc-review-phrase-index";

type QuizSelectionMode = (typeof QUIZ_SELECTION_MODES)[number];
type TestableWord = Word & { fillTest: FillTest };
type QuizHistoryItem = {
  wordId: string;
  hanzi: string;
  tier: Tier;
  correctCount: 0 | 1 | 2 | 3;
};
type FlashcardHistoryItem = {
  wordId: string;
  hanzi: string;
  grade: Grade;
};
type AdminTarget = {
  character: string;
  pronunciation: string;
  key: string;
};
type AdminTableRow = {
  rowKey: string;
  targetKey: string;
  rowType: "existing" | "pending_phrase" | "pending_meaning" | "empty_target";
  pendingId: string | null;
  character: string;
  pronunciation: string;
  meaningZh: string;
  meaningEn: string;
  phrase: string;
  phrasePinyin: string;
  example: string;
  examplePinyin: string;
  includeInFillTest: boolean;
};
type AdminPendingPhrase = {
  id: string;
  targetKey: string;
  meaningZh: string;
  meaningEn: string;
  phraseInput: string;
};
type AdminPendingMeaning = {
  id: string;
  targetKey: string;
  meaningZhInput: string;
  phraseInput: string;
  exampleInput: string;
};
type AdminTableRenderRow = AdminTableRow & {
  showCharacterCell: boolean;
  characterRowSpan: number;
  showMeaningCell: boolean;
  meaningRowSpan: number;
};
type NavPage = "add" | "all" | "review" | "admin";
export type WordsSectionPage = NavPage | "flashcard" | "fillTest";
type AllWordsSortKey = "hanzi" | "createdAt" | "nextReviewAt" | "reviewCount" | "testCount" | "familiarity";
type DueWordsSortKey = "hanzi" | "nextReviewAt" | "familiarity";
type SortDirection = "asc" | "desc";
type FlashcardLlmResponseMap = Record<string, FlashcardLlmResponse>;
type FlashcardPhraseGenerationRequest = FlashcardLlmRequest & {
  mode: "phrase";
  meaning: string;
  meaning_en?: string;
  existing_phrases: string[];
};
type FlashcardPhraseGenerationResponse = {
  phrase: string;
  pinyin: string;
  example: string;
  example_pinyin: string;
};
type FlashcardExampleGenerationRequest = FlashcardLlmRequest & {
  mode: "example";
  meaning: string;
  meaning_en?: string;
  phrase: string;
  existing_examples: string[];
};
type FlashcardExampleGenerationResponse = {
  example: string;
  example_pinyin: string;
};
type FlashcardExamplePinyinGenerationRequest = FlashcardLlmRequest & {
  mode: "example_pinyin";
  meaning?: string;
  meaning_en?: string;
  phrase?: string;
  example: string;
};
type FlashcardExamplePinyinGenerationResponse = {
  example_pinyin: string;
};
type FlashcardPhraseDetailGenerationRequest = FlashcardLlmRequest & {
  mode: "phrase_details";
  meaning: string;
  meaning_en?: string;
  phrase: string;
  existing_examples: string[];
};
type FlashcardPhraseDetailGenerationResponse = {
  pinyin: string;
  example: string;
  example_pinyin: string;
};
type FlashcardMeaningDetailGenerationRequest = FlashcardLlmRequest & {
  mode: "meaning_details";
  meaning: string;
};
type FlashcardMeaningDetailGenerationResponse = {
  definition_en: string;
};
type AdminPhraseLocation = {
  meaningIndex: number;
  phraseIndex: number;
};
type AdminStatsFilter =
  | "characters"
  | "targets"
  | "with_content"
  | "missing_content"
  | "ready_for_testing"
  | "excluded_for_testing";
type AdminTargetContentStatus = "missing_content" | "ready_for_testing" | "excluded_for_testing";

const DAY_MS = 24 * 60 * 60 * 1000;
const NAV_ITEMS: Array<{ href: string; label: string; page: NavPage }> = [
  { href: "/words/add", label: "\u6dfb\u52a0\u6c49\u5b57 / Add Characters", page: "add" },
  { href: "/words/all", label: "\u5168\u90e8\u6c49\u5b57 / All Characters", page: "all" },
  { href: "/words/admin", label: "\u5185\u5bb9\u7ba1\u7406 / Content Admin", page: "admin" },
  { href: "/words/review", label: "\u5f85\u590d\u4e60 / Due Review", page: "review" },
];
const GRADE_LABELS = {
  again: "\u4e0d\u8bb0\u5f97\u4e86 / Don't remember",
  hard: "\u90e8\u5206\u8ba4\u8bc6 / Partially know",
  good: "\u57fa\u672c\u8ba4\u8bc6 / Mostly know",
  easy: "\u5168\u90e8\u8ba4\u8bc6 / Fully know",
} as const;

const HANZI_CHAR_REGEX = /\p{Script=Han}/u;

function cloneFillTest(fillTest: FillTest): FillTest {
  return {
    phrases: [...fillTest.phrases] as [string, string, string],
    sentences: fillTest.sentences.map((sentence) => ({ ...sentence })) as [
      FillTest["sentences"][0],
      FillTest["sentences"][1],
      FillTest["sentences"][2],
    ],
  };
}

function cloneWord(word: Word): Word {
  return {
    ...word,
    fillTest: word.fillTest ? cloneFillTest(word.fillTest) : undefined,
  };
}

function cloneFlashcardLlmResponse(content: FlashcardLlmResponse): FlashcardLlmResponse {
  return {
    ...content,
    meanings: content.meanings.map((meaning) => ({
      ...meaning,
      phrases: meaning.phrases.map((phrase) => ({ ...phrase })),
    })),
  };
}

function hasFillTest(word: Word): word is TestableWord {
  return Boolean(word.fillTest);
}

function formatDateTime(timestamp: number): string {
  if (!timestamp) {
    return "Now";
  }

  return new Date(timestamp).toLocaleString();
}

function getFamiliarity(word: Word): string {
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

function getReviewCount(word: Word): number {
  return word.reviewCount ?? word.repetitions ?? 0;
}

function getTestCount(word: Word): number {
  return word.testCount ?? 0;
}

function getMemorizationProbability(word: Word, now = Date.now()): number {
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

function formatProbability(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function getSelectionModeLabel(mode: QuizSelectionMode): string {
  if (mode === "all") {
    return "全部待测 / All due";
  }

  if (mode === "manual") {
    return "手动选择 / Manual selection";
  }

  return `${mode} 个待测汉字 / ${mode} due characters`;
}

function parseQuizPhraseIndex(raw: string): 0 | 1 | 2 | null {
  if (raw === "0" || raw === "1" || raw === "2") {
    return Number(raw) as 0 | 1 | 2;
  }

  return null;
}

function isHanziCharacter(char: string): boolean {
  return HANZI_CHAR_REGEX.test(char);
}

function extractUniqueHanzi(input: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const char of Array.from(input)) {
    if (!isHanziCharacter(char) || seen.has(char)) {
      continue;
    }

    seen.add(char);
    result.push(char);
  }

  return result;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function shouldShowManualEditPopup(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes("non-duplicate") ||
    text.includes("unique phrase") ||
    text.includes("unique example") ||
    text.includes("already exists")
  );
}

function isFlashcardLlmResponse(value: unknown): value is FlashcardLlmResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Record<string, unknown>;
  return (
    typeof source.character === "string" &&
    typeof source.pronunciation === "string" &&
    Array.isArray(source.meanings)
  );
}

function isFlashcardPhraseGenerationResponse(value: unknown): value is FlashcardPhraseGenerationResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Record<string, unknown>;
  return (
    typeof source.phrase === "string" &&
    source.phrase.trim().length > 0 &&
    typeof source.pinyin === "string" &&
    source.pinyin.trim().length > 0 &&
    typeof source.example === "string" &&
    source.example.trim().length > 0 &&
    typeof source.example_pinyin === "string" &&
    source.example_pinyin.trim().length > 0
  );
}

function isFlashcardExampleGenerationResponse(value: unknown): value is FlashcardExampleGenerationResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Record<string, unknown>;
  return (
    typeof source.example === "string" &&
    source.example.trim().length > 0 &&
    typeof source.example_pinyin === "string" &&
    source.example_pinyin.trim().length > 0
  );
}

function isFlashcardPhraseDetailGenerationResponse(
  value: unknown
): value is FlashcardPhraseDetailGenerationResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Record<string, unknown>;
  return (
    typeof source.pinyin === "string" &&
    source.pinyin.trim().length > 0 &&
    typeof source.example === "string" &&
    source.example.trim().length > 0 &&
    typeof source.example_pinyin === "string" &&
    source.example_pinyin.trim().length > 0
  );
}

function isFlashcardMeaningDetailGenerationResponse(
  value: unknown
): value is FlashcardMeaningDetailGenerationResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Record<string, unknown>;
  return typeof source.definition_en === "string" && source.definition_en.trim().length > 0;
}

function isFlashcardExamplePinyinGenerationResponse(
  value: unknown
): value is FlashcardExamplePinyinGenerationResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Record<string, unknown>;
  return typeof source.example_pinyin === "string" && source.example_pinyin.trim().length > 0;
}

const PINYIN_SYLLABLE_RE =
  /^(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:a|ai|an|ang|ao|e|ei|en|eng|er|i|ia|ian|iang|iao|ie|in|ing|iong|iu|o|ong|ou|u|ua|uai|uan|uang|ue|ui|un|uo|v|ve|n|ng|m)$/;
const PINYIN_TONE_MAP: Record<string, string> = {
  ā: "a",
  á: "a",
  ǎ: "a",
  à: "a",
  ē: "e",
  é: "e",
  ě: "e",
  è: "e",
  ī: "i",
  í: "i",
  ǐ: "i",
  ì: "i",
  ō: "o",
  ó: "o",
  ǒ: "o",
  ò: "o",
  ū: "u",
  ú: "u",
  ǔ: "u",
  ù: "u",
  ǖ: "ü",
  ǘ: "ü",
  ǚ: "ü",
  ǜ: "ü",
  ń: "n",
  ň: "n",
  ǹ: "n",
  ḿ: "m",
};

function normalizePinyinBase(input: string): string {
  const replaced = Array.from(input.toLowerCase())
    .map((char) => PINYIN_TONE_MAP[char] ?? char)
    .join("")
    .replace(/u:/g, "ü");
  return replaced.replace(/ü/g, "v");
}

function isLikelyPinyinSyllable(syllable: string): boolean {
  const base = normalizePinyinBase(syllable).replace(/[^a-z]/g, "");
  if (!base) {
    return false;
  }

  // Accept erhua shorthand in compact pinyin (e.g. yi-hui-r).
  if (base === "r") {
    return true;
  }

  if (!/[aeiouv]/.test(base)) {
    return false;
  }

  return PINYIN_SYLLABLE_RE.test(base);
}

function segmentCompactPinyin(compactPinyin: string, syllableCount: number): string[] | null {
  const maxSyllableLength = 6;
  const memo = new Map<string, string[] | null>();

  function dfs(startIndex: number, remaining: number): string[] | null {
    const key = `${startIndex}|${remaining}`;
    if (memo.has(key)) {
      return memo.get(key) ?? null;
    }

    if (remaining === 0) {
      return startIndex === compactPinyin.length ? [] : null;
    }

    if (startIndex >= compactPinyin.length) {
      return null;
    }

    const remainingChars = compactPinyin.length - startIndex;
    if (remainingChars < remaining || remainingChars > remaining * maxSyllableLength) {
      return null;
    }

    const maxEnd = Math.min(compactPinyin.length, startIndex + maxSyllableLength);
    for (let end = maxEnd; end > startIndex; end -= 1) {
      const candidate = compactPinyin.slice(startIndex, end);
      if (!isLikelyPinyinSyllable(candidate)) {
        continue;
      }

      const tail = dfs(end, remaining - 1);
      if (tail) {
        const result = [candidate, ...tail];
        memo.set(key, result);
        return result;
      }
    }

    memo.set(key, null);
    return null;
  }

  return dfs(0, syllableCount);
}

function alignPinyinPartsForCount(partCount: number, pinyin: string): string[] {
  if (partCount === 0) {
    return [];
  }

  const normalizedPinyin = pinyin
    .trim()
    .toLowerCase()
    .replace(/u:/g, "ü")
    .replace(/[，。！？；：、,.!?;:·'"“”‘’（）()\[\]{}<>《》〈〉「」『』]/g, " ");
  if (!normalizedPinyin) {
    return [];
  }

  const directParts = normalizedPinyin
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{Letter}ü]/gu, ""))
    .filter(Boolean);
  const directPartsWithErhua = directParts.map((part) => (part === "r" ? "er" : part));
  if (directPartsWithErhua.length === partCount) {
    return directPartsWithErhua;
  }

  const compact = directPartsWithErhua.join("");
  if (!compact) {
    return directPartsWithErhua;
  }

  const segmented = segmentCompactPinyin(compact, partCount);
  if (segmented && segmented.length === partCount) {
    return segmented.map((part) => (part === "r" ? "er" : part));
  }

  if (directPartsWithErhua.length > partCount) {
    return directPartsWithErhua.slice(0, partCount);
  }

  return directPartsWithErhua;
}

function alignPinyinParts(phrase: string, pinyin: string): string[] {
  return alignPinyinPartsForCount(Array.from(phrase).length, pinyin);
}

function buildAdminMeaningKey(targetKey: string, meaningZh: string, meaningEn: string): string {
  return `${targetKey}||${meaningZh}||${meaningEn}`;
}

function normalizePhraseCompareKey(input: string): string {
  return input.trim().replace(/\s+/g, "");
}

function isPhraseIncludedInFillTest(phrase: FlashcardMeaningPhrase): boolean {
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

type FillTestCandidateRow = {
  phrase: string;
  example: string;
};

function buildFillTestFromSavedContent(contentEntries: FlashcardLlmResponse[]): FillTest | undefined {
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
  const optionPhrases = shuffleArray(sentenceRows.map((item) => item.phrase)) as [
    string,
    string,
    string,
  ];
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

function normalizeAdminDraftResponse(raw: unknown, request: FlashcardLlmRequest): FlashcardLlmResponse {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawMeanings = Array.isArray(source.meanings) ? source.meanings : [];
  const meanings: FlashcardLlmResponse["meanings"] = [];

  for (const meaningItem of rawMeanings) {
    if (!meaningItem || typeof meaningItem !== "object") {
      continue;
    }

    const meaningSource = meaningItem as Record<string, unknown>;
    const definition =
      typeof meaningSource.definition === "string" ? meaningSource.definition.trim() : "";
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

function renderPhraseWithPinyin(phrase: string, pinyin: string): ReactNode {
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

function renderSentenceWithPinyin(sentence: string, pinyin: string): ReactNode {
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

export default function WordsWorkspace({ page }: { page: WordsSectionPage }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [words, setWords] = useState<Word[]>([]);
  const [dueWords, setDueWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);

  const [hanzi, setHanzi] = useState("");
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [allWordsSortKey, setAllWordsSortKey] = useState<AllWordsSortKey>("createdAt");
  const [allWordsSortDirection, setAllWordsSortDirection] = useState<SortDirection>("desc");
  const [dueWordsSortKey, setDueWordsSortKey] = useState<DueWordsSortKey>("familiarity");
  const [dueWordsSortDirection, setDueWordsSortDirection] = useState<SortDirection>("asc");

  const [flashcardInProgress, setFlashcardInProgress] = useState(false);
  const [flashcardCompleted, setFlashcardCompleted] = useState(false);
  const [flashcardQueue, setFlashcardQueue] = useState<Word[]>([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardRevealed, setFlashcardRevealed] = useState(false);
  const [flashcardSubmitting, setFlashcardSubmitting] = useState(false);
  const [flashcardHistory, setFlashcardHistory] = useState<FlashcardHistoryItem[]>([]);
  const [flashcardNotice, setFlashcardNotice] = useState<string | null>(null);
  const [flashcardLlmData, setFlashcardLlmData] = useState<FlashcardLlmResponseMap>({});
  const [flashcardLlmLoading, setFlashcardLlmLoading] = useState(false);
  const [flashcardLlmError, setFlashcardLlmError] = useState<string | null>(null);

  const [quizSelectionMode, setQuizSelectionMode] = useState<QuizSelectionMode>("all");
  const [manualSelectedWordIds, setManualSelectedWordIds] = useState<string[]>([]);
  const [quizInProgress, setQuizInProgress] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizQueue, setQuizQueue] = useState<TestableWord[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelections, setQuizSelections] = useState<[0 | 1 | 2 | null, 0 | 1 | 2 | null, 0 | 1 | 2 | null]>([
    null,
    null,
    null,
  ]);
  const [quizResult, setQuizResult] = useState<FillResult | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>([]);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizNotice, setQuizNotice] = useState<string | null>(null);
  const [quizActivePhraseIndex, setQuizActivePhraseIndex] = useState<0 | 1 | 2 | null>(null);
  const [quizDraggingPhraseIndex, setQuizDraggingPhraseIndex] = useState<0 | 1 | 2 | null>(null);
  const [quizDropSentenceIndex, setQuizDropSentenceIndex] = useState<0 | 1 | 2 | null>(null);
  const [adminTargets, setAdminTargets] = useState<AdminTarget[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const [adminJsonByKey, setAdminJsonByKey] = useState<Record<string, string>>({});
  const [, setAdminSavedByKey] = useState<Record<string, boolean>>({});
  const [adminPreloading, setAdminPreloading] = useState(false);
  const [adminProgressText, setAdminProgressText] = useState<string | null>(null);
  const [adminRegeneratingKey, setAdminRegeneratingKey] = useState<string | null>(null);
  const [adminSavingKey, setAdminSavingKey] = useState<string | null>(null);
  const [adminDeletingKey, setAdminDeletingKey] = useState<string | null>(null);
  const [adminPendingPhrases, setAdminPendingPhrases] = useState<AdminPendingPhrase[]>([]);
  const [adminPendingMeanings, setAdminPendingMeanings] = useState<AdminPendingMeaning[]>([]);
  const [adminEditingExampleRowKey, setAdminEditingExampleRowKey] = useState<string | null>(null);
  const [adminStatsFilter, setAdminStatsFilter] = useState<AdminStatsFilter>("targets");

  const isDueReviewPage = page === "review";
  const isFlashcardReviewPage = page === "flashcard";
  const isFillTestReviewPage = page === "fillTest";
  const activeMenuPage: NavPage = isFlashcardReviewPage || isFillTestReviewPage ? "review" : page;
  const requestedReviewWordId = searchParams.get("wordId");

  const fillTestDueWords = useMemo(() => dueWords.filter(hasFillTest), [dueWords]);
  const skippedDueCount = dueWords.length - fillTestDueWords.length;
  const manualSelectionSet = useMemo(() => new Set(manualSelectedWordIds), [manualSelectedWordIds]);

  const plannedQuizWords = useMemo(() => {
    if (quizSelectionMode === "manual") {
      return fillTestDueWords.filter((word) => manualSelectionSet.has(word.id));
    }

    if (quizSelectionMode === "all") {
      return fillTestDueWords;
    }

    const limit = Number(quizSelectionMode);
    return fillTestDueWords.slice(0, Math.max(0, limit));
  }, [fillTestDueWords, manualSelectionSet, quizSelectionMode]);

  const currentFlashcardWord = flashcardInProgress ? flashcardQueue[flashcardIndex] : undefined;
  const currentQuizWord = quizInProgress ? quizQueue[quizIndex] : undefined;
  const unansweredCount = quizSelections.filter((selection) => selection === null).length;
  const {
    data: flashcardInfo,
    loading: flashcardInfoLoading,
    error: flashcardInfoError,
  } = useXinhuaFlashcardInfo(currentFlashcardWord?.hanzi ?? "", { includeAllMatches: true });

  const flashcardLlmRequests = useMemo<FlashcardLlmRequest[]>(() => {
    if (!currentFlashcardWord || !flashcardInfo) {
      return [];
    }

    return flashcardInfo.pronunciations
      .map((entry) => entry.pinyin.trim())
      .filter(Boolean)
      .map((pronunciation) => ({
        character: currentFlashcardWord.hanzi,
        pronunciation,
      }));
  }, [currentFlashcardWord, flashcardInfo]);

  const quizSummary = useMemo(() => {
    return quizHistory.reduce(
      (accumulator, item) => {
        accumulator[item.tier] += 1;
        accumulator.correct += item.correctCount;
        return accumulator;
      },
      { again: 0, hard: 0, good: 0, easy: 0, correct: 0 }
    );
  }, [quizHistory]);

  const flashcardSummary = useMemo(() => {
    return flashcardHistory.reduce(
      (accumulator, item) => {
        accumulator[item.grade] += 1;
        return accumulator;
      },
      { again: 0, hard: 0, good: 0, easy: 0 }
    );
  }, [flashcardHistory]);

  const allWordsSummary = useMemo(() => {
    const totalWords = words.length;
    const totalReviewed = words.reduce((sum, word) => sum + getReviewCount(word), 0);
    const totalTested = words.reduce((sum, word) => sum + getTestCount(word), 0);
    const averageFamiliarity =
      totalWords === 0
        ? 0
        : words.reduce((sum, word) => sum + getMemorizationProbability(word), 0) / totalWords;

    return {
      totalWords,
      dueNow: dueWords.length,
      totalReviewed,
      totalTested,
      averageFamiliarity,
    };
  }, [dueWords.length, words]);

  const sortedAllWords = useMemo(() => {
    const now = Date.now();
    const prepared = words.map((word) => ({
      word,
      reviewCount: getReviewCount(word),
      testCount: getTestCount(word),
      familiarity: getMemorizationProbability(word, now),
    }));

    prepared.sort((left, right) => {
      let comparison = 0;
      switch (allWordsSortKey) {
        case "hanzi":
          comparison = left.word.hanzi.localeCompare(right.word.hanzi, "zh-Hans-CN");
          break;
        case "createdAt":
          comparison = left.word.createdAt - right.word.createdAt;
          break;
        case "nextReviewAt":
          comparison = (left.word.nextReviewAt || 0) - (right.word.nextReviewAt || 0);
          break;
        case "reviewCount":
          comparison = left.reviewCount - right.reviewCount;
          break;
        case "testCount":
          comparison = left.testCount - right.testCount;
          break;
        case "familiarity":
          comparison = left.familiarity - right.familiarity;
          break;
        default:
          comparison = 0;
      }

      if (comparison === 0) {
        return left.word.createdAt - right.word.createdAt;
      }

      return allWordsSortDirection === "asc" ? comparison : -comparison;
    });

    return prepared;
  }, [allWordsSortDirection, allWordsSortKey, words]);

  const sortedDueWords = useMemo(() => {
    const now = Date.now();
    const prepared = dueWords.map((word) => ({
      word,
      familiarity: getMemorizationProbability(word, now),
    }));

    prepared.sort((left, right) => {
      let comparison = 0;
      switch (dueWordsSortKey) {
        case "hanzi":
          comparison = left.word.hanzi.localeCompare(right.word.hanzi, "zh-Hans-CN");
          break;
        case "nextReviewAt":
          comparison = (left.word.nextReviewAt || 0) - (right.word.nextReviewAt || 0);
          break;
        case "familiarity":
          comparison = left.familiarity - right.familiarity;
          break;
        default:
          comparison = 0;
      }

      if (comparison === 0) {
        return left.word.createdAt - right.word.createdAt;
      }

      return dueWordsSortDirection === "asc" ? comparison : -comparison;
    });

    return prepared;
  }, [dueWords, dueWordsSortDirection, dueWordsSortKey]);

  const adminContentStats = useMemo(() => {
    const targetStatusByKey: Record<string, AdminTargetContentStatus> = {};
    let targetsWithContent = 0;
    let targetsReadyForTesting = 0;
    let targetsExcludedForTesting = 0;

    for (const target of adminTargets) {
      const raw = adminJsonByKey[target.key];
      let normalized: FlashcardLlmResponse = {
        character: target.character,
        pronunciation: target.pronunciation,
        meanings: [],
      };
      if (raw && raw.trim()) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          normalized = normalizeAdminDraftResponse(parsed, {
            character: target.character,
            pronunciation: target.pronunciation,
          });
        } catch {
          // Keep empty fallback to treat parse failures as no content.
        }
      }

      let hasAnyPhrase = false;
      let hasIncludedPhrase = false;
      for (const meaning of normalized.meanings) {
        for (const phraseItem of meaning.phrases) {
          hasAnyPhrase = true;
          if (isPhraseIncludedInFillTest(phraseItem)) {
            hasIncludedPhrase = true;
          }
        }
      }

      if (!hasAnyPhrase) {
        targetStatusByKey[target.key] = "missing_content";
        continue;
      }

      targetsWithContent += 1;
      if (hasIncludedPhrase) {
        targetStatusByKey[target.key] = "ready_for_testing";
        targetsReadyForTesting += 1;
      } else {
        targetStatusByKey[target.key] = "excluded_for_testing";
        targetsExcludedForTesting += 1;
      }
    }

    return {
      targetStatusByKey,
      targetsWithContent,
      targetsMissingContent: Math.max(0, adminTargets.length - targetsWithContent),
      targetsReadyForTesting,
      targetsExcludedForTesting,
    };
  }, [adminJsonByKey, adminTargets]);
  const adminTargetsWithContentCount = adminContentStats.targetsWithContent;
  const adminMissingCount = adminContentStats.targetsMissingContent;
  const adminTargetsReadyForTestingCount = adminContentStats.targetsReadyForTesting;
  const adminTargetsExcludedForTestingCount = adminContentStats.targetsExcludedForTesting;
  const adminUniqueCharacterCount = useMemo(
    () => new Set(adminTargets.map((target) => target.character)).size,
    [adminTargets]
  );
  const adminVisibleTargets = useMemo(
    () => {
      if (adminStatsFilter === "characters" || adminStatsFilter === "targets") {
        return adminTargets;
      }

      return adminTargets.filter((target) => {
        const status = adminContentStats.targetStatusByKey[target.key] ?? "missing_content";
        if (adminStatsFilter === "with_content") {
          return status !== "missing_content";
        }
        if (adminStatsFilter === "missing_content") {
          return status === "missing_content";
        }
        if (adminStatsFilter === "ready_for_testing") {
          return status === "ready_for_testing";
        }
        return status === "excluded_for_testing";
      });
    },
    [adminContentStats.targetStatusByKey, adminStatsFilter, adminTargets]
  );
  const adminPendingByMeaningKey = useMemo(() => {
    const map = new Map<string, AdminPendingPhrase[]>();
    for (const item of adminPendingPhrases) {
      const key = buildAdminMeaningKey(item.targetKey, item.meaningZh, item.meaningEn);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [adminPendingPhrases]);
  const adminPendingMeaningsByTargetKey = useMemo(() => {
    const map = new Map<string, AdminPendingMeaning[]>();
    for (const item of adminPendingMeanings) {
      const list = map.get(item.targetKey) ?? [];
      list.push(item);
      map.set(item.targetKey, list);
    }
    return map;
  }, [adminPendingMeanings]);
  const adminTableRows = useMemo<AdminTableRow[]>(() => {
    const rows: AdminTableRow[] = [];

    for (const target of adminVisibleTargets) {
      const raw = adminJsonByKey[target.key];
      let normalized: FlashcardLlmResponse = {
        character: target.character,
        pronunciation: target.pronunciation,
        meanings: [],
      };
      if (raw && raw.trim()) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          normalized = normalizeAdminDraftResponse(parsed, {
            character: target.character,
            pronunciation: target.pronunciation,
          });
        } catch {
          // Keep empty fallback row so target stays visible in admin table.
        }
      }
      let hasRowsForTarget = false;

      for (let meaningIndex = 0; meaningIndex < normalized.meanings.length; meaningIndex += 1) {
        const meaning = normalized.meanings[meaningIndex];
        const meaningZh = meaning.definition.trim();
        const meaningEn = (meaning.definition_en ?? "").trim();

        for (let phraseIndex = 0; phraseIndex < meaning.phrases.length; phraseIndex += 1) {
          const phraseItem = meaning.phrases[phraseIndex];
          const phrase = phraseItem.phrase.trim();
          const phrasePinyin = phraseItem.pinyin.trim();
          const example = phraseItem.example.trim();
          const examplePinyin = (phraseItem.example_pinyin ?? "").trim();

          const rowKey = `existing||${target.key}||${meaningIndex}||${phraseIndex}`;
          rows.push({
            rowKey,
            targetKey: target.key,
            rowType: "existing",
            pendingId: null,
            character: normalized.character,
            pronunciation: normalized.pronunciation,
            meaningZh,
            meaningEn,
            phrase,
            phrasePinyin,
            example,
            examplePinyin,
            includeInFillTest: isPhraseIncludedInFillTest(phraseItem),
          });
          hasRowsForTarget = true;
        }

        const pendingItems =
          adminPendingByMeaningKey.get(buildAdminMeaningKey(target.key, meaningZh, meaningEn)) ?? [];
        for (const pending of pendingItems) {
          const pendingRowKey = `pending||${pending.id}`;
          rows.push({
            rowKey: pendingRowKey,
            targetKey: target.key,
            rowType: "pending_phrase",
            pendingId: pending.id,
            character: normalized.character,
            pronunciation: normalized.pronunciation,
            meaningZh,
            meaningEn,
            phrase: pending.phraseInput,
            phrasePinyin: "",
            example: "",
            examplePinyin: "",
            includeInFillTest: true,
          });
          hasRowsForTarget = true;
        }
      }

      const pendingMeaningItems = adminPendingMeaningsByTargetKey.get(target.key) ?? [];
      for (const pendingMeaning of pendingMeaningItems) {
        rows.push({
          rowKey: `pending-meaning||${pendingMeaning.id}`,
          targetKey: target.key,
          rowType: "pending_meaning",
          pendingId: pendingMeaning.id,
          character: normalized.character,
          pronunciation: normalized.pronunciation,
          meaningZh: pendingMeaning.meaningZhInput,
          meaningEn: "",
          phrase: pendingMeaning.phraseInput,
          phrasePinyin: "",
          example: pendingMeaning.exampleInput,
          examplePinyin: "",
          includeInFillTest: true,
        });
        hasRowsForTarget = true;
      }

      if (!hasRowsForTarget) {
        rows.push({
          rowKey: `empty||${target.key}`,
          targetKey: target.key,
          rowType: "empty_target",
          pendingId: null,
          character: normalized.character,
          pronunciation: normalized.pronunciation,
          meaningZh: "",
          meaningEn: "",
          phrase: "",
          phrasePinyin: "",
          example: "",
          examplePinyin: "",
          includeInFillTest: true,
        });
      }
    }

    return rows;
  }, [adminJsonByKey, adminPendingByMeaningKey, adminPendingMeaningsByTargetKey, adminVisibleTargets]);
  const adminTableRenderRows = useMemo<AdminTableRenderRow[]>(() => {
    if (adminTableRows.length === 0) {
      return [];
    }

    const characterGroupSpans = new Map<number, number>();
    const meaningGroupSpans = new Map<number, number>();

    let index = 0;
    while (index < adminTableRows.length) {
      const groupKey = `${adminTableRows[index].character}||${adminTableRows[index].pronunciation}`;
      let end = index + 1;
      while (
        end < adminTableRows.length &&
        `${adminTableRows[end].character}||${adminTableRows[end].pronunciation}` === groupKey
      ) {
        end += 1;
      }

      characterGroupSpans.set(index, end - index);
      index = end;
    }

    index = 0;
    while (index < adminTableRows.length) {
      const groupKey = [
        adminTableRows[index].character,
        adminTableRows[index].pronunciation,
        adminTableRows[index].meaningZh,
        adminTableRows[index].meaningEn,
        adminTableRows[index].rowType,
        adminTableRows[index].pendingId ?? "",
      ].join("||");
      let end = index + 1;
      while (
        end < adminTableRows.length &&
        [
          adminTableRows[end].character,
          adminTableRows[end].pronunciation,
          adminTableRows[end].meaningZh,
          adminTableRows[end].meaningEn,
          adminTableRows[end].rowType,
          adminTableRows[end].pendingId ?? "",
        ].join("||") === groupKey
      ) {
        end += 1;
      }

      meaningGroupSpans.set(index, end - index);
      index = end;
    }

    return adminTableRows.map((row, rowIndex) => ({
      ...row,
      showCharacterCell: characterGroupSpans.has(rowIndex),
      characterRowSpan: characterGroupSpans.get(rowIndex) ?? 0,
      showMeaningCell: meaningGroupSpans.has(rowIndex),
      meaningRowSpan: meaningGroupSpans.get(rowIndex) ?? 0,
    }));
  }, [adminTableRows]);
  const adminTargetByKey = useMemo(() => {
    const map = new Map<string, AdminTarget>();
    for (const target of adminTargets) {
      map.set(target.key, target);
    }
    return map;
  }, [adminTargets]);

  useEffect(() => {
    const validTargetKeys = new Set(adminTargets.map((target) => target.key));
    setAdminPendingPhrases((previous) =>
      previous.filter((item) => validTargetKeys.has(item.targetKey))
    );
    setAdminPendingMeanings((previous) =>
      previous.filter((item) => validTargetKeys.has(item.targetKey))
    );
  }, [adminTargets]);

  useEffect(() => {
    if (!adminEditingExampleRowKey) {
      return;
    }

    if (!adminTableRows.some((row) => row.rowKey === adminEditingExampleRowKey)) {
      setAdminEditingExampleRowKey(null);
    }
  }, [adminEditingExampleRowKey, adminTableRows]);

  function isAdminStatsFilterActive(filter: AdminStatsFilter): boolean {
    return adminStatsFilter === filter;
  }

  function handleAdminStatsFilterClick(filter: AdminStatsFilter) {
    setAdminStatsFilter((previous) => {
      if (filter === "characters" || filter === "targets") {
        return filter;
      }
      return previous === filter ? "targets" : filter;
    });
  }

  function getAdminStatsCardClass(filter: AdminStatsFilter): string {
    return isAdminStatsFilterActive(filter)
      ? "admin-stats-card flex min-h-[70px] w-full flex-col items-center justify-center border border-black bg-gray-100 px-2 py-1.5 text-center"
      : "admin-stats-card flex min-h-[70px] w-full flex-col items-center justify-center border px-2 py-1.5 text-center";
  }

  const adminEmptyTableMessage = useMemo(() => {
    if (adminStatsFilter === "missing_content") {
      return "\u5df2\u65e0\u672a\u5b8c\u6210\u6761\u76ee / No missing targets.";
    }
    if (adminStatsFilter === "with_content") {
      return "\u6682\u65e0\u5df2\u5b8c\u6210\u6761\u76ee / No targets with content.";
    }
    if (adminStatsFilter === "ready_for_testing") {
      return "\u6682\u65e0\u5f55\u5165\u9898\u5e93\u6761\u76ee / No targets ready for testing.";
    }
    if (adminStatsFilter === "excluded_for_testing") {
      return "\u6682\u65e0\u4e0d\u5f55\u5165\u9898\u5e93\u6761\u76ee / No targets excluded for testing.";
    }
    return "\u6682\u65e0\u8868\u683c\u6570\u636e\uff08\u8bf7\u5148\u9884\u751f\u6210\u6216\u4fdd\u5b58\u5185\u5bb9\uff09 / No table data yet. Preload or save content first.";
  }, [adminStatsFilter]);

  function toggleAllWordsSort(nextKey: AllWordsSortKey) {
    if (allWordsSortKey === nextKey) {
      setAllWordsSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }

    setAllWordsSortKey(nextKey);
    setAllWordsSortDirection(nextKey === "hanzi" ? "asc" : "desc");
  }

  function toggleDueWordsSort(nextKey: DueWordsSortKey) {
    if (dueWordsSortKey === nextKey) {
      setDueWordsSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }

    setDueWordsSortKey(nextKey);
    setDueWordsSortDirection(nextKey === "hanzi" ? "asc" : "desc");
  }

  function getSortIndicator(key: AllWordsSortKey): string {
    if (allWordsSortKey !== key) {
      return "\u2195";
    }

    return allWordsSortDirection === "asc" ? "\u2191" : "\u2193";
  }

  function getDueSortIndicator(key: DueWordsSortKey): string {
    if (dueWordsSortKey !== key) {
      return "\u2195";
    }

    return dueWordsSortDirection === "asc" ? "\u2191" : "\u2193";
  }

  function clearForm() {
    setHanzi("");
  }

  function resetFlashcardWordState() {
    setFlashcardRevealed(false);
    setFlashcardLlmLoading(false);
    setFlashcardLlmError(null);
  }

  function stopFlashcardSession() {
    setFlashcardInProgress(false);
    setFlashcardQueue([]);
    setFlashcardIndex(0);
    resetFlashcardWordState();
  }

  async function handleStopFlashcardSession() {
    stopFlashcardSession();
    if (isFlashcardReviewPage) {
      await refreshAll();
      router.push("/words/review");
      return;
    }
    setFlashcardNotice("\u95ea\u5361\u590d\u4e60\u5df2\u505c\u6b62 / Flashcard review stopped.");
    await refreshAll();
  }

  function resetQuizWordState() {
    setQuizSelections([null, null, null]);
    setQuizResult(null);
    setQuizActivePhraseIndex(null);
    setQuizDraggingPhraseIndex(null);
    setQuizDropSentenceIndex(null);
  }

  function stopQuizSession() {
    setQuizInProgress(false);
    setQuizQueue([]);
    setQuizIndex(0);
    resetQuizWordState();
  }

  async function handleStopQuizSession() {
    stopQuizSession();
    if (isFillTestReviewPage) {
      await refreshAll();
      router.push("/words/review");
      return;
    }
    setQuizNotice("\u586b\u7a7a\u6d4b\u8bd5\u5df2\u505c\u6b62 / Fill-test quiz stopped.");
    await refreshAll();
  }

  const refreshWords = useCallback(async () => {
    const all = await db.words.orderBy("createdAt").reverse().toArray();
    setWords(all);
  }, []);

  const refreshDueWords = useCallback(async () => {
    const due = await getDueWords();
    const sortedDue = due.sort((left, right) => {
      const leftDue = left.nextReviewAt || 0;
      const rightDue = right.nextReviewAt || 0;
      if (leftDue === rightDue) {
        return left.createdAt - right.createdAt;
      }

      return leftDue - rightDue;
    });

    const allSavedContentEntries = await getAllFlashcardContents();
    const contentByCharacter = new Map<string, FlashcardLlmResponse[]>();
    for (const entry of allSavedContentEntries) {
      const list = contentByCharacter.get(entry.character) ?? [];
      list.push(entry.content);
      contentByCharacter.set(entry.character, list);
    }

    const dueWithFillTests = sortedDue.map((word) => {
      const generated = buildFillTestFromSavedContent(contentByCharacter.get(word.hanzi) ?? []);
      if (generated) {
        return {
          ...word,
          fillTest: generated,
        };
      }

      if (word.fillTest) {
        return {
          ...word,
          fillTest: cloneFillTest(word.fillTest),
        };
      }

      return {
        ...word,
        fillTest: undefined,
      };
    });

    setDueWords(dueWithFillTests);
    setManualSelectedWordIds((previous) =>
      previous.filter((id) => dueWithFillTests.some((word) => word.id === id && hasFillTest(word)))
    );
    return dueWithFillTests;
  }, []);

  const refreshAll = useCallback(async () => {
    await refreshWords();
    await refreshDueWords();
  }, [refreshDueWords, refreshWords]);

  useEffect(() => {
    (async () => {
      await refreshAll();
      setLoading(false);
    })();
  }, [refreshAll]);

  async function requestFlashcardGeneration(payloadBody: unknown): Promise<unknown> {
    const response = await fetch("/api/flashcard/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payloadBody),
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
          ? ((payload as { error: string }).error ?? "").trim()
          : "";
      throw new Error(message || `Generation failed (HTTP ${response.status}).`);
    }

    return payload;
  }

  async function requestGeneratedFlashcardContent(requestItem: FlashcardLlmRequest): Promise<FlashcardLlmResponse> {
    const payload = await requestFlashcardGeneration(requestItem);
    if (!isFlashcardLlmResponse(payload)) {
      throw new Error("Invalid generation response format.");
    }

    return normalizeFlashcardLlmResponse(payload, requestItem);
  }

  async function requestGeneratedPhraseContent(
    requestItem: FlashcardPhraseGenerationRequest
  ): Promise<FlashcardMeaningPhrase> {
    const payload = await requestFlashcardGeneration(requestItem);
    if (!isFlashcardPhraseGenerationResponse(payload)) {
      throw new Error("Invalid phrase generation response format.");
    }

    return {
      phrase: payload.phrase.trim(),
      pinyin: payload.pinyin.trim(),
      example: payload.example.trim(),
      example_pinyin: payload.example_pinyin.trim(),
    };
  }

  async function requestGeneratedExampleContent(
    requestItem: FlashcardExampleGenerationRequest
  ): Promise<FlashcardExampleGenerationResponse> {
    const payload = await requestFlashcardGeneration(requestItem);
    if (!isFlashcardExampleGenerationResponse(payload)) {
      throw new Error("Invalid example generation response format.");
    }

    return {
      example: payload.example.trim(),
      example_pinyin: payload.example_pinyin.trim(),
    };
  }

  async function requestGeneratedPhraseDetailContent(
    requestItem: FlashcardPhraseDetailGenerationRequest
  ): Promise<FlashcardPhraseDetailGenerationResponse> {
    const payload = await requestFlashcardGeneration(requestItem);
    if (!isFlashcardPhraseDetailGenerationResponse(payload)) {
      throw new Error("Invalid phrase detail generation response format.");
    }

    return {
      pinyin: payload.pinyin.trim(),
      example: payload.example.trim(),
      example_pinyin: payload.example_pinyin.trim(),
    };
  }

  async function requestGeneratedMeaningDetailContent(
    requestItem: FlashcardMeaningDetailGenerationRequest
  ): Promise<FlashcardMeaningDetailGenerationResponse> {
    const payload = await requestFlashcardGeneration(requestItem);
    if (!isFlashcardMeaningDetailGenerationResponse(payload)) {
      throw new Error("Invalid meaning detail generation response format.");
    }

    return {
      definition_en: payload.definition_en.trim(),
    };
  }

  async function requestGeneratedExamplePinyinContent(
    requestItem: FlashcardExamplePinyinGenerationRequest
  ): Promise<string> {
    const payload = await requestFlashcardGeneration(requestItem);
    if (!isFlashcardExamplePinyinGenerationResponse(payload)) {
      throw new Error("Invalid example pinyin generation response format.");
    }

    return payload.example_pinyin.trim();
  }

  async function generateExamplePinyin(params: {
    target: AdminTarget;
    meaning: string;
    meaningEn?: string;
    phrase: string;
    example: string;
  }): Promise<string> {
    return requestGeneratedExamplePinyinContent({
      mode: "example_pinyin",
      character: params.target.character,
      pronunciation: params.target.pronunciation,
      meaning: params.meaning,
      meaning_en: params.meaningEn,
      phrase: params.phrase,
      example: params.example,
    });
  }

  function updateAdminJson(key: string, value: string) {
    setAdminJsonByKey((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function showAdminManualEditPopup(message: string) {
    const fullMessage = `${message}\n请手动添加/删除后再试。 / Please manually add/delete and try again.`;
    setAdminNotice(fullMessage);
    if (typeof window !== "undefined") {
      window.alert(fullMessage);
    }
  }

  function readAdminDraft(target: AdminTarget): FlashcardLlmResponse {
    const raw = adminJsonByKey[target.key];
    if (!raw || !raw.trim()) {
      throw new Error("No draft content. Regenerate first.");
    }

    const parsed = JSON.parse(raw) as unknown;
    return normalizeAdminDraftResponse(parsed, {
      character: target.character,
      pronunciation: target.pronunciation,
    });
  }

  function writeAdminDraft(target: AdminTarget, content: FlashcardLlmResponse) {
    const normalized = normalizeAdminDraftResponse(content, {
      character: target.character,
      pronunciation: target.pronunciation,
    });

    updateAdminJson(target.key, JSON.stringify(normalized, null, 2));
    setAdminSavedByKey((previous) => ({
      ...previous,
      [target.key]: false,
    }));
    setFlashcardLlmData((previous) => ({
      ...previous,
      [target.key]: normalized,
    }));
  }

  function findAdminPhraseLocation(
    content: FlashcardLlmResponse,
    row: AdminTableRow
  ): AdminPhraseLocation | null {
    for (let meaningIndex = 0; meaningIndex < content.meanings.length; meaningIndex += 1) {
      const meaning = content.meanings[meaningIndex];
      if (
        meaning.definition.trim() !== row.meaningZh ||
        (meaning.definition_en ?? "").trim() !== row.meaningEn
      ) {
        continue;
      }

      for (let phraseIndex = 0; phraseIndex < meaning.phrases.length; phraseIndex += 1) {
        const phraseItem = meaning.phrases[phraseIndex];
        if (
          phraseItem.phrase.trim() === row.phrase &&
          phraseItem.pinyin.trim() === row.phrasePinyin &&
          phraseItem.example.trim() === row.example &&
          (phraseItem.example_pinyin ?? "").trim() === row.examplePinyin
        ) {
          return {
            meaningIndex,
            phraseIndex,
          };
        }
      }
    }

    return null;
  }

  function upsertAdminDraft(target: AdminTarget, content: FlashcardLlmResponse, saved: boolean) {
    const normalized = normalizeAdminDraftResponse(content, {
      character: target.character,
      pronunciation: target.pronunciation,
    });
    updateAdminJson(target.key, JSON.stringify(normalized, null, 2));
    setFlashcardLlmData((previous) => ({
      ...previous,
      [target.key]: normalized,
    }));
    setAdminSavedByKey((previous) => ({
      ...previous,
      [target.key]: saved,
    }));
  }

  function handleAdminAddPhraseRow(targetKey: string, meaningZh: string, meaningEn: string) {
    setAdminPendingPhrases((previous) => [
      ...previous,
      {
        id: makeId(),
        targetKey,
        meaningZh,
        meaningEn,
        phraseInput: "",
      },
    ]);
  }

  function handleAdminAddMeaningRow(targetKey: string) {
    setAdminPendingMeanings((previous) => [
      ...previous,
      {
        id: makeId(),
        targetKey,
        meaningZhInput: "",
        phraseInput: "",
        exampleInput: "",
      },
    ]);
  }

  function updateAdminPendingPhraseInput(pendingId: string, value: string) {
    setAdminPendingPhrases((previous) =>
      previous.map((item) =>
        item.id === pendingId
          ? {
              ...item,
              phraseInput: value,
            }
          : item
      )
    );
  }

  function removeAdminPendingPhrase(pendingId: string) {
    setAdminPendingPhrases((previous) => previous.filter((item) => item.id !== pendingId));
  }

  function updateAdminPendingMeaningInput(
    pendingId: string,
    field: "meaningZhInput" | "phraseInput" | "exampleInput",
    value: string
  ) {
    setAdminPendingMeanings((previous) =>
      previous.map((item) =>
        item.id === pendingId
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  function removeAdminPendingMeaning(pendingId: string) {
    setAdminPendingMeanings((previous) => previous.filter((item) => item.id !== pendingId));
  }

  async function handleAdminSavePendingPhrase(row: AdminTableRow) {
    if (row.rowType !== "pending_phrase" || !row.pendingId) {
      return;
    }

    const target = adminTargetByKey.get(row.targetKey);
    if (!target) {
      setAdminNotice("Missing admin target for the new phrase row.");
      return;
    }

    const pending = adminPendingPhrases.find((item) => item.id === row.pendingId);
    if (!pending) {
      setAdminNotice("Phrase draft not found.");
      return;
    }

    const phrase = pending.phraseInput.trim();
    if (!phrase) {
      setAdminNotice("请输入词组后再保存 / Enter a phrase before saving.");
      return;
    }

    if (!phrase.includes(target.character)) {
      setAdminNotice(`词组需包含汉字 "${target.character}" / Phrase must include ${target.character}.`);
      return;
    }

    setAdminSavingKey(target.key);
    setAdminNotice(null);

    try {
      const nextDraft = cloneFlashcardLlmResponse(readAdminDraft(target));
      const meaningIndex = nextDraft.meanings.findIndex(
        (item) =>
          item.definition.trim() === row.meaningZh &&
          (item.definition_en ?? "").trim() === row.meaningEn
      );
      if (meaningIndex < 0) {
        throw new Error("Meaning row not found in current draft.");
      }

      const meaning = nextDraft.meanings[meaningIndex];
      const phraseKey = normalizePhraseCompareKey(phrase);
      const hasSamePhrase = meaning.phrases.some(
        (item) => normalizePhraseCompareKey(item.phrase) === phraseKey
      );
      if (hasSamePhrase) {
        throw new Error("This phrase already exists for the selected meaning.");
      }

      const generatedDetails = await requestGeneratedPhraseDetailContent({
        mode: "phrase_details",
        character: target.character,
        pronunciation: target.pronunciation,
        meaning: meaning.definition,
        meaning_en: meaning.definition_en,
        phrase,
        existing_examples: meaning.phrases
          .map((item) => item.example.trim())
          .filter(Boolean),
      });
      const generatedExamplePinyin = await generateExamplePinyin({
        target,
        meaning: meaning.definition,
        meaningEn: meaning.definition_en,
        phrase,
        example: generatedDetails.example,
      });

      meaning.phrases.push({
        phrase,
        pinyin: generatedDetails.pinyin,
        example: generatedDetails.example,
        example_pinyin: generatedExamplePinyin,
      });

      const normalized = normalizeAdminDraftResponse(nextDraft, {
        character: target.character,
        pronunciation: target.pronunciation,
      });
      await putFlashcardContent(target.character, target.pronunciation, normalized);
      upsertAdminDraft(target, normalized, true);
      removeAdminPendingPhrase(row.pendingId);
      setAdminNotice(`Added and saved phrase for ${target.character} / ${target.pronunciation}.`);
    } catch (error) {
      const message = getErrorMessage(error, "Failed to add phrase.");
      showAdminManualEditPopup(message);
    } finally {
      setAdminSavingKey(null);
    }
  }

  async function handleAdminSavePendingMeaning(row: AdminTableRow) {
    if (row.rowType !== "pending_meaning" || !row.pendingId) {
      return;
    }

    const target = adminTargetByKey.get(row.targetKey);
    if (!target) {
      setAdminNotice("Missing admin target for the new meaning row.");
      return;
    }

    const pending = adminPendingMeanings.find((item) => item.id === row.pendingId);
    if (!pending) {
      setAdminNotice("Meaning draft not found.");
      return;
    }

    const meaningZh = pending.meaningZhInput.trim();
    if (!meaningZh) {
      setAdminNotice("请输入释义后再保存 / Enter meaning before saving.");
      return;
    }

    const phrase = pending.phraseInput.trim();
    if (!phrase) {
      setAdminNotice("请输入词组后再保存 / Enter a phrase before saving.");
      return;
    }

    if (!phrase.includes(target.character)) {
      setAdminNotice(`词组需包含汉字 "${target.character}" / Phrase must include ${target.character}.`);
      return;
    }

    const example = pending.exampleInput.trim();
    if (!example) {
      setAdminNotice("请输入例句后再保存 / Enter an example before saving.");
      return;
    }

    if (!example.includes(phrase)) {
      setAdminNotice("例句需包含词组 / Example must include the phrase.");
      return;
    }

    setAdminSavingKey(target.key);
    setAdminNotice(null);

    try {
      const nextDraft = cloneFlashcardLlmResponse(readAdminDraft(target));
      const hasSameMeaning = nextDraft.meanings.some(
        (item) => item.definition.trim() === meaningZh
      );
      if (hasSameMeaning) {
        throw new Error("This meaning already exists.");
      }

      const phraseKey = normalizePhraseCompareKey(phrase);
      const hasSamePhrase = nextDraft.meanings.some((item) =>
        item.phrases.some((phraseItem) => normalizePhraseCompareKey(phraseItem.phrase) === phraseKey)
      );
      if (hasSamePhrase) {
        throw new Error("This phrase already exists.");
      }

      const generatedMeaningDetail = await requestGeneratedMeaningDetailContent({
        mode: "meaning_details",
        character: target.character,
        pronunciation: target.pronunciation,
        meaning: meaningZh,
      });

      const generatedPhraseDetail = await requestGeneratedPhraseDetailContent({
        mode: "phrase_details",
        character: target.character,
        pronunciation: target.pronunciation,
        meaning: meaningZh,
        meaning_en: generatedMeaningDetail.definition_en,
        phrase,
        existing_examples: [],
      });

      const generatedExamplePinyin = await generateExamplePinyin({
        target,
        meaning: meaningZh,
        meaningEn: generatedMeaningDetail.definition_en,
        phrase,
        example,
      });

      nextDraft.meanings.push({
        definition: meaningZh,
        definition_en: generatedMeaningDetail.definition_en,
        phrases: [
          {
            phrase,
            pinyin: generatedPhraseDetail.pinyin,
            example,
            example_pinyin: generatedExamplePinyin,
          },
        ],
      });

      const normalized = normalizeAdminDraftResponse(nextDraft, {
        character: target.character,
        pronunciation: target.pronunciation,
      });
      await putFlashcardContent(target.character, target.pronunciation, normalized);
      upsertAdminDraft(target, normalized, true);
      removeAdminPendingMeaning(row.pendingId);
      setAdminNotice(`Added and saved meaning for ${target.character} / ${target.pronunciation}.`);
    } catch (error) {
      const message = getErrorMessage(error, "Failed to add meaning.");
      setAdminNotice(message);
    } finally {
      setAdminSavingKey(null);
    }
  }

  async function handleAdminRegenerate(target: AdminTarget) {
    setAdminRegeneratingKey(target.key);
    setAdminNotice(null);

    try {
      const generated = await requestGeneratedFlashcardContent({
        character: target.character,
        pronunciation: target.pronunciation,
      });

      writeAdminDraft(target, generated);
      setAdminNotice(`Regenerated ${target.character} / ${target.pronunciation}. Review and save if suitable.`);
    } catch (error) {
      setAdminNotice(getErrorMessage(error, "Regenerate failed."));
    } finally {
      setAdminRegeneratingKey(null);
    }
  }

  async function handleAdminSave(target: AdminTarget) {
    const raw = adminJsonByKey[target.key];
    if (!raw || !raw.trim()) {
      setAdminNotice("Cannot save empty JSON.");
      return;
    }

    setAdminSavingKey(target.key);
    setAdminNotice(null);

    try {
      const parsed = JSON.parse(raw) as unknown;
      const normalized = normalizeAdminDraftResponse(parsed, {
        character: target.character,
        pronunciation: target.pronunciation,
      });

      if (normalized.meanings.length === 0) {
        throw new Error("No valid meanings after normalization. Please adjust content.");
      }

      const editingRow =
        adminEditingExampleRowKey === null
          ? null
          : adminTableRows.find(
              (row) =>
                row.rowKey === adminEditingExampleRowKey &&
                row.targetKey === target.key &&
                row.rowType === "existing"
            ) ?? null;
      if (editingRow) {
        const location = findAdminPhraseLocation(normalized, editingRow);
        if (!location) {
          throw new Error("Edited example row not found in current draft.");
        }

        const meaning = normalized.meanings[location.meaningIndex];
        const phraseItem = meaning.phrases[location.phraseIndex];
        const example = phraseItem.example.trim();
        if (example) {
          phraseItem.example_pinyin = await generateExamplePinyin({
            target,
            meaning: meaning.definition,
            meaningEn: meaning.definition_en,
            phrase: phraseItem.phrase,
            example,
          });
        } else {
          phraseItem.example_pinyin = "";
        }
      }

      await putFlashcardContent(target.character, target.pronunciation, normalized);
      updateAdminJson(target.key, JSON.stringify(normalized, null, 2));
      setAdminSavedByKey((previous) => ({
        ...previous,
        [target.key]: true,
      }));
      setFlashcardLlmData((previous) => ({
        ...previous,
        [target.key]: normalized,
      }));
      setAdminEditingExampleRowKey(null);
      setAdminNotice(`Saved ${target.character} / ${target.pronunciation}.`);
    } catch (error) {
      setAdminNotice(getErrorMessage(error, "Save failed. Please verify JSON format."));
    } finally {
      setAdminSavingKey(null);
    }
  }

  async function handleAdminDeleteTarget(target: AdminTarget) {
    setAdminDeletingKey(target.key);
    setAdminNotice(null);

    try {
      await deleteFlashcardContent(target.character, target.pronunciation);
      updateAdminJson(target.key, "");
      setAdminPendingPhrases((previous) =>
        previous.filter((item) => item.targetKey !== target.key)
      );
      setAdminPendingMeanings((previous) =>
        previous.filter((item) => item.targetKey !== target.key)
      );
      setAdminSavedByKey((previous) => ({
        ...previous,
        [target.key]: false,
      }));
      setFlashcardLlmData((previous) => {
        const next = { ...previous };
        delete next[target.key];
        return next;
      });
      setAdminNotice(`Deleted saved content for ${target.character} / ${target.pronunciation}.`);
    } catch (error) {
      setAdminNotice(getErrorMessage(error, "Delete failed."));
    } finally {
      setAdminDeletingKey(null);
    }
  }

  async function handleAdminRegeneratePhrase(row: AdminTableRow) {
    const target = adminTargetByKey.get(row.targetKey);
    if (!target) {
      setAdminNotice("Missing admin target for phrase row.");
      return;
    }

    setAdminRegeneratingKey(target.key);
    setAdminNotice(null);

    try {
      const nextDraft = cloneFlashcardLlmResponse(readAdminDraft(target));
      const location = findAdminPhraseLocation(nextDraft, row);
      if (!location) {
        throw new Error("Phrase row not found in current draft.");
      }

      const meaning = nextDraft.meanings[location.meaningIndex];
      const existingMeaningPhrases = Array.from(
        new Set(
          meaning.phrases
            .map((item) => item.phrase.trim())
            .filter(Boolean)
        )
      );
      const blockedPhraseKeys = new Set(existingMeaningPhrases.map(normalizePhraseCompareKey));

      let regeneratedPhrase: FlashcardMeaningPhrase | null = null;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const candidate = await requestGeneratedPhraseContent({
          mode: "phrase",
          character: target.character,
          pronunciation: target.pronunciation,
          meaning: meaning.definition,
          meaning_en: meaning.definition_en,
          existing_phrases: existingMeaningPhrases,
        });

        const candidateKey = normalizePhraseCompareKey(candidate.phrase);
        if (!candidateKey || blockedPhraseKeys.has(candidateKey)) {
          continue;
        }

        regeneratedPhrase = candidate;
        break;
      }

      if (!regeneratedPhrase) {
        throw new Error("Could not generate a new unique phrase for this meaning.");
      }

      regeneratedPhrase.example_pinyin = await generateExamplePinyin({
        target,
        meaning: meaning.definition,
        meaningEn: meaning.definition_en,
        phrase: regeneratedPhrase.phrase,
        example: regeneratedPhrase.example,
      });

      meaning.phrases[location.phraseIndex] = regeneratedPhrase;
      writeAdminDraft(target, nextDraft);
      setAdminNotice(`Regenerated phrase for ${target.character} / ${target.pronunciation}.`);
    } catch (error) {
      const message = getErrorMessage(error, "Phrase regenerate failed.");
      if (shouldShowManualEditPopup(message)) {
        showAdminManualEditPopup(message);
      } else {
        setAdminNotice(message);
      }
    } finally {
      setAdminRegeneratingKey(null);
    }
  }

  async function handleAdminRegenerateExample(row: AdminTableRow) {
    const target = adminTargetByKey.get(row.targetKey);
    if (!target) {
      setAdminNotice("Missing admin target for example row.");
      return;
    }

    setAdminRegeneratingKey(target.key);
    setAdminNotice(null);

    try {
      const nextDraft = cloneFlashcardLlmResponse(readAdminDraft(target));
      const location = findAdminPhraseLocation(nextDraft, row);
      if (!location) {
        throw new Error("Example row not found in current draft.");
      }

      const meaning = nextDraft.meanings[location.meaningIndex];
      const phraseItem = meaning.phrases[location.phraseIndex];
      const existingExamples = Array.from(
        new Set(
          meaning.phrases
            .map((item) => item.example.trim())
            .filter(Boolean)
        )
      );

      const regeneratedExample = await requestGeneratedExampleContent({
        mode: "example",
        character: target.character,
        pronunciation: target.pronunciation,
        meaning: meaning.definition,
        meaning_en: meaning.definition_en,
        phrase: phraseItem.phrase,
        existing_examples: existingExamples,
      });

      phraseItem.example = regeneratedExample.example;
      phraseItem.example_pinyin = regeneratedExample.example_pinyin;
      writeAdminDraft(target, nextDraft);
      setAdminNotice(`Regenerated example for ${target.character} / ${target.pronunciation}.`);
    } catch (error) {
      const message = getErrorMessage(error, "Example regenerate failed.");
      if (shouldShowManualEditPopup(message)) {
        showAdminManualEditPopup(message);
      } else {
        setAdminNotice(message);
      }
    } finally {
      setAdminRegeneratingKey(null);
    }
  }

  function handleAdminEditExample(row: AdminTableRow) {
    const target = adminTargetByKey.get(row.targetKey);
    if (!target) {
      setAdminNotice("Missing admin target for example row.");
      return;
    }

    setAdminNotice(null);
    setAdminEditingExampleRowKey((previous) => (previous === row.rowKey ? null : row.rowKey));
  }

  async function handleAdminToggleFillTestInclude(row: AdminTableRow, includeInFillTest: boolean) {
    if (row.rowType !== "existing") {
      return;
    }

    const target = adminTargetByKey.get(row.targetKey);
    if (!target) {
      setAdminNotice("Missing admin target for fill-test toggle.");
      return;
    }

    setAdminSavingKey(target.key);
    setAdminNotice(null);

    try {
      const nextDraft = cloneFlashcardLlmResponse(readAdminDraft(target));
      const location = findAdminPhraseLocation(nextDraft, row);
      if (!location) {
        throw new Error("Fill-test row not found in current draft.");
      }

      const meaning = nextDraft.meanings[location.meaningIndex];
      const phraseItem = meaning.phrases[location.phraseIndex];
      phraseItem.include_in_fill_test = includeInFillTest;
      const normalized = normalizeAdminDraftResponse(nextDraft, {
        character: target.character,
        pronunciation: target.pronunciation,
      });
      await putFlashcardContent(target.character, target.pronunciation, normalized);
      upsertAdminDraft(target, normalized, true);
      setAdminNotice(
        `${includeInFillTest ? "Included" : "Excluded"} phrase row for fill test and saved.`
      );
    } catch (error) {
      setAdminNotice(getErrorMessage(error, "Failed to update fill-test row selection."));
    } finally {
      setAdminSavingKey(null);
    }
  }

  function handleAdminInlineEditExample(row: AdminTableRow, nextExample: string) {
    const target = adminTargetByKey.get(row.targetKey);
    if (!target) {
      setAdminNotice("Missing admin target for example row.");
      return;
    }

    try {
      if (nextExample === row.example) {
        return;
      }

      const nextDraft = cloneFlashcardLlmResponse(readAdminDraft(target));
      const location = findAdminPhraseLocation(nextDraft, row);
      if (!location) {
        throw new Error("Example row not found in current draft.");
      }

      const meaning = nextDraft.meanings[location.meaningIndex];
      meaning.phrases[location.phraseIndex].example = nextExample;
      meaning.phrases[location.phraseIndex].example_pinyin = "";
      writeAdminDraft(target, nextDraft);
    } catch (error) {
      setAdminNotice(getErrorMessage(error, "Example edit failed."));
    }
  }

  async function handleAdminDeletePhraseRow(row: AdminTableRow, scope: "phrase" | "example") {
    const target = adminTargetByKey.get(row.targetKey);
    if (!target) {
      setAdminNotice(`Missing admin target for ${scope} row.`);
      return;
    }

    setAdminDeletingKey(target.key);
    setAdminNotice(null);

    try {
      const nextDraft = cloneFlashcardLlmResponse(readAdminDraft(target));
      const location = findAdminPhraseLocation(nextDraft, row);
      if (!location) {
        throw new Error("Row not found in current draft.");
      }

      const meaning = nextDraft.meanings[location.meaningIndex];
      meaning.phrases.splice(location.phraseIndex, 1);
      if (meaning.phrases.length === 0) {
        nextDraft.meanings.splice(location.meaningIndex, 1);
      }

      writeAdminDraft(target, nextDraft);
      setAdminNotice(
        `Deleted ${scope} row for ${target.character} / ${target.pronunciation}. Save to persist changes.`
      );
    } catch (error) {
      setAdminNotice(getErrorMessage(error, "Delete row failed."));
    } finally {
      setAdminDeletingKey(null);
    }
  }

  async function handleAdminDeletePhrase(row: AdminTableRow) {
    await handleAdminDeletePhraseRow(row, "phrase");
  }

  async function handleAdminDeleteExample(row: AdminTableRow) {
    await handleAdminDeletePhraseRow(row, "example");
  }

  async function handleAdminPreloadAll() {
    if (adminTargets.length === 0 || adminPreloading) {
      return;
    }

    setAdminPreloading(true);
    setAdminProgressText(null);
    setAdminNotice(null);

    let generatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const total = adminTargets.length;

    try {
      for (let index = 0; index < total; index += 1) {
        const target = adminTargets[index];
        setAdminProgressText(
          `Preloading ${index + 1}/${total}: ${target.character} / ${target.pronunciation}`
        );

        try {
          const existing = await getFlashcardContent(target.character, target.pronunciation);
          if (existing?.content) {
            skippedCount += 1;
            setAdminSavedByKey((previous) => ({
              ...previous,
              [target.key]: true,
            }));
            if (!adminJsonByKey[target.key]) {
              updateAdminJson(target.key, JSON.stringify(existing.content, null, 2));
            }
            continue;
          }

          const generated = await requestGeneratedFlashcardContent({
            character: target.character,
            pronunciation: target.pronunciation,
          });

          await putFlashcardContent(target.character, target.pronunciation, generated);
          updateAdminJson(target.key, JSON.stringify(generated, null, 2));
          setAdminSavedByKey((previous) => ({
            ...previous,
            [target.key]: true,
          }));
          setFlashcardLlmData((previous) => ({
            ...previous,
            [target.key]: generated,
          }));
          generatedCount += 1;
        } catch {
          failedCount += 1;
        }
      }
    } finally {
      setAdminPreloading(false);
      setAdminProgressText(null);
    }

    setAdminNotice(
      `Preload finished. Generated ${generatedCount}, skipped ${skippedCount}, failed ${failedCount}.`
    );
  }

  useEffect(() => {
    if (page !== "admin") {
      return;
    }

    let active = true;
    setAdminLoading(true);
    setAdminNotice(null);
    resetXinhuaCachesForTests();

    (async () => {
      try {
        const seenChars = new Set<string>();
        const orderedChars: string[] = [];
        for (const word of words) {
          // Support legacy rows where hanzi may contain more than one character.
          // Admin targets should still include each individual character.
          const characters = extractUniqueHanzi(word.hanzi);
          for (const character of characters) {
            if (!character || seenChars.has(character)) {
              continue;
            }

            seenChars.add(character);
            orderedChars.push(character);
          }
        }

        orderedChars.sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));

        const nextTargets: AdminTarget[] = [];
        const targetKeySet = new Set<string>();
        const skippedNoPronunciationChars: string[] = [];

        for (const character of orderedChars) {
          const info = await getXinhuaFlashcardInfo(character, { includeAllMatches: true });
          const pronunciations = info?.pronunciations ?? [];
          if (pronunciations.length === 0) {
            skippedNoPronunciationChars.push(character);
            continue;
          }

          for (const pronunciationEntry of pronunciations) {
            const pronunciation = pronunciationEntry.pinyin.trim();
            if (!pronunciation) {
              continue;
            }

            const key = buildFlashcardLlmRequestKey({ character, pronunciation });
            if (targetKeySet.has(key)) {
              continue;
            }

            targetKeySet.add(key);
            nextTargets.push({
              character,
              pronunciation,
              key,
            });
          }
        }

        const savedEntries = await Promise.all(
          nextTargets.map(async (target) => ({
            key: target.key,
            entry: await getFlashcardContent(target.character, target.pronunciation),
          }))
        );

        if (!active) {
          return;
        }

        const nextSavedByKey: Record<string, boolean> = {};
        const nextJsonByKey: Record<string, string> = {};
        const nextFlashcardMap: FlashcardLlmResponseMap = {};

        for (const item of savedEntries) {
          if (!item.entry?.content) {
            nextSavedByKey[item.key] = false;
            continue;
          }

          nextSavedByKey[item.key] = true;
          nextJsonByKey[item.key] = JSON.stringify(item.entry.content, null, 2);
          nextFlashcardMap[item.key] = item.entry.content;
        }

        setAdminTargets(nextTargets);
        setAdminSavedByKey(nextSavedByKey);
        setAdminJsonByKey((previous) => ({
          ...nextJsonByKey,
          ...Object.fromEntries(Object.entries(previous).filter(([key]) => key in nextSavedByKey && !nextSavedByKey[key])),
        }));
        setFlashcardLlmData((previous) => ({
          ...previous,
          ...nextFlashcardMap,
        }));
        if (skippedNoPronunciationChars.length > 0) {
          const preview = skippedNoPronunciationChars.slice(0, 12).join("、");
          const suffix = skippedNoPronunciationChars.length > 12 ? "..." : "";
          setAdminNotice(
            `Skipped ${skippedNoPronunciationChars.length} char(s) without dictionary pronunciation: ${preview}${suffix}`
          );
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setAdminNotice(getErrorMessage(error, "Failed to load admin targets."));
      } finally {
        if (!active) {
          return;
        }

        setAdminLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [page, words]);

  useEffect(() => {
    if (
      !flashcardRevealed ||
      flashcardInfoLoading ||
      flashcardInfoError ||
      !currentFlashcardWord ||
      flashcardLlmRequests.length === 0
    ) {
      setFlashcardLlmLoading(false);
      setFlashcardLlmError(null);
      return;
    }

    let active = true;

    setFlashcardLlmLoading(true);
    setFlashcardLlmError(null);

    (async () => {
      try {
        const saved = await Promise.all(
          flashcardLlmRequests.map(async (requestItem) => {
            const entry = await getFlashcardContent(requestItem.character, requestItem.pronunciation);
            return {
              key: buildFlashcardLlmRequestKey(requestItem),
              content: entry?.content ?? null,
            };
          })
        );

        if (!active) {
          return;
        }

        setFlashcardLlmData((previous) => {
          const next = { ...previous };
          for (const item of saved) {
            if (item.content) {
              next[item.key] = item.content;
            }
          }
          return next;
        });

        const missingCount = saved.filter((item) => !item.content).length;
        if (missingCount > 0) {
          setFlashcardLlmError(
            `${missingCount} pronunciations have no admin-saved content yet. Use Content Admin to preload/save them.`
          );
        } else {
          setFlashcardLlmError(null);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setFlashcardLlmError(
          getErrorMessage(error, "读取已保存内容失败 / Failed to load admin-saved flashcard content.")
        );
      } finally {
        if (!active) {
          return;
        }

        setFlashcardLlmLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    currentFlashcardWord,
    flashcardInfoError,
    flashcardInfoLoading,
    flashcardLlmRequests,
    flashcardRevealed,
  ]);

  async function addWord(e: React.FormEvent) {
    e.preventDefault();
    const input = hanzi.trim();
    if (!input) {
      setFormNotice("\u8bf7\u8f93\u5165\u6c49\u5b57\u3002/ Please enter Chinese characters.");
      return;
    }

    const parsedCharacters = extractUniqueHanzi(input);
    if (parsedCharacters.length === 0) {
      setFormNotice(
        "\u53ea\u652f\u6301\u6dfb\u52a0\u6c49\u5b57\uff08\u5355\u5b57\uff09\u3002/ Only Chinese characters are allowed."
      );
      return;
    }

    const existingWords = await db.words.where("hanzi").anyOf(parsedCharacters).toArray();
    const existingHanziSet = new Set(existingWords.map((word) => word.hanzi));
    const hanziToAdd = parsedCharacters.filter((character) => !existingHanziSet.has(character));

    const now = Date.now();
    const newWords: Word[] = hanziToAdd.map((character, index) => ({
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
      await db.words.bulkAdd(newWords);
    }

    clearForm();

    const skippedExistingCount = parsedCharacters.length - hanziToAdd.length;
    if (newWords.length === 0) {
      setFormNotice(
        "\u6ca1\u6709\u65b0\u589e\u6c49\u5b57\uff08\u53ef\u80fd\u90fd\u5df2\u5b58\u5728\uff09\u3002/ No new characters were added."
      );
    } else if (skippedExistingCount > 0) {
      setFormNotice(
        `\u5df2\u6dfb\u52a0 ${newWords.length} \u4e2a\u6c49\u5b57\uff0c\u8df3\u8fc7 ${skippedExistingCount} \u4e2a\u5df2\u5b58\u5728\u5b57\u7b26\u3002/ Added ${newWords.length} character(s), skipped ${skippedExistingCount} existing.`
      );
    } else {
      setFormNotice(
        `\u5df2\u6dfb\u52a0 ${newWords.length} \u4e2a\u6c49\u5b57\u3002/ Added ${newWords.length} character(s).`
      );
    }

    await refreshAll();
  }

  async function removeWord(id: string) {
    await db.words.delete(id);
    await refreshAll();
  }

  async function resetWord(word: Word) {
    const now = Date.now();
    await db.words.put({
      ...word,
      createdAt: now,
      repetitions: 0,
      intervalDays: 0,
      ease: 21,
      nextReviewAt: 0,
      reviewCount: 0,
      testCount: 0,
    });
    await refreshAll();
  }

  function toggleManualSelection(wordId: string, checked: boolean) {
    setManualSelectedWordIds((previous) => {
      if (checked) {
        return previous.includes(wordId) ? previous : [...previous, wordId];
      }

      return previous.filter((id) => id !== wordId);
    });
  }

  function updateQuizSelection(index: 0 | 1 | 2, value: 0 | 1 | 2 | null) {
    setQuizSelections((previous) => {
      const next = [...previous] as [0 | 1 | 2 | null, 0 | 1 | 2 | null, 0 | 1 | 2 | null];
      if (value !== null) {
        SLOT_INDICES.forEach((slotIndex) => {
          if (slotIndex !== index && next[slotIndex] === value) {
            next[slotIndex] = null;
          }
        });
      }
      next[index] = value;
      return next;
    });
  }

  function handleQuizPhraseDragStart(event: React.DragEvent<HTMLElement>, phraseIndex: 0 | 1 | 2) {
    if (quizResult) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData(QUIZ_PHRASE_DRAG_MIME, String(phraseIndex));
    event.dataTransfer.effectAllowed = "move";
    setQuizDraggingPhraseIndex(phraseIndex);
    setQuizActivePhraseIndex(phraseIndex);
  }

  function handleQuizPhraseDragEnd() {
    setQuizDraggingPhraseIndex(null);
    setQuizDropSentenceIndex(null);
  }

  function handleQuizSentenceDragOver(event: React.DragEvent<HTMLElement>, sentenceIndex: 0 | 1 | 2) {
    if (quizResult) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setQuizDropSentenceIndex(sentenceIndex);
  }

  function handleQuizSentenceDrop(event: React.DragEvent<HTMLElement>, sentenceIndex: 0 | 1 | 2) {
    if (quizResult) {
      return;
    }

    event.preventDefault();
    const droppedPhraseIndex = parseQuizPhraseIndex(
      event.dataTransfer.getData(QUIZ_PHRASE_DRAG_MIME)
    );
    if (droppedPhraseIndex === null) {
      setQuizDraggingPhraseIndex(null);
      setQuizDropSentenceIndex(null);
      return;
    }

    updateQuizSelection(sentenceIndex, droppedPhraseIndex);
    setQuizDraggingPhraseIndex(null);
    setQuizActivePhraseIndex(null);
    setQuizDropSentenceIndex(null);
  }

  function handleQuizSentenceTap(sentenceIndex: 0 | 1 | 2) {
    if (quizResult || quizActivePhraseIndex === null) {
      return;
    }

    updateQuizSelection(sentenceIndex, quizActivePhraseIndex);
    setQuizDraggingPhraseIndex(null);
    setQuizActivePhraseIndex(null);
  }

  function openFlashcardReview(wordId?: string) {
    if (!wordId) {
      router.push("/words/review/flashcard");
      return;
    }

    router.push(`/words/review/flashcard?wordId=${encodeURIComponent(wordId)}`);
  }

  function openFillTestReview(wordId?: string) {
    if (!wordId) {
      router.push("/words/review/fill-test");
      return;
    }

    router.push(`/words/review/fill-test?wordId=${encodeURIComponent(wordId)}`);
  }

  async function submitFlashcardGrade(grade: Grade) {
    if (!currentFlashcardWord || flashcardSubmitting) {
      return;
    }

    setFlashcardSubmitting(true);
    setFlashcardNotice(null);
    let saved = false;

    try {
      await gradeWord(currentFlashcardWord.id, { grade, source: "flashcard" });
      saved = true;
      setFlashcardHistory((previous) => [
        ...previous,
        {
          wordId: currentFlashcardWord.id,
          hanzi: currentFlashcardWord.hanzi,
          grade,
        },
      ]);
    } catch (error) {
      console.error("Failed to grade flashcard word", error);
      setFlashcardNotice(
        `\u672a\u80fd\u4fdd\u5b58 "${currentFlashcardWord.hanzi}" \u7684\u95ea\u5361\u8bc4\u5206 / Failed to save flashcard grade for "${currentFlashcardWord.hanzi}".`
      );
    } finally {
      setFlashcardSubmitting(false);
    }

    if (!saved) {
      return;
    }

    const isLastWord = flashcardIndex >= flashcardQueue.length - 1;
    if (isLastWord) {
      stopFlashcardSession();
      if (isFlashcardReviewPage) {
        await refreshAll();
        router.push("/words/review");
        return;
      }
      setFlashcardCompleted(true);
      setFlashcardNotice("\u95ea\u5361\u590d\u4e60\u5df2\u5b8c\u6210 / Flashcard review complete.");
      await refreshAll();
      return;
    }

    setFlashcardIndex((previous) => previous + 1);
    resetFlashcardWordState();
  }

  function startQuizSessionWithWords(wordsForSession: TestableWord[]) {
    if (wordsForSession.length === 0) {
      setQuizNotice("\u672a\u627e\u5230\u5339\u914d\u6b64\u586b\u7a7a\u9009\u62e9\u7684\u5f85\u6d4b\u6c49\u5b57 / No due characters match this fill-test selection.");
      return;
    }

    stopFlashcardSession();
    setQuizQueue(wordsForSession.map((word) => ({ ...word, fillTest: cloneFillTest(word.fillTest) })));
    setQuizIndex(0);
    resetQuizWordState();
    setQuizHistory([]);
    setQuizCompleted(false);
    setQuizInProgress(true);
    setQuizNotice(null);
  }

  function startQuizSession() {
    startQuizSessionWithWords(plannedQuizWords);
  }

  useEffect(() => {
    if (!isFlashcardReviewPage || loading || flashcardInProgress || flashcardCompleted) {
      return;
    }

    const requestedWord = requestedReviewWordId
      ? sortedDueWords.find((entry) => entry.word.id === requestedReviewWordId)?.word
      : undefined;
    const wordsForSession = requestedWord ? [requestedWord] : sortedDueWords.map((entry) => entry.word);
    if (wordsForSession.length === 0) {
      setFlashcardNotice(
        "\u5f53\u524d\u6ca1\u6709\u53ef\u7528\u4e8e\u95ea\u5361\u7684\u5f85\u590d\u4e60\u6c49\u5b57 / No due characters available for flashcard review."
      );
      return;
    }

    setQuizInProgress(false);
    setQuizQueue([]);
    setQuizIndex(0);
    setQuizSelections([null, null, null]);
    setQuizResult(null);
    setQuizActivePhraseIndex(null);
    setQuizDraggingPhraseIndex(null);
    setQuizDropSentenceIndex(null);
    setFlashcardQueue(wordsForSession.map(cloneWord));
    setFlashcardIndex(0);
    setFlashcardRevealed(false);
    setFlashcardLlmLoading(false);
    setFlashcardLlmError(null);
    setFlashcardHistory([]);
    setFlashcardCompleted(false);
    setFlashcardInProgress(true);
    setFlashcardNotice(null);
  }, [
    flashcardCompleted,
    flashcardInProgress,
    isFlashcardReviewPage,
    loading,
    requestedReviewWordId,
    sortedDueWords,
  ]);

  useEffect(() => {
    if (!isFillTestReviewPage || loading || quizInProgress || quizCompleted) {
      return;
    }

    const requestedWord = requestedReviewWordId
      ? fillTestDueWords.find((word) => word.id === requestedReviewWordId)
      : undefined;
    const wordsForSession = requestedWord ? [requestedWord] : fillTestDueWords;
    if (wordsForSession.length === 0) {
      setQuizNotice(
        "\u672a\u627e\u5230\u5339\u914d\u6b64\u586b\u7a7a\u9009\u62e9\u7684\u5f85\u6d4b\u6c49\u5b57 / No due characters match this fill-test selection."
      );
      return;
    }

    setFlashcardInProgress(false);
    setFlashcardQueue([]);
    setFlashcardIndex(0);
    setFlashcardRevealed(false);
    setFlashcardLlmLoading(false);
    setFlashcardLlmError(null);
    setQuizQueue(wordsForSession.map((word) => ({ ...word, fillTest: cloneFillTest(word.fillTest) })));
    setQuizIndex(0);
    setQuizSelections([null, null, null]);
    setQuizResult(null);
    setQuizActivePhraseIndex(null);
    setQuizDraggingPhraseIndex(null);
    setQuizDropSentenceIndex(null);
    setQuizHistory([]);
    setQuizCompleted(false);
    setQuizInProgress(true);
    setQuizNotice(null);
  }, [
    fillTestDueWords,
    isFillTestReviewPage,
    loading,
    quizCompleted,
    quizInProgress,
    requestedReviewWordId,
  ]);

  async function submitCurrentQuizWord() {
    if (!currentQuizWord || quizResult || quizSubmitting) {
      return;
    }

    const placements: Placement[] = SLOT_INDICES.flatMap((sentenceIndex) => {
      const selectedPhrase = quizSelections[sentenceIndex];
      if (selectedPhrase === null) {
        return [];
      }

      return [
        {
          sentenceIndex,
          chosenPhraseIndex: selectedPhrase,
        },
      ];
    });

    const result = gradeFillTest(currentQuizWord.fillTest, placements);
    setQuizResult(result);
    setQuizSubmitting(true);
    setQuizNotice(null);

    try {
      await gradeWord(currentQuizWord.id, { grade: result.tier, source: "fillTest" });
      setQuizHistory((previous) => [
        ...previous,
        {
          wordId: currentQuizWord.id,
          hanzi: currentQuizWord.hanzi,
          tier: result.tier,
          correctCount: result.correctCount,
        },
      ]);
    } catch (error) {
      console.error("Failed to grade fill test word", error);
      setQuizNotice(`Saved answer view, but failed to update schedule for "${currentQuizWord.hanzi}".`);
    } finally {
      setQuizSubmitting(false);
    }
  }

  async function moveQuizForward() {
    if (!quizResult) {
      return;
    }

    const isLastWord = quizIndex >= quizQueue.length - 1;
    if (isLastWord) {
      stopQuizSession();
      if (isFillTestReviewPage) {
        await refreshAll();
        router.push("/words/review");
        return;
      }
      setQuizCompleted(true);
      setQuizNotice("\u586b\u7a7a\u6d4b\u8bd5\u5df2\u5b8c\u6210 / Fill-test quiz complete.");
      await refreshAll();
      return;
    }

    setQuizIndex((previous) => previous + 1);
    resetQuizWordState();
  }

  const pronunciationEntries = flashcardInfo?.pronunciations ?? [];

  return (
    <main className="kids-page mx-auto max-w-7xl p-6">
      <h1 className="text-2xl font-semibold">{"\u6c49\u5b57\u590d\u4e60\u6e38\u620f / Chinese Character Review Game"}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <section className="space-y-3 rounded-lg border pt-4 px-4 pb-6 lg:self-start">
          <h2 className="font-medium">{"\u83dc\u5355 / Menu"}</h2>
          <p className="text-sm text-gray-700">
            {"\u5728\u9875\u9762\u4e4b\u95f4\u5bfc\u822a\u3002 / Navigate between pages."}
          </p>
          <div className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  activeMenuPage === item.page
                    ? "rounded-md border-2 border-[#7bc28f] bg-[#e8f6e8] px-4 py-2 text-sm font-semibold text-[#2d4f3f]"
                    : "rounded-md border px-4 py-2 text-sm font-medium"
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="stats-gold select-none space-y-1 rounded-md border p-3 text-sm text-gray-700">
            <p>
              <strong>{"\u603b\u5b57\u6570 / Total characters:"}</strong> {allWordsSummary.totalWords}
            </p>
            <p>
              <strong>{"\u5f53\u524d\u5f85\u590d\u4e60 / Due now:"}</strong> {allWordsSummary.dueNow}
            </p>
            <p>
              <strong>{"\u5e73\u5747\u719f\u6089\u5ea6 / Avg familiarity:"}</strong>{" "}
              {formatProbability(allWordsSummary.averageFamiliarity)}
            </p>
          </div>
        </section>

        <div className="space-y-6">
      {page === "add" ? (
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">{"\u6dfb\u52a0\u6c49\u5b57 / Add Characters"}</h2>
        <p className="text-sm text-gray-700">
          {"\u4ec5\u6dfb\u52a0\u6c49\u5b57\uff08\u5355\u5b57\uff09\uff0c\u652f\u6301\u6279\u91cf\u8f93\u5165\u3002\u53ef\u4f7f\u7528\u9017\u53f7\u3001\u7a7a\u683c\u6216\u6362\u884c\u5206\u9694\u3002"}
          / Add Chinese characters only (single
          characters). Batch input is supported with commas, spaces, or line breaks.
        </p>
        {formNotice ? <p className="text-sm text-blue-700">{formNotice}</p> : null}

        <form onSubmit={addWord} className="space-y-3 rounded-md border p-3">
          <input
            className="w-full rounded-md border px-3 py-2"
            placeholder={"\u6c49\u5b57\u6279\u91cf\u8f93\u5165\uff08\u5982\uff1a\u4f60, \u597d \u5b66 \u4e60\uff09 / Batch characters (e.g. \u4f60, \u597d \u5b66 \u4e60)"}
            value={hanzi}
            onChange={(e) => setHanzi(e.target.value)}
          />

          <button type="submit" className="rounded-md bg-black px-4 py-2 text-white">
            {"\u6279\u91cf\u6dfb\u52a0\u6c49\u5b57 / Add Characters"}
          </button>
        </form>
      </section>
      ) : null}
      {isDueReviewPage || isFlashcardReviewPage || isFillTestReviewPage ? (
      <>
      {isDueReviewPage ? (
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">{"\u5f85\u590d\u4e60\u6c49\u5b57 / Due Characters"}</h2>
        <p className="text-sm text-gray-700">{"\u5f53\u524d\u5f85\u590d\u4e60 / Due now:"} {dueWords.length}</p>
        {dueWords.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-black px-4 py-2 text-white"
              onClick={() => openFlashcardReview()}
            >
              {"\u5f00\u59cb\u95ea\u5361\u590d\u4e60 / Start flashcard review"}
            </button>
            <button
              type="button"
              className="rounded-md border px-4 py-2 disabled:opacity-50"
              disabled={fillTestDueWords.length === 0}
              onClick={() => openFillTestReview()}
            >
              {"\u5f00\u59cb\u586b\u7a7a\u6d4b\u8bd5 / Start fill-test review"}
            </button>
          </div>
        ) : null}

        {loading ? (
          <p>{"\u6b63\u5728\u52a0\u8f7d\u5f85\u590d\u4e60\u6c49\u5b57... / Loading due characters..."}</p>
        ) : dueWords.length === 0 ? (
          <p className="text-sm text-gray-600">{"\u5f53\u524d\u6ca1\u6709\u5f85\u590d\u4e60\u6c49\u5b57\u3002 / No due characters right now."}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleDueWordsSort("hanzi")}>
                      {"\u6c49\u5b57 / Character"} <span aria-hidden>{getDueSortIndicator("hanzi")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      onClick={() => toggleDueWordsSort("nextReviewAt")}
                    >
                      {"\u4e0b\u6b21\u590d\u4e60\u65e5\u671f / Next Review Date"}{" "}
                      <span aria-hidden>{getDueSortIndicator("nextReviewAt")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      onClick={() => toggleDueWordsSort("familiarity")}
                    >
                      {"\u719f\u6089\u5ea6 / Familiarity"} <span aria-hidden>{getDueSortIndicator("familiarity")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">{"\u64cd\u4f5c / Action"}</th>
                </tr>
              </thead>
              <tbody>
                {sortedDueWords.map(({ word, familiarity }) => (
                  <tr key={`due-${word.id}`} className="border-b align-top">
                    <td className="px-3 py-2">{word.hanzi}</td>
                    <td className="px-3 py-2">{formatDateTime(word.nextReviewAt)}</td>
                    <td className="px-3 py-2">{formatProbability(familiarity)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-md border px-2 py-1 text-sm"
                          onClick={() => openFlashcardReview(word.id)}
                        >
                          {"\u95ea\u5361\u590d\u4e60 / Flashcard review"}
                        </button>
                        <button
                          type="button"
                          className="rounded-md border px-2 py-1 text-sm disabled:opacity-50"
                          disabled={!hasFillTest(word)}
                          onClick={() => openFillTestReview(word.id)}
                        >
                          {"\u586b\u7a7a\u6d4b\u8bd5 / Fill test"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}

      {isFlashcardReviewPage ? (
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">{"\u95ea\u5361\u590d\u4e60 / Flashcard Review"}</h2>
        {flashcardNotice ? <p className="text-sm text-blue-700">{flashcardNotice}</p> : null}

        {!flashcardInProgress ? (
          <p className="text-sm text-gray-700">
            {"\u8bf7\u4ece\u4e0a\u65b9\u5f85\u590d\u4e60\u5217\u8868\u5f00\u59cb\u95ea\u5361\u590d\u4e60 / Start flashcard review from the due-character actions above."}
          </p>
        ) : (
          <div className="space-y-3 rounded-md border p-3">
            {!currentFlashcardWord ? (
              <p className="text-sm text-gray-600">
                {"\u5f53\u524d\u672a\u52a0\u8f7d\u95ea\u5361\u6c49\u5b57 / No flashcard character loaded."}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      {"\u7b2c"} {flashcardIndex + 1} {"\u4e2a\uff0c\u5171"} {flashcardQueue.length}{" "}
                      {"\u4e2a / Character"} {flashcardIndex + 1} {"of"} {flashcardQueue.length}
                    </p>
                    <p className="text-5xl font-semibold">{currentFlashcardWord.hanzi}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2"
                    onClick={handleStopFlashcardSession}
                  >
                    {"\u505c\u6b62\u95ea\u5361 / Stop flashcards"}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2"
                    onClick={() => setFlashcardRevealed((previous) => !previous)}
                  >
                    {flashcardRevealed
                      ? "\u9690\u85cf\u8be6\u60c5 / Hide details"
                      : "\u663e\u793a\u8be6\u60c5 / Reveal details"}
                  </button>
                </div>

                {flashcardRevealed ? (
                  <div className="space-y-3">
                    {flashcardInfoLoading ? (
                      <p className="text-sm text-gray-600">
                        {"\u6b63\u5728\u52a0\u8f7d\u8bcd\u5178\u8be6\u60c5... / Loading dictionary details..."}
                      </p>
                    ) : null}
                    {flashcardInfoError ? (
                      <p className="text-sm text-amber-700">
                        {
                          "\u65e0\u6cd5\u52a0\u8f7d\u8be5\u95ea\u5361\u7684\u8bcd\u5178\u6570\u636e\uff0c\u4f46\u4ecd\u53ef\u4ee5\u7ee7\u7eed\u8bc4\u5206 / Could not load dictionary data for this card. You can still grade the review."
                        }
                      </p>
                    ) : null}
                    {!flashcardInfoLoading && !flashcardInfoError && flashcardLlmLoading ? (
                      <p className="text-sm text-gray-600">
                        {"\u6b63\u5728\u8bfb\u53d6\u5df2\u4fdd\u5b58\u5185\u5bb9... / Loading saved content..."}
                      </p>
                    ) : null}
                    {flashcardLlmError ? <p className="text-sm text-amber-700">{flashcardLlmError}</p> : null}
                    {pronunciationEntries.length > 0 ? (
                        <div className="max-h-80 overflow-y-auto">
                          <ul className="space-y-3 text-sm">
                            {pronunciationEntries.map((entry, index) => (
                              <li
                                key={`${currentFlashcardWord.id}-pronunciation-${entry.pinyin}-${index}`}
                                className="rounded-md border p-3"
                              >
                                <p className="text-2xl font-semibold">
                                  {"\u8bfb\u97f3"}{index + 1}{"\uff1a"}
                                  {entry.pinyin || "(\u6682\u65e0 / not available)"}
                                </p>
                                {(() => {
                                  if (!entry.pinyin) {
                                    return (
                                      <p className="mt-2 text-gray-600">
                                        {"\uff08\u6682\u65e0\u8bfb\u97f3\uff09 / (pronunciation not available)"}
                                      </p>
                                    );
                                  }

                                  const requestKey = buildFlashcardLlmRequestKey({
                                    character: currentFlashcardWord.hanzi,
                                    pronunciation: entry.pinyin,
                                  });
                                  const llmResponse = flashcardLlmData[requestKey];

                                  if (!llmResponse) {
                                    return (
                                      <p className="mt-2 text-gray-600">
                                        {
                                          "\u6682\u65e0\u5df2\u4fdd\u5b58\u5185\u5bb9\uff0c\u8bf7\u5728\u5185\u5bb9\u7ba1\u7406\u9875\u9884\u751f\u6210\u5e76\u4fdd\u5b58 / No saved content yet. Preload and save from Content Admin."
                                        }
                                      </p>
                                    );
                                  }

                                  if (llmResponse.meanings.length === 0) {
                                    return (
                                      <p className="mt-2 text-gray-600">
                                        {"\uff08\u6682\u65e0\u53ef\u7528\u91ca\u4e49\u5185\u5bb9\uff09 / (no suitable meanings generated)"}
                                      </p>
                                    );
                                  }

                                  return (
                                    <ul className="mt-2 grid grid-cols-1 gap-2 text-gray-700 sm:grid-cols-2">
                                      {llmResponse.meanings.map((meaning, meaningIndex) => (
                                        <li
                                          key={`${currentFlashcardWord.id}-pronunciation-${entry.pinyin}-meaning-${meaningIndex}`}
                                          className="rounded-md border bg-gray-50 p-3"
                                        >
                                          <p className="text-sm font-semibold text-gray-600">
                                            {"\u91ca\u4e49"} {meaningIndex + 1}
                                          </p>
                                          <p className="whitespace-pre-wrap text-base font-semibold">
                                            {meaning.definition}
                                          </p>
                                          {meaning.definition_en ? (
                                            <p className="mt-1 text-xs text-gray-500">{meaning.definition_en}</p>
                                          ) : null}

                                          <div className="mt-2 space-y-2">
                                            {meaning.phrases.map((phrase, phraseIndex) => (
                                              <div
                                                key={`${currentFlashcardWord.id}-pronunciation-${entry.pinyin}-meaning-${meaningIndex}-phrase-${phraseIndex}`}
                                                className="rounded border border-dashed p-2"
                                              >
                                                <p className="text-sm font-semibold text-gray-900">
                                                  {phrase.phrase} ({phrase.pinyin})
                                                </p>
                                                <p className="mt-1 text-sm text-gray-700">
                                                  {"\u4f8b\u53e5 / Example: "} {phrase.example}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  );
                                })()}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">
                          {"\uff08\u65e0\u8bfb\u97f3\u91ca\u4e49\uff09 / (no pronunciation explanations)"}
                        </p>
                      )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    {"\u8bc4\u5206\u524d\u8bf7\u5148\u663e\u793a\u8be6\u60c5 / Reveal details before grading this card."}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2"
                    disabled={!flashcardRevealed || flashcardSubmitting}
                    onClick={() => submitFlashcardGrade("again")}
                  >
                    {GRADE_LABELS.again}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2"
                    disabled={!flashcardRevealed || flashcardSubmitting}
                    onClick={() => submitFlashcardGrade("hard")}
                  >
                    {GRADE_LABELS.hard}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2"
                    disabled={!flashcardRevealed || flashcardSubmitting}
                    onClick={() => submitFlashcardGrade("good")}
                  >
                    {GRADE_LABELS.good}
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-black px-3 py-2 text-white disabled:opacity-50"
                    disabled={!flashcardRevealed || flashcardSubmitting}
                    onClick={() => submitFlashcardGrade("easy")}
                  >
                    {GRADE_LABELS.easy}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {flashcardCompleted && flashcardHistory.length > 0 ? (
          <div className="space-y-2 rounded-md border p-3">
            <h3 className="font-medium">{"\u4e0a\u6b21\u95ea\u5361\u603b\u7ed3 / Last Flashcard Summary"}</h3>
            <p className="text-sm text-gray-700">
              {"\u5df2\u590d\u4e60\u6c49\u5b57 / Characters reviewed:"} {flashcardHistory.length}
            </p>
            <p className="text-sm text-gray-700">
              {GRADE_LABELS.again} {flashcardSummary.again} | {GRADE_LABELS.hard} {flashcardSummary.hard} |{" "}
              {GRADE_LABELS.good} {flashcardSummary.good} | {GRADE_LABELS.easy} {flashcardSummary.easy}
            </p>
          </div>
        ) : null}
      </section>
      ) : null}

      {isFillTestReviewPage ? (
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">{"\u586b\u7a7a\u6d4b\u8bd5 / Fill Test Quiz"}</h2>
        <p className="text-sm text-gray-700">
          {"\u5f53\u524d\u5f85\u6d4b\u6c49\u5b57 / Due now: "} {fillTestDueWords.length}
        </p>
        {skippedDueCount > 0 ? (
          <p className="text-sm text-amber-700">
            {skippedDueCount} {"\u4e2a\u5f85\u6d4b\u6c49\u5b57\u6682\u65e0\u586b\u7a7a\u9898 / due character"}
            {skippedDueCount > 1 ? "s" : ""}
            {" currently have no fill test."}
          </p>
        ) : null}
        {quizNotice ? <p className="text-sm text-blue-700">{quizNotice}</p> : null}

        {!quizInProgress ? (
          <div className="space-y-3 rounded-md border p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {QUIZ_SELECTION_MODES.map((mode) => (
                <label key={mode} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="quiz-selection-mode"
                    checked={quizSelectionMode === mode}
                    onChange={() => setQuizSelectionMode(mode)}
                  />
                  <span>{getSelectionModeLabel(mode)}</span>
                </label>
              ))}
            </div>

            {quizSelectionMode === "manual" ? (
              <p className="text-sm text-gray-600">
                {"\u8ba1\u5212\u6d4b\u8bd5\u6570\u91cf / Selected characters: "}{" "}
                <strong>{plannedQuizWords.length}</strong>
              </p>
            ) : null}

            {quizSelectionMode === "manual" ? (
              <div className="space-y-2 overflow-x-auto rounded-md border p-2">
                <p className="text-sm font-medium">
                  {"\u4ece\u5f85\u6d4b\u6c49\u5b57\u4e2d\u624b\u52a8\u9009\u62e9 / Manual selection from fill-test due characters"}
                </p>
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-1 text-left">{"\u6d4b\u8bd5 / Test"}</th>
                      <th className="px-2 py-1 text-left">{"\u6c49\u5b57 / Character"}</th>
                      <th className="px-2 py-1 text-left">{"\u6dfb\u52a0\u65f6\u95f4 / Date added"}</th>
                      <th className="px-2 py-1 text-left">{"\u5e94\u590d\u4e60 / Date due"}</th>
                      <th className="px-2 py-1 text-left">{"\u4e0b\u6b21\u5e94\u590d\u4e60 / Next review due date"}</th>
                      <th className="px-2 py-1 text-left">{"\u719f\u6089\u5ea6 / Familiarity"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fillTestDueWords.map((word) => {
                      const projected = calculateNextState(word, "good", Date.now()).nextReviewAt;
                      return (
                        <tr key={word.id} className="border-b align-top">
                          <td className="px-2 py-1">
                            <input
                              type="checkbox"
                              checked={manualSelectionSet.has(word.id)}
                              onChange={(event) =>
                                toggleManualSelection(word.id, event.currentTarget.checked)
                              }
                            />
                          </td>
                          <td className="px-2 py-1">{word.hanzi}</td>
                          <td className="px-2 py-1">{formatDateTime(word.createdAt)}</td>
                          <td className="px-2 py-1">{formatDateTime(word.nextReviewAt)}</td>
                          <td className="px-2 py-1">{formatDateTime(projected)}</td>
                          <td className="px-2 py-1">
                            {getFamiliarity(word)} (rep {word.repetitions})
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
                disabled={plannedQuizWords.length === 0}
                onClick={startQuizSession}
              >
                {"\u5f00\u59cb\u586b\u7a7a\u6d4b\u8bd5 / Start fill-test quiz"}
              </button>
              {quizCompleted && quizHistory.length > 0 ? (
                <button
                  type="button"
                  className="rounded-md border px-4 py-2"
                  onClick={() => setQuizCompleted(false)}
                >
                  {"\u9690\u85cf\u4e0a\u6b21\u603b\u7ed3 / Hide last summary"}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-md border p-3">
            {!currentQuizWord ? (
              <p className="text-sm text-gray-600">
                {"\u672a\u52a0\u8f7d\u6d4b\u8bd5\u6c49\u5b57 / No quiz character loaded."}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      {"\u6c49\u5b57\u8fdb\u5ea6 / Character"} {quizIndex + 1} {" / "} {quizQueue.length}
                    </p>
                    <p className="text-3xl font-semibold">{currentQuizWord.hanzi}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2"
                    onClick={handleStopQuizSession}
                  >
                    {"\u505c\u6b62\u6d4b\u8bd5 / Stop quiz"}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-[16rem_minmax(0,1fr)]">
                  <aside className="rounded-md border bg-gray-50 p-3">
                    <p className="text-sm font-medium">
                      {"\u8bcd\u7ec4\u533a / Phrase Bank"}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      {
                        "\u62d6\u62fd\u5230\u53f3\u4fa7\u7a7a\u683c\uff0c\u6216\u5148\u70b9\u8bcd\u7ec4\u518d\u70b9\u7a7a\u683c / Drag to a blank, or tap phrase then tap blank."
                      }
                    </p>
                    <ul className="mt-3 space-y-2">
                      {currentQuizWord.fillTest.phrases.map((phrase, phraseIndex) => {
                        const typedPhraseIndex = phraseIndex as 0 | 1 | 2;
                        if (quizSelections.includes(typedPhraseIndex)) {
                          return null;
                        }

                        const selectedForTap = quizActivePhraseIndex === typedPhraseIndex;
                        const draggingNow = quizDraggingPhraseIndex === typedPhraseIndex;

                        return (
                          <li key={`${currentQuizWord.id}-phrase-${phraseIndex}`}>
                            <button
                              type="button"
                              draggable={!quizResult}
                              disabled={Boolean(quizResult)}
                              onClick={() =>
                                setQuizActivePhraseIndex((previous) =>
                                  previous === typedPhraseIndex ? null : typedPhraseIndex
                                )
                              }
                              onDragStart={(event) => handleQuizPhraseDragStart(event, typedPhraseIndex)}
                              onDragEnd={handleQuizPhraseDragEnd}
                              className={
                                selectedForTap
                                  ? "w-full rounded-md border-2 border-sky-500 bg-sky-50 px-3 py-2 text-center text-sm text-sky-900 disabled:opacity-60"
                                  : draggingNow
                                    ? "w-full rounded-md border-2 border-sky-500 bg-sky-50 px-3 py-2 text-center text-sm text-sky-900 disabled:opacity-60"
                                    : "w-full rounded-md border bg-white px-3 py-2 text-center text-sm hover:border-gray-400 disabled:opacity-60"
                              }
                            >
                              <p className="text-base font-bold text-gray-900">{phrase}</p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </aside>

                  <div className="space-y-3">
                    {SLOT_INDICES.map((sentenceIndex) => {
                      const sentence = currentQuizWord.fillTest.sentences[sentenceIndex];
                      const [beforeBlank, ...afterParts] = sentence.text.split("___");
                      const afterBlank = afterParts.join("___");
                      const selectedPhraseIndex = quizSelections[sentenceIndex];
                      const selectedPhrase =
                        selectedPhraseIndex === null
                          ? null
                          : currentQuizWord.fillTest.phrases[selectedPhraseIndex];
                      const sentenceResult =
                        quizResult?.sentenceResults.find(
                          (resultItem) => resultItem.sentenceIndex === sentenceIndex
                        ) ?? null;
                      const isDropTarget = quizDropSentenceIndex === sentenceIndex;
                      const filledButtonClass =
                        "inline-flex items-center justify-center p-0 text-center align-middle text-base font-bold text-gray-900";
                      const selectedPhrasePillClass = !quizResult
                        ? "inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-blue-800"
                        : sentenceResult?.isCorrect
                          ? "inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-green-800"
                          : "inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-red-800";

                      return (
                        <div
                          key={`${currentQuizWord.id}-sentence-${sentenceIndex}`}
                          className="rounded-md border p-3"
                        >
                          <p className="mb-2 text-sm font-bold">
                            {"\u53e5\u5b50"} {sentenceIndex + 1} {" / Sentence "} {sentenceIndex + 1}
                          </p>
                          <div className="flex flex-wrap items-center gap-1 text-base font-bold text-gray-900">
                            <span>{beforeBlank}</span>
                            <button
                              type="button"
                              className={
                                isDropTarget
                                  ? "flex min-h-9 min-w-[10rem] items-center justify-center rounded-md border-2 border-sky-500 bg-sky-50 px-3 py-1 text-center text-base font-bold text-gray-900"
                                  : selectedPhraseIndex !== null
                                    ? filledButtonClass
                                    : "flex min-h-9 min-w-[10rem] items-center justify-center rounded-md border border-dashed border-gray-400 bg-white px-3 py-1 text-center text-base font-bold text-gray-900"
                              }
                              disabled={Boolean(quizResult)}
                              onClick={() => handleQuizSentenceTap(sentenceIndex)}
                              onDragOver={(event) => handleQuizSentenceDragOver(event, sentenceIndex)}
                              onDrop={(event) => handleQuizSentenceDrop(event, sentenceIndex)}
                              onDragLeave={() =>
                                setQuizDropSentenceIndex((previous) =>
                                  previous === sentenceIndex ? null : previous
                                )
                              }
                            >
                              {selectedPhraseIndex === null ? (
                                <span className="font-medium text-gray-500">
                                  {"\u62d6\u5230\u8fd9\u91cc / Drop phrase here"}
                                </span>
                              ) : (
                                <span className={selectedPhrasePillClass}>{selectedPhrase}</span>
                              )}
                            </button>
                            <span>{afterBlank}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                              disabled={Boolean(quizResult) || selectedPhraseIndex === null}
                              onClick={() => {
                                updateQuizSelection(sentenceIndex, null);
                                setQuizDraggingPhraseIndex(null);
                                setQuizActivePhraseIndex(null);
                              }}
                            >
                              {"\u6e05\u7a7a / Clear"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {!quizResult ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
                      disabled={quizSubmitting}
                      onClick={submitCurrentQuizWord}
                    >
                      {"\u63d0\u4ea4\u7b54\u6848 / Submit answer"}
                    </button>
                    <p className="text-sm text-gray-600">
                      {"\u672a\u586b\u7a7a\u6570 / Unanswered blanks: "} {unansweredCount}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-sm font-bold">
                      {"\u5f97\u5206 / Score: "} {quizResult.correctCount}/3, {"\u8c03\u5ea6\u7b49\u7ea7 / scheduler tier: "}
                      <span className="capitalize">{quizResult.tier}</span>
                    </p>
                    <ul className="space-y-1 text-sm">
                      {quizResult.sentenceResults.map((resultItem) => {
                        const expectedPhrase =
                          currentQuizWord.fillTest.phrases[resultItem.expectedPhraseIndex];
                        const chosenPhrase =
                          resultItem.chosenPhraseIndex === null
                            ? "(empty)"
                            : currentQuizWord.fillTest.phrases[resultItem.chosenPhraseIndex];

                        return (
                          <li key={`${currentQuizWord.id}-result-${resultItem.sentenceIndex}`}>
                            {"\u53e5\u5b50 / Sentence"} {resultItem.sentenceIndex + 1}:{" "}
                            {resultItem.isCorrect
                              ? "\u6b63\u786e / correct"
                              : "\u9519\u8bef / incorrect"}{" "}
                            {"(\u4f60\u9009\u62e9 / chosen: "}
                            {chosenPhrase}
                            {", \u6b63\u786e\u7b54\u6848 / expected: "}
                            {expectedPhrase}
                            {")"}
                          </li>
                        );
                      })}
                    </ul>
                    <button
                      type="button"
                      className="rounded-md border px-4 py-2"
                      disabled={quizSubmitting}
                      onClick={moveQuizForward}
                    >
                      {quizIndex >= quizQueue.length - 1
                        ? "\u5b8c\u6210\u6d4b\u8bd5 / Finish quiz"
                        : "\u4e0b\u4e00\u4e2a\u6c49\u5b57 / Next character"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {quizCompleted && quizHistory.length > 0 ? (
          <div className="space-y-2 rounded-md border p-3">
            <h3 className="font-medium">{"\u4e0a\u6b21\u586b\u7a7a\u603b\u7ed3 / Last Fill-Test Summary"}</h3>
            <p className="text-sm text-gray-700">
              {"\u5df2\u6d4b\u6c49\u5b57 / Characters tested: "} {quizHistory.length}
              {", \u586b\u7a7a\u6b63\u786e / correct blanks: "} {quizSummary.correct}/
              {quizHistory.length * 3}
            </p>
            <p className="text-sm text-gray-700">
              {GRADE_LABELS.again} {quizSummary.again} | {GRADE_LABELS.hard} {quizSummary.hard} |{" "}
              {GRADE_LABELS.good} {quizSummary.good} | {GRADE_LABELS.easy} {quizSummary.easy}
            </p>
          </div>
        ) : null}
      </section>
      ) : null}
      </>
      ) : null}

      {page === "admin" ? (
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">{"\u5185\u5bb9\u7ba1\u7406 / Content Admin"}</h2>
        <p className="text-sm text-gray-700">
          {"\u9884\u751f\u6210\u5e76\u7ba1\u7406\u95ea\u5361\u7684\u91ca\u4e49\u3001\u8bcd\u7ec4\u3001\u4f8b\u53e5\u3002\u7528\u6237\u7aef\u5c06\u76f4\u63a5\u8bfb\u53d6\u5df2\u4fdd\u5b58\u5185\u5bb9\u3002 / Preload and manage meanings, phrases, and examples. Review page reads only saved content."}
        </p>

        <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            className={getAdminStatsCardClass("characters")}
            onClick={() => handleAdminStatsFilterClick("characters")}
            aria-pressed={isAdminStatsFilterActive("characters")}
            title="Show all targets (character overview)."
          >
            <p className="text-sm uppercase text-gray-600">
              {"\u603b\u6c49\u5b57 / CHARACTERS"}
              {isAdminStatsFilterActive("characters") ? " (ON)" : ""}
            </p>
            <p className="text-2xl font-semibold">{adminUniqueCharacterCount}</p>
          </button>
          <button
            type="button"
            className={getAdminStatsCardClass("targets")}
            onClick={() => handleAdminStatsFilterClick("targets")}
            aria-pressed={isAdminStatsFilterActive("targets")}
            title="Show all targets."
          >
            <p className="text-sm uppercase text-gray-600">
              {"\u8bfb\u97f3\u6761\u76ee / Targets"}
              {isAdminStatsFilterActive("targets") ? " (ON)" : ""}
            </p>
            <p className="text-2xl font-semibold">{adminTargets.length}</p>
          </button>
          <button
            type="button"
            className={getAdminStatsCardClass("with_content")}
            onClick={() => handleAdminStatsFilterClick("with_content")}
            aria-pressed={isAdminStatsFilterActive("with_content")}
            title={
              isAdminStatsFilterActive("with_content")
                ? "Showing targets with content only. Click to return to all."
                : "Filter table to targets with content."
            }
          >
            <p className="text-sm uppercase text-gray-600">
              {"\u5df2\u5b8c\u6210\u7684\u6761\u76ee / Targets with content"}
              {isAdminStatsFilterActive("with_content") ? " (ON)" : ""}
            </p>
            <p className="text-2xl font-semibold">{adminTargetsWithContentCount}</p>
          </button>
          <button
            type="button"
            className={getAdminStatsCardClass("missing_content")}
            onClick={() => handleAdminStatsFilterClick("missing_content")}
            aria-pressed={isAdminStatsFilterActive("missing_content")}
            title={
              isAdminStatsFilterActive("missing_content")
                ? "Showing missing targets only. Click to return to all."
                : "Filter table to targets missing content."
            }
          >
            <p className="text-sm uppercase text-gray-600">
              {"\u672a\u5b8c\u6210\u7684\u6761\u76ee / Targets missing content"}
              {isAdminStatsFilterActive("missing_content") ? " (ON)" : ""}
            </p>
            <p className="text-2xl font-semibold">{adminMissingCount}</p>
          </button>
        </div>
        <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          <button
            type="button"
            className={getAdminStatsCardClass("ready_for_testing")}
            onClick={() => handleAdminStatsFilterClick("ready_for_testing")}
            aria-pressed={isAdminStatsFilterActive("ready_for_testing")}
            title={
              isAdminStatsFilterActive("ready_for_testing")
                ? "Showing targets ready for testing only. Click to return to all."
                : "Filter table to targets ready for testing."
            }
          >
            <p className="text-sm uppercase text-gray-600">
              {"\u5f55\u5165\u9898\u5e93\u7684\u6761\u76ee / Targets ready for testing"}
              {isAdminStatsFilterActive("ready_for_testing") ? " (ON)" : ""}
            </p>
            <p className="text-2xl font-semibold">{adminTargetsReadyForTestingCount}</p>
          </button>
          <button
            type="button"
            className={getAdminStatsCardClass("excluded_for_testing")}
            onClick={() => handleAdminStatsFilterClick("excluded_for_testing")}
            aria-pressed={isAdminStatsFilterActive("excluded_for_testing")}
            title={
              isAdminStatsFilterActive("excluded_for_testing")
                ? "Showing targets excluded for testing only. Click to return to all."
                : "Filter table to targets excluded for testing."
            }
          >
            <p className="text-sm uppercase text-gray-600">
              {"\u4e0d\u5f55\u5165\u9898\u5e93\u7684\u6761\u76ee / Targets excluded for testing"}
              {isAdminStatsFilterActive("excluded_for_testing") ? " (ON)" : ""}
            </p>
            <p className="text-2xl font-semibold">{adminTargetsExcludedForTestingCount}</p>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
            onClick={handleAdminPreloadAll}
            disabled={adminLoading || adminPreloading || adminTargets.length === 0}
          >
            {adminPreloading
              ? "\u9884\u751f\u6210\u4e2d... / Preloading..."
              : "\u9884\u751f\u6210\u672a\u4fdd\u5b58\u5185\u5bb9 / Preload Missing"}
          </button>
        </div>

        {adminProgressText ? <p className="text-sm text-gray-600">{adminProgressText}</p> : null}
        {adminNotice ? <p className="text-sm text-blue-700">{adminNotice}</p> : null}

        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="w-[15%] px-3 py-2 text-left">{"\u6c49\u5b57(\u8bfb\u97f3) / Character (Pronunciation)"}</th>
                <th className="w-[25%] px-3 py-2 text-left">{"\u91ca\u4e49 / Meaning"}</th>
                <th className="px-3 py-2 text-left">{"\u8bcd\u7ec4 / Phrase"}</th>
                <th className="px-3 py-2 text-left">{"\u4f8b\u53e5 / Example"}</th>
              </tr>
            </thead>
            <tbody>
              {adminTableRenderRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-gray-600" colSpan={4}>
                    {adminEmptyTableMessage}
                  </td>
                </tr>
              ) : (
                adminTableRenderRows.map((row) => {
                  const target = adminTargetByKey.get(row.targetKey);
                  const rawValue = target ? adminJsonByKey[target.key] ?? "" : "";
                  const regenerating = target ? adminRegeneratingKey === target.key : false;
                  const saving = target ? adminSavingKey === target.key : false;
                  const deleting = target ? adminDeletingKey === target.key : false;
                  const busy = adminPreloading || regenerating || saving || deleting;
                  const canSave = Boolean(rawValue.trim());
                  const isPendingPhraseRow = row.rowType === "pending_phrase";
                  const isPendingMeaningRow = row.rowType === "pending_meaning";
                  const isEmptyTargetRow = row.rowType === "empty_target";
                  const isExistingRow = row.rowType === "existing";

                  return (
                  <tr key={row.rowKey} className="border-b align-top">
                    {row.showCharacterCell ? (
                      <td className="px-3 py-2 text-base" rowSpan={row.characterRowSpan}>
                        <div className="flex min-h-[5rem] flex-col justify-between gap-2">
                          <p>
                            {row.character} ({row.pronunciation})
                          </p>
                          {!target ? null : (
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                className="rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900 disabled:opacity-50"
                                disabled={busy}
                                onClick={() => handleAdminRegenerate(target)}
                                title="Regenerate all content"
                              >
                                R
                              </button>
                              <button
                                type="button"
                                className="rounded border-2 border-emerald-600 bg-emerald-600 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white disabled:opacity-50"
                                disabled={busy || !canSave}
                                onClick={() => handleAdminSave(target)}
                                title="Save"
                              >
                                S
                              </button>
                              <button
                                type="button"
                                className="rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700 disabled:opacity-50"
                                disabled={busy}
                                onClick={() => handleAdminDeleteTarget(target)}
                                title="Delete saved content"
                              >
                                D
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center rounded border-2 border-sky-300 bg-sky-50 px-1.5 py-1 text-[11px] font-medium leading-tight text-sky-800 disabled:opacity-50"
                                disabled={busy}
                                onClick={() => handleAdminAddMeaningRow(target.key)}
                                title="Add meaning for this character/pronunciation"
                              >
                                + 释义
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    ) : null}
                    {row.showMeaningCell ? (
                      <td className="px-3 py-2" rowSpan={row.meaningRowSpan}>
                        {isPendingMeaningRow ? (
                          <div className="space-y-2">
                            <input
                              className="w-full rounded-md border px-2 py-1 text-sm"
                              value={row.meaningZh}
                              onChange={(event) => {
                                if (!row.pendingId) {
                                  return;
                                }
                                updateAdminPendingMeaningInput(
                                  row.pendingId,
                                  "meaningZhInput",
                                  event.target.value
                                );
                              }}
                              placeholder="输入新释义 / Enter new meaning"
                            />
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                className="rounded border-2 border-emerald-600 bg-emerald-600 px-2 py-0.5 text-xs font-medium leading-none text-white disabled:opacity-50"
                                disabled={busy || !row.meaningZh.trim() || !row.phrase.trim() || !row.example.trim()}
                                onClick={() => handleAdminSavePendingMeaning(row)}
                                title="Save and generate EN meaning + phrase pinyin"
                              >
                                Save New
                              </button>
                              <button
                                type="button"
                                className="rounded border-2 border-rose-500 bg-rose-50 px-2 py-0.5 text-xs font-medium leading-none text-rose-700 disabled:opacity-50"
                                disabled={busy}
                                onClick={() => {
                                  if (!row.pendingId) {
                                    return;
                                  }
                                  removeAdminPendingMeaning(row.pendingId);
                                }}
                                title="Cancel add meaning"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : isEmptyTargetRow ? (
                          <p className="text-xs text-gray-500">
                            暂无内容，请添加释义 / No content yet, add a meaning.
                          </p>
                        ) : (
                          <>
                            <p className="text-base leading-tight">{row.meaningZh}</p>
                            {row.meaningEn ? <p className="mt-1 text-xs text-gray-500">{row.meaningEn}</p> : null}
                            {!target ? null : (
                              <button
                                type="button"
                                className="mt-2 rounded border-2 border-sky-300 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 disabled:opacity-50"
                                disabled={busy}
                                onClick={() =>
                                  handleAdminAddPhraseRow(row.targetKey, row.meaningZh, row.meaningEn)
                                }
                                title="Add phrase under this meaning"
                              >
                                + 词组
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    ) : null}
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        {isPendingPhraseRow ? (
                          <input
                            className="w-full rounded-md border px-2 py-1 text-sm"
                            value={row.phrase}
                            onChange={(event) => {
                              if (!row.pendingId) {
                                return;
                              }
                              updateAdminPendingPhraseInput(row.pendingId, event.target.value);
                            }}
                            placeholder={`输入新词组（需包含"${row.character}"） / Enter phrase`}
                          />
                        ) : isPendingMeaningRow ? (
                          <input
                            className="w-full rounded-md border px-2 py-1 text-sm"
                            value={row.phrase}
                            onChange={(event) => {
                              if (!row.pendingId) {
                                return;
                              }
                              updateAdminPendingMeaningInput(
                                row.pendingId,
                                "phraseInput",
                                event.target.value
                              );
                            }}
                            placeholder={`输入词组（需包含"${row.character}"） / Enter phrase`}
                          />
                        ) : isEmptyTargetRow ? (
                          <p className="text-xs text-gray-500">
                            请先添加释义 / Add meaning first.
                          </p>
                        ) : (
                          <div className="text-base leading-tight">{renderPhraseWithPinyin(row.phrase, row.phrasePinyin)}</div>
                        )}
                        {!target || isEmptyTargetRow ? null : isPendingPhraseRow ? (
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              className="rounded border-2 border-emerald-600 bg-emerald-600 px-2 py-0.5 text-xs font-medium leading-none text-white disabled:opacity-50"
                              disabled={busy || !row.phrase.trim()}
                              onClick={() => handleAdminSavePendingPhrase(row)}
                              title="Generate pinyin + example and save"
                            >
                              Save New
                            </button>
                            <button
                              type="button"
                              className="rounded border-2 border-rose-500 bg-rose-50 px-2 py-0.5 text-xs font-medium leading-none text-rose-700 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => {
                                if (!row.pendingId) {
                                  return;
                                }
                                removeAdminPendingPhrase(row.pendingId);
                              }}
                              title="Cancel add phrase"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : isPendingMeaningRow ? null : (
                          <div className="flex flex-wrap gap-1">
                            {isExistingRow ? (
                              <button
                                type="button"
                                className={
                                  row.includeInFillTest
                                    ? "rounded border-2 border-teal-600 bg-teal-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-teal-700 disabled:opacity-50"
                                    : "rounded border-2 border-gray-400 bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-gray-700 disabled:opacity-50"
                                }
                                disabled={busy}
                                onClick={() => {
                                  void handleAdminToggleFillTestInclude(row, !row.includeInFillTest);
                                }}
                                title={
                                  row.includeInFillTest
                                    ? "Exclude this row from fill-test generation"
                                    : "Include this row in fill-test generation"
                                }
                              >
                                {row.includeInFillTest ? "FT On" : "FT Off"}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => handleAdminRegeneratePhrase(row)}
                              title="Regenerate phrase and example"
                            >
                              R
                            </button>
                            <button
                              type="button"
                              className="rounded border-2 border-emerald-600 bg-emerald-600 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white disabled:opacity-50"
                              disabled={busy || !canSave}
                              onClick={() => handleAdminSave(target)}
                              title="Save"
                            >
                              S
                            </button>
                            <button
                              type="button"
                              className="rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => handleAdminDeletePhrase(row)}
                              title="Delete this phrase row"
                            >
                              D
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        {isPendingPhraseRow || isPendingMeaningRow ? (
                          isPendingMeaningRow ? (
                            <input
                              className="w-full rounded-md border px-2 py-1 text-sm"
                              value={row.example}
                              onChange={(event) => {
                                if (!row.pendingId) {
                                  return;
                                }
                                updateAdminPendingMeaningInput(
                                  row.pendingId,
                                  "exampleInput",
                                  event.target.value
                                );
                              }}
                              placeholder="输入匹配例句 / Enter matching example"
                            />
                          ) : (
                            <p className="text-xs text-gray-500">
                              保存后自动生成拼音和例句 / Pinyin and example will be generated on save.
                            </p>
                          )
                        ) : isEmptyTargetRow ? (
                          <p className="text-xs text-gray-500">
                            请先添加释义和词组 / Add meaning and phrase first.
                          </p>
                        ) : (
                          row.rowKey === adminEditingExampleRowKey ? (
                            <input
                              className="w-full rounded-md border px-2 py-1 text-sm"
                              value={row.example}
                              onChange={(event) => handleAdminInlineEditExample(row, event.target.value)}
                              placeholder="编辑例句 / Edit example"
                              autoFocus
                            />
                          ) : (
                            <div className="text-base leading-tight">
                              {renderSentenceWithPinyin(row.example, row.examplePinyin)}
                            </div>
                          )
                        )}
                        {!target || isPendingPhraseRow || isPendingMeaningRow || isEmptyTargetRow ? null : (
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              className="rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => handleAdminRegenerateExample(row)}
                              title="Regenerate example"
                            >
                              R
                            </button>
                            <button
                              type="button"
                              className="rounded border-2 border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-sky-800 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => handleAdminEditExample(row)}
                              title="Edit example inline"
                            >
                              E
                            </button>
                            <button
                              type="button"
                              className="rounded border-2 border-emerald-600 bg-emerald-600 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white disabled:opacity-50"
                              disabled={busy || !canSave}
                              onClick={() => handleAdminSave(target)}
                              title="Save"
                            >
                              S
                            </button>
                            <button
                              type="button"
                              className="rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => handleAdminDeleteExample(row)}
                              title="Delete this example row"
                            >
                              D
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {adminLoading ? (
          <p className="text-sm text-gray-600">{"\u6b63\u5728\u52a0\u8f7d\u5185\u5bb9\u6761\u76ee... / Loading admin targets..."}</p>
        ) : adminTargets.length === 0 ? (
          <p className="text-sm text-gray-600">{"\u6682\u65e0\u53ef\u7ba1\u7406\u5185\u5bb9\uff08\u8bf7\u5148\u6dfb\u52a0\u6c49\u5b57\uff09 / No targets yet. Add characters first."}</p>
        ) : null}
      </section>
      ) : null}

      {page === "all" ? (
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">{"\u5168\u90e8\u6c49\u5b57 / All Characters"}</h2>
        <p className="text-sm text-gray-700">
          {"\u6c49\u5b57\u5217\u8868\uff0c\u5305\u542b\u590d\u4e60/\u6d4b\u8bd5\u6b21\u6570\u4e0e\u719f\u6089\u5ea6\u3002 / Character list with review/test counts and familiarity."}
        </p>

        <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex min-h-[76px] w-full flex-col items-center justify-center rounded-md border px-2 py-2 text-center">
            <p className="text-sm uppercase text-gray-600">{"\u603b\u6c49\u5b57 / Total Characters"}</p>
            <p className="text-2xl font-semibold">{allWordsSummary.totalWords}</p>
          </div>
          <div className="flex min-h-[76px] w-full flex-col items-center justify-center rounded-md border px-2 py-2 text-center">
            <p className="text-sm uppercase text-gray-600">{"\u590d\u4e60\u6b21\u6570 / Times Reviewed"}</p>
            <p className="text-2xl font-semibold">{allWordsSummary.totalReviewed}</p>
          </div>
          <div className="flex min-h-[76px] w-full flex-col items-center justify-center rounded-md border px-2 py-2 text-center">
            <p className="text-sm uppercase text-gray-600">{"\u6d4b\u8bd5\u6b21\u6570 / Times Tested"}</p>
            <p className="text-2xl font-semibold">{allWordsSummary.totalTested}</p>
          </div>
          <div className="flex min-h-[76px] w-full flex-col items-center justify-center rounded-md border px-2 py-2 text-center">
            <p className="text-sm uppercase text-gray-600">{"\u5e73\u5747\u719f\u6089\u5ea6 / Avg Familiarity"}</p>
            <p className="text-2xl font-semibold">{formatProbability(allWordsSummary.averageFamiliarity)}</p>
          </div>
        </div>

        {loading ? (
          <p>{"\u6b63\u5728\u52a0\u8f7d... / Loading..."}</p>
        ) : words.length === 0 ? (
          <p>{"\u6682\u65e0\u6c49\u5b57\u3002 / No characters yet."}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleAllWordsSort("hanzi")}>
                      {"\u6c49\u5b57 / Character"} <span aria-hidden>{getSortIndicator("hanzi")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleAllWordsSort("createdAt")}>
                      {"\u6dfb\u52a0\u65e5\u671f / Date Added"} <span aria-hidden>{getSortIndicator("createdAt")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleAllWordsSort("nextReviewAt")}>
                      {"\u4e0b\u6b21\u590d\u4e60\u65e5\u671f / Next Review Date"} <span aria-hidden>{getSortIndicator("nextReviewAt")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleAllWordsSort("reviewCount")}>
                      {"\u590d\u4e60\u6b21\u6570 / Times Reviewed"} <span aria-hidden>{getSortIndicator("reviewCount")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleAllWordsSort("testCount")}>
                      {"\u6d4b\u8bd5\u6b21\u6570 / Times Tested"} <span aria-hidden>{getSortIndicator("testCount")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleAllWordsSort("familiarity")}>
                      {"\u719f\u6089\u5ea6 / Familiarity"} <span aria-hidden>{getSortIndicator("familiarity")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">{"\u64cd\u4f5c / Action"}</th>
                </tr>
              </thead>
              <tbody>
                {sortedAllWords.map(({ word, reviewCount, testCount, familiarity }) => (
                  <tr key={word.id} className="border-b align-top">
                    <td className="px-3 py-2">{word.hanzi}</td>
                    <td className="px-3 py-2">{formatDateTime(word.createdAt)}</td>
                    <td className="px-3 py-2">{formatDateTime(word.nextReviewAt)}</td>
                    <td className="px-3 py-2">{reviewCount}</td>
                    <td className="px-3 py-2">{testCount}</td>
                    <td className="px-3 py-2">{formatProbability(familiarity)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className="rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900"
                          onClick={() => resetWord(word)}
                          title="Reset as new (Date Added = now)"
                          aria-label="Reset as new"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          className="rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700"
                          onClick={() => removeWord(word.id)}
                          title="Delete"
                          aria-label="Delete"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}
        </div>
      </div>
    </main>
  );
}


