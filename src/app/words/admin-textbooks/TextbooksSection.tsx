"use client";

import { useState, useEffect, useCallback } from "react";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import {
  listAllTextbooksForAdmin,
  createSharedTextbook,
  updateTextbookLabels,
  deleteTextbook,
  type TextbookLabelUpdates,
} from "@/lib/supabase-service";
import type { Textbook } from "../shared/tagging.types";
import { useLocale } from "@/app/shared/locale";
import { adminTextbooksStrings } from "./admin-textbooks.strings";

// ─── Types ───────────────────────────────────────────────────────────────────

type EditState = {
  textbookId: string;
  name: string;
  slot1Label: string;
  slot2Label: string;
  slot3Label: string;
  slot1LabelZh: string;
  slot2LabelZh: string;
  slot3LabelZh: string;
  saving: boolean;
  notice: string | null;
};

type CreateState = {
  name: string;
  slot1Label: string;
  slot2Label: string;
  slot3Label: string;
  slot1LabelZh: string;
  slot2LabelZh: string;
  slot3LabelZh: string;
  saving: boolean;
  notice: string | null;
};

const EMPTY_CREATE: CreateState = {
  name: "",
  slot1Label: "",
  slot2Label: "",
  slot3Label: "",
  slot1LabelZh: "",
  slot2LabelZh: "",
  slot3LabelZh: "",
  saving: false,
  notice: null,
};

function nullIfEmpty(s: string): string | null {
  return s.trim() || null;
}

// ─── Section ─────────────────────────────────────────────────────────────────

export default function TextbooksSection({ vm }: { vm: WordsWorkspaceVM }) {
  const { page } = vm;
  const locale = useLocale();
  const str = adminTextbooksStrings[locale];

  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [createState, setCreateState] = useState<CreateState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Load on mount
  const reload = useCallback(() => {
    setLoading(true);
    listAllTextbooksForAdmin()
      .then(setTextbooks)
      .catch((err: unknown) =>
        setLoadError(err instanceof Error ? err.message : "Failed to load")
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (page === "adminTextbooks") reload();
  }, [page, reload]);

  // Handle opening edit
  const handleEdit = useCallback((tb: Textbook) => {
    setEditState({
      textbookId: tb.id,
      name: tb.name,
      slot1Label: tb.slot1Label ?? "",
      slot2Label: tb.slot2Label ?? "",
      slot3Label: tb.slot3Label ?? "",
      slot1LabelZh: tb.slot1LabelZh ?? "",
      slot2LabelZh: tb.slot2LabelZh ?? "",
      slot3LabelZh: tb.slot3LabelZh ?? "",
      saving: false,
      notice: null,
    });
  }, []);

  // Handle save edit
  const handleSaveEdit = useCallback(async () => {
    if (!editState) return;
    setEditState((prev) => prev && { ...prev, saving: true, notice: null });
    try {
      const updates: TextbookLabelUpdates = {
        name: editState.name,
        slot1Label: nullIfEmpty(editState.slot1Label),
        slot2Label: nullIfEmpty(editState.slot2Label),
        slot3Label: nullIfEmpty(editState.slot3Label),
        slot1LabelZh: nullIfEmpty(editState.slot1LabelZh),
        slot2LabelZh: nullIfEmpty(editState.slot2LabelZh),
        slot3LabelZh: nullIfEmpty(editState.slot3LabelZh),
      };
      const updated = await updateTextbookLabels(editState.textbookId, updates);
      setTextbooks((prev) =>
        prev.map((tb) => (tb.id === updated.id ? updated : tb))
      );
      setEditState(null);
    } catch (err) {
      setEditState((prev) =>
        prev && {
          ...prev,
          saving: false,
          notice: err instanceof Error ? err.message : "Save failed.",
        }
      );
    }
  }, [editState]);

  // Handle create
  const handleCreate = useCallback(async () => {
    if (!createState || !createState.name.trim()) return;
    setCreateState((prev) => prev && { ...prev, saving: true, notice: null });
    try {
      const created = await createSharedTextbook(createState.name, {
        slot1Label: nullIfEmpty(createState.slot1Label),
        slot2Label: nullIfEmpty(createState.slot2Label),
        slot3Label: nullIfEmpty(createState.slot3Label),
        slot1LabelZh: nullIfEmpty(createState.slot1LabelZh),
        slot2LabelZh: nullIfEmpty(createState.slot2LabelZh),
        slot3LabelZh: nullIfEmpty(createState.slot3LabelZh),
      });
      setTextbooks((prev) => [created, ...prev]);
      setCreateState(null);
    } catch (err) {
      setCreateState((prev) =>
        prev && {
          ...prev,
          saving: false,
          notice: err instanceof Error ? err.message : "Create failed.",
        }
      );
    }
  }, [createState]);

  // Handle delete
  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteTextbook(id);
      setTextbooks((prev) => prev.filter((tb) => tb.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleteConfirm(null);
    }
  }, []);

  if (page !== "adminTextbooks") return null;

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{str.pageTitle}</h2>
      <p className="text-sm text-gray-700">{str.pageDescription}</p>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {/* Create trigger */}
      {!createState && (
        <button
          type="button"
          className="text-sm text-blue-600 underline"
          onClick={() => setCreateState({ ...EMPTY_CREATE })}
        >
          {str.createButton}
        </button>
      )}

      {/* Create form */}
      {createState && (
        <div className="space-y-3 rounded-md border p-3">
          <p className="text-xs font-medium text-gray-600">{str.newTextbookTitle}</p>
          <TextbookForm str={str} state={createState} onChange={(field, value) =>
            setCreateState((prev) => prev && { ...prev, [field]: value })
          } showName />
          {createState.notice && (
            <p className="text-sm text-red-600">{createState.notice}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
              disabled={createState.saving || !createState.name.trim()}
              onClick={() => void handleCreate()}
            >
              {createState.saving ? str.creating : str.createConfirm}
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
              onClick={() => setCreateState(null)}
              disabled={createState.saving}
            >
              {str.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <p className="text-sm text-gray-600">{str.loading}</p>}

      {/* Empty state */}
      {!loading && !loadError && textbooks.length === 0 && (
        <p className="text-sm text-gray-600">{str.noTextbooks}</p>
      )}

      {/* Textbook rows */}
      {textbooks.map((tb) => (
        <div key={tb.id} className="space-y-2 rounded-md border p-3">
          {/* Row header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="font-medium">{tb.name}</span>
              {tb.isShared ? (
                <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                  {str.sharedBadge}
                </span>
              ) : (
                <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                  {str.privateBadge}
                </span>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {str.slotsPreview}{" "}
                {[tb.slot1Label, tb.slot2Label, tb.slot3Label]
                  .filter(Boolean)
                  .join(" → ") || str.noSlots}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                onClick={() =>
                  editState?.textbookId === tb.id
                    ? setEditState(null)
                    : handleEdit(tb)
                }
              >
                {editState?.textbookId === tb.id ? str.cancel : str.edit}
              </button>
              {tb.isShared && (
                <button
                  type="button"
                  className="rounded-md border border-rose-400 px-3 py-2 text-sm text-rose-600 disabled:opacity-50"
                  onClick={() => setDeleteConfirm(tb.id)}
                >
                  {str.delete}
                </button>
              )}
            </div>
          </div>

          {/* Inline edit */}
          {editState?.textbookId === tb.id && (
            <div className="space-y-3 border-t pt-3">
              <TextbookForm
                str={str}
                state={editState}
                onChange={(field, value) =>
                  setEditState((prev) => prev && { ...prev, [field]: value })
                }
                showName
              />
              {editState.notice && (
                <p className="text-sm text-red-600">{editState.notice}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
                  disabled={editState.saving}
                  onClick={() => void handleSaveEdit()}
                >
                  {editState.saving ? str.saving : str.save}
                </button>
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                  onClick={() => setEditState(null)}
                >
                  {str.cancel}
                </button>
              </div>
            </div>
          )}

          {/* Delete confirm */}
          {deleteConfirm === tb.id && (
            <div className="border-t pt-3 text-sm">
              <p className="text-gray-700">
                Delete <strong>{tb.name}</strong>? This cannot be undone.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded-md bg-black px-3 py-2 text-sm text-white"
                  onClick={() => void handleDelete(tb.id)}
                >
                  {str.deleteConfirmButton}
                </button>
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm"
                  onClick={() => setDeleteConfirm(null)}
                >
                  {str.cancel}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

// ─── TextbookForm ─────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  slot1Label: string;
  slot2Label: string;
  slot3Label: string;
  slot1LabelZh: string;
  slot2LabelZh: string;
  slot3LabelZh: string;
  saving: boolean;
};

type TextbookFormProps = {
  str: (typeof adminTextbooksStrings)["en"];
  state: FormState;
  showName: boolean;
  onChange: (
    field:
      | "name"
      | "slot1Label"
      | "slot2Label"
      | "slot3Label"
      | "slot1LabelZh"
      | "slot2LabelZh"
      | "slot3LabelZh",
    value: string
  ) => void;
};

function TextbookForm({ str, state, showName, onChange }: TextbookFormProps) {
  const slots = [
    {
      enField: "slot1Label" as const,
      zhField: "slot1LabelZh" as const,
      enLabel: str.slot1LabelEN,
      zhLabel: str.slot1LabelZH,
      enValue: state.slot1Label,
      zhValue: state.slot1LabelZh,
      enPlaceholder: str.slot1Placeholder,
      zhPlaceholder: str.slot1ZhPlaceholder,
    },
    {
      enField: "slot2Label" as const,
      zhField: "slot2LabelZh" as const,
      enLabel: str.slot2LabelEN,
      zhLabel: str.slot2LabelZH,
      enValue: state.slot2Label,
      zhValue: state.slot2LabelZh,
      enPlaceholder: str.slot2Placeholder,
      zhPlaceholder: str.slot2ZhPlaceholder,
    },
    {
      enField: "slot3Label" as const,
      zhField: "slot3LabelZh" as const,
      enLabel: str.slot3LabelEN,
      zhLabel: str.slot3LabelZH,
      enValue: state.slot3Label,
      zhValue: state.slot3LabelZh,
      enPlaceholder: str.slot3Placeholder,
      zhPlaceholder: str.slot3ZhPlaceholder,
    },
  ];

  return (
    <div className="space-y-2">
      {showName && (
        <div>
          <label className="block text-xs text-gray-500">{str.nameLabel}</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            value={state.name}
            onChange={(e) => onChange("name", e.target.value)}
            disabled={state.saving}
            placeholder={str.namePlaceholder}
          />
        </div>
      )}
      {slots.map((s) => (
        <div key={s.enField} className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-500">{s.enLabel}</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
              value={s.enValue}
              onChange={(e) => onChange(s.enField, e.target.value)}
              disabled={state.saving}
              placeholder={s.enPlaceholder}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500">{s.zhLabel}</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
              value={s.zhValue}
              onChange={(e) => onChange(s.zhField, e.target.value)}
              disabled={state.saving}
              placeholder={s.zhPlaceholder}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
