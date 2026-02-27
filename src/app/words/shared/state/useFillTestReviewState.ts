import { useState } from "react";
import type { FillResult } from "@/lib/fillTest";
import type {
  QuizHistoryItem,
  QuizSelectionMode,
  QuizSelections,
  TestableWord,
} from "../words.shared.types";

export function useFillTestReviewState() {
  const [quizSelectionMode, setQuizSelectionMode] = useState<QuizSelectionMode>("all");
  const [quizInProgress, setQuizInProgress] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizQueue, setQuizQueue] = useState<TestableWord[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelections, setQuizSelections] = useState<QuizSelections>([null, null, null]);
  const [quizResult, setQuizResult] = useState<FillResult | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>([]);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizNotice, setQuizNotice] = useState<string | null>(null);
  const [quizActivePhraseIndex, setQuizActivePhraseIndex] = useState<0 | 1 | 2 | null>(null);
  const [quizDraggingPhraseIndex, setQuizDraggingPhraseIndex] = useState<0 | 1 | 2 | null>(null);
  const [quizDropSentenceIndex, setQuizDropSentenceIndex] = useState<0 | 1 | 2 | null>(null);

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
  };
}
