# ARCHITECTURE

_Last updated: 2026-03-10_ (Content model redesign: platform admin / family split; pack purchase flow; slot-based tagging; content_status lifecycle; prompt management restricted to platform admin)

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
- AI generation is scoped to **platform admin authoring workflows only** — family users cannot trigger AI generation under any circumstance.
- Flashcard content is keyed by `character|pronunciation` and normalized before persistence.
- Fill-test eligibility is derived from saved phrase/example rows and `include_in_fill_test` flags.
- Unsafe content and malformed payloads are dropped during normalization before they can be persisted.
- A word is only reviewable when `content_status = 'ready'`. Words with `content_status = 'pending'` are excluded from all review queues.

---

### Platform Admin Flow (Chengyuan only)

```
1. Manage textbooks → /admin/textbooks  → create textbooks, define slot labels
                                           → Supabase `textbooks` table
2. Add Hanzi        → /words/add        → Supabase `words` table
                                           Tagging is MANDATORY for admin (4 levels):
                                           - Level 1: Textbook (always required)
                                           - Level 2: Slot 1 (required if
                                             textbook.slot_1_label is non-null)
                                           - Level 3: Slot 2 (always optional)
                                           - Level 4: Slot 3 (always optional)
3. Adjust prompts   → /admin/prompts    → edit/version AI prompt templates
                                           → Supabase `prompt_templates` table
4. Curate content   → /words/admin      → /api/flashcard/generate + manual edits
                                           → Supabase `flashcard_contents` table
                                           → flip words.content_status → 'ready'
5. Author packs     → /admin/packs      → DEFERRED (schema exists; UI not built)
                                           see 0_PRODUCT_ROADMAP.md §3 Deferred
6. Process queue    → /admin/queue      → words pending content across all families
                                           → curate content, flip content_status
                                           → 'ready' per family
7. Fulfill requests → /admin/requests   → family enrichment requests
                                           → add phrases to flashcard_contents
                                           → flip content_requests.status
                                           → 'fulfilled'
8. Review           → /words/review, /words/review/flashcard,
                       /words/review/fill-test → reads persisted data only
```

---

### Family User Flow (Parent + Child)

> Pack purchase flow is deferred to a future phase. See `0_PRODUCT_ROADMAP.md §3 Deferred`.
> The `packs`, `pack_words`, `pack_flashcard_contents`, and `pack_purchases` tables exist
> in the schema but no family-facing purchase UI is built yet.

```
Add words manually (Parent only)
  Add Hanzi   → /words/add  → words (content_status = 'pending')
                               Tagging is OPTIONAL for family parents:
                               textbook/slot values may be left unset.
                               Untagged words land as pending with no
                               lesson association.
              → Admin sees word in /admin/queue → curates content
              → flips content_status → 'ready'
              → word becomes reviewable

Request enrichment (Parent only)
  Flag a character for more content → content_requests row written
                                    → admin fulfills → phrases added
                                    to flashcard_contents
                                    → content_requests.status → 'fulfilled'

Review (Child + Parent — role-restricted per permission matrix)
  /words/review, /words/review/flashcard, /words/review/fill-test
  → reads persisted data only; content_status = 'ready' required
```

---

### Ingestion Rules

These rules govern all character ingestion via `/words/add`:

1. Input accepts free text — only Hanzi characters are extracted. Non-Hanzi symbols (letters, punctuation, numbers, emoji) are ignored.
2. Multi-character strings are split into individual Hanzi characters.
3. Duplicate characters within the same submission are removed before writing.
4. Characters already present in the `words` table are skipped — no overwrite occurs.
5. New records are initialized with `content_status = 'pending'`, `content_source = null`, `repetitions = 0`, `next_review_at = 0`, no fill-test content.
6. A bilingual status message is shown after every submission covering three states: nothing added, all added, some added and some skipped.
7. Add flow does not auto-generate flashcard content — content curation is a separate step.

**Tagging behaviour differs by role:**

**Platform admin (mandatory tagging):**
8. An "Assign to Lesson" section is always visible and required for admin submissions.
9. Tagging uses a 4-level hierarchy: Textbook (level 1, always required) → Slot 1 value (level 2, required if `textbook.slot_1_label` is non-null) → Slot 2 value (level 3, always optional) → Slot 3 value (level 4, always optional). The UI renders only slot fields whose labels are defined on the selected textbook.
10. If no textbook is selected, submission is blocked with an inline error. If slot 1 is defined on the textbook but no slot 1 value is provided, submission is also blocked.
11. On submission, a `lesson_tags` row is created (or matched if identical slot values already exist for this family + textbook), and `word_lesson_tags` rows are written for all newly added words.
12. Skipped (already-existing) words do not receive a new tag assignment.

**Family parent (optional tagging):**
13. An "Assign to Lesson" section is available but collapsible and optional.
14. If the section is collapsed or untouched, no tag is applied and no validation is performed.
15. If the section is open, textbook selection (level 1) is required before submitting. Slot 1 value is required if `textbook.slot_1_label` is non-null. Slot 2 and slot 3 values are always optional.
16. Tag assignment follows the same `lesson_tags` / `word_lesson_tags` write pattern as admin if a textbook is selected.

**Children cannot access `/words/add`** — the route is blocked; the add UI is not visible to child profiles.

---

### All Characters Inventory Rules

These rules govern the inventory view at `/words/all`:

1. The page renders all rows from the `words` table scoped to the current family.
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
11. The page does not generate or edit flashcard/admin content.
12. The page does not deduplicate historical duplicate rows; it renders stored data as-is.
13. The page does not paginate or virtualize large datasets.
14. The page owns display/sorting behavior only; scheduler logic remains in `scheduler.ts`.
15. A **Lessons column** displays slot-value tag pills for non-child roles. Pill text is derived by joining non-null slot values with `·` separator (e.g. `Blingo · Grade 1 · Unit 3`). Multiple tags on one word stack vertically; no tags = empty cell.
16. A **filter bar** (Textbook + slot value dropdowns) is shown for non-child roles when tag data exists. Slot dropdowns are rendered only for slots with non-null labels on the selected textbook. Cascade dropdowns reset lower slots on parent-slot change.
17. Filter logic is AND: a word is shown only if it matches all active filter values.
18. Filter state persists via URL search params. A [Clear Filters] button resets all filters.
19. When filters are active and no words match, "No characters match the selected filters." is shown with a Clear Filters link.
20. A `content_status` indicator column is visible to platform admin only: shows `pending` or `ready` per word.

---

### Platform Admin Content Curation Rules (`/words/admin`)

These rules govern platform admin content curation. Platform admin has full AI generation access.

1. Curation targets are `character|pronunciation` pairs derived from `words.hanzi` plus Xinhua pronunciation discovery.
2. The page may load, draft, normalize, and persist flashcard content in `flashcard_contents`.
3. The page must not write to `words` scheduler fields or run review sessions.
4. **Saving content and approving a word are two separate, distinct actions.**
   - **Save**: persists the current `flashcard_contents` row. Does NOT change `words.content_status`.
   - **Approve**: a dedicated Approve button (visible only when the character has ≥1 meaning, ≥1 phrase, and ≥1 example saved) flips `words.content_status → 'ready'` and sets `words.content_source = 'admin_curated'`. Only the Approve action triggers this flag change.
   - Until Approve is clicked, a saved character remains in `saved` display state, not `ready`.
5. Generation calls are routed through `/api/flashcard/generate` (no direct provider calls from UI code).
6. Every persisted save path must pass through normalization before write.
7. Invalid draft rows are dropped during normalization; unsaved drafts are not review content.
8. `include_in_fill_test` is persisted immediately on toggle and directly controls testing eligibility.
9. **Content-quality buckets** (admin curation table view — distinct from `words.content_status`):
   These buckets describe the completeness and approval status of a curation target.
   They are display states in the admin UI, not DB fields.
   - `pending`: no `flashcard_contents` row saved yet for this target
   - `saved`: a `flashcard_contents` row exists, but `words.content_status` is not yet `'ready'`
   - `ready`: `words.content_status = 'ready'` (Approve has been explicitly clicked)

   The Approve button is enabled only when the saved content has ≥1 meaning + ≥1 phrase + ≥1 example.
   Saving content alone never flips `content_status`; only explicit Approve does.

10. **Cross-family curation**: When a platform admin navigates from the Content Queue with `?curateWordId=…&curateFamilyId=…&curateHanzi=…`, the target hanzi is automatically injected into the admin curation table. The admin curates content inline in the table (no separate panel). The Approve button for an injected cross-family target calls `setWordContentReadyById(curateWordId)` (not the own-family path) and then clears the URL params.
10. The admin curation page shows **all** words for the current family regardless of `content_status`,
    so the admin can see what is pending and what is already ready in one view.
    Pending words (no `flashcard_contents` row yet) appear as empty targets awaiting generation.
11. Preload generation skips targets that already have persisted content and continues non-fatally on per-target failures.
12. Characters with no dictionary pronunciation are skipped with notice; this is not a fatal load error.
13. Preload batch execution uses a fixed concurrency of 3 (`Promise.allSettled`). Batch size is capped at 3 to avoid saturating the AI provider. No per-character retry — a failed character is counted and skipped; the loop continues. The completion notice reports total succeeded and total failed counts. Batch size must not be increased without validating provider rate limits.
14. A **tag filter bar** (Textbook + slot dropdowns) is displayed above the character list when tag data exists. Same AND logic and cascade behavior as `/words/all`.
15. Characters with no tags are hidden when any filter is active.

---

### Family Content Admin Rules (`/words/admin`)

These rules govern family parent access to the content admin page. Family users have no AI generation access.

1. The page displays all words where `content_status = 'ready'` for the current family, regardless of `content_source`.
2. Words with `content_status = 'pending'` are shown in a separate "Awaiting Content" section — visible but not editable.
3. `include_in_fill_test` toggle per phrase is available and persists immediately — this is the primary family control.
4. Families may add, edit, and delete meanings, phrases, and examples in their own `flashcard_contents` rows — they own their copy.
5. **No AI generation controls are shown** — regenerate buttons, preload buttons, and any `/api/flashcard/generate` call paths are invisible and inaccessible to family users.
6. The page must not write to `words` scheduler fields.
7. Content source (`pack` vs `admin_curated`) is not surfaced in the family UI — families see a uniform editing experience regardless of how content arrived.
8. A **Request More** action is available per character: opens a free-text note field and submits a `content_requests` row. Only one open (non-fulfilled) request per character per family is allowed at a time.

---

### Due Review Queue Rules

These rules govern the due queue view at `/words/review`:

1. `/words` redirects to `/words/review`, making due review the operational review entry route.
2. Due eligibility requires **both** conditions:
   - `content_status = 'ready'` — words with `content_status = 'pending'` are excluded from the due queue entirely
   - `nextReviewAt <= now` OR `nextReviewAt` is missing/zero
3. `getDueWords()` must apply the `content_status = 'ready'` filter at the query level — not derived in-memory after fetch.
4. The page derives and displays due-list presentation state only (count, sort order, familiarity, action availability).
5. Fill-test availability is derived from saved `flashcard_contents` and attached in-memory to due rows; this page does not persist fill-test content.
6. The page routes to `/words/review/flashcard` and `/words/review/fill-test`, optionally scoped by `wordId`.
7. This page must not grade words, mutate scheduler fields, create/delete words, or persist admin content edits.
8. Due-table sorting is client-side; default due ordering uses `nextReviewAt` then `createdAt` as tie-breaker.
9. Fill-test start/action controls are enabled only when a due row has a usable derived `fillTest`.
10. Any change to fill-test eligibility or semantics must be reflected here and in the Content Admin Curation Rules concurrently. Failure to update both is a documentation gap.

---

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

---

### Quiz Results Rules (`/words/results`)

These rules govern the results/history view for session data reporting:

1. Results page is **view-only and read-only** — no modifications to `quizSessions` are performed here except for the explicit "Clear History" action.
2. The page displays all completed fill-test sessions in a table/list sorted by `createdAt` (newest first).
3. Each session row displays: Session Date, % Fully Correct, % Failed, % Partial, Duration, Tested Count, Tested Characters, Failed Count, Failed Characters, Coins Earned.
4. **Accuracy calculation rules:**
   - `% Fully Correct = (fullyCorrectCount / totalGrades) × 100`, rounded to nearest integer
   - `% Failed = (failedCount / totalGrades) × 100`, rounded to nearest integer
   - `% Partial = (partiallyCorrectCount / totalGrades) × 100`, rounded to nearest integer
   - Only `grade="easy"` counts as fully correct; `grade="hard"` and `grade="again"` do not contribute to accuracy
   - The three percentages must sum to 100% (within ±1% rounding tolerance)
5. **Character list derivation:**
   - Tested characters = unique hanzi from all grade entries in `gradeData`, deduplicated and ordered by first appearance
   - Failed characters = unique hanzi from grade entries where `grade="again"` only
   - Character lists are displayed as comma-separated Hanzi with truncation to first 8–10 characters plus "…" if longer
6. **Summary card calculations:** When multiple sessions exist, compute weighted averages across all sessions:
   - Total Sessions = count of all records
   - Overall % Fully Correct = (sum of fullyCorrectCounts / sum of totalGrades) × 100
   - Overall % Failed and Overall % Partial calculated similarly
   - Total Characters Tested = sum of unique character counts across all sessions
   - Total Duration = sum of durationSeconds, displayed as hh:mm:ss
7. **Clear History action:**
   - Single destructive action button available only when sessions exist
   - Hidden for child profiles — only parents and platform admins can clear quiz history
   - Requires confirmation dialog before deletion
   - On confirmation, all records in `quizSessions` are deleted permanently with no undo
   - Table and summary cards clear immediately upon successful deletion
8. **Empty state:** When no sessions exist, display a placeholder message directing users to start a review session; hide all table and summary UI elements.

---

### Login & Avatar Protection Rules (`/login`)

These rules govern the two-layer authentication and session protection system:

1. Login page (`/login`) and registration page (`/register`) are **not protected by session guard** — they are always accessible for authentication flows.
2. All other pages and routes require a valid Supabase session to access; unauthenticated requests redirect to `/login`.
3. **Two-layer authentication model:**
   - **Layer 1 — Family Authentication (Supabase Auth):** One Supabase Auth account per family. Standard email + password. Supabase handles token issuance, refresh, and recovery.
   - **Layer 2 — Profile Selection + PIN (App Layer):** After Layer 1, the user sees their family's profile cards and taps a profile. A 4-digit PIN entry screen renders. The app hashes the PIN and compares it to `users.pin_hash`. On match, app session context is set (`family_id`, `user_id`, `role`) and the JWT is enriched with these claims.
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
   - PIN verification is performed server-side via `/api/auth/pin-verify`
   - Layer 2 PIN is a profile switcher, not the primary authentication gate
7. **Lockout rules:**
   - After 5 consecutive failed PIN attempts, the profile is locked
   - Locked message: "Too many attempts. Please ask a parent to unlock."
   - Parent unlock: re-enter Layer 1 (email + password) to reset the failed attempt counter
   - Successful PIN entry resets `failed_pin_attempts` to 0
8. **Avatars:**
   - 8 avatar options: `bubble_tea_excited_1`, `cake_sleep_1`, `donut_wink_1`, `rice_ball_sleep_1`, `zongzi_smile_1`, `ramen_excited_1`, `babaorice_smile_1`, `bun_wink_1`
   - Avatar stored as `avatar_id` on the `users` row; displayed in nav bar when logged in
9. **Session persistence:**
   - Supabase Auth manages JWT lifecycle
   - App session context (`family_id`, `user_id`, `role`) is derived from JWT `app_metadata` claims
   - `AuthProvider` React context exposes session state to all components
   - `SessionGuard` wraps protected routes and redirects to `/login` when no valid session exists
10. **Logout flow:**
    - Logout calls `supabase.auth.signOut()` to invalidate the Supabase session
    - App session context is cleared; user is redirected to `/login`
11. **Data isolation (critical):**
    - All data is scoped by `family_id` in Supabase Postgres with Row Level Security policies
    - Words, flashcard content, quiz sessions, wallet, and all learning data are **never shared** across families
    - Within a family, `user_id`-scoped tables (wallet, quiz_sessions) isolate per-profile data
    - Platform admin (`is_platform_admin = true`) bypasses RLS for data management
    - No cross-tenant data leakage is possible at the database layer

---

### Role-Based Routing Rules

Route access is enforced by client-side RouteGuard using session role. Blocked routes are hidden from navigation. Direct URL access to a blocked route redirects to `/words/review` with no error message.

Role enforcement is UI-only; database operations are protected by RLS policies at the data layer.

**In-page action restrictions (child role):**
- `/words/all`: Reset and Delete buttons are hidden.
- `/words/results`: Clear History button is hidden.

**Permission matrix — `/words/*` routes:**

| Route | Child | Parent | Platform Admin |
|---|---|---|---|
| `/words/add` | ❌ | ✅ | ✅ |
| `/words/all` | ✅ | ✅ | ✅ |
| `/words/admin` | ❌ | ✅ | ✅ |
| `/words/prompts` | ❌ | ❌ | ✅ |
| `/words/results` | ✅ | ✅ | ✅ |
| `/words/review` | ✅ | ✅ | ✅ |
| `/words/review/flashcard` | ✅ | ✅ | ✅ |
| `/words/review/fill-test` | ✅ | ❌ | ✅ |
| `/words/debug` | ❌ | ❌ | ✅ |

**Permission matrix — `/admin/*` routes (platform admin only):**

| Route | Child | Parent | Platform Admin |
|---|---|---|---|
| `/admin/textbooks` | ❌ | ❌ | ✅ |
| `/admin/packs` | ❌ | ❌ | ✅ |
| `/admin/queue` | ❌ | ❌ | ✅ |
| `/admin/requests` | ❌ | ❌ | ✅ |
| `/admin/prompts` | ❌ | ❌ | ✅ |

All `/admin/*` routes redirect non-platform-admin users to `/words/review`.

**Family nav items** (what appears in navigation per role):

| Nav item | Child | Parent |
|---|---|---|
| Due Review | ✅ | ✅ |
| All Characters | ✅ | ✅ |
| Quiz Results | ✅ | ✅ |
| Add Characters | ❌ | ✅ |
| Content Admin | ❌ | ✅ |

`/words/prompts` and all `/admin/*` routes are **never shown in family nav** regardless of role.

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

- `src/app/**` communicates with `src/app/api/**` via **fetch calls only** — no direct imports.
- `src/app/api/**` is invoked only from platform admin authoring flows — never from family user flows or review execution paths.
- **All database operations use `src/lib/supabase-service.ts`** — the single service module for all data access.
  - Uses the browser Supabase client (`supabase` from `supabaseClient.ts`), which passes the session JWT automatically.
  - RLS policies scope all reads/writes to the current family/user via JWT `app_metadata` claims.
  - Service functions handle camelCase (TypeScript) ↔ snake_case (Postgres) conversion.
  - For inserts requiring `family_id`/`user_id`, the service layer reads these from the Supabase session `app_metadata`.
  - API routes import `getServerSupabaseClient()` (service role, for admin operations only).
  - **No direct IndexedDB/Dexie operations** — IndexedDB is fully retired; `src/lib/db.ts` has been deleted.
- `src/lib/scheduler.ts` has no dependency on UI or API layers — it is a pure domain module.
- AI output flows through normalization in `src/lib/flashcardLlm.ts` before reaching Supabase writes.

> For the agent rules that enforce these boundaries (what to never do), see `AI_CONTRACT.md §2`.

---

## 3) Data Schema

### Supabase Postgres Tables

The application stores all persistent data in Supabase Postgres. Row Level Security (RLS) policies enforce family-scoped data isolation. All tables include RLS enabled.

---

**`families` table** — one row per tenant

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `name` | text | Family display name |
| `created_at` | timestamptz | Server timestamp |

---

**`users` table** — all human users (parents and children)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `family_id` | uuid | FK → `families.id` |
| `auth_user_id` | uuid (nullable) | Links to Supabase Auth user; non-null for parents, null for children |
| `name` | text | Display name |
| `role` | text | `'parent'` or `'child'` |
| `pin_hash` | text (nullable) | scrypt hash of 4-digit PIN; null for parents |
| `is_platform_admin` | boolean | True only for Chengyuan; bypasses RLS on all tables |
| `failed_pin_attempts` | integer | Incremented on wrong PIN; reset on success; locked at 5 |
| `avatar_id` | text (nullable) | One of 8 valid filename stems |
| `created_at` | timestamptz | Server timestamp |

---

**`words` table** — one row per Hanzi character, scoped to family

| Field | Type | Notes |
|---|---|---|
| `id` | text | Primary key; `makeId()` pattern |
| `family_id` | uuid | FK → `families.id` |
| `hanzi` | text | Single Hanzi character |
| `pinyin` | text (nullable) | Optional pronunciation |
| `meaning` | text (nullable) | Optional translation |
| `repetitions` | integer | SRS repetition count (default: 0) |
| `interval_days` | numeric | Current SRS interval in days (default: 0) |
| `ease` | numeric | Scheduler stability value (default: 21) |
| `next_review_at` | bigint | Unix ms timestamp; 0 = immediately due |
| `review_count` | integer | Count of flashcard review attempts (default: 0) |
| `test_count` | integer | Count of fill-test attempts (default: 0) |
| `fill_test` | jsonb (nullable) | FillTest object; populated after content curation |
| `content_status` | text | `'pending'` or `'ready'` (default: `'pending'`). **Words are only reviewable when `'ready'`.** |
| `content_source` | text (nullable) | `'pack'` or `'admin_curated'`; null when pending |
| `created_at` | timestamptz | Server timestamp |
| **Unique constraint** | | `(family_id, hanzi)` — no duplicate characters per family |

**content_status lifecycle:**
- `pending` → word added (manually or copied from pack pre-content), not reviewable
- `ready` → flashcard content exists in `flashcard_contents`; word is reviewable

---

**`flashcard_contents` table** — curated content per character+pronunciation pair, scoped to family

| Field | Type | Notes |
|---|---|---|
| `id` | text | `{character}\|{pronunciation}` |
| `family_id` | uuid | FK → `families.id` |
| `meanings` | jsonb | String array of definitions |
| `phrases` | jsonb | Array of Phrase objects: `{ zh, pinyin, en, include_in_fill_test }` |
| `examples` | jsonb | Array of Example objects: `{ zh, pinyin, en, include_in_fill_test }` |
| `content_source` | text | `'pack'` or `'admin_curated'` (default: `'admin_curated'`). Provenance only — does **not** restrict family edit rights. |
| `updated_at` | timestamptz | Server timestamp |
| **Primary key** | | `(id, family_id)` — composite, enforces scoped uniqueness |

---

**`quiz_sessions` table** — completed fill-test session records, immutable audit

| Field | Type | Notes |
|---|---|---|
| `id` | text | Primary key |
| `user_id` | uuid | FK → `users.id` |
| `family_id` | uuid | FK → `families.id` (denormalized for RLS efficiency) |
| `created_at` | timestamptz | Session completion timestamp |
| `session_type` | text | Currently `'fill-test'` |
| `grade_data` | jsonb | Array of `{ wordId, hanzi, grade, timestamp }` |
| `fully_correct_count` | integer | Count of `grade = 'easy'` |
| `failed_count` | integer | Count of `grade = 'again'` |
| `partially_correct_count` | integer | Count of `grade = 'good'` or `'hard'` |
| `total_grades` | integer | Sum of all grades |
| `duration_seconds` | integer | Elapsed session time |
| `coins_earned` | integer | Coins earned this session |
| **RLS Guarantee** | | Insert-only for non-admins; immutable audit record |

---

**`wallets` table** — cumulative coin balance, one row per user

| Field | Type | Notes |
|---|---|---|
| `user_id` | uuid | Primary key → `users.id` |
| `family_id` | uuid | FK → `families.id` (denormalized for RLS efficiency) |
| `total_coins` | integer | Cumulative coins across all sessions (default: 0) |
| `last_updated_at` | timestamptz | Last wallet update timestamp |
| `version` | integer | Schema version (currently 1) |

---

**`prompt_templates` table** — configurable LLM prompt templates (platform admin only)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `family_id` | uuid (nullable) | FK → `families.id`; null for platform default rows |
| `user_id` | uuid (nullable) | FK → `users.id`; null for platform default rows |
| `prompt_type` | text | One of: `full`, `phrase`, `example`, `phrase_details`, `meaning_details` |
| `slot_name` | text | User-visible name; default rows always named `"Default"` |
| `prompt_body` | text | System prompt sent to AI provider |
| `is_active` | boolean | True = currently active slot; at most one per `(family_id, prompt_type)` |
| `is_default` | boolean | True only for platform-wide default rows (`family_id = null`) |
| `created_at` | timestamptz | Server timestamp |
| `updated_at` | timestamptz | Last update timestamp |
| **Active constraint** | | At most one `is_active = true` per `(family_id, prompt_type)` — enforced in service layer |
| **Slot limit** | | Max 5 rows per `(family_id, prompt_type)` — enforced in service layer |

---

**`textbooks` table** — curriculum/literary textbooks, platform-managed or family-private

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `name` | text | Human-readable textbook name |
| `is_shared` | boolean | `true` = platform-level, visible to all families; `false` = family-private |
| `family_id` | uuid (nullable) | FK → `families.id`; null when `is_shared = true` |
| `created_by` | uuid (nullable) | FK → `auth.users.id` |
| `slot_1_label` | text (nullable) | Label for hierarchy slot 1, e.g. `"Grade"` or `"Collection"`. Null = slot unused. |
| `slot_2_label` | text (nullable) | Label for hierarchy slot 2, e.g. `"Unit"` or `"Work"`. Null = slot unused. |
| `slot_3_label` | text (nullable) | Label for hierarchy slot 3, e.g. `"Lesson"`. Null = slot unused. |
| `created_at` | timestamptz | Server timestamp |

Slot label examples by textbook type:

| Textbook | slot_1_label | slot_2_label | slot_3_label |
|---|---|---|---|
| Blingo | Grade | Unit | Lesson |
| 唐诗三百首 | Collection | Work | null |
| Custom family book | Chapter | null | null |

---

**`lesson_tags` table** — unique named groupings per family per textbook using flexible slot values

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `family_id` | uuid | FK → `families.id`; cascades on delete |
| `textbook_id` | uuid | FK → `textbooks.id`; cascades on delete |
| `slot_1_value` | text (nullable) | e.g. `"Grade 1"` or `"五言绝句"`. Required if `textbook.slot_1_label` is non-null (enforced at application layer). |
| `slot_2_value` | text (nullable) | e.g. `"Unit 3"` or `"静夜思"`. Always optional. |
| `slot_3_value` | text (nullable) | e.g. `"Lesson 2"`. Always optional. |
| `created_at` | timestamptz | Server timestamp |
| **Unique index** | | `(family_id, textbook_id, slot_1_value, slot_2_value, slot_3_value)` — note: Postgres treats nulls as distinct in unique indexes; application layer must deduplicate before insert (see Implementation Notes). |

---

**`word_lesson_tags` table** — family-scoped junction table assigning lesson tags to words

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `word_id` | text | FK → `words.id`; cascades on delete |
| `lesson_tag_id` | uuid | FK → `lesson_tags.id`; cascades on delete |
| `family_id` | uuid | FK → `families.id`; cascades on delete |
| `created_at` | timestamptz | Server timestamp |
| **Unique constraint** | | `(word_id, lesson_tag_id)` — a word cannot be tagged to the same lesson twice |

---

**`packs` table** — platform-level content bundles, admin-authored

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `textbook_id` | uuid | FK → `textbooks.id` |
| `name` | text | Display name, e.g. `"Blingo · Grade 1 · Unit 3"` — stored explicitly for display without joins |
| `slot_1_value` | text (nullable) | Slot 1 value for this pack |
| `slot_2_value` | text (nullable) | Slot 2 value for this pack |
| `slot_3_value` | text (nullable) | Slot 3 value for this pack |
| `price` | numeric(10,2) | Purchase price; 0.00 for free packs during pilot |
| `status` | text | `'draft'` or `'published'`; only published packs are visible to families |
| `created_at` | timestamptz | Server timestamp |
| `updated_at` | timestamptz | Last update timestamp |

---

**`pack_words` table** — words belonging to a pack (platform-level, no family_id)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `pack_id` | uuid | FK → `packs.id`; cascades on delete |
| `hanzi` | text | Hanzi character |
| `order_index` | integer | Learning order within the pack (default: 0) |
| **Unique constraint** | | `(pack_id, hanzi)` — a character appears at most once per pack |

---

**`pack_flashcard_contents` table** — curated content belonging to a pack (platform-level, no family_id)

| Field | Type | Notes |
|---|---|---|
| `id` | text | `{character}\|{pronunciation}\|{pack_id}` |
| `pack_id` | uuid | FK → `packs.id`; cascades on delete |
| `character` | text | Hanzi character |
| `pronunciation` | text | Pinyin pronunciation |
| `meanings` | jsonb | String array of definitions |
| `phrases` | jsonb | Array of Phrase objects |
| `examples` | jsonb | Array of Example objects |
| `updated_at` | timestamptz | Last update timestamp |
| **Primary key** | | `(id, pack_id)` |

---

**`pack_purchases` table** — family purchase records

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `family_id` | uuid | FK → `families.id`; cascades on delete |
| `pack_id` | uuid | FK → `packs.id` |
| `purchased_at` | timestamptz | Purchase timestamp |
| `price_paid` | numeric(10,2) | Price at time of purchase; 0.00 for free packs |
| **Unique constraint** | | `(family_id, pack_id)` — one purchase per family per pack; prevents double-copy on retry |

**On-purchase copy contract** (must execute atomically in a single transaction):
1. Write `pack_purchases` row (unique constraint is the idempotency guard)
2. For each `pack_words` row: `INSERT INTO words ... ON CONFLICT (family_id, hanzi) DO UPDATE SET content_status = 'ready', content_source = 'pack'` — words already added manually are upgraded; scheduler fields are preserved
3. For each `pack_flashcard_contents` row: `INSERT INTO flashcard_contents ... ON CONFLICT (id, family_id) DO NOTHING` — existing family edits are never overwritten
4. Rollback entire transaction on any failure — no partial state

---

**`content_requests` table** — family-initiated enrichment requests to platform admin

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `family_id` | uuid | FK → `families.id`; cascades on delete |
| `requested_by` | uuid | FK → `users.id`; the specific parent who submitted |
| `hanzi` | text | Character for which more content is requested |
| `textbook_id` | uuid (nullable) | FK → `textbooks.id`; optional context |
| `note` | text (nullable) | Free-text note from family to admin |
| `status` | text | `'pending'`, `'in_progress'`, or `'fulfilled'` (default: `'pending'`) |
| `created_at` | timestamptz | Request creation timestamp |
| `fulfilled_at` | timestamptz (nullable) | Set when status = `'fulfilled'`; must be null otherwise |
| **DB constraint** | | `fulfilled_at` is non-null **if and only if** `status = 'fulfilled'` — enforced at DB level. Service layer must set both fields together in one update. |

**Fulfillment flow:** Admin adds phrases directly to the family's `flashcard_contents` row for `character|pronunciation`, then sets `status = 'fulfilled'` and `fulfilled_at = now()` in a single update call.

Only one open (non-fulfilled) request per `(family_id, hanzi)` is allowed — enforced at application layer before insert.

---

### Row Level Security Policies

All tables have RLS enabled. Policies are applied based on JWT claims `family_id` and `user_id`.

**Helper functions:**
- `current_family_id()` — extracts `family_id` JWT claim
- `current_user_id()` — extracts `user_id` JWT claim
- `is_platform_admin()` — returns true if current user has `is_platform_admin = true`

**Policy patterns:**
- **Family-scoped read/write:** rows where `family_id = current_family_id()`, OR `is_platform_admin() = true`
- **User-scoped write:** `family_id = current_family_id()` AND `user_id = current_user_id()` (wallet, quiz_sessions)
- **Immutable records:** `quiz_sessions` cannot be updated or deleted by non-admins
- **Platform-level tables:** `packs`, `pack_words`, `pack_flashcard_contents` — readable by all authenticated users; writable by platform admin only
- **Platform admin bypass:** `is_platform_admin() = true` allows read/write/delete on all tables

---

### Supabase Client Initialization

**Browser client** (`src/lib/supabaseClient.ts`): anon key, scoped by RLS, auto-passes JWT.

**Server client** (API routes only): service role key, bypasses RLS. Only for platform admin operations. Never exposed to browser.

---

### Static Data

- **Pronunciation candidates:** `public/data/char_detail.json` — loaded via `src/lib/xinhua.ts`

---

### Normalization & Validation Rules

All flashcard content must pass normalization before any Supabase write. Functions in `src/lib/flashcardLlm.ts` implement these checks; failing rows are dropped and logged.

- **Top-level payload shape:** object with `meanings` (string array), `phrases` (array), `examples` (array). Missing fields treated as empty arrays.
- **Strings:** all text fields must be non-empty after trimming. Empty trimmed value = invalid row.
- **Boolean flags:** `include_in_fill_test` must be boolean; non-boolean defaults to `false`.
- **Array item length:** individual items capped at 500 characters; longer items are truncated or dropped.
- **Required fields:** phrases and examples require at minimum `zh` and `en`. Rows lacking either are invalid.
- **No nulls or undefineds:** any `null` or `undefined` in a phrase/example object causes that object to be removed.
- **Key invariants:** `flashcard_contents.id` is always `character|pronunciation`; the service layer protects this composite key from alteration.

---

## 4) System Guarantees

1. **Review screens read only from `flashcard_contents`.** No path from `/words/review/*` reaches `/api/flashcard/generate`.
2. **Only words with `content_status = 'ready'` appear in the due review queue.** `getDueWords()` filters at the query level.
3. **Every value written to `flashcard_contents` has been normalized.** Schema shape is enforced before any Supabase write.
4. **Normalization drops bad content — it does not pass it through.** Invalid phrases/examples are removed; the rest of the payload proceeds.
5. **AI generation is never triggered from family user sessions.** `/api/flashcard/generate` is only callable from platform admin contexts; RLS and route guards enforce this at both UI and data layers.
6. **Pinyin rendering on review screens uses per-character ruby alignment:**
   - Each Hanzi character displays its pinyin token directly above it.
   - Pinyin is mapped only to Hanzi code points; non-Hanzi characters do not consume pinyin tokens.
   - Pinyin tokens are cleaned and normalized to lowercase before display.
   - Pinyin appears italicized and in gray (#888) at a smaller font size than the associated Hanzi.
7. **Flashcard review conditionally displays phrases based on `include_in_fill_test` flag:**
   - Only phrases marked `include_in_fill_test: true` are rendered on the flashcard.
   - If no phrases are marked for testing, "No phrases included for testing" is displayed.
   - Pinyin visibility is controlled by `showPinyin` state; when false, pinyin spans are removed from DOM entirely (not hidden via CSS).
8. **`nextReviewAt` and `interval` are updated only by the deterministic grade functions in `scheduler.ts`.** No other write path exists.
9. **Due review pages wrap `WordsWorkspace` in `<Suspense>`.** Required for correct search-param handling in Next.js.

---

## 5) Error Handling

Required error behaviors for each failure mode. Do not improvise alternatives.

| Failure | Required Behavior |
|---|---|
| AI generation failure (`/api/flashcard/generate`) | Return error to admin UI. Do not fall back to cached or unvalidated output. Surface the error to the user. |
| Normalization failure (malformed AI payload) | Log the failure. Drop the affected phrase/example. Continue with remaining valid content. Never write a partial payload. |
| Supabase read failure (review screens) | Show a graceful error state in the UI. Do not re-fetch from AI. Session fails cleanly. |
| Missing `char_detail.json` entry | Return empty pronunciation candidates. Do not throw. UI handles the empty state. |
| Pack purchase transaction failure | Roll back entire transaction. No partial state. Surface error to user. Do not retry automatically. |
| `content_requests` fulfillment partial update | `status` and `fulfilled_at` must be set in a single atomic update. If the update fails, leave row in previous state. Never set one field without the other. |

---

## 6) Docs Structure

### Companion-Doc Audit Requirement

Dated flow documents under `docs/architecture/` are allowed to contain narrative, risks, and examples. However any behavioral rule or implementation guardrail appearing in a companion doc must also be copied verbatim into this `0_` file. Agents are required to perform a quick audit when a companion doc is created or edited and elevate missing rules to maintain a single source of truth.

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
  AI_CONTRACT.md
  architecture/
    0_ARCHITECTURE.md                     ← system structure (this file)
    0_BUILD_CONVENTIONS.md
    0_PRODUCT_ROADMAP.md
    YYYY-MM-DD-short-description.md
  feature-specs/
    YYYY-MM-DD-short-feature-name.md
  code-review/
    YYYY-MM-DD-short-scope.md
  fix-log/
    build-fix-log-YYYY-MM-DD-summary.md
  archive/
    YYYY-MM/
      *.md
```

---

### Filing Rules by Doc Type

**`docs/architecture/`** — Create when a feature or domain rule needs documenting. Retire to `docs/archive/YYYY-MM/` when superseded.

**`docs/feature-specs/`** — Create before implementation starts. Content: problem statement, non-goals, behavior rules, edge cases, risks, test plan, acceptance criteria. Once shipped, add `## Status: Shipped YYYY-MM-DD` header. Move to archive after one sprint cycle. Feature specs are implementation guidance only — if a spec conflicts with `0_ARCHITECTURE.md`, the spec loses.

**`docs/code-review/`** — Findings are advisory. Accepted findings that produce rule changes must be written into the relevant `0_` doc. Keep all code reviews permanently; do not archive.

**`docs/fix-log/`** — Create after any bug fix, refactor, or regression prevention is merged. Permanent record; do not archive.

---

### Archive rule
Archived content is historical context only. Active docs and current implementation always win.

---

## 7) Development Conventions

All code must follow the conventions in `0_BUILD_CONVENTIONS.md`:

- **Bilingual UI:** All user-facing text in `*.strings.ts` files
- **Strings extraction:** Never hardcode copy in JSX
- **TypeScript strict mode:** Enabled; no `any` types; proper type annotations required
- **Type file organization:** Types in feature-scoped `[feature].types.ts` files
  - Each feature directory owns one `[feature].types.ts` file
  - Navigation/layout types in `shared/shell.types.ts`
  - Central `shared/words.shared.types.ts` acts as re-export hub for backward compatibility
  - Each type file has a companion `*.types.test.ts` for validation
- **Component file structure:** Feature-scoped route + page + shared-contract structure
- **Test coverage required:** All new features must include unit and integration tests
