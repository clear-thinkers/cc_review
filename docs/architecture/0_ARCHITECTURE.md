# ARCHITECTURE

_Last updated: 2026-02-27_

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

### Extension Guardrails (promoted from companion docs)

These additional invariants were previously recorded only in dated flow documents; they are now authoritative and any change must trigger an update here:

- Persisted content must always follow the pipeline: **draft → normalize → persist**. No direct writes of unnormalized data.
- The `flashcardContents` primary key is fixed as `character|pronunciation`. Changing this composite key requires an architecture review and explicit doc update.
- If fill-test semantics change, both the admin status definitions above **and** the due-review derivation rules (§1 Due Review Queue Rules) must be updated in sync.
- Preload behaviour is sequential by default; converting to parallel or batched execution demands a documented rate‑limit, retry, and error policy before implementation.
- Any feature touching fill-test inclusion or derivation must consider both admin and review layers simultaneously.



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

### Static Data

- **Pronunciation candidates:** `public/data/char_detail.json` — loaded via `src/lib/xinhua.ts`

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

All code must follow the conventions in `0_BUILD_CONVENTIONS.md`: bilingual UI, strings extraction, TypeScript strict mode, component file structure, and test coverage.

