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
- Scope all writes with `family_id` from session context; scope user-specific writes (quiz_sessions, wallets) with `user_id`

---

## Out of Scope

- Schema changes (Feature 5 schema is final)
- RLS policy changes (already deployed)
- JWT enrichment (deferred — current RLS uses service role for writes; browser client uses anon key)
- Legacy data migration from IndexedDB to Supabase (users start fresh)
- Dexie migration scripts or backward compatibility
- Changes to scheduler, grading, or normalization logic (pure domain functions stay untouched)

---

## Proposed Behavior

### New Service Module: `src/lib/supabase-service.ts`

All data access functions live here, replacing `db.ts` exports 1:1. Each function uses the browser Supabase client (`supabase` from `supabaseClient.ts`) for reads, and either the browser client (if JWT claims are enriched) or an API route (if service role is needed for writes).

### Function Mapping (IndexedDB → Supabase)

| Old function (db.ts) | New function (supabase-service.ts) | Table | Notes |
|---|---|---|---|
| `db.words.orderBy("createdAt").reverse().toArray()` | `getAllWords(familyId)` | `words` | family-scoped; order by `created_at` desc |
| `getDueWords(now)` | `getDueWords(familyId, now)` | `words` | `next_review_at <= now` OR `next_review_at = 0` |
| `gradeWord(id, grade, now)` | `gradeWord(id, grade, now)` | `words` | read → compute via scheduler → update |
| `db.words.bulkAdd(newWords)` | `addWords(familyId, words)` | `words` | insert with family_id; skip existing (upsert on hanzi) |
| `db.words.delete(id)` | `deleteWord(id)` | `words` | single row delete |
| `db.words.put(word)` | `putWord(word)` | `words` | upsert single word (used by reset) |
| `getFlashcardContent(char, pron)` | `getFlashcardContent(familyId, char, pron)` | `flashcard_contents` | key = `"{char}\|{pron}"` |
| `getAllFlashcardContents()` | `getAllFlashcardContents(familyId)` | `flashcard_contents` | family-scoped |
| `putFlashcardContent(char, pron, content)` | `putFlashcardContent(familyId, char, pron, content)` | `flashcard_contents` | upsert on `(id, family_id)` |
| `deleteFlashcardContent(char, pron)` | `deleteFlashcardContent(familyId, char, pron)` | `flashcard_contents` | delete by key + family_id |
| `getAllQuizSessions()` | `getAllQuizSessions(familyId)` | `quiz_sessions` | order by `created_at` desc |
| `createQuizSession(session)` | `createQuizSession(userId, familyId, session)` | `quiz_sessions` | insert with user_id + family_id |
| `clearAllQuizSessions()` | `clearAllQuizSessions(familyId)` | `quiz_sessions` | delete all for family |
| `getWallet()` / `initializeWallet()` | `getOrCreateWallet(userId, familyId)` | `wallets` | upsert on user_id |
| `updateWallet(coinsEarned)` | `updateWallet(userId, familyId, coinsEarned)` | `wallets` | increment total_coins |
| `initializeDatabaseForPin()` | **Deleted** | — | No PIN-scoped DB; Supabase session manages isolation |
| `clearDatabaseState()` | **Deleted** | — | Supabase auth signOut handles cleanup |

### camelCase ↔ snake_case Conversion

The service layer is the **only** place where this conversion happens. TypeScript types remain camelCase. Postgres columns remain snake_case. Two internal helpers:

```typescript
function toWord(row: SupabaseWordRow): Word { ... }
function fromWord(word: Word, familyId: string): SupabaseWordRow { ... }
```

Same pattern for flashcard_contents, quiz_sessions, wallets.

### RLS and Auth Strategy

**Reads:** The browser Supabase client sends the anon key + session JWT. RLS policies evaluate `family_id` from the JWT. If JWT enrichment is not yet active, reads may need to go through an API route using the service role client, with the family_id extracted from the session context. Determine at implementation time which path works.

**Writes:** Same as reads — prefer browser client if RLS allows. Fall back to API route with service role if needed.

**Decision to make during implementation:** Whether JWT claims (`family_id`, `user_id`) are already enriched in the Supabase session token. If not, all Supabase calls must go through server-side API routes using the service role client. This affects the architecture of the service module (client-side vs. server-side calls).

---

## Layer Impact

### Service Layer (primary change)
- **New**: `src/lib/supabase-service.ts` — all data access functions
- **Deleted**: `src/lib/db.ts` — entire file
- **Deleted**: `src/lib/auth.ts` — PIN-scoped DB helpers (if still present)

### UI Layer (import changes only)
- `src/app/words/shared/words.shared.state.ts` — change imports from `@/lib/db` to `@/lib/supabase-service`; pass `familyId`/`userId` from session to service calls
- `src/app/words/results/ResultsPage.tsx` — change imports from `@/lib/db` to `@/lib/supabase-service`; pass `familyId` to `getAllQuizSessions()` and `clearAllQuizSessions()`

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
| JWT not enriched with family_id/user_id | Browser client reads return empty (RLS blocks) | Detect at implementation time; fall back to API routes with service role |
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

1. **JWT enrichment status**: Are `family_id` and `user_id` currently set as custom claims in the Supabase JWT? If not, all service calls must route through API routes using the service role client. This determines whether `supabase-service.ts` makes direct Supabase client calls or fetches from `/api/data/*` endpoints.

2. **Wallet model change**: Current `Wallet.id` is `"wallet"` (singleton). Supabase schema keys on `user_id`. Should we update the `Wallet` type to remove `id` and use `userId` as the key, or keep `id` as an alias?

3. **fillTests / disabledFillTests tables**: These IndexedDB tables exist in `db.ts` but have no Supabase equivalent. The `include_in_fill_test` flag on `flashcard_contents.phrases[].include_in_fill_test` appears to have replaced them. Confirm these are dead code and can be dropped without replacement.

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
