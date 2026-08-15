"use client";

import { useMemo, useState } from "react";
import { useSession } from "@/lib/authContext";
import { useLocale } from "@/app/shared/locale";
import { canAccessRoute } from "@/lib/permissions";
import { appendTargetsToReviewTestSession, createReviewTestSession } from "@/lib/supabase-service";
import { taggingStrings } from "../shared/tagging.strings";
import {
  filterPausedSessionsForViewer,
  getErrorMessage,
  getPausedSessionRemainingCount,
} from "../shared/words.shared.utils";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import type { ReviewTestSessionTargetDraft } from "./review.types";
import { sortReviewTestSessionTargets } from "./reviewSession.utils";

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
    // Shares the reviewTestSessionStatus query param with the packaged-session
    // redirects above (same "row no longer available, go back to Due Review"
    // pattern) even though this status is emitted by the ad-hoc due-review
    // resume path, not a packaged session -- see the resumeProgressKey branch
    // of the auto-start effect in words.shared.state.ts.
    case "resume_missing":
      return str.due.pausedSessions.statusResumeMissing;
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
    skippedDueCount,
    reviewTestSessionRows,
    pausedSessions,
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
    handleDeleteReviewTestSessionTarget,
    resumePausedSession,
    handleDiscardPausedSession,
    reviewTestSessionStatus,
    reviewTestSessionName,
    adminTargets,
    adminLoading,
    words,
    reviewTestSessions,
    refreshAllData,
  } = vm;

  const session = useSession();
  const locale = useLocale();
  const allEditorStr = taggingStrings[locale].allEditor;
  const canManageSessions = canAccessRoute("/words/admin", session?.role, session?.isPlatformAdmin ?? false);

  const [selectedDueWordIds, setSelectedDueWordIds] = useState<string[]>([]);
  const [sessionFormOpen, setSessionFormOpen] = useState(false);
  const [sessionNameInput, setSessionNameInput] = useState("");
  const [creatingSession, setCreatingSession] = useState(false);
  const [batchActionNotice, setBatchActionNotice] = useState<string | null>(null);

  const visibleDueWordIds = useMemo(() => sortedDueWords.map((entry) => entry.word.id), [sortedDueWords]);
  const allDueVisibleSelected =
    visibleDueWordIds.length > 0 && visibleDueWordIds.every((id) => selectedDueWordIds.includes(id));

  function toggleDueWordSelection(wordId: string): void {
    setSelectedDueWordIds((previous) =>
      previous.includes(wordId) ? previous.filter((id) => id !== wordId) : [...previous, wordId]
    );
  }

  function toggleAllDueVisibleSelection(checked: boolean): void {
    setSelectedDueWordIds((previous) => {
      if (checked) {
        return [...new Set([...previous, ...visibleDueWordIds])];
      }
      return previous.filter((id) => !visibleDueWordIds.includes(id));
    });
  }

  function handleBatchStartFlashcard(): void {
    openFlashcardReview(selectedDueWordIds);
  }

  function handleBatchStartFillTest(): void {
    openFillTestReview(selectedDueWordIds);
  }

  async function handleAddSelectedToSession(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const trimmedName = sessionNameInput.trim();
    if (!trimmedName) {
      setBatchActionNotice(str.admin.messages.reviewTestSessionNameRequired);
      return;
    }

    const selectedWords = words.filter((word) => selectedDueWordIds.includes(word.id));
    const drafts: ReviewTestSessionTargetDraft[] = selectedWords.flatMap((word) =>
      adminTargets.filter((target) => target.character === word.hanzi)
    );

    if (drafts.length === 0) {
      setBatchActionNotice(str.admin.messages.reviewTestSessionNoSelection);
      return;
    }

    const orderedTargets = sortReviewTestSessionTargets(drafts, words);
    setCreatingSession(true);
    try {
      const existingSession = reviewTestSessions.find((item) => item.name === trimmedName) ?? null;
      if (existingSession) {
        const addedCount = await appendTargetsToReviewTestSession(existingSession.id, orderedTargets);
        setBatchActionNotice(
          addedCount > 0
            ? str.admin.messages.reviewTestSessionAppendSuccess
                .replace("{name}", trimmedName)
                .replace("{count}", String(addedCount))
            : str.admin.messages.reviewTestSessionNoNewTargets.replace("{name}", trimmedName)
        );
      } else {
        await createReviewTestSession(trimmedName, orderedTargets);
        setBatchActionNotice(
          str.admin.messages.reviewTestSessionCreateSuccess
            .replace("{name}", trimmedName)
            .replace("{count}", String(orderedTargets.length))
        );
      }
      setSelectedDueWordIds([]);
      setSessionFormOpen(false);
      setSessionNameInput("");
      await refreshAllData();
    } catch (error) {
      setBatchActionNotice(getErrorMessage(error, str.admin.messages.reviewTestSessionCreateError));
    } finally {
      setCreatingSession(false);
    }
  }
  const canAccessFillTest = canAccessRoute(
    "/words/review/fill-test",
    session?.role,
    session?.isPlatformAdmin ?? false
  );
  const isParentView = session?.role === "parent" && !(session?.isPlatformAdmin ?? false);
  const [reviewTestSessionNotice, setReviewTestSessionNotice] = useState<string | null>(null);
  const [deletingReviewTestSessionId, setDeletingReviewTestSessionId] = useState<string | null>(null);
  const [deletingTargetKey, setDeletingTargetKey] = useState<string | null>(null);
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

  // Child/platform-admin viewers only ever see and act on their OWN paused
  // sessions (never a sibling's, even though RLS would independently reject
  // a cross-user write) -- parents get the full unfiltered family list,
  // read-only. canAccessFillTest is reused as the actionable-viewer check
  // since it already matches the exact child-or-platform-admin gate this
  // feature is scoped to.
  const visiblePausedSessions = useMemo(
    () => filterPausedSessionsForViewer(pausedSessions, session?.userId, canAccessFillTest),
    [pausedSessions, session?.userId, canAccessFillTest]
  );

  // Paused Sessions is ONE unified table for both ad-hoc due-review and
  // packaged paused sessions (see words.shared.state.ts refreshAll -- it now
  // fetches listReviewSessionProgress() unfiltered). Packaged rows need a
  // human-readable session name; reviewTestSessionRows (already loaded for
  // the Test Sessions table above) is the source of truth for that name.
  const packagedSessionNameById = useMemo(
    () => new Map(reviewTestSessionRows.map((row) => [row.session.id, row.session.name])),
    [reviewTestSessionRows]
  );

  function getPausedSessionLabel(row: WordsWorkspaceVM["pausedSessions"][number]): string {
    if (row.sourceType === "packaged") {
      if (!row.packagedSessionId) {
        return row.clientSessionKey;
      }
      // Falls back to the raw id if the Test Sessions list hasn't loaded
      // yet (or the packaged session was deleted, though that cascade-
      // deletes this row server-side) rather than crashing.
      return packagedSessionNameById.get(row.packagedSessionId) ?? row.packagedSessionId;
    }
    return str.due.pausedSessions.dueReviewLabel;
  }

  const [pausedSessionNotice, setPausedSessionNotice] = useState<string | null>(null);
  const [discardingPausedSessionKey, setDiscardingPausedSessionKey] = useState<string | null>(null);

  async function handleDiscardPaused(clientSessionKey: string): Promise<void> {
    setDiscardingPausedSessionKey(clientSessionKey);
    try {
      await handleDiscardPausedSession(clientSessionKey);
    } catch {
      setPausedSessionNotice(str.due.pausedSessions.discardError);
    } finally {
      setDiscardingPausedSessionKey(null);
    }
  }

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

  async function handleDeleteTarget(
    sessionId: string,
    sessionName: string,
    character: string,
    pronunciation: string,
    isLastTarget: boolean
  ): Promise<void> {
    if (isLastTarget) {
      const confirmed = window.confirm(
        str.due.reviewTestSessions.confirmDeleteLastTarget
          .replace("{character}", character)
          .replace("{name}", sessionName)
      );
      if (!confirmed) {
        return;
      }
    }

    const targetKey = `${sessionId}:${character}|${pronunciation}`;
    setDeletingTargetKey(targetKey);
    try {
      await handleDeleteReviewTestSessionTarget(sessionId, character, pronunciation);
      setReviewTestSessionNotice(
        str.due.reviewTestSessions.deleteTargetSuccess.replace("{character}", character)
      );
    } catch {
      setReviewTestSessionNotice(
        str.due.reviewTestSessions.deleteTargetError.replace("{character}", character)
      );
    } finally {
      setDeletingTargetKey(null);
    }
  }

  if (!isDueReviewPage) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
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
                      {isParentView ? (
                        <div className="flex flex-wrap gap-1">
                          {row.session.targets.map((target) => {
                            const targetKey = `${row.session.id}:${target.key}`;
                            return (
                              <span
                                key={targetKey}
                                className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5"
                              >
                                {target.character}
                                <button
                                  type="button"
                                  className="rounded px-1 text-[10px] font-medium leading-none btn-destructive disabled:opacity-50"
                                  disabled={deletingTargetKey === targetKey}
                                  aria-label={`${str.due.reviewTestSessions.deleteTarget} ${target.character}`}
                                  onClick={() =>
                                    void handleDeleteTarget(
                                      row.session.id,
                                      row.session.name,
                                      target.character,
                                      target.pronunciation,
                                      row.session.targets.length === 1
                                    )
                                  }
                                >
                                  {deletingTargetKey === targetKey
                                    ? str.due.reviewTestSessions.deletingTarget
                                    : str.due.reviewTestSessions.deleteTarget}
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        previewLabelsBySessionId.get(row.session.id)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.quizReadyCount}/{row.characterCount}
                    </td>
                    <td className="px-3 py-2">
                      {isParentView ? (
                        <button
                          type="button"
                          className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-destructive disabled:opacity-50"
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
                          className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-caution disabled:opacity-50"
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
                        <span className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-neutral">
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

      {pausedSessionNotice ? (
        <p className="text-sm text-blue-700">{pausedSessionNotice}</p>
      ) : null}

      {visiblePausedSessions.length > 0 ? (
        <div className="space-y-2 rounded-md border p-3">
          <h3 className="font-medium">{str.due.pausedSessions.title}</h3>
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-2 text-left">{str.due.pausedSessions.sessionColumn}</th>
                  <th className="px-3 py-2 text-left">{str.due.pausedSessions.savedColumn}</th>
                  <th className="px-3 py-2 text-left">{str.due.pausedSessions.remainingColumn}</th>
                  {canAccessFillTest ? (
                    <th className="px-3 py-2 text-left">{str.due.reviewTestSessions.action}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {visiblePausedSessions.map((row) => (
                  <tr key={row.id} className="border-b align-top">
                    <td className="px-3 py-2 text-sm text-gray-700">{getPausedSessionLabel(row)}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {str.due.pausedSessions.lastSaved.replace(
                        "{time}",
                        formatDateTime(row.lastSavedAt)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {str.due.pausedSessions.remaining.replace(
                        "{count}",
                        String(getPausedSessionRemainingCount(row.progressData))
                      )}
                    </td>
                    {canAccessFillTest ? (
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-caution disabled:opacity-50"
                            onClick={() => resumePausedSession(row.clientSessionKey)}
                          >
                            {str.due.pausedSessions.resume}
                          </button>
                          <button
                            type="button"
                            className="rounded px-1.5 py-0.5 text-[11px] font-medium leading-none btn-destructive disabled:opacity-50"
                            disabled={discardingPausedSessionKey === row.clientSessionKey}
                            onClick={() => void handleDiscardPaused(row.clientSessionKey)}
                          >
                            {discardingPausedSessionKey === row.clientSessionKey
                              ? str.due.pausedSessions.discarding
                              : str.due.pausedSessions.discard}
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <p className="text-sm text-gray-700">
        <span className="font-medium">{str.due.pageTitle}:</span>{" "}
        <span className="font-semibold">{dueWords.length}</span>
      </p>
      {skippedDueCount > 0 ? (
        <p className="text-sm text-amber-700">
          {skippedDueCount} {str.fillTest.noFillTests}
        </p>
      ) : null}

      {dueWords.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border-2 px-4 py-2 font-medium btn-confirm disabled:opacity-50"
            onClick={() => openFlashcardReview()}
          >
            {str.due.startFlashcard}
          </button>
          {canAccessFillTest && (
            <button
              type="button"
              className="rounded-md border-2 px-4 py-2 font-medium btn-caution disabled:opacity-50"
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
        <>
        {batchActionNotice ? <p className="text-sm text-blue-700">{batchActionNotice}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-gray-600">
            {allEditorStr.selectedCount.replace("{count}", String(selectedDueWordIds.length))}
          </p>
          <button
            type="button"
            className="rounded border-2 px-3 py-1.5 text-xs font-medium leading-none btn-confirm disabled:opacity-50"
            disabled={selectedDueWordIds.length === 0}
            onClick={handleBatchStartFlashcard}
          >
            {str.due.batchActions.reviewSelected}
          </button>
          {canAccessFillTest && (
            <button
              type="button"
              className="rounded border-2 px-3 py-1.5 text-xs font-medium leading-none btn-caution disabled:opacity-50"
              disabled={selectedDueWordIds.length === 0}
              onClick={handleBatchStartFillTest}
            >
              {str.due.batchActions.testSelected}
            </button>
          )}
          {canManageSessions && (
            <button
              type="button"
              className="rounded border-2 px-3 py-1.5 text-xs font-medium leading-none btn-secondary disabled:opacity-50"
              disabled={selectedDueWordIds.length === 0 || adminLoading}
              title={adminLoading ? str.admin.loading : undefined}
              onClick={() => {
                setSessionNameInput(reviewTestSessions[0]?.name ?? "");
                setSessionFormOpen((open) => !open);
              }}
            >
              {str.due.batchActions.addSelectedToSession}
            </button>
          )}
          {canManageSessions && sessionFormOpen && (
            <form className="flex flex-wrap items-center gap-2" onSubmit={handleAddSelectedToSession}>
              <input
                aria-label={str.admin.reviewTestSession.nameLabel}
                className="h-9 min-w-[12rem] rounded-md border border-indigo-300 px-3 py-1.5 text-xs"
                value={sessionNameInput}
                onChange={(event) => setSessionNameInput(event.target.value)}
                placeholder={str.admin.reviewTestSession.namePlaceholder}
              />
              <button
                type="submit"
                className="rounded border-2 px-3 py-1.5 text-xs font-medium leading-none btn-secondary disabled:opacity-50"
                disabled={creatingSession}
              >
                {str.admin.reviewTestSession.createButton}
              </button>
              <button
                type="button"
                className="rounded border-2 px-3 py-1.5 text-xs font-medium leading-none btn-neutral disabled:opacity-50"
                disabled={creatingSession}
                onClick={() => {
                  setSessionFormOpen(false);
                  setSessionNameInput("");
                }}
              >
                {str.admin.reviewTestSession.cancelButton}
              </button>
            </form>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left">
                  <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={allDueVisibleSelected}
                      onChange={(event) => toggleAllDueVisibleSelection(event.target.checked)}
                      title={allEditorStr.tooltips.selectAllVisible}
                    />
                    {allEditorStr.selectAllVisible}
                  </label>
                </th>
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
                <th className="px-3 py-2 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleDueWordsSort("testCount")}
                  >
                    {str.due.table.testCount}{" "}
                    <span aria-hidden>{getDueSortIndicator("testCount")}</span>
                  </button>
                </th>
                <th className="px-3 py-2 text-left">{str.due.table.action}</th>
              </tr>
            </thead>
            <tbody>
              {sortedDueWords.map(({ word, familiarity, testCount }) => (
                <tr key={`due-${word.id}`} className="border-b align-top">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedDueWordIds.includes(word.id)}
                      onChange={() => toggleDueWordSelection(word.id)}
                      aria-label={word.hanzi}
                    />
                  </td>
                  <td className="px-3 py-2">{word.hanzi}</td>
                  <td className="px-3 py-2">{formatDateTime(word.nextReviewAt)}</td>
                  <td className="px-3 py-2">{formatProbability(familiarity)}</td>
                  <td className="px-3 py-2">{testCount}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-confirm disabled:opacity-50"
                        onClick={() => openFlashcardReview(word.id)}
                      >
                        {str.due.table.flashcard}
                      </button>
                      {canAccessFillTest && (
                        <button
                          type="button"
                          className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-caution disabled:opacity-50"
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
        </>
      )}

    </section>
  );
}
