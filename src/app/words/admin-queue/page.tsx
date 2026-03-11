import { Suspense } from "react";
import WordsWorkspace from "../WordsWorkspace";

export default function AdminQueuePage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="adminQueue" />
    </Suspense>
  );
}
