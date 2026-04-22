"use client";

import { useEffect, useState } from "react";
import type { ResultsLocaleStrings } from "./results.strings.types";
import styles from "./results.module.css";

export interface SendFailedToSessionDialogProps {
  strings: ResultsLocaleStrings;
  initialSessionName: string;
  failedCharacters: string[];
  isSubmitting: boolean;
  onConfirm: (sessionName: string) => void;
  onCancel: () => void;
}

export function SendFailedToSessionDialog({
  strings,
  initialSessionName,
  failedCharacters,
  isSubmitting,
  onConfirm,
  onCancel,
}: SendFailedToSessionDialogProps) {
  const [sessionName, setSessionName] = useState(initialSessionName);

  useEffect(() => {
    setSessionName(initialSessionName);
  }, [initialSessionName]);

  const trimmedSessionName = sessionName.trim();

  return (
    <div className={styles.dialogOverlay}>
      <div className={styles.dialog}>
        <h2 className={styles.dialogTitle}>{strings.sendFailedToSession.dialog.title}</h2>
        <p className={styles.dialogMessage}>{strings.sendFailedToSession.dialog.message}</p>
        <div className={styles.dialogField}>
          <label className={styles.dialogLabel} htmlFor="results-send-session-name">
            {strings.sendFailedToSession.dialog.nameLabel}
          </label>
          <input
            id="results-send-session-name"
            className={styles.dialogInput}
            type="text"
            value={sessionName}
            placeholder={strings.sendFailedToSession.dialog.namePlaceholder}
            onChange={(event) => setSessionName(event.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <p className={styles.dialogSummary}>
          {strings.sendFailedToSession.dialog.failedCharacters.replace(
            "{chars}",
            failedCharacters.join("、")
          )}
        </p>
        <div className={styles.dialogActions}>
          <button
            type="button"
            className="btn-neutral rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {strings.sendFailedToSession.dialog.cancelButton}
          </button>
          <button
            type="button"
            className="btn-secondary rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
            onClick={() => onConfirm(trimmedSessionName)}
            disabled={isSubmitting || trimmedSessionName.length === 0}
          >
            {isSubmitting ? strings.sendFailedToSession.dialog.submittingButton : strings.sendFailedToSession.dialog.confirmButton}
          </button>
        </div>
      </div>
    </div>
  );
}
