"use client";

import { useRouter } from "next/navigation";
import type { ResultsLocaleStrings } from "./results.strings.types";
import styles from "./results.module.css";

export interface EmptyStateProps {
  strings: ResultsLocaleStrings;
}

export function EmptyState({ strings }: EmptyStateProps) {
  const router = useRouter();

  const handleGoToReview = () => {
    router.push("/words/review");
  };

  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyStateIcon}>⌘</div>
      <h2 className={styles.emptyStateHeading}>{strings.emptyState.heading}</h2>
      <p className={styles.emptyStateMessage}>{strings.emptyState.message}</p>
      <button className={styles.emptyStateAction} onClick={handleGoToReview}>
        {strings.emptyState.action}
      </button>
    </div>
  );
}
