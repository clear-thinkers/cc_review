"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/app/shared/locale";
import { useSession } from "@/lib/authContext";
import {
  listPromptSlots,
  upsertPromptSlot,
  updateDefaultPromptSlot,
  deletePromptSlot,
  setActivePromptSlot,
  type PromptTemplate,
  type PromptType,
} from "@/lib/supabase-service";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import { promptsStrings } from "./prompts.strings";
import {
  PROMPT_TYPES,
  PROMPT_CHAR_LIMITS,
  MAX_SLOT_NAME_LENGTH,
  MAX_USER_OWNED_SLOTS,
  PREVIEW_LENGTH,
  type PromptSlotValidationErrors,
  type EditTarget,
} from "./prompts.types";

export default function PromptsSection({ vm }: { vm: WordsWorkspaceVM }) {
  const locale = useLocale();
  const str = promptsStrings[locale];
  const session = useSession();

  const [activeTab, setActiveTab] = useState<PromptType>("full");
  const [slots, setSlots] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editErrors, setEditErrors] = useState<PromptSlotValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<PromptTemplate | null>(null);

  if (vm.page !== "prompts") {
    return null;
  }

  const isPlatformAdmin = session?.isPlatformAdmin ?? false;
  const userOwnedSlots = slots.filter((s) => !s.isDefault);
  const defaultSlot = slots.find((s) => s.isDefault);
  const slotsUsed = userOwnedSlots.length;
  const atSlotLimit = slotsUsed >= MAX_USER_OWNED_SLOTS;
  // The Default slot stays is_active=true in the DB as a fallback sentinel,
  // but should not appear active in the UI when a custom slot is already active.
  const hasActiveCustom = userOwnedSlots.some((s) => s.isActive);

  // Load slots whenever the active tab changes
  const loadSlots = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const data = await listPromptSlots(activeTab);
      setSlots(data);
      // Keep viewer in sync: replace the selected slot with its refreshed version (or clear it)
      setSelectedSlot((prev) => (prev ? (data.find((s) => s.id === prev.id) ?? null) : null));
    } catch {
      setNotice(str.loadError);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, str.loadError]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  function openEditForm(target: EditTarget, name: string, body: string) {
    setEditTarget(target);
    setEditName(name);
    setEditBody(body);
    setEditErrors({});
  }

  function handleSelectSlot(slot: PromptTemplate) {
    setSelectedSlot((prev) => (prev?.id === slot.id ? null : slot));
  }

  function closeEditForm() {
    setEditTarget(null);
    setEditName("");
    setEditBody("");
    setEditErrors({});
  }

  function validateForm(): PromptSlotValidationErrors {
    const errors: PromptSlotValidationErrors = {};
    if (!editName.trim()) {
      errors.name = str.nameRequired;
    } else if (editName.trim().length > MAX_SLOT_NAME_LENGTH) {
      errors.name = str.nameTooLong;
    }
    const limits = PROMPT_CHAR_LIMITS[activeTab];
    const bodyLen = editBody.length;
    if (bodyLen < limits.min) {
      errors.body = str.bodyTooShort;
    } else if (bodyLen > limits.max) {
      errors.body = str.bodyTooLong;
    }
    return errors;
  }

  async function handleSave() {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    setSaving(true);
    try {
      const isEditingDefault = editTarget !== "new" && slots.find((s) => s.id === editTarget)?.isDefault;
      if (isEditingDefault && editTarget && editTarget !== "new") {
        await updateDefaultPromptSlot(editTarget, { slotName: editName.trim(), promptBody: editBody });
      } else {
        await upsertPromptSlot({
          id: editTarget !== "new" ? (editTarget ?? undefined) : undefined,
          promptType: activeTab,
          slotName: editName.trim(),
          promptBody: editBody,
        });
      }
      setNotice(str.saveSuccess);
      closeEditForm();
      await loadSlots();
    } catch {
      setNotice(str.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePromptSlot(id);
      setNotice(str.deleteSuccess);
      if (editTarget === id) {
        closeEditForm();
      }
      await loadSlots();
    } catch {
      setNotice(str.deleteError);
    }
  }

  async function handleMakeActive(id: string) {
    try {
      await setActivePromptSlot(id, activeTab);
      setNotice(str.activateSuccess);
      await loadSlots();
    } catch {
      setNotice(str.activateError);
    }
  }

  const limits = PROMPT_CHAR_LIMITS[activeTab];
  const bodyLen = editBody.length;
  const bodyCounterClass =
    bodyLen < limits.min || bodyLen > limits.max ? "text-red-600" : "text-gray-500";

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">{str.pageTitle}</h2>
      <p className="text-sm text-gray-700">{str.pageDescription}</p>

      {/* Tab strip */}
      <div className="flex flex-wrap gap-1 border-b pb-2">
        {PROMPT_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setActiveTab(type);
              closeEditForm();
              setNotice(null);
            }}
            className={
              activeTab === type
                ? "rounded-md border-2 border-sky-400 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-800"
                : "rounded-md border px-3 py-1 text-sm font-medium hover:bg-gray-50"
            }
          >
            {str.tabs[type]}
          </button>
        ))}
      </div>

      {/* Notice */}
      {notice && <p className="text-sm text-blue-700">{notice}</p>}

      {loading ? (
        <p className="text-sm text-gray-600">{str.loading}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Default card */}
          {defaultSlot && (
            <SlotCard
              slot={defaultSlot}
              isEditing={editTarget === defaultSlot.id}
              isSelected={selectedSlot?.id === defaultSlot.id}
              displayAsActive={!hasActiveCustom && defaultSlot.isActive}
              isPlatformAdmin={isPlatformAdmin}
              str={str}
              onSelect={() => handleSelectSlot(defaultSlot)}
              onEdit={() => openEditForm(defaultSlot.id, defaultSlot.slotName, defaultSlot.promptBody)}
              onMakeActive={() => {/* Default is used automatically when no custom is active */}}
              onDelete={() => {/* Default cannot be deleted */}}
            />
          )}

          {/* User-owned slots */}
          {userOwnedSlots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              isEditing={editTarget === slot.id}
              isSelected={selectedSlot?.id === slot.id}
              isPlatformAdmin={isPlatformAdmin}
              str={str}
              onSelect={() => handleSelectSlot(slot)}
              onEdit={() => openEditForm(slot.id, slot.slotName, slot.promptBody)}
              onMakeActive={() => void handleMakeActive(slot.id)}
              onDelete={() => void handleDelete(slot.id)}
            />
          ))}

          {/* Add New Slot card */}
          <div className="flex min-h-[110px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 p-3">
            <button
              type="button"
              disabled={atSlotLimit}
              title={atSlotLimit ? str.addNewSlotLimitTooltip : str.addNewSlot}
              onClick={() => openEditForm("new", "", "")}
              className="rounded-md border-2 border-sky-300 bg-sky-50 px-4 py-2 font-medium text-sky-800 disabled:opacity-50"
            >
              {str.addNewSlot}
            </button>
            <p className="mt-1 text-xs text-gray-500">
              {slotsUsed} {str.slotCount}
            </p>
          </div>
        </div>
      )}

      {/* Full-prompt viewer */}
      {selectedSlot !== null && (
        <div className="mt-2 space-y-2 rounded-lg border border-gray-300 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              {str.viewerTitle} — {selectedSlot.slotName}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedSlot(null)}
              className="rounded border px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-200"
            >
              {str.closeViewer}
            </button>
          </div>
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded border bg-white p-3 text-xs leading-relaxed text-gray-800 font-mono">
            {selectedSlot.promptBody}
          </pre>
        </div>
      )}

      {/* Inline edit/create form */}
      {editTarget !== null && (
        <div className="mt-4 space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-4">
          <h3 className="font-medium">
            {editTarget === "new" ? str.addFormTitle : str.editFormTitle}
          </h3>

          {/* Name field */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{str.nameLabel}</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={MAX_SLOT_NAME_LENGTH}
              placeholder={str.namePlaceholder}
              aria-label={str.nameLabel}
              className="w-full rounded-md border px-2 py-1 text-sm"
            />
            {editErrors.name && (
              <p className="text-xs text-red-600">{editErrors.name}</p>
            )}
          </div>

          {/* Body textarea with live char counter */}
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <label className="block text-sm font-medium text-gray-700">{str.bodyLabel}</label>
              <span className={`text-xs ${bodyCounterClass}`}>
                {bodyLen} / {limits.max} {str.charCount}
              </span>
            </div>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={8}
              aria-label={str.bodyLabel}
              className="w-full rounded-md border px-2 py-1 text-sm font-mono"
            />
            {editErrors.body && (
              <p className="text-xs text-red-600">{editErrors.body}</p>
            )}
            <p className="text-xs text-gray-500">
              Min: {limits.min} — Max: {limits.max} {str.charCount}
            </p>
            <p className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              {str.formatNote}
            </p>
          </div>

          {/* Form actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              title={str.saveTooltip}
              className="rounded-md border-2 border-emerald-600 bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {str.save}
            </button>
            <button
              type="button"
              onClick={closeEditForm}
              disabled={saving}
              title={str.cancelTooltip}
              className="rounded-md border-2 border-gray-400 bg-gray-100 px-4 py-2 font-medium text-gray-700 disabled:opacity-50"
            >
              {str.cancel}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── SlotCard sub-component ──────────────────────────────────────────────────

type SlotCardProps = {
  slot: PromptTemplate;
  isEditing: boolean;
  isSelected: boolean;
  displayAsActive?: boolean;
  isPlatformAdmin: boolean;
  str: typeof promptsStrings.en;
  onSelect: () => void;
  onEdit: () => void;
  onMakeActive: () => void;
  onDelete: () => void;
};

function SlotCard({ slot, isEditing, isSelected, displayAsActive = slot.isActive, isPlatformAdmin, str, onSelect, onEdit, onMakeActive, onDelete }: SlotCardProps) {
  const preview =
    slot.promptBody.length > PREVIEW_LENGTH
      ? slot.promptBody.slice(0, PREVIEW_LENGTH) + "…"
      : slot.promptBody;

  const cardBorderClass = isEditing
    ? "rounded-lg border-2 border-sky-400 p-3"
    : isSelected
    ? "rounded-lg border-2 border-amber-400 bg-amber-50 p-3"
    : displayAsActive
    ? "rounded-lg border-2 border-[#7bc28f] bg-[#e8f6e8] p-3"
    : "rounded-lg border p-3";

  return (
    <div
      className={`${cardBorderClass} cursor-pointer`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-semibold leading-tight">{slot.slotName}</p>
        {displayAsActive && (
          <span className="shrink-0 rounded border border-[#7bc28f] bg-white px-1 py-0.5 text-[10px] font-bold uppercase text-[#2d4f3f]">
            {str.activeBadge}
          </span>
        )}
      </div>

      <p className="mt-1 text-xs leading-snug text-gray-600 break-words">{preview}</p>

      {/* Actions */}
      <div className="mt-2 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
        {slot.isDefault ? (
          <>
            {isPlatformAdmin ? (
              <button
                type="button"
                onClick={onEdit}
                title={str.editTooltip}
                className="rounded border-2 border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-sky-800"
              >
                {str.edit}
              </button>
            ) : (
              <p className="text-xs text-gray-500">{str.defaultReadOnlyNotice}</p>
            )}
          </>
        ) : (
          <>
            {!displayAsActive && (
              <button
                type="button"
                onClick={onMakeActive}
                title={str.makeActiveTooltip}
                className="rounded border-2 border-teal-600 bg-teal-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-teal-700"
              >
                {str.makeActive}
              </button>
            )}
            <button
              type="button"
              onClick={onEdit}
              title={str.editTooltip}
              className="rounded border-2 border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-sky-800"
            >
              {str.edit}
            </button>
            <button
              type="button"
              onClick={onDelete}
              title={str.deleteTooltip}
              className="rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700"
            >
              {str.deleteSlot}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
