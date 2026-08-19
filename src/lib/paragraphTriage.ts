/**
 * Paragraph Import — Known/Unknown Triage
 *
 * Pure functions, no I/O. The genuinely novel logic behind /words/add-paragraph:
 * no existing function detects a known phrase's occurrence inside arbitrary
 * running text (computePhraseIngestionResult in addIngestion.ts only dedupes
 * an already-tokenized flat list against existing phrases).
 *
 * Lives in src/lib/ (Domain layer) — deliberately does not import from
 * src/app/** (UI layer), so Hanzi detection is a local regex rather than a
 * reuse of words.shared.utils.tsx's isHanziCharacter.
 */

const HANZI_CHAR_REGEX = /\p{Script=Han}/u;

export function isHanziChar(char: string): boolean {
  return HANZI_CHAR_REGEX.test(char);
}

export type CharacterTriageMatch = {
  sentenceIndex: number;
  startOffset: number;
  endOffset: number;
  character: string;
  existingWordId: string | null;
};

export type PhraseTriageMatch = {
  sentenceIndex: number;
  startOffset: number;
  endOffset: number;
  phrase: string;
  existingVocabPhraseId: string;
};

/**
 * One match per Hanzi occurrence — not deduped; a character appearing three
 * times in the pasted text produces three independently-selectable matches.
 * `existingWordId` is null when the character isn't yet in `words` for the
 * family (the "unknown" flag the UI renders on).
 */
export function triageParagraphCharacters(
  sentences: string[],
  existingHanzi: Map<string, string>
): CharacterTriageMatch[] {
  const matches: CharacterTriageMatch[] = [];

  sentences.forEach((sentenceText, sentenceIndex) => {
    for (let offset = 0; offset < sentenceText.length; offset += 1) {
      const char = sentenceText[offset];
      if (!isHanziChar(char)) continue;
      matches.push({
        sentenceIndex,
        startOffset: offset,
        endOffset: offset + 1,
        character: char,
        existingWordId: existingHanzi.get(char) ?? null,
      });
    }
  });

  return matches;
}

/**
 * Substring scan per sentence, longest-match-first at each start offset, so
 * a longer known phrase (e.g. "图书馆") isn't also separately flagged for a
 * shorter known phrase it contains ("图书") at an overlapping position. A
 * match never spans a sentence boundary, since the scan runs per sentence.
 *
 * Only ever produces matches against phrases already known to the family —
 * there is no such thing as an "unknown phrase match" here, since nothing
 * marks a boundary for an as-yet-unadded phrase. Net-new multi-character
 * spans are a UI selection concern (see ParagraphSpanSelector.tsx /
 * addParagraphIngestion.ts), not a triage concern.
 */
export function triagePhrasesInText(
  sentences: string[],
  existingPhrases: Map<string, string>
): PhraseTriageMatch[] {
  const matches: PhraseTriageMatch[] = [];
  if (existingPhrases.size === 0) {
    return matches;
  }

  let maxPhraseLength = 0;
  for (const phrase of existingPhrases.keys()) {
    if (phrase.length > maxPhraseLength) maxPhraseLength = phrase.length;
  }

  sentences.forEach((sentenceText, sentenceIndex) => {
    let offset = 0;
    while (offset < sentenceText.length) {
      const upperBound = Math.min(maxPhraseLength, sentenceText.length - offset);
      let matchedLength = 0;
      let matchedId: string | undefined;

      for (let length = upperBound; length >= 2; length -= 1) {
        const candidate = sentenceText.slice(offset, offset + length);
        const id = existingPhrases.get(candidate);
        if (id) {
          matchedLength = length;
          matchedId = id;
          break;
        }
      }

      if (matchedId) {
        matches.push({
          sentenceIndex,
          startOffset: offset,
          endOffset: offset + matchedLength,
          phrase: sentenceText.slice(offset, offset + matchedLength),
          existingVocabPhraseId: matchedId,
        });
        offset += matchedLength;
      } else {
        offset += 1;
      }
    }
  });

  return matches;
}
