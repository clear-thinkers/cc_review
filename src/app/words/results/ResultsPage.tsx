"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth, useSession } from "@/lib/authContext";
import { resolveChildProfileTarget } from "@/lib/child-profile-target";
import type { QuizSession } from "./results.types";
import {
  appendTargetsToReviewTestSession,
  createReviewTestSession,
  getAllFlashcardContents,
  getAllQuizSessions,
  getAllWords,
  listReviewTestSessions,
} from "@/lib/supabase-service";
import { calculateSummaryStats, computeSessionDisplayData, getFailedCharacters } from "@/lib/results";
import { resolveFailedCharactersToReviewTestTargets } from "@/lib/resultsReviewTestSession";
import { ResultsSummary } from "./ResultsSummary";
import { SessionHistoryTable } from "./SessionHistoryTable";
import { ClearHistoryDialog } from "./ClearHistoryDialog";
import { EmptyState } from "./EmptyState";
import { SendFailedToSessionDialog } from "./SendFailedToSessionDialog";
import type { ResultsLocaleStrings } from "./results.strings.types";
import { sortReviewTestSessionTargets } from "../review/reviewSession.utils";
import styles from "./results.module.css";

export interface ResultsPageProps {
  strings: ResultsLocaleStrings;
}

export function ResultsPage({ strings }: ResultsPageProps) {
  const session = useSession();
  const { familyProfiles } = useAuth();
  const isChild = session?.role === "child";
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [sendNotice, setSendNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [sendDialogSession, setSendDialogSession] = useState<QuizSession | null>(null);
  const [isSendingFailedCharacters, setIsSendingFailedCharacters] = useState(false);
  const childTarget = useMemo(
    () => resolveChildProfileTarget(session, familyProfiles),
    [familyProfiles, session]
  );

  // Load sessions on mount and set up polling
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const data = await getAllQuizSessions(childTarget?.userId);
        setSessions(data);
      } catch (error) {
        console.error("Failed to load quiz sessions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSessions();

    // Poll for new sessions every 1 second to detect changes after grading
    const intervalId = setInterval(loadSessions, 1000);
    return () => clearInterval(intervalId);
  }, [childTarget?.userId]);

  const handleClearClick = () => {
    setShowDialog(true);
  };

  const buildSuggestedSessionName = (createdAt: number): string => {
    const date = new Date(createdAt);
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");

    return strings.sendFailedToSession.suggestedName
      .replace("{date}", `${yyyy}-${mm}-${dd}`)
      .replace("{time}", `${hh}:${min}`);
  };

  const handleConfirmClear = async () => {
    setIsClearing(true);
    try {
      const { clearAllQuizSessions } = await import("@/lib/supabase-service");
      await clearAllQuizSessions(childTarget?.userId);
      setSessions([]);
      setShowDialog(false);
    } catch (error) {
      console.error("Failed to clear quiz sessions:", error);
    } finally {
      setIsClearing(false);
    }
  };

  const handleCancelClear = () => {
    setShowDialog(false);
  };

  const handleOpenSendFailedDialog = (quizSession: QuizSession) => {
    setSendNotice(null);
    setSendDialogSession(quizSession);
  };

  const handleCancelSendFailedDialog = () => {
    if (isSendingFailedCharacters) {
      return;
    }

    setSendDialogSession(null);
  };

  const handleConfirmSendFailedDialog = async (sessionName: string) => {
    const sourceSession = sendDialogSession;
    const trimmedName = sessionName.trim();

    if (!sourceSession) {
      return;
    }

    if (!trimmedName) {
      setSendNotice({
        tone: "error",
        message: strings.sendFailedToSession.messages.nameRequired,
      });
      return;
    }

    const failedCharacters = getFailedCharacters(sourceSession.gradeData);
    if (failedCharacters.length === 0) {
      setSendDialogSession(null);
      setSendNotice({
        tone: "error",
        message: strings.sendFailedToSession.messages.noFailedCharacters,
      });
      return;
    }

    setIsSendingFailedCharacters(true);
    setSendNotice(null);

    try {
      const [words, allFlashcardContents, reviewTestSessions] = await Promise.all([
        getAllWords(),
        getAllFlashcardContents(),
        listReviewTestSessions(),
      ]);
      const resolution = resolveFailedCharactersToReviewTestTargets(
        failedCharacters,
        words,
        allFlashcardContents
      );

      if (resolution.targets.length === 0) {
        setSendDialogSession(null);
        setSendNotice({
          tone: "error",
          message: strings.sendFailedToSession.messages.noEligibleTargets,
        });
        return;
      }

      const orderedTargets = sortReviewTestSessionTargets(resolution.targets, words);
      const existingSession =
        reviewTestSessions.find((sessionItem) => sessionItem.name === trimmedName) ?? null;
      let message: string;

      if (existingSession) {
        const addedCount = await appendTargetsToReviewTestSession(existingSession.id, orderedTargets);
        message =
          addedCount > 0
            ? strings.sendFailedToSession.messages.appendSuccess
                .replace("{name}", trimmedName)
                .replace("{count}", String(addedCount))
            : strings.sendFailedToSession.messages.noNewTargets.replace("{name}", trimmedName);
      } else {
        await createReviewTestSession(trimmedName, orderedTargets);
        message = strings.sendFailedToSession.messages.createSuccess
          .replace("{name}", trimmedName)
          .replace("{count}", String(orderedTargets.length));
      }

      if (resolution.skippedCharacters.length > 0) {
        message += ` ${strings.sendFailedToSession.messages.skippedCharacters.replace(
          "{count}",
          String(resolution.skippedCharacters.length)
        )}`;
      }

      setSendDialogSession(null);
      setSendNotice({
        tone: "success",
        message,
      });
    } catch (error) {
      setSendNotice({
        tone: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : strings.sendFailedToSession.messages.createError,
      });
    } finally {
      setIsSendingFailedCharacters(false);
    }
  };

  const summaryStats = sessions.length > 0 ? calculateSummaryStats(sessions) : null;
  const failedCharactersForDialog = sendDialogSession
    ? computeSessionDisplayData(sendDialogSession, strings.locale).charactersFailed
    : [];

  return (
    <div className={styles.resultsContainer}>
      <div className={styles.resultsHeader}>
        <h1 className={styles.resultsTitle}>{strings.pageTitle}</h1>
        {childTarget && !childTarget.isCurrentSessionTarget ? (
          <p className="text-sm text-gray-600">
            {strings.viewingProfile.replace("{name}", childTarget.userName)}
          </p>
        ) : null}
      </div>

      {sendNotice ? (
        <p
          className={
            sendNotice.tone === "error" ? styles.feedbackNoticeError : styles.feedbackNoticeSuccess
          }
        >
          {sendNotice.message}
        </p>
      ) : null}

      {isLoading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <span>{strings.pageTitle}</span>
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState strings={strings} />
      ) : (
        <>
          {summaryStats && <ResultsSummary stats={summaryStats} strings={strings} />}
          <SessionHistoryTable
            sessions={sessions}
            strings={strings}
            onClearClick={handleClearClick}
            onSendFailedToSession={handleOpenSendFailedDialog}
            sendingSessionId={isSendingFailedCharacters ? sendDialogSession?.id ?? null : null}
            hideDestructiveActions={isChild}
          />
        </>
      )}

      {showDialog && (
        <ClearHistoryDialog
          strings={strings}
          isClearing={isClearing}
          onConfirm={handleConfirmClear}
          onCancel={handleCancelClear}
        />
      )}

      {sendDialogSession ? (
        <SendFailedToSessionDialog
          strings={strings}
          initialSessionName={buildSuggestedSessionName(sendDialogSession.createdAt)}
          failedCharacters={failedCharactersForDialog}
          isSubmitting={isSendingFailedCharacters}
          onConfirm={handleConfirmSendFailedDialog}
          onCancel={handleCancelSendFailedDialog}
        />
      ) : null}
    </div>
  );
}
