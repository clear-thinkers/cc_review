"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";

export default function DebugSection({ vm }: { vm: WordsWorkspaceVM }): ReactElement | null {
  const { page, str } = vm;
  const s = str.debug;
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  if (page !== "debug") return null;

  async function handleCleanOrphanedContent(): Promise<void> {
    setRunning(true);
    setResult(null);
    try {
      const {
        getAllFlashcardContents,
        deleteFlashcardContentByHanzi,
        getAllWords,
      } = await import("@/lib/supabase-service");

      const [words, contents] = await Promise.all([
        getAllWords(),
        getAllFlashcardContents(),
      ]);

      const validHanziSet = new Set(words.map((w) => w.hanzi));
      const orphans = contents.filter((c) => !validHanziSet.has(c.character));

      if (orphans.length === 0) {
        setResult(s.noOrphans);
        return;
      }

      const chars = orphans.map((o) => o.character).join(", ");
      const confirmed = window.confirm(s.confirmOrphans(orphans.length, chars));
      if (!confirmed) {
        setResult(s.cancelled);
        return;
      }

      await Promise.all(
        [...new Set(orphans.map((o) => o.character))].map((hanzi) =>
          deleteFlashcardContentByHanzi(hanzi)
        )
      );

      setResult(s.deleted(orphans.length, chars));
    } catch (err) {
      setResult(s.error(err instanceof Error ? err.message : String(err)));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h2 className="font-medium">{s.pageTitle}</h2>
      <p className="text-sm text-gray-500">{s.pageDescription}</p>

      <div className="space-y-3">
        <div className="rounded-md border p-3">
          <h3 className="text-sm font-medium">{s.cleanOrphanedTitle}</h3>
          <p className="mt-1 text-xs text-gray-500">{s.cleanOrphanedDescription}</p>
          <button
            type="button"
            disabled={running}
            onClick={handleCleanOrphanedContent}
            className="mt-2 rounded border-2 border-rose-500 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 disabled:opacity-50"
          >
            {running ? s.running : s.runCleanup}
          </button>
        </div>
      </div>

      {result && (
        <pre className="whitespace-pre-wrap rounded border bg-gray-50 p-3 text-xs">
          {result}
        </pre>
      )}
    </section>
  );
}
