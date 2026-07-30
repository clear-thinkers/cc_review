"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/app/shared/locale";
import { supabase } from "@/lib/supabaseClient";
import {
  addVocabPhrase,
  appendTargetsToReviewTestSession,
  assignVocabPhraseLessonTags,
  createReviewTestSession,
  deleteVocabPhrase,
  listReviewTestSessions,
  listVocabPhrases,
  updateVocabPhrase,
} from "@/lib/supabase-service";
import type { ReviewTestSession, ReviewTestSessionTargetDraft } from "@/lib/reviewTestSession.types";
import type { VocabPhrase, VocabPhraseExample } from "@/lib/types";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import { isValidPhraseLength } from "../add/addIngestion";
import TagCascadePicker from "../shared/TagCascadePicker";
import { taggingStrings } from "../shared/tagging.strings";
import { renderPhraseWithPinyin, renderSentenceWithPinyin } from "../shared/words.shared.utils";

type GenerateResponse = {
  meaning_zh: string;
  meaning_en: string;
  pinyin: string;
  example: string;
  example_pinyin: string;
};

function isGenerateResponse(value: unknown): value is GenerateResponse {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source.meaning_zh === "string" &&
    typeof source.meaning_en === "string" &&
    typeof source.pinyin === "string" &&
    typeof source.example === "string" &&
    typeof source.example_pinyin === "string"
  );
}

async function postGenerate(body: Record<string, unknown>): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const response = await fetch("/api/vocab-phrase/generate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : "";
    throw new Error(message || `Generation failed (HTTP ${response.status}).`);
  }
  return payload;
}

/** Full one-shot generate: pinyin + both definitions + one example. */
async function requestVocabPhraseGeneration(
  phrase: string,
  existingExamples: string[]
): Promise<GenerateResponse> {
  const payload = await postGenerate({ phrase, existing_examples: existingExamples });
  if (!isGenerateResponse(payload)) {
    throw new Error("Invalid generation response format.");
  }
  return payload;
}

/**
 * Narrow mode: given a Chinese sentence the parent typed or edited by hand,
 * fill in just its pinyin. Never touches the phrase's own pinyin/
 * definitions or any other example.
 */
async function requestExamplePinyin(example: string): Promise<string> {
  const payload = await postGenerate({ mode: "example_pinyin", example });
  const examplePinyin =
    payload && typeof payload === "object" && typeof (payload as { example_pinyin?: unknown }).example_pinyin === "string"
      ? (payload as { example_pinyin: string }).example_pinyin
      : "";
  if (!examplePinyin) {
    throw new Error("Invalid example-pinyin response format.");
  }
  return examplePinyin;
}

function toDraftTarget(phrase: VocabPhrase): ReviewTestSessionTargetDraft {
  // Falls back to the phrase text itself when pinyin hasn't been generated
  // yet -- createReviewTestSession silently drops any target whose
  // pronunciation is empty, so this must never be an empty string.
  const pronunciation = phrase.pinyin || phrase.phrase;
  return {
    character: phrase.phrase,
    pronunciation,
    key: `${phrase.phrase}|${pronunciation}`,
    vocabPhraseId: phrase.id,
  };
}

type EditTarget =
  | { phraseId: string; kind: "definition" }
  | { phraseId: string; kind: "example"; index: number }
  | { phraseId: string; kind: "newExample" };

export default function VocabPhraseAdminSection({ vm }: { vm: WordsWorkspaceVM }) {
  const { str } = vm;
  const locale = useLocale();
  const tagStr = taggingStrings[locale].add;
  const phraseStr = str.admin.vocabPhrases;
  const sharedActions = str.admin.table.actionButtons;

  const [phrases, setPhrases] = useState<VocabPhrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newPhraseInput, setNewPhraseInput] = useState("");
  const [addingPhrase, setAddingPhrase] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagSectionOpen, setTagSectionOpen] = useState(false);
  const [packageSectionOpen, setPackageSectionOpen] = useState(false);
  const [reviewTestSessions, setReviewTestSessions] = useState<ReviewTestSession[]>([]);
  const [existingSessionId, setExistingSessionId] = useState<string>("");
  const [newSessionName, setNewSessionName] = useState("");
  const [packaging, setPackaging] = useState(false);

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [draftMeaningZh, setDraftMeaningZh] = useState("");
  const [draftMeaningEn, setDraftMeaningEn] = useState("");
  const [draftExampleZh, setDraftExampleZh] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [phraseRows, sessions] = await Promise.all([listVocabPhrases(), listReviewTestSessions()]);
      setPhrases(phraseRows);
      setReviewTestSessions(sessions);
    } catch {
      setNotice(phraseStr.generateError);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visiblePhrases = phrases.filter((phrase) => phrase.phrase.includes(searchQuery.trim()));

  function updatePhraseInState(id: string, patch: Partial<VocabPhrase>) {
    setPhrases((previous) => previous.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function clearEditState() {
    setEditTarget(null);
    setDraftMeaningZh("");
    setDraftMeaningEn("");
    setDraftExampleZh("");
  }

  async function handleAddPhrase() {
    const trimmed = newPhraseInput.trim();
    if (!isValidPhraseLength(trimmed)) {
      setNotice(phraseStr.invalidLength);
      return;
    }
    if (phrases.some((phrase) => phrase.phrase === trimmed)) {
      setNotice(phraseStr.duplicatePhrase);
      return;
    }

    setAddingPhrase(true);
    setNotice(null);
    try {
      const created = await addVocabPhrase(trimmed);
      setPhrases((previous) => [created, ...previous]);
      setNewPhraseInput("");
    } catch {
      setNotice(phraseStr.generateError);
    } finally {
      setAddingPhrase(false);
    }
  }

  // ─── Phrase column: R, S, C, D ─────────────────────────────────────────────

  async function handleRegeneratePhrase(phrase: VocabPhrase) {
    setBusyId(phrase.id);
    setNotice(null);
    try {
      const result = await requestVocabPhraseGeneration(phrase.phrase, []);
      const newExample: VocabPhraseExample = {
        zh: result.example,
        pinyin: result.example_pinyin,
        includeInFillTest: true,
      };
      const patch = {
        pinyin: result.pinyin,
        meaningZh: result.meaning_zh,
        meaningEn: result.meaning_en,
        examples: [newExample],
      };
      await updateVocabPhrase(phrase.id, patch);
      updatePhraseInState(phrase.id, patch);
      if (editTarget?.phraseId === phrase.id) {
        clearEditState();
      }
    } catch {
      setNotice(phraseStr.generateError);
    } finally {
      setBusyId(null);
    }
  }

  async function handleClearPhrase(phrase: VocabPhrase) {
    if (!window.confirm(phraseStr.clearConfirm)) {
      return;
    }
    setBusyId(phrase.id);
    setNotice(null);
    try {
      const patch = { pinyin: undefined, meaningZh: undefined, meaningEn: undefined, examples: [] };
      await updateVocabPhrase(phrase.id, patch);
      updatePhraseInState(phrase.id, patch);
      if (editTarget?.phraseId === phrase.id) {
        clearEditState();
      }
    } catch {
      setNotice(phraseStr.generateError);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeletePhrase(phrase: VocabPhrase) {
    if (!window.confirm(phraseStr.deleteConfirm)) {
      return;
    }
    try {
      await deleteVocabPhrase(phrase.id);
      setPhrases((previous) => previous.filter((item) => item.id !== phrase.id));
      setSelectedIds((previous) => {
        const next = new Set(previous);
        next.delete(phrase.id);
        return next;
      });
      if (editTarget?.phraseId === phrase.id) {
        clearEditState();
      }
    } catch {
      setNotice(phraseStr.generateError);
    }
  }

  /** Phrase column's persistent S, and Definition/Example columns' contextual S -- same commit, dispatched by editTarget.kind. */
  async function handleSaveEdit(phrase: VocabPhrase) {
    if (!editTarget || editTarget.phraseId !== phrase.id) {
      return;
    }

    setSavingEdit(true);
    setNotice(null);
    try {
      if (editTarget.kind === "definition") {
        const patch = { meaningZh: draftMeaningZh, meaningEn: draftMeaningEn };
        await updateVocabPhrase(phrase.id, patch);
        updatePhraseInState(phrase.id, patch);
      } else if (editTarget.kind === "example") {
        const targetIndex = editTarget.index;
        const pinyin = await requestExamplePinyin(draftExampleZh);
        const nextExamples = phrase.examples.map((example, index) =>
          index === targetIndex ? { ...example, zh: draftExampleZh, pinyin } : example
        );
        await updateVocabPhrase(phrase.id, { examples: nextExamples });
        updatePhraseInState(phrase.id, { examples: nextExamples });
      } else {
        const pinyin = await requestExamplePinyin(draftExampleZh);
        const newExample: VocabPhraseExample = { zh: draftExampleZh, pinyin, includeInFillTest: true };
        const nextExamples = [...phrase.examples, newExample].slice(0, 20);
        await updateVocabPhrase(phrase.id, { examples: nextExamples });
        updatePhraseInState(phrase.id, { examples: nextExamples });
      }
      clearEditState();
    } catch {
      setNotice(phraseStr.generateError);
    } finally {
      setSavingEdit(false);
    }
  }

  // ─── Definition column: R, E ────────────────────────────────────────────────

  async function handleRegenerateDefinitions(phrase: VocabPhrase) {
    setBusyId(phrase.id);
    setNotice(null);
    try {
      const result = await requestVocabPhraseGeneration(
        phrase.phrase,
        phrase.examples.map((example) => example.zh)
      );
      const patch = { meaningZh: result.meaning_zh, meaningEn: result.meaning_en };
      await updateVocabPhrase(phrase.id, patch);
      updatePhraseInState(phrase.id, patch);
    } catch {
      setNotice(phraseStr.generateError);
    } finally {
      setBusyId(null);
    }
  }

  function handleOpenDefinitionEdit(phrase: VocabPhrase) {
    setEditTarget({ phraseId: phrase.id, kind: "definition" });
    setDraftMeaningZh(phrase.meaningZh ?? "");
    setDraftMeaningEn(phrase.meaningEn ?? "");
  }

  // ─── Examples column: R, E, D, + Example ───────────────────────────────────

  async function handleRegenerateExample(phrase: VocabPhrase, index: number) {
    setBusyId(phrase.id);
    setNotice(null);
    try {
      const otherExamples = phrase.examples
        .filter((_example, exampleIndex) => exampleIndex !== index)
        .map((example) => example.zh);
      const result = await requestVocabPhraseGeneration(phrase.phrase, otherExamples);
      const nextExamples = phrase.examples.map((example, exampleIndex) =>
        exampleIndex === index ? { ...example, zh: result.example, pinyin: result.example_pinyin } : example
      );
      await updateVocabPhrase(phrase.id, { examples: nextExamples });
      updatePhraseInState(phrase.id, { examples: nextExamples });
    } catch {
      setNotice(phraseStr.generateError);
    } finally {
      setBusyId(null);
    }
  }

  function handleOpenExampleEdit(phrase: VocabPhrase, index: number) {
    setEditTarget({ phraseId: phrase.id, kind: "example", index });
    setDraftExampleZh(phrase.examples[index]?.zh ?? "");
  }

  function handleOpenNewExample(phrase: VocabPhrase) {
    setEditTarget({ phraseId: phrase.id, kind: "newExample" });
    setDraftExampleZh("");
  }

  async function handleDeleteExample(phrase: VocabPhrase, index: number) {
    const nextExamples = phrase.examples.filter((_example, exampleIndex) => exampleIndex !== index);
    try {
      await updateVocabPhrase(phrase.id, { examples: nextExamples });
      updatePhraseInState(phrase.id, { examples: nextExamples });
      if (editTarget?.phraseId === phrase.id && editTarget.kind === "example" && editTarget.index === index) {
        clearEditState();
      }
    } catch {
      setNotice(phraseStr.generateError);
    }
  }

  async function handleToggleExampleFillTest(phrase: VocabPhrase, index: number) {
    const nextExamples = phrase.examples.map((example, exampleIndex) =>
      exampleIndex === index ? { ...example, includeInFillTest: !example.includeInFillTest } : example
    );
    try {
      await updateVocabPhrase(phrase.id, { examples: nextExamples });
      updatePhraseInState(phrase.id, { examples: nextExamples });
    } catch {
      setNotice(phraseStr.generateError);
    }
  }

  // ─── Selection / tagging / packaging (unchanged) ───────────────────────────

  function toggleSelected(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleAssignTag(lessonTagId: string) {
    if (selectedIds.size === 0) {
      setNotice(phraseStr.packageSection.noSelection);
      return;
    }
    try {
      await assignVocabPhraseLessonTags([...selectedIds], lessonTagId);
      setNotice(phraseStr.tagSection.assignSuccess);
    } catch {
      setNotice(phraseStr.tagSection.assignError);
    }
  }

  async function handlePackageSelected() {
    if (selectedIds.size === 0) {
      setNotice(phraseStr.packageSection.noSelection);
      return;
    }
    const drafts = phrases.filter((phrase) => selectedIds.has(phrase.id)).map(toDraftTarget);

    setPackaging(true);
    try {
      if (existingSessionId) {
        await appendTargetsToReviewTestSession(existingSessionId, drafts);
      } else {
        const trimmedName = newSessionName.trim();
        if (!trimmedName) {
          setNotice(phraseStr.packageSection.noSelection);
          return;
        }
        await createReviewTestSession(trimmedName, drafts);
        setNewSessionName("");
      }
      setNotice(phraseStr.packageSection.success);
      setSelectedIds(new Set());
      await refresh();
    } catch {
      setNotice(phraseStr.packageSection.error);
    } finally {
      setPackaging(false);
    }
  }

  return (
    <div className="space-y-3">
      {notice ? <p className="text-sm text-blue-700">{notice}</p> : null}

      <div className="flex flex-wrap gap-2">
        <input
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          placeholder={phraseStr.searchPlaceholder}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          placeholder={phraseStr.newPhrasePlaceholder}
          value={newPhraseInput}
          onChange={(event) => setNewPhraseInput(event.target.value)}
          disabled={addingPhrase}
        />
        <button
          type="button"
          className="btn-primary rounded-md border-2 px-4 py-2 text-sm disabled:opacity-50"
          onClick={handleAddPhrase}
          disabled={addingPhrase || !newPhraseInput.trim()}
        >
          {phraseStr.addButton}
        </button>
      </div>

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-gray-50 p-2 text-sm">
          <span>{phraseStr.selectionCount.replace("{count}", String(selectedIds.size))}</span>
          <button
            type="button"
            className="btn-nav rounded-md border-2 px-3 py-1.5 text-sm"
            onClick={() => setTagSectionOpen((open) => !open)}
          >
            {phraseStr.tagSection.title}
          </button>
          <button
            type="button"
            className="btn-nav rounded-md border-2 px-3 py-1.5 text-sm"
            onClick={() => setPackageSectionOpen((open) => !open)}
          >
            {str.admin.buttons.addToReviewTestSession}
          </button>
        </div>
      ) : null}

      {tagSectionOpen && selectedIds.size > 0 ? (
        <TagCascadePicker
          strings={{
            textbookPlaceholder: tagStr.textbookPlaceholder,
            gradePlaceholder: tagStr.gradePlaceholder,
            unitPlaceholder: tagStr.unitPlaceholder,
            lessonPlaceholder: tagStr.lessonPlaceholder,
            createNewOption: tagStr.createNewOption,
            createNewPlaceholder: tagStr.createNewPlaceholder,
            createNewConfirm: tagStr.createNewConfirm,
            createNewCancel: tagStr.createNewCancel,
            loadingTextbooks: tagStr.loadingTextbooks,
            assignButton: phraseStr.tagSection.title,
            assigning: phraseStr.generating,
          }}
          onAssign={handleAssignTag}
        />
      ) : null}

      {packageSectionOpen && selectedIds.size > 0 ? (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">{phraseStr.packageSection.title}</p>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={existingSessionId}
              onChange={(event) => setExistingSessionId(event.target.value)}
            >
              <option value="">{phraseStr.packageSection.existingSessionLabel}</option>
              {reviewTestSessions.map((sessionItem) => (
                <option key={sessionItem.id} value={sessionItem.id}>
                  {sessionItem.name}
                </option>
              ))}
            </select>
            {!existingSessionId ? (
              <input
                className="flex-1 rounded-md border px-3 py-2 text-sm"
                placeholder={phraseStr.packageSection.newSessionPlaceholder}
                value={newSessionName}
                onChange={(event) => setNewSessionName(event.target.value)}
              />
            ) : null}
            <button
              type="button"
              className="btn-primary rounded-md border-2 px-4 py-2 text-sm disabled:opacity-50"
              onClick={handlePackageSelected}
              disabled={packaging}
            >
              {existingSessionId ? phraseStr.packageSection.appendButton : phraseStr.packageSection.createButton}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-600">{phraseStr.loading}</p>
      ) : visiblePhrases.length === 0 ? (
        <p className="text-sm text-gray-600">{phraseStr.emptyState}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2" />
                <th className="p-2">{phraseStr.columns.phrase}</th>
                <th className="p-2">{phraseStr.columns.meaning}</th>
                <th className="p-2">{phraseStr.columns.examples}</th>
              </tr>
            </thead>
            <tbody>
              {visiblePhrases.map((phrase) => {
                const isBusy = busyId === phrase.id;
                const isEditingThisRow = editTarget?.phraseId === phrase.id;
                const isEditingDefinition = isEditingThisRow && editTarget?.kind === "definition";
                const isAddingNewExample = isEditingThisRow && editTarget?.kind === "newExample";

                return (
                  <tr key={phrase.id} className="border-b align-top">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(phrase.id)}
                        onChange={() => toggleSelected(phrase.id)}
                        aria-label={phrase.phrase}
                      />
                    </td>

                    {/* Phrase column: R, S, C, D */}
                    <td className="p-2 font-medium">
                      <div>{renderPhraseWithPinyin(phrase.phrase, phrase.pinyin ?? "")}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="btn-nav rounded border px-2 py-0.5 text-xs disabled:opacity-50"
                          onClick={() => handleRegeneratePhrase(phrase)}
                          disabled={isBusy}
                          title={phraseStr.tooltips.regeneratePhrase}
                        >
                          {sharedActions.regenerate}
                        </button>
                        <button
                          type="button"
                          className="btn-primary rounded border-2 px-2 py-0.5 text-xs disabled:opacity-50"
                          onClick={() => handleSaveEdit(phrase)}
                          disabled={!isEditingThisRow || savingEdit}
                          title={phraseStr.tooltips.save}
                        >
                          {sharedActions.save}
                        </button>
                        <button
                          type="button"
                          className="rounded border px-2 py-0.5 text-xs text-gray-600 disabled:opacity-50"
                          onClick={() => handleClearPhrase(phrase)}
                          disabled={isBusy}
                          title={phraseStr.tooltips.clearPhrase}
                        >
                          {sharedActions.clearContent}
                        </button>
                        <button
                          type="button"
                          className="rounded border px-2 py-0.5 text-xs text-red-600"
                          onClick={() => handleDeletePhrase(phrase)}
                          title={phraseStr.tooltips.deletePhrase}
                        >
                          {sharedActions.delete}
                        </button>
                      </div>
                    </td>

                    {/* Definition column: R, E (-> S, Cancel while editing) */}
                    <td className="p-2">
                      {isEditingDefinition ? (
                        <div className="space-y-1">
                          <input
                            className="w-full rounded-md border px-2 py-1 text-sm"
                            value={draftMeaningZh}
                            onChange={(event) => setDraftMeaningZh(event.target.value)}
                            placeholder={phraseStr.columns.meaning}
                          />
                          <input
                            className="w-full rounded-md border px-2 py-1 text-xs"
                            value={draftMeaningEn}
                            onChange={(event) => setDraftMeaningEn(event.target.value)}
                            placeholder={phraseStr.columns.meaning}
                          />
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="btn-primary rounded border-2 px-2 py-0.5 text-xs disabled:opacity-50"
                              onClick={() => handleSaveEdit(phrase)}
                              disabled={savingEdit}
                              title={phraseStr.tooltips.save}
                            >
                              {sharedActions.save}
                            </button>
                            <button
                              type="button"
                              className="btn-nav rounded border-2 px-2 py-0.5 text-xs"
                              onClick={clearEditState}
                              title={phraseStr.tooltips.cancel}
                            >
                              {sharedActions.cancel}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div>{phrase.meaningZh ?? "—"}</div>
                          <div className="text-xs text-gray-500">{phrase.meaningEn ?? "—"}</div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="btn-nav rounded border px-2 py-0.5 text-xs disabled:opacity-50"
                              onClick={() => handleRegenerateDefinitions(phrase)}
                              disabled={isBusy}
                              title={phraseStr.tooltips.regenerateDefinitions}
                            >
                              {sharedActions.regenerate}
                            </button>
                            <button
                              type="button"
                              className="rounded border px-2 py-0.5 text-xs"
                              onClick={() => handleOpenDefinitionEdit(phrase)}
                              disabled={isBusy}
                              title={phraseStr.tooltips.editDefinitions}
                            >
                              {sharedActions.edit}
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Examples column: per example R, E, D (-> S, Cancel while editing), + Example */}
                    <td className="p-2">
                      <ul className="space-y-2">
                        {phrase.examples.map((example, index) => {
                          const isEditingThisExample =
                            isEditingThisRow && editTarget?.kind === "example" && editTarget.index === index;

                          return (
                            <li key={`${phrase.id}-example-${index}`} className="space-y-1">
                              {isEditingThisExample ? (
                                <div className="flex flex-wrap items-center gap-1">
                                  <input
                                    className="min-w-[12rem] flex-1 rounded-md border px-2 py-1 text-sm"
                                    value={draftExampleZh}
                                    onChange={(event) => setDraftExampleZh(event.target.value)}
                                  />
                                  <button
                                    type="button"
                                    className="btn-primary rounded border-2 px-2 py-0.5 text-xs disabled:opacity-50"
                                    onClick={() => handleSaveEdit(phrase)}
                                    disabled={savingEdit || !draftExampleZh.trim()}
                                    title={phraseStr.tooltips.save}
                                  >
                                    {savingEdit ? phraseStr.fillingPinyin : sharedActions.save}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-nav rounded border-2 px-2 py-0.5 text-xs"
                                    onClick={clearEditState}
                                    title={phraseStr.tooltips.cancel}
                                  >
                                    {sharedActions.cancel}
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center gap-1">
                                  <span>{renderSentenceWithPinyin(example.zh, example.pinyin)}</span>
                                  <button
                                    type="button"
                                    className="btn-nav rounded border px-2 py-0.5 text-xs disabled:opacity-50"
                                    onClick={() => handleRegenerateExample(phrase, index)}
                                    disabled={isBusy}
                                    title={phraseStr.tooltips.regenerateExample}
                                  >
                                    {sharedActions.regenerate}
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded border px-2 py-0.5 text-xs"
                                    onClick={() => handleOpenExampleEdit(phrase, index)}
                                    disabled={isBusy}
                                    title={phraseStr.tooltips.editExample}
                                  >
                                    {sharedActions.edit}
                                  </button>
                                  <button
                                    type="button"
                                    className={
                                      example.includeInFillTest
                                        ? "btn-toggle-on rounded px-2 py-0.5 text-xs"
                                        : "rounded border px-2 py-0.5 text-xs text-gray-600"
                                    }
                                    onClick={() => handleToggleExampleFillTest(phrase, index)}
                                  >
                                    {example.includeInFillTest ? sharedActions.fillTestOn : sharedActions.fillTestOff}
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded border px-2 py-0.5 text-xs text-red-600"
                                    onClick={() => handleDeleteExample(phrase, index)}
                                    title={phraseStr.tooltips.deleteExample}
                                  >
                                    {sharedActions.delete}
                                  </button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>

                      {isAddingNewExample ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <input
                            className="min-w-[12rem] flex-1 rounded-md border px-2 py-1 text-sm"
                            placeholder={phraseStr.newExamplePlaceholder}
                            value={draftExampleZh}
                            onChange={(event) => setDraftExampleZh(event.target.value)}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="btn-primary rounded border-2 px-2 py-0.5 text-xs disabled:opacity-50"
                            onClick={() => handleSaveEdit(phrase)}
                            disabled={savingEdit || !draftExampleZh.trim() || phrase.examples.length >= 20}
                            title={phraseStr.tooltips.save}
                          >
                            {savingEdit ? phraseStr.fillingPinyin : sharedActions.save}
                          </button>
                          <button
                            type="button"
                            className="btn-nav rounded border-2 px-2 py-0.5 text-xs"
                            onClick={clearEditState}
                            title={phraseStr.tooltips.cancel}
                          >
                            {sharedActions.cancel}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="mt-2 rounded border px-2 py-0.5 text-xs disabled:opacity-50"
                          onClick={() => handleOpenNewExample(phrase)}
                          disabled={isBusy || phrase.examples.length >= 20}
                          title={phraseStr.tooltips.addExample}
                        >
                          {phraseStr.addExampleButton}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
