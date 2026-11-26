import { Suspense } from "react";
import WordsWorkspace from "../../WordsWorkspace";

export default function CafePage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="cafe" />
    </Suspense>
  );
}
