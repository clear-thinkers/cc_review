import { Suspense } from "react";
import WordsWorkspace from "../WordsWorkspace";

export default function AdminWordsPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="admin" />
    </Suspense>
  );
}
