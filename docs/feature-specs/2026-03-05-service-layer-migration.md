# Feature Spec — 2026-03-05 — Service Layer Migration (IndexedDB → Supabase)

## Problem

The app's data layer (`src/lib/db.ts`) uses IndexedDB via Dexie.js for all persistent state: words, flashcard content, quiz sessions, and wallets. The Supabase schema and RLS policies are deployed (Feature 5) and authenticated sessions exist (Feature 4), but the app still reads and writes IndexedDB. Every data operation currently throws "Database not initialized" because the PIN-scoped Dexie setup path is no longer active after the auth rewrite.

This migration replaces all IndexedDB reads/writes with Supabase client calls via the anon key, scoped by RLS policies using the session JWT's `family_id` and `user_id` claims.

---

## Scope

- Create `src/lib/supabase-service.ts` — new service module with all data access functions
- Retire `src/lib/db.ts` entirely (delete file, remove Dexie dependency)
- Retire `src/lib/auth.ts` (PIN-scoped database helpers, no longer needed)
- Update all consumers:
  - `src/app/words/shared/words.shared.state.ts`
  - `src/app/words/results/ResultsPage.tsx`
- Convert between camelCase (TypeScript types) ↔ snake_case (Postgres columns) in service layer
- RLS policies read `family_id` and `user_id` from the JWT automatically — service functions do **not** accept these as parameters

---

## Out of Scope

- Schema changes (Feature 5 schema is final)
- RLS policy changes (already deployed)
- Legacy data migration from IndexedDB to Supabase (users start fresh)
- Dexie migration scripts or backward compatibility
- Changes to scheduler, grading, or normalization logic (pure domain functions stay untouched)
- Server-side API route fallback (`/api/data/*`) — not needed; browser client works directly with RLS

---

## Proposed Behavior

### New Service Module: `src/lib/supabase-service.ts`

All data access functions live here, replacing `db.ts` exports 1:1. Each function uses the browser Supabase client (`supabase` from `supabaseClient.ts`). The JWT is enriched with `family_id`, `user_id`, `role`, and `is_platform_admin` via `app_metadata` (set during PIN verification in `/api/auth/pin-verify`). RLS policies read these claims automatically — **no `familyId` or `userId` parameters are needed in service function signatures**.

### Function Mapping (IndexedDB → Supabase)

| Old function (db.ts) | New function (supabase-service.ts) | Table | Notes |
|---|---|---|---|
| `db.words.orderBy("createdAt").reverse().toArray()` | `getAllWords()` | `words` | RLS scopes to family; order by `created_at` desc |
| `getDueWords(now)` | `getDueWords(now)` | `words` | `next_review_at <= now` OR `next_review_at = 0` |
| `gradeWord(id, grade, now)` | `gradeWord(id, grade, now)` | `words` | read → compute via scheduler → update |
| `db.words.bulkAdd(newWords)` | `addWords(words)` | `words` | insert; RLS enforces family scope; skip existing via `ON CONFLICT DO NOTHING` |
| `db.words.delete(id)` | `deleteWord(id)` | `words` | single row delete |
| `db.words.put(word)` | `putWord(word)` | `words` | upsert single word (used by reset) |
| `getFlashcardContent(char, pron)` | `getFlashcardContent(char, pron)` | `flashcard_contents` | key = `"{char}\|{pron}"`; RLS scopes to family |
| `getAllFlashcardContents()` | `getAllFlashcardContents()` | `flashcard_contents` | RLS scopes to family |
| `putFlashcardContent(char, pron, content)` | `putFlashcardContent(char, pron, content)` | `flashcard_contents` | upsert on `(id, family_id)` |
| `deleteFlashcardContent(char, pron)` | `deleteFlashcardContent(char, pron)` | `flashcard_contents` | delete by key; RLS scopes to family |
| `getAllQuizSessions()` | `getAllQuizSessions()` | `quiz_sessions` | order by `created_at` desc; RLS scopes to family |
| `createQuizSession(session)` | `createQuizSession(session)` | `quiz_sessions` | insert; RLS enforces user_id + family_id from JWT |
| `clearAllQuizSessions()` | `clearAllQuizSessions()` | `quiz_sessions` | delete all for family (RLS-scoped) |
| `getWallet()` / `initializeWallet()` | `getOrCreateWallet()` | `wallets` | upsert on user_id from JWT |
| `updateWallet(coinsEarned)` | `updateWallet(coinsEarned)` | `wallets` | increment total_coins; RLS enforces user_id |
| `initializeDatabaseForPin()` | **Deleted** | — | No PIN-scoped DB; Supabase session manages isolation |
| `clearDatabaseState()` | **Deleted** | — | Supabase auth signOut handles cleanup |

### camelCase ↔ snake_case Conversion

The service layer is the **only** place where this conversion happens. TypeScript types remain camelCase. Postgres columns remain snake_case. Two internal helpers:

```typescript
function toWord(row: SupabaseWordRow): Word { ... }
function fromWord(word: Word): SupabaseWordRow { ... }
```

Same pattern for flashcard_contents, quiz_sessions, wallets. The `family_id` and `user_id` columns are populated by reading the JWT claims inside the database (via RLS helper functions like `current_family_id()` and `current_user_id()`), so the TypeScript conversion helpers do not need to inject them.

### RLS and Auth Strategy (Resolved)

**Decision closed:** JWT claims are enriched. The `/api/auth/pin-verify` route writes `family_id`, `user_id`, `role`, and `is_platform_admin` into Supabase Auth `app_metadata` via `auth.admin.updateUserById()`. After the client calls `supabase.auth.refreshSession()`, every subsequent request includes these claims in the JWT. RLS helper functions (`current_family_id()`, `current_user_id()`, `is_platform_admin()`) extract them from `request.jwt.claims -> 'app_metadata'`.

**Path A confirmed:** All service functions use the browser Supabase client directly. No server-side API route fallback (`/api/data/*`) is needed. No `familyId` or `userId` parameters are passed to service functions.

For **inserts** into `quiz_sessions` and `wallets` (which require `user_id` and `family_id` columns), the service layer reads these values from the Supabase session's `app_metadata` at call time and includes them in the insert payload. RLS `WITH CHECK` policies verify the values match the JWT claims.

---

## Layer Impact

### Service Layer (primary change)
- **New**: `src/lib/supabase-service.ts` — all data access functions
- **Deleted**: `src/lib/db.ts` — entire file
- **Deleted**: `src/lib/auth.ts` — PIN-scoped DB helpers (if still present)

### UI Layer (import changes only)
- `src/app/words/shared/words.shared.state.ts` — change imports from `@/lib/db` to `@/lib/supabase-service`; no parameter changes needed (RLS handles scoping)
- `src/app/words/results/ResultsPage.tsx` — change imports from `@/lib/db` to `@/lib/supabase-service`; no parameter changes needed

### Domain Layer
**No changes.** `scheduler.ts`, `fillTest.ts`, `flashcardLlm.ts`, `coins.ts` remain pure functions.

### AI Layer
**No changes.** `/api/flashcard/generate/route.ts` remains unchanged.

### Types
- `Word` type (`src/lib/types.ts`): unchanged — service layer converts
- `QuizSession` type: unchanged
- `Wallet` type: `id` field changes from `"wallet"` (singleton) to `userId` (per-user); or remove `id` field entirely since `wallets` table keys on `user_id`
- `FlashcardContentEntry` (db.ts): type moves to `supabase-service.ts` or a shared types file

---

## Edge Cases

1. **No words yet for family**: `getAllWords()` returns `[]` — summary cards show zeros; table shows empty state.
2. **No wallet for user**: `getOrCreateWallet()` upserts a default row with `total_coins = 0`.
3. **Duplicate hanzi insert**: `addWords()` uses `ON CONFLICT (family_id, hanzi) DO NOTHING` — no error, silently skips.
4. **Word reset**: `putWord()` upserts the row, preserving `id` and `hanzi` but resetting scheduling fields.
5. **Concurrent writes**: Supabase Postgres handles row-level locking; no explicit optimistic concurrency needed for Tier 1.
6. **Session expires mid-operation**: Supabase client auto-refreshes tokens. If refresh fails, the next call returns a 401 and `onAuthStateChange` fires SIGNED_OUT → redirect to login.
7. **flashcard_contents composite key**: `id` = `"{character}|{pronunciation}"`, scoped by `family_id` as second primary key column. Service layer constructs this key.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Dexie import still referenced somewhere | Build fails after deletion | Grep for all `@/lib/db` imports; fix all before deleting |
| snake_case conversion bug | Data read/write silently broken | Write unit tests for converter helpers |
| Network latency (Supabase vs local IndexedDB) | Perceived slower UI | Add loading states where missing; consider SWR/React Query in future |
| Wallet schema change (singleton → per-user) | Existing Wallet type consumers break | Update `coins.types.ts` in same PR |

---

## Test Plan

### Manual Testing

**Words:**
- [ ] Add characters → verify rows appear in Supabase `words` table with correct `family_id`
- [ ] All Characters page loads and displays words from Supabase
- [ ] Delete word → row removed from Supabase
- [ ] Reset word → scheduling fields reset, `id` preserved

**Flashcard Content:**
- [ ] Admin page generates content → saved to Supabase `flashcard_contents`
- [ ] Flashcard review reads from Supabase
- [ ] Delete content → row removed

**Quiz Sessions:**
- [ ] Complete fill-test → session saved to Supabase `quiz_sessions` with `user_id` and `family_id`
- [ ] Results page loads sessions from Supabase
- [ ] Clear history → all sessions deleted

**Wallet:**
- [ ] Complete quiz → wallet row created/updated in Supabase
- [ ] Coin balance persists across page refreshes

**Cross-family isolation (RLS):**
- [ ] Log in as Family A → cannot see Family B words
- [ ] Log in as platform admin → can see all families

### Automated Tests
- Unit tests for camelCase ↔ snake_case converters
- Unit tests for `gradeWord()` integration (scheduler + Supabase write)

---

## Acceptance Criteria

- [ ] `src/lib/db.ts` deleted; no remaining imports of `@/lib/db` in any file
- [ ] `dexie` removed from `package.json` dependencies
- [ ] All data reads/writes use Supabase via `src/lib/supabase-service.ts`
- [ ] camelCase ↔ snake_case conversion tested and correct
- [ ] Words, flashcard content, quiz sessions, and wallet CRUD verified manually
- [ ] RLS isolation verified (cross-family data invisible)
- [ ] `npm run typecheck` → 0 errors
- [ ] `npm run build` → success
- [ ] 0_ARCHITECTURE.md updated: service layer description, data schema references, retired files list
- [ ] 0_PRODUCT_ROADMAP.md updated: service layer refactor marked done

---

## Open Questions

1. ~~**JWT enrichment status**~~ **CLOSED.** JWT is enriched via `app_metadata` in `/api/auth/pin-verify/route.ts`. Browser Supabase client works directly with RLS. Path A confirmed — no `/api/data/*` fallback needed.

2. ~~**Wallet model change**~~ **CLOSED.** Remove `id` from `Wallet` type entirely. Use `userId` as the natural key — maps directly to `wallets.user_id` in Postgres. The singleton `id = "wallet"` pattern was an IndexedDB workaround. `coins.types.ts` updated in this PR.

3. ~~**fillTests / disabledFillTests tables**~~ **CLOSED.** Confirmed dead code — zero references in active `src/` outside `db.ts`. The `include_in_fill_test` boolean on `flashcard_contents.phrases[]` and `examples[]` is the replacement. All 7 functions (`getCustomFillTest`, `getAllCustomFillTests`, `putCustomFillTest`, `deleteCustomFillTest`, `getAllDisabledFillTests`, `putDisabledFillTest`, `deleteDisabledFillTest`) and 2 types (`FillTestOverride`, `DisabledFillTestEntry`) dropped with no replacement.

---

## Implementation Sequence

1. Create `src/lib/supabase-service.ts` with all service functions (empty stubs first, then implement)
2. Update `words.shared.state.ts` — swap imports, pass session data
3. Update `ResultsPage.tsx` — swap imports
4. Update `coins.types.ts` if wallet model changes
5. Run `npm run typecheck` — fix all errors
6. Delete `src/lib/db.ts`
7. Remove `dexie` from `package.json`
8. Run `npm run build` — verify clean
9. Manual testing with live Supabase
10. Update `0_ARCHITECTURE.md` and `0_PRODUCT_ROADMAP.md`
