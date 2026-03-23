# Design Discussion – All Characters Navigation at Scale (100+ Hanzi)

_Date: 2026-03-11_  
_Context: Current `/words/all` page renders all rows in a single table with no pagination or virtualization._

---

## Current State

**Page:** `/words/all` (AllWordsSection.tsx, ~800 lines)

**Constraint from ARCHITECTURE.md:**
> "The page does not paginate or virtualize large datasets."

This is currently a **statement of fact**, not a hard requirement.

**Today's interface:**
- Single unsorted table: all rows rendered in DOM
- 8 columns + actions (character, date added, next review, review count, test count, familiarity %, tags, actions)
- Client-side sorting (6 sortable columns: hanzi, createdAt, nextReviewAt, reviewCount, testCount, familiarity)
- Filtering by cascade tags (Textbook/Grade/Unit/Lesson) — **not yet implemented in UI**
- Multi-select batch tagging (✓ implemented)
- Summary cards: Total, Times Reviewed, Times Tested, Avg Familiarity

**Performance risk at 100+ rows:**
- All rows in DOM = slower renders, larger memory footprint
- No quick navigation → user scrolls entire list each session
- Sorting/filtering operations on in-memory state remain fast, but layout impact is high

---

## Navigation Options for 100+ Hanzi

### Option 1: Pagination

**How:** Divide table into fixed-size pages (e.g., 20, 50 per page). Controls at top/bottom. URL state: `?page=N`.

**Pros:**
- ✓ Clear mental model (familiar to most users)
- ✓ Reduces DOM size (only current page rendered)
- ✓ Batch actions naturally scope to page
- ✓ Simple to implement (list slice + page count)
- ✓ Works well on mobile
- ✓ Deterministic: sorting/filtering recomputes, stays on page 1

**Cons:**
- ✗ "Next Review Now" words might be on page 5 → requires active search
- ✗ No overview of overall distribution (when are next reviews due?)
- ✗ User must know which page to jump to (by count, not by semantic intent)
- ✗ Multi-select batch tagging becomes "select within page" (not cross-page)
- ✗ Breaks continuous scrolling UX

**Best for:** Broad audiences, high accessibility, simple code.

---

### Option 2: Virtual Scrolling (Windowed List)

**How:** Render only visible rows + buffer (e.g., 50-100 visible, 500 total). Single scrollable list, performance-optimized.

**Pros:**
- ✓ Feels like infinite scroll (single unified list)
- ✓ DOM size stays constant regardless of dataset size
- ✓ Sorting/filtering instant (just re-slices virtual window)
- ✓ Works with all existing batch operations (select any 50 rows across dataset)
- ✓ Can add "jump to top" button for quick navigation
- ✓ Scales to 1000+ rows without effort

**Cons:**
- ✗ Accessibility risk (screen readers may not handle virtual DOM well)
- ✗ Mobile scroll performance depends on device (iOS sometimes janky with big lists)
- ✗ Requires library (React Window, Virtua, TanStack Virtual)
- ✗ Styling complexity (fixed row height assumption)
- ✗ Keyboard navigation (Ctrl+Home/End) must be replicated

**Best for:** Desktop-first, performance-critical, power users who scroll fast.

**Library candidates:**  
- `react-window` (mature, 25KB)
- `@tanstack/react-virtual` (newer, lighter, reactive)
- `virtua` (smallest, modern)

---

### Option 3: Smart Filtering (Filter Bar) + Reduced Initial Display

**How:** Complete filter bar (Textbook/Grade/Unit/Lesson cascades, date-range search, hanzi search, familiarity bands). Show only "actionable" rows by default (e.g., "Due Soon", "Unreviewed").

**Pros:**
- ✓ Filters already documented in ARCHITECTURE (just needs implementation)
- ✓ Shows most relevant words first (due soon, new, struggling)
- ✓ Semantic: users ask "show me words due now" not "show me page 3"
- ✓ Reduces cognitive load (100 rows → 10-20 most urgent)
- ✓ No architectural change; just enhanced filtering logic
- ✓ Pairs well with any pagination/scrolling option

**Cons:**
- ✗ Requires UX to define "smart defaults" (what counts as "actionable"?)
- ✗ User still needs to see all 100 to understand scope
- ✓ Does NOT replace pagination/scrolling; enhances it

**Smart Default Options:**
- `due_soon`: nextReviewAt in [now, now + 7 days]
- `unreviewed`: reviewCount = 0
- `struggling`: familiarity < 30%
- `all`: no filter, show all with current sort

---

### Option 4: Grouped View (by Tag / Date / Familiarity Band)

**How:** Instead of flat table, group rows by:
- **By Tag**: Expand/collapse each Textbook/Grade/Unit
- **By Date Added**: Group by week/month added
- **By Familiarity Band**: New (0%), Learning (1-50%), Familiar (51-80%), Known (81-100%)

**Pros:**
- ✓ Visual hierarchy helps scanning (eye sees groups, not 100 rows)
- ✓ User can collapse groups they don't care about
- ✓ Pairs well with summary stats (summary tells you which groups matter)
- ✓ Supports quick access ("show me all unreviewed words": 1 group)
- ✓ Batch operations can span groups

**Cons:**
- ✗ Requires re-theming (different component structure, not table)
- ✗ Sorting becomes ambiguous across groups (sort by group order? Sort within groups?)
- ✗ Multi-select UI must handle group-level selection (select all in group, etc.)
- ✗ Accessibility: group expand/collapse must be keyboard-navigable

**Best for:** Admin/power users; works well alongside filtering.

---

### Option 5: Hanzi Search / Radical+Stroke Filter

**How:** Add quick-search input. Filter by:
- Direct hanzi match (e.g., "你好" → show 你, 好)
- Stroke count (1-30 strokes)
- Radical search (CJK radical lookup)

**Pros:**
- ✓ Fits natural language learning (learners think by radical/stroke)
- ✓ Works for users looking for specific characters
- ✓ Can combine with other filters ("show all 10-stroke words I haven't reviewed yet")
- ✓ No architectural change; just add input field

**Cons:**
- ✗ Does NOT solve "browse all 100" problem
- ✗ Hanzi search is already in `/words/add` (but different purpose)
- ✓ Requires radical/stroke metadata (available in `char_base.json`?)

**Best for:** Lateral feature, complements other options.

---

### Option 6: Session-Scoped Quick Views

**How:** Add tabs/buttons to pre-filter by common scopes:
- "📅 Due Soon" (nextReviewAt within 7 days)
- "🆕 New" (reviewCount = 0)  
- "❌ Failed" (last grade was "again", last 7 days)
- "⭐ Struggling" (familiarity < 30%)
- "🎓 Mastered" (familiarity > 85%)
- "📊 All" (full list)

**Pros:**
- ✓ Instant, semantic navigation (no need to understand filtering dropdowns)
- ✓ Mobile-friendly (tab bar takes ~40px, natural on phones)
- ✓ Reduces visible rows by 50-80% typically
- ✓ Pairs well with pagination (each tab shows paginated results)

**Cons:**
- ✗ Requires deciding on "default" categories (product decision)
- ✗ User can't customize categories
- ✓ Complements rather than replaces pagination/filtering

---

### Option 7: Favorites / Pinned Words

**How:** Add "pin" or "star" button to words. Pinned words always show first (collapsible "Pinned" section at top). Unpin in bulk from Pinned section.

**Pros:**
- ✓ Power users can reduce cognitive load (show top 10 focus words first)
- ✓ Works alongside any other navigation method
- ✓ No additional DB schema (just a `isPinned` flag in words table)
- ✓ Minimal UI cost (star icon per row)

**Cons:**
- ✗ Requires schema change (isPinned boolean on words table)
- ✗ Persistence/sync overhead (Supabase write per pin action)
- ✗ Does NOT solve core problem; just hierarchizes it

---

### Option 8: Advanced Search (Combined Filter + Date Picker)

**How:** Replace simple cascade dropdowns with:
- **Hanzi search:** Text input (substring match or full-text)
- **Tag cascade:** Existing dropdowns (Textbook → Grade → Unit → Lesson)
- **Date range:** "Added between [date] and [date]"
- **Familiarity range:** Slider "Show 30%-60% familiarity"
- **Review status:** Checkbox group (Unreviewed, Due Soon, Overdue, Recently Reviewed)

**Pros:**
- ✓ Highly expressive (users can ask complex questions)
- ✓ Can reduce table to 5-10 rows easily
- ✓ Combines ideas from Options 3, 5, and 6
- ✓ Saves frequently-used filters (localStorage or URL state)

**Cons:**
- ✗ UI complexity (requires modal or sidebar to avoid crowding)
- ✗ Cognitive overhead (too many options can paralyze)
- ✗ Not recommended for child profiles (confusing)
- ✗ Requires UX design (not just code)

---

## Combinable Strategies

None of the options above are mutually exclusive. Recommended combinations:

| Combination | Use Case | Total Hanzi | Complexity |
|---|---|---|---|
| **Filtering** (Option 3) | Admin wants semantic scoping first | 100-200 | Low |
| **Filtering + Pagination** | Admin, natural breakdown into steps (filter → browse page) | 100-300 | Low-Med |
| **Filtering + Virtual Scroll** | Admin, power user, single unified list | 300-1000+ | Med |
| **Smart Tabs** (Option 6) + **Pagination** | Parent/child, high-touch (see due words, then all) | 100-200 | Low |
| **Smart Tabs** + **Virtual Scroll** | Same but faster UX for large lists | 400+ | Med |
| **Pinned** (Option 7) + **Filtering** | Power users with focus words + browse tail | 100+ | Low |
| **Grouped View** (Option 4) + **Filtering** | Tag-centric power users | 100-500 | High |

---

## Decision Framework

Ask these questions to narrow scope:

1. **Who is the primary user?**
   - Child (< 20 hanzi, not a problem)
   - Parent (50-200 hanzi, admin use case)
   - Platform admin (500+ hanzi, performance critical)

2. **What is the primary task when viewing all hanzi?**
   - "Show me what I need to review today" → Smart Tabs + Pagination
   - "Find word X and edit it" → Smart Search + Hanzi input
   - "Understand full inventory scope" → Grouped View
   - "Quick browse" → Virtual Scroll (feels like one list)

3. **Mobile first or desktop first?**
   - Mobile: Pagination or Virtual Scroll (both fit small screens)
   - Desktop: Any option works; consider power user workflows

4. **Is 100+ the target, or will it eventually hit 500+?**
   - 100-200: Filtering + Pagination is sufficient
   - 500+: Virtual Scroll or Grouped View required

5. **Do batch operations (tag editing, delete) must span pages?**
   - Yes → Virtual Scroll or Grouped View (single selection context)
   - No → Pagination (simpler, per-page batches)

---

## Recommended Next Step

**Before choosing**, confirm:
1. **Actual user behavior:** How often does a parent/admin access all-hanzi view? For 5 mins or 30 mins?
2. **Growth trajectory:** Will users typically have 100, 300, or 1000+ hanzi?
3. **Primary intent:** When opening `/words/all`, is user looking to **review soon** or **understand scope**?

Once clarified, pick one primary option and build; others can be layered in later (filtering + pagination both work standalone; either can be replaced with virtual scroll without breaking existing code).

