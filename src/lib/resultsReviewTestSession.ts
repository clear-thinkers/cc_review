import type { FlashcardContentEntry } from "./supabase-service";
import type { ReviewTestSessionTargetDraft } from "./reviewTestSession.types";
import type { Word } from "./types";

export type FailedCharactersReviewTargetResolution = {
  failedCharacters: string[];
  eligibleCharacters: string[];
  skippedCharacters: string[];
  targets: ReviewTestSessionTargetDraft[];
};

function dedupeCharacters(characters: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const character of characters) {
    if (!character || seen.has(character)) {
      continue;
    }

    seen.add(character);
    deduped.push(character);
  }

  return deduped;
}

export function resolveFailedCharactersToReviewTestTargets(
  failedCharacters: string[],
  words: Word[],
  allFlashcardContents: FlashcardContentEntry[]
): FailedCharactersReviewTargetResolution {
  const dedupedFailedCharacters = dedupeCharacters(
    failedCharacters.map((character) => character.trim())
  );
  const wordsByCharacter = new Map<string, Word[]>();
  const contentByCharacter = new Map<string, FlashcardContentEntry[]>();

  for (const word of words) {
    const existing = wordsByCharacter.get(word.hanzi) ?? [];
    existing.push(word);
    wordsByCharacter.set(word.hanzi, existing);
  }

  for (const entry of allFlashcardContents) {
    const existing = contentByCharacter.get(entry.character) ?? [];
    existing.push(entry);
    contentByCharacter.set(entry.character, existing);
  }

  const eligibleCharacters: string[] = [];
  const skippedCharacters: string[] = [];
  const targets: ReviewTestSessionTargetDraft[] = [];
  const seenTargetKeys = new Set<string>();

  for (const character of dedupedFailedCharacters) {
    const matchingWords = wordsByCharacter.get(character) ?? [];
    const matchingContent = contentByCharacter.get(character) ?? [];

    if (matchingWords.length !== 1 || matchingContent.length === 0) {
      skippedCharacters.push(character);
      continue;
    }

    eligibleCharacters.push(character);

    for (const entry of matchingContent) {
      if (seenTargetKeys.has(entry.key)) {
        continue;
      }

      seenTargetKeys.add(entry.key);
      targets.push({
        character: entry.character,
        pronunciation: entry.pronunciation,
        key: entry.key,
      });
    }
  }

  return {
    failedCharacters: dedupedFailedCharacters,
    eligibleCharacters,
    skippedCharacters,
    targets,
  };
}
