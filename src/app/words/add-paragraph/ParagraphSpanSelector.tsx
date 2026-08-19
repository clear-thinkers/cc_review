"use client";

import { useEffect, useState } from "react";
import { renderPhraseWithPinyin } from "../shared/words.shared.utils";
import type { CharacterTriageMatch, PhraseTriageMatch } from "@/lib/paragraphTriage";
import type { ParagraphSentence } from "@/lib/paragraph.types";
import type { AddParagraphStrings, ParagraphSpanRange } from "./addParagraph.types";
import { toggleSelectionRange } from "./addParagraphIngestion";

/**
 * One renderable unit of a sentence: a known phrase match (atomic — per the
 * feature spec's resolved overlap rule, a phrase always wins over any
 * character match it covers, and the whole phrase is one selectable unit,
 * never independently selectable at the character level within it), a
 * single Hanzi character (known or unknown), or non-selectable plain text
 * (punctuation, spaces, non-Hanzi).
 */
export type SentenceRenderToken =
  | { kind: "phrase"; startOffset: number; endOffset: number; text: string; vocabPhraseId: string }
  | { kind: "character"; startOffset: number; endOffset: number; text: string; wordId: string | null }
  | { kind: "text"; startOffset: number; endOffset: number; text: string };

/**
 * Merges the two independent triage match lists into one ordered token
 * list for rendering/selection. A phrase match consumes its whole range in
 * one jump, so any character match inside it is never visited — this is
 * the overlap-resolution rule (phrase wins, no independent character
 * select), kept out of paragraphTriage.ts's pure functions per the spec.
 */
export function buildSentenceRenderTokens(
  sentenceText: string,
  characterMatches: CharacterTriageMatch[],
  phraseMatches: PhraseTriageMatch[]
): SentenceRenderToken[] {
  const tokens: SentenceRenderToken[] = [];
  const charByOffset = new Map(characterMatches.map((match) => [match.startOffset, match]));
  const phraseByOffset = new Map(phraseMatches.map((match) => [match.startOffset, match]));

  let offset = 0;
  while (offset < sentenceText.length) {
    const phraseMatch = phraseByOffset.get(offset);
    if (phraseMatch) {
      tokens.push({
        kind: "phrase",
        startOffset: phraseMatch.startOffset,
        endOffset: phraseMatch.endOffset,
        text: phraseMatch.phrase,
        vocabPhraseId: phraseMatch.existingVocabPhraseId,
      });
      offset = phraseMatch.endOffset;
      continue;
    }

    const charMatch = charByOffset.get(offset);
    if (charMatch) {
      tokens.push({
        kind: "character",
        startOffset: charMatch.startOffset,
        endOffset: charMatch.endOffset,
        text: charMatch.character,
        wordId: charMatch.existingWordId,
      });
      offset = charMatch.endOffset;
      continue;
    }

    tokens.push({
      kind: "text",
      startOffset: offset,
      endOffset: offset + 1,
      text: sentenceText[offset],
    });
    offset += 1;
  }

  return tokens;
}

/** Contiguous run id per token; "text" tokens never belong to a run. */
function assignTokenRuns(tokens: SentenceRenderToken[]): number[] {
  const runs: number[] = [];
  let currentRun = 0;
  let runOpen = false;
  for (const token of tokens) {
    if (token.kind === "text") {
      runs.push(-1);
      runOpen = false;
      continue;
    }
    if (!runOpen) {
      currentRun += 1;
      runOpen = true;
    }
    runs.push(currentRun);
  }
  return runs;
}

/**
 * A drag can only extend within the contiguous selectable run it started
 * in — if the pointer moves onto a token from a different run (crossing a
 * non-Hanzi token), the range clamps back to the anchor alone rather than
 * jumping across the gap.
 */
export function computeDragSelectionRange(
  tokens: SentenceRenderToken[],
  anchorTokenIndex: number,
  currentTokenIndex: number
): ParagraphSpanRange | null {
  const runs = assignTokenRuns(tokens);
  const anchorRun = runs[anchorTokenIndex];
  if (anchorRun === undefined || anchorRun === -1) return null;

  const targetIndex = runs[currentTokenIndex] === anchorRun ? currentTokenIndex : anchorTokenIndex;
  const lo = Math.min(anchorTokenIndex, targetIndex);
  const hi = Math.max(anchorTokenIndex, targetIndex);
  return { startOffset: tokens[lo].startOffset, endOffset: tokens[hi].endOffset };
}

function isTokenWithinRange(token: SentenceRenderToken, range: ParagraphSpanRange): boolean {
  return range.startOffset <= token.startOffset && token.endOffset <= range.endOffset;
}

export type ParagraphSpanSelectorProps = {
  sentence: ParagraphSentence;
  characterMatches: CharacterTriageMatch[];
  phraseMatches: PhraseTriageMatch[];
  selectedRanges: ParagraphSpanRange[];
  onSelectionChange: (ranges: ParagraphSpanRange[]) => void;
  vocabPhrasePinyinByPhrase: Map<string, string>;
  str: AddParagraphStrings["selector"];
};

export default function ParagraphSpanSelector({
  sentence,
  characterMatches,
  phraseMatches,
  selectedRanges,
  onSelectionChange,
  vocabPhrasePinyinByPhrase,
  str,
}: ParagraphSpanSelectorProps) {
  const [dragAnchorIndex, setDragAnchorIndex] = useState<number | null>(null);
  const [dragHoverIndex, setDragHoverIndex] = useState<number | null>(null);

  const tokens = buildSentenceRenderTokens(sentence.text, characterMatches, phraseMatches);

  const liveRange =
    dragAnchorIndex !== null
      ? computeDragSelectionRange(tokens, dragAnchorIndex, dragHoverIndex ?? dragAnchorIndex)
      : null;

  useEffect(() => {
    if (dragAnchorIndex === null) return;

    function finishDrag() {
      if (liveRange) {
        onSelectionChange(toggleSelectionRange(selectedRanges, liveRange));
      }
      setDragAnchorIndex(null);
      setDragHoverIndex(null);
    }

    window.addEventListener("mouseup", finishDrag);
    return () => window.removeEventListener("mouseup", finishDrag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragAnchorIndex, dragHoverIndex]);

  function handleTokenMouseDown(tokenIndex: number, token: SentenceRenderToken) {
    if (token.kind === "text") return;
    setDragAnchorIndex(tokenIndex);
    setDragHoverIndex(tokenIndex);
  }

  function handleTokenMouseEnter(tokenIndex: number, token: SentenceRenderToken) {
    if (dragAnchorIndex === null || token.kind === "text") return;
    setDragHoverIndex(tokenIndex);
  }

  return (
    <span className="inline-flex flex-wrap items-end gap-0.5 select-none" title={str.legendKnown}>
      {tokens.map((token, tokenIndex) => {
        if (token.kind === "text") {
          return (
            <span key={`${token.startOffset}-text`} className="text-base">
              {token.text}
            </span>
          );
        }

        const known = token.kind === "phrase" || token.wordId !== null;
        const isCommitted = selectedRanges.some((range) => isTokenWithinRange(token, range));
        const isLivePreview = liveRange ? isTokenWithinRange(token, liveRange) : false;
        const isSelected = isCommitted || isLivePreview;

        const baseClass = "inline-flex cursor-pointer rounded px-0.5 py-0.5 border-2";
        const colorClass = isSelected
          ? "border-[#3d6cff] bg-[#dbe6ff]"
          : known
            ? "border-transparent bg-[#e8f6e8]"
            : "border-transparent bg-[#fff1cd]";

        const ariaLabel = known ? `${token.text} (${str.legendKnown})` : `${token.text} (${str.legendUnknown})`;
        const pinyin = token.kind === "phrase" ? (vocabPhrasePinyinByPhrase.get(token.text) ?? "") : "";

        return (
          <span
            key={`${token.startOffset}-${token.endOffset}`}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={ariaLabel}
            className={`${baseClass} ${colorClass}`}
            onMouseDown={() => handleTokenMouseDown(tokenIndex, token)}
            onMouseEnter={() => handleTokenMouseEnter(tokenIndex, token)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onSelectionChange(
                toggleSelectionRange(selectedRanges, {
                  startOffset: token.startOffset,
                  endOffset: token.endOffset,
                })
              );
            }}
          >
            {pinyin ? renderPhraseWithPinyin(token.text, pinyin) : token.text}
          </span>
        );
      })}
    </span>
  );
}
