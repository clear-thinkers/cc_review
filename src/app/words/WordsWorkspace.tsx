"use client";

import AddSection from "./add/AddSection";
import AddParagraphSection from "./add-paragraph/AddParagraphSection";
import ParagraphLibrarySection from "./add-paragraph/ParagraphLibrarySection";
import ContinueImportSection from "./add-paragraph/ContinueImportSection";
import TestModeSection from "./add-paragraph/TestModeSection";
import AdminSection from "./admin/AdminSection";
import AllWordsSection from "./all/AllWordsSection";
import DebugSection from "./debug/DebugSection";
import HomeFlowSection from "./home/HomeFlowSection";
import PromptsSection from "./prompts/PromptsSection";
import ResultsSection from "./results/ResultsSection";
import ShopSection from "./shop/ShopSection";
import KitchenSection from "./shop/kitchen/KitchenSection";
import ShopAdminSection from "./shop-admin/ShopAdminSection";
import DueReviewSection from "./review/DueReviewSection";
import FillTestReviewSection from "./review/fill-test/FillTestReviewSection";
import ParagraphQuizReviewSection from "./review/paragraph-quiz/ParagraphQuizReviewSection";
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
      <HomeFlowSection vm={vm} />
      <AddSection vm={vm} />
      <AddParagraphSection vm={vm} />
      <ParagraphLibrarySection vm={vm} />
      <ContinueImportSection vm={vm} />
      <TestModeSection vm={vm} />
      <DueReviewSection vm={vm} />
      <ShopSection vm={vm} />
      <KitchenSection vm={vm} />
      <ShopAdminSection vm={vm} />
      <FlashcardReviewSection vm={vm} />
      <FillTestReviewSection vm={vm} />
      <ParagraphQuizReviewSection vm={vm} />
      <AdminSection vm={vm} />
      <PromptsSection vm={vm} />
      <AllWordsSection vm={vm} />
      <ResultsSection vm={vm} />
      <DebugSection vm={vm} />
    </WordsShell>
  );
}
