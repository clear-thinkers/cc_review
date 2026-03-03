# Fix Log – 2026-03-02 – Global Locale Toggle UI

## Context
The UI was effectively locked to English because locale selection was hardcoded in page entry points and workspace orchestration.

## Root Cause
There was no shared locale state/provider, no global language control, and locale-dependent pages used `"en"` constants instead of runtime locale.

## Changes Applied
- Added a client locale context/provider with persisted locale storage:
  - `src/app/shared/locale.tsx`
- Added a global fixed top-right EN/CN toggle:
  - `src/app/LanguageToggle.tsx`
- Wired the root layout to provide locale context and render the toggle on all pages:
  - `src/app/layout.tsx`
- Updated app-level and words-level UI to read runtime locale:
  - `src/app/page.tsx`
  - `src/app/words/WordsWorkspace.tsx`
  - `src/app/words/shared/WordsShell.tsx`
- Refreshed app strings and added words shell title key:
  - `src/app/app.strings.ts`
  - `src/app/words/words.strings.ts`
- Localized add-flow form notices to stop bypassing `*.strings.ts`:
  - `src/app/words/shared/words.shared.state.ts`

## Architectural Impact
No layer boundary changes. UI-only behavior update; Domain, Service, and AI layers unchanged.

## Preventative Rule
Locale must never be hardcoded in page/workspace entry points. All locale-sensitive rendering must consume shared locale state.

## Docs Updated
- AI_CONTRACT.md: no — no contract rule changes
- 0_ARCHITECTURE.md: no — no architecture boundary or data model changes
- 0_BUILD_CONVENTIONS.md: no — implementation follows existing bilingual string conventions
- 0_PRODUCT_ROADMAP.md: no — bug fix, no roadmap scope change
