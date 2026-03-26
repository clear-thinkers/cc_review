# Feature Spec — 2026-03-04 — Coin Rewards System

_Status: ✅ Done_  
_Tier 1 Phase 3 Feature #7 (Rewards System — Bakery MVP Foundation)_  
_Completed: 2026-03-04_

---

## Problem

Currently, quiz completion provides no extrinsic motivation or progress visibility beyond test accuracy. Children have no incentive to complete sessions or improve performance, and no mechanism to accumulate rewards for motivation.

---

## Scope

This spec covers the **coin rewards calculation and display layer** — the foundation for the broader Bakery MVP. It defines:

1. **Coin earning logic** per quiz grade
2. **Real-time coin display** in quiz completion summary (fill-test review page)
3. **Celebratory feedback** (animation + sound) on perfect grades
4. **Coin accumulation tracking** in the quiz results page
5. **New `wallet` IndexedDB table** to persist total coins earned

### In scope

1. **Coin earning formula**
   - On quiz completion, calculate coins from individual word grades:
     - `grade="easy"` → 5 coins
     - `grade="good"` → 3 coins
     - `grade="hard"` → 1 coin
     - `grade="again"` → 0 coins
   - Total session coins = sum of per-word coin values
   - Coins are awarded immediately upon grading completion, not deferred

2. **Fill-Test Completion Summary** (UI Layer)
   - New "Coins Earned" row in the quick summary box displayed after session completion
   - Displays the total coins earned for this session (e.g., "+25 coins")
   - Appears below accuracy & duration metrics
   - Bilingual support (English / Simplified Chinese)
   - Summary box updates when totals are calculated after grading

3. **Celebratory Feedback** (UI Layer)
   - When word receives `grade="easy"`: trigger coin animation + celebration sound
   - Animation triggers on **per-word basis** after each individual grade submission (not just at end of session)
   - Celebratory sound plays once per easy grade (configurable to mute via app settings)
   - Animation: coin sprite floats upward with fade-out effect (200–400ms duration)
   - Sound: short celebratory chime (≤1 second, .mp3 format, stored in `public/sounds/`)
   - Both optional/controllable: mute settings apply to both animation and sound

4. **Wallet Table** (Service Layer - IndexedDB)
   - New `wallet` table schema (see below)
   - Single persistent record tracking cumulative coins earned
   - Updated on every quiz session completion
   - Extensible for future currency systems (deferred)

5. **Results Page Integration** (UI & Domain Layer)
   - Results page displays total accumulated coins (from `wallet` table)
   - New summary card: "Total Coins Earned" (alongside existing summary cards)
   - Coins column in session history already exists (shipped in Phase 2, Feature #5); now populated with session-specific coin totals
   - Coins are sortable in the results table (users can sort sessions by coins earned)

6. **Coin Persistence During Session**
   - Coins are written to `quizSessions` table during session completion (via `createQuizSession()`)
   - Coins are summed to `wallet` on session completion
   - Coins in `wallet` persist across sessions and page reloads

### Out of scope

1. **Bakery shop functionality** — Purchasing items, inventory, shop state (Phase 3, separate feature after this lands)
2. **Coin spending/redemption** — Deferring to bakery feature spec
3. **Streak bonuses or time-based multipliers** — Simple flat rewards; complexity deferred
4. **Server sync or cloud storage** — Local-only; no backend
5. **Coin economy balancing** — Values (5, 3, 1, 0) provided by user; no research phase
6. **Accessibility features beyond standard** — Sound mute controls use existing app settings
7. **Currency name customization** — "Coins" is hardcoded for Tier 1
8. **Coin history or transaction log** — Wallet shows only current total; session-level coins visible in results table

---

## Proposed Behavior

### Data Flow

```
User grades word during fill-test
         ↓
Grading logic assigns grade (easy | good | hard | again)
         ↓
UI calculates coin value for this grade (5 | 3 | 1 | 0)
         ↓
coin += coinValue
         ↓
[IF grade="easy"] → Trigger coin animation + celebration sound
         ↓
[ON SESSION COMPLETION] → Create quizSession record with coinsEarned field
         ↓
Update wallet.totalCoins += coinsEarned
         ↓
Display coins in summary box, results page, session history
```

### Visual Design

#### Fill-Test Completion Summary Box (Updated)

Displayed on fill-test completion screen after all words are graded:

```
┌──────────────────────────────────────┐
│ 上次填空总结                         │
│ (Last Fill-Test Summary)             │
│                                      │
│ 已测试汉字: 1                        │
│ (Tested Characters: 1)               │
│                                      │
│ 填空正确: 1/3                        │
│ (Fill-Test Correct: 1/3)             │
│                                      │
│ 部分正确: 1 (威)                    │
│ (Partially Correct: 1)               │
│ ────────────────────────────────────│
│ 💰 获得金币: 1                       │
│ (Coins Earned: 1)                    │
│ ────────────────────────────────────│
│ [前往复习页面]                       │
│ (Go to Review Page)                  │
└──────────────────────────────────────┘
```

**Layout notes:**
- Summary box displayed immediately after session completion
- Coins line uses coin icon emoji (💰) followed by bilingual label and count
- Character lists show count and failed character Hanzi inline (e.g., "1 (威)")
- Single action button routes to results page
- Box background is light cream/beige; content text in dark serif font

#### Per-Word Coin Animation (During Grading)

When user grades a single word as "easy":

1. **Visual:** Small coin icon (🪙) appears near answer input
2. **Animation:** Floats upward 80–120px over 300ms, fades out
3. **Sound:** Celebratory chime plays (0.3–0.5 second duration, 85dB, cheerful tone)
4. **Frequency:** Every easy grade triggers this once
5. **Dismissible:** User can mute both animation and sound via Settings

Example sequence:
```
User types correct answer
       ↓
[Grade button clicked]
       ↓
Grade assigned: "easy"
       ↓
Coin animation + sound begins
       ↓
Display "Correct ✓" feedback
       ↓
Proceed to next word
```

#### Results Page — Summary Cards (Updated)

```
┌──────────────────────────────────────────────┐
│ Total Sessions │ 5      Overall % Correct │75% │
├────────────────────────────────────────────────┤
│ Overall % Failed │ 15%   Overall % Partial │10% │
├────────────────────────────────────────────────┤
│ Total Tested │ 47      Total Duration │ 2h 15m │
├────────────────────────────────────────────────┤
│ Total Coins Earned │ 847 💰 [cumulative badge]  │
└────────────────────────────────────────────────┘
```

#### Session History Table — Coins Column (Already exists; now populated)

| Date | % Correct | Duration | Tested | Failed | **Coins** |
|---|---|---|---|---|---|
| Mar 4, 2026 | 80% | 4m 32s | 10 | 1 | **25** |
| Mar 3, 2026 | 85% | 6m 15s | 15 | 1 | **42** |
| Mar 2, 2026 | 70% | 3m 48s | 8 | 2 | **18** |
| Mar 1, 2026 | 92% | 5m 22s | 12 | 0 | **57** |
| Feb 28, 2026 | 65% | 2m 51s | 6 | 1 | **12** |

---

### `wallet` IndexedDB Table Schema

| Field | Type | Notes |
|---|---|---|
| `id` | string | Single record: `"wallet"` (singleton pattern) |
| `totalCoins` | number | Cumulative coins earned across all sessions |
| `lastUpdatedAt` | number | Unix timestamp (milliseconds) of last update |
| `version` | number | Schema version (for future upgrades); currently `1` |

**Pattern:** Singleton record with fixed `id = "wallet"`. No multi-user accounts in Tier 1, so only one wallet exists per app instance.

**Initialization:** On app init (or lazy-loaded on first results page visit), create wallet record if missing:
```typescript
{
  id: "wallet",
  totalCoins: 0,
  lastUpdatedAt: Date.now(),
  version: 1
}
```

**Updates:** Called after every `createQuizSession()` completes:
```typescript
async function updateWallet(coinsEarned: number): Promise<void> {
  const wallet = await db.wallets.get("wallet");
  if (!wallet) {
    await db.wallets.add({
      id: "wallet",
      totalCoins: coinsEarned,
      lastUpdatedAt: Date.now(),
      version: 1
    });
  } else {
    wallet.totalCoins += coinsEarned;
    wallet.lastUpdatedAt = Date.now();
    await db.wallets.put(wallet);
  }
}
```

---

## Calculation Examples

### Example 1: Mixed Grades in One Session

Grades awarded during session:
- Word 1: "easy" → 5 coins
- Word 2: "good" → 3 coins
- Word 3: "hard" → 1 coin
- Word 4: "easy" → 5 coins
- Word 5: "good" → 3 coins
- Word 6: "again" → 0 coins

Total session coins: 5 + 3 + 1 + 5 + 3 + 0 = **17 coins**

Session record created with `coinsEarned: 17`.
Wallet updated: `totalCoins += 17`.

### Example 2: Perfect Session

All 10 words graded "easy":
- 10 × 5 = **50 coins**

Celebration sound plays 10 times (once per easy grade).
Coin animations trigger 10 times.
User sees "+50 coins" in summary box.

### Example 3: No Correct Answers

All 8 words graded "hard" or "again":
- 5 × hard (1 coin each) = 5 coins
- 3 × again (0 coins each) = 0 coins

Total session coins: **5 coins**

Celebration sound plays 0 times (no easy grades).
Summary displays "+5 coins" (modest but encouraging).

---

## Layer Impact

### UI Layer (`src/app/words/...`)

**Components to Update:**

1. **`FillTestReviewSection.tsx` / `FillTestCompletionSummary.tsx`**
   - Calculate total coins from session's `gradeData`
   - Display "+X coins" in summary box after completion
   - Props: `gradeData: SessionGradeData[]`, `str: WordsLocaleStrings`
   - Call helper function `calculateSessionCoins(gradeData)` from domain layer

2. **`FillTestGradingScreen.tsx` / Individual word grading UI**
   - After each word is graded, check if `grade === "easy"`
   - If true, trigger:
     - `playCoincidenceSound()` (if sound not muted)
     - `triggerCoinAnimation(event.target)` (if animations not muted)
   - Props: pass through `onGradeSubmitted` callback with grade info
   - No state change; animation is purely visual feedback

3. **`ResultsPage.tsx` (already exists; update)**
   - Load `wallet` table on page init
   - Display total coins in new "Total Coins Earned" summary card
   - Pass `totalCoins` to `ResultsSummary` component
   - Call `getWallet()` from service layer

4. **`SessionHistoryTable.tsx` (already exists; update)**
   - Coins column already defined in schema (Phase 2 feature #5)
   - Column now populates with `session.coinsEarned` value
   - Coins column is sortable (already built in table infrastructure)
   - Format as simple number (e.g., "25", "0", "847")

5. **New component: `CoinAnimation.tsx` (optional, if not reusing existing animation system)**
   - Renders coin sprite with CSS keyframes
   - Props: `x: number, y: number, onComplete: () => void`
   - Positioned absolutely, floats upward, fades out
   - Duration: 300ms

6. **New utility: `src/app/words/shared/coins.sounds.ts`**
   - Load `.mp3` file from `public/sounds/coin-celebration.mp3` (artifact to be provided)
   - `playCoincidenceSound(): void` — plays once if user hasn't muted sound
   - Respects app-level sound settings (if settings exist; otherwise default to mute OFF)

### Domain Layer (`src/lib/...`)

**New Functions:**

1. **`src/lib/coins.ts`** (new module)
   - `calculateCoinValue(grade: Grade): number` — returns 5, 3, 1, or 0 based on grade
   - `calculateSessionCoins(gradeData: SessionGradeData[]): number` — sums coin values from all grades
   - `getWallet(): Promise<Wallet>` — reads wallet from IndexedDB (or creates if missing)
   - `updateWallet(coinsEarned: number): Promise<Wallet>` — increments wallet total and returns updated record

**New Type:**

2. **`src/app/words/shared/coins.types.ts`**
   - `type Wallet = { id: string; totalCoins: number; lastUpdatedAt: number; version: number; }`
   - `type Grade = "easy" | "good" | "hard" | "again"` (already exists in grading logic; re-export if needed)

### Service Layer (`src/lib/db.ts`)

**Database Operations:**

1. **Table initialization:**
   - On app init (or lazy), ensure `wallets` table exists
   - Check if wallet record exists; create if missing with `totalCoins: 0`
   - Pattern: Call `initializeWallet()` from app root or lazy-load on first results page visit

2. **Read operations:**
   - `async getWallet(): Promise<Wallet>` — reads wallet record from `wallets` table

3. **Write operations:**
   - `async updateWallet(coinsEarned: number): Promise<void>` — increments wallet total
   - Called immediately after `createQuizSession()` returns successfully

4. **No changes to existing operations:**
   - `quizSessions` table remains unchanged (coinsEarned field already defined in Phase 2)
   - Grading logic in scheduler remains unchanged
   - API routes remain unchanged

### Results Page Integration

1. **Results page now displays:**
   - "Total Coins Earned" summary card (new)
   - Coins column in session history table (already exists; now populated)
   - Both pull from `wallet` and `quizSessions` tables respectively

2. **Results page responsiveness:**
   - Mobile: Summary card displays as single row
   - Tablet/Desktop: Summary card in grid with other summary stats
   - Coins column visible on all breakpoints

---

## Locale Support

| String | English | Simplified Chinese |
|---|---|---|
| Summary box label | "Coins Earned" | "硬币奖励" |
| Summary display | "+{count} coins" | "+{count}枚硬币" |
| Session summary heading | "Session Summary" | "测验总结" |
| Results card label | "Total Coins Earned" | "总硬币数" |
| Column header | "Coins" | "硬币数" |
| Animation label (optional) | "(All correct!)" | "(全对!)" |
| Celebration tooltip | "Perfect answer!" | "完美答案!" |

---

## Edge Cases

1. **First session ever (wallet doesn't exist)**
   - On app init, create wallet with `totalCoins: 0`
   - First session updates wallet to `totalCoins = coinsEarned`
   - No error if wallet missing; lazy-create on first quiz completion

2. **Session with zero grades (empty gradeData)**
   - `calculateSessionCoins([])` returns `0`
   - Wallet updates with `+0 coins`
   - Summary displays "+0 coins" (unlikely but graceful)

3. **All grades = "again" (no rewards)**
   - Session earns 0 coins
   - No celebration sound (no easy grades)
   - Summary displays "+0 coins"
   - User still sees coins tracking; motivational for next attempt

4. **Coin animation plays 20+ times in rapid succession**
   - Each easy grade triggers independent animation
   - Sounds may overlap if grading very fast
   - Consider: queue animations or add short delay (50–100ms) between each
   - Alternative: Play sound only every Nth easy grade (e.g., every 3rd) to avoid audio clutter
   - **Decision pending:** User preference on overlap handling

5. **Sound file missing or fails to load**
   - Graceful fallback: animation still plays (no sound)
   - No error thrown; silently fail to load sound
   - Log to console for debugging

6. **User navigates away during session before completion**
   - Session not persisted (grading flow responsibility)
   - Coins not awarded
   - No partial credit

7. **IndexedDB quota exceeded**
   - Unlikely (wallet is tiny, one record)
   - Acceptance test: Verify wallet still loads with 500+ sessions in quizSessions table

8. **Mute settings**
   - If app has global sound settings, respect them
   - If no settings exist yet, default to sound ON for Tier 1 (celebratory)
   - Animation independent of sound settings (animations always on unless explicitly disabled)

9. **Multiple app instances in same browser (multiple tabs)**
   - Wallet is shared (same IndexedDB database)
   - Session completion in one tab updates wallet visible in other tabs
   - No locking or conflict resolution (local-first simplicity)
   - Acceptance test: Open results page in two tabs, complete session in one, verify other tab shows updated coin total (may require manual refresh or polling)

10. **Coin integer overflow (unrealistic)**
    - 1000 sessions × 50 coins/session = 50,000 coins
    - JavaScript `number` safely handles this
    - No edge case handling needed for Tier 1

---

## Risks

1. **Coin value felt "too low" or "too high" by user**
   - Mitigation: User provided values (5, 3, 1, 0); no balancing research in this spec
   - Accept user's numbers as-is; iterate if feedback suggests tuning needed

2. **Celebration sound is annoying or distracting**
   - Mitigation: Mute controls via app settings + per-user preference
   - Acceptance test: Verify sound mute setting is respected before shipping

3. **Coin animation causes performance lag on slow devices**
   - Mitigation: Use CSS animations (GPU-accelerated), not JavaScript loops
   - Use `requestAnimationFrame` if custom animation code needed
   - Test on low-end device (throttled CPU) to ensure 60fps or graceful degradation

4. **Coins not persisted if page crashes during session completion**
   - Mitigation: IndexedDB transaction completes before UI updates
   - `updateWallet()` call only happens after `createQuizSession()` succeeds
   - Acceptance test: Verify wallet incremented after session completion, even if page reloaded

5. **Session coins field not populated by grading flow**
   - Mitigation: Grading flow must pass `coinsEarned` to `createQuizSession()`
   - Document this requirement in grading flow spec or code comments
   - Acceptance test: Verify `quizSessions.coinsEarned` is populated after any session completion

6. **Results page summary card layout breaks on mobile**
   - Mitigation: Responsive grid design; test at 375px width
   - Acceptance test: Verify summary cards stack or reflow gracefully on mobile

7. **Sounds load from wrong path or 404 occurs silently**
   - Mitigation: Test sound path in development and production
   - Use absolute path `/sounds/coin-celebration.mp3` from public folder
   - Acceptance test: Play sound in fill-test completion, verify audio plays (or logs to console if missing)

8. **Animation queuing causes visual clutter on large sessions**
   - Mitigation: Determine at design time: stagger animations (50–100ms apart) or play sound once per 3 easy grades
   - Spike: Test with 20+ easy grades in rapid succession; collect user feedback on feel
   - **Decision pending:** User preference on how to handle rapid fire

---

## Test Plan

### Manual Testing

1. **Coin calculation (single grade)**
   - Grade one word as "easy" → verify coin value = 5
   - Grade one word as "good" → verify coin value = 3
   - Grade one word as "hard" → verify coin value = 1
   - Grade one word as "again" → verify coin value = 0

2. **Session coin total**
   - Grade 10 words (8 easy, 1 good, 1 hard) → verify total = 8×5 + 1×3 + 1×1 = 44 coins
   - Verify summary box displays "+44 coins" after session completion
   - Verify `quizSessions` record stores `coinsEarned: 44`

3. **Wallet persistence**
   - Complete session with 25 coins earned
   - Verify wallet.totalCoins = 25
   - Reload page
   - Verify wallet still shows 25 coins
   - Complete another session with 15 coins
   - Verify wallet.totalCoins = 40

4. **Celebration feedback on easy grade**
   - Grade a word as "easy"
   - Verify: Coin animation plays (sprite floats up, fades)
   - Verify: Celebratory sound plays (if not muted)
   - Repeat for multiple easy grades in one session
   - Verify sound plays as expected on each

5. **No celebration on non-easy grades**
   - Grade a word as "hard"
   - Verify: NO coin animation plays
   - Verify: NO sound plays
   - Repeat for "good" and "again"

6. **Sound muting**
   - If app has sound settings, toggle mute OFF
   - Grade word as "easy"
   - Verify: Sound plays
   - Toggle mute ON
   - Grade another word as "easy"
   - Verify: Sound does NOT play
   - Verify: Animation STILL plays (independent of sound)

7. **Results page displays wallet total**
   - Complete 3 sessions with 20, 30, 15 coins earned
   - Navigate to `/words/results`
   - Verify: "Total Coins Earned: 65" (or 65💰) displayed in summary cards
   - Verify: Each session row displays correct `coinsEarned` value in Coins column

8. **Results page coins column sorting**
   - With 5+ sessions of varying coin amounts
   - Click "Coins" column header
   - Verify: Table sorts by coin amount (ascending)
   - Click again
   - Verify: Table sorts descending

9. **Empty session (no grades)**
   - Manually create session with empty `gradeData`
   - Verify: `coinsEarned` = 0
   - Verify: Wallet updates with +0
   - Summary displays "+0 coins"

10. **Locale switching**
    - Complete session
    - Switch app locale to Simplified Chinese
    - Verify: Summary box displays "硬币奖励" or equivalent
    - Verify: Results page displays "总硬币数"
    - Verify: All coin-related strings translated

11. **Responsive layout**
    - Test on mobile (375px), tablet (768px), desktop (1920px)
    - Verify: Summary cards reflow gracefully
    - Verify: Coins column visible/readable at all breakpoints

12. **Performance with many sessions**
    - Create 100+ sessions in quizSessions table
    - Navigate to Results page
    - Verify: Page loads within 1s
    - Verify: Coins column renders correctly
    - Verify: Sorting by coins works smoothly

### Automated Testing

1. **coins.ts calculations**
   - `calculateCoinValue` returns correct value for each grade
   - `calculateSessionCoins` sums correctly for various inputs
   - Test edge cases: empty array, single grade, mixed grades

2. **Wallet updates**
   - `updateWallet(25)` increments totalCoins by 25
   - `getWallet()` returns current wallet state
   - Calling in sequence: +10, +15, +20 → final total = 45

3. **Coin animation component**
   - Renders coin sprite at correct position
   - Animation plays for correct duration (300ms ±10%)
   - Calls `onComplete` callback after animation ends

4. **Sound fallback**
   - If sound file missing, animation still plays
   - No errors thrown; silent failure logged

---

## Acceptance Criteria

- [ ] **Coin earning formula implemented**: easy=5, good=3, hard=1, again=0
- [ ] **Session coins calculated on completion**: `coinsEarned` field populated in `quizSessions` table
- [ ] **Wallet table created**: `wallets` table with schema defined above exists
- [ ] **Wallet initializes on app start** (or lazy-loads on first quiz): creates record if missing
- [ ] **Wallet persists across sessions and page reloads**: IndexedDB is source of truth
- [ ] **Fill-test summary box displays coins**: "+X coins" shown after session completion
- [ ] **Coin coins is correct**: matches expected value from grade breakdown
- [ ] **Celebration animation triggers on easy grades**: Coin sprite floats upward, fades (300ms)
- [ ] **Celebration sound plays on easy grades** (if sound enabled): Short celebratory chime plays once per easy grade
- [ ] **Animation/sound plays per-grade basis**: Each easy grade triggers independently (not just at end)
- [ ] **Sound is mutable**: Respects app sound settings (if implemented) or defaults to ON
- [ ] **Results page displays total coins**: "Total Coins Earned" summary card shows wallet.totalCoins
- [ ] **Session history table coins column populated**: Each session displays `coinsEarned` value
- [ ] **Coins column is sortable**: Users can click header to sort by coin amount (ascending/descending)
- [ ] **No coins awarded for sessions with no grades**: `coinsEarned = 0` handled gracefully
- [ ] **Wallet updates correctly across multiple sessions**: Multiple sessions sum correctly to wallet total
- [ ] **Responsive layout works**: Summary cards and coins column display correctly at 375px, 768px, 1920px
- [ ] **Locale strings complete**: All coin-related copy exists in English and Simplified Chinese
- [ ] **No console errors** on quiz completion, wallet update, or results page load
- [ ] **Page loads within 1s** even with 100+ sessions in `quizSessions` table
- [ ] **Sound file loads correctly**: Celebratory chime plays without errors (or gracefully fails)
- [ ] **Animations perform smoothly**: 60fps or graceful degradation on low-end devices
- [ ] **Wallet initialization is idempotent**: Creating wallet multiple times does not duplicate data

---

## Open Questions

1. **What happens if celebration sound and animation play 10+ times rapidly?**
   - Option A: All sounds overlap (current design)
   - Option B: Queue sounds, play one every 200ms (more courteous)
   - Option C: Play sound every 3rd easy grade only (less auditory clutter)
   - **Decision pending:** User preference. Recommend Option A for Tier 1 (simple), revisit if feedback suggests overwhelm.

2. **Should wallet be visible in app shell/header as running total?**
   - Out of scope for this spec; deferred to Bakery MVP feature spec
   - Current spec limits display to: summary box (fill-test) + results page (accumulated)

3. **Are there app-level sound/animation settings already?**
   - If yes: Respect existing settings for mute control
   - If no: Create simple boolean flags in localStorage for now
   - **Decision pending:** Confirm app-level settings architecture

4. **Should coins be displayed elsewhere (e.g., navigation header)?**
   - Bakery MVP feature will define coin display location in UI shell
   - For now, coins visible in summary box (quiz) and results page only
   - Deferring persistent coin counter/badge to Phase 3 bakery spec

5. **Is there existing animation library or should we use CSS?**
   - Use CSS animations (GPU-accelerated, performant)
   - If custom animation needed, use `requestAnimationFrame` + Framer Motion (if already in project)
   - **Check:** Verify project dependencies for animation library

6. **Should old sessions (pre-coin system) show 0 or be marked as "no data"?**
   - If session created before this feature lands: `coinsEarned` field is missing/null
   - Recommendation: Default to 0 for old sessions in display; accept `coinsEarned || 0` in rendering
   - No schema migration of old sessions needed for Tier 1

---

## Related Documents

- [0_ARCHITECTURE.md](../architecture/0_ARCHITECTURE.md) § Quiz Results Rules — Display and persistence requirements
- [2026-03-04-quiz-results-summary.md](../architecture/2026-03-04-quiz-results-summary.md) — Grading model, session schema, existing coins display
- [2026-03-03-grading-logic-model.md](../architecture/2026-03-03-grading-logic-model.md) — Grade types and calculation rules
- [0_PRODUCT_ROADMAP.md](../architecture/0_PRODUCT_ROADMAP.md) § Phase 3, Feature #7 — Rewards System broader context
- **TODO (Phase 3):** Bakery MVP spec (bakery shop, inventory, purchasable items, coins spending)

---

## Implementation Notes for Developer

- **Grading Flow Integration:** Ensure `createQuizSession()` caller supplies `coinsEarned` field. Document in grading flow code.
- **Sound File:** Artifact needed: `public/sounds/coin-celebration.mp3` (~100KB, cheerful chime, ≤1 second)
- **Animation Asset:** Use CSS `@keyframes` or Framer Motion component; no image sprites required for Tier 1
- **Database Schema Migration:** Confirm wallet table creation before merging. See `AI_CONTRACT.md §3` for scope boundary.
- **Testing Priority:** Focus on calculation correctness + wallet persistence; animation/sound are lower priority for initial ship

