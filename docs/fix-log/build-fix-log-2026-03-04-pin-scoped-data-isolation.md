# Fix Log – 2026-03-04 – PIN-Scoped Data Isolation

## Context

In dev testing, logging in with a different 4-digit PIN showed the same learning data instead of isolated user data. The login system was UI-only (session token controlled access), but IndexedDB was shared globally across all PINs.

## Root Cause

The `AppDB` class created a single database named `"cc_review_db"` regardless of which PIN was used. All IndexedDB tables (words, flashcardContents, quizSessions, wallets) were stored in the same global namespace. The session token protected UI access but not data access—both PINs pointed to identical data.

**Issue:** The system was designed for a single device with one user, but Phase 1 MVP supports up to 3 users (different PINs) and should isolate data per user.

## Changes Applied

### 1. **auth.ts** — Added PIN-to-database-name functions
- `getCurrentPinHash()`: Get the currently stored PIN hash
- `getPinScopedDatabaseName(pinHash: string | null): string`: Build a PIN-scoped database name
  - Returns database name like `cc_review_db_a1b2c3d4e5f6` (using first 12 chars of PIN hash)
  - Fallback to `cc_review_db` if no PIN provided (first load)

### 2. **db.ts** — Modified AppDB and added database lifecycle
- `AppDB constructor`: Now accepts optional `databaseName` parameter (default: `"cc_review_db"`)
- `getDb(): AppDB`: New function to get or initialize the current database
  - Returns `currentDb` instance scoped to current PIN
  - Lazy initialization on first access
- `initializeDatabaseForPin(pinHash: string, shouldMigrate: boolean = false): Promise<void>`: Called on successful login
  - Closes previous database if it exists
  - Creates new PIN-scoped database
  - Optional parameter `shouldMigrate` triggers legacy data migration on first PIN setup
  - Called **after** PIN is hashed and before redirect to `/words`
- `migrateFromLegacyDatabase(newDb: AppDB): Promise<void>`: Migration function (new)
  - Detects if legacy unscoped database (`cc_review_db`) contains data
  - Copies all tables from legacy DB to new PIN-scoped DB:
    - `words`, `fillTests`, `disabledFillTests`, `flashcardContents`, `quizSessions`, `wallets`
  - Logs migration status to console
  - Closes legacy database after successful migration
  - Called automatically during first PIN setup if legacy data exists
- `export const db`: Backward-compatible Proxy that forwards all property access to `getDb()`
  - Ensures existing code using `db.words` etc. continues to work
  - No breaking changes to import statements

### 3. **login/page.tsx** — Added database initialization and migration on login
- Imported `initializeDatabaseForPin` from `@/lib/db`
- **First-time setup flow**: After `setPinHash()`, call `await initializeDatabaseForPin(pinHash, true)`
  - `shouldMigrate=true` triggers automatic migration of legacy data from unscoped database
  - User's existing dev data (words, sessions, etc.) is copied to new PIN-scoped database
  - Console logs migration progress (count of words, sessions, etc. migrated)
- **Returning user flow**: After PIN verification, call `await initializeDatabaseForPin(storedHash)`
  - Standard database initialization without migration (no legacy data to move)
- Database reinitialization happens **before** session token creation and redirect

### 4. **words/shared/WordsShell.tsx** — Added database closure on logout
- Imported `getDb` from `@/lib/db`
- Modified `handleLogout` to be async
- Before `clearAllAuthData()`, close the current database:
  ```typescript
  const db = getDb();
  await db.close();
  ```
- Cleanup ensures the previous PIN's database is not left in limbo

## Architectural Impact

### Layer: Service (Data)
- **Data isolation boundary added**: Each PIN now has its own IndexedDB instance
- **Session lifecycle:** During login, the database switches from one PIN's scope to another
- **Backward compatibility:** Existing code using `import { db }` continues to work
- **API boundary unchanged:** All functions in db.ts remain public and signature-compatible

### Schema: IndexedDB
- **No schema changes**: All tables remain identical in structure
- **Multi-instance pattern**: Same `AppDB` class, different database names per PIN
- **Versioning:** Schema versions stay consistent; no migration needed

### UI Layer Impact
- **Login/logout flow** now triggers database switches (invisible to user)
- **No UI changes** required; session UI remains the same
- **Performance**: Database close/open on login (~50ms, negligible)

## Preventative Rule

**Data isolation rule:** When adding multi-user or multi-PIN features:
1. IndexedDB namespace must be scoped by user identifier (PIN hash, user ID, etc.)
2. Database initialization/switching must happen **before** allowing data access
3. Database lifecycle (close) must be managed during logout/PIN change
4. Test data isolation by logging in with different PINs and verifying separate data
5. **Migration path:** If the system previously had unscoped data, provide a one-time migration on first PIN setup to preserve user's existing data
6. Log migration progress to console for debugging and user confidence

## Docs Updated

- **0_ARCHITECTURE.md**: Not updated (data isolation already implicit in login spec)
- **2026-03-04-login-and-avatar-protection.md**: Added clarification about data isolation (new rule):
  - Added note: "Each PIN has isolated IndexedDB instance; data is not shared across users"
  - Clarified that PIN change triggers full database reinitialization

---

**Acceptance:** 
- Build passes TypeScript checks
- Data isolation tested locally (separate PINs see separate word lists)
- **Migration tested:** Log in with PIN `0720` → Console shows migration logs → All existing dev data appears in the new PIN-scoped database
- Subsequent logins with different PINs create new isolated databases (no migration)
- Logout properly closes current database

