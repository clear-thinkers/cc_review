"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useXinhuaFlashcardInfo } from "@/hooks/useXinhuaFlashcardInfo";
import { db, getDueWords, gradeWord } from "@/lib/db";
import { gradeFillTest, type FillResult, type Placement, type Tier } from "@/lib/fillTest";
import { makeId } from "@/lib/id";
import { calculateNextState, type Grade } from "@/lib/scheduler";
import type { FillTest, Word } from "@/lib/types";

const SLOT_INDICES: Array<0 | 1 | 2> = [0, 1, 2];
const QUIZ_SELECTION_MODES = ["all", "10", "20", "30", "manual"] as const;

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
export type WordsSectionPage = "add" | "all" | "review";
type AllWordsSortKey = "hanzi" | "createdAt" | "nextReviewAt" | "reviewCount" | "testCount" | "familiarity";
type DueWordsSortKey = "hanzi" | "nextReviewAt" | "familiarity";
type SortDirection = "asc" | "desc";

const DAY_MS = 24 * 60 * 60 * 1000;
const NAV_ITEMS: Array<{ href: string; label: string; page: WordsSectionPage }> = [
  { href: "/words/add", label: "\u6dfb\u52a0\u6c49\u5b57 / Add Characters", page: "add" },
  { href: "/words/all", label: "\u5168\u90e8\u6c49\u5b57 / All Characters", page: "all" },
  { href: "/words/review", label: "\u5f85\u590d\u4e60 / Due Review", page: "review" },
];

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
    return "All due";
  }

  if (mode === "manual") {
    return "Manual selection";
  }

  return `${mode} due characters`;
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

export default function WordsWorkspace({ page }: { page: WordsSectionPage }) {
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
  }

  function stopFlashcardSession() {
    setFlashcardInProgress(false);
    setFlashcardQueue([]);
    setFlashcardIndex(0);
    resetFlashcardWordState();
  }

  async function handleStopFlashcardSession() {
    stopFlashcardSession();
    setFlashcardNotice("Flashcard review stopped.");
    await refreshAll();
  }

  function resetQuizWordState() {
    setQuizSelections([null, null, null]);
    setQuizResult(null);
  }

  function stopQuizSession() {
    setQuizInProgress(false);
    setQuizQueue([]);
    setQuizIndex(0);
    resetQuizWordState();
  }

  async function handleStopQuizSession() {
    stopQuizSession();
    setQuizNotice("Fill-test quiz stopped.");
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

    setDueWords(sortedDue);
    setManualSelectedWordIds((previous) =>
      previous.filter((id) => sortedDue.some((word) => word.id === id && hasFillTest(word)))
    );
    return sortedDue;
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
      next[index] = value;
      return next;
    });
  }

  function startFlashcardSession(wordsForSession: Word[]) {
    if (wordsForSession.length === 0) {
      setFlashcardNotice("No due characters available for flashcard review.");
      return;
    }

    stopQuizSession();
    setFlashcardQueue(wordsForSession.map(cloneWord));
    setFlashcardIndex(0);
    resetFlashcardWordState();
    setFlashcardHistory([]);
    setFlashcardCompleted(false);
    setFlashcardInProgress(true);
    setFlashcardNotice(null);
  }

  function startFlashcardForWord(word: Word) {
    startFlashcardSession([word]);
  }

  function startFlashcardForAllDueWords() {
    startFlashcardSession(sortedDueWords.map((entry) => entry.word));
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
      setFlashcardNotice(`Failed to save flashcard grade for "${currentFlashcardWord.hanzi}".`);
    } finally {
      setFlashcardSubmitting(false);
    }

    if (!saved) {
      return;
    }

    const isLastWord = flashcardIndex >= flashcardQueue.length - 1;
    if (isLastWord) {
      stopFlashcardSession();
      setFlashcardCompleted(true);
      setFlashcardNotice("Flashcard review complete.");
      await refreshAll();
      return;
    }

    setFlashcardIndex((previous) => previous + 1);
    resetFlashcardWordState();
  }

  function startQuizSessionWithWords(wordsForSession: TestableWord[]) {
    if (wordsForSession.length === 0) {
      setQuizNotice("No due characters match this fill-test selection.");
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

  function startFillTestForWord(word: Word) {
    if (!hasFillTest(word)) {
      setQuizNotice(`"${word.hanzi}" does not have a fill test yet.`);
      return;
    }

    startQuizSessionWithWords([word]);
  }

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
      setQuizCompleted(true);
      setQuizNotice("Fill-test quiz complete.");
      await refreshAll();
      return;
    }

    setQuizIndex((previous) => previous + 1);
    resetQuizWordState();
  }

  const flashcardPinyin =
    flashcardInfo?.pinyin.length && flashcardInfo.pinyin.length > 0
      ? flashcardInfo.pinyin.join(", ")
      : currentFlashcardWord?.pinyin || "(not available)";
  const flashcardRadicals = flashcardInfo?.radicals || "(not available)";
  const flashcardStrokes = flashcardInfo?.strokes || "(not available)";
  const flashcardOldword = flashcardInfo?.oldword || "(not available)";
  const flashcardExplanation = flashcardInfo?.explanation || currentFlashcardWord?.meaning || "(not available)";
  const flashcardMore = flashcardInfo?.more || "(not available)";
  const ciEntries = flashcardInfo?.ciEntries ?? [];
  const idiomEntries = flashcardInfo?.idiomEntries ?? [];
  const xiehouyuEntries = flashcardInfo?.xiehouyuEntries ?? [];
  const idiomExamples = idiomEntries.filter((entry) => Boolean(entry.example?.trim()));

  return (
    <main className="kids-page mx-auto max-w-7xl p-6">
      <h1 className="text-2xl font-semibold">{"\u6c49\u5b57\u590d\u4e60\u6e38\u620f / Chinese Character Review Game"}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <section className="space-y-3 rounded-lg border p-4 lg:sticky lg:top-6 lg:h-fit">
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
                  page === item.page
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
      {page === "review" ? (
      <>
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">{"\u5f85\u590d\u4e60\u6c49\u5b57 / Due Characters"}</h2>
        <p className="text-sm text-gray-700">{"\u5f53\u524d\u5f85\u590d\u4e60 / Due now:"} {dueWords.length}</p>
        {dueWords.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-black px-4 py-2 text-white"
              onClick={startFlashcardForAllDueWords}
            >
              {"\u5f00\u59cb\u95ea\u5361\u590d\u4e60 / Start flashcard review"}
            </button>
            <button
              type="button"
              className="rounded-md border px-4 py-2 disabled:opacity-50"
              disabled={fillTestDueWords.length === 0}
              onClick={startQuizSession}
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
                          onClick={() => startFlashcardForWord(word)}
                        >
                          {"\u95ea\u5361\u590d\u4e60 / Flashcard review"}
                        </button>
                        <button
                          type="button"
                          className="rounded-md border px-2 py-1 text-sm disabled:opacity-50"
                          disabled={!hasFillTest(word)}
                          onClick={() => startFillTestForWord(word)}
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

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Flashcard Review</h2>
        {flashcardNotice ? <p className="text-sm text-blue-700">{flashcardNotice}</p> : null}

        {!flashcardInProgress ? (
          <p className="text-sm text-gray-700">Start flashcard review from the due-character actions above.</p>
        ) : (
          <div className="space-y-3 rounded-md border p-3">
            {!currentFlashcardWord ? (
              <p className="text-sm text-gray-600">No flashcard character loaded.</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      Character {flashcardIndex + 1} of {flashcardQueue.length}
                    </p>
                    <p className="text-5xl font-semibold">{currentFlashcardWord.hanzi}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2"
                    onClick={handleStopFlashcardSession}
                  >
                    Stop flashcards
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2"
                    onClick={() => setFlashcardRevealed((previous) => !previous)}
                  >
                    {flashcardRevealed ? "Hide details" : "Reveal details"}
                  </button>
                </div>

                {flashcardRevealed ? (
                  <div className="space-y-3 rounded-md border p-3">
                    {flashcardInfoLoading ? (
                      <p className="text-sm text-gray-600">Loading dictionary details...</p>
                    ) : null}
                    {flashcardInfoError ? (
                      <p className="text-sm text-amber-700">
                        Could not load Xinhua data for this card. You can still grade the review.
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      <p className="text-sm">
                        <strong>{"\u5b57\u4fe1\u606f (word.json):"}</strong>
                      </p>
                      <ul className="space-y-1 text-sm">
                        <li>
                          <strong>{"\u5b57:"}</strong> {flashcardInfo?.wordEntry?.word || currentFlashcardWord.hanzi}
                        </li>
                        <li>
                          <strong>{"\u65e7\u5b57:"}</strong> {flashcardOldword}
                        </li>
                        <li>
                          <strong>{"\u62fc\u97f3:"}</strong> {flashcardPinyin}
                        </li>
                        <li>
                          <strong>{"\u90e8\u9996:"}</strong> {flashcardRadicals}
                        </li>
                        <li>
                          <strong>{"\u7b14\u753b:"}</strong> {flashcardStrokes}
                        </li>
                        <li>
                          <strong>{"\u91ca\u4e49:"}</strong> {flashcardExplanation}
                        </li>
                        <li className="whitespace-pre-wrap">
                          <strong>{"more:"}</strong> {flashcardMore}
                        </li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm">
                        <strong>{"\u8bcd\u7ec4 (ci.json):"}</strong> {ciEntries.length}
                      </p>
                      {ciEntries.length > 0 ? (
                        <div className="max-h-72 overflow-y-auto rounded border p-2">
                          <ul className="space-y-2 text-sm">
                            {ciEntries.map((entry, index) => (
                              <li key={`${currentFlashcardWord.id}-ci-${entry.ci}-${index}`}>
                                <p className="font-medium">
                                  {index + 1}. {entry.ci}
                                </p>
                                <p className="text-gray-700 whitespace-pre-wrap">
                                  {entry.explanation || "(no explanation)"}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">(no ci entries)</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm">
                        <strong>{"\u6210\u8bed (idiom.json):"}</strong> {idiomEntries.length}
                      </p>
                      {idiomEntries.length > 0 ? (
                        <div className="max-h-72 overflow-y-auto rounded border p-2">
                          <ul className="space-y-3 text-sm">
                            {idiomEntries.map((entry, index) => (
                              <li key={`${currentFlashcardWord.id}-idiom-${entry.word}-${index}`} className="space-y-1">
                                <p className="font-medium">
                                  {index + 1}. {entry.word}
                                </p>
                                <p>
                                  <strong>{"\u62fc\u97f3:"}</strong> {entry.pinyin || "(not available)"}
                                </p>
                                <p>
                                  <strong>{"\u7f29\u5199:"}</strong> {entry.abbreviation || "(not available)"}
                                </p>
                                <p className="whitespace-pre-wrap">
                                  <strong>{"\u91ca\u4e49:"}</strong> {entry.explanation || "(not available)"}
                                </p>
                                <p className="whitespace-pre-wrap">
                                  <strong>{"\u51fa\u5904:"}</strong> {entry.derivation || "(not available)"}
                                </p>
                                <p className="whitespace-pre-wrap">
                                  <strong>{"\u4f8b\u53e5:"}</strong> {entry.example || "(not available)"}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">(no idiom entries)</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm">
                        <strong>{"\u6b47\u540e\u8bed (xiehouyu.json):"}</strong> {xiehouyuEntries.length}
                      </p>
                      {xiehouyuEntries.length > 0 ? (
                        <div className="max-h-72 overflow-y-auto rounded border p-2">
                          <ul className="space-y-2 text-sm">
                            {xiehouyuEntries.map((entry, index) => (
                              <li key={`${currentFlashcardWord.id}-xiehouyu-${index}`}>
                                <p>
                                  <strong>{index + 1}. {"\u8c1c\u9762:"}</strong> {entry.riddle || "(not available)"}
                                </p>
                                <p>
                                  <strong>{"\u8c1c\u5e95:"}</strong> {entry.answer || "(not available)"}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">(no xiehouyu entries)</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm">
                        <strong>{"\u4f8b\u53e5 (idiom.example):"}</strong> {idiomExamples.length}
                      </p>
                      {idiomExamples.length > 0 ? (
                        <div className="max-h-72 overflow-y-auto rounded border p-2">
                          <ul className="space-y-2 text-sm">
                            {idiomExamples.map((entry, index) => (
                              <li key={`${currentFlashcardWord.id}-example-${entry.word}-${index}`}>
                                <p className="font-medium">{entry.word}</p>
                                <p className="whitespace-pre-wrap text-gray-700">{entry.example}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">(no example entries)</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Reveal details before grading this card.</p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2"
                    disabled={!flashcardRevealed || flashcardSubmitting}
                    onClick={() => submitFlashcardGrade("again")}
                  >
                    Again
                  </button>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2"
                    disabled={!flashcardRevealed || flashcardSubmitting}
                    onClick={() => submitFlashcardGrade("hard")}
                  >
                    Hard
                  </button>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2"
                    disabled={!flashcardRevealed || flashcardSubmitting}
                    onClick={() => submitFlashcardGrade("good")}
                  >
                    Good
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-black px-3 py-2 text-white disabled:opacity-50"
                    disabled={!flashcardRevealed || flashcardSubmitting}
                    onClick={() => submitFlashcardGrade("easy")}
                  >
                    Easy
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {flashcardCompleted && flashcardHistory.length > 0 ? (
          <div className="space-y-2 rounded-md border p-3">
            <h3 className="font-medium">Last Flashcard Summary</h3>
            <p className="text-sm text-gray-700">Characters reviewed: {flashcardHistory.length}</p>
            <p className="text-sm text-gray-700">
              again {flashcardSummary.again} | hard {flashcardSummary.hard} | good {flashcardSummary.good} | easy{" "}
              {flashcardSummary.easy}
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Fill Test Quiz</h2>
        <p className="text-sm text-gray-700">Due now (with fill test): {fillTestDueWords.length}</p>
        {skippedDueCount > 0 ? (
          <p className="text-sm text-amber-700">
            {skippedDueCount} due character{skippedDueCount > 1 ? "s" : ""} currently have no fill test.
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

            <p className="text-sm text-gray-600">
              Planned quiz size: <strong>{plannedQuizWords.length}</strong>
            </p>

            {quizSelectionMode === "manual" ? (
              <div className="space-y-2 overflow-x-auto rounded-md border p-2">
                <p className="text-sm font-medium">Manual selection from fill-test due characters</p>
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-1 text-left">Test</th>
                      <th className="px-2 py-1 text-left">Character</th>
                      <th className="px-2 py-1 text-left">Date added</th>
                      <th className="px-2 py-1 text-left">Date due</th>
                      <th className="px-2 py-1 text-left">Next review due date</th>
                      <th className="px-2 py-1 text-left">Familiarity</th>
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
                Start fill-test quiz
              </button>
              {quizCompleted && quizHistory.length > 0 ? (
                <button
                  type="button"
                  className="rounded-md border px-4 py-2"
                  onClick={() => setQuizCompleted(false)}
                >
                  Hide last summary
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-md border p-3">
            {!currentQuizWord ? (
              <p className="text-sm text-gray-600">No quiz character loaded.</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      Character {quizIndex + 1} of {quizQueue.length}
                    </p>
                    <p className="text-3xl font-semibold">{currentQuizWord.hanzi}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2"
                    onClick={handleStopQuizSession}
                  >
                    Stop quiz
                  </button>
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Phrases</p>
                  <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-3">
                    {currentQuizWord.fillTest.phrases.map((phrase, index) => (
                      <li key={`${currentQuizWord.id}-phrase-${index}`} className="rounded border px-2 py-1">
                        Phrase {index + 1}: {phrase}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  {SLOT_INDICES.map((sentenceIndex) => {
                    const sentence = currentQuizWord.fillTest.sentences[sentenceIndex];
                    const [beforeBlank, ...afterParts] = sentence.text.split("___");
                    const afterBlank = afterParts.join("___");

                    return (
                      <label
                        key={`${currentQuizWord.id}-sentence-${sentenceIndex}`}
                        className="block rounded-md border p-3"
                      >
                        <p className="mb-2 text-sm font-medium">Sentence {sentenceIndex + 1}</p>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span>{beforeBlank}</span>
                          <select
                            className="rounded-md border px-2 py-1"
                            disabled={Boolean(quizResult)}
                            value={quizSelections[sentenceIndex] === null ? "" : quizSelections[sentenceIndex]}
                            onChange={(event) =>
                              updateQuizSelection(
                                sentenceIndex,
                                event.target.value === ""
                                  ? null
                                  : (Number(event.target.value) as 0 | 1 | 2)
                              )
                            }
                          >
                            <option value="">(empty)</option>
                            {currentQuizWord.fillTest.phrases.map((phrase, phraseIndex) => (
                              <option
                                key={`${currentQuizWord.id}-option-${sentenceIndex}-${phraseIndex}`}
                                value={phraseIndex}
                              >
                                {phraseIndex + 1}. {phrase}
                              </option>
                            ))}
                          </select>
                          <span>{afterBlank}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {!quizResult ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
                      disabled={quizSubmitting}
                      onClick={submitCurrentQuizWord}
                    >
                      Submit answer
                    </button>
                    <p className="text-sm text-gray-600">Unanswered blanks: {unansweredCount}</p>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-sm font-medium">
                      Score: {quizResult.correctCount}/3, scheduler tier:{" "}
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
                            Sentence {resultItem.sentenceIndex + 1}:{" "}
                            {resultItem.isCorrect ? "correct" : "incorrect"} (chosen: {chosenPhrase}, expected:{" "}
                            {expectedPhrase})
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
                      {quizIndex >= quizQueue.length - 1 ? "Finish quiz" : "Next character"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {quizCompleted && quizHistory.length > 0 ? (
          <div className="space-y-2 rounded-md border p-3">
            <h3 className="font-medium">Last Fill-Test Summary</h3>
            <p className="text-sm text-gray-700">
              Characters tested: {quizHistory.length}, correct blanks: {quizSummary.correct}/
              {quizHistory.length * 3}
            </p>
            <p className="text-sm text-gray-700">
              again {quizSummary.again} | hard {quizSummary.hard} | good {quizSummary.good} | easy{" "}
              {quizSummary.easy}
            </p>
          </div>
        ) : null}
      </section>
      </>
      ) : null}

      {page === "all" ? (
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">{"\u5168\u90e8\u6c49\u5b57 / All Characters"}</h2>
        <p className="text-sm text-gray-700">
          {"\u6c49\u5b57\u5217\u8868\uff0c\u5305\u542b\u590d\u4e60/\u6d4b\u8bd5\u6b21\u6570\u4e0e\u719f\u6089\u5ea6\u3002 / Character list with review/test counts and familiarity."}
        </p>

        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase text-gray-600">{"\u603b\u6c49\u5b57 / Total Characters"}</p>
            <p className="text-xl font-semibold">{allWordsSummary.totalWords}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase text-gray-600">{"\u590d\u4e60\u6b21\u6570 / Times Reviewed"}</p>
            <p className="text-xl font-semibold">{allWordsSummary.totalReviewed}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase text-gray-600">{"\u6d4b\u8bd5\u6b21\u6570 / Times Tested"}</p>
            <p className="text-xl font-semibold">{allWordsSummary.totalTested}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase text-gray-600">{"\u5e73\u5747\u719f\u6089\u5ea6 / Avg Familiarity"}</p>
            <p className="text-xl font-semibold">{formatProbability(allWordsSummary.averageFamiliarity)}</p>
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
                      <button
                        type="button"
                        className="rounded-md border px-2 py-1 text-sm"
                        onClick={() => removeWord(word.id)}
                      >
                        {"\u5220\u9664 / Delete"}
                      </button>
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


