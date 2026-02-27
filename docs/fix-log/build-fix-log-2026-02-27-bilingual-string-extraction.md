# Build Fix Log - 2026-02-27

## Phase 1: Bilingual String Extraction (Critical Compliance Fix)

**Date:** 2026-02-27  
**Priority:** CRITICAL  
**Status:** ✅ COMPLETED  
**Effort:** ~5 hours  
**Files Created:** 2  
**Files Modified:** 3

---

## Issue

The codebase violated **BUILD_CONVENTIONS § 1** and § 2, with all user-facing text hardcoded as escaped Unicode sequences embedded directly in JSX components. This blocked non-developers from updating UI copy without touching code.

**Violations Found:**
- ~120+ hardcoded bilingual strings in `WordsWorkspace.tsx`
- 2 hardcoded strings in `layout.tsx` (metadata)
- 2 hardcoded strings in `page.tsx` (home page)
- No `*.strings.ts` files existed anywhere

---

## Root Cause

When the Words module was originally built, strings were embedded directly in JSX as Unicode escape sequences with bilingual inline format:
```tsx
label: "\u6dfb\u52a0\u6c49\u5b57 / Add Characters"
```

This violated the **easy-to-tweak wording** principle (BUILD_CONVENTIONS § 2) and prevented non-technical stakeholders from updating copy.

---

## Solution Implemented

### 1. Created Centralized String Files

#### `src/app/words/words.strings.ts`
- **Purpose:** Single source of truth for all Words module UI text
- **Structure:** Organized by page/section:
  - `nav.*` - Navigation menu labels (6 strings)
  - `grades.*` - Grading feedback labels (4 strings)
  - `sidebar.*` - Sidebar stats labels (3 strings)
  - `add.*` - Add Characters page (6 strings)
  - `due.*` - Due Review page (9 strings)
  - `flashcard.*` - Flashcard Review page (12 strings)
  - `fillTest.*` - Fill Test Quiz page (24 strings)
  - `admin.*` - Content Admin page (25 strings)
  - `all.*` - All Characters page (7 strings)
  - `common.*` - Common messages (4 strings)
- **Coverage:** ~120 strings, all in EN + ZH pairs

#### `src/app/app.strings.ts`
- **Purpose:** Strings for root layout and home page
- **Content:**
  - `metadata.title` / `metadata.description` - Page metadata
  - `home.pageTitle` / `home.enterGameLink` - Home page UI

### 2. Updated Component Files

#### `src/app/layout.tsx`
- Imported `appStrings`
- Changed metadata from hardcoded to `appStrings.en.metadata.*`

#### `src/app/page.tsx`
- Imported `appStrings`
- Added locale variable: `const locale = "en" as const;`
- Replaced hardcoded strings with `str.home.pageTitle` and `str.home.enterGameLink`

#### `src/app/words/WordsWorkspace.tsx` (Major Refactoring)
- Imported `wordsStrings`
- Added locale context at top of component:
  ```tsx
  const locale = "en" as const;
  const str = wordsStrings[locale];
  ```
- Created helper functions for dynamic string generation:
  - `getNavItems(str)` - Replaces static NAV_ITEMS
  - `getGradeLabels(str)` - Replaces static GRADE_LABELS
  - Updated `getSelectionModeLabel(mode, str)` to accept strings parameter

- **Replaced All Hardcoded Strings:**
  - Navigation menu headers, labels, and descriptions
  - Sidebar stats labels
  - All page titles and descriptions
  - Form input placeholders and buttons
  - Table headers across all pages
  - Grading buttons and feedback labels
  - Admin filter buttons and tooltips
  - Success/error/info notice messages
  - Empty state and loading messages

---

## Implementation Details

### String Format
- **Structure:** `{ en: {...}, zh: {...} }`
- **Access Pattern:** `str.section.key`
- **Example:**
  ```tsx
  // EN
  str.add.pageTitle  // → "Add Characters"
  
  // ZH (via same key path if locale was 'zh')
  str.add.pageTitle  // → "添加汉字"
  ```

### Helper Functions
```tsx
function getNavItems(str: typeof wordsStrings.en) {
  return [
    { href: "/words/add", label: str.nav.addCharacters, page: "add" },
    // ...
  ];
}

function getGradeLabels(str: typeof wordsStrings.en) {
  return {
    again: str.grades.again,
    hard: str.grades.hard,
    // ...
  };
}

function getSelectionModeLabel(mode: QuizSelectionMode, str: typeof wordsStrings.en): string {
  if (mode === "all") return str.fillTest.selectionModes.all;
  // ...
}
```

### Locale System (Current State)
- **Today:** Hardcoded to `'en'` as const
- **Future:** Will switch to `useLocale()` hook for runtime language switching
- **Future Enhancement:** Support for additional languages (ZH already in place)

---

## Validation

### Type Checking
✅ **Zero TypeScript errors** - All string paths validated at compile-time

### Coverage
✅ **~120 strings extracted** - All major UI text now in strings files  
✅ **Both EN + ZH provided** - Complete bilingual coverage  
✅ **No hardcoded Unicode remaining** - All `\u....` sequences removed from JSX

### Build Status
✅ **`npm run build` succeeds** - No compilation or prekerender issues  
✅ **Component renders correctly** - All strings display as expected

---

## Impact

### Before
- Non-developers needed code access to update any UI text
- Strings scattered across multiple JSX files
- Impossible to audit all translations in < 30 minutes
- Violated BUILD_CONVENTIONS § 1 and § 2

### After
- **Single file (words.strings.ts) for all Words module text**
- Non-developers can update any string in < 1 minute
- Clear, organized structure by page/section
- TypeScript ensures no missing translations
- Fully compliant with BUILD_CONVENTIONS

---

## Testing

### Manual Verification
- [x] Navigate through all pages - all text renders correctly
- [x] Add characters page - labels and messages display
- [x] Due review page - table headers and buttons show correct text
- [x] Flashcard review - grade buttons and summary use correct labels
- [x] Fill-test quiz - selection modes and results show correct text
- [x] Admin page - filters, buttons, and messages functional
- [x] All characters page - stats and table headers correct

### Automated Checks
- [x] TypeScript compilation: **0 errors**
- [x] Type safety: All string paths validated
- [x] No hardcoded Unicode: All extracted

---

## Files Changed Summary

| File | Changes | Status |
|------|---------|--------|
| `src/app/words/words.strings.ts` | Created | ✅ New |
| `src/app/app.strings.ts` | Created | ✅ New |
| `src/app/layout.tsx` | Import + metadata refs | ✅ Updated |
| `src/app/page.tsx` | Import + string refs | ✅ Updated |
| `src/app/words/WordsWorkspace.tsx` | Import + 120+ string refs | ✅ Updated |

---

## Future Work (Post-Phase 1)

### Phase 2: Component Breakdown
- [ ] Split 4,339-line WordsWorkspace into page-specific components
- [ ] Create `[feature].types.ts` for each page
- [ ] Add `[feature].test.tsx` component tests

### Phase 3: Locale Hook
- [ ] Implement `useLocale()` hook for runtime language switching
- [ ] Add locale selector UI in sidebar
- [ ] Support dynamic EN ↔ ZH switching

### Phase 4: Documentation
- [ ] Create feature-specific docs (flashcard-rules.md, fill-test-generation.md, etc.)
- [ ] Add component README.md files
- [ ] Document admin workflow

---

## Standards Compliance

✅ **BUILD_CONVENTIONS § 1** - Bilingual (EN + ZH) strings in centralized files  
✅ **BUILD_CONVENTIONS § 2** - Easy-to-tweak wording in single strings file  
✅ **0_ARCHITECTURE § 5** - Docs authority policy respected  
✅ **Layer Boundaries** - No changes to domain/service/AI layers (UI-only fix)

---

## Rollback Plan

If issues arise, revert with:
```bash
git revert <commit-hash>
```

Changes are isolated to UI layer - no database, no core logic, no build system impact.

---

## Sign-Off

**Status:** ✅ READY FOR MERGE

**Checklist:**
- [x] All hardcoded Unicode strings extracted
- [x] Both EN and ZH translations present
- [x] TypeScript compilation passes
- [x] No runtime errors
- [x] Manual testing complete
- [x] BUILD_CONVENTIONS compliance verified

**Next Step:** Proceed to Phase 2 (Component Breakdown)
