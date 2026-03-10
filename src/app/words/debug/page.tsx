import { Suspense } from "react";
import WordsWorkspace from "../WordsWorkspace";

export default function DebugPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="debug" />
    </Suspense>
  );
}
