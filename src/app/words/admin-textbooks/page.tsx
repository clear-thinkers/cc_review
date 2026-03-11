import { Suspense } from "react";
import WordsWorkspace from "../WordsWorkspace";

export default function AdminTextbooksPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="adminTextbooks" />
    </Suspense>
  );
}
