"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Shared portal-rendered confirmation dialog for a deliberate departure from
 * the codebase's default immediate-delete-no-dialog convention (see
 * 0_BUILD_CONVENTIONS.md §5). Mirrors CashOutConfirmModal's structure
 * exactly (src/app/words/shop/ShopSection.tsx) -- the precedent the
 * paragraph-quiz feature spec cites for Delete Paragraph / Delete Test
 * Mode, which are the first two callers. No shared modal primitive existed
 * before this component; extracted here rather than copy-pasted a second
 * time in the same change.
 */
export type ConfirmDeleteDialogProps = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
};

export default function ConfirmDeleteDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmDisabled = false,
}: ConfirmDeleteDialogProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/35 p-4" onClick={onCancel}>
      <div className="flex min-h-full items-center justify-center">
        <div
          className="w-full max-w-md rounded-[1.5rem] border-2 border-[#dcc38a] bg-[#fffaf0] p-5 shadow-[0_24px_60px_rgba(85,122,84,0.18)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-dialog-title"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 id="confirm-delete-dialog-title" className="text-xl font-semibold text-gray-900">
            {title}
          </h2>
          <p className="mt-3 text-sm text-gray-700">{body}</p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              className="btn-neutral flex-1 rounded-md border-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
              onClick={onCancel}
              disabled={confirmDisabled}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className="btn-destructive flex-1 rounded-md border-2 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
