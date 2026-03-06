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
import type { Word } from "./types";
import type { FlashcardLlmResponse } from "./flashcardLlm";
import type { QuizSession } from "@/app/words/results/results.types";
import type { Wallet } from "@/app/words/shared/coins.types";
import { calculateNextState, isDue } from "./scheduler";
import type { Grade } from "./scheduler";
import type { GradeResult } from "./review";

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
}

async function getSessionMetadata(): Promise<SessionMetadata> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("No active Supabase session");
  const meta = session.user.app_metadata;
  if (!meta?.family_id || !meta?.user_id) {
    throw new Error("JWT missing family_id or user_id in app_metadata");
  }
  return { familyId: meta.family_id as string, userId: meta.user_id as string };
}

// ─── Internal: Word row converters ──────────────────────────────────────────

interface SupabaseWordRow {
  id: string;
  family_id: string;
  hanzi: string;
  pinyin: string | null;
  meaning: string | null;
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
    pinyin: row.pinyin ?? undefined,
    meaning: row.meaning ?? undefined,
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
    pinyin: word.pinyin ?? null,
    meaning: word.meaning ?? null,
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

// ─── Internal: Wallet row converters ────────────────────────────────────────

function toWallet(row: {
  user_id: string;
  total_coins: number;
  last_updated_at: string;
  version: number;
}): Wallet {
  return {
    userId: row.user_id,
    totalCoins: row.total_coins,
    lastUpdatedAt: new Date(row.last_updated_at).getTime(),
    version: row.version,
  };
}

// ─── Words ──────────────────────────────────────────────────────────────────

export async function getAllWords(): Promise<Word[]> {
  const { data, error } = await supabase
    .from("words")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getAllWords: ${error.message}`);
  return (data as SupabaseWordRow[]).map(toWord);
}

export async function getDueWords(now = Date.now()): Promise<Word[]> {
  // Fetch words where next_review_at <= now OR next_review_at = 0
  const { data, error } = await supabase
    .from("words")
    .select("*")
    .or(`next_review_at.lte.${now},next_review_at.eq.0`);
  if (error) throw new Error(`getDueWords: ${error.message}`);

  return (data as SupabaseWordRow[])
    .map(toWord)
    .filter((w) => isDue(w.nextReviewAt, now));
}

export async function getExistingWordsByHanzi(hanziList: string[]): Promise<Word[]> {
  if (hanziList.length === 0) return [];
  const { data, error } = await supabase
    .from("words")
    .select("*")
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
  const { error } = await supabase.from("words").delete().eq("id", id);
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
  const { data, error } = await supabase
    .from("flashcard_contents")
    .select("*")
    .eq("id", key)
    .maybeSingle();
  if (error) throw new Error(`getFlashcardContent: ${error.message}`);
  if (!data) return undefined;
  return toFlashcardContentEntry(data);
}

export async function getAllFlashcardContents(): Promise<
  FlashcardContentEntry[]
> {
  const { data, error } = await supabase
    .from("flashcard_contents")
    .select("*");
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
  const { error } = await supabase
    .from("flashcard_contents")
    .delete()
    .eq("id", key);
  if (error) throw new Error(`deleteFlashcardContent: ${error.message}`);
}

// ─── Quiz Sessions ──────────────────────────────────────────────────────────

export async function getAllQuizSessions(): Promise<QuizSession[]> {
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("*")
    .order("created_at", { ascending: false });
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

export async function clearAllQuizSessions(): Promise<void> {
  // RLS scopes the delete to the current family
  const { error } = await supabase.from("quiz_sessions").delete().gte("id", "");
  if (error) throw new Error(`clearAllQuizSessions: ${error.message}`);
}

// ─── Wallet ─────────────────────────────────────────────────────────────────

export async function getOrCreateWallet(): Promise<Wallet> {
  const { familyId, userId } = await getSessionMetadata();

  // Try to read existing wallet
  const { data, error: readErr } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) throw new Error(`getOrCreateWallet read: ${readErr.message}`);

  if (data) return toWallet(data);

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
