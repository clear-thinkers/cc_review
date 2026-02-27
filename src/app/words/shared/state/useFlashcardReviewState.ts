import { useState } from "react";
import type { Word } from "@/lib/types";
import type { FlashcardLlmResponseMap, FlashcardHistoryItem } from "../words.shared.types";

export function useFlashcardReviewState() {
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

  return {
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
  };
}
