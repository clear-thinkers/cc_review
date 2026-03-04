"use client";

import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import { ResultsPage } from "./ResultsPage";

export default function ResultsSection({ vm }: { vm: WordsWorkspaceVM }) {
  if (vm.page !== "results") {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <ResultsPage strings={vm.str.results} />
    </section>
  );
}
