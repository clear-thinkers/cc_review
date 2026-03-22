import { useState } from "react";
import type { FlashcardContentEntry } from "@/lib/supabase-service";
import type { Word } from "@/lib/types";
import type { AllWordsSortKey } from "../../all/all.types";
import type { DueWordsSortKey, ReviewTestSession } from "../../review/review.types";
import type { SortDirection } from "../words.shared.types";
import type { WordLessonTagsMap } from "../tagging.types";

export function useWordsBaseState() {
  const [words, setWords] = useState<Word[]>([]);
  const [dueWords, setDueWords] = useState<Word[]>([]);
  const [allFlashcardContents, setAllFlashcardContents] = useState<FlashcardContentEntry[]>([]);
  const [reviewTestSessions, setReviewTestSessions] = useState<ReviewTestSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [hanzi, setHanzi] = useState("");
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [allWordsSortKey, setAllWordsSortKey] = useState<AllWordsSortKey>("createdAt");
  const [allWordsSortDirection, setAllWordsSortDirection] = useState<SortDirection>("desc");
  const [dueWordsSortKey, setDueWordsSortKey] = useState<DueWordsSortKey>("familiarity");
  const [dueWordsSortDirection, setDueWordsSortDirection] = useState<SortDirection>("asc");
  const [manualSelectedWordIds, setManualSelectedWordIds] = useState<string[]>([]);

  const [addTagSectionOpen, setAddTagSectionOpen] = useState(false);
  const [addTagTextbookId, setAddTagTextbookId] = useState<string | null>(null);
  const [addTagTextbookName, setAddTagTextbookName] = useState("");
  const [addTagGrade, setAddTagGrade] = useState<string | null>(null);
  const [addTagUnit, setAddTagUnit] = useState<string | null>(null);
  const [addTagLesson, setAddTagLesson] = useState<string | null>(null);

  const [wordTagsMap, setWordTagsMap] = useState<WordLessonTagsMap>(new Map());

  return {
    words,
    setWords,
    dueWords,
    setDueWords,
    allFlashcardContents,
    setAllFlashcardContents,
    reviewTestSessions,
    setReviewTestSessions,
    loading,
    setLoading,
    loadError,
    setLoadError,
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
    addTagSectionOpen,
    setAddTagSectionOpen,
    addTagTextbookId,
    setAddTagTextbookId,
    addTagTextbookName,
    setAddTagTextbookName,
    addTagGrade,
    setAddTagGrade,
    addTagUnit,
    setAddTagUnit,
    addTagLesson,
    setAddTagLesson,
    wordTagsMap,
    setWordTagsMap,
  };
}
