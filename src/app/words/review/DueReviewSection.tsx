"use client";

import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";

export default function DueReviewSection({ vm }: { vm: WordsWorkspaceVM }) {
  const {
    isDueReviewPage,
    str,
    dueWords,
    fillTestDueWords,
    loading,
    sortedDueWords,
    openFlashcardReview,
    openFillTestReview,
    toggleDueWordsSort,
    getDueSortIndicator,
    formatDateTime,
    formatProbability,
    hasFillTest,
  } = vm;

  if (!isDueReviewPage) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{str.due.pageTitle}</h2>
      <p className="text-sm text-gray-700">
        {str.due.dueNowLabel} {dueWords.length}
      </p>
      {dueWords.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md bg-black px-4 py-2 text-white"
            onClick={() => openFlashcardReview()}
          >
            {str.due.startFlashcard}
          </button>
          <button
            type="button"
            className="rounded-md border px-4 py-2 disabled:opacity-50"
            disabled={fillTestDueWords.length === 0}
            onClick={() => openFillTestReview()}
          >
            {str.due.startFillTest}
          </button>
        </div>
      ) : null}

      {loading ? (
        <p>{str.due.loading}</p>
      ) : dueWords.length === 0 ? (
        <p className="text-sm text-gray-600">{str.due.noCharacters}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleDueWordsSort("hanzi")}
                  >
                    {str.due.table.character} <span aria-hidden>{getDueSortIndicator("hanzi")}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleDueWordsSort("nextReviewAt")}
                  >
                    {str.due.table.nextReviewDate}{" "}
                    <span aria-hidden>{getDueSortIndicator("nextReviewAt")}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleDueWordsSort("familiarity")}
                  >
                    {str.due.table.familiarity} <span aria-hidden>{getDueSortIndicator("familiarity")}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">{str.due.table.action}</th>
              </tr>
            </thead>
            <tbody>
              {sortedDueWords.map(({ word, familiarity }) => (
                <tr key={`due-${word.id}`} className="border-b align-top">
                  <td className="px-3 py-2">{word.hanzi}</td>
                  <td className="px-3 py-2">{formatDateTime(word.nextReviewAt)}</td>
                  <td className="px-3 py-2">{formatProbability(familiarity)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-md border px-2 py-1 text-sm"
                        onClick={() => openFlashcardReview(word.id)}
                      >
                        {str.due.table.flashcard}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border px-2 py-1 text-sm disabled:opacity-50"
                        disabled={!hasFillTest(word)}
                        onClick={() => openFillTestReview(word.id)}
                      >
                        {str.due.table.fillTest}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
