"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/app/shared/locale";
import {
  createParagraphTestMode,
  deleteParagraphTestMode,
  listParagraphTestModes,
  PARAGRAPH_TEST_MODE_NAME_TAKEN,
  updateParagraph,
  updateParagraphTestMode,
} from "@/lib/supabase-service";
import type { ParagraphTestMode } from "@/lib/paragraphTestMode.types";
import type { ParagraphSpan } from "@/lib/paragraph.types";
import { triageParagraphCharacters, triagePhrasesInText } from "@/lib/paragraphTriage";
import type { CharacterTriageMatch, PhraseTriageMatch } from "@/lib/paragraphTriage";
import type { WordsWorkspaceVM } from "../shared/WordsWorkspaceVM";
import { addParagraphStrings } from "./addParagraph.strings";
import TestModeBlankSelector, {
  classifyTokenEligibility,
  mergePendingSpansIntoSentences,
  resolvePendingSpan,
} from "./TestModeBlankSelector";
import { buildSentenceRenderTokens } from "./ParagraphSpanSelector";

function groupBySentence<T extends { sentenceIndex: number }>(matches: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const match of matches) {
    const list = map.get(match.sentenceIndex) ?? [];
    list.push(match);
    map.set(match.sentenceIndex, list);
  }
  return map;
}

export default function TestModeSection({ vm }: { vm: WordsWorkspaceVM }) {
  const locale = useLocale();
  const str = addParagraphStrings[locale].testModes;

  const paragraph = useMemo(
    () => vm.paragraphs.find((p) => p.id === vm.paragraphSelectedId) ?? null,
    [vm.paragraphs, vm.paragraphSelectedId]
  );

  const [testModes, setTestModes] = useState<ParagraphTestMode[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formSpanIds, setFormSpanIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!paragraph) return;
    setLoading(true);
    listParagraphTestModes(paragraph.id)
      .then(setTestModes)
      .catch(() => setTestModes([]))
      .finally(() => setLoading(false));
  }, [paragraph]);

  const vocabPhrasePinyinByPhrase = useMemo(
    () => new Map(vm.vocabPhrases.filter((p) => p.pinyin).map((p) => [p.phrase, p.pinyin as string])),
    [vm.vocabPhrases]
  );

  const { characterMatchesBySentence, phraseMatchesBySentence, eligibleSpanCount } = useMemo(() => {
    if (!paragraph) {
      return { characterMatchesBySentence: new Map(), phraseMatchesBySentence: new Map(), eligibleSpanCount: 0 };
    }
    const existingHanzi = new Map(vm.words.map((word) => [word.hanzi, word.id]));
    const existingPhrases = new Map(vm.vocabPhrases.map((phrase) => [phrase.phrase, phrase.id]));
    const sentenceTexts = paragraph.sentences.map((sentence) => sentence.text);
    const characterMatches: CharacterTriageMatch[] = triageParagraphCharacters(sentenceTexts, existingHanzi);
    const phraseMatches: PhraseTriageMatch[] = triagePhrasesInText(sentenceTexts, existingPhrases);
    const charactersBySentence = groupBySentence(characterMatches);
    const phrasesBySentence = groupBySentence(phraseMatches);

    // Counts every token the family already knows, not just spans this
    // specific paragraph already tracks -- matches classifyTokenEligibility,
    // which no longer requires a token to already be a persisted span here.
    const count = paragraph.sentences.reduce((sum, sentence) => {
      const tokens = buildSentenceRenderTokens(
        sentence.text,
        charactersBySentence.get(sentence.index) ?? [],
        phrasesBySentence.get(sentence.index) ?? []
      );
      const eligibleCount = tokens.filter(
        (token) => token.kind !== "text" && classifyTokenEligibility(token, sentence.spans) === "eligible"
      ).length;
      return sum + eligibleCount;
    }, 0);

    return {
      characterMatchesBySentence: charactersBySentence,
      phraseMatchesBySentence: phrasesBySentence,
      eligibleSpanCount: count,
    };
  }, [paragraph, vm.words, vm.vocabPhrases]);

  function handleBack() {
    vm.setParagraphViewMode("library");
    vm.setParagraphSelectedId(null);
  }

  function openCreateForm() {
    setEditingId(null);
    setFormName("");
    setFormSpanIds([]);
    setNotice(null);
    setFormOpen(true);
  }

  function openEditForm(mode: ParagraphTestMode) {
    setEditingId(mode.id);
    setFormName(mode.name);
    setFormSpanIds(mode.spanIds);
    setNotice(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setFormName("");
    setFormSpanIds([]);
  }

  async function handleDelete(id: string) {
    await deleteParagraphTestMode(id);
    setTestModes((previous) => previous.filter((mode) => mode.id !== id));
  }

  async function handleSave() {
    if (!paragraph) return;
    if (!formName.trim()) {
      setNotice(str.nameRequiredError);
      return;
    }
    if (formSpanIds.length === 0) {
      setNotice(str.emptySelectionError);
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      // A selected span id may not be a persisted span on this paragraph
      // yet -- eligibility no longer requires that (see
      // TestModeBlankSelector.tsx's classifyTokenEligibility). Materialize
      // any such spans and persist them before the test mode references
      // their ids, so paragraph_test_modes.span_ids always points at real,
      // resolvable spans.
      const existingSpanIds = new Set(paragraph.sentences.flatMap((sentence) => sentence.spans.map((s) => s.id)));
      const missingSpanIds = formSpanIds.filter((id) => !existingSpanIds.has(id));

      let targetParagraphId = paragraph.id;
      if (missingSpanIds.length > 0) {
        const newSpans = missingSpanIds
          .map((id) => resolvePendingSpan(id, paragraph, characterMatchesBySentence, phraseMatchesBySentence))
          .filter((span): span is ParagraphSpan => span !== null);

        if (newSpans.length > 0) {
          const mergedSentences = mergePendingSpansIntoSentences(paragraph.sentences, newSpans);
          const updatedParagraph = await updateParagraph(paragraph.id, { sentences: mergedSentences });
          targetParagraphId = updatedParagraph.id;
          vm.setParagraphs((previous) => previous.map((p) => (p.id === updatedParagraph.id ? updatedParagraph : p)));
        }
      }

      if (editingId) {
        const updated = await updateParagraphTestMode(editingId, { name: formName, spanIds: formSpanIds });
        setTestModes((previous) => previous.map((mode) => (mode.id === editingId ? updated : mode)));
        setNotice(str.updatedNotice);
      } else {
        const created = await createParagraphTestMode(targetParagraphId, formName, formSpanIds);
        setTestModes((previous) => [...previous, created]);
        setNotice(str.createdNotice);
      }
      closeForm();
    } catch (error) {
      if (error instanceof Error && error.message === PARAGRAPH_TEST_MODE_NAME_TAKEN) {
        setNotice(str.nameTakenError);
      } else {
        setNotice(str.saveError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (vm.page !== "addParagraph" || vm.paragraphViewMode !== "testModes" || !paragraph) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <button type="button" onClick={handleBack} className="text-sm text-blue-600 underline">
        {str.backLink}
      </button>
      <h2 className="font-medium">{str.pageTitle}</h2>
      <p className="text-sm text-gray-700">{str.pageDescription}</p>
      {notice ? <p className="text-sm text-blue-700">{notice}</p> : null}

      {loading ? null : testModes.length === 0 && !formOpen ? (
        <p className="text-sm text-gray-500">{str.listEmptyState}</p>
      ) : (
        <ul className="space-y-2">
          {testModes.map((mode) => (
            <li key={mode.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{mode.name}</p>
                <p className="text-xs text-gray-500">{str.blankCountLabel.replace("{count}", String(mode.spanIds.length))}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEditForm(mode)}
                  className="btn-nav rounded-md border-2 px-3 py-1 text-xs hover:bg-[#fff1cd]"
                >
                  {str.editAction}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(mode.id)}
                  className="btn-destructive rounded-md border-2 px-3 py-1 text-xs"
                >
                  {str.deleteAction}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!formOpen ? (
        eligibleSpanCount === 0 ? (
          <p className="text-sm text-gray-500">{str.noEligibleSpansNotice}</p>
        ) : (
          <button
            type="button"
            onClick={openCreateForm}
            className="btn-primary rounded-md border-2 px-4 py-2"
          >
            {str.newButton}
          </button>
        )
      ) : (
        <div className="space-y-3 rounded-md border p-3">
          <input
            className="w-full rounded-md border px-3 py-2"
            placeholder={str.namePlaceholder}
            aria-label={str.nameLabel}
            value={formName}
            onChange={(event) => setFormName(event.target.value)}
            disabled={submitting}
          />

          <TestModeBlankSelector
            paragraph={paragraph}
            characterMatchesBySentence={characterMatchesBySentence}
            phraseMatchesBySentence={phraseMatchesBySentence}
            selectedSpanIds={formSpanIds}
            onSelectedSpanIdsChange={setFormSpanIds}
            vocabPhrasePinyinByPhrase={vocabPhrasePinyinByPhrase}
            str={str.selector}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="btn-primary rounded-md border-2 px-4 py-2 disabled:opacity-50"
            >
              {str.saveButton}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={submitting}
              className="btn-neutral rounded-md border-2 px-4 py-2 disabled:opacity-50"
            >
              {str.cancelButton}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
