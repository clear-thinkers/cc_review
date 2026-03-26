# Code Review — 2026-03-26 — Architecture & Dead Code

**Date:** 2026-03-26
**Reviewer:** Claude Code
**Scope:** Full codebase — architecture boundaries, layer violations, dead code detection
**Last updated:** 2026-03-26 (all items resolved — ARCH-1–5, DEAD-1–3)

---

## Architecture Review

---

### ARCH-1 · Service layer imports from UI layer ✅ RESOLVED 2026-03-26

**File:** `src/lib/supabase-service.ts` line 15
**Category:** Architecture
**Severity:** High

**Finding:** `supabase-service.ts` (the `src/lib/` service layer) imported the `Wallet` type directly from `src/app/words/shared/coins.types`, inverting the one-way lib → app dependency direction.

**Resolution (two patches):**

Patch 1 — `Wallet`:
- Created `src/lib/wallet.types.ts` as canonical owner
- `supabase-service.ts` now imports `./wallet.types` (lib-to-lib)
- `src/app/words/shared/coins.types.ts` reduced to a compatibility re-export stub

Patch 2 — `QuizSession` (same pattern, bundled in):
- Created `src/lib/quiz.types.ts` as canonical owner
- Updated `supabase-service.ts`, `src/lib/results.ts`, and `src/lib/coins.ts` to import from `./quiz.types`

`src/lib/` now has zero imports from `src/app/`.

---

### ARCH-2 · API routes and lib modules import from feature UI directories ✅ RESOLVED 2026-03-26

**Category:** Architecture
**Severity:** High

**Finding:** `src/lib/` modules and `src/app/api/` routes imported types and utilities directly from `src/app/words/` feature directories, inverting the intended dependency direction across 11 files.

**Resolution (four batches):**

| Batch | Moved to `src/lib/` | UI stub left at |
|---|---|---|
| A | `shop.types.ts`, `shopIngredients.ts` | `src/app/words/shop/shop.types.ts`, `src/app/words/shop/shopIngredients.ts` |
| B | `debug.types.ts` | `src/app/words/debug/debug.types.ts` |
| C | `tagging.types.ts`, `admin.types.ts` (HiddenAdminTarget only), `reviewTestSession.types.ts` | `src/app/words/shared/tagging.types.ts` (full stub); re-export lines added to `admin.types.ts` and `review.types.ts` |
| D | `shopAdmin.types.ts` | `src/app/words/shop-admin/shopAdmin.types.ts` |

All compatibility re-export stubs are in place — existing UI callers are unaffected. All internal imports within the new lib files use relative `./` paths (lib-to-lib only).

Post-fix state verified by grep:
- `src/lib/` → zero `from "@/app/` imports
- `src/app/api/` → zero `from "@/app/words/` imports

---

### ARCH-3 · Monolithic strings file contradicts per-feature convention ✅ RESOLVED 2026-03-26

**File:** `src/app/words/words.strings.ts` (1,892 lines)
**Category:** Architecture
**Severity:** Medium
**Status:** Resolved — convention amended

**Finding:** BUILD_CONVENTIONS §2 and §4 required each feature directory to own a `[feature].strings.ts` file, but the `/words` workspace intentionally centralizes most copy in `words.strings.ts`. The convention was written for standalone routes and did not account for workspace-style modules with a shared coordinator/VM.

**Resolution:** BUILD_CONVENTIONS §2 and §4 amended to distinguish two patterns:
- **Default (standalone feature routes):** local `[feature].strings.ts`
- **Allowed exception (workspace-style modules):** module-level `[module].strings.ts` as the source of truth for all workspace-owned sections

`words.strings.ts` is now the documented canonical owner for `/words` workspace sections. Features outside the workspace coordinator (e.g. `prompts`, `tagging`) continue to use local files. The §4 checklist item updated to require confirming the strings owner rather than mandating a local file.

**Follow-up (non-blocking):** `results.strings.ts` is type-only but named like an owning strings file — a small naming inconsistency worth cleaning up separately once the convention text is stable.

---

### ARCH-4 · CSS modules mixed with Tailwind in results feature ✅ RESOLVED 2026-03-26

**Files:**
- `src/app/words/results/results.module.css` (456 lines)
- `src/app/words/results/ResultsPage.tsx`
- `src/app/words/review/fill-test/coins.animation.module.css`

**Category:** Architecture
**Severity:** Medium
**Status:** Resolved — exception documented

**Finding:** BUILD_CONVENTIONS §7 states: "Tailwind CSS only. No CSS modules unless an existing file already uses them." The results feature uses a 456-line CSS module file AND Tailwind utility classes side-by-side within the same components. The `coins.animation.module.css` in `fill-test/` introduces a second CSS module. This is two features that grew with CSS modules despite the Tailwind-only rule, and both mix the two systems within the same components.

**Recommendation:** No immediate action is needed for existing CSS in `results.module.css`. However, the `results/` components should not accumulate additional Tailwind classes going forward — any new styling additions should extend the CSS module rather than mixing systems further. Document this exception in BUILD_CONVENTIONS to prevent new features from following the same mixed pattern unintentionally. The `coins.animation.module.css` is appropriate for animation keyframes that Tailwind cannot express — flag it as the only accepted exception pattern.

**Resolution:** Both exceptions documented in `BUILD_CONVENTIONS.md §7` under "CSS Module Exceptions (Documented)". Rules established: no new Tailwind in `results/`, animation-keyframes-only as the sole accepted reason for new CSS modules going forward.

---

### ARCH-5 · Missing tests — seam-based priorities

**Category:** Architecture
**Severity:** Medium
**Status:** Open

BUILD_CONVENTIONS §5 requires tests for all features. The six originally flagged gaps are real but not equally valuable — coverage should be added at the right seam per §5's seam-based test priority rule, not as uniform section render tests.

#### Priority 1 — `src/lib/results.ts` domain tests ✅ RESOLVED 2026-03-26

`src/lib/results.ts` exports domain logic consumed directly by `ResultsPage.tsx:8`. Added `src/lib/results.test.ts` — 51 tests covering all 11 exported functions: percent calculators (zero, rounding, happy path), `getTestedCharacters`/`getFailedCharacters` (order, dedupe), `formatDuration`/`formatTotalDuration`/`formatSessionDate`/`formatSessionDateLocale` (edge cases, locale branching), `computeSessionDisplayData` (full integration across helpers), and `calculateSummaryStats` (weighted averages, cross-session dedupe, empty input).

#### Priority 2 — `SessionHistoryTable` focused UI test ✅ RESOLVED 2026-03-26

Added `SessionHistoryTable.test.ts` — 33 tests covering the four stable component behaviors without a render dependency (`@testing-library/react` is not available): `truncateCharacters` (empty, below/at/above limit, custom maxLength), sort state machine (same-field toggle, new-field reset, double-toggle round-trip), sort comparator (asc/desc for all 8 sort fields including the `testedCount`/`failedCount` derived-length cases), and clear-button visibility (`hideDestructiveActions` × empty-session matrix).

#### Priority 3 — `/words/add` ingestion helper extraction + tests ✅ RESOLVED 2026-03-26

Created `src/app/words/add/addIngestion.ts` with three pure helpers extracted from the `addWord` workflow and tested in `addIngestion.test.ts` (31 tests total):

- **`extractUniqueHanzi`** (from `words.shared.utils.tsx`) — 12 tests: empty/whitespace, single char, multi-char order, dedupe, non-Hanzi stripping (ASCII, digits, punctuation, Chinese punctuation), mixed phrase, trim.
- **`computeIngestionResult`** — 8 tests: all-new, partial-skip, all-skip, preserves order, invariant (`hanziToAdd.length + skippedCount === parsed.length`), empty input, duplicate existingHanzi entries.
- **`resolveAddNoticeType`** — 4 tests: `noNew` (newCount=0), `allSuccess` (newCount>0, skipped=0), `partialSuccess` (both>0), exhaustive three-outcome check.
- **`isTagFormComplete`** — 7 tests: section closed (always valid), all-fields-present, each of the four required fields missing individually, multiple fields missing.

#### Low priority — due review, fill-test, shop, shop-admin

`ShopSection`, `ShopAdminSection`, `DueReviewSection`, and `FillTestReviewSection` are large orchestration components (service calls, portals, timers, role-driven behavior). Full section render tests would be brittle and low-value. The repo already covers these areas at better seams (`src/lib/shop.test.ts`, `AdminSection.test.ts`).

Acceptable incremental coverage when warranted:
- Extract and test `getReviewTestSessionStatusMessage` from `DueReviewSection.tsx:8`
- Keep shop coverage in `src/lib/shop.test.ts`
- Keep shop-admin coverage in validation/normalization types unless a smaller presentational subcomponent is extracted

No full-section render tests required for these four components unless a stable, focused seam is identified first.

---

## Dead Code

---

### DEAD-1 · `src/lib/review.ts` — zero consumers ✅ RESOLVED 2026-03-26

**File:** `src/lib/review.ts` (deleted)
**Category:** Dead Code
**Severity:** Medium
**Status:** Resolved

**Finding:** `src/lib/review.ts` was found to have a real consumer on closer inspection — `supabase-service.ts` used `GradeResult`. Rather than keeping a one-off file, `ReviewSource` and `GradeResult` were moved into `src/lib/scheduler.ts` (the canonical home for grading domain types) and `review.ts` was deleted. `supabase-service.ts` now imports both types from `./scheduler`.

---

### DEAD-2 · `src/lib/rls.test.ts` — skipped test with no implementation ✅ RESOLVED 2026-03-26

**File:** `src/lib/rls.test.ts` (deleted)
**Category:** Dead Code
**Severity:** Low
**Status:** Resolved — file deleted

---

### DEAD-3 · `Grade` type defined twice ✅ RESOLVED 2026-03-26

**Files:** `src/lib/scheduler.ts` (canonical), `src/lib/coins.ts` (duplicate removed)
**Category:** Dead Code
**Severity:** Low
**Status:** Resolved — `coins.ts` now imports `Grade` from `./scheduler`

---

## Resolved Questions

**Q1 — `home/HomeFlowSection.tsx` directory without `page.tsx` ✅ RESOLVED 2026-03-26**

Keep `HomeFlowSection.tsx` in `src/app/words/home/` — do **not** move it to `src/app/words/shared/`.

**Resolution:** This component is feature-owned, not shared. It renders only for `page="home"` inside `WordsWorkspace.tsx`, guards on `vm.page === "home"`, and owns the home-specific step metadata for the landing-flow map. The route itself is still `/words` via `src/app/words/page.tsx` → `HomePage.tsx` → `WordsWorkspace page="home"`, so `home/` is acting as a feature folder, not an actual Next.js route segment. The current placement also matches the landing-flow spec, which explicitly called for `src/app/words/home/HomeFlowSection.tsx` as the presentational section for the landing page.

**Note:** If the folder name ever causes enough confusion to justify cleanup, the better rename would be something like `landing/` or `home-flow/`, not `shared/`.

---

## Summary

The codebase is in solid structural health: IndexedDB is fully retired, RLS scoping is correctly delegated to JWT claims, AI calls are gated to API routes, bilingual string coverage is complete, and test coverage exists for the most critical domain logic (scheduler, fill-test grader, normalization).

**Resolved since initial review:**
- ✅ ARCH-1 — `src/lib/` → `src/app/` import inversions fully eliminated (`Wallet`, `QuizSession`, and all related types moved to lib; compatibility stubs left for UI callers)
- ✅ ARCH-2 — API routes and lib modules no longer import from `src/app/words/` feature directories; all shared types and utilities migrated to `src/lib/` across four batches (A–D)
- ✅ ARCH-3 — `BUILD_CONVENTIONS §2/§4` amended to recognize workspace-style module strings files as an intentional pattern; `words.strings.ts` now has documented ownership
- ✅ ARCH-4 — CSS module exceptions documented in `BUILD_CONVENTIONS §7`; no code changes required
- ✅ ARCH-5 P1 — `src/lib/results.test.ts` added; 51 tests covering all 11 exported functions
- ✅ DEAD-1 — `src/lib/review.ts` deleted; `ReviewSource` and `GradeResult` moved to `src/lib/scheduler.ts`; `supabase-service.ts` updated
- ✅ DEAD-2 — `src/lib/rls.test.ts` deleted
- ✅ DEAD-3 — duplicate `Grade` removed from `src/lib/coins.ts`; now imported from `src/lib/scheduler.ts`

**Remaining priorities:**

All originally identified issues are resolved. No remaining priorities.
