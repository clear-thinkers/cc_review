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
import type {
  Textbook,
  LessonTag,
  WordLessonTagsMap,
  ResolvedLessonTag,
} from "@/app/words/shared/tagging.types";
import type { HiddenAdminTarget } from "@/app/words/admin/admin.types";
import type {
  ReviewTestSession,
  ReviewTestSessionTargetDraft,
} from "@/app/words/review/review.types";

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
  const meta = session.user.app_metadata;
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
}

interface SupabaseReviewTestSessionTargetRow {
  session_id: string;
  character: string;
  pronunciation: string;
  display_order: number;
}

function normalizeReviewTestSessionDraftTargets(
  targets: ReviewTestSessionTargetDraft[]
): ReviewTestSessionTargetDraft[] {
  const seenKeys = new Set<string>();
  const normalized: ReviewTestSessionTargetDraft[] = [];

  for (const target of targets) {
    const character = target.character.trim();
    const pronunciation = target.pronunciation.trim();
    const key = `${character}|${pronunciation}`;
    if (!character || !pronunciation || seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    normalized.push({
      character,
      pronunciation,
      key,
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
    key: `${character}|${pronunciation}`,
    displayOrder: row.display_order,
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
    .select("id, name, created_at, created_by_user_id, completed_at, completed_by_user_id")
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
    .select("session_id, character, pronunciation, display_order")
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
  targets: ReviewTestSessionTargetDraft[]
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
  });
  if (sessionError) throw new Error(`createReviewTestSession session: ${sessionError.message}`);

  const targetRows = normalizedTargets.map((target, index) => ({
    session_id: sessionId,
    family_id: familyId,
    character: target.character,
    pronunciation: target.pronunciation,
    display_order: index,
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
    targets: normalizedTargets.map((target, index) => ({
      sessionId,
      character: target.character,
      pronunciation: target.pronunciation,
      key: target.key,
      displayOrder: index,
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
    .select("session_id, character, pronunciation, display_order")
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

export async function completeReviewTestSession(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc("complete_review_test_session", {
    p_session_id: sessionId,
  });
  if (error) throw new Error(`completeReviewTestSession: ${error.message}`);
}

// ─── Quiz Sessions ──────────────────────────────────────────────────────────

export async function getAllQuizSessions(): Promise<QuizSession[]> {
  const { familyId } = await getSessionMetadata();
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("*")
    .eq("family_id", familyId)
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
  const { familyId } = await getSessionMetadata();
  const { error } = await supabase
    .from("quiz_sessions")
    .delete()
    .eq("family_id", familyId)
    .gte("id", "");
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

// ─── Prompt Templates ────────────────────────────────────────────────────────

export type PromptType = "full" | "phrase" | "example" | "phrase_details" | "meaning_details";

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
