"use client";

import { useState } from "react";
import type { QuizSession } from "./results.types";
import type { ResultsLocaleStrings } from "./results.strings.types";
import { computeSessionDisplayData } from "@/lib/results";
import styles from "./results.module.css";

export interface SessionHistoryTableProps {
  sessions: QuizSession[];
  strings: ResultsLocaleStrings;
  onClearClick: () => void;
  hideDestructiveActions?: boolean;
}

type SortField =
  | "createdAt"
  | "fullyCorrectPercent"
  | "failedPercent"
  | "partiallyCorrectPercent"
  | "durationSeconds"
  | "testedCount"
  | "failedCount"
  | "coinsEarned";

type SortDirection = "asc" | "desc";

export function SessionHistoryTable({
  sessions,
  strings,
  onClearClick,
  hideDestructiveActions,
}: SessionHistoryTableProps) {
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleHeaderClick = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const displayData = sessions.map((session) => computeSessionDisplayData(session, strings.locale));

  const sortedData = [...displayData].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    // Handle different sort fields
    if (
      sortField === "fullyCorrectPercent" ||
      sortField === "failedPercent" ||
      sortField === "partiallyCorrectPercent"
    ) {
      aValue = a[sortField];
      bValue = b[sortField];
    } else if (sortField === "testedCount") {
      aValue = a.charactersTested.length;
      bValue = b.charactersTested.length;
    } else if (sortField === "failedCount") {
      aValue = a.charactersFailed.length;
      bValue = b.charactersFailed.length;
    } else if (sortField === "createdAt" || sortField === "durationSeconds" || sortField === "coinsEarned") {
      aValue = a[sortField];
      bValue = b[sortField];
    }

    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  const isSortableField = (field: string): field is SortField => {
    return [
      "createdAt",
      "fullyCorrectPercent",
      "failedPercent",
      "partiallyCorrectPercent",
      "durationSeconds",
      "testedCount",
      "failedCount",
      "coinsEarned",
    ].includes(field);
  };

  const headerCellClass = (field: SortField) => {
    let className = styles.sessionTableHeaderCell + " " + styles.sortable;
    if (sortField === field) {
      className += " " + (sortDirection === "asc" ? styles.ascending : styles.descending);
    }
    return className;
  };

  const truncateCharacters = (chars: string[], maxLength = 10): string => {
    if (chars.length <= maxLength) {
      return chars.join("、");
    }
    return chars.slice(0, maxLength).join("、") + "…";
  };

  return (
    <div className={styles.tableSection}>
      <div className={styles.tableSectionHeader}>
        <h2 className={styles.tableSectionTitle}>{strings.table.headers.date}</h2>
        {sessions.length > 0 && !hideDestructiveActions && (
          <button
            className="btn-destructive rounded border-2 px-3 py-1 text-[11px] font-medium leading-none disabled:opacity-50"
            onClick={onClearClick}
          >
            {strings.clearHistory.button}
          </button>
        )}
      </div>

      {sessions.length === 0 ? null : (
        <div style={{ overflowX: "auto" }}>
          <table className={styles.sessionTable}>
            <thead className={styles.sessionTableHeader}>
              <tr>
                <th
                  className={headerCellClass("createdAt")}
                  onClick={() => handleHeaderClick("createdAt")}
                >
                  {strings.table.headers.date}
                </th>
                <th
                  className={headerCellClass("fullyCorrectPercent")}
                  onClick={() => handleHeaderClick("fullyCorrectPercent")}
                >
                  {strings.table.headers.fullyCorrectPercent}
                </th>
                <th
                  className={headerCellClass("failedPercent")}
                  onClick={() => handleHeaderClick("failedPercent")}
                >
                  {strings.table.headers.failedPercent}
                </th>
                <th
                  className={headerCellClass("partiallyCorrectPercent")}
                  onClick={() => handleHeaderClick("partiallyCorrectPercent")}
                >
                  {strings.table.headers.partiallyCorrectPercent}
                </th>
                <th
                  className={headerCellClass("durationSeconds")}
                  onClick={() => handleHeaderClick("durationSeconds")}
                >
                  {strings.table.headers.duration}
                </th>
                <th
                  className={headerCellClass("testedCount")}
                  onClick={() => handleHeaderClick("testedCount")}
                >
                  {strings.table.headers.testedCount}
                </th>
                <th className={styles.sessionTableHeaderCell}>{strings.table.headers.testedCharacters}</th>
                <th
                  className={headerCellClass("failedCount")}
                  onClick={() => handleHeaderClick("failedCount")}
                >
                  {strings.table.headers.failedCount}
                </th>
                <th className={styles.sessionTableHeaderCell}>{strings.table.headers.failedCharacters}</th>
                <th
                  className={headerCellClass("coinsEarned")}
                  onClick={() => handleHeaderClick("coinsEarned")}
                >
                  {strings.table.headers.coinsEarned}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((session) => (
                <tr key={session.id} className={styles.sessionTableRow}>
                  <td className={styles.sessionTableCell}>{session.sessionDate}</td>
                  <td className={styles.sessionTableCell + " " + styles.numeric}>
                    {session.fullyCorrectPercent}%
                  </td>
                  <td className={styles.sessionTableCell + " " + styles.numeric}>
                    {session.failedPercent}%
                  </td>
                  <td className={styles.sessionTableCell + " " + styles.numeric}>
                    {session.partiallyCorrectPercent}%
                  </td>
                  <td className={styles.sessionTableCell + " " + styles.numeric}>
                    {session.durationDisplay}
                  </td>
                  <td className={styles.sessionTableCell + " " + styles.numeric}>
                    {session.charactersTested.length}
                  </td>
                  <td className={styles.sessionTableCell + " " + styles.characters}>
                    {session.charactersTested.length > 0
                      ? truncateCharacters(session.charactersTested)
                      : strings.table.noCharacters}
                  </td>
                  <td className={styles.sessionTableCell + " " + styles.numeric}>
                    {session.charactersFailed.length}
                  </td>
                  <td className={styles.sessionTableCell + " " + styles.characters}>
                    {session.charactersFailed.length > 0
                      ? truncateCharacters(session.charactersFailed)
                      : strings.table.noCharacters}
                  </td>
                  <td className={styles.sessionTableCell + " " + styles.numeric}>
                    {session.coinsEarned}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
