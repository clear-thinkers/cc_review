import { Suspense } from "react";
import WordsWorkspace from "../WordsWorkspace";

export default function AllWordsPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="all" />
    </Suspense>
  );
}
