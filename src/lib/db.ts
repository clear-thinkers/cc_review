import Dexie, { Table } from "dexie";
import type { Word } from "./types";
import type { FillTest } from "./fillTest";
import type { FlashcardLlmResponse } from "./flashcardLlm";
import type { QuizSession } from "@/app/words/results/results.types";
import type { Wallet } from "@/app/words/shared/coins.types";
import { calculateNextState, isDue } from "./scheduler";
import type { Grade } from "./scheduler";
import type { GradeResult } from "./review";
import { getPinScopedDatabaseName, setMigrationCompleted } from "./auth";

export type FillTestOverride = {
  hanzi: string;
  fillTest: FillTest;
  updatedAt: number;
};

export type DisabledFillTestEntry = {
  hanzi: string;
  updatedAt: number;
};

export type FlashcardContentEntry = {
  key: string;
  character: string;
  pronunciation: string;
  content: FlashcardLlmResponse;
  updatedAt: number;
};

export class AppDB extends Dexie {
  words!: Table<Word, string>;
  fillTests!: Table<FillTestOverride, string>;
  disabledFillTests!: Table<DisabledFillTestEntry, string>;
  flashcardContents!: Table<FlashcardContentEntry, string>;
  quizSessions!: Table<QuizSession, string>;
  wallets!: Table<Wallet, string>;

  constructor(databaseName: string = "cc_review_db") {
    super(databaseName);
    this.version(1).stores({
      words: "id, hanzi, nextReviewAt, createdAt",
    });
    this.version(2).stores({
      words: "id, hanzi, nextReviewAt, createdAt",
      fillTests: "hanzi, updatedAt",
    });
    this.version(3).stores({
      words: "id, hanzi, nextReviewAt, createdAt",
      fillTests: "hanzi, updatedAt",
      disabledFillTests: "hanzi, updatedAt",
    });
    this.version(4).stores({
      words: "id, hanzi, nextReviewAt, createdAt",
      fillTests: "hanzi, updatedAt",
      disabledFillTests: "hanzi, updatedAt",
      flashcardContents: "key, character, pronunciation, updatedAt",
    });
    this.version(5).stores({
      words: "id, hanzi, nextReviewAt, createdAt",
      fillTests: "hanzi, updatedAt",
      disabledFillTests: "hanzi, updatedAt",
      flashcardContents: "key, character, pronunciation, updatedAt",
      quizSessions: "id, createdAt",
    });
    this.version(6).stores({
      words: "id, hanzi, nextReviewAt, createdAt",
      fillTests: "hanzi, updatedAt",
      disabledFillTests: "hanzi, updatedAt",
      flashcardContents: "key, character, pronunciation, updatedAt",
      quizSessions: "id, createdAt",
      wallets: "id",
    });
  }
}

/**
 * Current database instance, scoped to the logged-in user's PIN.
 * Initialized with the PIN hash to ensure data isolation.
 * IMPORTANT: Do NOT auto-initialize. Only set via initializeDatabaseForPin().
 */
let currentDb: AppDB | null = null;
let currentPinHash: string | null = null;

/**
 * Get the current database (scoped to current PIN)
 * @returns AppDB instance for the current user
 * @throws Error if database has not been initialized (user not logged in)
 */
export function getDb(): AppDB {
  if (!currentDb) {
    throw new Error('Database not initialized. User must log in first.');
  }
  return currentDb;
}

/**
 * Initialize database for a specific PIN (called on successful login)
 * Skips reinitialization if the same PIN is already initialized.
 * @param pinHash - PIN hash from localStorage
 * @param shouldMigrate - Whether to migrate data from legacy database
 */
export async function initializeDatabaseForPin(pinHash: string, shouldMigrate: boolean = false): Promise<void> {
  // Skip if already initialized for this PIN
  if (currentPinHash === pinHash && currentDb) {
    console.log('Database already initialized for this PIN, skipping reinitialization');
    return;
  }

  // Close previous database if it exists
  if (currentDb) {
    await currentDb.close();
  }
  
  // Create new database with PIN-scoped name
  const databaseName = getPinScopedDatabaseName(pinHash);
  currentDb = new AppDB(databaseName);
  currentPinHash = pinHash;

  // Migrate data from legacy database if requested
  if (shouldMigrate) {
    await migrateFromLegacyDatabase(currentDb);
  }
}

/**
 * Clear the current database state (called on logout)
 * Closes the database and resets the PIN reference
 */
export async function clearDatabaseState(): Promise<void> {
  if (currentDb) {
    try {
      await currentDb.close();
    } catch (error) {
      console.error('Error closing database during logout:', error);
    }
  }
  currentDb = null;
  currentPinHash = null;
}

/**
 * Open the legacy (unscoped) database
 * @returns AppDB instance for the legacy database
 */
async function openLegacyDatabase(): Promise<AppDB> {
  return new AppDB("cc_review_db");
}

/**
 * Migrate all data from the legacy database to the current scoped database
 * @param newDb - The target PIN-scoped database
 */
export async function migrateFromLegacyDatabase(newDb: AppDB): Promise<void> {
  try {
    const legacyDb = await openLegacyDatabase();
    
    // Check if legacy database has any data
    const legacyWordsCount = await legacyDb.words.count();
    const legacySessionsCount = await legacyDb.quizSessions.count();
    const legacyContentCount = await legacyDb.flashcardContents.count();
    const legacyWalletCount = await legacyDb.wallets.count();
    
    const hasAnyData = legacyWordsCount > 0 || legacySessionsCount > 0 || legacyContentCount > 0 || legacyWalletCount > 0;
    
    if (!hasAnyData) {
      console.log('Legacy database is empty, skipping migration');
      await legacyDb.close();
      return;
    }

    console.log(`Migrating data from legacy database: ${legacyWordsCount} words, ${legacySessionsCount} sessions, ${legacyContentCount} contents, ${legacyWalletCount} wallets`);

    // Migrate words
    if (legacyWordsCount > 0) {
      const words = await legacyDb.words.toArray();
      await newDb.words.bulkPut(words);
      console.log(`✓ Migrated ${words.length} words`);
    }

    // Migrate fillTests
    const fillTests = await legacyDb.fillTests.toArray();
    if (fillTests.length > 0) {
      await newDb.fillTests.bulkPut(fillTests);
      console.log(`✓ Migrated ${fillTests.length} fill test overrides`);
    }

    // Migrate disabledFillTests
    const disabledFillTests = await legacyDb.disabledFillTests.toArray();
    if (disabledFillTests.length > 0) {
      await newDb.disabledFillTests.bulkPut(disabledFillTests);
      console.log(`✓ Migrated ${disabledFillTests.length} disabled fill tests`);
    }

    // Migrate flashcardContents
    if (legacyContentCount > 0) {
      const contents = await legacyDb.flashcardContents.toArray();
      await newDb.flashcardContents.bulkPut(contents);
      console.log(`✓ Migrated ${contents.length} flashcard contents`);
    }

    // Migrate quiz sessions
    if (legacySessionsCount > 0) {
      const sessions = await legacyDb.quizSessions.toArray();
      await newDb.quizSessions.bulkPut(sessions);
      console.log(`✓ Migrated ${sessions.length} quiz sessions`);
    }

    // Migrate wallet
    if (legacyWalletCount > 0) {
      const wallets = await legacyDb.wallets.toArray();
      await newDb.wallets.bulkPut(wallets);
      console.log(`✓ Migrated wallet data`);
    }

    console.log('✓ Migration complete! All data moved to PIN-scoped database');
    setMigrationCompleted(); // Mark that migration has happened (only migrate once)
    await legacyDb.close();
  } catch (error) {
    console.error('Migration error:', error);
    throw new Error(`Failed to migrate data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Lazy proxy for backward compatibility
 * Returns the current database instance
 */
export const db = new Proxy({} as AppDB, {
  get(target, prop) {
    return (getDb() as any)[prop];
  },
});

export async function getDueWords(now = Date.now()): Promise<Word[]> {
  const indexedDue = await db.words.where("nextReviewAt").belowOrEqual(now).toArray();
  const maybeMissing = await db.words.filter((word) => !word.nextReviewAt).toArray();

  const byId = new Map<string, Word>();
  for (const word of indexedDue) {
    byId.set(word.id, word);
  }

  for (const word of maybeMissing) {
    if (isDue(word.nextReviewAt, now)) {
      byId.set(word.id, word);
    }
  }

  return Array.from(byId.values());
}

export async function gradeWord(
  id: string,
  gradeOrResult: Grade | GradeResult,
  now = Date.now()
): Promise<Word> {
  const grade = typeof gradeOrResult === "string" ? gradeOrResult : gradeOrResult.grade;
  const source = typeof gradeOrResult === "string" ? undefined : gradeOrResult.source;

  return db.transaction("rw", db.words, async () => {
    const word = await db.words.get(id);
    if (!word) {
      throw new Error(`Word not found: ${id}`);
    }

    const updated = calculateNextState(word, grade, now);
    updated.reviewCount = (word.reviewCount ?? 0) + 1;
    updated.testCount = (word.testCount ?? 0) + (source === "fillTest" ? 1 : 0);
    await db.words.put(updated);
    return updated;
  });
}

export async function getCustomFillTest(hanzi: string): Promise<FillTest | undefined> {
  const entry = await db.fillTests.get(hanzi);
  return entry?.fillTest;
}

export async function getAllCustomFillTests(): Promise<FillTestOverride[]> {
  return db.fillTests.toArray();
}

export async function putCustomFillTest(hanzi: string, fillTest: FillTest): Promise<void> {
  await db.fillTests.put({
    hanzi,
    fillTest,
    updatedAt: Date.now(),
  });
}

export async function deleteCustomFillTest(hanzi: string): Promise<void> {
  await db.fillTests.delete(hanzi);
}

export async function getAllDisabledFillTests(): Promise<DisabledFillTestEntry[]> {
  return db.disabledFillTests.toArray();
}

export async function putDisabledFillTest(hanzi: string): Promise<void> {
  await db.disabledFillTests.put({
    hanzi,
    updatedAt: Date.now(),
  });
}

export async function deleteDisabledFillTest(hanzi: string): Promise<void> {
  await db.disabledFillTests.delete(hanzi);
}

function makeFlashcardContentKey(character: string, pronunciation: string): string {
  return `${character}|${pronunciation}`;
}

export async function getFlashcardContent(
  character: string,
  pronunciation: string
): Promise<FlashcardContentEntry | undefined> {
  return db.flashcardContents.get(makeFlashcardContentKey(character, pronunciation));
}

export async function getFlashcardContentsByCharacter(character: string): Promise<FlashcardContentEntry[]> {
  return db.flashcardContents.where("character").equals(character).toArray();
}

export async function getAllFlashcardContents(): Promise<FlashcardContentEntry[]> {
  return db.flashcardContents.toArray();
}

export async function putFlashcardContent(
  character: string,
  pronunciation: string,
  content: FlashcardLlmResponse
): Promise<void> {
  await db.flashcardContents.put({
    key: makeFlashcardContentKey(character, pronunciation),
    character,
    pronunciation,
    content,
    updatedAt: Date.now(),
  });
}

export async function deleteFlashcardContent(character: string, pronunciation: string): Promise<void> {
  await db.flashcardContents.delete(makeFlashcardContentKey(character, pronunciation));
}

export async function putFlashcardContents(entries: Array<Omit<FlashcardContentEntry, "updatedAt">>): Promise<void> {
  const now = Date.now();
  await db.flashcardContents.bulkPut(
    entries.map((entry) => ({
      ...entry,
      updatedAt: now,
    }))
  );
}

// ============= QUIZ SESSIONS =============

export async function getAllQuizSessions(): Promise<QuizSession[]> {
  try {
    return await db.quizSessions.orderBy("createdAt").reverse().toArray();
  } catch (error) {
    console.error("getAllQuizSessions error:", error);
    return [];
  }
}

export async function createQuizSession(session: QuizSession): Promise<void> {
  try {
    console.log("createQuizSession called with:", session);
    const result = await db.quizSessions.put(session);
    console.log("createQuizSession result:", result);
  } catch (error) {
    console.error("createQuizSession error:", error);
    throw error;
  }
}

export async function clearAllQuizSessions(): Promise<void> {
  try {
    await db.quizSessions.clear();
  } catch (error) {
    console.error("clearAllQuizSessions error:", error);
    throw error;
  }
}

// ============= WALLET =============

/**
 * Initializes wallet if it doesn't exist.
 * Creates a new wallet with 0 coins.
 */
export async function initializeWallet(): Promise<Wallet> {
  try {
    let wallet = await db.wallets.get("wallet");
    if (!wallet) {
      wallet = {
        id: "wallet",
        totalCoins: 0,
        lastUpdatedAt: Date.now(),
        version: 1,
      };
      await db.wallets.put(wallet);
    }
    return wallet;
  } catch (error) {
    console.error("initializeWallet error:", error);
    throw error;
  }
}

/**
 * Retrieves the user's wallet.
 * Returns the wallet, or creates one if missing.
 */
export async function getWallet(): Promise<Wallet> {
  try {
    const wallet = await db.wallets.get("wallet");
    if (!wallet) {
      return initializeWallet();
    }
    return wallet;
  } catch (error) {
    console.error("getWallet error:", error);
    throw error;
  }
}

/**
 * Updates wallet with earned coins.
 * Increments totalCoins by the amount earned.
 */
export async function updateWallet(coinsEarned: number): Promise<Wallet> {
  try {
    let wallet = await db.wallets.get("wallet");
    if (!wallet) {
      wallet = {
        id: "wallet",
        totalCoins: coinsEarned,
        lastUpdatedAt: Date.now(),
        version: 1,
      };
    } else {
      wallet.totalCoins += coinsEarned;
      wallet.lastUpdatedAt = Date.now();
    }
    await db.wallets.put(wallet);
    console.log("Wallet updated:", wallet);
    return wallet;
  } catch (error) {
    console.error("updateWallet error:", error);
    throw error;
  }
}
