import { Suspense } from "react";
import WordsWorkspace from "../WordsWorkspace";

export default function AddPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="add" />
    </Suspense>
  );
}
