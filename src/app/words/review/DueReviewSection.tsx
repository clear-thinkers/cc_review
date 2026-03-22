"use client";

import { useMemo, useState } from "react";
import { useSession } from "@/lib/authContext";
import { canAccessRoute } from "@/lib/permissions";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";

function getReviewTestSessionStatusMessage(
  status: string | null,
  name: string | null,
  str: WordsWorkspaceVM["str"]
): string | null {
  if (!status) {
    return null;
  }

  switch (status) {
    case "completed":
      return str.due.reviewTestSessions.statusCompleted.replace("{name}", name ?? "");
    case "missing":
      return str.due.reviewTestSessions.statusMissing;
    case "child_only":
      return str.due.reviewTestSessions.statusChildOnly;
    case "invalid":
      return str.due.reviewTestSessions.statusInvalid;
    case "empty":
      return str.due.reviewTestSessions.statusEmpty;
    case "no_quiz_ready":
      return str.due.reviewTestSessions.statusNoQuizReady;
    default:
      return null;
  }
}

export default function DueReviewSection({ vm }: { vm: WordsWorkspaceVM }) {
  const {
    isDueReviewPage,
    str,
    dueWords,
    fillTestDueWords,
    reviewTestSessionRows,
    loading,
    sortedDueWords,
    openFlashcardReview,
    openFillTestReview,
    openReviewTestSession,
    toggleDueWordsSort,
    getDueSortIndicator,
    formatDateTime,
    formatProbability,
    hasFillTest,
    handleDeleteReviewTestSession,
    reviewTestSessionStatus,
    reviewTestSessionName,
  } = vm;

  const session = useSession();
  const canAccessFillTest = canAccessRoute(
    "/words/review/fill-test",
    session?.role,
    session?.isPlatformAdmin ?? false
  );
  const isParentView = session?.role === "parent" && !(session?.isPlatformAdmin ?? false);
  const [reviewTestSessionNotice, setReviewTestSessionNotice] = useState<string | null>(null);
  const [deletingReviewTestSessionId, setDeletingReviewTestSessionId] = useState<string | null>(null);
  const reviewTestSessionStatusMessage = getReviewTestSessionStatusMessage(
    reviewTestSessionStatus,
    reviewTestSessionName,
    str
  );

  const previewLabelsBySessionId = useMemo(() => {
    return new Map(
      reviewTestSessionRows.map((row) => {
        const label = row.session.targets
          .map((target) => target.character)
          .join(", ");
        return [row.session.id, label];
      })
    );
  }, [reviewTestSessionRows]);

  async function handleDeleteSession(sessionId: string, sessionName: string): Promise<void> {
    const confirmed = window.confirm(
      str.due.reviewTestSessions.confirmDelete.replace("{name}", sessionName)
    );
    if (!confirmed) {
      return;
    }

    setDeletingReviewTestSessionId(sessionId);
    try {
      await handleDeleteReviewTestSession(sessionId);
      setReviewTestSessionNotice(
        str.due.reviewTestSessions.deleteSuccess.replace("{name}", sessionName)
      );
    } catch {
      setReviewTestSessionNotice(
        str.due.reviewTestSessions.deleteError.replace("{name}", sessionName)
      );
    } finally {
      setDeletingReviewTestSessionId(null);
    }
  }

  if (!isDueReviewPage) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{str.due.pageTitle}</h2>
      <p className="text-sm text-gray-700">
        {str.due.dueNowLabel} {dueWords.length}
      </p>
      {reviewTestSessionStatusMessage ? (
        <p className="text-sm text-blue-700">{reviewTestSessionStatusMessage}</p>
      ) : null}
      {reviewTestSessionNotice ? (
        <p className="text-sm text-blue-700">{reviewTestSessionNotice}</p>
      ) : null}

      <div className="space-y-2 rounded-md border p-3">
        <h3 className="font-medium">{str.due.reviewTestSessions.title}</h3>
        {reviewTestSessionRows.length === 0 ? (
          <p className="text-sm text-gray-600">{str.due.reviewTestSessions.empty}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-2 text-left">{str.due.reviewTestSessions.createdAt}</th>
                  <th className="px-3 py-2 text-left">{str.due.reviewTestSessions.targets}</th>
                  <th className="px-3 py-2 text-left">{str.due.reviewTestSessions.quizReady}</th>
                  <th className="px-3 py-2 text-left">{str.due.reviewTestSessions.action}</th>
                </tr>
              </thead>
              <tbody>
                {reviewTestSessionRows.map((row) => (
                  <tr key={row.session.id} className="border-b align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium">{row.session.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(row.session.createdAt)}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {previewLabelsBySessionId.get(row.session.id)}
                    </td>
                    <td className="px-3 py-2">
                      {row.quizReadyCount}/{row.characterCount}
                    </td>
                    <td className="px-3 py-2">
                      {isParentView ? (
                        <button
                          type="button"
                          className="rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700 disabled:opacity-50"
                          disabled={deletingReviewTestSessionId === row.session.id}
                          onClick={() => void handleDeleteSession(row.session.id, row.session.name)}
                        >
                          {deletingReviewTestSessionId === row.session.id
                            ? str.due.reviewTestSessions.deleting
                            : str.due.reviewTestSessions.delete}
                        </button>
                      ) : canAccessFillTest ? (
                        <button
                          type="button"
                          className="rounded border-2 border-amber-500 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900 disabled:opacity-50"
                          disabled={row.quizReadyCount === 0 || Boolean(row.runtime?.errorCode)}
                          title={
                            row.quizReadyCount === 0
                              ? str.due.reviewTestSessions.disabledNoQuizReady
                              : undefined
                          }
                          onClick={() => openReviewTestSession(row.session.id)}
                        >
                          {str.due.reviewTestSessions.start}
                        </button>
                      ) : (
                        <span className="rounded border-2 border-gray-400 bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-gray-700">
                          {str.due.reviewTestSessions.childOnly}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dueWords.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border-2 border-green-500 bg-green-100 px-4 py-2 font-medium text-green-900 disabled:opacity-50"
            onClick={() => openFlashcardReview()}
          >
            {str.due.startFlashcard}
          </button>
          {canAccessFillTest && (
            <button
              type="button"
              className="rounded-md border-2 border-amber-500 bg-amber-100 px-4 py-2 font-medium text-amber-900 disabled:opacity-50"
              disabled={fillTestDueWords.length === 0}
              onClick={() => openFillTestReview()}
            >
              {str.due.startFillTest}
            </button>
          )}
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
                    {str.due.table.character}{" "}
                    <span aria-hidden>{getDueSortIndicator("hanzi")}</span>
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
                    {str.due.table.familiarity}{" "}
                    <span aria-hidden>{getDueSortIndicator("familiarity")}</span>
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
                        className="rounded border-2 border-green-500 bg-green-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-green-900 disabled:opacity-50"
                        onClick={() => openFlashcardReview(word.id)}
                      >
                        {str.due.table.flashcard}
                      </button>
                      {canAccessFillTest && (
                        <button
                          type="button"
                          className="rounded border-2 border-amber-500 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900 disabled:opacity-50"
                          disabled={!hasFillTest(word)}
                          onClick={() => openFillTestReview(word.id)}
                        >
                          {str.due.table.fillTest}
                        </button>
                      )}
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
