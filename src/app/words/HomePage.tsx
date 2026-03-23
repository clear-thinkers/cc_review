import { Suspense } from "react";
import WordsWorkspace from "./WordsWorkspace";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="home" />
    </Suspense>
  );
}
