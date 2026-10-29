import { Suspense } from "react";
import WordsWorkspace from "../../WordsWorkspace";

export default function RewardsPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="rewards" />
    </Suspense>
  );
}
