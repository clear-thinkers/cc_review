# Build Conventions — HanziQuest (`cc_review`)

_Last updated: 2026-03-26_

For authority hierarchy, hard stops, doc update policy, and fix log policy — see `AI_CONTRACT.md`.
For where to file new documents — see `0_ARCHITECTURE.md §6`.
This document covers how to write code. Nothing more.

---

## 0 · Pre-Build Checklist

Before writing any code:

1. Confirm the feature is in `0_PRODUCT_ROADMAP.md §1 · Active Work`. If it's in §2 Deferred, stop.
2. Check `docs/feature-specs/` for an existing spec. If found, read it first.
3. If no spec exists and the feature touches more than one layer or adds DB fields, draft one before coding (see §1).
4. Create `[feature].strings.ts` with full EN + ZH coverage before writing any JSX.
5. Plan the file structure per §5 before writing component code.
6. Write tests per §6 alongside implementation — not as a follow-up.
7. Run `npm run check:encoding` before opening a PR.

---

## 1 · Feature Specs

**When required:** any feature that touches more than one architectural layer (UI, Domain, Service, AI) or adds a new table, RPC, or persisted schema field. When in doubt, draft one — skipping requires explicit human approval.

**File location:** `docs/feature-specs/YYYY-MM-DD-name.md`

**Template:**
```markdown
# Feature Spec — YYYY-MM-DD — Short Title

## Problem
## Scope
## Out of scope
## Proposed behavior
## Layer impact
## Edge cases
## Risks
## Test plan
## Acceptance criteria
## Open questions
```

---

## 2 · TypeScript Rules

- `strict: true` must be enabled in `tsconfig.json` — never disable it.
- No `any` types. Use `unknown` and narrow, or define a proper interface.
- All exported functions must have explicit return type annotations.
- All React component props must have a named interface or type alias.
- No `@ts-ignore` or `@ts-expect-error` without a comment explaining why.

---

## 3 · Type File Organization

Types live in feature-scoped `*.types.ts` files, never inline in component files.

**Rules:**
- Each feature directory owns one `[feature].types.ts` file.
- Navigation/layout types shared across features → `shared/shell.types.ts`.
- Sub-features own their own types (e.g. `review/flashcard/flashcard.types.ts`).
- Feature code imports from its adjacent `[feature].types.ts` — not from the central hub.
- `words.shared.types.ts` is a re-export hub for backward compatibility only. Do not add new types there.
- Each `[feature].types.ts` must have a companion `[feature].types.test.ts` validating type construction, union values, and tuple shapes.

---

## 4 · Bilingual Strings

All user-facing text must support English and Simplified Chinese. Never write string literals directly in JSX.

**Default** (standalone feature routes): create `[feature].strings.ts` in the feature directory.

**Exception** (workspace modules): features inside the `/words` workspace add copy to `words.strings.ts`. Do not create a parallel local file. Features outside the workspace (e.g. `prompts`, `tagging`) own their own local strings file.

**What belongs in strings files:** all static user-visible copy — labels, titles, buttons, errors, placeholders, ARIA labels.

**What does not:** conditional rendering logic (`isLoading ? <Spinner /> : content`).

**Anti-patterns:**
- ❌ Hardcoded string literal in JSX
- ❌ Mismatched EN/ZH keys
- ❌ HTML or formatting inside string values
- ❌ Template literals in the strings object

**Strings file structure:**
```ts
/**
 * [Feature] Strings — Last updated: YYYY-MM-DD
 */
export const featureStrings = {
  en: {
    // Section: Page Header
    pageTitle: "...",
    // Section: Actions
    saveButton: "Save",
    // Section: Feedback
    saveSuccess: "...",
    saveError: "...",
  },
  zh: {
    pageTitle: "...",
    saveButton: "保存",
    saveSuccess: "...",
    saveError: "...",
  },
};
```

**CI enforcement:** a lint rule asserts that `en` and `zh` objects have identical key sets across all `*.strings.ts` files. Build fails on mismatch.

---

## 5 · Component File Structure
```
src/app/words/[feature]/
  ├── page.tsx                  (Next.js route entry — minimal, no logic)
  ├── [FeatureName]Page.tsx     (main component: layout + orchestration)
  ├── [Component].tsx           (subcomponents as needed)
  ├── [feature].strings.ts      (standalone features only — see §4)
  ├── [feature].types.ts        (TypeScript types for this feature)
  ├── [feature].test.tsx        (tests — see §6)
  └── README.md                 (optional)
```

**New feature checklist:**
- [ ] Strings owner confirmed (local file or workspace file extended)
- [ ] `[feature].types.ts` created if new domain types introduced
- [ ] No hardcoded text in JSX
- [ ] Locale hook used consistently
- [ ] ARIA labels sourced from strings file
- [ ] All buttons have bilingual labels, tooltips, and notifications
- [ ] Tests added per §6

**Destructive actions:** default UX is immediate removal with no confirmation dialog. Deviations must be justified in the spec.

---

## 6 · Testing Conventions

Every new feature must have tests before it is considered complete.

| Scope | Requirement |
|-------|-------------|
| Domain logic (`src/lib/`) | Unit tests — happy path, edge cases, invalid input |
| Normalization & safety | Verify malformed/unsafe inputs are dropped, not passed through |
| API routes | Integration test: success and error response |
| Scheduler logic | Unit test each grade tier — verify `nextReviewAt` and `interval` |
| UI components | Test at the closest seam to the logic (see below) |

**UI seam priority (highest to lowest):**
1. Extracted pure helpers — extract branching logic to a named function and test it directly.
2. Focused subcomponent tests — for stable, self-contained behaviors.
3. Section-level smoke test — only when no better seam exists. Not required by default.

**Mocking rules:**
- Mock Supabase client / RPC boundaries — never hit live data.
- Mock AI provider calls — never make real network calls.
- Do not mock `src/lib/` when testing UI components.

**Done when:** happy path passes, error states covered, normalization drops bad input without throwing.

---

## 7 · Styling Conventions

- Tailwind CSS only. No `style={{}}`. No new CSS modules (see exceptions below).
- No arbitrary Tailwind values (e.g. `w-[347px]`) without a documented reason.
- New pages must match the `/words/admin` page as the visual baseline — read `AdminSection.tsx` before writing component JSX.

**CSS module exceptions (do not create new ones):**
- `results/results.module.css` — predates Tailwind-only rule; all new styling for `results/` must extend this file, not mix with Tailwind.
- `review/fill-test/coins.animation.module.css` — animation keyframes only. A new CSS module is only permitted for keyframe animations Tailwind cannot express; document the reason at the top of the file.

**Pinyin (ruby) alignment:** render as per-character units (Hanzi + pinyin token), not a full pinyin line above a full Hanzi line. Map pinyin tokens only to Hanzi code points; skip punctuation and non-Hanzi characters. When token count mismatches, render Hanzi without pinyin — no placeholder. Remove from DOM when pinyin is hidden (not CSS `visibility: hidden`). See `FlashcardCard.tsx` for the reference DOM pattern.

**Button and color palette:** see `docs/architecture/button-style-reference.md` for the full button variant library.
_(Note: extract the current button table from this file into that reference doc.)_

---

## 8 · Build & CI Guardrails

- **Encoding check:** `npm run check:encoding` — runs `scripts/check-mojibake.mjs`, scans for garbled characters in source and docs.
- **String parity check:** asserts identical EN/ZH key sets across all `*.strings.ts` files. Runs as part of `npm test`.
- **CI workflow:** `.github/workflows/encoding-guardrails.yml` — triggers on all PRs and pushes to `main`/`master`.