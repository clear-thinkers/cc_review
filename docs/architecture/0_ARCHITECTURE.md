# ARCHITECTURE

_Last updated: 2026-03-06_ (Login & auth rules updated to two-layer Supabase model; remaining IndexedDB references removed)

---

## Read This Before Every Feature Build

Read all reference docs before starting any task. See `AI_CONTRACT.md §1` for the required reading order and conflict resolution authority.

This document covers: system structure, layer boundaries, data schema, error handling behavior.
It does **not** define agent operating rules — those live in `AI_CONTRACT.md`.

---

## 1) Product Rules

This project is a **local-first Chinese memory engine** with deterministic review behavior.

Tier 1 rules (active):
- Review is scheduler-driven and deterministic (`again|hard|good|easy` grade mapping — no stochastic grading).
- Review sessions consume **persisted content only** — no live generation.
- AI generation is scoped to admin authoring workflows only (`/words/admin` → `/api/flashcard/generate`).
- Flashcard content is keyed by `character|pronunciation` and normalized before persistence.
- Fill-test eligibility is derived from saved phrase/example rows and `include_in_fill_test` flags.
- Unsafe content and malformed payloads are dropped during normalization before they can be persisted.

Primary user flow:
1. Add Hanzi → `/words/add` → Supabase `words` table.
2. Curate content → `/words/admin` → `/api/flashcard/generate` + manual edits → Supabase `flashcard_contents` table.
3. Review → `/words/review`, `/words/review/flashcard`, `/words/review/fill-test` → reads persisted data only.

### Ingestion Rules

These rules govern all character ingestion via `/words/add`:

1. Input accepts free text — only Hanzi characters are extracted. Non-Hanzi symbols (letters, punctuation, numbers, emoji) are ignored.
2. Multi-character strings are split into individual Hanzi characters.
3. Duplicate characters within the same submission are removed before writing.
4. Characters already present in the `words` table are skipped — no overwrite occurs.
5. New records are initialized as unreviewed (`repetitions=0`, `nextReviewAt=0`, no fill-test content).
6. A bilingual status message is shown after every submission covering three states: nothing added, all added, some added and some skipped.
7. Add flow does not auto-generate flashcard or admin content — Content Admin remains a separate step.

### All Characters Inventory Rules

These rules govern the inventory view at `/words/all`:

1. The page renders all rows from the local `words` table.
2. Summary cards are computed from in-memory `words` state:
   - `Total Characters`: `words.length`
   - `Times Reviewed`: sum of `reviewCount` with fallback to `repetitions`
   - `Times Tested`: sum of `testCount`
   - `Avg Familiarity`: mean of `getMemorizationProbability(word)`
3. Table sorting is client-side and single-column.
4. Re-clicking the active sort column toggles direction (`asc`/`desc`).
5. Sort tie-breaker is `createdAt` ascending for deterministic ordering.
6. `Next Review Date` shows `Now` when `nextReviewAt` is empty or `0`.
7. `Reset` keeps the same `id` and `hanzi`, resets scheduling counters to baseline values, and updates `createdAt`.
8. `Delete` removes the row from Supabase immediately (no confirmation dialog).
9. `Reset` and `Delete` action buttons are hidden for child profiles. Only parents and platform admins can reset or delete words.
10. The page does not call AI generation routes.
10. The page does not generate or edit flashcard/admin content.
11. The page does not deduplicate historical duplicate rows; it renders stored data as-is.
12. The page does not paginate or virtualize large datasets.
13. The page owns display/sorting behavior only; scheduler logic remains in `scheduler.ts`.

### Content Admin Curation Rules

These rules govern content curation at `/words/admin`:

1. Curation targets are `character|pronunciation` pairs derived from `words.hanzi` plus Xinhua pronunciation discovery.
2. The page may load, draft, normalize, and persist flashcard content only in `flashcardContents`.
3. The page must not write to `words`, modify scheduler fields, or run review sessions.
4. Generation calls are routed through `/api/flashcard/generate` (no direct provider calls from UI code).
5. Every persisted admin save path must pass through normalization before write.
6. Invalid draft rows are dropped during normalization; unsaved drafts are not review content.
7. `include_in_fill_test` is persisted immediately on toggle and directly controls testing eligibility.
8. Content-status buckets are defined as:
   - `with content`: at least one normalized phrase row exists
   - `missing content`: no normalized phrase row exists
   - `ready for testing`: has content and at least one phrase included for fill test
   - `excluded for testing`: has content but no phrase included for fill test
9. Preload generation skips targets that already have persisted content and continues non-fatally on per-target failures.
10. Characters with no dictionary pronunciation are skipped with notice; this is not a fatal load error.

### Due Review Queue Rules

These rules govern the due queue view at `/words/review`:

1. `/words` redirects to `/words/review`, making due review the operational review entry route.
2. Due eligibility is sourced from `getDueWords()`:
  - rows with `nextReviewAt <= now` are due
  - missing/zero `nextReviewAt` is treated as due
3. The page derives and displays due-list presentation state only (count, sort order, familiarity, action availability).
4. Fill-test availability is derived from saved `flashcardContents` and attached in-memory to due rows; this page does not persist fill-test content.
5. The page routes to `/words/review/flashcard` and `/words/review/fill-test`, optionally scoped by `wordId`.
6. This page must not grade words, mutate scheduler fields, create/delete words, or persist admin content edits.
7. Due-table sorting is client-side; default due ordering uses `nextReviewAt` then `createdAt` as tie-breaker.
8. Fill-test start/action controls are enabled only when a due row has a usable derived `fillTest`.
9. Any change to fill-test eligibility or semantics must be reflected here and in the Content Admin Curation Rules (§1) concurrently. Failure to update both documents is a documentation gap.

### Flashcard Review Rules (`/words/review/flashcard`)

These rules govern the flashcard review screen for memory consolidation:

1. Flashcard is **review-only** — it does not award grades or update scheduling. Grading happens exclusively in dedicated test interfaces (`/words/review/fill-test` or other test modes).
2. Flashcard displays:
   - **Always visible:** Character (Hanzi) with pinyin support, meaning(s), and a pinyin toggle button
   - **Conditionally visible:** Phrase-example pairs marked with `include_in_fill_test: true`
   - **Placeholder when empty:** If no phrases are marked for testing, display "No phrases included for testing" instead of blank space
3. Character and meaning are always displayed; only phrases are conditionally rendered based on the `include_in_fill_test` flag.
4. Pinyin toggle (`showPinyin` state in parent `FlashcardReviewSection`) controls visibility of pinyin spans across all text (character, phrases, examples). When toggled off, pinyin is removed from DOM (not hidden via CSS).
5. Parent component manages session-level state (toggle, word sequence); individual cards are stateless display components.
6. No grading buttons, no progress tracking, no scheduler mutations on this screen.
7. Any change to how flashcard content is displayed (phrases, pinyin, layout) must be codified here before implementation.

### Quiz Results Rules (`/words/results`)

These rules govern the results/history view for session data reporting:

1. Results page is **view-only and read-only** — no modifications to `quizSessions` are performed here except for the explicit "Clear History" action.
2. The page displays all completed fill-test sessions in a table/list sorted by `createdAt` (newest first).
3. Each session row displays: Session Date, % Fully Correct, % Failed, % Partial, Duration, Tested Count, Tested Characters, Failed Count, Failed Characters, Coins Earned.
4. **Accuracy calculation rules:**
   - `% Fully Correct = (fullyCorrectCount / totalGrades) × 100`, rounded to nearest integer
   - `% Failed = (failedCount / totalGrades) × 100`, rounded to nearest integer
   - `% Partial = (partiallyCorrectCount / totalGrades) × 100`, rounded to nearest integer
   - Only `grade="easy"` counts as fully correct for accuracy; `grade="hard"` and `grade="again"` do not contribute to accuracy
   - The three percentages must sum to 100% (within ±1% rounding tolerance)
5. **Character list derivation:**
   - Tested characters = unique hanzi from all grade entries in `gradeData`, deduplicated and ordered by first appearance
   - Failed characters = unique hanzi from grade entries where `grade="again"` only; excludes `grade="hard"` or `grade="easy"`
   - Character lists are displayed as comma-separated Hanzi with truncation to first 8–10 characters plus "…" if longer
6. **Summary card calculations:** When multiple sessions exist, compute weighted averages across all sessions:
   - Total Sessions = count of all records
   - Overall % Fully Correct = (sum of fullyCorrectCounts across all sessions / sum of totalGrades across all sessions) × 100
   - Overall % Failed and Overall % Partial calculated similarly
   - Total Characters Tested = sum of unique character counts across all sessions
   - Total Duration = sum of durationSeconds across all sessions, displayed in human-readable format (hh:mm:ss)
7. **Clear History action:**
   - Single destructive action button available only when sessions exist
   - Clear History button is hidden for child profiles. Only parents and platform admins can clear quiz history.
   - Requires confirmation dialog before deletion
   - On confirmation, all records in `quizSessions` table are deleted permanently with no undo
   - Table and summary cards clear immediately upon successful deletion
8. **Empty state:** When no sessions exist, display a placeholder message directing users to start a review session; hide all table and summary UI elements.

### Login & Avatar Protection Rules (`/login`)

These rules govern the two-layer authentication and session protection system:

1. Login page (`/login`) and registration page (`/register`) are **not protected by session guard** — they are always accessible for authentication flows.
2. All other pages and routes require a valid Supabase session to access; unauthenticated requests redirect to `/login`.
3. **Two-layer authentication model:**
   - **Layer 1 — Family Authentication (Supabase Auth):** One Supabase Auth account per family. Standard email + password. Supabase handles token issuance, refresh, and recovery. This layer proves the person belongs to the family.
   - **Layer 2 — Profile Selection + PIN (App Layer):** After Layer 1, the user sees their family's profile cards and taps a profile. A 4-digit PIN entry screen renders. The app hashes the PIN and compares it to `users.pin_hash` for the selected profile. On match, the app session context is set (`family_id`, `user_id`, `role`) and the JWT is enriched with these claims.
4. **Registration flow:**
   - User visits `/register` and enters family name, email, and password
   - Supabase Auth creates the account
   - App creates a `families` row and a parent `users` row (`role: 'parent'`)
   - Parent sets their own 4-digit PIN
   - Parent creates at least one child profile (name + PIN per child)
   - User is redirected to `/login`
5. **Login flow:**
   - Layer 1: User enters email + password; Supabase Auth validates and issues JWT
   - Layer 2: Profile picker renders all `users` rows for the authenticated `family_id`; user taps a profile and enters their PIN
   - On PIN match: session context set, JWT enriched, redirect to `/words`
   - On PIN mismatch: `failed_pin_attempts` incremented on the `users` row
6. **PIN security:**
   - PIN hashed with `scrypt` (N=16384, r=8, p=1, keylen=32); stored format: `{32-hex-salt}:{64-hex-hash}`
   - Salt is 16 random bytes generated per hash; verification uses `crypto.timingSafeEqual`
   - PIN verification is performed server-side via `/api/auth/pin-verify` — client never compares hashes directly
   - Layer 2 PIN is a profile switcher, not the primary authentication gate; real security lives in Layer 1
7. **Lockout rules:**
   - After 5 consecutive failed PIN attempts, the profile is locked
   - Locked message: "Too many attempts. Please ask a parent to unlock."
   - Parent unlock: re-enter Layer 1 (email + password) to reset the failed attempt counter
   - Successful PIN entry resets `failed_pin_attempts` to 0
8. **Avatars:**
   - 8 avatar options: `bubble_tea_excited_1`, `cake_sleep_1`, `donut_wink_1`, `rice_ball_sleep_1`, `zongzi_smile_1`, `ramen_excited_1`, `babaorice_smile_1`, `bun_wink_1` (images in `/public/avatar/`)
   - Avatar stored as `avatar_id` on the `users` row
   - Avatar displayed in nav bar when logged in
9. **Session persistence:**
   - Supabase Auth manages JWT lifecycle (issuance, refresh, expiration)
   - App session context (`family_id`, `user_id`, `role`) is derived from JWT `app_metadata` claims
   - `AuthProvider` React context exposes session state to all components
   - `SessionGuard` wraps protected routes and redirects to `/login` when no valid session exists
10. **Logout flow:**
    - Logout button available in main app nav bar
    - Logout calls `supabase.auth.signOut()` to invalidate the Supabase session
    - App session context is cleared
    - User is redirected to `/login`
11. **Data isolation (critical):**
    - All data is scoped by `family_id` in Supabase Postgres with Row Level Security policies
    - Words, flashcard content, quiz sessions, wallet, and all learning data are **never shared** across families
    - Within a family, `user_id`-scoped tables (wallet, quiz_sessions) isolate per-profile data
    - Platform admin (`is_platform_admin = true`) bypasses RLS for data management
    - No cross-tenant data leakage is possible at the database layer

### Role-Based Routing Rules (`/words/*`)

Route access enforced by client-side RouteGuard using session role:
- **Child**: Can access review (flashcard and fill-test), all characters, quiz results. Cannot access add or admin (content curation restricted to parents).
- **Parent**: Can access add, admin, all, results, review, flashcard. Cannot access fill-test (learning mode restricted to children).
- **Platform admin**: Full access (isPlatformAdmin flag bypasses role restrictions).

Blocked routes are hidden from navigation (not shown as disabled). Direct URL access to blocked routes redirects to `/words/review` with no error message.

Role enforcement is UI-only; database operations protected by RLS policies at the data layer.

**In-page action restrictions (child role):**
- `/words/all`: Reset and Delete buttons are hidden — children cannot modify or remove words.
- `/words/results`: Clear History button is hidden — children cannot delete quiz session records.

**Permission matrix**:
| Route | Child | Parent | Platform Admin |
|---|---|---|---|
| `/words/add` | ❌ | ✅ | ✅ |
| `/words/all` | ✅ | ✅ | ✅ |
| `/words/admin` | ❌ | ✅ | ✅ |
| `/words/prompts` | ❌ | ✅ | ✅ |
| `/words/results` | ✅ | ✅ | ✅ |
| `/words/review` | ✅ | ✅ | ✅ |
| `/words/review/flashcard` | ✅ | ✅ | ✅ |
| `/words/review/fill-test` | ✅ | ❌ | ✅ |

---

## 2) Layer Boundaries

### Layers and Ownership

| Layer | Location | Responsibility |
|---|---|---|
| UI | `src/app/...`, `WordsWorkspace` | Interaction, view state, locale rendering |
| Domain | `src/lib/scheduler.ts`, `src/lib/fillTest.ts`, `src/lib/flashcardLlm.ts` | Pure logic: scheduling, grading, normalization |
| Service | `src/lib/supabase-service.ts`, `src/lib/supabaseClient.ts`, `src/lib/xinhua.ts` | IO: Supabase reads/writes (all data access), static data loading |
| AI | `src/app/api/flashcard/generate/route.ts` | Prompt orchestration, provider calls, active-prompt resolution from `prompt_templates` |

### Call Graph (Structural)

This describes how layers are wired — the actual call and import relationships the system uses:

- `src/app/**` communicates with `src/app/api/**` via **fetch calls only** — no direct imports.
- `src/app/api/**` is invoked only from admin authoring flows — never from review execution paths.
- **All database operations use `src/lib/supabase-service.ts`** — this is the single service module for all data access.
  - `src/lib/supabase-service.ts` uses the browser Supabase client (`supabase` from `supabaseClient.ts`), which passes the session JWT automatically.
  - RLS policies scope all reads/writes to the current family/user via JWT `app_metadata` claims.
  - Service functions handle camelCase (TypeScript) ↔ snake_case (Postgres) conversion.
  - For inserts requiring `family_id`/`user_id`, the service layer reads these from the Supabase session `app_metadata`.
  - API routes import `getServerSupabaseClient()` (service role, for admin operations only)
  - **No direct IndexedDB/Dexie operations** — IndexedDB is fully retired; `src/lib/db.ts` has been deleted
- `src/lib/scheduler.ts` has no dependency on UI or API layers — it is a pure domain module.
- AI output flows through normalization in `src/lib/flashcardLlm.ts` before reaching Supabase writes.
- `src/lib/db.ts` (IndexedDB) has been **deleted** — all data access uses `src/lib/supabase-service.ts`

> For the agent rules that enforce these boundaries (what to never do), see `AI_CONTRACT.md §2`.

---

## 3) Data Schema

### Supabase Postgres Tables (GitHub Copilot Note: IndexedDB fully retired)

The application stores all persistent data in Supabase Postgres. Row Level Security (RLS) policies enforce family-scoped data isolation. All tables include RLS enabled.

**`families` table** — one row per tenant (one family = one tenant)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `name` | text | Family display name (e.g., "Nora's Family") |
| `created_at` | timestamptz | Server timestamp |

**`users` table** — all human users (parents and children)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `family_id` | uuid | Foreign key → `families.id` |
| `auth_user_id` | uuid (nullable) | Links to Supabase Auth user (non-null for parents, null for children) |
| `name` | text | User display name |
| `role` | text | Either `'parent'` or `'child'` |
| `pin_hash` | text (nullable) | SHA-256 hash of 4-digit PIN; null for parents (use Supabase Auth PASSWORD) |
| `is_platform_admin` | boolean | True only for Chengyuan (platform admin); bypasses RLS on all tables |
| `failed_pin_attempts` | integer | Incremented on wrong PIN; reset on success; application locks at 5 attempts |
| `avatar_id` | text (nullable) | Filename stem; valid values: `bubble_tea_excited_1`, `cake_sleep_1`, `donut_wink_1`, `rice_ball_sleep_1`, `zongzi_smile_1`, `ramen_excited_1`, `babaorice_smile_1`, `bun_wink_1` |
| `created_at` | timestamptz | Server timestamp |

**`words` table** — one row per Hanzi character, scoped to family

| Field | Type | Notes |
|---|---|---|
| `id` | text | Primary key; preserves existing `makeId()` pattern |
| `family_id` | uuid | Foreign key → `families.id` |
| `hanzi` | text | Single Hanzi character |
| `pinyin` | text (nullable) | Optional pronunciation |
| `meaning` | text (nullable) | Optional translation |
| `repetitions` | integer | SRS repetition count (default: 0) |
| `interval_days` | numeric | Current SRS interval in days (default: 0) |
| `ease` | numeric | Scheduler stability/ease value (default: 21) |
| `next_review_at` | bigint | Unix timestamp in milliseconds; 0 means immediately due |
| `review_count` | integer | Count of flashcard review attempts (default: 0) |
| `test_count` | integer | Count of fill-test attempts (default: 0) |
| `fill_test` | jsonb (nullable) | FillTest object; populated only after Content Admin curation |
| `created_at` | timestamptz | Server timestamp |
| **Unique constraint** | | `(family_id, hanzi)` — prevents duplicate characters per family |

**`flashcard_contents` table** — curated content per character+pronunciation pair, scoped to family

| Field | Type | Notes |
|---|---|---|
| `id` | text | Composite value: `{character}\|{pronunciation}` |
| `family_id` | uuid | Foreign key → `families.id` |
| `meanings` | jsonb | String array of definitions |
| `phrases` | jsonb | Array of Phrase objects: `{ zh, pinyin, en, include_in_fill_test }` |
| `examples` | jsonb | Array of Example objects: `{ zh, pinyin, en, include_in_fill_test }` |
| `updated_at` | timestamptz | Server timestamp |
| **Primary key** | | `(id, family_id)` — composite key enforces scoped uniqueness |

**`quiz_sessions` table** — completed fill-test session records, immutable audit

| Field | Type | Notes |
|---|---|---|
| `id` | text | Primary key; unique session ID |
| `user_id` | uuid | Foreign key → `users.id` |
| `family_id` | uuid | Foreign key → `families.id` (denormalized for RLS efficiency) |
| `created_at` | timestamptz | Server timestamp when session was completed |
| `session_type` | text | Currently `'fill-test'`; reserved for future quiz types |
| `grade_data` | jsonb | Array of SessionGradeData: `{ wordId, hanzi, grade, timestamp }` |
| `fully_correct_count` | integer | Count of grades === `'easy'` (default: 0) |
| `failed_count` | integer | Count of grades === `'again'` (default: 0) |
| `partially_correct_count` | integer | Count of grades === `'good'` or `'hard'` (default: 0) |
| `total_grades` | integer | Sum of all grades (default: 0) |
| `duration_seconds` | integer | Elapsed time in seconds from session start to completion (default: 0) |
| `coins_earned` | integer | Coins earned in this session (default: 0) |
| **RLS Guarantee** | | Insert-only for non-admins (no update); immutable audit record |

**`wallets` table** — cumulative coin balance, one row per user

| Field | Type | Notes |
|---|---|---|
| `user_id` | uuid | Primary key → `users.id` (singleton pattern per user) |
| `family_id` | uuid | Foreign key → `families.id` (denormalized for RLS efficiency) |
| `total_coins` | integer | Cumulative coins earned across all sessions (default: 0) |
| `last_updated_at` | timestamptz | Server timestamp of last wallet update |
| `version` | integer | Schema version for future upgrades (currently 1) |

**`prompt_templates` table** — configurable LLM prompt templates (Phase 2, Feature #1)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `family_id` | uuid (nullable) | Foreign key → `families.id`; null for Default rows |
| `user_id` | uuid (nullable) | Foreign key → `users.id`; null for Default rows |
| `prompt_type` | text | One of: `full`, `phrase`, `example`, `phrase_details`, `meaning_details` |
| `slot_name` | text | User-visible name; max 50 chars; Default rows always named `"Default"` |
| `prompt_body` | text | System prompt sent to DeepSeek; per-type min/max enforced in service layer |
| `is_active` | boolean | True on the currently active slot; at most one per `(family_id, prompt_type)` |
| `is_default` | boolean | True only for the platform-wide Default rows (`family_id = null`) |
| `created_at` | timestamptz | Server timestamp |
| `updated_at` | timestamptz | Server timestamp of last update |
| **Active constraint** | | At most one `is_active = true` per `(family_id, prompt_type)` — enforced in service layer |
| **Slot limit** | | Max 5 user-owned rows per `(family_id, prompt_type)` — enforced in service layer |

---

### Row Level Security Policies

All tables have RLS enabled. Policies are applied based on JWT claims `family_id` and `user_id` from the session.

**Helper functions (used by all RLS policies):**
- `current_family_id()` — extracts `family_id` JWT claim
- `current_user_id()` — extracts `user_id` JWT claim
- `is_platform_admin()` — returns true if current user has `is_platform_admin=true`

**Policy patterns:**
- **Family-scoped read:** Users can read all rows where `family_id = current_family_id()`, OR if `is_platform_admin() = true`
- **User-scoped write:** Users can insert/update only when `family_id = current_family_id()` AND (for wallet/sessions) `user_id = current_user_id()`
- **Immutable records:** `quiz_sessions` cannot be updated or deleted by non-admins; only platform admin can delete for data management
- **Platform admin bypass:** When `is_platform_admin() = true`, user can read/write/delete all rows on all tables

---

### Supabase Client Initialization

**Browser client** (`src/lib/supabaseClient.ts`):
- Initialized with anon key (public, scoped by RLS)
- Automatically passes session JWT if user is authenticated
- All database operations automatically respect RLS policies

**Server client** (API routes only):
- Initialized with service role key (admin, bypasses RLS)
- Only for platform admin operations (seeding, bulk deletes)
- Never exposed to browser

---

### Static Data

- **Pronunciation candidates:** `public/data/char_detail.json` — loaded via `src/lib/xinhua.ts`

### localStorage Schema (Legacy — Fully Retired)

**Phase 1 localStorage authentication has been replaced by Supabase Auth (Feature 4).** The following keys are no longer in use. All auth state is managed by the Supabase client session and React context (`AuthProvider`).

Retired keys: `sessionToken`, `selectedAvatarId`, `sessionCreatedAt`, `storedPinHash`, `lastSelectedAvatarId`, `migration_completed`.

### Database State Management (Retired)

PIN-scoped IndexedDB has been fully replaced by Supabase Postgres. The `currentDb` and `currentPinHash` in-memory state no longer exists. Data isolation is now enforced by Supabase RLS policies using JWT `app_metadata` claims (`family_id`, `user_id`).

---

### Normalization & Validation Rules

To prevent data quality drift, the system enforces the following invariants whenever flashcard content is written or updated. Normalization functions in `src/lib/flashcardLlm.ts` and related helpers implement these checks; any row failing them is dropped and logged.

- **Top-level payload shape:** must be an object with `meanings` (string array), `phrases` (array), and `examples` (array). Missing fields are treated as empty arrays.
- **Strings:** all text fields (`meanings` entries, `phrase.zh`, `phrase.pinyin`, `phrase.en`, `example.*`) must be non‑empty strings. Trim whitespace; if the trimmed value is empty, the row is invalid.
- **Boolean flags:** `include_in_fill_test` must be a boolean; non-boolean values default to `false`.
- **Array lengths:** there is no hard limit, but individual items are capped at 500 characters; anything longer is truncated or the item dropped to avoid performance issues.
- **Required fields for phrases/examples:** at minimum `zh` and `en` must be present. Rows lacking either are invalid.
- **No nulls or undefineds:** any `null` or `undefined` in a phrase/example object causes that object to be removed.
- **Key invariants:** `id` for `flashcardContents` is always `character|pronunciation`; the service layer protects this composite key from alteration.

These rules are the authoritative definition of “bad content” referred to elsewhere. They live here so agents implementing normalization know exactly what to enforce.

---

## 4) System Guarantees

These are the technical behaviors the system upholds. They are the factual basis behind the hard stops in `AI_CONTRACT.md §2` — refer there for agent-facing rules.

1. **Review screens read only from `flashcardContents`.** No path from `/words/review/*` reaches `/api/flashcard/generate`.
2. **Every value written to `flashcard_contents` has been normalized.** Schema shape is enforced before any Supabase write.
3. **Normalization drops bad content — it does not pass it through.** Invalid phrases/examples are removed; the rest of the payload proceeds.
4. **Pinyin rendering on review screens uses per-character ruby alignment (not inline or line-level pinyin):**
   - Each Hanzi character displays its pinyin token on a separate line directly above the character.
   - Pinyin is mapped only to Hanzi code points (CJK #3400–#4DBF, #4E00–#9FFF, #F900–#FAFF); non-Hanzi characters (punctuation, spaces, English) do not consume pinyin tokens.
   - Pinyin tokens are cleaned (punctuation removed via regex `/[^\p{L}\p{M}0-9]/gu`) and normalized to lowercase before display.
   - Pinyin appears italicized and in gray (#888) at a smaller font size than the associated Hanzi.
   - This alignment applies to character, phrase, and example text in flashcard review (`/words/review/flashcard`).
5. **Flashcard review conditionally displays phrases based on `include_in_fill_test` flag:**
   - Only phrases marked `include_in_fill_test: true` in `flashcardContents` are rendered as visible blocks on the flashcard.
   - If no phrases are marked for testing, a placeholder message ("No phrases included for testing") is displayed in place of the phrase-example blocks.
   - Character and meaning remain visible regardless of phrase-test inclusion; phrases are the only conditional element.
   - Parent component (`FlashcardReviewSection`) controls visibility toggle via `showPinyin` state (boolean); when `false`, pinyin spans are removed from DOM entirely (not hidden via CSS).
4. **`nextReviewAt` and `interval` are updated only by the deterministic grade functions in `scheduler.ts`.** No other write path exists.
5. **Due review pages wrap `WordsWorkspace` in `<Suspense>`.** Required for correct search-param handling in Next.js.

---

## 5) Error Handling

Required error behaviors for each failure mode. Do not improvise alternatives.

| Failure | Required Behavior |
|---|---|
| AI generation failure (`/api/flashcard/generate`) | Return error to admin UI. Do not fall back to cached or unvalidated output. Surface the error to the user. |
| Normalization failure (malformed AI payload) | Log the failure. Drop the affected phrase/example. Continue with remaining valid content. Never write a partial payload. |
| Supabase read failure (review screens) | Show a graceful error state in the UI. Do not re-fetch from AI. Session fails cleanly. |
| Missing `char_detail.json` entry | Return empty pronunciation candidates. Do not throw. UI handles the empty state. |

---

## 6) Docs Structure

### Companion-Doc Audit Requirement

Dated flow documents under `docs/architecture/` (e.g. `2026-02-27-content-admin-curation-flow.md`) are allowed to contain narrative, risks, and examples. However any behavioral rule or implementation guardrail appearing in a companion doc must also be copied verbatim into this `0_` file. Agents are required to perform a quick audit when a companion doc is created or edited and elevate missing rules to maintain a single source of truth.


### Authority order (highest to lowest)
1. `AI_CONTRACT.md` — agent rules and authority hierarchy
2. `docs/architecture/0_ARCHITECTURE.md` — system structure (this file)
3. `docs/architecture/0_BUILD_CONVENTIONS.md` — development conventions
4. `docs/architecture/0_PRODUCT_ROADMAP.md` — scope and priorities
5. Other `docs/architecture/*.md` — dated feature/domain behavior docs
6. `README.md`

---

### Folder Map

```
docs/
  AI_CONTRACT.md                          ← highest authority; agent rules
  architecture/
    0_ARCHITECTURE.md                     ← system structure (this file)
    0_BUILD_CONVENTIONS.md                ← code and doc conventions
    0_PRODUCT_ROADMAP.md                  ← scope, sprint, deferrals
    YYYY-MM-DD-short-description.md       ← dated feature/domain behavior docs
  feature-specs/
    YYYY-MM-DD-short-feature-name.md      ← one file per feature; drafted before build
  code-review/
    YYYY-MM-DD-short-scope.md             ← periodic code quality reviews
  fix-log/
    build-fix-log-YYYY-MM-DD-summary.md   ← one file per fix; created after merge
  archive/
    YYYY-MM/
      *.md                                ← superseded docs moved here
```

---

### Filing Rules by Doc Type

**`docs/architecture/` — system behavior docs**
- Create when: a feature or domain rule needs to be documented for future builders.
- Filename: `YYYY-MM-DD-short-description.md`
- Retire to `docs/archive/YYYY-MM/` when the content is superseded by a `0_` file update or a newer dated doc.

**`docs/feature-specs/` — pre-build feature specifications**
- Create when: a feature is prioritized in `0_PRODUCT_ROADMAP.md §Active Sprint` and needs a spec before implementation starts.
- Filename: `YYYY-MM-DD-short-feature-name.md`
- Content: problem statement, non-goals, behavior rules, edge cases, risks, test plan, acceptance criteria, open questions.
- Status: once the feature ships, add a `## Status: Shipped YYYY-MM-DD` header — do not delete. Move to `docs/archive/YYYY-MM/` after one sprint cycle.
- Authority: feature specs are implementation guidance only. If a spec conflicts with `0_ARCHITECTURE.md`, the spec loses — update the spec before building.

**`docs/code-review/` — periodic code quality reviews**
- Create when: a scheduled or triggered review of code quality, compliance, or architectural drift is conducted.
- Filename: `YYYY-MM-DD-short-scope.md` (e.g., `2026-02-27-code-compliance-review.md`)
- Content: scope, findings, recommended actions, severity ratings.
- Authority: findings are advisory. Accepted findings that produce rule changes must be written into the relevant `0_` doc — the review file itself is not authoritative.
- Do not move to archive — keep all code reviews in `docs/code-review/` as a permanent audit trail.

**`docs/fix-log/` — post-merge fix records**
- Create when: any bug fix, refactor, structural correction, or regression prevention is merged. See `AI_CONTRACT.md §5` for full policy and template.
- Filename: `build-fix-log-YYYY-MM-DD-short-kebab-summary.md`
- Do not move to archive — fix logs are a permanent record.

---

### Archive rule
If archived content conflicts with active docs or current implementation, active docs and implementation win. Archive material is historical context only — it is never justification for a design choice.

---

## 7) Development Conventions

All code must follow the conventions in `0_BUILD_CONVENTIONS.md`:

- **Bilingual UI:** All user-facing text in `*.strings.ts` files (see §2)
- **Strings extraction:** Never hardcode copy in JSX
- **TypeScript strict mode:** Enabled; no `any` types; proper type annotations required
- **Type file organization:** Types in feature-scoped `[feature].types.ts` files (see `0_BUILD_CONVENTIONS.md §1a`)
  - Each feature directory owns its type definitions in an adjacent `*.types.ts` file
  - Navigation/layout types in `shared/shell.types.ts`
  - Central `shared/words.shared.types.ts` acts as re-export hub for backward compatibility
  - Each type file has a companion `*.types.test.ts` for validation
- **Component file structure:** Feature-scoped route + page + shared-contract structure
- **Test coverage required:** All new features must include unit and integration tests

