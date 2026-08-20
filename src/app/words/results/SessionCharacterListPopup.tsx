"use client";

import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import type { ResultsLocaleStrings } from "./results.strings.types";
import type { Grade } from "@/lib/scheduler";
import { calculateAnchoredDialogPosition, type DialogAnchorRect } from "./SendFailedToSessionDialog";
import styles from "./results.module.css";

export type SessionCharacterListPopupContent =
  | { kind: "characters"; title: string; items: string[] }
  | {
      kind: "paragraphBlanks";
      title: string;
      items: { text: string; tier: Grade; retryCount: number }[];
    };

export interface SessionCharacterListPopupProps {
  strings: ResultsLocaleStrings;
  content: SessionCharacterListPopupContent;
  // Always a real DOMRect from the triggering button's own
  // getBoundingClientRect() -- unlike SendFailedToSessionDialog.tsx's
  // anchorRect (nullable there because that dialog can open before an
  // anchor is resolved), this popup only ever opens from a click, so there
  // is no "no anchor yet" state to handle.
  anchorRect: DialogAnchorRect;
  onClose: () => void;
}

const ESTIMATED_DIALOG_WIDTH = 360;
const ESTIMATED_DIALOG_HEIGHT = 320;

/**
 * Read-only anchored popup listing every tested/failed item for a session
 * row in full (no truncation) -- replaces SessionHistoryTable.tsx's old
 * inline comma-separated Tested/Failed Characters lists, for EVERY
 * completed session row (not just paragraph-quiz ones), per feature spec
 * (resolved 2026-08-19). For a paragraph-quiz row, shows each blank's text,
 * earned tier, and retry count instead of a flat hanzi list.
 *
 * Mirrors SendFailedToSessionDialog.tsx's anchor/position mechanics exactly
 * (same calculateAnchoredDialogPosition, same ref/useLayoutEffect/resize
 * pattern) -- this popup is read/close-only, no name input or submit.
 */
export function SessionCharacterListPopup({
  strings,
  content,
  anchorRect,
  onClose,
}: SessionCharacterListPopupProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [dialogPosition, setDialogPosition] = useState<CSSProperties | undefined>(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const position = calculateAnchoredDialogPosition({
      anchorRect,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      dialogWidth: ESTIMATED_DIALOG_WIDTH,
      dialogHeight: ESTIMATED_DIALOG_HEIGHT,
    });

    return { left: position.left, position: "fixed", top: position.top };
  });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const dialogRect = dialog.getBoundingClientRect();
      const dialogWidth = dialogRect.width || ESTIMATED_DIALOG_WIDTH;
      const dialogHeight = dialogRect.height || ESTIMATED_DIALOG_HEIGHT;
      const position = calculateAnchoredDialogPosition({
        anchorRect,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        dialogWidth,
        dialogHeight,
      });

      setDialogPosition({ left: position.left, position: "fixed", top: position.top });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRect]);

  return (
    <div className={styles.contextualDialogOverlay}>
      <div className={styles.contextualDialogBackdrop} onClick={onClose} />
      <div className={styles.contextualDialogPositioner} style={dialogPosition}>
        <div ref={dialogRef} className={styles.dialog}>
          <h2 className={styles.dialogTitle}>{content.title}</h2>
          {content.kind === "characters" ? (
            <p className={styles.dialogMessage}>
              {content.items.length > 0 ? content.items.join("、") : strings.table.noCharacters}
            </p>
          ) : (
            <ul className={styles.dialogMessage}>
              {content.items.map((item, index) => (
                <li key={`${item.text}-${index}`}>
                  {item.text} — {strings.popup.blankTierLabel}: {item.tier}, {strings.popup.blankRetriesLabel}:{" "}
                  {item.retryCount}
                </li>
              ))}
            </ul>
          )}
          <div className={styles.dialogActions}>
            <button
              type="button"
              className="btn-neutral rounded-md border px-3 py-2 text-sm font-medium"
              onClick={onClose}
            >
              {strings.popup.closeButton}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
