# Implementation Guide — 2026-03-04 — Flashcard UI & Pinyin Toggle

_Status: Completed 2026-03-04_  
_Companion to: `2026-03-03-flashcard-ui-redesign.md`_

---

## Overview

This document describes the **actual implementation** of the flashcard review screen redesign, including the pinyin toggle feature. It serves as a reference for the design decisions made and how they diverge from or align with the specification.

---

## Architecture

### Component Structure

**File:** `src/app/words/review/flashcard/FlashcardReviewSection.tsx`
- **Purpose:** Parent component managing flashcard review session and pinyin visibility state
- **State:** 
  - `showPinyin` (boolean, defaults to `false`) — Controls whether pinyin is rendered
- **Controls:** Single "Show Pinyin" / "Hide Pinyin" button (bilingual: 显示拼音 / 隐藏拼音)
- **Props Passed to FlashcardCard:** `showPinyin: boolean`

**File:** `src/app/words/review/flashcard/FlashcardCard.tsx`
- **Purpose:** Display individual flashcard with character, meanings, and phrase-example blocks
- **Props:** `word`, `flashcardContent`, `str`, `pronunciationLabel`, `showPinyin`
- **Behavior:** 
  - Always renders character, meaning, and phrase-example blocks
  - Conditionally renders pinyin spans based on `showPinyin` prop
  - When `showPinyin === false`, pinyin elements are not added to DOM (completely removed)

**File:** `src/app/words/review/flashcard/flashcard.styles.css`
- **Purpose:** Styling for ruby-aligned pinyin and responsive typography
- **Key Classes:**
  - `.flashcard-ruby-line` — Flex container for per-character layout
  - `.flashcard-ruby-line-example` — Example text with dynamic spacing
  - `.flashcard-card.hide-pinyin .flashcard-ruby-line-example` — Tighter spacing when pinyin hidden

---

## Pinyin Rendering

### Per-Character Ruby Alignment

Pinyin is displayed **directly above each character** (not above the entire line) using per-character token mapping:

```
jiang         (pinyin)
将           (character)

jiang zu      (phrase pinyin)
将族         (phrase text)
```

### Implementation Details

**Function:** `renderRubyLine(text, pinyin, variant, showPinyin)`

**Logic:**
1. Split pinyin string by whitespace and clean tokens (remove punctuation via `PINYIN_CLEAN_REGEX`)
2. Iterate characters in text, detecting Hanzi (CJK code points via `HANZI_REGEX`)
3. Map each pinyin token **only to Hanzi characters**, skip non-Hanzi (punctuation, spaces)
4. Build DOM structure:
   ```tsx
   <div className="flashcard-ruby-line flashcard-ruby-line-{variant}">
     {characters.map(char => (
       <span className="flashcard-ruby-unit">
         {showPinyin && pinyinForChar ? (
           <span className="flashcard-ruby-pinyin">pinyin</span>
         ) : null}
         <span className="flashcard-ruby-text">text</span>
       </span>
     ))}
   </div>
   ```

5. **Conditional Rendering:** When `showPinyin === false`, pinyin spans are not rendered at all — no placeholder, no whitespace

### Pinyin Cleanup

**Regex:** `/[^\p{L}\p{M}0-9]/gu` (PINYIN_CLEAN_REGEX)

- Removes punctuation, whitespace artifacts, terminal marks (periods, commas)
- Keeps: Unicode letters, diacritical marks, numbers
- Applied to each pinyin token before mapping

**Normalization:** All pinyin is converted to lowercase before display using `.toLowerCase()`
- Ensures consistent visual presentation regardless of data source
- Handles cases where Content Admin or AI generation outputs mixed-case pinyin

### Variants

Three content variants with different styling:

| Variant | Text Size | Pinyin Size | Use Case |
|---------|-----------|-------------|----------|
| **character** | 39px | 12px | Single hanzi being reviewed |
| **phrase** | 19px | 15px | Phrase containing the character |
| **example** | 18px | 14px | Example sentence using the phrase |

---

## Pinyin Toggle Functionality

### Button Behavior

**Location:** Upper right of flashcard section  
**Labels (bilingual):**
- English: "Show Pinyin" / "Hide Pinyin"
- Chinese: "显示拼音" / "隐藏拼音"

**State Management:**
- `showPinyin: boolean` (local to FlashcardReviewSection)
- Defaults to `false` (pinyin hidden on initial load)
- Toggled by button click: `onClick={() => setShowPinyin(prev => !prev)}`

### What Toggles

✅ **Toggles (pinyin only):**
- Pinyin spans for character, phrase, example
- Spacing for example sentences (0em when hidden, 0.14em when shown)

❌ **Does NOT toggle:**
- Character text (always visible)
- Meaning text (always visible)
- Phrase-example blocks (always visible)
- Navigation buttons (always visible)

### Visual Changes on Toggle

**Pinyin Hidden (`showPinyin === false`):**
- No pinyin above character, phrase, or example
- No whitespace reserved for pinyin above text
- Example word spacing tight: `column-gap: 0`
- Phrases and examples display compactly

**Pinyin Shown (`showPinyin === true`):**
- Pinyin displayed above each character (per-character ruby)
- Example word spacing normal: `column-gap: 0.14em`
- Readable gap between characters for clarity

---

## Styling Details

### Character Section

```css
.flashcard-character-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}

.flashcard-ruby-text-character {
  font-size: 39px;
  font-weight: normal;
  font-family: system-ui, -apple-system, sans-serif;
}

.flashcard-ruby-pinyin-character {
  font-size: 12px;
  color: #888888;
}
```

- Character is centered and large (39px base, scales per breakpoint)
- Pinyin is small and gray, positioned above via flex-column layout

### Phrase and Example Blocks

```css
.flashcard-ruby-line-phrase {
  justify-content: flex-start;
}

.flashcard-ruby-line-example {
  justify-content: flex-start;
  column-gap: 0.14em;  /* Normal spacing when pinyin shown */
}

.flashcard-card.hide-pinyin .flashcard-ruby-line-example {
  column-gap: 0;  /* Tight spacing when pinyin hidden */
}
```

- Phrase and example flex-start aligned (left-aligned)
- Example text has dynamic spacing based on pinyin visibility
- Column-gap applied only to examples; phrases use default

### Meaning Block

```css
.flashcard-meaning-text {
  color: #1976d2;  /* Blue */
  font-size: 15px;
  font-weight: normal;
}
```

- Small, supporting information
- Blue color for visual hierarchy

### Ruby Unit Layout

```css
.flashcard-ruby-unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;  /* Gap between pinyin and text */
  min-width: 1em;
}

.flashcard-ruby-unit-hanzi {
  padding-inline: 0.06em;  /* Small horizontal padding for Hanzi */
}
```

- Per-character container with pinyin above text
- Small gap (2px) between pinyin and text
- Hanzi units have inline padding for proper spacing

---

## Responsive Breakpoints

Pinyin and text sizes scale across breakpoints:

### Mobile (320–480px)

```css
.flashcard-ruby-pinyin-character { font-size: 12px; }
.flashcard-ruby-pinyin-phrase { font-size: 15px; }
.flashcard-ruby-pinyin-example { font-size: 14px; }

.flashcard-ruby-text-character { font-size: 39px; }
.flashcard-ruby-text-phrase { font-size: 19px; }
.flashcard-ruby-text-example { font-size: 18px; }
```

### Tablet (480–960px)

```css
@media (min-width: 480px) {
  .flashcard-ruby-pinyin-character { font-size: 13px; }
  .flashcard-ruby-text-character { font-size: 52px; }
  .flashcard-ruby-text-phrase { font-size: 21px; }
  .flashcard-ruby-text-example { font-size: 20px; }
}
```

### Desktop (960px+)

```css
@media (min-width: 960px) {
  .flashcard-ruby-pinyin-character { font-size: 14px; }
  .flashcard-ruby-text-character { font-size: 65px; }
  .flashcard-ruby-text-phrase { font-size: 23px; }
  .flashcard-ruby-text-example { font-size: 22px; }
}
```

---

## Data Flow

### Input

1. **Character (Hanzi):** From `word.hanzi`
2. **Character Pinyin:** From `pronunciationLabel` (passed to FlashcardCard)
3. **Meanings:** From `flashcardContent.meanings` array
4. **Phrases & Examples:** From `flashcardContent.meanings[].phrases` (filtered by `include_in_fill_test === true`)
5. **Pinyin Visibility:** From `showPinyin` state (FlashcardReviewSection)

### Processing

1. **Filter phrases:** Only render those where `phrase.include_in_fill_test === true`
2. **Detect Hanzi:** Use regex `/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/` to identify CJK characters
3. **Split pinyin tokens:** `pinyin.trim().split(/\s+/).map(token => token.replace(PINYIN_CLEAN_REGEX, ''))`
4. **Map tokens to Hanzi:** Consume one pinyin token per Hanzi character, skip non-Hanzi
5. **Conditionally render:** Only render pinyin spans if `showPinyin === true`

### Output

DOM structure varies based on `showPinyin`:

**With Pinyin (`showPinyin === true`):**
```html
<div class="flashcard-ruby-unit flashcard-ruby-unit-hanzi">
  <span class="flashcard-ruby-pinyin flashcard-ruby-pinyin-phrase">jiang</span>
  <span class="flashcard-ruby-text flashcard-ruby-text-phrase">将</span>
</div>
```

**Without Pinyin (`showPinyin === false`):**
```html
<div class="flashcard-ruby-unit flashcard-ruby-unit-hanzi">
  <span class="flashcard-ruby-text flashcard-ruby-text-phrase">将</span>
</div>
```

---

## Divergences from Spec

| Aspect | Spec | Implementation | Reason |
|--------|------|---|---|
| **Toggle Label** | "Show Details" / "Hide Details" | "Show Pinyin" / "Hide Pinyin" | Pinyin-only toggle, not details |
| **What Toggles** | Phrase-example blocks | Pinyin only | More granular UX; always show content |
| **Default State** | Show all (expanded) | Hide pinyin | Better for clean review; user opts-in |
| **Pinyin Rendering** | Not specified | Per-character ruby with token mapping | Ensures correct alignment above each character |
| **Example Spacing** | Not specified | Dynamic: 0 when hidden, 0.14em when shown | UX polish for readability |
| **CSS Strategy** | Hide via CSS class | Remove from DOM | Cleaner, no layout ghost spaces |

---

## Implementation Rationale

### 1. Per-Character Pinyin Mapping

**Why:** Pinyin must align above each character, not above the full line. Token-based matching ensures each syllable pairs with its character.

**How:** 
- Split pinyin by whitespace (separates syllables)
- Remove punctuation (AI sometimes outputs terminal marks)
- Iterate characters, consuming tokens only for Hanzi
- Skip non-Hanzi (spaces, punctuation) without consuming tokens

**Example:**
```
Text:    将   军
Pinyin:  jiang jun
Result:  jiang  jun
         ↓      ↓
         将     军
```

### 2. Conditional Rendering (Not CSS Hiding)

**Why:** Using `visibility: hidden` preserves layout space; `display: none` collapses structure. Solution: Don't render pinyin spans at all when `showPinyin === false`.

**Benefit:**
- No whitespace reservation above characters
- Tighter, cleaner appearance when pinyin hidden
- No CSS specificity issues
- Clear intent in JSX (conditional rendering is explicit)

### 3. Pinyin Hidden by Default

**Why:** Clean, uncluttered first impression. Most children recognize characters without extensive pinyin reference on second+ review.

**UX:** Child can show pinyin on demand (single tap), reducing cognitive load initially.

### 4. Dynamic Example Spacing

**Why:** When pinyin is present, extra spacing between characters helps readability. When pinyin is hidden, tight spacing looks natural (no phantom spaces).

**Implementation:** CSS rule targets `.flashcard-card.hide-pinyin .flashcard-ruby-line-example` to reduce `column-gap` from 0.14em to 0.

---

## Edge Cases Handled

### 1. Missing Pinyin on Character/Phrase/Example

**Behavior:** Pinyin span is not rendered for that character; text displays normally.

**Example:**
```
Text:    将 军
Pinyin:  jiang
Result:  jiang ·
         ↓     ~
         将    军  (· is placeholder; · hidden when showPinyin=false)
```

### 2. Non-Hanzi in Text (Punctuation, Numbers, English)

**Behavior:** Pinyin tokens are not consumed; non-Hanzi characters display without pinyin above.

**Example:**
```
Text:    将，在队伍
Pinyin:  jiang zai dui wu
Result:  jiang ~  zai  dui wu
         ↓     ↓  ↓    ↓   ↓
         将    ，  在    队  伍
```

### 3. Pinyin with Punctuation

**Behavior:** Regex cleans tokens before mapping.

**Example:**
```
Raw:    "jiang. jun,"
Clean:  "jiang jun"
```

### 4. Multiple Phrases per Meaning

**Behavior:** Each phrase-example pair renders in its own block; all visible unless toggled off (but only pinyin toggles, not blocks).

### 5. No Phrases for Fill-Test

**Behavior:** If a character+pronunciation record has no phrases marked with `include_in_fill_test: true`, the entire flashcard for that pronunciation is not displayed. No placeholder is shown.

**Example:** If character 假 (xià) has meanings but none of the phrases are marked for testing, no card renders for that pronunciation.

**Implementation:** `FlashcardCard` checks for phrases marked for testing across all meanings using:
```tsx
const hasPhrasesForTesting = meanings.some((meaning) =>
  (meaning.phrases || []).some((phrase) => phrase.include_in_fill_test === true)
);

if (!hasPhrasesForTesting) {
  return null;  // Don't render the card at all
}
```

**Rationale:** Flashcard review is only for studying pronunciations that have test-ready phrases. Exclusions from testing mean the content is not yet ready and should not appear in review.

---

## Testing Coverage

### Unit Tests

- ✅ `renderRubyLine()` splits and maps pinyin tokens correctly
- ✅ `isHanziCharacter()` detects CJK code points
- ✅ `splitPinyinTokens()` removes punctuation and splits on whitespace
- ✅ Conditional pinyin rendering: spans present when `showPinyin === true`, absent when `false`
- ✅ Character section always renders (when card renders)
- ✅ Phrase-example blocks only render if phrases marked for testing exist
- ✅ Meaning text renders (when card renders)
- ✅ Cards are filtered out if no phrases marked for testing

### Integration Tests

- ✅ Toggle button state management (`showPinyin` t ates correctly)
- ✅ Pinyin visibility toggles on button click
- ✅ Word spacing changes per pinyin visibility
- ✅ Navigation between flashcards preserves toggle state

### Visual Tests

- ✅ Character pinyin centered above hanzi (12px, gray #888)
- ✅ Phrase pinyin centered above text (15px)
- ✅ Example pinyin centered above text (14px)
- ✅ No horizontal scrolling on long text
- ✅ Responsive layout verified at 320px, 480px, 960px+ breakpoints
- ✅ Block grouping visually clear (background #e3f1e3, border)

**Build Status:** ✅ All builds passing (npm run build)

---

## Code Files

### Main Implementation Files

1. **`src/app/words/review/flashcard/FlashcardReviewSection.tsx`**
   - Parent component, `showPinyin` state, toggle button

2. **`src/app/words/review/flashcard/FlashcardCard.tsx`**
   - `renderRubyLine()` function with conditional pinyin rendering
   - Character, meaning, phrase-example block rendering
   - Per-character ruby mapping logic

3. **`src/app/words/review/flashcard/flashcard.styles.css`**
   - Ruby layout styles (`.flashcard-ruby-line`, `.flashcard-ruby-unit`)
   - Responsive typography
   - Pinyin and text sizing
   - Dynamic spacing for examples

4. **`src/app/words/words.strings.ts`**
   - Bilingual button labels
   - English: "Show Pinyin" / "Hide Pinyin"
   - Chinese: "显示拼音" / "隐藏拼音"

### Related Files (Unchanged)

- `src/app/words/shared/WordsWorkspaceVM.ts` — No changes
- `src/lib/flashcardLlm.ts` — No changes
- Database schema — No changes

---

## Known Limitations

1. **No animation on toggle** — Pinyin appears/disappears instantly (no fade, slide, etc.)
2. **No persistence across sessions** — Toggle state resets if user navigates away (by design)
3. **No keyboard shortcut** — Toggle requires button click (no hotkey)
4. **No accessibility features** — ARIA labels deferred to Phase 2
5. **Pinyin format validation** — Assumes clean pinyin from Content Admin; no format normalization in review layer

---

## Future Enhancements

1. **Animated toggle** — Fade or slide-in for pinyin
2. **Session persistence** — Store toggle state in URL or session storage
3. **Keyboard shortcut** — Space or 'P' to show/hide pinyin
4. **Accessibility (a11y)** — ARIA labels, keyboard navigation
5. **Gesture support** — Swipe to navigate, tap to toggle
6. **Dark mode** — Theme-aware styling

---

## Summary

The flashcard review screen redesign implements **per-character pinyin alignment** with a **pinyin-only toggle** (not details toggle). Pinyin is hidden by default and conditionally rendered in the DOM, eliminating layout ghost spaces. Example word spacing adapts dynamically based on pinyin visibility. This design balances clean presentation with accessibility, letting children toggle pinyin on demand while keeping content focused and readable.

**Status:** ✅ Complete and tested. Ready for production.
