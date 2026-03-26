"use client";

import type { ResultsLocaleStrings } from "./results.strings.types";
import styles from "./results.module.css";

export interface ClearHistoryDialogProps {
  strings: ResultsLocaleStrings;
  isClearing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ClearHistoryDialog({
  strings,
  isClearing,
  onConfirm,
  onCancel,
}: ClearHistoryDialogProps) {
  return (
    <div className={styles.dialogOverlay}>
      <div className={styles.dialog}>
        <h2 className={styles.dialogTitle}>{strings.clearHistory.title}</h2>
        <p className={styles.dialogMessage}>{strings.clearHistory.message}</p>
        <div className={styles.dialogActions}>
          <button
            className={styles.dialogButton + " " + styles.dialogButtonCancel}
            onClick={onCancel}
            disabled={isClearing}
          >
            {strings.clearHistory.cancelButton}
          </button>
          <button
            className={styles.dialogButton + " " + styles.dialogButtonDelete}
            onClick={onConfirm}
            disabled={isClearing}
          >
            {isClearing ? "..." : strings.clearHistory.confirmButton}
          </button>
        </div>
      </div>
    </div>
  );
}
