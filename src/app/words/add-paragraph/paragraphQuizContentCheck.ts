import type { ParagraphSpan } from "@/lib/paragraph.types";
import type { Word, VocabPhrase } from "@/lib/types";
import type { FlashcardContentEntry } from "@/lib/supabase-service";
import { vocabPhraseHasContent } from "../admin/vocabPhraseAdmin.utils";

/**
 * Whether a paragraph-quiz blank has content the Reveal-after-3-bounces Hint
 * popup (ParagraphQuizRevealPopup.tsx) can actually show. Mirrors that
 * popup's own resolution: a word-backed blank needs at least one
 * flashcard_contents row for its hanzi (resolveCharacterRevealContent
 * returns null otherwise); a phrase-backed blank uses the same
 * vocabPhraseHasContent bar Content Admin's Phrases view already uses for
 * its "With Content" bucket, since resolvePhraseRevealContent never returns
 * null but would render an unhelpfully empty popup for a phrase missing
 * pinyin/meanings/examples.
 */
export function spanHasHintableContent(
  span: ParagraphSpan,
  words: Word[],
  vocabPhrases: VocabPhrase[],
  allFlashcardContents: FlashcardContentEntry[]
): boolean {
  if (span.resolvedVocabPhraseId) {
    const phrase = vocabPhrases.find((item) => item.id === span.resolvedVocabPhraseId);
    return phrase ? vocabPhraseHasContent(phrase) : false;
  }
  if (span.resolvedWordId) {
    const word = words.find((item) => item.id === span.resolvedWordId);
    if (!word) return false;
    return allFlashcardContents.some((entry) => entry.character === word.hanzi);
  }
  return false;
}
