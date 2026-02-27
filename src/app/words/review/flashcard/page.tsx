import { Suspense } from "react";
import WordsWorkspace from "../../WordsWorkspace";

export default function FlashcardReviewPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="flashcard" />
    </Suspense>
  );
}
