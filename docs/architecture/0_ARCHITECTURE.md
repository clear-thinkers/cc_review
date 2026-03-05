# ARCHITECTURE

_Last updated: 2026-03-04_ (wallet table schema added)

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
1. Add Hanzi → `/words/add` → IndexedDB `words` table.
2. Curate content → `/words/admin` → `/api/flashcard/generate` + manual edits → `flashcardContents` table.
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
8. `Delete` removes the row from local IndexedDB immediately (no confirmation dialog).
9. The page is local-only: it does not call AI generation routes and does not sync with a server.
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
   - Requires confirmation dialog before deletion
   - On confirmation, all records in `quizSessions` table are deleted permanently with no undo
   - Table and summary cards clear immediately upon successful deletion
8. **Empty state:** When no sessions exist, display a placeholder message directing users to start a review session; hide all table and summary UI elements.

### Login & Avatar Protection Rules (`/login`)

These rules govern the login and session protection gate for early-feedback deployment:

1. Login page (`/login`) is **not protected by session guard** — it is always accessible for setup and authentication flows.
2. All other pages and routes require a valid session token to access; unauthenticated requests redirect to `/login`.
3. **First-visit setup flow:**
   - User creates a 4-digit numeric PIN (0000–9999)
   - User selects one of 3 avatars: bubble_tea, cake, or donut (images stored in `/public/avatar/`)
   - PIN is hashed using SHA-256 (client-side); plaintext PIN is never stored
   - Session token and avatar selection are stored in localStorage
   - **PIN-scoped IndexedDB database is initialized** with PIN hash prefix (see Data Isolation below)
   - If legacy unscoped database exists and migration has not yet run, legacy data is migrated once to the new PIN-scoped database
   - User is redirected to `/words` (main app)
4. **Subsequent-visit login flow:**
   - User enters their 4-digit PIN
   - System compares hashed input with stored PIN hash
   - If match, user selects avatar (pre-populated with last-selected avatar for UX)
   - New session token is generated and stored in localStorage
   - **PIN-scoped IndexedDB database is initialized** for the logged-in PIN (automatic database switch)
   - User is redirected to `/words`
5. **Invalid PIN handling:**
   - Incorrect PIN shows error message; user can retry unlimited times
   - No lockout or attempt throttling in Phase 1 (early-feedback only)
   - No "forgot PIN" recovery — user must clear browser cache and create new PIN
6. **Session persistence:**
   - Session tokens stored in localStorage persist across browser restarts
   - No expiration in Phase 1; sessions valid indefinitely until logout or cache clear
   - Session data includes: `sessionToken`, `selectedAvatarId`, creation timestamp
7. **Database lifecycle:**
   - **On login:** `initializeDatabaseForPin(pinHash)` is called to set the current PIN-scoped database
   - **SessionGuard check:** When a returning user loads the app, SessionGuard validates the session token and calls `initializeDatabaseForPin()` to reinitialize the correct database for that user
   - **Smart reinitialization:** If the same PIN is already initialized, reinitialization is skipped to prevent unnecessary database closures
   - **On logout:** `clearDatabaseState()` closes the database and clears PIN state before redirecting to `/login`
8. **Logout flow:**
   - Logout button available in main app nav bar
   - Logout closes the current PIN-scoped database
   - Logout clears all auth data (session token + PIN hash + avatar selection)
   - User is redirected to `/login` setup wizard (no PIN stored, appears as new user)
9. **Avatar persistence:**
   - Last-selected avatar stored in localStorage for UX convenience (pre-populated on next login)
   - User can change avatar each time they log in
   - Avatar emoji/image displayed in nav bar when logged in
10. **Data isolation (critical):**
    - Each PIN has its own isolated IndexedDB database with a PIN-scoped name: `cc_review_db_{PINHASH_PREFIX}` (first 12 characters of PIN's SHA-256 hash)
    - Words, flashcard content, quiz sessions, wallet, and all learning data are **never shared** across PINs
    - Clean separation ensures up to 3 users (Nora + siblings) can have completely independent learning progress on the same device
    - No cross-user data leakage even if localStorage is inspected
11. **Migration (one-time only):**
    - Legacy unscoped database (`cc_review_db`) is checked for data when the first PIN is set up
    - If legacy data exists and `localStorage.migration_completed` is not set, all tables are migrated to the new PIN-scoped database
    - After migration completes, `localStorage.migration_completed` is set to prevent future migrations
    - Subsequent new PINs start with fresh, empty databases
12. **Security notes (early-feedback, not production-grade):**
    - PIN strength: 10,000 possible combinations; weak but sufficient for early feedback on trusted device
    - localStorage can be inspected in DevTools; PIN is hashed (not plaintext) but hash could theoretically be brute-forced
    - No server-side validation; all auth is client-side localStorage-based and IndexedDB-based
    - Intended for 1–3 early-feedback users on single iPad; not for production multi-user deployment
    - Phase 2+ can upgrade to stronger auth or server-side session validation if feedback warrants

---

## 2) Layer Boundaries

### Layers and Ownership

| Layer | Location | Responsibility |
|---|---|---|
| UI | `src/app/...`, `WordsWorkspace` | Interaction, view state, locale rendering |
| Domain | `src/lib/scheduler.ts`, `src/lib/fillTest.ts`, `src/lib/flashcardLlm.ts` | Pure logic: scheduling, grading, normalization |
| Service | `src/lib/db.ts`, `src/lib/xinhua.ts` | IO: IndexedDB reads/writes, static data loading |
| AI | `src/app/api/flashcard/generate/route.ts` | Prompt orchestration, provider calls |

### Call Graph (Structural)

This describes how layers are wired — the actual call and import relationships the system uses:

- `src/app/**` communicates with `src/app/api/**` via **fetch calls only** — no direct imports.
- `src/app/api/**` is invoked only from admin authoring flows — never from review execution paths.
- **API routes must never import from `src/lib/db.ts` or perform IndexedDB operations directly.** They should call service or domain functions instead, preserving the service-layer abstraction.
- `src/lib/scheduler.ts` has no dependency on UI or API layers — it is a pure domain module.
- AI output flows through normalization in `src/lib/flashcardLlm.ts` before reaching `src/lib/db.ts`.
- `src/lib/db.ts` is the single point of contact for all IndexedDB reads and writes.

> For the agent rules that enforce these boundaries (what to never do), see `AI_CONTRACT.md §2`.

---

## 3) Data Schema

### IndexedDB Tables

**`words` table** — one row per character added by the user

| Field | Type | Initial Value | Notes |
|---|---|---|---|
| `id` | string | `makeId()` | Generated unique ID |
| `hanzi` | string | input character | Single Hanzi character |
| `pinyin` | string \| undefined | `undefined` | Optional; not set by `/words/add` |
| `meaning` | string \| undefined | `undefined` | Optional; not set by `/words/add` |
| `createdAt` | number | `Date.now() + index offset` | Timestamp; offset preserves insertion order |
| `repetitions` | number | `0` | SRS repetition count |
| `intervalDays` | number | `0` | Current SRS interval in days |
| `ease` | number | `21` | Scheduler stability/ease value |
| `nextReviewAt` | number | `0` | Unix timestamp — drives due queue; 0 = immediately due |
| `reviewCount` | number \| undefined | `0` at creation | Total flashcard review attempts |
| `testCount` | number \| undefined | `0` at creation | Total fill-test attempts |
| `fillTest` | `FillTest` \| undefined | `undefined` | Populated only after Content Admin curation/manual assignment |

**`flashcardContents` table** — curated content per character

| Field | Type | Notes |
|---|---|---|
| `id` | string | `character\|pronunciation` composite key |
| `meanings` | string[] | Definition list |
| `phrases` | Phrase[] | Each: `{ zh, pinyin, en, include_in_fill_test }` |
| `examples` | Example[] | Each: `{ zh, pinyin, en, include_in_fill_test }` |

**`quizSessions` table** — completed fill-test session records (view-only, reporting interface)

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique session ID — generated as `makeId()` or UUID |
| `createdAt` | number | Unix timestamp (milliseconds) when session ended |
| `sessionType` | string | Currently "fill-test"; reserved for future quiz types (Phase 3+) |
| `gradeData` | SessionGradeData[] | Individual word grades: `{ wordId, hanzi, grade, timestamp }` |
| `fullyCorrectCount` | number | Count of grades === "easy" |
| `failedCount` | number | Count of grades === "again" |
| `partiallyCorrectCount` | number | Count of grades === "good" or "hard" |
| `totalGrades` | number | Sum of all grade counts (fullyCorrect + failed + partiallyCorrect) |
| `durationSeconds` | number | Elapsed time in seconds from session start to completion |
| `coinsEarned` | number | Coins earned in this session; calculated per grade at completion |

**`wallets` table** — cumulative rewards tracking (singleton record)

| Field | Type | Notes |
|---|---|---|
| `id` | string | Fixed value: `"wallet"` (singleton pattern) |
| `totalCoins` | number | Cumulative coins earned across all sessions |
| `lastUpdatedAt` | number | Unix timestamp (milliseconds) of last wallet update |
| `version` | number | Schema version for future upgrades; currently `1` |

---

### Static Data

- **Pronunciation candidates:** `public/data/char_detail.json` — loaded via `src/lib/xinhua.ts`

### localStorage Schema (Session & Login Data)

| Key | Type | Purpose | Notes |
|---|---|---|---|
| `sessionToken` | string | Session authentication | Opaque token persists across browser restarts; cleared on logout |
| `selectedAvatarId` | string | Selected avatar (0–2) | Converted to/from number in code; stored as string in localStorage |
| `sessionCreatedAt` | string | Session creation timestamp | Unix milliseconds; used for session validity checks |
| `storedPinHash` | string | Hashed 4-digit PIN | SHA-256 hex hash; never plaintext; persistent until logout |
| `lastSelectedAvatarId` | string | Last-selected avatar ID | UX convenience; pre-populates avatar grid on next login |
| `migration_completed` | string | Migration flag | Set to `'true'` after legacy data migrates to PIN-scoped database; prevents re-migration |

### Database State Management (In-Memory)

The following state is maintained in memory (not localStorage) to manage PIN-scoped database lifecycle:

| State | Type | Purpose | Notes |
|---|---|---|---|
| `currentDb` | AppDB \| null | Current PIN-scoped database | Initialized on login; cleared on logout |
| `currentPinHash` | string \| null | Current PIN hash | Tracks which PIN's database is open; prevents double-initialization of same PIN |

**Database initialization flow:**
- `initializeDatabaseForPin(pinHash, shouldMigrate)` — Opens a new PIN-scoped database; skips reinitialization if same PIN already open
- `clearDatabaseState()` — Closes the current database and resets `currentDb` and `currentPinHash` to null (called on logout)

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
2. **Every value written to `flashcardContents` has been normalized.** Schema shape is enforced before any IndexedDB write.
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
| IndexedDB read failure (review screens) | Show a graceful error state in the UI. Do not re-fetch from AI. Session fails cleanly. |
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

