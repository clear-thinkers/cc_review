"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/authContext";
import type { QuizSession } from "./results.types";
import { getAllQuizSessions } from "@/lib/supabase-service";
import { computeSessionDisplayData, calculateSummaryStats } from "@/lib/results";
import { ResultsSummary } from "./ResultsSummary";
import { SessionHistoryTable } from "./SessionHistoryTable";
import { ClearHistoryDialog } from "./ClearHistoryDialog";
import { EmptyState } from "./EmptyState";
import type { ResultsLocaleStrings } from "./results.strings";
import styles from "./results.module.css";

export interface ResultsPageProps {
  strings: ResultsLocaleStrings;
}

export function ResultsPage({ strings }: ResultsPageProps) {
  const session = useSession();
  const isChild = session?.role === "child";
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Load sessions on mount and set up polling
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const data = await getAllQuizSessions();
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
  }, []);

  const handleClearClick = () => {
    setShowDialog(true);
  };

  const handleConfirmClear = async () => {
    setIsClearing(true);
    try {
      const { clearAllQuizSessions } = await import("@/lib/supabase-service");
      await clearAllQuizSessions();
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

  const summaryStats = sessions.length > 0 ? calculateSummaryStats(sessions) : null;

  return (
    <div className={styles.resultsContainer}>
      <div className={styles.resultsHeader}>
        <h1 className={styles.resultsTitle}>{strings.pageTitle}</h1>
      </div>

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
    </div>
  );
}
