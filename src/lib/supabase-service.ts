/**
 * Supabase Service Layer
 *
 * Replaces src/lib/db.ts (IndexedDB via Dexie). All data access goes through
 * Supabase client using the browser anon key. RLS policies scope reads/writes
 * to the current family_id and user_id from JWT app_metadata claims.
 *
 * camelCase ↔ snake_case conversion happens exclusively in this module.
 */

import { supabase } from "./supabaseClient";
import { getJwtAppMetadata } from "./decodeJwtPayload";
import type { Word, VocabPhrase, VocabPhraseExample } from "./types";
import type { Paragraph, ParagraphSentence, ParagraphSpan } from "./paragraph.types";
import type { ParagraphTestMode } from "./paragraphTestMode.types";
import type { FlashcardLlmResponse } from "./flashcardLlm";
import type { QuizSession } from "./quiz.types";
import type { Wallet } from "./wallet.types";
import type {
  ShopIngredientPrice,
  ShopRecipe,
  ShopTransaction,
  ShopRecipeUnlock,
  UnlockShopRecipeResult,
  CoinRedemption,
  RedeemCoinsResult,
  CoinBreakdown,
  RewardedIngredient,
} from "./shop.types";
import { calculateNextState, isDue } from "./scheduler";
import type { Grade, GradeResult } from "./scheduler";
import { canonicalizeShopIngredientKey } from "./shopIngredients";
import { normalizeUnlockShopRecipeResult, normalizeRedeemCoinsResult } from "./shop";
import {
  normalizeShopIngredientList,
  normalizeShopLocalizedIngredients,
  normalizeShopLocalizedIntro,
  normalizeShopVariantIconRules,
  normalizeShopSpecialIngredientList,
  normalizeShopLocalizedSpecialIngredients,
  normalizeShopLocalizedTitle,
} from "./shop";
import type {
  Textbook,
  LessonTag,
  WordLessonTagsMap,
  VocabPhraseLessonTagsMap,
  ResolvedLessonTag,
} from "./tagging.types";
import type { HiddenAdminTarget } from "./admin.types";
import type {
  ReviewTestSession,
  ReviewTestSessionTargetDraft,
} from "./reviewTestSession.types";
import type {
  ReviewSessionProgress,
  ReviewSessionProgressSourceType,
} from "./reviewSessionProgress.types";

// ─── Exported types (moved from db.ts) ─────────────────────────────────────

export type FlashcardContentEntry = {
  key: string;
  character: string;
  pronunciation: string;
  content: FlashcardLlmResponse;
  updatedAt: number;
};

// ─── Internal: session metadata helpers ─────────────────────────────────────

interface SessionMetadata {
  familyId: string;
  userId: string;
  authUserId: string;
}

async function getSessionMetadata(): Promise<SessionMetadata> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("No active Supabase session");
  // Deliberately NOT session.user.app_metadata -- that field comes from the
  // auth.users DB row (GoTrue's /token response `user` object), which
  // session-scoped profile claims (2026-08-08) stopped writing on every PIN
  // switch. It is frozen at whatever it was before that migration and does
  // not reflect the currently active Layer 2 profile. The access token's OWN
  // app_metadata claim is what the custom_access_token_hook keeps
  // session-scoped and correct -- the same claim Postgres RLS reads via
  // current_family_id()/current_user_id(). See
  // docs/fix-log/build-fix-log-2026-07-30-packaged-session-limbo.md.
  const meta = getJwtAppMetadata(session.access_token);
  if (!meta?.family_id || !meta?.user_id) {
    throw new Error("JWT missing family_id or user_id in app_metadata");
  }
  return {
    familyId: meta.family_id as string,
    userId: meta.user_id as string,
    authUserId: session.user.id,
  };
}

// ─── Internal: Word row converters ──────────────────────────────────────────

interface SupabaseWordRow {
  id: string;
  family_id: string;
  hanzi: string;
  created_at: string;
  repetitions: number;
  interval_days: number;
  ease: number;
  next_review_at: number;
  review_count: number;
  test_count: number;
  fill_test: unknown;
}

function toWord(row: SupabaseWordRow): Word {
  return {
    id: row.id,
    hanzi: row.hanzi,
    createdAt: new Date(row.created_at).getTime(),
    repetitions: row.repetitions,
    intervalDays: row.interval_days,
    ease: row.ease,
    nextReviewAt: Number(row.next_review_at),
    reviewCount: row.review_count,
    testCount: row.test_count,
    fillTest: row.fill_test as Word["fillTest"],
  };
}

function fromWord(word: Word, familyId: string): Record<string, unknown> {
  return {
    id: word.id,
    family_id: familyId,
    hanzi: word.hanzi,
    created_at: new Date(word.createdAt).toISOString(),
    repetitions: word.repetitions,
    interval_days: word.intervalDays,
    ease: word.ease,
    next_review_at: word.nextReviewAt,
    review_count: word.reviewCount ?? 0,
    test_count: word.testCount ?? 0,
    fill_test: word.fillTest ?? null,
  };
}

// ─── Internal: FlashcardContent row converters ──────────────────────────────

function toFlashcardContentEntry(row: {
  id: string;
  meanings: unknown;
  updated_at: string;
}): FlashcardContentEntry {
  const [character, pronunciation] = row.id.split("|");
  return {
    key: row.id,
    character,
    pronunciation,
    content: {
      character,
      pronunciation,
      meanings: row.meanings as FlashcardLlmResponse["meanings"],
    },
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

// ─── Internal: QuizSession row converters ───────────────────────────────────

interface SupabaseQuizSessionRow {
  id: string;
  created_at: string;
  session_type: string;
  grade_data: unknown;
  fully_correct_count: number;
  failed_count: number;
  partially_correct_count: number;
  total_grades: number;
  duration_seconds: number;
  coins_earned: number;
}

function toQuizSession(row: SupabaseQuizSessionRow): QuizSession {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    sessionType: row.session_type as QuizSession["sessionType"],
    gradeData: row.grade_data as QuizSession["gradeData"],
    fullyCorrectCount: row.fully_correct_count,
    failedCount: row.failed_count,
    partiallyCorrectCount: row.partially_correct_count,
    totalGrades: row.total_grades,
    durationSeconds: row.duration_seconds,
    coinsEarned: row.coins_earned,
  };
}

interface SupabaseReviewTestSessionRow {
  id: string;
  name: string;
  created_at: string;
  created_by_user_id: string;
  completed_at: string | null;
  completed_by_user_id: string | null;
  paragraph_test_mode_id: string | null;
}

interface SupabaseReviewTestSessionTargetRow {
  session_id: string;
  character: string;
  pronunciation: string;
  display_order: number;
  vocab_phrase_id: string | null;
  paragraph_id?: string | null;
  paragraph_span_id?: string | null;
}

function normalizeReviewTestSessionDraftTargets(
  targets: ReviewTestSessionTargetDraft[]
): ReviewTestSessionTargetDraft[] {
  const seenKeys = new Set<string>();
  const normalized: ReviewTestSessionTargetDraft[] = [];

  for (const target of targets) {
    const character = target.character.trim();
    const pronunciation = target.pronunciation.trim();
    // paragraphSpanId is folded into the dedup key (mirroring the DB unique
    // constraint) so two different blanks for the same character/phrase
    // aren't collapsed into one target before they even reach the DB.
    const key = `${character}|${pronunciation}|${target.paragraphSpanId ?? ""}`;
    if (!character || !pronunciation || seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    normalized.push({
      character,
      pronunciation,
      key,
      ...(target.vocabPhraseId ? { vocabPhraseId: target.vocabPhraseId } : {}),
      ...(target.paragraphId ? { paragraphId: target.paragraphId } : {}),
      ...(target.paragraphSpanId ? { paragraphSpanId: target.paragraphSpanId } : {}),
    });
  }

  return normalized;
}

function toReviewTestSessionTarget(
  row: SupabaseReviewTestSessionTargetRow
): ReviewTestSession["targets"][number] {
  const character = row.character.trim();
  const pronunciation = row.pronunciation.trim();
  return {
    sessionId: row.session_id,
    character,
    pronunciation,
    key: `${character}|${pronunciation}|${row.paragraph_span_id ?? ""}`,
    displayOrder: row.display_order,
    ...(row.vocab_phrase_id ? { vocabPhraseId: row.vocab_phrase_id } : {}),
    ...(row.paragraph_id ? { paragraphId: row.paragraph_id } : {}),
    ...(row.paragraph_span_id ? { paragraphSpanId: row.paragraph_span_id } : {}),
  };
}

function toReviewTestSession(
  row: SupabaseReviewTestSessionRow,
  targets: ReviewTestSession["targets"]
): ReviewTestSession {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at).getTime(),
    createdByUserId: row.created_by_user_id,
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
    completedByUserId: row.completed_by_user_id,
    targets,
    paragraphTestModeId: row.paragraph_test_mode_id ?? null,
  };
}

// ─── Internal: Wallet row converters ────────────────────────────────────────

interface SupabaseWalletRow {
  user_id: string;
  family_id?: string;
  total_coins: number;
  last_updated_at: string;
  version: number;
}

function toWallet(row: SupabaseWalletRow): Wallet {
  return {
    userId: row.user_id,
    totalCoins: row.total_coins,
    lastUpdatedAt: new Date(row.last_updated_at).getTime(),
    version: row.version,
  };
}

function createZeroWallet(userId: string): Wallet {
  return {
    userId,
    totalCoins: 0,
    lastUpdatedAt: Date.now(),
    version: 1,
  };
}

// â”€â”€â”€ Internal: Shop row converters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface SupabaseShopRecipeRow {
  id: string;
  slug: string;
  title: string;
  title_i18n?: unknown;
  display_order: number;
  is_active: boolean;
  variant_icon_rules: unknown;
  intro: string;
  intro_i18n?: unknown;
  unlock_cost_coins: number;
  base_ingredients: unknown;
  base_ingredients_i18n?: unknown;
  special_ingredient_slots: unknown;
  special_ingredient_slots_i18n?: unknown;
}

interface SupabaseShopRecipeUnlockRow {
  user_id: string;
  recipe_id: string;
  coins_spent: number;
  unlocked_at: string;
}

interface SupabaseShopTransactionRow {
  id: string;
  user_id: string;
  recipe_id: string | null;
  action_type: "unlock_recipe";
  coins_spent: number;
  beginning_balance: number;
  ending_balance: number;
  created_at: string;
}

interface SupabaseShopIngredientPriceRow {
  ingredient_key: string;
  cost_coins: number;
  updated_at: string;
  label_i18n?: unknown;
  icon_path?: string | null;
}

function toShopRecipe(row: SupabaseShopRecipeRow): ShopRecipe {
  const baseIngredients = normalizeShopIngredientList(row.base_ingredients, []);
  const specialIngredients = normalizeShopSpecialIngredientList(
    row.special_ingredient_slots,
    []
  );

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    titleI18n: normalizeShopLocalizedTitle(row.title_i18n, row.title),
    displayOrder: row.display_order,
    isActive: row.is_active,
    intro: row.intro,
    introI18n: normalizeShopLocalizedIntro(row.intro_i18n, row.intro),
    unlockCostCoins: row.unlock_cost_coins,
    baseIngredients,
    baseIngredientsI18n: normalizeShopLocalizedIngredients(
      row.base_ingredients_i18n,
      baseIngredients
    ),
    specialIngredients,
    specialIngredientsI18n: normalizeShopLocalizedSpecialIngredients(
      row.special_ingredient_slots_i18n,
      specialIngredients
    ),
    variantIconRules: normalizeShopVariantIconRules(row.variant_icon_rules),
  };
}

function toShopRecipeUnlock(row: SupabaseShopRecipeUnlockRow): ShopRecipeUnlock {
  return {
    userId: row.user_id,
    recipeId: row.recipe_id,
    coinsSpent: row.coins_spent,
    unlockedAt: new Date(row.unlocked_at).getTime(),
  };
}

function toShopTransaction(row: SupabaseShopTransactionRow): ShopTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    recipeId: row.recipe_id,
    actionType: row.action_type,
    coinsSpent: row.coins_spent,
    beginningBalance: row.beginning_balance,
    endingBalance: row.ending_balance,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function toShopIngredientPrice(row: SupabaseShopIngredientPriceRow): ShopIngredientPrice {
  return {
    ingredientKey: canonicalizeShopIngredientKey(row.ingredient_key),
    costCoins: row.cost_coins,
    updatedAt: new Date(row.updated_at).getTime(),
    ...(typeof row.icon_path === "string"
      ? { iconPath: row.icon_path.trim() || null }
      : {}),
    ...(row.label_i18n && typeof row.label_i18n === "object"
      ? {
          labelI18n: {
            en:
              typeof (row.label_i18n as { en?: unknown }).en === "string"
                ? ((row.label_i18n as { en: string }).en ?? "").trim()
                : "",
            zh:
              typeof (row.label_i18n as { zh?: unknown }).zh === "string"
                ? ((row.label_i18n as { zh: string }).zh ?? "").trim()
                : "",
          },
        }
      : {}),
  };
}

// ─── Words ──────────────────────────────────────────────────────────────────

export async function getAllWords(): Promise<Word[]> {
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("words")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getAllWords: ${error.message}`);
  return (data as SupabaseWordRow[]).map(toWord);
}

export async function getDueWords(now = Date.now()): Promise<Word[]> {
  const { familyId } = await getSessionMetadata();
  // Fetch words where next_review_at <= now OR next_review_at = 0
  const { data, error } = await supabase
    .from("words")
    .select("*")
    .eq("family_id", familyId)
    .or(`next_review_at.lte.${now},next_review_at.eq.0`);
  if (error) throw new Error(`getDueWords: ${error.message}`);

  return (data as SupabaseWordRow[])
    .map(toWord)
    .filter((w) => isDue(w.nextReviewAt, now));
}

export async function getExistingWordsByHanzi(hanziList: string[]): Promise<Word[]> {
  if (hanziList.length === 0) return [];
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("words")
    .select("*")
    .eq("family_id", familyId)
    .in("hanzi", hanziList);
  if (error) throw new Error(`getExistingWordsByHanzi: ${error.message}`);
  return (data as SupabaseWordRow[]).map(toWord);
}

export async function addWords(words: Word[]): Promise<void> {
  if (words.length === 0) return;
  const { familyId } = await getSessionMetadata();
  const rows = words.map((w) => fromWord(w, familyId));
  // ON CONFLICT DO NOTHING — skip duplicates by (family_id, hanzi)
  const { error } = await supabase.from("words").upsert(rows, {
    onConflict: "id",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(`addWords: ${error.message}`);
}

export async function deleteWord(id: string): Promise<void> {
  const { familyId } = await getSessionMetadata();
  const { error } = await supabase.from("words").delete().eq("id", id).eq("family_id", familyId);
  if (error) throw new Error(`deleteWord: ${error.message}`);
}

export async function putWord(word: Word): Promise<void> {
  const { familyId } = await getSessionMetadata();
  const row = fromWord(word, familyId);
  const { error } = await supabase.from("words").upsert(row);
  if (error) throw new Error(`putWord: ${error.message}`);
}

export async function gradeWord(
  id: string,
  gradeOrResult: Grade | GradeResult,
  now = Date.now()
): Promise<Word> {
  const grade =
    typeof gradeOrResult === "string" ? gradeOrResult : gradeOrResult.grade;
  const source =
    typeof gradeOrResult === "string" ? undefined : gradeOrResult.source;

  // Read current word
  const { data, error: readErr } = await supabase
    .from("words")
    .select("*")
    .eq("id", id)
    .single();
  if (readErr || !data) throw new Error(`gradeWord read: ${readErr?.message ?? "not found"}`);

  const word = toWord(data as SupabaseWordRow);
  const updated = calculateNextState(word, grade, now);
  updated.reviewCount = (word.reviewCount ?? 0) + 1;
  updated.testCount = (word.testCount ?? 0) + (source === "fillTest" ? 1 : 0);

  // Write back (update, not upsert — row is known to exist from the read above)
  const { familyId } = await getSessionMetadata();
  const row = fromWord(updated, familyId);
  const { error: writeErr } = await supabase.from("words").update(row).eq("id", id);
  if (writeErr) throw new Error(`gradeWord write: ${writeErr.message}`);
  return updated;
}

// ─── Internal: VocabPhrase row converters ───────────────────────────────────

interface SupabaseVocabPhraseRow {
  id: string;
  family_id: string;
  phrase: string;
  pinyin: string | null;
  meaning_zh: string | null;
  meaning_en: string | null;
  examples: unknown;
  test_count: number;
  created_at: string;
}

function normalizeVocabPhraseExamples(value: unknown): VocabPhraseExample[] {
  if (!Array.isArray(value)) return [];
  const result: VocabPhraseExample[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const source = item as Record<string, unknown>;
    const zh = typeof source.zh === "string" ? source.zh : "";
    if (!zh) continue;
    result.push({
      zh,
      pinyin: typeof source.pinyin === "string" ? source.pinyin : "",
      includeInFillTest: source.include_in_fill_test !== false,
    });
  }
  return result;
}

function fromVocabPhraseExamples(examples: VocabPhraseExample[]): unknown {
  return examples.map((example) => ({
    zh: example.zh,
    pinyin: example.pinyin,
    include_in_fill_test: example.includeInFillTest,
  }));
}

function toVocabPhrase(row: SupabaseVocabPhraseRow): VocabPhrase {
  return {
    id: row.id,
    phrase: row.phrase,
    pinyin: row.pinyin ?? undefined,
    meaningZh: row.meaning_zh ?? undefined,
    meaningEn: row.meaning_en ?? undefined,
    examples: normalizeVocabPhraseExamples(row.examples),
    testCount: row.test_count,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// ─── Vocab Phrases ───────────────────────────────────────────────────────────
//
// Standalone multi-character phrase entity, parallel to `words` but flat (no
// nested meanings) and packaged-only (no SRS scheduling — see
// docs/feature-specs/2026-07-26-phrase-keyed-input.md). "Grading" here only
// ever means bumping test_count bookkeeping; the SRS-adjacent familiarity
// nudge this feature applies to a phrase's own component *characters* lives
// in nudgeWordFamiliarity below and writes to `words`, not `vocab_phrases`.

export async function listVocabPhrases(): Promise<VocabPhrase[]> {
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("vocab_phrases")
    .select("*")
    .eq("family_id", familyId);
  if (error) throw new Error(`listVocabPhrases: ${error.message}`);
  return (data as SupabaseVocabPhraseRow[]).map(toVocabPhrase);
}

export async function getExistingVocabPhrasesByText(phrases: string[]): Promise<VocabPhrase[]> {
  if (phrases.length === 0) return [];
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("vocab_phrases")
    .select("*")
    .eq("family_id", familyId)
    .in("phrase", phrases);
  if (error) throw new Error(`getExistingVocabPhrasesByText: ${error.message}`);
  return (data as SupabaseVocabPhraseRow[]).map(toVocabPhrase);
}

/** Single-phrase create, used by Content Admin's inline "+ New Phrase" row. */
export async function addVocabPhrase(phrase: string): Promise<VocabPhrase> {
  const trimmed = phrase.trim();
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("vocab_phrases")
    .insert({ family_id: familyId, phrase: trimmed })
    .select("*")
    .single();
  if (error || !data) throw new Error(`addVocabPhrase: ${error?.message ?? "insert failed"}`);
  return toVocabPhrase(data as SupabaseVocabPhraseRow);
}

/**
 * Batch create, used by /words/add's comma-separated phrase entry. Skips
 * phrases already present for the family (ON CONFLICT DO NOTHING on
 * (family_id, phrase)) and returns only the newly-inserted rows — the
 * caller needs their ids to batch-assign tags to just the new phrases.
 */
export async function addVocabPhrases(phrases: string[]): Promise<VocabPhrase[]> {
  if (phrases.length === 0) return [];
  const { familyId } = await getSessionMetadata();
  const rows = phrases.map((phrase) => ({ family_id: familyId, phrase: phrase.trim() }));
  const { data, error } = await supabase
    .from("vocab_phrases")
    .upsert(rows, { onConflict: "family_id,phrase", ignoreDuplicates: true })
    .select("*");
  if (error) throw new Error(`addVocabPhrases: ${error.message}`);
  return ((data as SupabaseVocabPhraseRow[] | null) ?? []).map(toVocabPhrase);
}

export async function updateVocabPhrase(
  id: string,
  fields: Partial<Pick<VocabPhrase, "pinyin" | "meaningZh" | "meaningEn" | "examples">>
): Promise<void> {
  const row: Record<string, unknown> = {};
  if ("pinyin" in fields) row.pinyin = fields.pinyin ?? null;
  if ("meaningZh" in fields) row.meaning_zh = fields.meaningZh ?? null;
  if ("meaningEn" in fields) row.meaning_en = fields.meaningEn ?? null;
  if ("examples" in fields) row.examples = fromVocabPhraseExamples(fields.examples ?? []);
  if (Object.keys(row).length === 0) return;

  const { familyId } = await getSessionMetadata();
  const { error } = await supabase
    .from("vocab_phrases")
    .update(row)
    .eq("id", id)
    .eq("family_id", familyId);
  if (error) throw new Error(`updateVocabPhrase: ${error.message}`);
}

export async function deleteVocabPhrase(id: string): Promise<void> {
  const { familyId } = await getSessionMetadata();
  const { error } = await supabase
    .from("vocab_phrases")
    .delete()
    .eq("id", id)
    .eq("family_id", familyId);
  if (error) throw new Error(`deleteVocabPhrase: ${error.message}`);
}

/**
 * Bumps test_count only — vocab_phrases carries no SRS state, so unlike
 * gradeWord there is no calculateNextState call here regardless of whether
 * the fill-test answer was right or wrong (packaged-only, no auto SRS).
 */
export async function gradeVocabPhrase(id: string): Promise<VocabPhrase> {
  const { data, error: readErr } = await supabase
    .from("vocab_phrases")
    .select("*")
    .eq("id", id)
    .single();
  if (readErr || !data) throw new Error(`gradeVocabPhrase read: ${readErr?.message ?? "not found"}`);

  const phrase = toVocabPhrase(data as SupabaseVocabPhraseRow);
  const nextTestCount = phrase.testCount + 1;
  const { error: writeErr } = await supabase
    .from("vocab_phrases")
    .update({ test_count: nextTestCount })
    .eq("id", id);
  if (writeErr) throw new Error(`gradeVocabPhrase write: ${writeErr.message}`);
  return { ...phrase, testCount: nextTestCount };
}

/**
 * Correct-phrase-answer familiarity nudge for one of the phrase's own
 * component characters, if it already exists as a standalone `words` row.
 * Silently no-ops if the character was never added standalone — nothing to
 * nudge. Reuses the existing, unmodified calculateNextState with a
 * caller-supplied tier (defaults to "good" for the ordinary phrase-round
 * nudge, which never passes one — moderate strength, since recognizing a
 * character inside an already-familiar phrase is weaker evidence than a
 * direct cold-recall test of that character alone). The paragraph-quiz path
 * passes its own earned tier instead. Deliberately does not increment
 * testCount, which is reserved for direct standalone tests of the
 * character, not incidental exposure via a phrase.
 */
export async function nudgeWordFamiliarity(
  wordId: string,
  tier: Grade = "good",
  now = Date.now()
): Promise<void> {
  const { data, error: readErr } = await supabase
    .from("words")
    .select("*")
    .eq("id", wordId)
    .maybeSingle();
  if (readErr) throw new Error(`nudgeWordFamiliarity read: ${readErr.message}`);
  if (!data) return;

  const word = toWord(data as SupabaseWordRow);
  const updated = calculateNextState(word, tier, now);
  updated.reviewCount = (word.reviewCount ?? 0) + 1;
  updated.testCount = word.testCount ?? 0;

  const { familyId } = await getSessionMetadata();
  const row = fromWord(updated, familyId);
  const { error: writeErr } = await supabase.from("words").update(row).eq("id", wordId);
  if (writeErr) throw new Error(`nudgeWordFamiliarity write: ${writeErr.message}`);
}

// ─── Flashcard Contents ─────────────────────────────────────────────────────

function makeFlashcardContentKey(
  character: string,
  pronunciation: string
): string {
  return `${character}|${pronunciation}`;
}

export async function getFlashcardContent(
  character: string,
  pronunciation: string
): Promise<FlashcardContentEntry | undefined> {
  const key = makeFlashcardContentKey(character, pronunciation);
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("flashcard_contents")
    .select("*")
    .eq("id", key)
    .eq("family_id", familyId)
    .maybeSingle();
  if (error) throw new Error(`getFlashcardContent: ${error.message}`);
  if (!data) return undefined;
  return toFlashcardContentEntry(data);
}

export async function getAllFlashcardContents(): Promise<
  FlashcardContentEntry[]
> {
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("flashcard_contents")
    .select("*")
    .eq("family_id", familyId);
  if (error) throw new Error(`getAllFlashcardContents: ${error.message}`);
  return (data ?? []).map(toFlashcardContentEntry);
}

export async function putFlashcardContent(
  character: string,
  pronunciation: string,
  content: FlashcardLlmResponse
): Promise<void> {
  const key = makeFlashcardContentKey(character, pronunciation);
  const { familyId } = await getSessionMetadata();
  const { error } = await supabase.from("flashcard_contents").upsert({
    id: key,
    family_id: familyId,
    meanings: content.meanings,
    phrases: [],
    examples: [],
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`putFlashcardContent: ${error.message}`);
}

export async function deleteFlashcardContent(
  character: string,
  pronunciation: string
): Promise<void> {
  const key = makeFlashcardContentKey(character, pronunciation);
  const { familyId } = await getSessionMetadata();
  const { error } = await supabase
    .from("flashcard_contents")
    .delete()
    .eq("id", key)
    .eq("family_id", familyId);
  if (error) throw new Error(`deleteFlashcardContent: ${error.message}`);
}

/**
 * Returns true if any flashcard_contents rows exist for the given hanzi
 * (across all pronunciations) within the current family.
 */
export async function hasFlashcardContentForHanzi(hanzi: string): Promise<boolean> {
  const { familyId } = await getSessionMetadata();
  const { count, error } = await supabase
    .from("flashcard_contents")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId)
    .like("id", `${hanzi}|%`);
  if (error) throw new Error(`hasFlashcardContentForHanzi: ${error.message}`);
  return (count ?? 0) > 0;
}

/**
 * Deletes all flashcard_contents rows for the given hanzi (all pronunciations)
 * within the current family.
 */
export async function deleteFlashcardContentByHanzi(hanzi: string): Promise<void> {
  const { familyId } = await getSessionMetadata();
  const { error } = await supabase
    .from("flashcard_contents")
    .delete()
    .eq("family_id", familyId)
    .like("id", `${hanzi}|%`);
  if (error) throw new Error(`deleteFlashcardContentByHanzi: ${error.message}`);
}

interface SupabaseHiddenAdminTargetRow {
  character: string;
  pronunciation: string;
  created_at: string;
}

function toHiddenAdminTarget(row: SupabaseHiddenAdminTargetRow): HiddenAdminTarget {
  const character = row.character.trim();
  const pronunciation = row.pronunciation.trim();
  return {
    character,
    pronunciation,
    key: makeFlashcardContentKey(character, pronunciation),
  };
}

export async function listHiddenAdminTargets(): Promise<HiddenAdminTarget[]> {
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("hidden_admin_targets")
    .select("character, pronunciation, created_at")
    .eq("family_id", familyId)
    .order("character")
    .order("pronunciation");
  if (error) throw new Error(`listHiddenAdminTargets: ${error.message}`);
  return (data as SupabaseHiddenAdminTargetRow[]).map(toHiddenAdminTarget);
}

export async function deleteAdminTargetRow(
  character: string,
  pronunciation: string
): Promise<void> {
  const { familyId } = await getSessionMetadata();
  const trimmedCharacter = character.trim();
  const trimmedPronunciation = pronunciation.trim();
  const key = makeFlashcardContentKey(trimmedCharacter, trimmedPronunciation);

  const { error: hideError } = await supabase
    .from("hidden_admin_targets")
    .upsert(
      {
        family_id: familyId,
        character: trimmedCharacter,
        pronunciation: trimmedPronunciation,
      },
      { onConflict: "family_id,character,pronunciation", ignoreDuplicates: true }
    );
  if (hideError) throw new Error(`deleteAdminTargetRow hide: ${hideError.message}`);

  const { error: deleteError } = await supabase
    .from("flashcard_contents")
    .delete()
    .eq("id", key)
    .eq("family_id", familyId);
  if (deleteError) throw new Error(`deleteAdminTargetRow content: ${deleteError.message}`);
}

export async function restoreHiddenAdminTargetsForHanzi(hanziList: string[]): Promise<void> {
  const normalized = Array.from(new Set(hanziList.map((hanzi) => hanzi.trim()).filter(Boolean)));
  if (normalized.length === 0) {
    return;
  }

  const { familyId } = await getSessionMetadata();
  const { error } = await supabase
    .from("hidden_admin_targets")
    .delete()
    .eq("family_id", familyId)
    .in("character", normalized);
  if (error) throw new Error(`restoreHiddenAdminTargetsForHanzi: ${error.message}`);
}

export async function listReviewTestSessions(): Promise<ReviewTestSession[]> {
  const { familyId } = await getSessionMetadata();
  const { data: sessionRows, error: sessionError } = await supabase
    .from("review_test_sessions")
    .select(
      "id, name, created_at, created_by_user_id, completed_at, completed_by_user_id, paragraph_test_mode_id"
    )
    .eq("family_id", familyId)
    .is("completed_at", null)
    .order("created_at", { ascending: false });
  if (sessionError) throw new Error(`listReviewTestSessions: ${sessionError.message}`);

  const sessions = (sessionRows as SupabaseReviewTestSessionRow[]) ?? [];
  if (sessions.length === 0) {
    return [];
  }

  const sessionIds = sessions.map((row) => row.id);
  const { data: targetRows, error: targetError } = await supabase
    .from("review_test_session_targets")
    .select("session_id, character, pronunciation, display_order, vocab_phrase_id, paragraph_id, paragraph_span_id")
    .eq("family_id", familyId)
    .in("session_id", sessionIds)
    .order("display_order", { ascending: true });
  if (targetError) throw new Error(`listReviewTestSessions targets: ${targetError.message}`);

  const targetsBySessionId = new Map<string, ReviewTestSession["targets"]>();
  for (const targetRow of (targetRows as SupabaseReviewTestSessionTargetRow[]) ?? []) {
    const list = targetsBySessionId.get(targetRow.session_id) ?? [];
    list.push(toReviewTestSessionTarget(targetRow));
    targetsBySessionId.set(targetRow.session_id, list);
  }

  return sessions.map((session) =>
    toReviewTestSession(session, targetsBySessionId.get(session.id) ?? [])
  );
}

export async function createReviewTestSession(
  name: string,
  targets: ReviewTestSessionTargetDraft[],
  paragraphTestModeId?: string
): Promise<ReviewTestSession> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Session name is required.");
  }

  const normalizedTargets = normalizeReviewTestSessionDraftTargets(targets);

  if (normalizedTargets.length === 0) {
    throw new Error("Select at least one target for the session.");
  }

  const { familyId, userId } = await getSessionMetadata();
  const sessionId = `review-test-session-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  const { error: sessionError } = await supabase.from("review_test_sessions").insert({
    id: sessionId,
    family_id: familyId,
    name: trimmedName,
    created_by_user_id: userId,
    paragraph_test_mode_id: paragraphTestModeId ?? null,
  });
  if (sessionError) throw new Error(`createReviewTestSession session: ${sessionError.message}`);

  const targetRows = normalizedTargets.map((target, index) => ({
    session_id: sessionId,
    family_id: familyId,
    character: target.character,
    pronunciation: target.pronunciation,
    display_order: index,
    vocab_phrase_id: target.vocabPhraseId ?? null,
    paragraph_id: target.paragraphId ?? null,
    paragraph_span_id: target.paragraphSpanId ?? null,
  }));
  const { error: targetError } = await supabase
    .from("review_test_session_targets")
    .insert(targetRows);
  if (targetError) throw new Error(`createReviewTestSession targets: ${targetError.message}`);

  return {
    id: sessionId,
    name: trimmedName,
    createdAt: Date.now(),
    createdByUserId: userId,
    completedAt: null,
    completedByUserId: null,
    paragraphTestModeId: paragraphTestModeId ?? null,
    targets: normalizedTargets.map((target, index) => ({
      sessionId,
      character: target.character,
      pronunciation: target.pronunciation,
      key: target.key,
      displayOrder: index,
      ...(target.vocabPhraseId ? { vocabPhraseId: target.vocabPhraseId } : {}),
      ...(target.paragraphId ? { paragraphId: target.paragraphId } : {}),
      ...(target.paragraphSpanId ? { paragraphSpanId: target.paragraphSpanId } : {}),
    })),
  };
}

export async function appendTargetsToReviewTestSession(
  sessionId: string,
  targets: ReviewTestSessionTargetDraft[]
): Promise<number> {
  const normalizedTargets = normalizeReviewTestSessionDraftTargets(targets);
  if (normalizedTargets.length === 0) {
    throw new Error("Select at least one target for the session.");
  }

  const { familyId } = await getSessionMetadata();
  const { data: existingTargetRows, error: existingTargetsError } = await supabase
    .from("review_test_session_targets")
    .select("session_id, character, pronunciation, display_order, vocab_phrase_id, paragraph_id, paragraph_span_id")
    .eq("family_id", familyId)
    .eq("session_id", sessionId)
    .order("display_order", { ascending: true });
  if (existingTargetsError) {
    throw new Error(`appendTargetsToReviewTestSession existing targets: ${existingTargetsError.message}`);
  }

  const existingTargets = (existingTargetRows as SupabaseReviewTestSessionTargetRow[] | null)?.map(
    toReviewTestSessionTarget
  ) ?? [];
  const existingKeys = new Set(existingTargets.map((target) => target.key));
  const nextDisplayOrder =
    existingTargets.reduce((maxOrder, target) => Math.max(maxOrder, target.displayOrder), -1) + 1;
  const targetRows = normalizedTargets
    .filter((target) => !existingKeys.has(target.key))
    .map((target, index) => ({
      session_id: sessionId,
      family_id: familyId,
      character: target.character,
      pronunciation: target.pronunciation,
      display_order: nextDisplayOrder + index,
      vocab_phrase_id: target.vocabPhraseId ?? null,
      paragraph_id: target.paragraphId ?? null,
      paragraph_span_id: target.paragraphSpanId ?? null,
    }));

  if (targetRows.length === 0) {
    return 0;
  }

  const { error: targetError } = await supabase
    .from("review_test_session_targets")
    .insert(targetRows);
  if (targetError) {
    throw new Error(`appendTargetsToReviewTestSession insert: ${targetError.message}`);
  }

  return targetRows.length;
}

export async function deleteReviewTestSession(sessionId: string): Promise<void> {
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("review_test_sessions")
    .delete()
    .eq("family_id", familyId)
    .eq("id", sessionId)
    .is("completed_at", null)
    .select("id");
  if (error) {
    throw new Error(`deleteReviewTestSession: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error("Review test session not found.");
  }
}

export async function deleteReviewTestSessionTarget(
  sessionId: string,
  character: string,
  pronunciation: string
): Promise<{ sessionDeleted: boolean }> {
  const { familyId } = await getSessionMetadata();

  const { error: targetError } = await supabase
    .from("review_test_session_targets")
    .delete()
    .eq("family_id", familyId)
    .eq("session_id", sessionId)
    .eq("character", character)
    .eq("pronunciation", pronunciation);
  if (targetError) {
    throw new Error(`deleteReviewTestSessionTarget: ${targetError.message}`);
  }

  const { count, error: countError } = await supabase
    .from("review_test_session_targets")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId)
    .eq("session_id", sessionId);
  if (countError) {
    throw new Error(`deleteReviewTestSessionTarget count: ${countError.message}`);
  }

  if ((count ?? 0) === 0) {
    await deleteReviewTestSession(sessionId);
    return { sessionDeleted: true };
  }
  return { sessionDeleted: false };
}

export async function completeReviewTestSession(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc("complete_review_test_session", {
    p_session_id: sessionId,
  });
  if (error) throw new Error(`completeReviewTestSession: ${error.message}`);
}

// ─── Review Session Progress ───────────────────────────────────────────────

interface SupabaseReviewSessionProgressRow {
  id: string;
  user_id: string;
  client_session_key: string;
  source_type: ReviewSessionProgressSourceType;
  packaged_session_id: string | null;
  progress_data: unknown;
  started_at: string;
  last_saved_at: string;
}

function toReviewSessionProgress(
  row: SupabaseReviewSessionProgressRow
): ReviewSessionProgress {
  return {
    id: row.id,
    userId: row.user_id,
    clientSessionKey: row.client_session_key,
    sourceType: row.source_type,
    packagedSessionId: row.packaged_session_id,
    progressData: row.progress_data,
    startedAt: new Date(row.started_at).getTime(),
    lastSavedAt: new Date(row.last_saved_at).getTime(),
  };
}

export async function saveReviewSessionProgress(input: {
  clientSessionKey: string;
  sourceType: ReviewSessionProgressSourceType;
  packagedSessionId: string | null;
  progressData: unknown;
  startedAt?: number;
}): Promise<void> {
  const { familyId, userId } = await getSessionMetadata();
  const row: Record<string, unknown> = {
    user_id: userId,
    family_id: familyId,
    client_session_key: input.clientSessionKey,
    source_type: input.sourceType,
    packaged_session_id: input.packagedSessionId,
    progress_data: input.progressData,
    last_saved_at: new Date().toISOString(),
  };
  if (input.startedAt !== undefined) {
    row.started_at = new Date(input.startedAt).toISOString();
  }

  const { error } = await supabase
    .from("review_session_progress")
    .upsert(row, { onConflict: "user_id,client_session_key" });
  if (error) throw new Error(`saveReviewSessionProgress: ${error.message}`);
}

export async function loadReviewSessionProgress(
  clientSessionKey: string
): Promise<ReviewSessionProgress | null> {
  const { userId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("review_session_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("client_session_key", clientSessionKey)
    .maybeSingle();
  if (error) throw new Error(`loadReviewSessionProgress: ${error.message}`);
  if (!data) return null;
  return toReviewSessionProgress(data as SupabaseReviewSessionProgressRow);
}

export async function listReviewSessionProgress(
  sourceType?: ReviewSessionProgressSourceType
): Promise<ReviewSessionProgress[]> {
  // Intentionally scoped by family_id, not user_id: the SELECT RLS policy on
  // review_session_progress is family-scoped (not user-scoped), so parents can
  // see their children's paused sessions (read-only visibility per the spec).
  // This function returns whatever RLS allows for the current session; the UI
  // layer decides how to render own-vs-others' rows for parent vs child.
  const { familyId } = await getSessionMetadata();
  let query = supabase
    .from("review_session_progress")
    .select("*")
    .eq("family_id", familyId);
  if (sourceType) {
    query = query.eq("source_type", sourceType);
  }

  const { data, error } = await query.order("last_saved_at", { ascending: false });
  if (error) throw new Error(`listReviewSessionProgress: ${error.message}`);
  return ((data as SupabaseReviewSessionProgressRow[]) ?? []).map(toReviewSessionProgress);
}

export async function deleteReviewSessionProgress(clientSessionKey: string): Promise<void> {
  const { userId } = await getSessionMetadata();
  const { error } = await supabase
    .from("review_session_progress")
    .delete()
    .eq("user_id", userId)
    .eq("client_session_key", clientSessionKey);
  if (error) throw new Error(`deleteReviewSessionProgress: ${error.message}`);
}

// ─── Quiz Sessions ──────────────────────────────────────────────────────────

export async function getAllQuizSessions(targetUserId?: string): Promise<QuizSession[]> {
  const { familyId } = await getSessionMetadata();
  let query = supabase
    .from("quiz_sessions")
    .select("*")
    .eq("family_id", familyId);

  if (targetUserId) {
    query = query.eq("user_id", targetUserId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    console.error("getAllQuizSessions error:", error);
    return [];
  }
  return (data as SupabaseQuizSessionRow[]).map(toQuizSession);
}

export async function createQuizSession(session: QuizSession): Promise<void> {
  const { familyId, userId } = await getSessionMetadata();
  const { error } = await supabase.from("quiz_sessions").insert({
    id: session.id,
    user_id: userId,
    family_id: familyId,
    created_at: new Date(session.createdAt).toISOString(),
    session_type: session.sessionType,
    grade_data: session.gradeData,
    fully_correct_count: session.fullyCorrectCount,
    failed_count: session.failedCount,
    partially_correct_count: session.partiallyCorrectCount,
    total_grades: session.totalGrades,
    duration_seconds: session.durationSeconds,
    coins_earned: session.coinsEarned,
  });
  if (error) throw new Error(`createQuizSession: ${error.message}`);
}

export async function clearAllQuizSessions(targetUserId?: string): Promise<void> {
  const { familyId } = await getSessionMetadata();
  let query = supabase
    .from("quiz_sessions")
    .delete()
    .eq("family_id", familyId)
    .gte("id", "");

  if (targetUserId) {
    query = query.eq("user_id", targetUserId);
  }

  const { error } = await query;
  if (error) throw new Error(`clearAllQuizSessions: ${error.message}`);
}

// ─── Wallet ─────────────────────────────────────────────────────────────────

interface RecordQuizSessionRpcRow extends SupabaseWalletRow {
  family_id: string;
}

export async function getOrCreateWallet(targetUserId?: string): Promise<Wallet> {
  const { familyId, userId } = await getSessionMetadata();
  const walletUserId = targetUserId ?? userId;

  // Try to read existing wallet
  const { data, error: readErr } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", walletUserId)
    .maybeSingle();
  if (readErr) throw new Error(`getOrCreateWallet read: ${readErr.message}`);

  if (data) return toWallet(data);

  if (walletUserId !== userId) {
    return createZeroWallet(walletUserId);
  }

  // Create default wallet
  const now = new Date().toISOString();
  const { data: created, error: writeErr } = await supabase
    .from("wallets")
    .upsert({
      user_id: userId,
      family_id: familyId,
      total_coins: 0,
      last_updated_at: now,
      version: 1,
    })
    .select()
    .single();
  if (writeErr) throw new Error(`getOrCreateWallet write: ${writeErr.message}`);
  return toWallet(created);
}

export async function recordQuizSession(session: QuizSession): Promise<Wallet> {
  const { data, error } = await supabase.rpc("record_quiz_session", {
    p_id: session.id,
    p_created_at: new Date(session.createdAt).toISOString(),
    p_session_type: session.sessionType,
    p_grade_data: session.gradeData,
    p_fully_correct_count: session.fullyCorrectCount,
    p_failed_count: session.failedCount,
    p_partially_correct_count: session.partiallyCorrectCount,
    p_total_grades: session.totalGrades,
    p_duration_seconds: session.durationSeconds,
    p_coins_earned: session.coinsEarned,
  });
  if (error) throw new Error(`recordQuizSession: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("recordQuizSession: no wallet row returned");
  }

  return toWallet(row as RecordQuizSessionRpcRow);
}

export async function updateWallet(coinsEarned: number): Promise<Wallet> {
  const { familyId, userId } = await getSessionMetadata();

  // Read current wallet (or create)
  const { data: existing } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const now = new Date().toISOString();
  const currentCoins = existing?.total_coins ?? 0;

  const { data, error } = await supabase
    .from("wallets")
    .upsert({
      user_id: userId,
      family_id: familyId,
      total_coins: currentCoins + coinsEarned,
      last_updated_at: now,
      version: 1,
    })
    .select()
    .single();
  if (error) throw new Error(`updateWallet: ${error.message}`);
  return toWallet(data);
}

export async function listShopRecipes(): Promise<ShopRecipe[]> {
  const { data, error } = await supabase
    .from("shop_recipes")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw new Error(`listShopRecipes: ${error.message}`);
  return ((data ?? []) as SupabaseShopRecipeRow[]).map(toShopRecipe);
}

export async function listShopIngredientPrices(): Promise<ShopIngredientPrice[]> {
  const { data, error } = await supabase
    .from("shop_ingredient_prices")
    .select("*")
    .order("ingredient_key", { ascending: true });
  if (error) throw new Error(`listShopIngredientPrices: ${error.message}`);
  return ((data ?? []) as SupabaseShopIngredientPriceRow[]).map(toShopIngredientPrice);
}

export async function listShopRecipeUnlocks(targetUserId?: string): Promise<ShopRecipeUnlock[]> {
  const { familyId, userId } = await getSessionMetadata();
  const unlockUserId = targetUserId ?? userId;
  const { data, error } = await supabase
    .from("shop_recipe_unlocks")
    .select("*")
    .eq("family_id", familyId)
    .eq("user_id", unlockUserId);
  if (error) throw new Error(`listShopRecipeUnlocks: ${error.message}`);
  return ((data ?? []) as SupabaseShopRecipeUnlockRow[]).map(toShopRecipeUnlock);
}

export async function listShopTransactions(targetUserId?: string): Promise<ShopTransaction[]> {
  const { familyId, userId } = await getSessionMetadata();
  const transactionUserId = targetUserId ?? userId;
  const { data, error } = await supabase
    .from("shop_coin_transactions")
    .select("*")
    .eq("family_id", familyId)
    .eq("user_id", transactionUserId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listShopTransactions: ${error.message}`);
  return ((data ?? []) as SupabaseShopTransactionRow[]).map(toShopTransaction);
}

export async function unlockShopRecipe(recipeId: string): Promise<UnlockShopRecipeResult> {
  const { data, error } = await supabase.rpc("unlock_shop_recipe", {
    p_recipe_id: recipeId,
  });
  if (error) throw new Error(`unlockShopRecipe: ${error.message}`);
  return normalizeUnlockShopRecipeResult(data);
}

interface SupabaseRewardedIngredientRow {
  ingredient_key: string;
  label_i18n?: unknown;
  icon_path?: string | null;
}

function toRewardedIngredient(row: SupabaseRewardedIngredientRow): RewardedIngredient {
  return {
    ingredientKey: canonicalizeShopIngredientKey(row.ingredient_key),
    ...(typeof row.icon_path === "string"
      ? { iconPath: row.icon_path.trim() || null }
      : {}),
    ...(row.label_i18n && typeof row.label_i18n === "object"
      ? {
          labelI18n: {
            en:
              typeof (row.label_i18n as { en?: unknown }).en === "string"
                ? ((row.label_i18n as { en: string }).en ?? "").trim()
                : "",
            zh:
              typeof (row.label_i18n as { zh?: unknown }).zh === "string"
                ? ((row.label_i18n as { zh: string }).zh ?? "").trim()
                : "",
          },
        }
      : {}),
  };
}

/**
 * Rewards up to 3 (server-decided, see reward_random_ingredients) random,
 * distinct ingredients pooled across every recipe the caller has unlocked,
 * for finishing a paragraph-quiz session (paragraph-quiz-ingredient-reward,
 * 2026-08-22). Returns an empty array when nothing is unlocked, the pool is
 * empty, or this quiz_session_id was already rewarded -- never an error for
 * those cases. Callers must not treat an empty result as a failure.
 */
export async function rewardRandomIngredients(quizSessionId: string): Promise<RewardedIngredient[]> {
  const { data, error } = await supabase.rpc("reward_random_ingredients", {
    p_quiz_session_id: quizSessionId,
  });
  if (error) throw new Error(`rewardRandomIngredients: ${error.message}`);
  return ((data ?? []) as SupabaseRewardedIngredientRow[]).map(toRewardedIngredient);
}

// ─── Coin Redemptions ────────────────────────────────────────────────────────

interface SupabaseCoinRedemptionRow {
  id: string;
  user_id: string;
  family_id: string;
  coins_redeemed: number;
  dollar_value: number | string;
  note: string;
  child_signature: string;
  beginning_balance: number;
  ending_balance: number;
  created_at: string;
}

function toCoinRedemption(row: SupabaseCoinRedemptionRow): CoinRedemption {
  return {
    id: row.id,
    userId: row.user_id,
    coinsRedeemed: row.coins_redeemed,
    dollarValue:
      typeof row.dollar_value === "string"
        ? parseFloat(row.dollar_value)
        : row.dollar_value,
    note: row.note,
    childSignature: row.child_signature,
    beginningBalance: row.beginning_balance,
    endingBalance: row.ending_balance,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function redeemCoins(
  coins: number,
  note: string,
  signature: string
): Promise<RedeemCoinsResult> {
  const { data, error } = await supabase.rpc("redeem_coins", {
    p_coins: coins,
    p_note: note,
    p_signature: signature,
  });
  if (error) throw new Error(`redeemCoins: ${error.message}`);
  return normalizeRedeemCoinsResult(data);
}

export async function listCoinRedemptions(
  targetUserId?: string
): Promise<CoinRedemption[]> {
  const { familyId, userId } = await getSessionMetadata();
  const redemptionUserId = targetUserId ?? userId;
  const { data, error } = await supabase
    .from("coin_redemptions")
    .select("*")
    .eq("family_id", familyId)
    .eq("user_id", redemptionUserId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listCoinRedemptions: ${error.message}`);
  return ((data ?? []) as SupabaseCoinRedemptionRow[]).map(toCoinRedemption);
}

export async function getCoinBreakdown(
  targetUserId?: string
): Promise<CoinBreakdown> {
  const { familyId, userId } = await getSessionMetadata();
  const breakdownUserId = targetUserId ?? userId;

  const [sessionsResult, transactionsResult, redemptionsResult, walletResult] =
    await Promise.all([
      supabase
        .from("quiz_sessions")
        .select("coins_earned")
        .eq("family_id", familyId)
        .eq("user_id", breakdownUserId),
      supabase
        .from("shop_coin_transactions")
        .select("coins_spent")
        .eq("family_id", familyId)
        .eq("user_id", breakdownUserId),
      supabase
        .from("coin_redemptions")
        .select("coins_redeemed")
        .eq("family_id", familyId)
        .eq("user_id", breakdownUserId),
      supabase
        .from("wallets")
        .select("total_coins")
        .eq("user_id", breakdownUserId)
        .maybeSingle(),
    ]);

  if (sessionsResult.error)
    throw new Error(`getCoinBreakdown sessions: ${sessionsResult.error.message}`);
  if (transactionsResult.error)
    throw new Error(`getCoinBreakdown transactions: ${transactionsResult.error.message}`);
  if (redemptionsResult.error)
    throw new Error(`getCoinBreakdown redemptions: ${redemptionsResult.error.message}`);
  if (walletResult.error)
    throw new Error(`getCoinBreakdown wallet: ${walletResult.error.message}`);

  const totalEarned = (sessionsResult.data ?? []).reduce(
    (sum, row) => sum + ((row as { coins_earned: number }).coins_earned ?? 0),
    0
  );
  const spentOnRecipes = (transactionsResult.data ?? []).reduce(
    (sum, row) => sum + ((row as { coins_spent: number }).coins_spent ?? 0),
    0
  );
  const redeemed = (redemptionsResult.data ?? []).reduce(
    (sum, row) => sum + ((row as { coins_redeemed: number }).coins_redeemed ?? 0),
    0
  );
  const available =
    (walletResult.data as { total_coins: number } | null)?.total_coins ?? 0;

  return { totalEarned, spentOnRecipes, redeemed, available };
}

// ─── Prompt Templates ────────────────────────────────────────────────────────

export type PromptType = "full" | "phrase" | "example" | "phrase_details" | "meaning_details" | "vocab_phrase";

export type PromptTemplate = {
  id: string;
  familyId: string | null;
  userId: string | null;
  promptType: PromptType;
  slotName: string;
  promptBody: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
};

const MAX_PROMPT_SLOTS_PER_FAMILY_PER_TYPE = 5;

interface SupabasePromptTemplateRow {
  id: string;
  family_id: string | null;
  user_id: string | null;
  prompt_type: string;
  slot_name: string;
  prompt_body: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

function toPromptTemplate(row: SupabasePromptTemplateRow): PromptTemplate {
  return {
    id: row.id,
    familyId: row.family_id,
    userId: row.user_id,
    promptType: row.prompt_type as PromptType,
    slotName: row.slot_name,
    promptBody: row.prompt_body,
    isActive: row.is_active,
    isDefault: row.is_default,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

/**
 * Lists all prompt slots visible to the current user for a given prompt type.
 * Returns Default row first, then user-owned rows ordered by creation date.
 */
export async function listPromptSlots(promptType: PromptType): Promise<PromptTemplate[]> {
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("prompt_templates")
    .select("*")
    .eq("prompt_type", promptType)
    .or(`family_id.eq.${familyId},is_default.eq.true`)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listPromptSlots: ${error.message}`);
  return (data as SupabasePromptTemplateRow[]).map(toPromptTemplate);
}

/**
 * Creates a new user-owned prompt slot or updates an existing one.
 * Enforces the 5-slot maximum per family per prompt type on create.
 */
export async function upsertPromptSlot(
  slot: Pick<PromptTemplate, "promptType" | "slotName" | "promptBody"> & { id?: string }
): Promise<PromptTemplate> {
  const { familyId, userId } = await getSessionMetadata();

  if (!slot.id) {
    // Count existing user-owned slots before creating a new one
    const { count, error: countErr } = await supabase
      .from("prompt_templates")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId)
      .eq("prompt_type", slot.promptType)
      .eq("is_default", false);
    if (countErr) throw new Error(`upsertPromptSlot count: ${countErr.message}`);
    if ((count ?? 0) >= MAX_PROMPT_SLOTS_PER_FAMILY_PER_TYPE) {
      throw new Error(
        `Maximum of ${MAX_PROMPT_SLOTS_PER_FAMILY_PER_TYPE} slots per prompt type allowed.`
      );
    }
  }

  const now = new Date().toISOString();

  if (slot.id) {
    // Update: only allow updating own family's non-default slots
    const { data, error } = await supabase
      .from("prompt_templates")
      .update({
        slot_name: slot.slotName,
        prompt_body: slot.promptBody,
        updated_at: now,
      })
      .eq("id", slot.id)
      .eq("family_id", familyId)
      .eq("is_default", false)
      .select()
      .single();
    if (error) throw new Error(`upsertPromptSlot update: ${error.message}`);
    return toPromptTemplate(data as SupabasePromptTemplateRow);
  } else {
    const { data, error } = await supabase
      .from("prompt_templates")
      .insert({
        family_id: familyId,
        user_id: userId,
        prompt_type: slot.promptType,
        slot_name: slot.slotName,
        prompt_body: slot.promptBody,
        is_active: false,
        is_default: false,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (error) throw new Error(`upsertPromptSlot insert: ${error.message}`);
    return toPromptTemplate(data as SupabasePromptTemplateRow);
  }
}

/**
 * Updates the Default prompt slot body and name. Platform_admin only.
 * RLS enforces this — only platform_admin rows satisfy the policy for is_default rows.
 */
export async function updateDefaultPromptSlot(
  id: string,
  updates: Pick<PromptTemplate, "slotName" | "promptBody">
): Promise<PromptTemplate> {
  const { data, error } = await supabase
    .from("prompt_templates")
    .update({
      slot_name: updates.slotName,
      prompt_body: updates.promptBody,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("is_default", true)
    .select()
    .single();
  if (error) throw new Error(`updateDefaultPromptSlot: ${error.message}`);
  return toPromptTemplate(data as SupabasePromptTemplateRow);
}

/**
 * Deletes a user-owned prompt slot (never a Default row).
 * Safe to call on the active slot — the active slot's deletion causes
 * the system to fall back to the Default automatically (no is_active cleanup needed;
 * the API route simply finds no active slot and uses the Default).
 */
export async function deletePromptSlot(id: string): Promise<void> {
  const { familyId } = await getSessionMetadata();
  const { error } = await supabase
    .from("prompt_templates")
    .delete()
    .eq("id", id)
    .eq("family_id", familyId)
    .eq("is_default", false); // Prevent accidental Default deletion
  if (error) throw new Error(`deletePromptSlot: ${error.message}`);
}

/**
 * Sets a user-owned slot as the active prompt for its type within the current family.
 * Deactivates any previously active user-owned slot for the same prompt type first.
 * The Default slot does not need explicit activation — it is used when no user
 * slot is active.
 */
export async function setActivePromptSlot(id: string, promptType: PromptType): Promise<void> {
  const { familyId } = await getSessionMetadata();
  const now = new Date().toISOString();

  // Deactivate all user-owned slots for this family + type
  const { error: deactivateErr } = await supabase
    .from("prompt_templates")
    .update({ is_active: false, updated_at: now })
    .eq("family_id", familyId)
    .eq("prompt_type", promptType)
    .eq("is_default", false);
  if (deactivateErr) throw new Error(`setActivePromptSlot deactivate: ${deactivateErr.message}`);

  // Activate the target slot
  const { error: activateErr } = await supabase
    .from("prompt_templates")
    .update({ is_active: true, updated_at: now })
    .eq("id", id)
    .eq("family_id", familyId);
  if (activateErr) throw new Error(`setActivePromptSlot activate: ${activateErr.message}`);
}

/**
 * Returns the active prompt body for a given type and family (browser client).
 * Returns null if no active slot is found (caller uses its hardcoded fallback).
 */
export async function getActivePromptBody(promptType: PromptType): Promise<string | null> {
  const { familyId } = await getSessionMetadata();

  // Try family's active custom slot first
  const { data: customSlot, error: customErr } = await supabase
    .from("prompt_templates")
    .select("prompt_body")
    .eq("family_id", familyId)
    .eq("prompt_type", promptType)
    .eq("is_active", true)
    .eq("is_default", false)
    .maybeSingle();
  if (customErr) throw new Error(`getActivePromptBody custom: ${customErr.message}`);
  if (customSlot) return (customSlot as { prompt_body: string }).prompt_body;

  // Fall back to Default
  const { data: defaultSlot, error: defaultErr } = await supabase
    .from("prompt_templates")
    .select("prompt_body")
    .is("family_id", null)
    .eq("prompt_type", promptType)
    .eq("is_default", true)
    .maybeSingle();
  if (defaultErr) throw new Error(`getActivePromptBody default: ${defaultErr.message}`);
  if (defaultSlot) return (defaultSlot as { prompt_body: string }).prompt_body;

  return null;
}

// ─── Lesson Tagging ──────────────────────────────────────────────────────────

/** Normalise a free-text tag segment: trim, collapse interior whitespace. */
export function normalizeLessonTagField(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

interface SupabaseTextbookRow {
  id: string;
  name: string;
  is_shared: boolean;
  family_id: string | null;
  created_by: string | null;
  created_at: string;
}

function toTextbook(row: SupabaseTextbookRow): Textbook {
  return {
    id: row.id,
    name: row.name,
    isShared: row.is_shared,
    familyId: row.family_id,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).getTime(),
  };
}

interface SupabaseLessonTagRow {
  id: string;
  textbook_id: string;
  family_id: string;
  slot_1_value: string | null;
  slot_2_value: string | null;
  slot_3_value: string | null;
  created_at: string;
}

function toLessonTag(row: SupabaseLessonTagRow): LessonTag {
  return {
    id: row.id,
    textbookId: row.textbook_id,
    grade: row.slot_1_value ?? "",
    unit: row.slot_2_value ?? "",
    lesson: row.slot_3_value ?? "",
    createdAt: new Date(row.created_at).getTime(),
  };
}

/** Return textbooks created by the current family (excludes shared/admin-created ones). */
export async function listTextbooks(): Promise<Textbook[]> {
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("textbooks")
    .select("*")
    .eq("family_id", familyId)
    .order("name");
  if (error) throw new Error(`listTextbooks: ${error.message}`);
  return (data as SupabaseTextbookRow[]).map(toTextbook);
}

/**
 * Create a new private family-scoped textbook.
 * Returns the existing textbook if one with the same trimmed name already
 * belongs to this family (case-insensitive dedup).
 */
export async function createTextbook(name: string): Promise<Textbook> {
  const { familyId, authUserId } = await getSessionMetadata();
  const trimmedName = name.trim();

  // Check for existing family textbook with the same name (case-insensitive)
  const { data: existing, error: readErr } = await supabase
    .from("textbooks")
    .select("*")
    .eq("family_id", familyId)
    .ilike("name", trimmedName)
    .maybeSingle();
  if (readErr) throw new Error(`createTextbook read: ${readErr.message}`);
  if (existing) return toTextbook(existing as SupabaseTextbookRow);

  const { data: created, error: writeErr } = await supabase
    .from("textbooks")
    .insert({ name: trimmedName, is_shared: false, family_id: familyId, created_by: authUserId })
    .select("*")
    .single();
  if (writeErr) throw new Error(`createTextbook insert: ${writeErr.message}`);
  return toTextbook(created as SupabaseTextbookRow);
}

/**
 * List lesson tags for a textbook, optionally filtering by grade and unit.
 * Used to populate cascading dropdowns.
 */
export async function listLessonTags(
  textbookId: string,
  grade?: string,
  unit?: string
): Promise<LessonTag[]> {
  let query = supabase
    .from("lesson_tags")
    .select("*")
    .eq("textbook_id", textbookId)
    .order("slot_1_value")
    .order("slot_2_value")
    .order("slot_3_value");
  if (grade !== undefined) query = query.eq("slot_1_value", grade);
  if (unit !== undefined) query = query.eq("slot_2_value", unit);
  const { data, error } = await query;
  if (error) throw new Error(`listLessonTags: ${error.message}`);
  return (data as SupabaseLessonTagRow[]).map(toLessonTag);
}

/**
 * Find an existing lesson tag matching all four levels, or create a new one.
 * Uses the DB unique constraint (textbook_id, grade, unit, lesson) for safety.
 */
export async function createLessonTagIfNew(
  textbookId: string,
  grade: string,
  unit: string,
  lesson: string
): Promise<LessonTag> {
  const { familyId } = await getSessionMetadata();
  const normGrade = normalizeLessonTagField(grade);
  const normUnit = normalizeLessonTagField(unit);
  const normLesson = normalizeLessonTagField(lesson);

  // Check existing
  const { data: existing, error: readErr } = await supabase
    .from("lesson_tags")
    .select("*")
    .eq("textbook_id", textbookId)
    .eq("slot_1_value", normGrade)
    .eq("slot_2_value", normUnit)
    .eq("slot_3_value", normLesson)
    .maybeSingle();
  if (readErr) throw new Error(`createLessonTagIfNew read: ${readErr.message}`);
  if (existing) return toLessonTag(existing as SupabaseLessonTagRow);

  const { data: created, error: writeErr } = await supabase
    .from("lesson_tags")
    .insert({ textbook_id: textbookId, family_id: familyId, slot_1_value: normGrade, slot_2_value: normUnit, slot_3_value: normLesson })
    .select("*")
    .single();
  if (writeErr) throw new Error(`createLessonTagIfNew insert: ${writeErr.message}`);
  return toLessonTag(created as SupabaseLessonTagRow);
}

/**
 * Assign a lesson tag to a list of word IDs for the current family.
 * Skips duplicates via ON CONFLICT DO NOTHING.
 */
export async function assignWordLessonTags(
  wordIds: string[],
  lessonTagId: string
): Promise<void> {
  if (wordIds.length === 0) return;
  const { familyId } = await getSessionMetadata();
  const rows = wordIds.map((wordId) => ({
    word_id: wordId,
    lesson_tag_id: lessonTagId,
    family_id: familyId,
  }));
  const { error } = await supabase
    .from("word_lesson_tags")
    .upsert(rows, { onConflict: "word_id,lesson_tag_id,family_id", ignoreDuplicates: true });
  if (error) throw new Error(`assignWordLessonTags: ${error.message}`);
}

export async function assignVocabPhraseLessonTags(
  vocabPhraseIds: string[],
  lessonTagId: string
): Promise<void> {
  if (vocabPhraseIds.length === 0) return;
  const { familyId } = await getSessionMetadata();
  const rows = vocabPhraseIds.map((vocabPhraseId) => ({
    vocab_phrase_id: vocabPhraseId,
    lesson_tag_id: lessonTagId,
    family_id: familyId,
  }));
  const { error } = await supabase
    .from("vocab_phrase_lesson_tags")
    .upsert(rows, { onConflict: "vocab_phrase_id,lesson_tag_id,family_id", ignoreDuplicates: true });
  if (error) throw new Error(`assignVocabPhraseLessonTags: ${error.message}`);
}

/**
 * Remove all lesson tag associations for the given word IDs belonging to
 * the current family.  Leaves the lesson_tags and textbooks rows intact.
 */
export async function clearWordLessonTags(wordIds: string[]): Promise<void> {
  if (wordIds.length === 0) return;
  const { familyId } = await getSessionMetadata();
  const { error } = await supabase
    .from("word_lesson_tags")
    .delete()
    .in("word_id", wordIds)
    .eq("family_id", familyId);
  if (error) throw new Error(`clearWordLessonTags: ${error.message}`);
}

/**
 * Return a map of wordId → ResolvedLessonTag[] for all words belonging to
 * the current family.  Used to populate the Lessons column and filter bars.
 */
export async function getWordLessonTagsForFamily(): Promise<WordLessonTagsMap> {
  const { familyId } = await getSessionMetadata();

  const { data, error } = await supabase
    .from("word_lesson_tags")
    .select(
      `word_id,
       lesson_tags ( id, textbook_id, slot_1_value, slot_2_value, slot_3_value, family_id, created_at,
         textbooks ( id, name, is_shared, family_id, created_by, created_at )
       )`
    )
    .eq("family_id", familyId);
  if (error) throw new Error(`getWordLessonTagsForFamily: ${error.message}`);

  const map: WordLessonTagsMap = new Map();
  for (const row of (data ?? []) as unknown as Array<{
    word_id: string;
    lesson_tags: (SupabaseLessonTagRow & { textbooks: SupabaseTextbookRow }) | null;
  }>) {
    if (!row.lesson_tags) continue;
    const lt = row.lesson_tags;
    const tb = lt.textbooks;
    const resolved: ResolvedLessonTag = {
      lessonTagId: lt.id,
      textbookId: lt.textbook_id,
      textbookName: tb?.name ?? "",
      grade: lt.slot_1_value ?? "",
      unit: lt.slot_2_value ?? "",
      lesson: lt.slot_3_value ?? "",
    };
    const existing = map.get(row.word_id) ?? [];
    existing.push(resolved);
    map.set(row.word_id, existing);
  }
  return map;
}

/**
 * Return a map of vocabPhraseId → ResolvedLessonTag[] for all vocab phrases
 * belonging to the current family. Mirrors getWordLessonTagsForFamily; used
 * to populate the Phrases filter bar on Content Admin.
 */
export async function getVocabPhraseLessonTagsForFamily(): Promise<VocabPhraseLessonTagsMap> {
  const { familyId } = await getSessionMetadata();

  const { data, error } = await supabase
    .from("vocab_phrase_lesson_tags")
    .select(
      `vocab_phrase_id,
       lesson_tags ( id, textbook_id, slot_1_value, slot_2_value, slot_3_value, family_id, created_at,
         textbooks ( id, name, is_shared, family_id, created_by, created_at )
       )`
    )
    .eq("family_id", familyId);
  if (error) throw new Error(`getVocabPhraseLessonTagsForFamily: ${error.message}`);

  const map: VocabPhraseLessonTagsMap = new Map();
  for (const row of (data ?? []) as unknown as Array<{
    vocab_phrase_id: string;
    lesson_tags: (SupabaseLessonTagRow & { textbooks: SupabaseTextbookRow }) | null;
  }>) {
    if (!row.lesson_tags) continue;
    const lt = row.lesson_tags;
    const tb = lt.textbooks;
    const resolved: ResolvedLessonTag = {
      lessonTagId: lt.id,
      textbookId: lt.textbook_id,
      textbookName: tb?.name ?? "",
      grade: lt.slot_1_value ?? "",
      unit: lt.slot_2_value ?? "",
      lesson: lt.slot_3_value ?? "",
    };
    const existing = map.get(row.vocab_phrase_id) ?? [];
    existing.push(resolved);
    map.set(row.vocab_phrase_id, existing);
  }
  return map;
}

// ─── Internal: Paragraph row converters ─────────────────────────────────────

interface SupabaseParagraphRow {
  id: string;
  family_id: string;
  title: string | null;
  raw_text: string;
  sentences: unknown;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

function normalizeParagraphSpans(value: unknown): ParagraphSpan[] {
  if (!Array.isArray(value)) return [];
  const result: ParagraphSpan[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const source = item as Record<string, unknown>;
    const id = typeof source.id === "string" ? source.id : "";
    const text = typeof source.text === "string" ? source.text : "";
    const startOffset = typeof source.startOffset === "number" ? source.startOffset : NaN;
    const endOffset = typeof source.endOffset === "number" ? source.endOffset : NaN;
    const kind: "character" | "phrase" | null =
      source.kind === "character" || source.kind === "phrase" ? source.kind : null;
    if (!id || !text || !kind || !Number.isFinite(startOffset) || !Number.isFinite(endOffset)) {
      continue;
    }
    result.push({
      id,
      text,
      startOffset,
      endOffset,
      kind,
      resolvedWordId: typeof source.resolvedWordId === "string" ? source.resolvedWordId : undefined,
      resolvedVocabPhraseId:
        typeof source.resolvedVocabPhraseId === "string" ? source.resolvedVocabPhraseId : undefined,
      fillTestEligible: source.fillTestEligible === true,
    });
  }
  return result;
}

/** Defensive parse of the `sentences` jsonb column, mirrors normalizeVocabPhraseExamples. */
function normalizeParagraphSentences(value: unknown): ParagraphSentence[] {
  if (!Array.isArray(value)) return [];
  const result: ParagraphSentence[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const source = item as Record<string, unknown>;
    const text = typeof source.text === "string" ? source.text : "";
    const index = typeof source.index === "number" ? source.index : NaN;
    if (!text || !Number.isFinite(index)) continue;
    result.push({
      index,
      text,
      paragraphBreakBefore: source.paragraphBreakBefore === true,
      spans: normalizeParagraphSpans(source.spans),
    });
  }
  return result;
}

function fromParagraphSentences(sentences: ParagraphSentence[]): unknown {
  return sentences.map((sentence) => ({
    index: sentence.index,
    text: sentence.text,
    paragraphBreakBefore: sentence.paragraphBreakBefore,
    spans: sentence.spans.map((span) => ({
      id: span.id,
      text: span.text,
      startOffset: span.startOffset,
      endOffset: span.endOffset,
      kind: span.kind,
      resolvedWordId: span.resolvedWordId,
      resolvedVocabPhraseId: span.resolvedVocabPhraseId,
      fillTestEligible: span.fillTestEligible,
    })),
  }));
}

function toParagraph(row: SupabaseParagraphRow): Paragraph {
  return {
    id: row.id,
    familyId: row.family_id,
    title: row.title,
    rawText: row.raw_text,
    sentences: normalizeParagraphSentences(row.sentences),
    createdByUserId: row.created_by_user_id,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

// ─── Paragraphs ───────────────────────────────────────────────────────────────
//
// Raw pasted article text + parsed sentence/span structure (Tier 1, Item I,
// Phase 1 — Article Import). Write-only from the user's perspective in Phase
// 1 — no update path ships yet (see
// docs/feature-specs/2026-08-17-add-paragraph-article-import.md, Out of
// scope). createParagraph does not itself write words/vocab_phrases rows —
// the caller sequences addWords/addVocabPhrases and tag assignment BEFORE
// calling this, baking resolved ids into `sentences`.

export async function createParagraph(
  rawText: string,
  title: string | null,
  sentences: ParagraphSentence[]
): Promise<Paragraph> {
  const { familyId, userId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("paragraphs")
    .insert({
      family_id: familyId,
      title,
      raw_text: rawText,
      sentences: fromParagraphSentences(sentences),
      created_by_user_id: userId,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`createParagraph: ${error?.message ?? "insert failed"}`);
  return toParagraph(data as SupabaseParagraphRow);
}

/** Unused by Phase 1 UI — needed by Phase 2's paragraph library page. */
export async function listParagraphs(): Promise<Paragraph[]> {
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("paragraphs")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listParagraphs: ${error.message}`);
  return (data as SupabaseParagraphRow[]).map(toParagraph);
}

export async function getParagraph(id: string): Promise<Paragraph | null> {
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("paragraphs")
    .select("*")
    .eq("id", id)
    .eq("family_id", familyId)
    .maybeSingle();
  if (error) throw new Error(`getParagraph: ${error.message}`);
  return data ? toParagraph(data as SupabaseParagraphRow) : null;
}

export async function deleteParagraph(id: string): Promise<void> {
  const { familyId } = await getSessionMetadata();
  const { error } = await supabase.from("paragraphs").delete().eq("id", id).eq("family_id", familyId);
  if (error) throw new Error(`deleteParagraph: ${error.message}`);
}

/**
 * Continue Import's write path -- the first thing to ever update an
 * existing paragraph row. Only the provided fields are written; `sentences`
 * is expected to already be the FULL merged array (existing + newly
 * resolved spans), not a delta -- callers use the extended
 * mergeResolvedSpansIntoSentences (addParagraphIngestion.ts) to build it.
 */
export async function updateParagraph(
  id: string,
  fields: { title?: string | null; sentences?: ParagraphSentence[] }
): Promise<Paragraph> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("title" in fields) row.title = fields.title ?? null;
  if ("sentences" in fields) row.sentences = fromParagraphSentences(fields.sentences ?? []);

  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("paragraphs")
    .update(row)
    .eq("id", id)
    .eq("family_id", familyId)
    .select("*")
    .single();
  if (error || !data) throw new Error(`updateParagraph: ${error?.message ?? "update failed"}`);
  return toParagraph(data as SupabaseParagraphRow);
}

// ─── Internal: ParagraphTestMode row converters ─────────────────────────────

interface SupabaseParagraphTestModeRow {
  id: string;
  paragraph_id: string;
  family_id: string;
  name: string;
  span_ids: unknown;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

function normalizeSpanIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toParagraphTestMode(row: SupabaseParagraphTestModeRow): ParagraphTestMode {
  return {
    id: row.id,
    paragraphId: row.paragraph_id,
    name: row.name,
    spanIds: normalizeSpanIds(row.span_ids),
    createdByUserId: row.created_by_user_id,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

/**
 * Thrown by createParagraphTestMode/updateParagraphTestMode when the
 * (paragraph_id, name) unique constraint is violated (Postgres code 23505)
 * -- a distinguishable message body (no colon-prefixed function name) so UI
 * callers can match on it directly to show an inline "name already used for
 * this paragraph" field error, distinct from any other insert/update failure.
 */
export const PARAGRAPH_TEST_MODE_NAME_TAKEN = "paragraph_test_mode_name_taken";

// ─── Paragraph Test Modes ────────────────────────────────────────────────────
//
// Named, reusable blank-selection templates per paragraph (Tier 1, Item I,
// Phase 2). Purely a saved selection of which already-eligible paragraph
// spans should become fill-test blanks -- creates nothing runnable on its
// own (no review_test_sessions row). Name uniqueness is scoped to
// (paragraph_id, name), not family-wide, unlike every other named/unique
// thing in this app.

/**
 * All of the family's test modes across every paragraph, for the library
 * list's per-paragraph test-mode count column -- one bulk query rather than
 * one listParagraphTestModes call per paragraph row.
 */
export async function listAllParagraphTestModes(): Promise<ParagraphTestMode[]> {
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase.from("paragraph_test_modes").select("*").eq("family_id", familyId);
  if (error) throw new Error(`listAllParagraphTestModes: ${error.message}`);
  return (data as SupabaseParagraphTestModeRow[]).map(toParagraphTestMode);
}

export async function listParagraphTestModes(paragraphId: string): Promise<ParagraphTestMode[]> {
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("paragraph_test_modes")
    .select("*")
    .eq("family_id", familyId)
    .eq("paragraph_id", paragraphId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listParagraphTestModes: ${error.message}`);
  return (data as SupabaseParagraphTestModeRow[]).map(toParagraphTestMode);
}

export async function createParagraphTestMode(
  paragraphId: string,
  name: string,
  spanIds: string[]
): Promise<ParagraphTestMode> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Test mode name is required.");
  if (spanIds.length === 0) throw new Error("Select at least one span for the test mode.");

  const { familyId, userId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("paragraph_test_modes")
    .insert({
      paragraph_id: paragraphId,
      family_id: familyId,
      name: trimmedName,
      span_ids: spanIds,
      created_by_user_id: userId,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error(PARAGRAPH_TEST_MODE_NAME_TAKEN);
    throw new Error(`createParagraphTestMode: ${error.message}`);
  }
  if (!data) throw new Error("createParagraphTestMode: insert failed");
  return toParagraphTestMode(data as SupabaseParagraphTestModeRow);
}

export async function updateParagraphTestMode(
  id: string,
  fields: { name?: string; spanIds?: string[] }
): Promise<ParagraphTestMode> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("name" in fields) {
    const trimmedName = fields.name?.trim() ?? "";
    if (!trimmedName) throw new Error("Test mode name is required.");
    row.name = trimmedName;
  }
  if ("spanIds" in fields) {
    if ((fields.spanIds ?? []).length === 0) {
      throw new Error("Select at least one span for the test mode.");
    }
    row.span_ids = fields.spanIds;
  }

  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("paragraph_test_modes")
    .update(row)
    .eq("id", id)
    .eq("family_id", familyId)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error(PARAGRAPH_TEST_MODE_NAME_TAKEN);
    throw new Error(`updateParagraphTestMode: ${error.message}`);
  }
  if (!data) throw new Error("updateParagraphTestMode: update failed");
  return toParagraphTestMode(data as SupabaseParagraphTestModeRow);
}

export async function deleteParagraphTestMode(id: string): Promise<void> {
  const { familyId } = await getSessionMetadata();
  const { error } = await supabase
    .from("paragraph_test_modes")
    .delete()
    .eq("id", id)
    .eq("family_id", familyId);
  if (error) throw new Error(`deleteParagraphTestMode: ${error.message}`);
}

// ─── Active packaged-session guards (paragraph-quiz Phase 3) ───────────────

/**
 * True while any test mode belonging to this paragraph has an active
 * (completed_at is null) packaged session. Gates Delete Paragraph -- callers
 * must check this BEFORE calling deleteParagraph, which itself performs no
 * such check (paragraph_test_modes cascades to review_test_sessions on
 * delete, so an unguarded delete would silently destroy an in-progress
 * child's session).
 */
export async function hasActiveParagraphQuizSession(paragraphId: string): Promise<boolean> {
  const { familyId } = await getSessionMetadata();
  const { count, error } = await supabase
    .from("review_test_sessions")
    .select("id, paragraph_test_modes!inner(paragraph_id)", { count: "exact", head: true })
    .eq("family_id", familyId)
    .eq("paragraph_test_modes.paragraph_id", paragraphId)
    .is("completed_at", null);
  if (error) throw new Error(`hasActiveParagraphQuizSession: ${error.message}`);
  return (count ?? 0) > 0;
}

/**
 * True only while THIS SPECIFIC test mode has an active packaged session --
 * narrower than hasActiveParagraphQuizSession above (a sibling test mode on
 * the same paragraph with no active session of its own does not block this
 * one). Gates Delete Test Mode.
 */
export async function hasActiveTestModeQuizSession(testModeId: string): Promise<boolean> {
  const { familyId } = await getSessionMetadata();
  const { count, error } = await supabase
    .from("review_test_sessions")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId)
    .eq("paragraph_test_mode_id", testModeId)
    .is("completed_at", null);
  if (error) throw new Error(`hasActiveTestModeQuizSession: ${error.message}`);
  return (count ?? 0) > 0;
}

/**
 * Resolves every target referenced by any active (completed_at is null)
 * packaged session in the family -- character, phrase, mixed, and
 * paragraph-quiz sessions alike, since paragraph-quiz targets are ordinary
 * rows in the same review_test_session_targets table. Gates /words/all's
 * Delete actions (Characters and Phrases views): a character whose hanzi is
 * in hanziSet, or a phrase whose id is in vocabPhraseIdSet, must not be
 * deleted while referenced by an in-progress child session.
 */
export async function getActiveSessionTargetKeys(): Promise<{
  hanziSet: Set<string>;
  vocabPhraseIdSet: Set<string>;
}> {
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("review_test_session_targets")
    .select("character, vocab_phrase_id, review_test_sessions!inner(completed_at)")
    .eq("family_id", familyId)
    .is("review_test_sessions.completed_at", null);
  if (error) throw new Error(`getActiveSessionTargetKeys: ${error.message}`);

  const hanziSet = new Set<string>();
  const vocabPhraseIdSet = new Set<string>();
  for (const row of (data as { character: string; vocab_phrase_id: string | null }[] | null) ?? []) {
    if (row.vocab_phrase_id) {
      vocabPhraseIdSet.add(row.vocab_phrase_id);
    } else {
      hanziSet.add(row.character);
    }
  }
  return { hanziSet, vocabPhraseIdSet };
}
