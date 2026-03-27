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
      <button
        className="btn-nav rounded-full border-2 px-6 py-3 text-lg font-bold transition hover:bg-[#fff1cd]"
        onClick={handleGoToReview}
      >
        {strings.emptyState.action}
      </button>
    </div>
  );
}
