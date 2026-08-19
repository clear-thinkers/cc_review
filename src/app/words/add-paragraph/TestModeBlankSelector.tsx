"use client";

import { renderPhraseWithPinyin } from "../shared/words.shared.utils";
import { buildSentenceRenderTokens, type SentenceRenderToken } from "./ParagraphSpanSelector";
import type { CharacterTriageMatch, PhraseTriageMatch } from "@/lib/paragraphTriage";
import type { Paragraph, ParagraphSentence, ParagraphSpan } from "@/lib/paragraph.types";
import type { AddParagraphStrings } from "./addParagraph.types";

export type TokenEligibility = "unknown" | "ineligible" | "eligible";

/**
 * Any token that resolves to a known word/phrase is eligible by default --
 * being known to the FAMILY (in words/vocab_phrases) is what makes
 * something testable, regardless of whether this specific paragraph has
 * already tracked it as one of its own persisted spans. A phrase curated
 * and imported via a different paragraph is just as real and gradable here.
 * "ineligible" is reserved for the one case that should actually exclude a
 * known token: a persisted span on THIS paragraph explicitly flagged
 * fillTestEligible: false (no UI sets this yet -- nothing sets it false
 * today -- but the classification stays correct for when one does).
 */
export function classifyTokenEligibility(
  token: SentenceRenderToken,
  persistedSpansForSentence: ParagraphSpan[]
): TokenEligibility {
  if (token.kind === "text") return "unknown";

  const known = token.kind === "phrase" || token.wordId !== null;
  if (!known) return "unknown";

  const matchingSpan = persistedSpansForSentence.find(
    (span) => span.startOffset === token.startOffset && span.endOffset === token.endOffset
  );
  if (matchingSpan && matchingSpan.fillTestEligible === false) return "ineligible";
  return "eligible";
}

const SPAN_ID_PATTERN = /^s(\d+)-(\d+)-(\d+)$/;

/** The deterministic id format addParagraphIngestion.ts's mergeResolvedSpansIntoSentences already assigns real spans -- computed here too so a not-yet-persisted eligible token has the same stable id its real span would get once created. */
export function computeSpanId(sentenceIndex: number, startOffset: number, endOffset: number): string {
  return `s${sentenceIndex}-${startOffset}-${endOffset}`;
}

export function parseSpanId(spanId: string): { sentenceIndex: number; startOffset: number; endOffset: number } | null {
  const match = SPAN_ID_PATTERN.exec(spanId);
  if (!match) return null;
  return { sentenceIndex: Number(match[1]), startOffset: Number(match[2]), endOffset: Number(match[3]) };
}

/**
 * Reconstructs the ParagraphSpan a (possibly not-yet-persisted) span id
 * refers to, by re-deriving the triage token at its position. Used at
 * test-mode save time to materialize spans for eligible-but-not-yet-tracked
 * selections before referencing them from paragraph_test_modes.span_ids.
 * Returns null if the id is malformed or no longer resolves to a known
 * token (e.g. the underlying word/phrase was deleted since selection).
 */
export function resolvePendingSpan(
  spanId: string,
  paragraph: Paragraph,
  characterMatchesBySentence: ReadonlyMap<number, CharacterTriageMatch[]>,
  phraseMatchesBySentence: ReadonlyMap<number, PhraseTriageMatch[]>
): ParagraphSpan | null {
  const parsed = parseSpanId(spanId);
  if (!parsed) return null;

  const sentence = paragraph.sentences.find((s) => s.index === parsed.sentenceIndex);
  if (!sentence) return null;

  const tokens = buildSentenceRenderTokens(
    sentence.text,
    characterMatchesBySentence.get(sentence.index) ?? [],
    phraseMatchesBySentence.get(sentence.index) ?? []
  );
  const token = tokens.find((t) => t.startOffset === parsed.startOffset && t.endOffset === parsed.endOffset);
  if (!token || token.kind === "text") return null;

  if (token.kind === "phrase") {
    return {
      id: spanId,
      text: token.text,
      startOffset: token.startOffset,
      endOffset: token.endOffset,
      kind: "phrase",
      resolvedVocabPhraseId: token.vocabPhraseId,
      fillTestEligible: true,
    };
  }

  if (token.wordId === null) return null;
  return {
    id: spanId,
    text: token.text,
    startOffset: token.startOffset,
    endOffset: token.endOffset,
    kind: "character",
    resolvedWordId: token.wordId,
    fillTestEligible: true,
  };
}

/**
 * Merges newly-materialized spans (from resolvePendingSpan) into whatever
 * spans a sentence already has, grouped by the sentenceIndex embedded in
 * each span's own deterministic id. Used at test-mode save time before
 * persisting via updateParagraph -- a sibling to addParagraphIngestion.ts's
 * mergeResolvedSpansIntoSentences, but over already-built ParagraphSpan
 * objects rather than ResolvedParagraphSpan resolution output.
 */
export function mergePendingSpansIntoSentences(
  sentences: ParagraphSentence[],
  newSpans: ParagraphSpan[]
): ParagraphSentence[] {
  const spansBySentenceIndex = new Map<number, ParagraphSpan[]>();
  for (const span of newSpans) {
    const parsed = parseSpanId(span.id);
    if (!parsed) continue;
    const list = spansBySentenceIndex.get(parsed.sentenceIndex) ?? [];
    list.push(span);
    spansBySentenceIndex.set(parsed.sentenceIndex, list);
  }

  return sentences.map((sentence) => ({
    ...sentence,
    spans: [...sentence.spans, ...(spansBySentenceIndex.get(sentence.index) ?? [])].sort(
      (a, b) => a.startOffset - b.startOffset
    ),
  }));
}

export type SpanPosition = { sentenceIndex: number; startOffset: number };

/**
 * Numbers selected spans by paragraph reading position (sentenceIndex then
 * startOffset), never by click/selection order. A span id with no known
 * position (shouldn't normally happen) is silently excluded rather than
 * numbered arbitrarily.
 */
export function assignBlankDisplayIndexes(
  selectedSpanIds: string[],
  positionBySpanId: ReadonlyMap<string, SpanPosition>
): Map<string, number> {
  const withPosition = selectedSpanIds
    .map((id) => ({ id, position: positionBySpanId.get(id) }))
    .filter((entry): entry is { id: string; position: SpanPosition } => entry.position !== undefined);

  withPosition.sort((a, b) => {
    if (a.position.sentenceIndex !== b.position.sentenceIndex) {
      return a.position.sentenceIndex - b.position.sentenceIndex;
    }
    return a.position.startOffset - b.position.startOffset;
  });

  const result = new Map<string, number>();
  withPosition.forEach((entry, index) => result.set(entry.id, index + 1));
  return result;
}

/**
 * Position + display text for every ELIGIBLE token in the paragraph --
 * persisted span or not. Built from live triage tokens (not just
 * paragraph.sentences[].spans[]) so a known-but-not-yet-tracked phrase gets
 * a real position/text entry too, matching its virtual span id.
 */
function buildEligibleTokenPositionMap(
  paragraph: Paragraph,
  characterMatchesBySentence: ReadonlyMap<number, CharacterTriageMatch[]>,
  phraseMatchesBySentence: ReadonlyMap<number, PhraseTriageMatch[]>
): Map<string, SpanPosition & { text: string }> {
  const map = new Map<string, SpanPosition & { text: string }>();
  for (const sentence of paragraph.sentences) {
    const tokens = buildSentenceRenderTokens(
      sentence.text,
      characterMatchesBySentence.get(sentence.index) ?? [],
      phraseMatchesBySentence.get(sentence.index) ?? []
    );
    const spanByOffset = new Map(sentence.spans.map((span) => [span.startOffset, span]));
    for (const token of tokens) {
      if (token.kind === "text") continue;
      const eligibility = classifyTokenEligibility(token, sentence.spans);
      if (eligibility !== "eligible") continue;
      const matchingSpan = spanByOffset.get(token.startOffset);
      const spanId = matchingSpan?.id ?? computeSpanId(sentence.index, token.startOffset, token.endOffset);
      map.set(spanId, { sentenceIndex: sentence.index, startOffset: token.startOffset, text: token.text });
    }
  }
  return map;
}

export type TestModeBlankSelectorProps = {
  paragraph: Paragraph;
  characterMatchesBySentence: Map<number, CharacterTriageMatch[]>;
  phraseMatchesBySentence: Map<number, PhraseTriageMatch[]>;
  selectedSpanIds: string[];
  onSelectedSpanIdsChange: (spanIds: string[]) => void;
  vocabPhrasePinyinByPhrase: Map<string, string>;
  str: AddParagraphStrings["testModes"]["selector"];
};

export default function TestModeBlankSelector({
  paragraph,
  characterMatchesBySentence,
  phraseMatchesBySentence,
  selectedSpanIds,
  onSelectedSpanIdsChange,
  vocabPhrasePinyinByPhrase,
  str,
}: TestModeBlankSelectorProps) {
  const selectedIdSet = new Set(selectedSpanIds);
  const spanPositionById = buildEligibleTokenPositionMap(paragraph, characterMatchesBySentence, phraseMatchesBySentence);
  const displayIndexBySpanId = assignBlankDisplayIndexes(selectedSpanIds, spanPositionById);

  function toggleSpan(spanId: string) {
    if (selectedIdSet.has(spanId)) {
      onSelectedSpanIdsChange(selectedSpanIds.filter((id) => id !== spanId));
    } else {
      onSelectedSpanIdsChange([...selectedSpanIds, spanId]);
    }
  }

  const wordBankEntries = selectedSpanIds
    .map((id) => {
      const index = displayIndexBySpanId.get(id);
      const position = spanPositionById.get(id);
      return index !== undefined && position ? { id, index, text: position.text } : null;
    })
    .filter((entry): entry is { id: string; index: number; text: string } => entry !== null)
    .sort((a, b) => a.index - b.index);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">{str.selectionHint}</p>
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded border-2 border-transparent bg-[#fff1cd]" />
          {str.legendUnknown}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded border-2 border-transparent bg-[#e2e5dc]" />
          {str.legendIneligible}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded border-2 border-transparent bg-[#e8f6e8]" />
          {str.legendEligible}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded border-2 border-dashed border-[#3d6cff] bg-[#dbe6ff]" />
          {str.legendSelected}
        </span>
      </div>

      <div className="space-y-2 rounded-md border bg-white p-3">
        {paragraph.sentences.map((sentence) => {
          const tokens = buildSentenceRenderTokens(
            sentence.text,
            characterMatchesBySentence.get(sentence.index) ?? [],
            phraseMatchesBySentence.get(sentence.index) ?? []
          );
          const spanByOffset = new Map(sentence.spans.map((span) => [span.startOffset, span]));

          return (
            <div key={sentence.index} className={sentence.paragraphBreakBefore ? "border-t pt-3" : ""}>
              <span className="inline-flex flex-wrap items-end gap-0.5">
                {tokens.map((token) => {
                  if (token.kind === "text") {
                    return (
                      <span key={`${token.startOffset}-text`} className="text-base">
                        {token.text}
                      </span>
                    );
                  }

                  const matchingSpan = spanByOffset.get(token.startOffset);
                  const eligibility = classifyTokenEligibility(token, sentence.spans);
                  const spanId = matchingSpan?.id ?? computeSpanId(sentence.index, token.startOffset, token.endOffset);
                  const isCarvedOut = eligibility === "eligible" && selectedIdSet.has(spanId);

                  if (isCarvedOut) {
                    const index = displayIndexBySpanId.get(spanId) ?? 0;
                    return (
                      <button
                        key={spanId}
                        type="button"
                        onClick={() => toggleSpan(spanId)}
                        className="inline-flex h-7 min-w-7 items-center justify-center rounded border-2 border-dashed border-[#3d6cff] bg-[#dbe6ff] px-1.5 text-xs font-semibold text-[#1d3f99]"
                        aria-label={str.blankMarkerAriaLabel.replace("{index}", String(index))}
                      >
                        {index}
                      </button>
                    );
                  }

                  const pinyin = token.kind === "phrase" ? (vocabPhrasePinyinByPhrase.get(token.text) ?? "") : "";
                  const isClickable = eligibility === "eligible";
                  const colorClass =
                    eligibility === "eligible"
                      ? "cursor-pointer border-transparent bg-[#e8f6e8]"
                      : eligibility === "ineligible"
                        ? "cursor-not-allowed border-transparent bg-[#e2e5dc] text-gray-500"
                        : "cursor-not-allowed border-transparent bg-[#fff1cd] text-gray-500";
                  const legendLabel =
                    eligibility === "eligible"
                      ? str.legendEligible
                      : eligibility === "ineligible"
                        ? str.legendIneligible
                        : str.legendUnknown;

                  return (
                    <span
                      key={`${token.startOffset}-${token.endOffset}`}
                      role={isClickable ? "button" : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                      aria-label={`${token.text} (${legendLabel})`}
                      className={`inline-flex rounded border-2 px-0.5 py-0.5 ${colorClass}`}
                      onClick={isClickable ? () => toggleSpan(spanId) : undefined}
                      onKeyDown={
                        isClickable
                          ? (event) => {
                              if (event.key !== "Enter" && event.key !== " ") return;
                              event.preventDefault();
                              toggleSpan(spanId);
                            }
                          : undefined
                      }
                    >
                      {pinyin ? renderPhraseWithPinyin(token.text, pinyin) : token.text}
                    </span>
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>

      <div className="rounded-md border bg-gray-50 p-3">
        <p className="mb-2 text-xs font-medium text-gray-600">{str.wordBankTitle}</p>
        {wordBankEntries.length === 0 ? (
          <p className="text-xs text-gray-500">{str.wordBankEmpty}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {wordBankEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => toggleSpan(entry.id)}
                className="inline-flex items-center gap-1 rounded-full border-2 border-[#3d6cff] bg-[#dbe6ff] px-2 py-1 text-xs"
              >
                <span className="font-semibold">{entry.index}.</span>
                {entry.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
