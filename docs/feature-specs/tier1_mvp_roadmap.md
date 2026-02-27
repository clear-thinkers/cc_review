# TIER1_MVP_ROADMAP.md

## Scope

Tier 1 MVP focuses on strengthening:

- Memory quality
- Content control
- Review clarity
- Feedback loops
- Motivation layer

Tier 2 (text-level context) is explicitly out of scope.

---

# 1. Admin-Configurable LLM Prompts

## Goal
Increase transparency and control over AI-generated content.

## Feature

Create a new page:
`/words/prompts`

Accessible from:
Content Admin page.

## Capabilities

- View current system prompts
- Edit prompt templates
- Save updated versions
- Load previous versions
- Reset to default

## Requirements

- Store prompts in IndexedDB (local-first)
- Version history support (timestamped)
- Safe fallback to default prompts
- Clear separation between:
  - Full generation
  - Phrase generation
  - Example generation
  - Pinyin generation

## Success Criteria

- Admin can iterate on content quality without touching code
- Prompt changes affect only future generations
- Review sessions remain deterministic (saved content only)

---

# 2. Character Level Tagging System

## Goal
Allow structured progression (e.g., Grade 1, Grade 2).

## Feature

Add `level` metadata to `Word`.

## Management UI

On All Characters page:

- Assign level tag (e.g., Grade 1, Grade 2)
- Bulk edit support (future)
- Filter by level

## Review Impact

- During review, user can choose:
  - All
  - Specific level

## Content Admin Update

Add level filter:
- Filter targets by selected level

## Requirements

- Level stored in `Word`
- Default level = undefined
- Filtering does not alter scheduler

## Success Criteria

- Parent can control difficulty bands
- Review scope can be constrained without data duplication

---

# 3. Flashcard UI Redesign

## Goal
Reduce cognitive overload and improve child usability.

## Improvements

- Larger hanzi display
- Clear separation:
  - Character
  - Meaning
  - Phrase
  - Example
- Progressive reveal (tap to show)
- Reduce dense text blocks
- Clear primary action button

## Design Principles

- One focus per screen
- Fewer simultaneous elements
- Large touch targets
- Minimal distractions

## Success Criteria

- Easier to follow for early readers
- Less scrolling
- Faster session flow

---

# 4. Fill-Test UI Redesign + Optional Pinyin Support

## Goal
Improve accessibility while preserving retrieval difficulty.

## Features

- Toggle: “Show Pinyin”
- Default OFF
- When ON:
  - Pinyin displayed above blank
  - Or small assist hint

## UI Improvements

- Clear blank focus
- Larger font
- Cleaner spacing
- Fewer simultaneous blanks (Tier 1 only single-blank)

## Requirements

- Pinyin toggle must not affect grading logic
- UI-only assist

## Success Criteria

- Reduced frustration
- Gradual difficulty control

---

# 5. Review and Revise Grading Logic

## Goal
Ensure scheduler reflects true mastery.

## Review Areas

- Ease adjustment rules
- Interval growth curve
- Failure penalty
- Early review behavior
- Fill-test vs flashcard weighting

## Deliverables

- Document grading model
- Add tests for edge cases
- Ensure no silent regression

## Success Criteria

- Stable long-term retention curve
- Predictable progression

---

# 6. Quiz Results Summary Section

## Goal
Provide visibility into performance and progress.

## New Page

`/words/results`

## Features

- Session history list
- Date
- Type (flashcard / fill-test)
- Accuracy
- Words reviewed
- Words failed
- Coins earned

## Data Model

New table:
`quizSessions`

Fields:
- id
- type
- timestamp
- accuracy
- wordIds
- coinsEarned

## Success Criteria

- Parents can review progress
- Kids see improvement history
- Foundation for rewards layer

---

# 7. Rewards Flow (Gamified Layer)

## Goal
Increase motivation without undermining memory rigor.

## Phase 1 Scope

- Coins awarded after each quiz
- Based on:
  - Accuracy
  - Completion
  - Streak bonus (future)

- Display coins in results summary

## Virtual Shop System

Start simple:

### World Structure

- One land area
- One shop: Bakery

### Shop Customization

Kids can purchase:
- Bakery furniture
- Bakery display shelves
- Bread
- Cakes
- Decorative items

## Data Model

New tables:

`wallet`
- totalCoins

`inventory`
- purchasedItems[]

`shopState`
- placedItems[]

## Rules

- Coins only earned from review
- No real money
- No scheduler impact

## Success Criteria

- Reward loop reinforces consistency
- Visual progress motivates continued practice
- Does not distract from core review flow

---

# Priority Order Recommendation

Phase 1 (Stability & Control)
1. Prompt configuration page
2. Grading logic audit
3. Flashcard UI redesign

Phase 2 (Structure & Visibility)
4. Level tagging
5. Results summary

Phase 3 (Motivation Layer)
6. Fill-test UI improvements
7. Rewards system (bakery MVP)

---

# Tier 1 MVP Completion Definition

Tier 1 is complete when:

- Content quality is controllable
- Scheduling is stable and predictable
- Review UI is child-friendly
- Progress is visible
- Motivation loop exists
- Architecture remains modular

Only after this is stable should Tier 2 begin.