import { Suspense } from "react";
import WordsWorkspace from "../WordsWorkspace";

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="admin" />
    </Suspense>
  );
}
