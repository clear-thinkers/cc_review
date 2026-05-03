"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import type { ResultsLocaleStrings } from "./results.strings.types";
import styles from "./results.module.css";

export interface DialogAnchorRect {
  bottom: number;
  left: number;
  top: number;
}

export interface AnchoredDialogPositionInput {
  anchorRect: DialogAnchorRect;
  viewportWidth: number;
  viewportHeight: number;
  dialogWidth: number;
  dialogHeight: number;
  gutter?: number;
  offset?: number;
}

export function calculateAnchoredDialogPosition({
  anchorRect,
  viewportWidth,
  viewportHeight,
  dialogWidth,
  dialogHeight,
  gutter = 12,
  offset = 8,
}: AnchoredDialogPositionInput): { left: number; top: number } {
  const maxLeft = Math.max(gutter, viewportWidth - dialogWidth - gutter);
  const left = Math.min(Math.max(anchorRect.left, gutter), maxLeft);
  const belowTop = anchorRect.bottom + offset;
  const aboveTop = anchorRect.top - dialogHeight - offset;
  const fitsBelow = belowTop + dialogHeight <= viewportHeight - gutter;
  const preferredTop = fitsBelow ? belowTop : aboveTop;
  const maxTop = Math.max(gutter, viewportHeight - dialogHeight - gutter);
  const top = Math.min(Math.max(preferredTop, gutter), maxTop);

  return { left, top };
}

export interface SendFailedToSessionDialogProps {
  strings: ResultsLocaleStrings;
  initialSessionName: string;
  failedCharacters: string[];
  anchorRect: DialogAnchorRect | null;
  isSubmitting: boolean;
  onConfirm: (sessionName: string) => void;
  onCancel: () => void;
}

export function SendFailedToSessionDialog({
  strings,
  initialSessionName,
  failedCharacters,
  anchorRect,
  isSubmitting,
  onConfirm,
  onCancel,
}: SendFailedToSessionDialogProps) {
  const [sessionName, setSessionName] = useState(initialSessionName);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [dialogPosition, setDialogPosition] = useState<CSSProperties | undefined>();

  useEffect(() => {
    setSessionName(initialSessionName);
  }, [initialSessionName]);

  useEffect(() => {
    if (!anchorRect) {
      setDialogPosition(undefined);
      return;
    }

    const updatePosition = () => {
      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      const dialogRect = dialog.getBoundingClientRect();
      const position = calculateAnchoredDialogPosition({
        anchorRect,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        dialogWidth: dialogRect.width,
        dialogHeight: dialogRect.height,
      });

      setDialogPosition({
        left: position.left,
        position: "fixed",
        top: position.top,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRect, failedCharacters.length, initialSessionName]);

  const trimmedSessionName = sessionName.trim();
  const resolvedDialogStyle: CSSProperties | undefined = anchorRect
    ? dialogPosition ?? { left: 0, position: "fixed", top: 0, visibility: "hidden" }
    : undefined;

  return (
    <div className={styles.dialogOverlay}>
      <div ref={dialogRef} className={styles.dialog} style={resolvedDialogStyle}>
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
