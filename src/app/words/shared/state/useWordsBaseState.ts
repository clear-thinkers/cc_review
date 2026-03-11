import { useState } from "react";
import type { Word } from "@/lib/types";
import type { AllWordsSortKey } from "../../all/all.types";
import type { DueWordsSortKey } from "../../review/review.types";
import type { SortDirection } from "../words.shared.types";
import type { WordLessonTagsMap } from "../tagging.types";

export function useWordsBaseState() {
  const [words, setWords] = useState<Word[]>([]);
  const [dueWords, setDueWords] = useState<Word[]>([]);
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
  const [addTagSlot1Label, setAddTagSlot1Label] = useState<string | null>(null);
  const [addTagSlot1Value, setAddTagSlot1Value] = useState<string | null>(null);
  const [addTagSlot2Value, setAddTagSlot2Value] = useState<string | null>(null);
  const [addTagSlot3Value, setAddTagSlot3Value] = useState<string | null>(null);

  const [wordTagsMap, setWordTagsMap] = useState<WordLessonTagsMap>(new Map());

  return {
    words,
    setWords,
    dueWords,
    setDueWords,
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
    addTagSlot1Label,
    setAddTagSlot1Label,
    addTagSlot1Value,
    setAddTagSlot1Value,
    addTagSlot2Value,
    setAddTagSlot2Value,
    addTagSlot3Value,
    setAddTagSlot3Value,
    wordTagsMap,
    setWordTagsMap,
  };
}
