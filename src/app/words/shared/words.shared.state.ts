"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
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
import { gradeFillTest, type Placement } from "@/lib/fillTest";
import {
  buildFlashcardLlmRequestKey,
  normalizeFlashcardLlmResponse,
  type FlashcardLlmRequest,
  type FlashcardLlmResponse,
  type FlashcardMeaningPhrase,
} from "@/lib/flashcardLlm";
import { makeId } from "@/lib/id";
import { calculateNextState, type Grade } from "@/lib/scheduler";
import type { Word } from "@/lib/types";
import { getXinhuaFlashcardInfo, resetXinhuaCachesForTests } from "@/lib/xinhua";
import {
  QUIZ_PHRASE_DRAG_MIME,
  QUIZ_SELECTION_MODES,
  SLOT_INDICES,
  buildAdminMeaningKey,
  buildFillTestFromSavedContent,
  cloneFillTest,
  cloneFlashcardLlmResponse,
  cloneWord,
  extractUniqueHanzi,
  formatDateTime,
  formatProbability,
  getErrorMessage,
  getFamiliarity,
  getGradeLabels,
  getMemorizationProbability,
  getNavItems,
  getReviewCount,
  getSelectionModeLabel,
  getTestCount,
  hasFillTest,
  isFlashcardExampleGenerationResponse,
  isFlashcardExamplePinyinGenerationResponse,
  isFlashcardLlmResponse,
  isFlashcardMeaningDetailGenerationResponse,
  isFlashcardPhraseDetailGenerationResponse,
  isFlashcardPhraseGenerationResponse,
  isPhraseIncludedInFillTest,
  normalizeAdminDraftResponse,
  normalizePhraseCompareKey,
  parseQuizPhraseIndex,
  renderPhraseWithPinyin,
  renderSentenceWithPinyin,
  shouldShowManualEditPopup,
} from "./words.shared.utils";
import type {
  AdminPendingMeaning,
  AdminPendingPhrase,
  AdminPhraseLocation,
  AdminStatsFilter,
  AdminTableRenderRow,
  AdminTableRow,
  AdminTarget,
  AdminTargetContentStatus,
  FlashcardHistoryItem,
  FlashcardExampleGenerationRequest,
  FlashcardExampleGenerationResponse,
  FlashcardExamplePinyinGenerationRequest,
  FlashcardExamplePinyinGenerationResponse,
  FlashcardLlmResponseMap,
  FlashcardMeaningDetailGenerationRequest,
  FlashcardMeaningDetailGenerationResponse,
  FlashcardPhraseDetailGenerationRequest,
  FlashcardPhraseDetailGenerationResponse,
  FlashcardPhraseGenerationRequest,
  NavPage,
  QuizHistoryItem,
  QuizSelectionMode,
  SortDirection,
  DueWordsSortKey,
  AllWordsSortKey,
  TestableWord,
  WordsLocaleStrings,
  WordsSectionPage,
} from "./words.shared.types";
import { useAdminState } from "./state/useAdminState";
import { useFillTestReviewState } from "./state/useFillTestReviewState";
import { useFlashcardReviewState } from "./state/useFlashcardReviewState";
import { useWordsBaseState } from "./state/useWordsBaseState";
export function useWordsWorkspaceState({ page, str }: { page: WordsSectionPage; str: WordsLocaleStrings }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const baseState = useWordsBaseState();
  const flashcardState = useFlashcardReviewState();
  const fillTestState = useFillTestReviewState();
  const adminState = useAdminState();

  const {
    words,
    setWords,
    dueWords,
    setDueWords,
    loading,
    setLoading,
    hanzi,
    setHanzi,
    formNotice,
    setFormNotice,
    allWordsSortKey,
    setAllWordsSortKey,
    allWordsSortDirection,
    setAllWordsSortDirection,
    dueWordsSortKey,
    setDueWordsSortKey,
    dueWordsSortDirection,
    setDueWordsSortDirection,
    manualSelectedWordIds,
    setManualSelectedWordIds,
  } = baseState;

  const {
    flashcardInProgress,
    setFlashcardInProgress,
    flashcardCompleted,
    setFlashcardCompleted,
    flashcardQueue,
    setFlashcardQueue,
    flashcardIndex,
    setFlashcardIndex,
    flashcardRevealed,
    setFlashcardRevealed,
    flashcardSubmitting,
    setFlashcardSubmitting,
    flashcardHistory,
    setFlashcardHistory,
    flashcardNotice,
    setFlashcardNotice,
    flashcardLlmData,
    setFlashcardLlmData,
    flashcardLlmLoading,
    setFlashcardLlmLoading,
    flashcardLlmError,
    setFlashcardLlmError,
  } = flashcardState;

  const {
    quizSelectionMode,
    setQuizSelectionMode,
    quizInProgress,
    setQuizInProgress,
    quizCompleted,
    setQuizCompleted,
    quizQueue,
    setQuizQueue,
    quizIndex,
    setQuizIndex,
    quizSelections,
    setQuizSelections,
    quizResult,
    setQuizResult,
    quizHistory,
    setQuizHistory,
    quizSubmitting,
    setQuizSubmitting,
    quizNotice,
    setQuizNotice,
    quizActivePhraseIndex,
    setQuizActivePhraseIndex,
    quizDraggingPhraseIndex,
    setQuizDraggingPhraseIndex,
    quizDropSentenceIndex,
    setQuizDropSentenceIndex,
  } = fillTestState;

  const {
    adminTargets,
    setAdminTargets,
    adminLoading,
    setAdminLoading,
    adminNotice,
    setAdminNotice,
    adminJsonByKey,
    setAdminJsonByKey,
    setAdminSavedByKey,
    adminPreloading,
    setAdminPreloading,
    adminProgressText,
    setAdminProgressText,
    adminRegeneratingKey,
    setAdminRegeneratingKey,
    adminSavingKey,
    setAdminSavingKey,
    adminDeletingKey,
    setAdminDeletingKey,
    adminPendingPhrases,
    setAdminPendingPhrases,
    adminPendingMeanings,
    setAdminPendingMeanings,
    adminEditingExampleRowKey,
    setAdminEditingExampleRowKey,
    adminStatsFilter,
    setAdminStatsFilter,
  } = adminState;

  const isDueReviewPage = page === "review";
  const isFlashcardReviewPage = page === "flashcard";
  const isFillTestReviewPage = page === "fillTest";
  const activeMenuPage: NavPage = isFlashcardReviewPage || isFillTestReviewPage ? "review" : page;
  const requestedReviewWordId = searchParams.get("wordId");

const gradeLabels = getGradeLabels(str);
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
      return "No missing targets.";
    }
    if (adminStatsFilter === "with_content") {
      return "No targets with content.";
    }
    if (adminStatsFilter === "ready_for_testing") {
      return "No targets ready for testing.";
    }
    if (adminStatsFilter === "excluded_for_testing") {
      return "No targets excluded for testing.";
    }
    return "No table data yet. Preload or save content first.";
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
      return "â†•";
    }

    return allWordsSortDirection === "asc" ? "â†‘" : "â†“";
  }

  function getDueSortIndicator(key: DueWordsSortKey): string {
    if (dueWordsSortKey !== key) {
      return "â†•";
    }

    return dueWordsSortDirection === "asc" ? "â†‘" : "â†“";
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
    setFlashcardNotice("Flashcard review stopped.");
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
    const fullMessage = `${message}\nè¯·æ‰‹åŠ¨æ·»åŠ /åˆ é™¤åŽå†è¯•ã€‚ / Please manually add/delete and try again.`;
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
      setAdminNotice("è¯·è¾“å…¥è¯ç»„åŽå†ä¿å­˜ / Enter a phrase before saving.");
      return;
    }

    if (!phrase.includes(target.character)) {
      setAdminNotice(`è¯ç»„éœ€åŒ…å«æ±‰å­— "${target.character}" / Phrase must include ${target.character}.`);
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
      setAdminNotice("è¯·è¾“å…¥é‡Šä¹‰åŽå†ä¿å­˜ / Enter meaning before saving.");
      return;
    }

    const phrase = pending.phraseInput.trim();
    if (!phrase) {
      setAdminNotice("è¯·è¾“å…¥è¯ç»„åŽå†ä¿å­˜ / Enter a phrase before saving.");
      return;
    }

    if (!phrase.includes(target.character)) {
      setAdminNotice(`è¯ç»„éœ€åŒ…å«æ±‰å­— "${target.character}" / Phrase must include ${target.character}.`);
      return;
    }

    const example = pending.exampleInput.trim();
    if (!example) {
      setAdminNotice("è¯·è¾“å…¥ä¾‹å¥åŽå†ä¿å­˜ / Enter an example before saving.");
      return;
    }

    if (!example.includes(phrase)) {
      setAdminNotice("ä¾‹å¥éœ€åŒ…å«è¯ç»„ / Example must include the phrase.");
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
          const preview = skippedNoPronunciationChars.slice(0, 12).join("、");
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
          getErrorMessage(error, "è¯»å–å·²ä¿å­˜å†…å®¹å¤±è´¥ / Failed to load admin-saved flashcard content.")
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
      setFormNotice("Please enter Chinese characters.");
      return;
    }

    const parsedCharacters = extractUniqueHanzi(input);
    if (parsedCharacters.length === 0) {
      setFormNotice(
        "Only Chinese characters are allowed."
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
        "No new characters were added."
      );
    } else if (skippedExistingCount > 0) {
      setFormNotice(
        `Added ${newWords.length} character(s), skipped ${skippedExistingCount} existing.`
      );
    } else {
      setFormNotice(
        `Added ${newWords.length} character(s).`
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
        `Failed to save flashcard grade for "${currentFlashcardWord.hanzi}".`
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
        "No due characters available for flashcard review."
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
        "No due characters match this fill-test selection."
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
      setQuizNotice("Fill-test quiz complete.");
      await refreshAll();
      return;
    }

    setQuizIndex((previous) => previous + 1);
    resetQuizWordState();
  }

  const pronunciationEntries = flashcardInfo?.pronunciations ?? [];
  const sectionVm = {
    page,
    str,
    formNotice,
    addWord,
    hanzi,
    setHanzi,
    isDueReviewPage,
    dueWords,
    fillTestDueWords,
    loading,
    sortedDueWords,
    openFlashcardReview,
    openFillTestReview,
    toggleDueWordsSort,
    getDueSortIndicator,
    formatDateTime,
    formatProbability,
    hasFillTest,
    isFlashcardReviewPage,
    flashcardNotice,
    flashcardInProgress,
    currentFlashcardWord,
    flashcardIndex,
    flashcardQueue,
    handleStopFlashcardSession,
    setFlashcardRevealed,
    flashcardRevealed,
    flashcardInfoLoading,
    flashcardInfoError,
    flashcardLlmLoading,
    flashcardLlmError,
    pronunciationEntries,
    flashcardLlmData,
    gradeLabels,
    submitFlashcardGrade,
    flashcardSubmitting,
    flashcardCompleted,
    flashcardHistory,
    flashcardSummary,
    isFillTestReviewPage,
    skippedDueCount,
    quizNotice,
    quizInProgress,
    QUIZ_SELECTION_MODES,
    quizSelectionMode,
    setQuizSelectionMode,
    getSelectionModeLabel,
    plannedQuizWords,
    quizCompleted,
    quizHistory,
    setQuizCompleted,
    startQuizSession,
    currentQuizWord,
    quizIndex,
    quizQueue,
    handleStopQuizSession,
    SLOT_INDICES,
    quizSelections,
    quizResult,
    quizActivePhraseIndex,
    setQuizActivePhraseIndex,
    quizDraggingPhraseIndex,
    handleQuizPhraseDragStart,
    handleQuizPhraseDragEnd,
    quizDropSentenceIndex,
    handleQuizSentenceTap,
    handleQuizSentenceDragOver,
    handleQuizSentenceDrop,
    setQuizDropSentenceIndex,
    updateQuizSelection,
    setQuizDraggingPhraseIndex,
    submitCurrentQuizWord,
    quizSubmitting,
    unansweredCount,
    moveQuizForward,
    quizSummary,
    calculateNextState,
    manualSelectionSet,
    toggleManualSelection,
    getFamiliarity,
    getAdminStatsCardClass,
    handleAdminStatsFilterClick,
    isAdminStatsFilterActive,
    adminUniqueCharacterCount,
    adminTargets,
    adminTargetsWithContentCount,
    adminMissingCount,
    adminTargetsReadyForTestingCount,
    adminTargetsExcludedForTestingCount,
    handleAdminPreloadAll,
    adminLoading,
    adminPreloading,
    adminProgressText,
    adminNotice,
    adminTableRenderRows,
    adminEmptyTableMessage,
    adminTargetByKey,
    adminJsonByKey,
    adminRegeneratingKey,
    adminSavingKey,
    adminDeletingKey,
    handleAdminRegenerate,
    handleAdminSave,
    handleAdminDeleteTarget,
    handleAdminAddMeaningRow,
    updateAdminPendingMeaningInput,
    handleAdminSavePendingMeaning,
    removeAdminPendingMeaning,
    handleAdminAddPhraseRow,
    updateAdminPendingPhraseInput,
    handleAdminSavePendingPhrase,
    removeAdminPendingPhrase,
    renderPhraseWithPinyin,
    handleAdminToggleFillTestInclude,
    handleAdminRegeneratePhrase,
    handleAdminDeletePhrase,
    adminEditingExampleRowKey,
    handleAdminInlineEditExample,
    renderSentenceWithPinyin,
    handleAdminRegenerateExample,
    handleAdminEditExample,
    handleAdminDeleteExample,
    allWordsSummary,
    words,
    toggleAllWordsSort,
    getSortIndicator,
    sortedAllWords,
    resetWord,
    removeWord,
  };

  const navItems = getNavItems(str);

  return {
    ...sectionVm,
    activeMenuPage,
    navItems,
  };
}

export type UseWordsWorkspaceStateReturn = ReturnType<typeof useWordsWorkspaceState>;


