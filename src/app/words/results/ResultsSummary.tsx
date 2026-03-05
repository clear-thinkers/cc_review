"use client";

import type { ResultsSummaryStats } from "./results.types";
import type { ResultsLocaleStrings } from "./results.strings";
import { formatTotalDuration } from "@/lib/results";
import styles from "./results.module.css";

export interface ResultsSummaryProps {
  stats: ResultsSummaryStats;
  strings: ResultsLocaleStrings;
}

export function ResultsSummary({ stats, strings }: ResultsSummaryProps) {
  const formatDuration =
    strings.locale === "zh"
      ? (seconds: number) => {
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          if (hours > 0) {
            return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
          }
          return `${minutes}分钟`;
        }
      : formatTotalDuration;

  return (
    <div className={styles.summaryCardsContainer}>
      <Card label={strings.summary.totalSessions} value={stats.totalSessions} />
      <Card label={strings.summary.fullyCorrectPercent} value={`${stats.fullyCorrectPercent}%`} />
      <Card label={strings.summary.failedPercent} value={`${stats.failedPercent}%`} />
      <Card label={strings.summary.partiallyCorrectPercent} value={`${stats.partiallyCorrectPercent}%`} />
      <Card label={strings.summary.totalCharactersTested} value={stats.totalCharactersTested} />
      <Card label={strings.summary.totalDuration} value={formatDuration(stats.totalDurationSeconds)} />
      <Card label={strings.summary.totalCoinsEarned} value={`🪙 ${stats.totalCoinsEarned}`} />
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryCardLabel}>{label}</div>
      <div className={styles.summaryCardValue}>{value}</div>
    </div>
  );
}
