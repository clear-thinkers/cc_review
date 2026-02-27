import { useState } from "react";
import type { Word } from "@/lib/types";
import type { AllWordsSortKey, DueWordsSortKey, SortDirection } from "../words.shared.types";

export function useWordsBaseState() {
  const [words, setWords] = useState<Word[]>([]);
  const [dueWords, setDueWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);

  const [hanzi, setHanzi] = useState("");
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [allWordsSortKey, setAllWordsSortKey] = useState<AllWordsSortKey>("createdAt");
  const [allWordsSortDirection, setAllWordsSortDirection] = useState<SortDirection>("desc");
  const [dueWordsSortKey, setDueWordsSortKey] = useState<DueWordsSortKey>("familiarity");
  const [dueWordsSortDirection, setDueWordsSortDirection] = useState<SortDirection>("asc");
  const [manualSelectedWordIds, setManualSelectedWordIds] = useState<string[]>([]);

  return {
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
  };
}
