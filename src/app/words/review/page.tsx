import { Suspense } from "react";
import WordsWorkspace from "../WordsWorkspace";

export default function ReviewWordsPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="review" />
    </Suspense>
  );
}
