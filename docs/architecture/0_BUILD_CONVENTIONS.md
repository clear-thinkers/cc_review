# BUILD CONVENTIONS

_Last updated: 2026-02-27_

## ⭐ Read This Before Every Feature Build

**This document is part of the `0_` prefix series.** All markdown files starting with `0_` in `docs/architecture/` are foundational reference documents that should be reviewed before starting any new feature, fix, or change:

- `0_ARCHITECTURE.md` — Product rules, layer boundaries, operational invariants
- `0_BUILD_CONVENTIONS.md` — Development practices (this file)
- `0_PRODUCT_ROADMAP.md` — High-level product strategy and planning

## Purpose

This document defines **mandatory development conventions** for all new features and UI components. These rules ensure consistency, maintainability, and developer experience across the codebase.

Every feature implementation must reference and comply with these conventions before being merged.

---

## 0. Documentation Update Policy

### Foundational Docs (`0_` prefix)

**Must be reviewed before each build/fix/change.**

**Must be updated after each build/fix/change** to reflect the latest system state:
- If a new product rule emerges, update `0_ARCHITECTURE.md`
- If a new development practice is established, update `0_BUILD_CONVENTIONS.md`
- If roadmap priorities or scope change, update `0_PRODUCT_ROADMAP.md`

**When:** Before merging a feature, ensure all `0_` files are current.

### Feature/Domain-Specific Docs

New markdown files describing specific features or domains (e.g., "flashcard-content-rules.md", "scheduler-behavior.md") are:
- **Indexed by date created** in the filename (e.g., `2026-02-27-flashcard-rules.md`)
- **Unless the user explicitly specifies a different naming convention**
- Stored in `docs/architecture/` if they document core system behavior
- Stored in `docs/archive/[YYYY-MM]/` if they become outdated or historical

### Fix Logs

After each code fix or bug resolution:
- Create or update a fix log in `docs/fix-log/`
- Filename format: `[YYYY-MM-DD]-fix-log.md` or `build-fix-log-[YYYY-MM-DD].md`
- Include:
  - What was fixed
  - Why it broke
  - How you fixed it
  - Files modified
  - Tests added/updated
  - Link to related feature or roadmap item (if applicable)

Example:
```
docs/fix-log/
  build-fix-log-2026-02-26.md
  build-fix-log-2026-02-27.md
```

---

## 1. Bilingual Content (English & Chinese)

### Rule

All new pages, UI components, and user-facing text must support both **English** and **Simplified Chinese**.

### Implementation Pattern

**DO:**
- Store all user-facing strings in a centralized text/language object
- Keep strings at the component level or in a dedicated strings module
- Make it obvious which strings are translatable

**Example:**
```typescript
// src/app/words/prompts/prompts.strings.ts
export const promptsStrings = {
  en: {
    pageTitle: "Admin Prompts",
    viewPrompts: "View Current Prompts",
    editPrompt: "Edit Prompt",
    saveChanges: "Save Changes",
    loadPrevious: "Load Previous Version",
    resetDefault: "Reset to Default",
  },
  zh: {
    pageTitle: "管理提示词",
    viewPrompts: "查看当前提示词",
    editPrompt: "编辑提示词",
    saveChanges: "保存更改",
    loadPrevious: "加载之前版本",
    resetDefault: "重置为默认",
  },
};

// Usage in component
export function PromptPage() {
  const locale = useLocale(); // use your locale hook
  const str = promptsStrings[locale];
  
  return (
    <div>
      <h1>{str.pageTitle}</h1>
      <button>{str.editPrompt}</button>
    </div>
  );
}
```

### Anti-Patterns

**DON'T:**
- Hardcode English strings directly in JSX
- Mix English and Chinese in the same text object
- Scatter strings across multiple files without a clear pattern

### Success Criteria

- A developer can find and update all strings for a feature in < 2 minutes
- Strings are grouped by component/feature, not scattered
- No hardcoded user-facing text remains in component logic

### Compliance Status

✅ **PHASE 1 COMPLETE (2026-02-27)**

All core Words module UI strings have been extracted to:
- `src/app/words/words.strings.ts` — 120+ bilingual strings covering all 8 pages (Add, Due Review, Flashcard, Fill-Test, Admin, All Characters, + menus, sidebar)
- `src/app/app.strings.ts` — Root layout and home page strings

Implementation reference: [build-fix-log-2026-02-27.md](../../fix-log/build-fix-log-2026-02-27.md)

---

## 2. Easy-to-Tweak Wording

### Rule

Code must be structured so that **non-technical stakeholders** (project managers, product owners) can tweak copy without touching logic.

### Implementation Pattern

**DO:**
- Extract all strings to a dedicated `*.strings.ts` module per feature
- Keep strings static and organized (no computed strings or logic inside strings)
- Document the purpose and context of each string set
- Version strings alongside feature releases

**Example Structure:**
```
src/app/words/prompts/
  ├── page.tsx                (route handler)
  ├── PromptsPage.tsx         (main component)
  ├── PromptEditor.tsx        (editor subcomponent)
  ├── prompts.strings.ts      ← SINGLE SOURCE OF TRUTH
  └── prompts.test.tsx
```

**In `prompts.strings.ts`:**
```typescript
/**
 * Prompts Page Strings
 * 
 * Last tweaked: 2026-02-27
 * Last tweaker: [name/role]
 * 
 * Rules:
 * - All user-facing text goes here
 * - Keep formatting OUT of strings (use JSX for styling)
 * - Use placeholders {name} for dynamic values, not template literals
 */

export const promptsStrings = {
  en: {
    // Section: Page Header
    pageTitle: "Admin Prompts",
    pageDescription: "Configure AI prompts for content generation",

    // Section: Prompt List
    currentVersion: "Current Version",
    noPrompts: "No prompts found",

    // Section: Actions
    editButton: "Edit",
    saveButton: "Save Changes",
    cancelButton: "Cancel",
    deleteButton: "Delete",

    // Section: Messages
    savingPrompts: "Saving prompts...",
    saveSuccess: "Prompts saved successfully",
    saveError: "Failed to save. Please try again.",
  },
  zh: {
    pageTitle: "管理提示词",
    pageDescription: "配置内容生成的人工智能提示词",
    currentVersion: "当前版本",
    noPrompts: "未找到提示词",
    editButton: "编辑",
    saveButton: "保存更改",
    cancelButton: "取消",
    deleteButton: "删除",
    savingPrompts: "保存提示词中...",
    saveSuccess: "提示词已成功保存",
    saveError: "保存失败。请重试。",
  },
};
```

### Compliance Status

✅ **PHASE 1 COMPLETE (2026-02-27)**

The Words module now follows this exact pattern:
- All UI copy in dedicated `*.strings.ts` modules
- Organized by section (header, footer, buttons, messages, etc.)
- Non-developers can tweak copy in < 1 minute by editing the appropriate section

**Example:** To change "Add Characters" button text from English or Chinese, edit `src/app/words/words.strings.ts` line ~12 or ~105 respectively.

Current structure in `src/app/words/words.strings.ts`:
- Navigation labels
- Grade feedback labels  
- Sidebar statistics
- Add page form strings
- Due review page strings
- Flashcard review strings
- Fill-test quiz strings (24 strings covering all states)
- Admin page strings (25 strings covering filters, buttons, stats)
- All characters page strings
- Common system messages
```

### Anti-Patterns

**DON'T:**
- Compute strings in components: `const msg = isLoading ? "Loading..." : "Done"`
- Use template literals inside strings: `"User {name} has {count} items"` in logic
- Mix styling and copy: `"<strong>Important:</strong> ..."`

### Success Criteria

- A non-developer can open one file and change any user-facing text
- All strings are static (no conditionals, no function calls)
- No component logic references string keys directly

---

## 3. Component Conventions for New Pages

### Rule

When adding a new page or major UI component, follow this structure:

```
src/app/words/[feature]/
  ├── page.tsx                    (Next.js route, minimal logic)
  ├── [FeatureName]Page.tsx       (main component, layout + orchestration)
  ├── [Component].tsx             (subcomponents as needed)
  ├── [feature].strings.ts        (all text strings)
  ├── [feature].types.ts          (TypeScript types specific to feature)
  ├── [feature].test.tsx          (component + integration tests)
  └── README.md                   (optional: brief feature guide)
```

### Checklist for New Page/Feature

- [ ] Strings extracted to `*.strings.ts` (EN + ZH)
- [ ] Types in `*.types.ts` if adding new domain models
- [ ] Tests cover happy path + error states
- [ ] No hardcoded text in JSX
- [ ] Uses consistent locale/translation hook across codebase
- [ ] Accessible (ARIA labels use strings, not hardcoded text)

---

## 4. Before Building Feature X: Checklist

Before starting implementation on roadmap features:

1. **Review foundational docs**: Read all `0_` prefix files in `docs/architecture/`
2. **Update docs as needed**: After your changes, update `0_ARCHITECTURE.md` or `0_BUILD_CONVENTIONS.md` if new product rules or development practices emerge
3. **Extract strings first**: Create `[feature].strings.ts` with EN + ZH before building UI
4. **Plan your locale hook**: Ensure your component can consume EN/ZH strings
5. **Design file structure**: Follow component conventions (§3)
6. **Add bilingual strings first**: Code against the strings object, not hardcoded text
7. **Create fix log**: After merge, document changes in `docs/fix-log/[YYYY-MM-DD]-fix-log.md`

---

## Reference

- For architecture context: see `0_ARCHITECTURE.md`
- For page-specific details: see `1_add-characters-page.md`, etc.
- For product roadmap: see `0_PRODUCT_ROADMAP.md`
- For docs authority policy: see `0_ARCHITECTURE.md` § 5
