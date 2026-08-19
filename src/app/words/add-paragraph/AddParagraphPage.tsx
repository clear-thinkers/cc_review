import { Suspense } from "react";
import WordsWorkspace from "../WordsWorkspace";

export default function AddParagraphPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="addParagraph" />
    </Suspense>
  );
}
