import { Suspense } from "react";
import WordsWorkspace from "../WordsWorkspace";

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="review" />
    </Suspense>
  );
}
