# Fix Log – 2026-03-11 – Pagination & Default Filters for All Characters Inventory

## Context

User request to implement pagination (50 per page, option 1) and add default filter controls to the `/words/all` (All Characters Inventory) page. The filters provide quick access to three common searches:
1. **Due Now** – Characters currently due for review
2. **Familiarity** – Filter by skill level (≤ or ≥ threshold, 0-100)
3. **Tags** – Multi-select cascading tags (AND logic)

This implements product roadmap features and improves UX for managing large character inventories.

## Root Cause

Previous design (rule #12 in 0_ARCHITECTURE.md) explicitly stated "The page does not paginate or virtualize large datasets." This was causing performance concerns and poor UX with large character lists. User decision to implement option 1 (simple pagination, 50/page) with default filters to address this.

## Changes Applied

### 1. **Strings** (`src/app/words/words.strings.ts`)
- **Added EN & ZH strings for pagination:**
  - Items per page label
  - Previous, Next, First, Last buttons
  - Page info: "Page X of Y"
  
- **Added EN & ZH strings for default filter bar:**
  - Filter bar title: "Default Filters"
  - Clear Filters button
  - Due Now checkbox label + tooltip
  - Familiarity operator label, operators (≤, ≥), value label
  - Tags label + placeholder + tooltip
  - No match message when filters yield zero results

### 2. **Component Logic** (`src/app/words/all/AllWorksSection.tsx`)

**New State:**
- `filterDueNow: boolean` – Toggle due-now filter
- `filterFamiliarityOperator: "<=" | ">="` – Comparison operator
- `filterFamiliarityValue: number | ""` – Threshold (0-100)
- `filterSelectedTagIds: string[]` – Selected tag IDs for multi-select
- `currentPage: number` – Current pagination page (1-indexed)
- `ITEMS_PER_PAGE: 50` – Constant

**New Memoized Selectors:**
- `availableTagsWithIds` – Extracts all unique tags from `wordTagsMap` for filter UI
- `filteredWords` – Applies all three default filters with AND logic:
  - Due Now: `nextReviewAt <= now`
  - Familiarity: compares `getMemorizationProbability(word)` against threshold
  - Tags: word must have ALL selected tags
- `paginatedWords` – Slices `filteredWords` to 50 items for current page
- `paginatedWordIds` – Maps paginatedWords to IDs for selection tracking

**New Effects:**
- Reset to page 1 when any filter changes
- Update checkbox selections when paginated word list changes

**New Functions:**
- `clearAllFilters()` – Resets all filters to defaults and returns to page 1
- `toggleAllVisibleSelection()` – Updated to select only visible (paginated) words, not all filtered words

**UI Updates:**
- **Filter Bar** (after stats cards, before batch tag editor):
  - Due Now: Simple checkbox
  - Familiarity: Dropdown operator + number input (validated 0-100)
  - Tags: Collapsible details/summary multi-select with search
  - Clear Filters button (auto-disabled when no filters active)

- **Table Rendering:**
  - Now uses `paginatedWords` instead of `sortedAllWords`
  - Updated `allVisibleSelected` to use `paginatedWordIds`
  - Updated `toggleAllVisibleSelection()` to only toggle visible page items

- **No-Match Message:**
  - When filters are active but yield zero results, shows message with Clear Filters link
  - Positioned before table with blue background for visibility

- **Pagination Controls** (after table, before closing):
  - Page info: "Page X of Y"
  - Navigation buttons: First, Previous, Next, Last
  - Buttons disabled appropriately (e.g., Next disabled on last page)
  - Only shown when `totalPages > 1`

### 3. **Architecture Documentation** (`docs/architecture/0_ARCHITECTURE.md`)

**Updated "All Characters Inventory Rules":**
- Rule #1: Now mentions filtering and pagination apply
- Rule #2: Summary cards computed before filters (reflects total in DB)
- Rule #13 (formerly #12): **Pagination implemented** – states 50 items/page with First/Previous/Next/Last controls
- Rules #16–19: **Default Filter Bar** – new section covering Due Now, Familiarity, Tags with AND logic
- Rules #20–22: **Legacy Tag Filter Bar** – clarified existing tag-only filter bar (Textbook/Grade/Unit/Lesson) remains for power users
- Rules #23–25: Batch tag assignment and role-based visibility (unchanged from original #19–21)

## Architectural Impact

**UI Layer** (`src/app/words/all`):
- AllWordsSection component now manages filter state in addition to sort/batch-edit state
- Filter logic is client-side; no backend changes required
- Page responsiveness unaffected (filtering happens on already-loaded data in-memory)
- Bilingual strings follow existing pattern in `words.strings.ts`

**Domain Layer** (`src/lib/scheduler.ts`, etc.):
- No changes; filtering uses existing `getMemorizationProbability()` function from domain layer

**Service Layer** (`src/lib/supabase-service.ts`):
- No changes; all data loaded via existing `getAllWords()` call

**Data Model** (Supabase schema):
- No changes; filtering is applied to existing `words` table columns

**RLS & Permissions:**
- No changes; filtering is UI-only; all words returned by Supabase RLS remain visible to authorized users

## Preventative Rule

**Pagination Scope:**
- Any future `/words/*` inventory-style page displaying large result sets should default to 50 items/page with at minimum first/previous/next/last controls
- If adding new filter dimensions, follow AND logic (word must match all selected filters)
- Keep filter UI bilingual from day 1 (add EN + ZH strings to `words.strings.ts` together)

**Filter Order & Precedence:**
- Apply filters before pagination: `all words → filter → paginate`
- Reset to page 1 whenever any filter changes
- Never persist default filter state in URL params (keep them session-only); reserve URL params for advanced tag-based filtering only

## Docs Updated

- ✅ `docs/architecture/0_ARCHITECTURE.md` – All Characters Inventory Rules (rules #13–25 expanded)
- ✅ `src/app/words/words.strings.ts` – Pagination + filter strings (EN + ZH)
- ✅ This fix log
