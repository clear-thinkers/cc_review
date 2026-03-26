# BUILD CONVENTIONS

_Last updated: 2026-03-26_

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

## Feature Specs

A feature specification is no longer optional when an agent is coding under pressure. The following rules apply:

- **Trigger:** any feature that touches more than one architectural layer (UI, Domain, Service, AI) **or** adds a new database table, RPC, or persisted schema field must have a spec before implementation begins. This threshold gives a clear non-triviality signal. For other changes, if the work spans multiple files, requires new DB fields, or involves coordination with another developer, draft a spec anyway.
- **Template:** use the structure below when creating a new spec file in `docs/feature-specs/`. Keep it terse but complete.

```markdown
# Feature Spec — YYYY-MM-DD — Short Title

## Problem

## Scope

## Out of scope

## Proposed behavior

## Layer impact

## Edge cases

## Risks

## Test Plan

## Acceptance criteria

## Open questions
```

Agents should default to creating a spec when in doubt; skipping this step requires explicit human approval.

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

## 1a. Type File Organization

All TypeScript types must be defined in feature-scoped `*.types.ts` files, never inline in component files.

**Principle:** Types live adjacent to the features that use them. This improves IDE navigation, prevents cross-feature coupling, and makes future feature development clearer.

### Pattern

```
src/app/words/
  shared/
    shell.types.ts         ← Navigation/layout types (shared across features)
    words.shared.types.ts  ← Re-export hub for backward compat + shared utilities only
    words.shared.state.ts
  add/
    add.types.ts           ← Add feature types (empty placeholder if no feature-specific types yet)
  all/
    all.types.ts           ← All Characters inventory page types
  review/
    review.types.ts        ← Due queue page types
    flashcard/
      flashcard.types.ts   ← Flashcard review types
    fill-test/
      fillTest.types.ts    ← Fill-test review types
  admin/
    admin.types.ts         ← Admin curation + generation request/response types
```

### File Organization Rules

1. **Feature-level scope:** Each feature directory (`add/`, `all/`, `review/`, `admin/`, etc.) owns one `[feature].types.ts` file
2. **Navigation types:** Shared across all features in `shared/shell.types.ts` (`NavPage`, `WordsSectionPage`, `NavItem`)
3. **Shared utilities:** Rare; kept only in central `words.shared.types.ts` (`WordsLocaleStrings`, `SortDirection`, `RenderWithPinyin`)
4. **Sub-feature types:** Deep features like `review/flashcard/flashcard.types.ts` and `review/fill-test/fillTest.types.ts` own their own types
5. **Import sources:** Feature code imports types from adjacent `[feature].types.ts` file; central file used only for re-exports and shared utilities

### Example Usage

```typescript
// src/app/words/admin/admin.types.ts — types for admin curation
export type AdminTarget = { character: string; pronunciation: string; key: string };
export type AdminTableRow = { /* ... */ };

// src/app/words/admin/AdminSection.tsx — consume types from adjacent file
import type { AdminTarget, AdminTableRow } from "./admin.types";

export function AdminSection({ vm }: { vm: WordsWorkspaceVM }) {
  const targets: AdminTarget[] = vm.adminTargets;
  // ...
}
```

### Backward Compatibility

Central `words.shared.types.ts` acts as a **re-export hub** to maintain backward compatibility with existing code. All feature types are re-exported from the central file, but **new code must import from feature-specific files directly**.

### Test Coverage

Each feature-scoped type file must have a companion `[feature].types.test.ts` file that validates:
- Type construction (objects can be created with correct shape)
- Union types (values match expected literals)
- Tuple types (length and element types are correct)

---

## 2. Bilingual UI (English & Simplified Chinese)

All user-facing text must support both English and Simplified Chinese. Every feature must have one clearly documented owner for its copy — either a local strings file or a module-level strings file — and consume it via the locale hook. Never write string literals directly in JSX.

**Default — standalone feature routes:** create a `[feature].strings.ts` file in the feature directory and import it locally.

**Allowed exception — workspace-style modules:** a workspace with a shared coordinator or VM may keep a single module-level `[module].strings.ts` as the source of truth for all workspace-owned sections. New sections added to an existing workspace must add their copy to the existing module-level file, not create a parallel local file.

> **This project's `/words` workspace** uses `words.strings.ts` as the module-level strings file for workspace-owned pages (`home`, `add`, `all`, `admin`, `debug`, `review`, `flashcard`, `fill-test`, `shop`, `shop-admin`). Features that stand alone outside the workspace coordinator — such as `prompts` and `tagging` — own their own local `[feature].strings.ts` files. New sections added to the `/words` workspace must extend `words.strings.ts`, not create a separate local file.

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
  ├── [feature].strings.ts        (standalone features only — see §2 for workspace exception)
  ├── [feature].types.ts          (TypeScript types for this feature)
  ├── [feature].test.tsx          (tests — see §5)
  └── README.md                   (optional: brief usage notes)
```

### New Feature Checklist

- [ ] Strings owner confirmed: either a local `[feature].strings.ts` or an existing module-level strings file extended with the new section (per §2)
- [ ] `[feature].types.ts` created if new domain types are introduced
- [ ] No hardcoded text in JSX — all copy via strings object
- [ ] Locale hook used consistently
- [ ] ARIA labels sourced from strings file
- [ ] **All buttons have bilingual labels, tooltips, and notifications** (per §7 Button Guidelines)
- [ ] Tests added per §5

### UX Policy for Destructive Actions

Whenever implementing a delete or other destructive control, follow the existing pattern: immediate removal with no confirmation dialog. If a new feature requires a different UX (e.g. an undo stack or explicit confirmation), document the rationale in the spec and notify the team. The default assumption is **no confirmation** to keep simplicity; deviations must be intentional and justified.

---

## 5. Testing Conventions

Every new feature must have tests before it is considered complete.

### What Must Be Tested

| Scope | Required |
|---|---|
| Domain logic (`src/lib/`) | Unit tests for all exported functions — happy path, edge cases, invalid input |
| Normalization & safety | Verify malformed/unsafe inputs are dropped, not passed through |
| UI components | Test at the right seam (see below) |
| API routes | Integration test: success response and error response |
| Scheduler logic | Unit test each grade tier (`again`, `hard`, `good`, `easy`) — verify `nextReviewAt` and `interval` |

### UI Testing: Seam-Based Priority

Not all UI coverage belongs at the same layer. Choose the seam closest to the logic, not the outermost component:

1. **Extracted pure helpers first.** If a component contains branching logic (parsing, scoring, filtering, status messages), extract it to a named function and test that function. This is the highest-value, lowest-churn seam.
2. **Focused subcomponent tests second.** If a subcomponent owns a stable, self-contained behavior (sortable columns, form validation, destructive-action visibility), a targeted render test is appropriate. Prefer this over smoke-testing the parent section.
3. **Section-level smoke tests last, and only when warranted.** Large orchestration components that compose service calls, portals, role checks, and timers are expensive to render in tests and tend to be brittle. A smoke test ("renders without crash, displays expected string") is acceptable only when no better seam exists. It is not automatically required for every section component.

The repo's existing test for admin logic (`AdminSection.test.ts`) follows this pattern — it tests extracted seams, not a full section mount. New tests should follow the same approach.

### Mocking Rules

- Mock Supabase client / RPC boundaries — never hit live hosted data in tests.
- Mock AI provider calls — never make real network calls in tests.
- Do not mock `src/lib/` when testing UI components — test their real integration.

### Conventions

- Co-locate test files: `[feature].test.tsx` or `[feature].test.ts`
- Naming: `describe('[ComponentName]')` → `it('does X when Y')`

### Done When

- Happy path passes.
- Error states (failed fetch, malformed data, empty DB) are covered.
- Normalization drops bad input without throwing.

### Examples of Domain-Specific Tests

To guide agents, here are representative mini‑examples for each test scope:

- **Scheduler logic:** write a unit test that grades a sample word through all four tiers and asserts the resulting `intervalDays` and `nextReviewAt` match the formula in `scheduler.ts`. Include edge cases such as ease < minimum or repeated `again` grades.

- **Normalization & safety:** provide a snippet that feeds the actual normalization function in `src/lib/flashcardLlm.ts` (e.g. `normalizeFlashcardLlmResponse`) a payload containing a phrase with an empty `zh` field, a non‑string `en`, and a too‑long string. Assert that the returned object omits the invalid row and logs the drop.

- **API routes:** simulate both a successful generation call and a downstream error by mocking the provider; verify the route responds with 200 and 500 respectively.

These examples are not exhaustive but illustrate the kind of domain knowledge expected when writing tests.

---

## 6. Build and CI Guardrails

The repository enforces text encoding integrity to prevent mojibake (garbled characters from encoding corruption).

### Required Encoding Check

- Command: `npm run check:encoding`
- Script: `scripts/check-mojibake.mjs`

### Bilingual String Parity

The CI must catch untranslated or missing ZH keys in strings files. Add a simple test or lint rule that iterates over all `*.strings.ts` files and asserts that the `en` and `zh` objects have identical sets of keys (ignoring comments). This test runs as part of `npm test` and fails the build if any discrepancy exists. The encoding check does not cover this gap alone.
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

### CSS Module Exceptions (Documented)

Two CSS module files exist as intentional exceptions to the Tailwind-only rule:

1. **`src/app/words/results/results.module.css`** — The `results/` feature grew with a CSS module before the Tailwind-only convention was established. This file is the styling source of truth for that feature. **Do not add new Tailwind utility classes to `results/` components** — all new styling for that feature must extend the CSS module instead. Do not split styling across both systems further.

2. **`src/app/words/review/fill-test/coins.animation.module.css`** — CSS keyframe animations cannot be expressed in Tailwind. A CSS module is the accepted pattern for animation-only styling. This is the only case where a new CSS module may be introduced: when the need is purely animation keyframes that Tailwind cannot express. Document the reason in a comment at the top of the file.

**No other CSS modules should be created.** If a new feature requires styling that Tailwind cannot express, raise it in the feature spec before building.

### Per-Character Pinyin (Ruby) Alignment

For Chinese learning UI where pinyin is shown with Hanzi, use per-character ruby alignment instead of line-level pinyin.

**Core implementation rules:**
- Render text as per-character units (`Hanzi + its pinyin token`), not a full pinyin line above a full Hanzi line.
- Map pinyin tokens only to Hanzi code points (`\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff`); punctuation and non-Hanzi characters must not consume pinyin tokens.
- Split pinyin by whitespace to separate tokens (one token per Hanzi character in order).
- Remove punctuation from pinyin tokens using regex `/[^\p{L}\p{M}0-9]/gu` (keep Unicode letters, diacritical marks, and numbers) before mapping.
- Normalize all pinyin to lowercase using `.toLowerCase()` before display to ensure consistent presentation regardless of data source.
- When a Hanzi has no corresponding pinyin token (mismatch in token count or missing data), render the Hanzi without pinyin above it (no placeholder, no blank space).
- For non-Hanzi characters in the text (punctuation, spaces, English), do not render pinyin above them.
- Keep one visual unit per character: pinyin flex-direction column above Hanzi below using small flex gap (2px).
- Use responsive sizing by content tier (`character`, `phrase`, `example`) with corresponding pinyin sizes (12px–15px).

**DOM structure pattern** (per `FlashcardCard.tsx` implementation):
```tsx
<div className="flashcard-ruby-line">  // Container for the full line
  {characters.map(char => (
    <span className="flashcard-ruby-unit">  // Per-character container
      {showPinyin && pinyinForChar ? (
        <span className="flashcard-ruby-pinyin">pinyin</span>
      ) : null}
      <span className="flashcard-ruby-text">char</span>
    </span>
  ))}
</div>
```

**Conditional rendering (not CSS hiding):**
- When pinyin toggle is off (`showPinyin === false`), do not render pinyin spans at all — remove from DOM entirely (not `visibility: hidden` or `display: none` with CSS).
- Preference for DOM removal vs. CSS hiding avoids layout ghost spaces and makes intent explicit in JSX.
- Example spacing (`column-gap`) adapts dynamically: tighter when pinyin hidden, normal when visible.

**Styling applied to ruby units:**
- Pinyin styling: italic, gray (#888), font-size 12px–15px depending on context
- Hanzi/text styling: bold or normal weight, larger font-size (20px–120px depending on context)
- Ruby unit padding: small inline padding (0.06em) for Hanzi units to control spacing
- Ruby line gap: 2px between pinyin and text within unit; variable column-gap between units

### Consistency Reference

New pages must visually match the existing `/words/admin` page as the baseline. Before writing any component JSX, read the `AdminSection.tsx` component and note these patterns:

**Page structure & containers:**
- Main content section: `space-y-3 rounded-lg border p-4`

**Headings & labels:**
- Page title (h2): `font-medium`
- Page description: `text-sm text-gray-700`
- Stats card labels: `text-sm uppercase text-gray-600`
- Table headers: `px-3 py-2 text-left`

**Body text & values:**
- Large numbers (stats): `text-2xl font-semibold`
- Regular content: `text-base leading-tight`
- Helper/body text: `text-sm text-gray-600`
- Small helper/placeholder: `text-xs text-gray-500`

**Stats cards:**
- Active (selected) state: `flex min-h-[70px] w-full flex-col items-center justify-center border border-black bg-gray-100 px-2 py-1.5 text-center`
- Inactive state: `flex min-h-[70px] w-full flex-col items-center justify-center border px-2 py-1.5 text-center`

### Button Guidelines

**Bilingual Requirements:**
Every action button must have **full bilingual support** in all of the following:
1. **Button label** — the visible text (e.g., `str.admin.buttons.preload`)
2. **Tooltip/title** — hover text explaining the action (e.g., `title={str.admin.buttonTooltips.preload}`)
3. **Notifications** — all success/error messages must use locale-aware strings (e.g., `str.admin.messages.preloadFinished`)

All bilingual strings must be stored in `*.strings.ts` files. Never hardcode English-only labels, tooltips, or messages.

**Standard Button Styling Pattern:**
All new action buttons should follow this consistent pattern for corners, borders, padding, weight, and disabled state:
- Container: `rounded-md border-2 px-4 py-2 font-medium disabled:opacity-50`
- Use lighter/softer Tailwind color palettes consistent with the `/words/admin` page
- Avoid dark/harsh colors; prefer `bg-[color]-100` with `border-[color]-400` or `border-[color]-300`
- Always pair border and background colors from the same Tailwind color family

**Color Examples (admin page reference):**
- **Preload (yellow/amber):** `border-amber-400 bg-amber-100 text-amber-900`
- **Refresh pinyin (soft purple):** `border-purple-300 bg-purple-100 text-purple-700`
- **Regenerate (table action, amber):** `border-amber-400 bg-amber-100 text-amber-900`
- **Save (table action, emerald):** `border-emerald-600 bg-emerald-600 text-white`
- **Add/Edit (table action, sky):** `border-sky-300 bg-sky-50 text-sky-800`
- **Toggle on (table action, teal):** `border-teal-600 bg-teal-50 text-teal-700`
- **Toggle off (table action, gray):** `border-gray-400 bg-gray-100 text-gray-700`
- **Delete (table action, rose):** `border-rose-500 bg-rose-50 text-rose-700`

**Primary buttons (full-width page actions):**
- Container format: `rounded-md border-2 px-4 py-2 font-medium disabled:opacity-50`
- Pair with appropriate soft colors (e.g., amber for preload, purple for refresh)
- Example: `className="rounded-md border-2 border-amber-400 bg-amber-100 px-4 py-2 font-medium text-amber-900 disabled:opacity-50"`

**Secondary buttons (small table actions):**
- Regenerate (amber): `rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900 disabled:opacity-50`
- Save (emerald): `rounded border-2 border-emerald-600 bg-emerald-600 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white disabled:opacity-50`
- Add / Edit / Info (sky blue): `rounded border-2 border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-sky-800 disabled:opacity-50`
- Toggle on (teal): `rounded border-2 border-teal-600 bg-teal-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-teal-700 disabled:opacity-50`
- Toggle off (gray): `rounded border-2 border-gray-400 bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-gray-700 disabled:opacity-50`

**Destructive buttons:**
- Delete (rose): `rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700 disabled:opacity-50`

**Text inputs & form elements:**
- Standard input: `w-full rounded-md border px-2 py-1 text-sm`

**Tables:**
- Wrapper: `overflow-x-auto rounded-md border`
- Table element: `min-w-full table-fixed border-collapse text-sm`
- Header row: `border-b bg-gray-50`
- Body rows: `border-b align-top`
- Cell padding: `px-3 py-2`

**Messages & status:**
- Informational notice (blue): `text-sm text-blue-700`
- Status/help text (gray): `text-sm text-gray-600`

**Do not:**
- Introduce new color values or spacing scales not present in AdminPage
- Create new component patterns (unique button styles, card layouts, etc.)
- If a pattern needed by the new feature genuinely does not exist in the codebase, flag it in the feature spec's **Open Questions** section before building — do not invent it

---

## 8. Before Building — Pre-Build Checklist

> Steps for reading docs, confirming scope, updating docs, and filing fix logs are in `AI_CONTRACT.md §1–§5`. The steps below are specific to feature implementation.

1. **Confirm the feature is in active scope** — check `0_PRODUCT_ROADMAP.md §Active Sprint`. If it appears in the Deferred list, stop.
2. **Check for a feature spec** — look in `docs/feature-specs/`. If one exists, read it before writing any code. If none exists and the feature is non-trivial, draft one first.
3. **Create `[feature].strings.ts`** with full EN + ZH coverage before writing any JSX.
4. **Plan the file structure** per §4 before writing component code.
5. **Write tests** per §5 alongside implementation — not as a follow-up.
6. **Run `npm run check:encoding`** to catch mojibake before opening or updating a PR.
