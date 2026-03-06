# Feature Spec — 2026-03-03 — Flashcard UI Redesign

_Status: Implementation In Progress_  
_Tier 1 Phase 1 Feature #3_

---

## Problem

Current flashcard review screen has issues that reduce learning effectiveness:

1. **Content hierarchy unclear** — Phrase and example (primary memorization targets) are de-emphasized versus character
2. **Pinyin missing from context** — Child can't easily see pronunciation while reviewing character, phrase, and example
3. **Excessive scrolling** — Content doesn't fit well in viewport; child has to scroll frequently to see all layers
4. **Font sizes are small** — Phrase and example text is too small to read comfortably and doesn't stand out
5. **Pinyin formatting inconsistent** — Pinyin appears inline or in parentheses; unclear visual structure

Result: Review sessions are less efficient; child doesn't effectively memorize the target words (phrases/examples).

---

## Scope

This spec covers the **flashcard review screen only** (`/words/review/flashcard`). This is a **review-focused interface**, not a grading interface.

### In scope

1. **Show/Hide detail toggle**
   - Flashcard defaults to **all content visible** (no progressive hiding)
   - Single show/hide toggle button (managed by parent component) to collapse/expand all phrase + example sections
   - Defaults to expanded (show); child can toggle if needed to reduce clutter

2. **Prioritized content layout**
   - **Hanzi** — Large, prominent (72px–120px depending on screen)
   - **Meaning** — Smaller, supporting information (14px)
   - **Multiple phrase-example pairs** — All phrases included in fill-test display together
   - Each phrase-example pair is in a **connected block** so child understands they're related
   - **Phrase with Pinyin** — **Large, prominent text** (20px+), with pinyin above in **smaller italic font** (12px)
   - **Example with Pinyin** — **Large, prominent text** (20px+), with pinyin above in **smaller italic font** (12px)
   - Phrases and examples are the primary memorization targets; sized and styled accordingly

3. **Phrase-Example Pairing**
   - Phrase and example are displayed together in the same visual block (not separated vertically)
   - Visual grouping (background box, border, or spacing) indicates they're a functional pair
   - If multiple phrases are included for testing, each phrase-example pair is its own block
   - Blocks are separated by clear vertical spacing (~16px gap between blocks)

4. **Data Source: Fill-Test Inclusion**
   - Flashcard displays **only phrases marked `include_in_fill_test: true`** on the Admin content page
   - If no phrases are marked for fill-test, show placeholder text ("No phrases included for testing")
   - Hanzi and meaning are always displayed; phrases are conditionally displayed

5. **Pinyin integration**
   - Pinyin displayed above phrase (above the hanzi/characters)
   - Pinyin displayed above example (above the hanzi/characters)
   - Format matches Admin content curation page: `pinyin` on its own line above the text, italicized, gray color (#888)

6. **Optimized scrolling and viewport**
   - Content layout fits within mobile viewport without requiring scroll in most cases
   - Spacing and padding reduced to minimize vertical height without sacrificing readability
   - If scroll is needed (e.g., very long example or many phrase-example pairs), scroll area is sized appropriately
   - No unnecessary margins or whitespace

7. **Responsive design**
   - Phone (320–480px): Optimized for small screens, font sizes adjusted, blocks stack vertically
   - Tablet (480–960px): Larger fonts, more breathing room, blocks may display side-by-side if space allows
   - Desktop (960px+): Full-width layout, spacious, blocks may display side-by-side
   - All breakpoints tested and verified

### Out of scope

1. **Grading buttons and grading flow** — Flashcard is review-only; grading happens on fill-test screen
2. **Swipe/gesture navigation** — Phase 1 uses toggle button only
3. **Audio playback of pinyin** — No sound integration
4. **Animated transitions** — Show/hide toggle is instant; animation is deferred
5. **Accessibility (a11y)** — Keyboard navigation and screen-reader annotation are deferred
6. **Dark mode** — App uses light theme for Phase 1
7. **Content changes** — No new fields are added to the `Word` or `flashcardContents` schema

---

## Proposed Behavior

### Visual Design

#### Default Layout (All Content Visible)

```
┌──────────────────────────────────┐
│                                  │
│            hàn                   │  ← Pinyin for character: 12px, italic, #888
│            汉                    │  ← Character: 88px, centered, bold
│         (character)              │
│                                  │
│  Meaning: 中文/English           │  ← 14px, supporting info
│                                  │
│  ┌────────────────────────────┐  │
│  │ hàn zú                     │  │  ← Pinyin for phrase: 12px, italic, #888
│  │ 汉族                       │  │  ← Phrase: 20px+, bold, prominent
│  │                            │  │
│  │ hàn zì                     │  │  ← Pinyin for example: 12px, italic, #888
│  │ 汉字是书写系统             │  │  ← Example: 20px+, bold, prominent
│  └────────────────────────────┘  │  ← All in same block; visual
│                                  │     grouping shows association
│  ┌────────────────────────────┐  │  ← If multiple phrases marked
│  │ [phrase 2 pinyin]          │  │     for testing, each as
│  │ [phrase 2 text]            │  │     separate block
│  │                            │  │
│  │ [example 2 pinyin]         │  │
│  │ [example 2 text]           │  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

- Screen background: light gray (#f5f5f5)
- Card background: white (#fff)
- Card has subtle shadow (4px blur, 2px offset, 10% black)
- **Character (Hanzi) has pinyin displayed directly above it** — 12px, italic, gray (#888)
- **Character is centered and prominent** (72px–120px depending on screen)
- **Phrase and Example are grouped in a visual block** (light background box #f9f9f9, or border, or card-within-card styling)
- **Phrase and Example are displayed together in one block** — Child understands they're associated
- **Phrase pinyin above phrase text; example pinyin above example text** — 12px italic, gray (#888)
- **Phrase and Example text is 20px–24px**, bold, easy to read
- Meaning is small and supporting; does not need to stand out
- **Multiple phrase-example pairs** — If the child's word profile includes multiple phrases marked for testing, each pair gets its own block with ~16px vertical gap between blocks
- **No phrases included for testing** — If no phrases are marked `include_in_fill_test: true`, show placeholder text ("No phrases included for testing")
- Entire card is visible without scrolling on most mobile devices

#### Block Layout (Single Phrase-Example Pair)

Each phrase-example block follows this structure:

```
┌──────────────────────────┐
│ hàn zí                   │  ← Phrase pinyin: 12px, italic, #888
│ 汉字                     │  ← Phrase text: 20px+, bold
│                          │
│ hàn zì                   │  ← Example pinyin: 12px, italic, #888
│ 汉字是书写系统           │  ← Example text: 20px+, bold
└──────────────────────────┘
```

- Block background: light (#f9f9f9) or white with subtle border/shadow
- Phrase and example are visually separated by a small line gap (~8px) but remain in the same container
- Phrase and example are **not labeled** ("Phrase:" / "Example:" text is omitted); only pinyin and text displayed
- Child understands they're a pair because they're in the same box and closely associated

#### State 2: Collapsed (Details Hidden)

```
┌──────────────────────────────────┐
│                                  │
│            hàn                   │  ← Pinyin
│            汉                    │  ← Character (same)
│         (character)              │
│                                  │
│  Meaning: 中文/English           │  ← Meaning (same)
│                                  │
│  (phrase-example blocks hidden)  │  ← Toggle button controlled by parent
│                                  │
└──────────────────────────────────┘
```

- All phrase-example blocks are hidden
- Toggle button (in parent FlashcardReviewSection) shows "Reveal details" text
- Child can tap to expand again
- Character and meaning remain visible
- Useful for quick character recognition without clutter

---

### Pinyin Formatting

Pinyin is displayed consistently above all text elements (character, phrase, example), matching the Admin content curation style:

**Character:**
```
hàn
汉
```

**Phrase (with Example in same block):**
```
hàn zú
汉族
[8px gap]
hàn zì
汉字是书写系统
```

Font specifications for all pinyin:
- **Font size:** 12px, italic, #888 (light gray), line-height 1.2
- **Placement:** Always above the corresponding hanzi/text on a separate line
- **No parentheses:** Pinyin appears in its own line, not inline or in parentheses

Font specifications for character, phrase, example text:
- **Character:** 72px–120px (responsive), bold or normal weight depending on font choice
- **Phrase/Example:** 20px–24px (responsive), normal weight, #333, line-height 1.4

---

### Multiple Phrase-Example Pairs

If a word has multiple phrases included in the fill-test, each pair displays in its own block:

```
┌────────────────────────┐
│ [Phrase 1 pinyin]      │
│ [Phrase 1 text]        │
│                        │
│ [Example 1 pinyin]     │
│ [Example 1 text]       │
└────────────────────────┘
   [16px gap between blocks]
┌────────────────────────┐
│ [Phrase 2 pinyin]      │
│ [Phrase 2 text]        │
│                        │
│ [Example 2 pinyin]     │
│ [Example 2 text]       │
└────────────────────────┘
```

- Each pair is in its own visual block (bordered or background-colored box)
- Vertical gap between blocks is ~16px for clear separation while maintaining visual grouping
- If scroll is needed (many phrases), child scrolls to see all pairs

---

### No Phrases Included for Testing

If no phrases are marked `include_in_fill_test: true` in the admin content:

```
┌──────────────────────────────────┐
│                                  │
│            hàn                   │
│            汉                    │
│                                  │
│  Meaning: 中文/English           │
│                                  │
│  No phrases included for testing │  ← Placeholder text, 14px, gray
│                                  │
│  [ Show Details ]                │
│                                  │
└──────────────────────────────────┘
```

- Placeholder message is displayed in place of phrase-example blocks
- Character and meaning are always shown
- Child understands no testing phrases are available for this word

---

### Responsive Breakpoints

| Breakpoint | Hanzi size | Phrase/Example size | Layout | Notes |
|---|---|---|---|---|
| **320–480px** (Mobile) | 72px | 20px | Single column, stacked | 16px card margin, tight spacing |
| **480–960px** (Tablet) | 100px | 22px | Single column, stretched | 32px card margin |
| **960px+** (Desktop) | 120px | 24px | Centered, max-width 700px | 48px card margin |

---

### No Grade Buttons

**Grade buttons are not on this screen.** Flashcard is review-only. Grading happens on a subsequent screen (out of scope for this redesign; defined in a separate spec).

---

## Layer Impact

### UI Layer (`src/app/words/review/flashcard/...`)

**New/Modified Components:**

1. **`FlashcardCard.tsx`** (new or refactored from `Flashcard.tsx`)
   - Props: `word: Word`, `flashcardContent: FlashcardLlmResponse`, `str: WordsLocaleStrings`, `pronunciationLabel: string`
   - No internal state — displays all content always (toggle controlled by parent)
   - Renders hanzi with pinyin, meaning, all phrase-example pairs with pinyin
   - No grading; this is display-only, receives content from parent

2. **`FlashcardReviewSection.tsx`** (existing component managing flashcard session)
   - Controls `flashcardRevealed` state (boolean) for show/hide toggle
   - Single "Reveal details" / "Hide details" button controls visibility of all FlashcardCard components
   - Defaults to `flashcardRevealed: true` (all content visible on load)
   - Passes toggle state to conditionally render FlashcardCard

3. **`flashcard.styles.css`** (new stylesheet or integration into existing)
   - Hanzi typography and centering (72px–120px, bold or normal)
   - Phrase and example typography (20px–24px, prominent)
   - Pinyin styling (12px, italic, gray #888)
   - Meaning typography (14px, supporting)
   - Card layout (white background, shadow, padding)
   - Breakpoint media queries

### Domain Layer (`src/lib/scheduler.ts`)

**No changes.** Flashcard is review-only; no interaction with scheduler.

### Service Layer (`src/lib/db.ts`)

**No changes.** Word retrieval remains unchanged. No grading call from this screen.

### Data Layer (IndexedDB)

**No schema changes.** Flashcard reads from `words` and `flashcardContents` tables as today.

---

## Grading Management (Out of Scope)

This redesign is **review-only**. Grading (progress tracking, scheduling updates) is managed exclusively through dedicated testing interfaces:

- **Fill-Test Reviews** — Child answers questions; accuracy is graded and reflected in scheduler
- **Future Test Types** — Additional test modalities (to be designed) will handle grading
- **Flashcard Review Screen** — Used only for content review and memorization; does not apply grades

This separation ensures:
- Review is uninterrupted by testing/grading UI
- Child focuses fully on memorization without pressure
- Grading accuracy is controlled by dedicated test interfaces
- Scheduler updates only when full test/assessment occurs (not during casual review)

---

## Edge Cases

### 1. Unknown or Missing Phrase-Example Content

**Scenario:** A `Word` has been added but the Admin has not yet created flashcard content for it (no phrases in `flashcardContents`).

**Behavior:**
- Character and meaning display normally
- Placeholder text shown: "No phrases included for testing"
- Child can still review the character; grading happens separately on fill-test

**Safeguard:** Content Admin ensures normalization before persistence; malformed data should not reach review (but is defensively handled if it does).

### 2. Multiple Phrases Included in Fill-Test

**Scenario:** A word has 5 phrases marked `include_in_fill_test: true` on the Admin page.

**Behavior:**
- Flashcard displays all 5 phrase-example pairs, each in its own visual block
- Blocks are separated by ~16px gap
- Child may need to scroll to see all pairs (vertical scrolling only, within the card)
- All pairs are visible with toggle expanded; all pairs hidden with toggle collapsed

### 3. Single Phrase Included in Fill-Test

**Scenario:** A word has only one phrase marked for testing.

**Behavior:**
- Single phrase-example block displays below meaning
- Block styling (border/background) is consistent with multi-phrase layout
- No visual difference; layout is prepared for multiple phrases even if only one exists

### 4. Phrase or Example Text Is Very Long

**Scenario:** Example text is longer than viewport width (e.g., "这是一个非常长的例子说明了如何使用这个汉字").

**Behavior:**
- Text wraps to multiple lines within the phrase-example block
- Block expands vertically to accommodate wrapped text
- If total card height exceeds viewport, vertical scroll is available within the card
- No horizontal scrolling

### 5. Missing Pinyin on Phrase or Example

**Scenario:** Admin content has no pinyin entry for a phrase or example.

**Behavior:**
- Phrase and example display normally without pinyin line
- No blank space reserved for missing pinyin; layout contracts naturally
- Child can still read and review the content

### 6. Unicode/Emoji in Phrase, Example, or Meaning

**Scenario:** User (or AI generation) includes emoji or unusual Unicode in content.

**Behavior:**
- Text renders as-is, assuming valid UTF-8 in database
- Font has fallback stack to handle CJK + English + emoji
- No truncation or filtering; persisted content is shown as stored

### 7. Toggle Button Repeatedly Clicked

**Scenario:** Child rapidly taps the Show/Hide toggle.

**Behavior:**
- Each click toggles the `isDetailsVisible` state immediately
- No debounce; state changes on every click
- No error or stalling; deterministic

### 8. Screen Rotation (Mobile)

**Scenario:** Device rotates from portrait to landscape while word is being reviewed.

**Behavior:**
- Toggle state is preserved (e.g., if details are hidden, remain hidden post-rotation)
- Font sizes and block layout re-render per new breakpoint
- No loss of state or error
- Phrase-example blocks may display side-by-side on landscape (if space allows) or remain stacked

### 9. Small Screens (< 320px)

**Scenario:** Very small devices (rare).

**Behavior:**
- Character size is clamped to 72px minimum (no smaller)
- Phrase and example font-size clamped to 18px minimum
- Padding reduced to essential amounts
- Blocks stack vertically (no side-by-side layout)
- Spec does not guarantee perfect rendering below 320px

### 10. Browser Back/Forward

**Scenario:** User presses browser back button during review.

**Behavior:**
- Toggle state is **not** persisted in URL or session storage
- User is navigated to `/words/review` (main review screen or word list)
- Next word load starts fresh with toggle defaulted to "show" (visible)

---

## Risks

### Risk 1: Scroll Requirement with Multiple Phrases

**Risk:** If a word has many phrases (5+) marked for testing, combined with scrollable mobile viewport, child must scroll to see all phrases. Scrolling may feel tedious.

**Mitigation:**
- Keep phrase-example block padding minimal (12px instead of 16px on mobile)
- Character size defaults to 72px on mobile (72px–88px range, not larger)
- Phrase and example font-size clamped to 20px minimum (not 24px)
- Test on actual devices with real words to validate fit and scroll frequency
- If most words have ≤3 phrases, scrolling is rarely needed; flag if outliers exist

### Risk 2: Phrase-Example Block Styling Ambiguity

**Risk:** If phrase-example block doesn't have clear visual grouping, child might think phrase and example are separate items.

**Mitigation:**
- Use consistent visual treatment: background box, border, or shadow to group pair
- Add ~8px internal gap between phrase and example to separate visually while keeping in same block
- No "Phrase:" / "Example:" label text; visual grouping alone indicates association
- Test with real child (age 5–8) to confirm pairing is intuitive

### Risk 3: Phrase Filtering (`include_in_fill_test`) Implementation

**Risk:** Phrases marked `include_in_fill_test: false` must not render on flashcard, but are still in database. Risk of accidentally showing all phrases or none.

**Mitigation:**
- Filter logic lives in component: `flashcardContents.phrases.filter(p => p.include_in_fill_test === true)`
- Add defensive placeholder if filtered result is empty
- Write unit test for filtering logic (test with 5 phrases, 3 marked for testing, verify only 3 render)
- Admin content page enforces `include_in_fill_test` toggle; review data quality before rollout

### Risk 4: Very Long Phrase-Example Pair

**Risk:** If both phrase AND example are very long (10+ characters each), vertical height swells quickly on mobile with many pairs.

**Mitigation:**
- Keep gap between phrase and example blocks small (~8px)
- Reduce line-height for example text slightly (1.3–1.4) if needed
- Test on iPhone SE / older Android with 5 average-length phrases to verify scroll frequency
- If still too tall, consider lazy-loading phrases below the fold (deferred to Phase 2)

### Risk 5: Pinyin Format Mismatch Between Admin and Display

**Risk:** Pinyin format in `flashcardContents` may not match expected format; data inconsistency causes display issues.

**Mitigation:**
- Content Admin normalization must enforce consistent pinyin format before persistence
- Flashcard UI simply displays what's stored; no format transformation
- Document pinyin field specifications in Admin content spec (e.g., "hàn" not "han4" or "han<4>")
- Review admin generation output carefully to ensure pinyin is consistent

### Risk 6: Toggle Button Visibility and Usefulness

**Risk:** Toggle button visibility may be overlooked by child. If default is show, child rarely uses toggle, making it unclear.

**Mitigation:**
- Toggle button defaults to showing details (expanded state)
- Child rarely needs to hide details; default expanded is sufficient for most reviews
- Button is primary control for flashcard reveal; always visible and prominent
- No redundant buttons — single control point eliminates confusion

### Risk 7: Performance with Many Phrase-Example Pairs

**Risk:** Rendering 10+ phrase-example pairs might cause jank if DOM is not optimized or virtualized.

**Mitigation:**
- Toggle uses CSS class changes (no React re-render overhead if component memoized correctly)
- Content is pre-fetched from IndexedDB (no async delays)
- No images, animations, or heavy calculations
- Test on older devices (5-year-old tablets) with 10+ phrases to validate smoothness
- If jank occurs, consider virtualization or pagination (deferred to Phase 2)

---

## Test Plan

### Unit Tests (Component-level)

1. **`FlashcardCard` Content Rendering**
   - Character renders from `word.hanzi`
   - Character pinyin renders from `pronunciationLabel`
   - Meaning renders from `flashcardContent.meanings[0].definition`
   - **Filter phrases: only render those where `include_in_fill_test: true`**
   - Each phrase renders pinyin from `phrase.pinyin` and text from `phrase.phrase`
   - Each example renders pinyin from `phrase.example_pinyin` and text from `phrase.example`
   - Phrase and example appear in same visual block (grouped, not separated)
   - If no phrases marked for testing, show placeholder text ("No phrases included for testing")
   - Missing content shows placeholder text (not blank)

2. **Pinyin Display**
   - Pinyin is italicized and gray (#888)
   - Pinyin appears above character, phrase, and example (separate line, not inline)
   - Character pinyin font-size is 12px (smaller than character)
   - Phrase pinyin font-size is 12px (smaller than phrase)
   - Example pinyin font-size is 12px (smaller than example)
   - No pinyin in parentheses; all pinyin on separate line

3. **FlashcardReviewSection Toggle State**
   - Default render shows flashcard when `flashcardRevealed: true`
   - Click toggle button → flashcard details hidden (`flashcardRevealed: false`)
   - Click toggle button again → flashcard details visible (`flashcardRevealed: true`)
   - Toggle state persists across word navigation changes within same session

### Integration Tests

5. **Full Review Flow**
   - Load word from database
   - Flashcard displays character with pinyin, meaning, phrase-example blocks with pinyin
   - Toggle details on/off multiple times using parent component button
   - Navigate to next word (flow defined in separate testing spec)
   - Toggle state persists within session

6. **Content Display**
   - Character pinyin, meaning, phrase-example blocks (with pinyin) render from `flashcardContents` table
   - Pinyin displays above corresponding text, not inline or in parentheses
   - Phrase and example are in same block (grouped visually)
   - Missing content shows placeholder (not blank or error)
   - Long text wraps correctly without horizontal scroll

7. **Fill-Test Inclusion**
   - Only phrases marked `include_in_fill_test: true` are displayed
   - Phrases marked `false` are not displayed (hidden)
   - If no phrases marked for testing, placeholder text shows ("No phrases included for testing")
   - Multiple phrases each display in their own block with ~16px gap between blocks

8. **Scroll Behavior**
   - On mobile, character + meaning fits without scroll
   - If many phrase-example blocks exist, vertical scroll is available
   - If scroll is needed, it's smooth and only vertical
   - Character with pinyin remains visible and readable while scrolling

### Visual Regression Tests

9. **Responsive Layout**
   - Screenshot comparison at 320px, 480px, 960px+ breakpoints
   - Character size: ≥ 72px (mobile), ≥ 100px (tablet), ≥ 120px (desktop)
   - Phrase/example size: ≥ 20px (mobile), ≥ 22px (tablet), ≥ 24px (desktop)
   - Phrase-example blocks are grouped visually (background box, border, or card styling)
   - Spacing and padding verified; no unexpected layout shift
   - Multiple phrase-example blocks separated by ~16px gap

10. **Typography**
   - Character is bold or normal weight depending on font choice
   - Pinyin (character, phrase, example) is italic and gray (#888), appears above text
   - Phrase and example are prominent and easy to read
   - Character is visually distinct from supporting content
   - Phrase and example are visually grouped (same block)

### Manual Testing

11. **Child Usability**
   - Real child (age 5–10) reviews a 10-word session with varying phrase counts (0, 1, and 5+ phrases)
   - Child can easily read all content without strain
   - Character size is appropriate (not too large, not too small)
   - Phrase and example are the clear focus (grouped in same block, larger than supporting text)
   - Child understands phrase-example pairing (visual grouping is clear)
   - If multiple phrases, child can scroll to see all and understands they belong to same word
   - Toggle button is optional (child doesn't use it often, but works if needed)

## Acceptance Criteria

- [ ] Flashcard displays all content by default (character with pinyin, meaning, phrase-example blocks with pinyin)
- [ ] Character has pinyin displayed **above it on a separate line** (12px, italic, gray #888)
- [ ] Phrase-example blocks are grouped visually (same box, border, or background color)
- [ ] Phrase has pinyin displayed **above it on a separate line** (12px, italic, gray #888)
- [ ] Example has pinyin displayed **above it on a separate line** (12px, italic, gray #888)
- [ ] Phrase and example appear together in same block (not separated vertically)
- [ ] **No pinyin in parentheses** — all pinyin appears as separate line above text
- [ ] **Only phrases marked `include_in_fill_test: true`** are displayed as blocks
- [ ] If no phrases marked for testing, placeholder text shows ("No phrases included for testing")
- [ ] Multiple phrase-example blocks separated by ~16px gap
- [ ] Character is **≥ 72px** on mobile, **≥ 100px** on tablet, **≥ 120px** on desktop
- [ ] Phrase and example text is **≥ 20px** and visually prominent (bold or high contrast)
- [ ] Single show/hide toggle button exists in parent component; defaults to "Hide Details" (content visible)
- [ ] Clicking toggle hides all phrase-example blocks; click again shows them
- [ ] Character and meaning always visible; only phrase-example blocks toggle
- [ ] FlashcardCard component receives content from parent and displays all details always (no internal toggle)
- [ ] Card content fits within mobile viewport without requiring scroll in most cases
- [ ] If scroll is needed, it scrolls only vertically within the card
- [ ] Responsive layout verified at 320px, 480px, 960px+ breakpoints
- [ ] **No grading buttons present** on this screen (grading managed by fill-tests and future tests)
- [ ] No TypeScript errors; all components have explicit return types
- [ ] All user-facing strings are in `app.strings.ts` (bilingual support ready)
- [ ] Tests pass: content rendering, toggle state, pinyin formatting, phrase grouping, fill-test inclusion, responsive layout
- [ ] No changes to scheduler logic or IndexedDB schema
- [ ] Spec is updated with implementation notes upon completion

---

## Open Questions

1. **Pinyin field in flashcardContents?** Spec assumes `characterPinyin`, `phrasePinyin`, and `examplePinyin` fields exist. Confirm schema supports these or define pinyin parsing rules if stored inline or in comments.

2. **Phrase-example block styling?** Spec suggests background box (#f9f9f9), border, or card-within-card. What visual treatment best shows association? (background, border, shadow, spacing?)

3. **Bilingual toggle labels?** "Hide Details" / "Show Details" are in English. Should this be bilingual ("Hide Details / 隐藏详情")?

4. **Character font choice — serif or sans-serif?** Spec assumes system font stack. Should we use a custom serif font (e.g., Noto Serif CJK) for better character clarity on small screens?

5. **Line height and spacing for pinyin above text?** Spec assumes pinyin is on a separate line above the text. Confirm this doesn't create awkward gaps on short text or large fonts.

6. **Side-by-side phrase-example layout on landscape/tablet?** Spec mentions blocks may display side-by-side if space allows. How wide should each column be? (50% each? Or should blocks always stack vertically for Phase 1?)

---

## Definition of Done

1. Code review passes (TypeScript strict, design patterns, naming)
2. All 11 test categories above are passing
3. Manual testing with real child (or proxy) is successful
4. Responsive design verified on 3+ device sizes (phone, tablet, desktop)
5. No regression in word retrieval, database, or scheduler behavior
6. Pinyin displays correctly above character, phrase, and example (no parentheses or inline formatting)
7. Phrase-example blocks are visually grouped and clearly associated
8. Only phrases marked `include_in_fill_test: true` are displayed; filter logic is correct
9. Spec is marked ✅ Complete and roadmap is updated to 🔄 In Progress → ✅ Done

---

## Implementation Notes

### Changes Made (2026-03-03)

1. **Default State**: Changed `flashcardRevealed` default from `false` to `true` across all initialization paths:
   - Initial hook state in `useFlashcardReviewState.ts`
   - Session initialization in flashcard effect
   - Word advancement in `resetFlashcardWordState()`
   - **Result:** Flashcard defaults to showing all details (character, meaning, phrase-example blocks)

2. **Removed Redundant Toggle**: Eliminated internal toggle button from `FlashcardCard.tsx`:
   - Removed `useState` for local `isDetailsVisible` state
   - Removed button UI from card render
   - Phrase-example blocks now render unconditionally when component is rendered
   - **Result:** Single control point in parent `FlashcardReviewSection` (the "Reveal details" button)

3. **Parent Component Control**: `FlashcardReviewSection` now fully controls visibility:
   - `flashcardRevealed` state manages whether FlashcardCard is rendered
   - Toggle button shows "Hide details" (当 `flashcardRevealed: true`) or "Reveal details" (当 `flashcardRevealed: false`)
   - Clean responsibility separation: parent controls toggle, card displays content
