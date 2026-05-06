import { useState } from "react";
import type { BundledFillTestResult } from "@/lib/fillTest";
import type {
  QuizHistoryItem,
  QuizSelectionMode,
  QuizSelections,
  TestableWord,
} from "../../review/fill-test/fillTest.types";

export function useFillTestReviewState() {
  const [quizSelectionMode, setQuizSelectionMode] = useState<QuizSelectionMode>("all");
  const [quizInProgress, setQuizInProgress] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizQueue, setQuizQueue] = useState<TestableWord[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelections, setQuizSelections] = useState<QuizSelections>([]);
  const [quizResult, setQuizResult] = useState<BundledFillTestResult | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>([]);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizNotice, setQuizNotice] = useState<string | null>(null);
  const [quizActivePhraseIndex, setQuizActivePhraseIndex] = useState<number | null>(null);
  const [quizDraggingPhraseIndex, setQuizDraggingPhraseIndex] = useState<number | null>(null);
  const [quizDropSentenceIndex, setQuizDropSentenceIndex] = useState<number | null>(null);
  const [quizSessionStartTime, setQuizSessionStartTime] = useState<number | null>(null);
  const [completedReviewTestSessionName, setCompletedReviewTestSessionName] = useState<string | null>(null);

  return {
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
    quizSessionStartTime,
    setQuizSessionStartTime,
    completedReviewTestSessionName,
    setCompletedReviewTestSessionName,
  };
}
