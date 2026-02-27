"use client";

import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";

export default function AllWordsSection({ vm }: { vm: WordsWorkspaceVM }) {
  const {
    page,
    str,
    allWordsSummary,
    formatProbability,
    loading,
    words,
    toggleAllWordsSort,
    getSortIndicator,
    sortedAllWords,
    formatDateTime,
    resetWord,
    removeWord,
  } = vm;

  if (page !== "all") {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{str.all.pageTitle}</h2>
      <p className="text-sm text-gray-700">{str.all.pageDescription}</p>

      <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex min-h-[76px] w-full flex-col items-center justify-center rounded-md border px-2 py-2 text-center">
          <p className="text-sm uppercase text-gray-600">{str.all.stats.totalCharacters}</p>
          <p className="text-2xl font-semibold">{allWordsSummary.totalWords}</p>
        </div>
        <div className="flex min-h-[76px] w-full flex-col items-center justify-center rounded-md border px-2 py-2 text-center">
          <p className="text-sm uppercase text-gray-600">{str.all.stats.timesReviewed}</p>
          <p className="text-2xl font-semibold">{allWordsSummary.totalReviewed}</p>
        </div>
        <div className="flex min-h-[76px] w-full flex-col items-center justify-center rounded-md border px-2 py-2 text-center">
          <p className="text-sm uppercase text-gray-600">{str.all.stats.timesTested}</p>
          <p className="text-2xl font-semibold">{allWordsSummary.totalTested}</p>
        </div>
        <div className="flex min-h-[76px] w-full flex-col items-center justify-center rounded-md border px-2 py-2 text-center">
          <p className="text-sm uppercase text-gray-600">{str.all.stats.avgFamiliarity}</p>
          <p className="text-2xl font-semibold">{formatProbability(allWordsSummary.averageFamiliarity)}</p>
        </div>
      </div>

      {loading ? (
        <p>{str.common.loading}</p>
      ) : words.length === 0 ? (
        <p>{str.all.noCharacters}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleAllWordsSort("hanzi")}
                  >
                    {str.all.table.headers.character} <span aria-hidden>{getSortIndicator("hanzi")}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleAllWordsSort("createdAt")}
                  >
                    {str.all.table.headers.dateAdded} <span aria-hidden>{getSortIndicator("createdAt")}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleAllWordsSort("nextReviewAt")}
                  >
                    {str.all.table.headers.nextReviewDate}{" "}
                    <span aria-hidden>{getSortIndicator("nextReviewAt")}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleAllWordsSort("reviewCount")}
                  >
                    {str.all.table.headers.reviewCount} <span aria-hidden>{getSortIndicator("reviewCount")}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleAllWordsSort("testCount")}
                  >
                    {str.all.table.headers.testCount} <span aria-hidden>{getSortIndicator("testCount")}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleAllWordsSort("familiarity")}
                  >
                    {str.all.table.headers.familiarity} <span aria-hidden>{getSortIndicator("familiarity")}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">{str.all.table.headers.actions}</th>
              </tr>
            </thead>
            <tbody>
              {sortedAllWords.map(({ word, reviewCount, testCount, familiarity }) => (
                <tr key={word.id} className="border-b align-top">
                  <td className="px-3 py-2">{word.hanzi}</td>
                  <td className="px-3 py-2">{formatDateTime(word.createdAt)}</td>
                  <td className="px-3 py-2">{formatDateTime(word.nextReviewAt)}</td>
                  <td className="px-3 py-2">{reviewCount}</td>
                  <td className="px-3 py-2">{testCount}</td>
                  <td className="px-3 py-2">{formatProbability(familiarity)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        className="rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900"
                        onClick={() => resetWord(word)}
                        title={str.all.table.tooltips.reset}
                        aria-label={str.all.table.buttons.reset}
                      >
                        {str.all.table.buttons.reset}
                      </button>
                      <button
                        type="button"
                        className="rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700"
                        onClick={() => removeWord(word.id)}
                        title={str.all.table.tooltips.delete}
                        aria-label={str.all.table.buttons.delete}
                      >
                        {str.all.table.buttons.delete}
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
