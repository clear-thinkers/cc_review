"use client";

import AddSection from "./add/AddSection";
import AdminSection from "./admin/AdminSection";
import AllWordsSection from "./all/AllWordsSection";
import ResultsSection from "./results/ResultsSection";
import DueReviewSection from "./review/DueReviewSection";
import FillTestReviewSection from "./review/fill-test/FillTestReviewSection";
import FlashcardReviewSection from "./review/flashcard/FlashcardReviewSection";
import { useLocale } from "../shared/locale";
import WordsShell from "./shared/WordsShell";
import { useWordsWorkspaceState } from "./shared/words.shared.state";
import type { WordsSectionPage } from "./shared/shell.types";
import { wordsStrings } from "./words.strings";

export type { WordsSectionPage } from "./shared/shell.types";

export default function WordsWorkspace({ page }: { page: WordsSectionPage }) {
  const locale = useLocale();
  const str = wordsStrings[locale];
  const vm = useWordsWorkspaceState({ page, str });

  return (
    <WordsShell vm={vm}>
      <AddSection vm={vm} />
      <DueReviewSection vm={vm} />
      <FlashcardReviewSection vm={vm} />
      <FillTestReviewSection vm={vm} />
      <AdminSection vm={vm} />
      <AllWordsSection vm={vm} />
      <ResultsSection vm={vm} />
    </WordsShell>
  );
}
