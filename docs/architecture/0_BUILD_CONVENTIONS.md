# BUILD CONVENTIONS

_Last updated: 2026-02-28_

---

> For reading order, authority hierarchy, hard stops, doc update policy, and fix log policy — see `AI_CONTRACT.md`.
> This document covers **how to write code** for this project. Nothing more.

---

## Purpose

Mandatory coding and documentation conventions for all new features and UI components. Every implementation must comply before being considered complete.

---

## 0. Where New Docs Go

When a task produces a new document, file it here:

| Doc type | Folder | Who owns the filing rules |
|---|---|---|
| New product or system rule | `docs/architecture/0_ARCHITECTURE.md` (update in place) | `0_ARCHITECTURE.md §6` |
| New feature/domain behavior doc | `docs/architecture/YYYY-MM-DD-name.md` | `0_ARCHITECTURE.md §6` |
| Feature spec (pre-build) | `docs/feature-specs/YYYY-MM-DD-name.md` | `0_ARCHITECTURE.md §6` |
| Code review | `docs/code-review/YYYY-MM-DD-scope.md` | `0_ARCHITECTURE.md §6` |
| Fix log | `docs/fix-log/build-fix-log-YYYY-MM-DD-summary.md` | `AI_CONTRACT.md §5` |

---

## 1. TypeScript Rules

- `strict: true` must be enabled in `tsconfig.json` — never disable it.
- No `any` types. Use `unknown` and narrow, or define a proper interface.
- All exported functions must have explicit return type annotations.
- All React component props must have a named interface or type alias.
- No `@ts-ignore` or `@ts-expect-error` without a comment explaining why.

```typescript
// ✅ Correct
export function gradeWord(wordId: string, grade: Grade): SchedulerResult { ... }

// ❌ Wrong
export function gradeWord(wordId, grade) { ... }
```

---

## 2. Bilingual UI (English & Simplified Chinese)

All user-facing text must support both English and Simplified Chinese. Create a `[feature].strings.ts` file alongside every new feature and consume it via the locale hook — never write string literals directly in JSX.

```typescript
// src/app/words/prompts/prompts.strings.ts
export const promptsStrings = {
  en: {
    pageTitle: "Admin Prompts",
    editPrompt: "Edit Prompt",
    saveChanges: "Save Changes",
    saveSuccess: "Prompts saved successfully",
    saveError: "Failed to save. Please try again.",
  },
  zh: {
    pageTitle: "管理提示词",
    editPrompt: "编辑提示词",
    saveChanges: "保存更改",
    saveSuccess: "提示词已成功保存",
    saveError: "保存失败。请重试。",
  },
};

// Usage
export function PromptPage() {
  const locale = useLocale();
  const str = promptsStrings[locale];
  return <h1>{str.pageTitle}</h1>;
}
```

### What goes in strings files vs. component logic

**In `*.strings.ts`:** All static user-visible copy — labels, titles, button text, error messages, placeholder text, ARIA labels. If a non-developer should be able to change the wording, it goes here.

**In component logic:** Conditional rendering decisions — e.g. `isLoading ? <Spinner /> : content`. These are not translatable copy.

### Anti-Patterns

- ❌ `<button>Save Changes</button>` — hardcoded string literal in JSX
- ❌ Mixing EN and ZH keys in the same locale object
- ❌ HTML or formatting inside string values: `"<strong>Error:</strong> try again"`
- ❌ Template literals in the strings object: `` pageTitle: `Hello ${name}` ``
- ❌ Untranslated keys — EN key present, ZH key missing, or vice versa

### Success Criteria

A non-developer can find and update any UI copy in under 2 minutes by opening one file. No hardcoded Unicode or English strings in JSX.

---

## 3. Strings File Structure

Organize strings files so sections are scannable without reading code:

```typescript
/**
 * [Feature] Strings — Last updated: YYYY-MM-DD
 * All user-facing text for this feature.
 * Keep formatting OUT of strings (use JSX for styling).
 */
export const featureStrings = {
  en: {
    // Section: Page Header
    pageTitle: "...",

    // Section: Actions
    saveButton: "Save",
    cancelButton: "Cancel",

    // Section: Feedback Messages
    saveSuccess: "...",
    saveError: "...",
  },
  zh: {
    pageTitle: "...",
    saveButton: "保存",
    cancelButton: "取消",
    saveSuccess: "...",
    saveError: "...",
  },
};
```

---

## 4. Component File Structure

```
src/app/words/[feature]/
  ├── page.tsx                    (Next.js route entry — minimal, no logic)
  ├── [FeatureName]Page.tsx       (main component: layout + orchestration)
  ├── [Component].tsx             (subcomponents as needed)
  ├── [feature].strings.ts        (all bilingual strings — single source of truth)
  ├── [feature].types.ts          (TypeScript types for this feature)
  ├── [feature].test.tsx          (tests — see §5)
  └── README.md                   (optional: brief usage notes)
```

### New Feature Checklist

- [ ] `[feature].strings.ts` created with full EN + ZH coverage
- [ ] `[feature].types.ts` created if new domain types are introduced
- [ ] No hardcoded text in JSX — all copy via strings object
- [ ] Locale hook used consistently
- [ ] ARIA labels sourced from strings file
- [ ] Tests added per §5

---

## 5. Testing Conventions

Every new feature must have tests before it is considered complete.

### What Must Be Tested

| Scope | Required |
|---|---|
| Domain logic (`src/lib/`) | Unit tests for all exported functions — happy path, edge cases, invalid input |
| Normalization & safety | Verify malformed/unsafe inputs are dropped, not passed through |
| UI components | Render test: renders without crash, displays correct strings |
| API routes | Integration test: success response and error response |
| Scheduler logic | Unit test each grade tier (`again`, `hard`, `good`, `easy`) — verify `nextReviewAt` and `interval` |

### Mocking Rules

- Mock IndexedDB with an in-memory substitute — never test against a real browser DB.
- Mock AI provider calls — never make real network calls in tests.
- Do not mock `src/lib/` when testing UI components — test their real integration.

### Conventions

- Co-locate test files: `[feature].test.tsx` or `[feature].test.ts`
- Naming: `describe('[ComponentName]')` → `it('does X when Y')`

### Done When

- Happy path passes.
- Error states (failed fetch, malformed data, empty DB) are covered.
- Normalization drops bad input without throwing.

---

## 6. Build and CI Guardrails

The repository enforces text encoding integrity to prevent mojibake (garbled characters from encoding corruption).

### Required Encoding Check

- Command: `npm run check:encoding`
- Script: `scripts/check-mojibake.mjs`
- Behavior: scans authoritative text files and fails when likely mojibake is detected

### CI Enforcement

- Workflow: `.github/workflows/encoding-guardrails.yml`
- Triggers: all pull requests, plus pushes to `main` and `master`
- Job purpose: block merges that introduce encoding corruption into tracked source and documentation files

This guardrail exists to keep bilingual content and Chinese character data stable across local edits, commits, and CI environments.

---

## 7. Styling Conventions

- Tailwind CSS only. No inline `style={{}}`. No CSS modules unless an existing file already uses them.
- Use Tailwind utility classes directly on JSX elements.
- No arbitrary Tailwind values (`w-[347px]`) without a documented reason.
- Dark mode and responsive breakpoints follow the pattern in `WordsWorkspace` — do not introduce new patterns without discussion.

---

## 8. Before Building — Pre-Build Checklist

> Steps for reading docs, confirming scope, updating docs, and filing fix logs are in `AI_CONTRACT.md §1–§5`. The steps below are specific to feature implementation.

1. **Confirm the feature is in active scope** — check `0_PRODUCT_ROADMAP.md §Active Sprint`. If it appears in the Deferred list, stop.
2. **Check for a feature spec** — look in `docs/feature-specs/`. If one exists, read it before writing any code. If none exists and the feature is non-trivial, draft one first.
3. **Create `[feature].strings.ts`** with full EN + ZH coverage before writing any JSX.
4. **Plan the file structure** per §4 before writing component code.
5. **Write tests** per §5 alongside implementation — not as a follow-up.
6. **Run `npm run check:encoding`** to catch mojibake before opening or updating a PR.
