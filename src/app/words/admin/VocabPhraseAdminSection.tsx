"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  appendTargetsToReviewTestSession,
  createReviewTestSession,
  deleteVocabPhrase,
  getVocabPhraseLessonTagsForFamily,
  listReviewTestSessions,
  listVocabPhrases,
  updateVocabPhrase,
} from "@/lib/supabase-service";
import type { ReviewTestSession, ReviewTestSessionTargetDraft } from "@/lib/reviewTestSession.types";
import type { VocabPhrase, VocabPhraseExample } from "@/lib/types";
import type { VocabPhraseLessonTagsMap } from "@/lib/tagging.types";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import { renderPhraseWithPinyin, renderSentenceWithPinyin } from "../shared/words.shared.utils";
import {
  getAllTagFilterOptionIds,
  hasActivePartialTagFilter,
  matchesPartialTagFilter,
  matchesSelectedTagFilter,
  toggleTagFilterId,
  type PartialTagFilterSelection,
} from "../shared/tagFilter.utils";
import {
  allSelectedExamplesIncluded,
  resolveBatchPhraseTargets,
  resolveExamplePinyinRefreshIndices,
  vocabPhraseHasContent,
  vocabPhraseMissingExamplePinyin,
  type BatchPhraseScope,
} from "./vocabPhraseAdmin.utils";

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
  const phraseStr = str.admin.vocabPhrases;
  const sharedActions = str.admin.table.actionButtons;

  const [phrases, setPhrases] = useState<VocabPhrase[]>([]);
  const [phraseTagsMap, setPhraseTagsMap] = useState<VocabPhraseLessonTagsMap>(new Map());
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterHasContent, setFilterHasContent] = useState<"" | "yes" | "no">("");
  const [filterSelectedTagIds, setFilterSelectedTagIds] = useState<string[]>([]);
  const [filterTagTextbooks, setFilterTagTextbooks] = useState<string[]>([]);
  const [filterTagGrades, setFilterTagGrades] = useState<string[]>([]);
  const [filterTagUnits, setFilterTagUnits] = useState<string[]>([]);
  const [filterTagLessons, setFilterTagLessons] = useState<string[]>([]);
  const [filterSectionOpen, setFilterSectionOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [packageSectionOpen, setPackageSectionOpen] = useState(false);
  const [reviewTestSessions, setReviewTestSessions] = useState<ReviewTestSession[]>([]);
  const [existingSessionId, setExistingSessionId] = useState<string>("");
  const [newSessionName, setNewSessionName] = useState("");
  const [packaging, setPackaging] = useState(false);

  const [openBatchMenu, setOpenBatchMenu] = useState<"content" | "pinyin" | null>(null);
  const [batchWarningKind, setBatchWarningKind] = useState<"content_all" | "pinyin_all" | null>(null);
  const [batchRunningKind, setBatchRunningKind] = useState<"content" | "pinyin" | null>(null);
  const [batchProgressText, setBatchProgressText] = useState<string | null>(null);
  const [batchFillTestBusy, setBatchFillTestBusy] = useState(false);

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [draftMeaningZh, setDraftMeaningZh] = useState("");
  const [draftMeaningEn, setDraftMeaningEn] = useState("");
  const [draftExampleZh, setDraftExampleZh] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [phraseRows, sessions, tagsMap] = await Promise.all([
        listVocabPhrases(),
        listReviewTestSessions(),
        getVocabPhraseLessonTagsForFamily(),
      ]);
      setPhrases(phraseRows);
      setReviewTestSessions(sessions);
      setPhraseTagsMap(tagsMap);
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

  // Extract unique tags from phraseTagsMap for filter UI
  const availableTagsWithIds = useMemo(() => {
    const tagMap = new Map<string, { id: string; textbookName: string; grade: string; unit: string; lesson: string }>();
    phraseTagsMap.forEach((tags) => {
      tags.forEach((tag) => {
        const key = `${tag.textbookName} · ${tag.grade} · ${tag.unit} · ${tag.lesson}`;
        if (!tagMap.has(key)) {
          tagMap.set(key, {
            id: tag.lessonTagId,
            textbookName: tag.textbookName,
            grade: tag.grade,
            unit: tag.unit,
            lesson: tag.lesson,
          });
        }
      });
    });
    return Array.from(tagMap.values()).sort((a, b) =>
      `${a.textbookName}${a.grade}${a.unit}${a.lesson}`.localeCompare(
        `${b.textbookName}${b.grade}${b.unit}${b.lesson}`,
        "zh-Hans-CN"
      )
    );
  }, [phraseTagsMap]);

  // Cascade options for partial tag filter
  const partialFilterTextbookOptions = useMemo(
    () => Array.from(new Set(availableTagsWithIds.map((t) => t.textbookName))),
    [availableTagsWithIds]
  );
  const partialFilterGradeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          availableTagsWithIds
            .filter((t) => filterTagTextbooks.length === 0 || filterTagTextbooks.includes(t.textbookName))
            .map((t) => t.grade)
        )
      ),
    [availableTagsWithIds, filterTagTextbooks]
  );
  const partialFilterUnitOptions = useMemo(
    () =>
      Array.from(
        new Set(
          availableTagsWithIds
            .filter(
              (t) =>
                (filterTagTextbooks.length === 0 || filterTagTextbooks.includes(t.textbookName)) &&
                (filterTagGrades.length === 0 || filterTagGrades.includes(t.grade))
            )
            .map((t) => t.unit)
        )
      ),
    [availableTagsWithIds, filterTagTextbooks, filterTagGrades]
  );
  const partialFilterLessonOptions = useMemo(
    () =>
      Array.from(
        new Set(
          availableTagsWithIds
            .filter(
              (t) =>
                (filterTagTextbooks.length === 0 || filterTagTextbooks.includes(t.textbookName)) &&
                (filterTagGrades.length === 0 || filterTagGrades.includes(t.grade)) &&
                (filterTagUnits.length === 0 || filterTagUnits.includes(t.unit))
            )
            .map((t) => t.lesson)
        )
      ),
    [availableTagsWithIds, filterTagTextbooks, filterTagGrades, filterTagUnits]
  );

  const partialTagFilterSelection: PartialTagFilterSelection = {
    textbooks: filterTagTextbooks,
    grades: filterTagGrades,
    units: filterTagUnits,
    lessons: filterTagLessons,
  };
  const isPartialTagFilterActive = hasActivePartialTagFilter(partialTagFilterSelection);

  const visiblePhrases = phrases.filter((phrase) => {
    if (!phrase.phrase.includes(searchQuery.trim())) return false;
    if (filterHasContent === "yes" && !vocabPhraseHasContent(phrase)) return false;
    if (filterHasContent === "no" && vocabPhraseHasContent(phrase)) return false;
    const phraseTags = phraseTagsMap.get(phrase.id) ?? [];
    const phraseTagIds = new Set(phraseTags.map((t) => t.lessonTagId));
    if (!matchesSelectedTagFilter(phraseTagIds, filterSelectedTagIds)) return false;
    if (!matchesPartialTagFilter(phraseTags, partialTagFilterSelection)) return false;
    return true;
  });

  function clearAllFilters(): void {
    setSearchQuery("");
    setFilterHasContent("");
    setFilterSelectedTagIds([]);
    setFilterTagTextbooks([]);
    setFilterTagGrades([]);
    setFilterTagUnits([]);
    setFilterTagLessons([]);
  }

  function updatePhraseInState(id: string, patch: Partial<VocabPhrase>) {
    setPhrases((previous) => previous.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function clearEditState() {
    setEditTarget(null);
    setDraftMeaningZh("");
    setDraftMeaningEn("");
    setDraftExampleZh("");
  }

  // ─── Selection / batch action toolbar ──────────────────────────────────────

  const filteredPhraseIdSet = useMemo(() => new Set(visiblePhrases.map((p) => p.id)), [visiblePhrases]);
  const allFilteredSelected = visiblePhrases.length > 0 && visiblePhrases.every((p) => selectedIds.has(p.id));
  const selectedPhraseList = useMemo(
    () => phrases.filter((p) => selectedIds.has(p.id)),
    [phrases, selectedIds]
  );
  const selectedExamplesAllIncluded = allSelectedExamplesIncluded(selectedPhraseList);
  const hasActiveFilter =
    searchQuery.trim() !== "" ||
    filterHasContent !== "" ||
    filterSelectedTagIds.length > 0 ||
    isPartialTagFilterActive;
  const BATCH_CONCURRENCY = 3;

  function handleSelectFiltered() {
    setSelectedIds(new Set(visiblePhrases.map((p) => p.id)));
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
  }

  async function runBatchContentGeneration(scope: BatchPhraseScope) {
    const targets = resolveBatchPhraseTargets(phrases, scope, {
      filteredIds: filteredPhraseIdSet,
      selectedIds,
      isMissing: (phrase) => !vocabPhraseHasContent(phrase),
    });
    if (targets.length === 0) {
      setNotice(phraseStr.noBatchContentTargets);
      return;
    }

    setBatchRunningKind("content");
    setBatchProgressText(null);
    setNotice(null);
    let generated = 0;
    let failed = 0;
    const total = targets.length;

    try {
      for (let start = 0; start < total; start += BATCH_CONCURRENCY) {
        const end = Math.min(start + BATCH_CONCURRENCY, total);
        setBatchProgressText(
          str.admin.preloadingBatchProgress
            .replace("{from}", String(start + 1))
            .replace("{to}", String(end))
            .replace("{total}", String(total))
        );
        const results = await Promise.allSettled(
          targets.slice(start, end).map(async (phrase) => {
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
            return { phraseId: phrase.id, patch };
          })
        );
        for (const result of results) {
          if (result.status === "fulfilled") {
            generated += 1;
            updatePhraseInState(result.value.phraseId, result.value.patch);
          } else {
            failed += 1;
          }
        }
      }
    } finally {
      setBatchRunningKind(null);
      setBatchProgressText(null);
    }

    setNotice(
      str.admin.preloadResult
        .replace("{generated}", String(generated))
        .replace("{skipped}", "0")
        .replace("{failed}", String(failed))
    );
  }

  async function runBatchPinyinRefresh(scope: BatchPhraseScope) {
    const resolved = resolveBatchPhraseTargets(phrases, scope, {
      filteredIds: filteredPhraseIdSet,
      selectedIds,
      isMissing: vocabPhraseMissingExamplePinyin,
    });
    const targets = resolved.filter((phrase) => phrase.examples.length > 0);
    if (targets.length === 0) {
      setNotice(phraseStr.noBatchPinyinTargets);
      return;
    }

    setBatchRunningKind("pinyin");
    setBatchProgressText(null);
    setNotice(null);
    let refreshed = 0;
    let failed = 0;
    const mode: "missing_only" | "refresh" = scope === "missing_only" ? "missing_only" : "refresh";
    const total = targets.length;

    try {
      for (let start = 0; start < total; start += BATCH_CONCURRENCY) {
        const end = Math.min(start + BATCH_CONCURRENCY, total);
        setBatchProgressText(
          phraseStr.pinyinBatchProgress
            .replace("{current}", String(end))
            .replace("{total}", String(total))
            .replace("{phrase}", targets[end - 1]?.phrase ?? "")
        );
        const results = await Promise.allSettled(
          targets.slice(start, end).map(async (phrase) => {
            const indices = resolveExamplePinyinRefreshIndices(phrase.examples, mode);
            if (indices.length === 0) {
              return { phraseId: phrase.id, examples: phrase.examples, changed: false };
            }
            const updatedExamples = [...phrase.examples];
            for (const index of indices) {
              const pinyin = await requestExamplePinyin(updatedExamples[index].zh);
              updatedExamples[index] = { ...updatedExamples[index], pinyin };
            }
            await updateVocabPhrase(phrase.id, { examples: updatedExamples });
            return { phraseId: phrase.id, examples: updatedExamples, changed: true };
          })
        );
        for (const result of results) {
          if (result.status === "fulfilled") {
            if (result.value.changed) {
              updatePhraseInState(result.value.phraseId, { examples: result.value.examples });
            }
            refreshed += 1;
          } else {
            failed += 1;
          }
        }
      }
    } finally {
      setBatchRunningKind(null);
      setBatchProgressText(null);
    }

    setNotice(
      str.admin.messages.pinyinRefreshFinished
        .replace("{refreshed}", String(refreshed))
        .replace("{failed}", String(failed))
    );
  }

  function handleBatchContentClick(scope: BatchPhraseScope) {
    setOpenBatchMenu(null);
    if (scope === "all") {
      setBatchWarningKind("content_all");
      return;
    }
    void runBatchContentGeneration(scope);
  }

  function handleBatchPinyinClick(scope: BatchPhraseScope) {
    setOpenBatchMenu(null);
    if (scope === "all") {
      setBatchWarningKind("pinyin_all");
      return;
    }
    void runBatchPinyinRefresh(scope);
  }

  function handleConfirmBatchWarning() {
    const kind = batchWarningKind;
    setBatchWarningKind(null);
    if (kind === "content_all") void runBatchContentGeneration("all");
    if (kind === "pinyin_all") void runBatchPinyinRefresh("all");
  }

  async function handleBatchFillTestToggle() {
    if (selectedPhraseList.length === 0) return;
    const nextInclude = !selectedExamplesAllIncluded;
    setBatchFillTestBusy(true);
    setNotice(null);
    try {
      let updated = 0;
      for (const phrase of selectedPhraseList) {
        if (phrase.examples.length === 0) continue;
        const nextExamples = phrase.examples.map((example) => ({ ...example, includeInFillTest: nextInclude }));
        await updateVocabPhrase(phrase.id, { examples: nextExamples });
        updatePhraseInState(phrase.id, { examples: nextExamples });
        updated += 1;
      }
      setNotice(
        str.admin.messages.batchFillTestToggleSuccess
          .replace("{updated}", String(updated))
          .replace("{state}", nextInclude ? sharedActions.fillTestOn : sharedActions.fillTestOff)
      );
    } catch {
      setNotice(phraseStr.generateError);
    } finally {
      setBatchFillTestBusy(false);
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

  const toolbarButtonBaseClass =
    "admin-toolbar-button inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium leading-none disabled:opacity-50";
  const toolbarSecondaryButtonClass = `${toolbarButtonBaseClass} btn-secondary`;
  const toolbarNeutralButtonClass = `${toolbarButtonBaseClass} btn-neutral`;
  const toolbarCautionButtonClass = `${toolbarButtonBaseClass} btn-caution`;
  const toolbarMenuButtonClass =
    "flex w-full items-start rounded-md px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
  const toolbarFillTestButtonClass =
    "admin-toolbar-button rounded-md border px-3 py-1.5 text-xs font-medium leading-none btn-toggle-on disabled:opacity-50";
  const toolbarBusy = loading || batchRunningKind !== null || batchFillTestBusy || packaging;

  return (
    <div className="space-y-3">
      {notice ? <p className="text-sm text-blue-700">{notice}</p> : null}

      {/* Default Filters Bar */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setFilterSectionOpen((open) => !open)}
            className="text-sm text-blue-600 underline"
          >
            {str.admin.filters.title}
          </button>
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs text-blue-600 underline disabled:opacity-50"
            disabled={
              searchQuery.trim() === "" &&
              filterHasContent === "" &&
              filterSelectedTagIds.length === 0 &&
              !isPartialTagFilterActive
            }
          >
            {str.admin.filters.clearButton}
          </button>
        </div>

        {filterSectionOpen && (
          <div className="flex flex-wrap items-start gap-12">
            {/* Phrase Search */}
            <div className="space-y-1">
              <label className="block text-xs text-gray-600">{phraseStr.filters.phraseSearchLabel}</label>
              <input
                type="text"
                className="rounded-md border px-2 py-1 text-sm w-full max-w-xs"
                placeholder={phraseStr.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Has Content Filter */}
            <div className="space-y-1">
              <label className="block text-xs text-gray-600">{phraseStr.filters.hasContent.label}</label>
              <select
                className="rounded-md border px-2 py-1 text-sm bg-white"
                value={filterHasContent}
                onChange={(e) => setFilterHasContent(e.target.value as "" | "yes" | "no")}
              >
                <option value="">{phraseStr.filters.hasContent.all}</option>
                <option value="yes">{phraseStr.filters.hasContent.yes}</option>
                <option value="no">{phraseStr.filters.hasContent.no}</option>
              </select>
            </div>

            {/* Tag-related filters: Tags (Cascade) + Filter by Tag Part on same row */}
            <div className="flex items-start gap-6">
              {/* Tags Filter */}
              <div className="space-y-1">
                <label className="block text-xs text-gray-600">{str.admin.filters.tags.label}</label>
                <details className="group">
                  <summary className="cursor-pointer rounded-md border px-2 py-1 text-sm bg-gray-50 hover:bg-gray-100">
                    {filterSelectedTagIds.length === 0
                      ? str.admin.filters.tags.placeholder
                      : str.admin.filters.tags.selectedCount.replace("{count}", String(filterSelectedTagIds.length))}
                  </summary>
                  <div className="mt-2 space-y-1 max-h-96 overflow-y-auto border rounded-md p-2 bg-white">
                    {availableTagsWithIds.length === 0 ? (
                      <p className="text-xs text-gray-500 py-2">{str.admin.filters.tags.placeholder}</p>
                    ) : (
                      <>
                        <div className="mb-2 flex flex-wrap items-center gap-2 border-b pb-2">
                          <button
                            type="button"
                            className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-secondary disabled:opacity-50"
                            onClick={() => setFilterSelectedTagIds(getAllTagFilterOptionIds(availableTagsWithIds))}
                            disabled={availableTagsWithIds.length === 0}
                          >
                            {str.admin.filters.tags.selectAll}
                          </button>
                          <button
                            type="button"
                            className="rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none btn-neutral disabled:opacity-50"
                            onClick={() => setFilterSelectedTagIds([])}
                            disabled={filterSelectedTagIds.length === 0}
                          >
                            {str.admin.filters.tags.clearAll}
                          </button>
                        </div>
                        {availableTagsWithIds.map((tag) => {
                          const tagDisplay = `${tag.textbookName} · ${tag.grade} · ${tag.unit} · ${tag.lesson}`;
                          const isSelected = filterSelectedTagIds.includes(tag.id);
                          return (
                            <label key={tag.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded text-xs">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) =>
                                  setFilterSelectedTagIds((prev) => toggleTagFilterId(prev, tag.id, e.target.checked))
                                }
                              />
                              <span>{tagDisplay}</span>
                            </label>
                          );
                        })}
                      </>
                    )}
                  </div>
                </details>
              </div>

              {/* Partial Tag Filter */}
              <div className="space-y-2">
                <label className="block text-xs text-gray-600">{str.admin.filters.partialTag.label}</label>
                <div className="grid grid-cols-2 gap-2 min-w-[280px]">
                  {/* Textbook */}
                  <div className="space-y-0.5">
                    <label className="block text-[11px] text-gray-500">{str.admin.filters.partialTag.textbookLabel}</label>
                    <details className="group">
                      <summary className="cursor-pointer rounded-md border px-2 py-1 text-xs bg-gray-50 hover:bg-gray-100">
                        {filterTagTextbooks.length === 0
                          ? str.admin.filters.partialTag.allOption
                          : str.admin.filters.partialTag.selectedCount.replace("{count}", String(filterTagTextbooks.length))}
                      </summary>
                      <div className="mt-1 space-y-1 max-h-48 overflow-y-auto border rounded-md p-1.5 bg-white z-10 relative">
                        {partialFilterTextbookOptions.map((tb) => (
                          <label key={tb} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded text-xs">
                            <input
                              type="checkbox"
                              checked={filterTagTextbooks.includes(tb)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...filterTagTextbooks, tb]
                                  : filterTagTextbooks.filter((x) => x !== tb);
                                setFilterTagTextbooks(next);
                                setFilterTagGrades((prev) => prev.filter((g) => partialFilterGradeOptions.includes(g)));
                                setFilterTagUnits((prev) => prev.filter((u) => partialFilterUnitOptions.includes(u)));
                                setFilterTagLessons((prev) => prev.filter((l) => partialFilterLessonOptions.includes(l)));
                              }}
                            />
                            <span>{tb}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>
                  {/* Grade */}
                  <div className="space-y-0.5">
                    <label className="block text-[11px] text-gray-500">{str.admin.filters.partialTag.gradeLabel}</label>
                    <details className="group">
                      <summary className="cursor-pointer rounded-md border px-2 py-1 text-xs bg-gray-50 hover:bg-gray-100">
                        {filterTagGrades.length === 0
                          ? str.admin.filters.partialTag.allOption
                          : str.admin.filters.partialTag.selectedCount.replace("{count}", String(filterTagGrades.length))}
                      </summary>
                      <div className="mt-1 space-y-1 max-h-48 overflow-y-auto border rounded-md p-1.5 bg-white z-10 relative">
                        {partialFilterGradeOptions.map((g) => (
                          <label key={g} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded text-xs">
                            <input
                              type="checkbox"
                              checked={filterTagGrades.includes(g)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...filterTagGrades, g]
                                  : filterTagGrades.filter((x) => x !== g);
                                setFilterTagGrades(next);
                                setFilterTagUnits((prev) => prev.filter((u) => partialFilterUnitOptions.includes(u)));
                                setFilterTagLessons((prev) => prev.filter((l) => partialFilterLessonOptions.includes(l)));
                              }}
                            />
                            <span>{g}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>
                  {/* Unit */}
                  <div className="space-y-0.5">
                    <label className="block text-[11px] text-gray-500">{str.admin.filters.partialTag.unitLabel}</label>
                    <details className="group">
                      <summary className="cursor-pointer rounded-md border px-2 py-1 text-xs bg-gray-50 hover:bg-gray-100">
                        {filterTagUnits.length === 0
                          ? str.admin.filters.partialTag.allOption
                          : str.admin.filters.partialTag.selectedCount.replace("{count}", String(filterTagUnits.length))}
                      </summary>
                      <div className="mt-1 space-y-1 max-h-48 overflow-y-auto border rounded-md p-1.5 bg-white z-10 relative">
                        {partialFilterUnitOptions.map((u) => (
                          <label key={u} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded text-xs">
                            <input
                              type="checkbox"
                              checked={filterTagUnits.includes(u)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...filterTagUnits, u]
                                  : filterTagUnits.filter((x) => x !== u);
                                setFilterTagUnits(next);
                                setFilterTagLessons((prev) => prev.filter((l) => partialFilterLessonOptions.includes(l)));
                              }}
                            />
                            <span>{u}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>
                  {/* Lesson */}
                  <div className="space-y-0.5">
                    <label className="block text-[11px] text-gray-500">{str.admin.filters.partialTag.lessonLabel}</label>
                    <details className="group">
                      <summary className="cursor-pointer rounded-md border px-2 py-1 text-xs bg-gray-50 hover:bg-gray-100">
                        {filterTagLessons.length === 0
                          ? str.admin.filters.partialTag.allOption
                          : str.admin.filters.partialTag.selectedCount.replace("{count}", String(filterTagLessons.length))}
                      </summary>
                      <div className="mt-1 space-y-1 max-h-48 overflow-y-auto border rounded-md p-1.5 bg-white z-10 relative">
                        {partialFilterLessonOptions.map((l) => (
                          <label key={l} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded text-xs">
                            <input
                              type="checkbox"
                              checked={filterTagLessons.includes(l)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...filterTagLessons, l]
                                  : filterTagLessons.filter((x) => x !== l);
                                setFilterTagLessons(next);
                              }}
                            />
                            <span>{l}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {!loading && phrases.length > 0 ? (
        <div className="relative z-20 py-1">
          <div className="space-y-2 text-sm text-gray-700">
            <p className="shrink-0">
              {hasActiveFilter ? (
                <>
                  {str.admin.table.summary.filteredLabel}{" "}
                  <span className="font-semibold text-blue-600">{visiblePhrases.length}</span>
                </>
              ) : (
                str.admin.table.summary.noFiltersApplied
              )}
              {str.admin.table.summary.separator}
              {str.admin.table.summary.selectedLabel}{" "}
              <span className="font-semibold text-blue-600">{selectedIds.size}</span>
            </p>
            <div className="space-y-2">
              <div className="flex min-h-[2.5rem] flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  className={toolbarSecondaryButtonClass}
                  disabled={visiblePhrases.length === 0 || toolbarBusy || allFilteredSelected}
                  onClick={handleSelectFiltered}
                >
                  {str.admin.table.selection.selectFiltered.replace("{count}", String(visiblePhrases.length))}
                </button>
                <button
                  type="button"
                  className={toolbarNeutralButtonClass}
                  disabled={selectedIds.size === 0 || toolbarBusy}
                  onClick={handleClearSelection}
                >
                  {str.admin.table.selection.clear}
                </button>
                <button
                  type="button"
                  className={toolbarCautionButtonClass}
                  disabled={toolbarBusy || phrases.length === 0}
                  onClick={() => setOpenBatchMenu((previous) => (previous === "content" ? null : "content"))}
                  title={str.admin.buttonTooltips.preload}
                >
                  <span>{batchRunningKind === "content" ? str.admin.buttons.preloading : str.admin.buttons.preload}</span>
                  {batchRunningKind !== "content" ? <span aria-hidden="true">v</span> : null}
                </button>
                <button
                  type="button"
                  className={`${toolbarButtonBaseClass} border-purple-300 bg-purple-100 text-purple-700`}
                  disabled={toolbarBusy || phrases.length === 0}
                  onClick={() => setOpenBatchMenu((previous) => (previous === "pinyin" ? null : "pinyin"))}
                  title={str.admin.buttonTooltips.refreshAllPinyin}
                >
                  <span>{batchRunningKind === "pinyin" ? str.admin.buttons.refreshingAllPinyin : str.admin.buttons.refreshAllPinyin}</span>
                  {batchRunningKind !== "pinyin" ? <span aria-hidden="true">v</span> : null}
                </button>
                <button
                  type="button"
                  className={`${toolbarSecondaryButtonClass} admin-toolbar-button--session`}
                  disabled={selectedIds.size === 0 || toolbarBusy}
                  onClick={() => setPackageSectionOpen((open) => !open)}
                >
                  <span>{str.admin.buttons.addToReviewTestSession}</span>
                  <span aria-hidden="true" className="text-sm leading-none">🎯</span>
                </button>
                <button
                  type="button"
                  className={toolbarFillTestButtonClass}
                  disabled={selectedIds.size === 0 || toolbarBusy}
                  onClick={() => void handleBatchFillTestToggle()}
                  title={
                    selectedExamplesAllIncluded
                      ? str.admin.table.actionTooltips.batchFillTestOn
                      : str.admin.table.actionTooltips.batchFillTestOff
                  }
                >
                  {selectedExamplesAllIncluded ? str.admin.buttons.batchFillTestOff : str.admin.buttons.batchFillTestOn}
                </button>
              </div>
              {openBatchMenu === "content" ? (
                <div className="w-full max-w-sm rounded-md border bg-white p-2 shadow-lg">
                  <div className="space-y-1">
                    <button
                      type="button"
                      className={toolbarMenuButtonClass}
                      onClick={() => handleBatchContentClick("missing_only")}
                    >
                      {str.admin.batchMenus.content.missingOnly}
                    </button>
                    <button
                      type="button"
                      className={toolbarMenuButtonClass}
                      disabled={phrases.length === 0}
                      onClick={() => handleBatchContentClick("all")}
                    >
                      {str.admin.batchMenus.content.all}
                    </button>
                    <button
                      type="button"
                      className={toolbarMenuButtonClass}
                      disabled={visiblePhrases.length === 0}
                      onClick={() => handleBatchContentClick("filtered")}
                    >
                      {str.admin.batchMenus.content.filtered}
                    </button>
                    <button
                      type="button"
                      className={toolbarMenuButtonClass}
                      disabled={selectedIds.size === 0}
                      onClick={() => handleBatchContentClick("selected")}
                    >
                      {str.admin.batchMenus.content.selected}
                    </button>
                  </div>
                </div>
              ) : null}
              {openBatchMenu === "pinyin" ? (
                <div className="w-full max-w-sm rounded-md border bg-white p-2 shadow-lg">
                  <div className="space-y-1">
                    <button
                      type="button"
                      className={toolbarMenuButtonClass}
                      onClick={() => handleBatchPinyinClick("missing_only")}
                    >
                      {phraseStr.batchMenus.pinyin.missingOnly}
                    </button>
                    <button
                      type="button"
                      className={toolbarMenuButtonClass}
                      disabled={phrases.length === 0}
                      onClick={() => handleBatchPinyinClick("all")}
                    >
                      {phraseStr.batchMenus.pinyin.all}
                    </button>
                    <button
                      type="button"
                      className={toolbarMenuButtonClass}
                      disabled={visiblePhrases.length === 0}
                      onClick={() => handleBatchPinyinClick("filtered")}
                    >
                      {phraseStr.batchMenus.pinyin.filtered}
                    </button>
                    <button
                      type="button"
                      className={toolbarMenuButtonClass}
                      disabled={selectedIds.size === 0}
                      onClick={() => handleBatchPinyinClick("selected")}
                    >
                      {phraseStr.batchMenus.pinyin.selected}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            {batchProgressText ? <p className="text-xs text-amber-700">{batchProgressText}</p> : null}
          </div>
        </div>
      ) : null}

      {batchWarningKind ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/25 px-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md space-y-3 rounded-lg border bg-white p-4 shadow-xl">
            <h3 className="font-medium">
              {batchWarningKind === "content_all"
                ? phraseStr.batchWarningDialogs.contentAll.title
                : phraseStr.batchWarningDialogs.pinyinAll.title}
            </h3>
            <p className="text-sm text-gray-600">
              {batchWarningKind === "content_all"
                ? phraseStr.batchWarningDialogs.contentAll.message
                : phraseStr.batchWarningDialogs.pinyinAll.message}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={toolbarNeutralButtonClass}
                onClick={() => setBatchWarningKind(null)}
              >
                {batchWarningKind === "content_all"
                  ? phraseStr.batchWarningDialogs.contentAll.cancelButton
                  : phraseStr.batchWarningDialogs.pinyinAll.cancelButton}
              </button>
              <button
                type="button"
                className={toolbarCautionButtonClass}
                onClick={handleConfirmBatchWarning}
              >
                {batchWarningKind === "content_all"
                  ? phraseStr.batchWarningDialogs.contentAll.confirmButton
                  : phraseStr.batchWarningDialogs.pinyinAll.confirmButton}
              </button>
            </div>
          </div>
        </div>
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
        <div className="relative z-0 overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
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
