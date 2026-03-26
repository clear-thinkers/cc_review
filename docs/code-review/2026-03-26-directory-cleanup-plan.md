# Directory Cleanup Plan — 2026-03-26

**Date:** 2026-03-26  
**Scope:** Repo-wide file redundancy and organization review  
**Status:** Planning only — no cleanup implemented from this plan yet

---

## Goal

Reduce redundant files, make ownership clearer, and trim tracked local artifacts without introducing risky structural churn.

This plan separates:

- **Safe now:** low-risk deletions or ignore-rule cleanup
- **Needs migration:** files that are redundant in spirit but still referenced
- **Doc / naming cleanup:** organization improvements that do not change behavior

---

## Safe Now

### 1. Remove tracked local agent residue

**Files:**

- `tmpclaude-*` files at repo root
- `.claude/settings.local.json`

**Why:**

- These are machine-local / agent-local artifacts, not application source.
- They create noise in the repo root and do not belong in version control.

**Action:**

1. Delete all tracked `tmpclaude-*` files.
2. Stop tracking `.claude/settings.local.json`.
3. Extend `.gitignore` to cover:
   - `.claude/settings.local.json`
   - `tmpclaude-*`

**Risk:** Low

---

### 2. Remove dead UI compatibility stub for wallet types

**File:**

- `src/app/words/shared/coins.types.ts`

**Why:**

- It is now only a compatibility re-export of `Wallet` from `src/lib/wallet.types.ts`.
- Current repo scan found no remaining imports of `coins.types`.

**Action:**

1. Reconfirm zero imports before delete.
2. Delete `src/app/words/shared/coins.types.ts`.

**Risk:** Low, but verify import count first

---

## Needs Migration

### 3. Remove app-layer type re-export shims after final import migration

**Candidate files:**

- `src/app/words/shop/shop.types.ts`
- `src/app/words/shop/shopIngredients.ts`
- `src/app/words/shared/tagging.types.ts`
- `src/app/words/debug/debug.types.ts`
- `src/app/words/shop-admin/shopAdmin.types.ts`

**Why:**

- These are 2-line compatibility re-exports whose canonical owners now live in `src/lib/`.
- They preserve old UI import paths, but they also make ownership less obvious and keep duplicate “homes” visible in the tree.

**Action:**

1. Migrate UI imports/tests from app-path shims to `@/lib/...`.
2. Run typecheck/tests.
3. Delete each shim only after usage reaches zero.

**Risk:** Medium — import churn across UI files and tests

---

### 4. Simplify route wrapper indirection in `/words`

**Pattern today:**

- `page.tsx` often renders `*Page.tsx`
- `*Page.tsx` often only wraps `WordsWorkspace page="..."`

**Examples:**

- `src/app/words/page.tsx` → `src/app/words/HomePage.tsx`
- `src/app/words/add/page.tsx` → `src/app/words/add/AddPage.tsx`
- `src/app/words/admin/page.tsx` → `src/app/words/admin/AdminPage.tsx`
- similar pattern in `all`, `review`, and nested review routes

**Why:**

- The pattern is valid, but many of these wrappers add naming noise without adding real ownership or logic boundaries.

**Action options:**

1. **Direct route pattern:** let `page.tsx` import `WordsWorkspace` directly for thin routes.
2. **Feature component pattern:** keep `*Page.tsx`, but only when it owns real composition logic beyond a one-line pass-through.

**Recommendation:**

- Standardize on one pattern for all workspace-backed routes.
- Do not mix both unless a route has a real reason to.

**Risk:** Medium — low behavior risk, moderate churn

---

## Doc / Naming Cleanup

### 5. Rename misleading type-only strings file in results feature

**File:**

- `src/app/words/results/results.strings.ts`

**Why:**

- The file is type-only, but its name implies it owns the strings.
- Actual strings are maintained in `src/app/words/words.strings.ts`.

**Action:**

- Rename to something like:
  - `results.strings.types.ts`, or
  - `results.locale.types.ts`

Then update imports accordingly.

**Risk:** Low

---

### 6. Make archive intent clearer for large data snapshots

**Candidate file:**

- `archive/2026/char_detail.json.backup`

**Why:**

- It is large and tracked, but not obviously explained.
- It is not identical to the active `public/data/char_detail.json`, so this is not a blind-delete item.

**Action:**

1. Move large backup datasets under a clearer archive namespace, e.g.:
   - `archive/data-snapshots/`
2. Add a short README describing:
   - what the snapshot is
   - why it is retained
   - whether it is safe to delete/regenerate

**Risk:** Low

---

### 7. Reduce doc search surface with clearer archive boundaries

**Current doc areas:**

- `docs/architecture`
- `docs/feature-specs`
- `docs/fix-log`
- `docs/code-review`
- `docs/archive/specs`

**Why:**

- The repo follows an authority model where `0_` docs are canonical, but older active-looking docs still create search noise.

**Action:**

1. Keep `docs/architecture/0_*` as canonical.
2. Keep active planning artifacts in `feature-specs`, `fix-log`, and `code-review`.
3. Make `docs/archive/specs` visibly archival via:
   - stronger README labeling, or
   - prefixing archived filenames/folders more explicitly

**Risk:** Low

---

## Suggested Execution Order

### Phase 1 — Safe cleanup

1. Remove `tmpclaude-*`
2. Stop tracking `.claude/settings.local.json`
3. Update `.gitignore`
4. Remove `src/app/words/shared/coins.types.ts` if still unused

### Phase 2 — Naming / doc clarity

1. Rename `results.strings.ts` to a type-only name
2. Improve archive folder labeling / snapshot docs

### Phase 3 — Import and wrapper simplification

1. Migrate off app-layer compatibility shims
2. Delete zero-usage shims
3. Standardize `/words` route wrapper structure

---

## Recommended Next Step

If cleanup should begin now, start with **Phase 1 only**. It has the best signal-to-risk ratio and does not require architectural decisions.
