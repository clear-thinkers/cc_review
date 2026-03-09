import { Suspense } from "react";
import WordsWorkspace from "../WordsWorkspace";

export default function PromptsWordsPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="prompts" />
    </Suspense>
  );
}
