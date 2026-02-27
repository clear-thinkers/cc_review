import { Suspense } from "react";
import WordsWorkspace from "../../WordsWorkspace";

export default function FillTestReviewPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="fillTest" />
    </Suspense>
  );
}
