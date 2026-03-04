import { Suspense } from "react";
import WordsWorkspace from "../WordsWorkspace";

export default function ResultsPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="results" />
    </Suspense>
  );
}
