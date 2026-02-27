import { Suspense } from "react";
import WordsWorkspace from "../../WordsWorkspace";

export default function FlashcardPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="flashcard" />
    </Suspense>
  );
}
