# Feature Spec — 2026-03-04 — Quiz Results Summary

_Status: Shipped 2026-03-04_  
_Tier 1 Phase 2 Feature #5_

## Status: Shipped 2026-03-04

---

## Problem

Currently, the app provides no historical session tracking or progress visibility for quiz performance. Users cannot see:

1. **What they've tested** — No record of past fill-test sessions
2. **How well they performed** — No accuracy tracking across sessions
3. **Progress over time** — No comparison of performance across different sessions
4. **Session details** — No session-level metrics (characters tested, characters failed, accuracy trend)

Result: Users have no clear feedback loop on learning effectiveness; progress is invisible and unmotivating.

---

## Scope

This spec covers a **new results/history page** at `/words/results` that displays aggregated quiz session data. This is a **view-only, reporting interface** — not a grading interface.

### In scope

1. **New page route**
   - `/words/results` — accessible from main navigation
   - new page should be placed after admin-content page
   - Renders session history sorted by date (newest first)

2. **New `quizSessions` IndexedDB table**
   - Schema defined below
   - Stores one record per completed fill-test session
   - Designed for extensibility: future quiz types (Phase 3+) will add records with new `sessionType` values

3. **Session list view**
   - Table/list displaying all stored fill-test sessions
   - Columns: Session Date, % Fully Correct, % Failed, % Partial, Duration, Tested Count, Tested Characters, Failed Count, Failed Characters, Coins Earned
   - One row per session, newest first
   - No pagination or filtering (all sessions displayed)
   - Session Type column omitted for Phase 1 (all sessions currently fill-test only); will be re-added in Phase 3+ when multiple quiz types exist
   - Sort by Session Date newest to oldest; users can sort independently by any column (percentages, counts, or date)

4. **Summary cards** (optional in Phase 1; see Edge Cases)
   - Total Sessions Completed
   - Overall % Fully Correct (weighted average across all sessions)
   - Overall % Failed (weighted average across all sessions)
   - Overall % Partially Correct (weighted average across all sessions)
   - Total Characters Tested
   - Total Duration (sum across all sessions)
   - Total Coins Earned

5. **Clear History button**
   - Single action button above the session history table: "Clear History"
   - Clicking the button opens a confirmation dialog: "Are you sure? This will permanently delete all session history."
   - On confirmation, all records in `quizSessions` table are deleted
   - Table and summary cards are cleared on success
   - Button is hidden/disabled when no sessions exist
   - No undo available — deletion is permanent

6. **Session metadata and calculations**
   - **Session Date:** stored `createdAt` timestamp, displayed as human-readable date (e.g., "Mar 4, 2026")
   - **Session Type:** stored as `sessionType` — currently only "fill-test"; designed to support future quiz types (Phase 3+)
   - **Accuracy %:** calculated as `(easyGrades / totalGrades) * 100`, rounded to nearest integer, where only "easy" grades count as fully correct
   - **Duration:** stored as `durationSeconds` (elapsed time from session start to completion), displayed in human-readable format (e.g., "4m 32s")
   - **Characters Tested:** count of unique word IDs graded in the session, **plus list of tested characters** (derived from `gradeData`)
   - **Characters Failed:** count of words graded "again" (incorrect), **plus list of failed characters** (derived from `gradeData`)
   - **Coins Earned:** stored as `coinsEarned` — initially `0`, updated when Rewards System (Phase 3) is implemented

6. **Responsive design**
   - Mobile (320–480px): Single-column table, condensed format
   - Tablet (480–960px): Multi-column table, expanded layout
   - Desktop (960px+): Full-width table with summary cards above

7. **Empty state**
   - If no sessions exist, display placeholder message: "No quiz sessions yet. Complete a review session to see results here."
   - Encourage user to navigate to review page

### Out of scope

1. **Session filtering** — Date range picker, accuracy threshold, session type filter (deferred to Phase 2.5)
2. **Edit/delete session** — Sessions are immutable; no editing or deletion from results page
3. **Session detail drill-down** — Clicking a session row does nothing (deferred)
4. **Export or analytics** — CSV export, charts, graphs, trend analysis (deferred)
7. **Pause/resume tracking** — Complex session pause/resume logic (deferred to Phase 2.5+)
6. **Coins system** — Payment/redemption/shop integration; coins shown but system not yet implemented (Phase 3)
7. **Streaming live sessions** — Results page shows completed sessions only; in-progress sessions are not tracked here
8. **User accounts or cloud sync** — Local-only; no server-side session storage

---

## Proposed Behavior

### Data Flow

```
User completes fill-test quiz
         ↓
Grading logic calculates accuracy
         ↓
Session record created in quizSessions table
(date, type, accuracy, characters tested, characters failed, coins earned)
         ↓
User navigates to /words/results
         ↓
Page reads quizSessions table
         ↓
Session history displayed in table
```

### Visual Design

#### Page Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  Quiz Results                                                      │
│                                                                    │
│  [Summary Cards – Optional Phase 2]                                │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Total Sessions │ 5     Overall % Correct │ 75%              │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ Overall % Failed │ 15%   Overall % Partial │ 10%             │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ Total Tested │ 47        Total Duration │ 2h 15m            │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  Session History                   [ Clear History ]              │
│  ┌──────────────────────────────────────────────────────────────┐ │
│ Date  │ %Corr │ %Fail │ %Part │ Dur │ Tested │ Failed  │ Coins  │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│ Mar 4 │ 80%   │ 10%   │ 10%   │ 4m │  10    │  1      │ 0      │ │
│           │          │          │ 字、词、 │ 字、词   │          │ │
│           │          │          │ 好、儿、得│          │          │ │
│ Mar 3     │ 85%      │ 6m 15s  │ 15      │ 2        │ 0        │ │
│           │          │          │ 了、在、 │ 是、有   │          │ │
│           │          │          │ 是、有、 │          │          │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### Session List Table (Desktop)

| Date | % Fully Correct | % Failed | % Partial | Dur | T.Count | Tested Chars | F.Count | Failed Chars | Coins |
|---|---|---|---|---|---|---|---|---|---|
| Mar 4, 2026 | 80% | 10% | 10% | 4m 32s | 10 | 字、词、好、儿、得、了、在、是、有、一 | 1 | 词 | 0 |
| Mar 3, 2026 | 85% | 7% | 8% | 6m 15s | 15 | 但、因、由、长、着、这、到、样、大、小、也、人、中、出、生 | 1 | 因 | 0 |
| Mar 2, 2026 | 70% | 15% | 15% | 3m 48s | 8 | 用、下、对、来、后、上、水、或 | 1 | 下 | 0 |
| Mar 1, 2026 | 92% | 0% | 8% | 5m 22s | 12 | 和、地、道、里、打、动、当、点、过、去、说、开 | 0 | — | 0 |
| Feb 28, 2026 | 65% | 20% | 15% | 2m 51s | 6 | 的、和、了、是、在、有 | 1 | 是 | 0 |

#### Mobile Layout

```
┌──────────────────────────┐
│ Quiz Results             │
│                          │
│ No quiz sessions yet.    │
│ Complete a review        │
│ session to see results   │
│ here.                    │
│                          │
│ [ Go to Review Page ]    │
│                          │
└──────────────────────────┘
```

**With data:**

```
┌──────────────────────────┐
│ Quiz Results             │
│                          │
│ Total Sessions: 5        │
│ Overall % Correct: 75%   │
│ Overall % Failed: 15%    │
│ Overall % Partial: 10%   │
│                          │
│ [Clear History]          │
│ ─────────────────────    │
│ Mar 4, 2026              │
│ % Correct: 80%           │
│ % Failed: 10%            │
│ % Partial: 10%           │
│ Duration: 4m 32s         │
│ Tested: 10               │
│ 字、词、好、儿、得、...  │
│ Failed: 1                │
│ 词                       │
│ Coins: 0                 │
│ ─────────────────────    │
│ Mar 3, 2026              │
│ % Correct: 85%           │
│ % Failed: 7%             │
│ Tested: 15               │
│ 但、因、由、长、...      │
│ Failed: 2                │
│ 但、因                   │
│ Coins: 0                 │
│                          │
└──────────────────────────┘
```

#### Empty State

```
┌─────────────────────────────────────────────┐
│  Quiz Results                               │
│                                             │
│                                             │
│      ⌘ No quiz sessions yet.                │
│                                             │
│      Complete a review session to see       │
│      results here.                          │
│                                             │
│      [ Go to Review Page ]                  │
│                                             │
└─────────────────────────────────────────────┘
```

---

### `quizSessions` IndexedDB Table Schema

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique session ID — generated as `makeId()` or UUID |
| `createdAt` | number | Unix timestamp (milliseconds) when session ended |
| `sessionType` | string | Currently "fill-test"; reserved for future quiz types (Phase 3+) |
| `gradeData` | `SessionGradeData` | Array of individual word grades (see below) |
| `fullyCorrectCount` | number | Count of grades === "easy" |
| `failedCount` | number | Count of grades === "again" |
| `partiallyCorrectCount` | number | Count of grades === "good" or "hard" |
| `totalGrades` | number | Total count of all grades (fullyCorrect + failed + partiallyCorrect) |
| `durationSeconds` | number | Total elapsed time in seconds from session start to completion |
| `coinsEarned` | number | Initially `0`; updated by Rewards System (Phase 3) |

#### `SessionGradeData` Type

```typescript
export type SessionGradeData = {
  wordId: string;           // Reference to word.id
  hanzi: string;            // Character reviewed
  grade: "again" | "hard" | "good" | "easy"; // Grade given
  timestamp: number;        // When this individual grade was submitted (optional)
};
```

This nested structure allows future drill-down into per-word session details (deferred feature), while the top-level summary fields support current reporting needs.

#### Derived Fields for Display

When displaying session data in the table, compute these derived fields from `gradeData`:

```typescript
// List of all tested characters (deduped, in order tested)
charactersTested: string[] = [...new Set(gradeData.map(g => g.hanzi))]

// List of all failed characters (deduped, in order failed)
charactersFailed: string[] = [...new Set(gradeData
  .filter(g => g.grade === "again")
  .map(g => g.hanzi))]
```

Display as comma-separated Hanzi (e.g., `字、词、好、儿`) with optional truncation for very long lists (show first 8–10, then "…").

---

### Calculation Rules

**% Fully Correct (grade="easy"):**
```
fullyCorrectPercent = (fullyCorrectCount / totalGrades) * 100
```

**% Failed (grade="again"):**
```
failedPercent = (failedCount / totalGrades) * 100
```

**% Partially Correct (grade="good" or "hard"):**
```
partiallyCorrectPercent = (partiallyCorrectCount / totalGrades) * 100
```

All three should sum to 100% (or close, accounting for rounding). Round each to nearest integer. For example:
- 10 total: 8 easy, 1 hard, 1 again → 80%, 10%, 10%
- 10 total: 7 easy, 2 good, 1 again → 70%, 10%, 20%
- 6 total: 6 easy, 0 hard, 0 again → 100%, 0%, 0%
- 4 total: 1 easy, 1 hard, 2 again → 25%, 50%, 25%

**Characters Tested Count:**
```
charactersTestedCount = count of unique word IDs in gradeData
```

If the same character is graded multiple times within one session (e.g., in different blanks), count it only once.

**Characters Failed Count:**
```
charactersFailedCount = count of grades === "again"
```

Only "easy" grades count as fully correct for accuracy calculation. "hard" and "again" grades do not contribute to accuracy.

**Duration:**
```
displayDuration(durationSeconds: number): string {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}m ${seconds}s`;
}
```

Stored as integer seconds; displayed in human-readable "Xm Ys" format (e.g., "4m 32s", "45s", "2m 5s"). For summary cards, sum all session durations and convert to hours:minutes:seconds format (e.g., "Total Duration: 2h 15m").

---

### Locale Support

| String | English | Simplified Chinese |
|---|---|---|
| Page title | "Quiz Results" | "测验结果" |
| No sessions | "No quiz sessions yet. Complete a fill-test to see results here." | "还没有任何测验记录。完成一个填空题后再来查看结果。" |
| Column header: Date | "Date" | "日期" |
| Column header: Fully Correct | "% Correct" | "全对%" |
| Column header: Failed | "% Failed" | "全错%" |
| Column header: Partial | "% Partial" | "部分正确%" |
| Column header: Duration | "Duration" | "耗时" |
| Column header: Tested Count | "Tested" | "已测汉字" |
| Column header: Tested Characters | "Characters" | "字符" |
| Column header: Failed Count | "Failed" | "全错汉字" |
| Column header: Failed Characters | "Characters" | "字符" |
| Column header: Coins | "Coins Earned" | "硬币数" |
| Summary: Total Sessions | "Total Sessions" | "总测验数" |
| Summary: Overall Fully Correct | "Overall % Correct" | "全对%" |
| Summary: Overall Failed | "Overall % Failed" | "全错%" |
| Summary: Overall Partial | "Overall % Partial" | "部分正确%" |
| Summary: Total Tested | "Total Characters Tested" | "总测试字数" |
| Summary: Total Failed Chars | "Total Failed" | "总全错字数" |
| Summary: Total Duration | "Total Duration" | "总耗时" |
| Button: Clear History | "Clear History" | "清除历史" |
| Confirmation title | "Delete all history?" | "删除所有历史?" |
| Confirmation message | "Are you sure? This will permanently delete all session history." | "你确定吗?这一操作会永久删除所有测验历史。" |
| Confirmation button: Cancel | "Cancel" | "取消" |
| Confirmation button: Delete | "Delete" | "删除" |
| Loading state | "Clearing..." (or spinner) | "正在清除..." |

---

## Layer Impact

### UI Layer (`src/app/words/results/...`)

**New Components:**

1. **`ResultsPage.tsx`** (entry component)
   - Route: `/words/results`
   - Props: `vm: WordsWorkspaceVM` (provides locale context)
   - Renders `ResultsSummary` and `SessionHistoryTable`
   - Loads `quizSessions` from IndexedDB on mount
   - Implements real-time refresh: listens for IndexedDB changes or polls on interval to detect new sessions added after grading completes
   - Re-renders session list and summary cards whenever new session data arrives
   - Tracks session start/end times if needed for real-time duration capture

2. **`ResultsSummary.tsx`** (optional; phase 2.1)
   - Displays summary cards: Total Sessions, Overall Accuracy, Total Tested, Total Duration, etc.
   - Props: `sessions: QuizSession[]`, `str: WordsLocaleStrings`
   - Calculates summary stats from session array
   - Formats total duration as hours:minutes:seconds

3. **`SessionHistoryTable.tsx`**
   - Displays table/list of all fill-test sessions
   - Props: `sessions: QuizSession[]`, `str: WordsLocaleStrings`
   - Sorted by `createdAt` descending (newest first)
   - **Sortable columns:** Users can click column headers to sort by Date, Accuracy %, Duration, Tested Count, Failed Count, or Coins
   - Derives `charactersTested` and `charactersFailed` lists from `gradeData` for each session
   - Formats `durationSeconds` as human-readable "Xm Ys" for each session
   - Displays character lists as comma-separated; truncates to first 8–10 with "…" if longer
   - Session type column omitted in Phase 1 (all sessions are fill-test); will be re-added in Phase 3+ when multiple quiz types exist
   - **Separate count columns** (Tested Count, Failed Count) allow independent sorting by numeric count

4. **`ClearHistoryButton.tsx`** (or inline in `ResultsPage.tsx`)
   - Button: "Clear History"
   - Props: `onClear: () => Promise<void>`, `disabled: boolean`, `str: WordsLocaleStrings`
   - Opens confirmation dialog before deletion: "Are you sure? This will permanently delete all session history."
   - Disabled when no sessions exist
   - Shows loading state during deletion
   - Positioned above the session history table

5. **`results.types.ts`**
   - `QuizSession` type (matches schema above)
   - `SessionGradeData` type
   - `ResultsSummaryStats` type (for calculated stats)

6. **`results.styles.css`**
   - Table layout and styling
   - Summary card grid
   - Mobile/tablet/desktop breakpoints
   - Empty state centering

### Domain Layer (`src/lib/...`)

**New Functions:**

1. **`src/lib/results.ts`** (optional; new module)
   - `calculateFullyCorrectPercent(gradeData: SessionGradeData[]): number` — "easy" grades / total
   - `calculateFailedPercent(gradeData: SessionGradeData[]): number` — "again" grades / total
   - `calculatePartiallyCorrectPercent(gradeData: SessionGradeData[]): number` — ("good" + "hard" grades) / total
   - `calculateWordsFailedCount(gradeData: SessionGradeData[]): number` — count "again" grades
   - `calculateUniqueWordsTestedCount(gradeData: SessionGradeData[]): number` — count unique word IDs
   - `getTestedCharacters(gradeData: SessionGradeData[]): string[]` — extract unique Hanzi from all grades, in order
   - `getFailedCharacters(gradeData: SessionGradeData[]): string[]` — extract unique Hanzi from failed grades only
   - `formatDuration(durationSeconds: number): string` — format seconds as "Xm Ys" (e.g., "4m 32s")
   - `calculateSummaryStats(sessions: QuizSession[]): ResultsSummaryStats` — compute all summary fields including percentages and total duration

These are pure functions with no side effects; they compute stats from session data.

### Service Layer (`src/lib/db.ts`)

**Database Operations:**

1. **Read operations:**
   - `getAllQuizSessions(): Promise<QuizSession[]>` — reads all rows from `quizSessions` table, returns sorted by `createdAt` descending

2. **Delete operations:**
   - `clearAllQuizSessions(): Promise<void>` — deletes all rows from `quizSessions` table; called by Clear History button

3. **Write operations:** (used by grading flow; not in this spec but referenced for completeness)
   - `createQuizSession(session: QuizSession): Promise<void>` — inserts one session after grading completes   - Caller must measure `durationSeconds` (elapsed time from session start to completion) and include in the `QuizSession` object   - Schema migration to add `quizSessions` table on app init

4. **No changes to existing operations:**
   - The `words` table remains unchanged
   - Grading logic in scheduler remains unchanged
   - API routes remain unchanged

### AI Layer (`src/app/api/...`)

**No changes.** Results page is view-only and reads local IndexedDB. No AI calls are made.

### Grading Layer (`/words/review/fill-test` and related)

**Responsibility (not in this spec; referenced for completeness):**
- When fill-test grading completes, call `createQuizSession()` to persist session record to `quizSessions` table
- Pass all grade data (`SessionGradeData` array) at session creation time

---

## Edge Cases

1. **No sessions exist**
   - Display empty state message and link to due-review page
   - Do not render table; do not show summary cards

2. **Session with zero words tested**
   - Unlikely in normal use, but if `gradeData` is empty: accuracy = undefined
   - Display "N/A" or "--" for accuracy; skip session in summary calculations

3. **Multiple grades for same word in one session**
   - Example: User grades word A twice in one fill-test session (different blanks)
   - **For character count:** Count only once in `wordsTestedCount` and `wordsFailedCount` (unique word IDs, deduplicated)
   - **For percentage calculations:** All grades count toward the weighted average, including duplicates
     - If word A is graded twice as "easy" and word B once as "hard": totalGrades = 3, fullyCorrectCount = 2, partiallyCorrectCount = 1
     - % Fully Correct = (2/3) × 100 = 67%, % Partial = (1/3) × 100 = 33%, % Failed = 0%
   - This correctly reflects that the user had 3 grade opportunities (2 easy, 1 hard), even though only 2 unique characters were tested
   - Correct behavior; flagging for clarity

4. **Mixed correct/failed grades on same word**
   - Example: User grades word A as "easy" in one blank, "hard" in another blank in same session
   - **For character count:** Word A is counted once in `wordsTestedCount` (unique word IDs deduplicated)
   - **For percentage calculations:** Both grades count toward the weighted average
     - totalGrades = 2, fullyCorrectCount = 1 (one "easy"), partiallyCorrectCount = 1 (one "hard"), failedCount = 0
     - % Fully Correct = (1/2) × 100 = 50%, % Partial = (1/2) × 100 = 50%, % Failed = 0%
   - Word is NOT counted as failed; "hard" is not "again" (which is used for failures)
   - Weighted average reflects the actual performance: the user got it right once and partially correct once, for a true 50/50 split
   - This is correct behavior

5. **Coins earned = 0 until Phase 3**
   - Column displays "0" for all sessions
   - When Rewards System is implemented (Phase 3), `coinsEarned` will be populated during grading
   - No changes needed to this page's code; data will simply update

6. **Session created mid-review, not completed**
   - If user closes browser during session without completing grading, incomplete session should NOT be persisted
   - Grading flow responsibility (out of scope for this spec)
   - Results page assumes all `quizSessions` are complete; no "in-progress" sessions

7. **Very large session count (1000+ sessions)**
   - No pagination/virtualization in scope for Phase 1
   - Performance acceptable for typical use (1–2 sessions per day ≈ 700/year)
   - Note in spec for future optimization if needed; acceptable limitation for Phase 1
   - Clear History will delete all at once; may take 1–2 seconds for IndexedDB to process

8. **Button state and user intent**
   - Clear History button hidden when no sessions exist
   - Button disabled during deletion (shows loading spinner)
   - User must confirm deletion in dialog; cannot be performed accidentally
   - Confirmation dialog clearly states "permanently delete"
   - Deletion is non-reversible — no undo available

9. **Percentage metrics = 100%, 0%, or all zeros**
   - Display as "100%" or "0%"; no special handling needed
   - Example: 100% correct, 0% failed, 0% partial = perfect session
   - Example: 0% correct (all failed or partial), never displays all three as zero (totalGrades > 0 always)

10. **Timezone handling**
   - `createdAt` stored as Unix timestamp (UTC)
   - Display uses browser's local timezone via `toLocaleDateString()` or similar
   - Matches other date displays in app

11. **Duration = 0 or very short**
   - If `durationSeconds < 1`, display as "<1s" (unlikely but handle gracefully)
   - If `durationSeconds = 0`, treated as data error; contact support if persistent
   - No minimum duration validation; data source (grading flow) is responsible for sanity

---

## Risks

1. **Percentage calculation incorrect if gradeData is missing grade field**
   - Mitigation: Enforce `SessionGradeData` schema during creation; validate that all records have `grade` field with valid value ("easy" | "hard" | "good" | "again") before inserting into `quizSessions`
   - Note: Three percentages should sum to 100%; if they don't, debug the count functions

2. **Session not persisted when grading completes**
   - Mitigation: Grading flow must call `createQuizSession()` before returning to results page or redirecting
   - Acceptance test: Verify session appears in table within 500ms of grading completion

3. **IndexedDB quota exceeded for large datasets**
   - Mitigation: Session records are lightweight (< 5KB each); 1000 sessions ≈ 5MB
   - Acceptance test: Verify table still loads and renders with 500+ sessions

4. **Percentage calculation differs from server-side tracking** (if implemented in future)
   - Mitigation: Document calculation rules in spec (done above); keep formula simple and reproducible
   - Acceptance test: Manual verification of 3 sessions with known grade breakdowns, verify all three percentages sum to 100%

6. **Duration not captured correctly if grading flow does not measure elapsed time**
   - Mitigation: Grading flow (scheduler / review component) must measure time from session start to session completion and pass `durationSeconds` to `createQuizSession()`
   - Acceptance test: Verify manually that a known 5-minute session displays "5m 0s" (or close to it) in results table

7. **Coins earned shows 0 forever after Phase 3 implementation**
   - Mitigation: Phase 3 feature spec must define how to populate `coinsEarned` during grading
   - Flag in this spec for Phase 3 team to address

6. **Session type string mismatch when future quiz types are added**
   - Mitigation: Document valid enum values in schema; enforce validation on session creation
   - Acceptance test (Phase 3+): Verify all session types display correct labels and are handled correctly

8. **Session deletion not persisted if user navigates away**
   - Mitigation: Deletion is synchronous (IndexedDB transaction); UI updates only after transaction completes
   - Acceptance test: Verify button disabled during deletion, navigating away shows loading state

9. **Clear History button accidentally clicked**
   - Mitigation: Confirmation dialog with explicit warning ("permanently delete") required before deletion
   - Acceptance test: Verify dialog appears on button click, deletion blocked until confirmed

10. **Browser back-navigation or tab switch loses unsaved data**
   - Mitigation: Page is read-only from IndexedDB; no unsaved state
   - No risk in this design

---

## Test Plan

### Manual Testing

1. **Empty state display**
   - Clear `quizSessions` table from IndexedDB
   - Navigate to `/words/results`
   - Verify: Empty state message displays, link to fill-test page visible

2. **Session creation and display**
   - Complete one fill-test quiz (grade 5 characters, with mix of easy/hard/again grades)
   - Navigate to `/words/results`
   - Verify: One row appears in table with correct date, accuracy % (based on "easy" count), tested count, failed count ("again" only), coins = 0

3. **Accuracy calculation (only "easy" grades count)**
   - Manually create 3 `quizSessions` records with known grade data:
     - Session 1: 10 total grades, 8 easy, 1 hard, 1 again → 80% accuracy
     - Session 2: 6 total grades, 6 easy, 0 hard, 0 again → 100% accuracy
     - Session 3: 4 total grades, 2 easy, 1 hard, 1 again → 50% accuracy
   - Navigate to `/words/results`
   - Verify: All accuracies displayed correctly based on easy counts only

4. **Summary card calculations** (if implemented)
   - With 3 sessions from above:
     - Total Sessions: 3
     - Overall Accuracy: (8+6+2)/(10+6+4) * 100 = 16/20 * 100 = 80% (sum of easy grades / sum of total grades)
     - Total Tested: 20 (10+6+4 unique characters)
     - Total Duration: (4m 32s) + (6m 15s) + (3m 48s) = 14m 35s (or "14m" if only showing minutes)
   - Verify: Summary cards display correct values

5. **Sorting (newest first)**
   - Create 3 sessions with different dates
   - Navigate to `/words/results`
   - Verify: Sessions displayed in descending order by `createdAt`

6. **Locale switching**
   - Complete one session
   - Switch app locale to Simplified Chinese
   - Navigate to `/words/results`
   - Verify: All text, labels translate correctly

7. **Responsive layout**
   - Test on mobile (375px width), tablet (768px), desktop (1920px)
   - Verify: Table renders readably at all breakpoints, no overflow

8. **Multiple sessions display**
   - Manually insert 20 sessions into IndexedDB
   - Navigate to `/words/results`
   - Verify: All 20 sessions display (no pagination), table scrolls, performance acceptable

9. **Duration display formatting**
   - Create a session with `durationSeconds = 272` (4m 32s)
   - Navigate to `/words/results`
   - Verify: Duration column displays "4m 32s"
   - Create sessions with edge cases: 45 seconds, 1 minute, 1 hour 2 minutes
   - Verify: Displays as "45s", "1m 0s", "1h 2m" (or similar human-readable format)

10. **Column sorting by count**
   - Create 5 sessions with varying tested/failed counts: 10, 5, 15, 8, 12
   - Navigate to `/words/results`
   - Click "Tested Count" header
   - Verify: Table sorts by tested count ascending (5, 8, 10, 12, 15)
   - Click "Tested Count" header again
   - Verify: Table sorts descending (15, 12, 10, 8, 5)
   - Repeat for "Failed Count" column

11. **Clear History button behavior**
   - Load page with 5+ sessions
   - Click "Clear History" button
   - Verify: Confirmation dialog appears with warning message
   - Cancel deletion: Verify table still shows all sessions
   - Confirm deletion: Verify table clears, summary stats reset, button disabled (no sessions remain)
   - Reload page: Verify no sessions persist (deletion was successful)

12. **Clear History button disabled state**
   - Start with no sessions (empty state)
   - Verify: Clear History button is hidden or visibly disabled
   - Complete one session
   - Reload page
   - Verify: Clear History button now enabled

### Automated Testing

1. **Types file**: `results.types.test.ts`
   - Verify `QuizSession` and `SessionGradeData` objects can be constructed
   - Verify `sessionType` enum values rejected if invalid

2. **Calculations**: `results.test.ts` (if created)
   - `calculateSessionAccuracy` returns correct % for various inputs
   - `calculateWordsFailedCount` counts only "again" grades
   - `calculateUniqueWordsTestedCount` deduplicates word IDs
   - `calculateSummaryStats` aggregates correctly

---

## Acceptance Criteria

- [ ] New page **`/words/results` is accessible** from main navigation (shell/nav bar)
- [ ] **Empty state displays** when no sessions exist, with link to review page
- [ ] **`quizSessions` IndexedDB table created** on app init with correct schema
- [ ] **Session data persists** after page reload (IndexedDB is the source of truth)
- [ ] **Session list displays all fill-test sessions** sorted by date (newest first)
- [ ] **All columns display correctly:** Date, % Fully Correct, % Failed, % Partial, Duration, Tested Count, Tested Characters, Failed Count, Failed Characters, Coins (0)
- [ ] **% Fully Correct displays correctly** (grade="easy" divided by total grades)
- [ ] **% Failed displays correctly** (grade="again" divided by total grades)
- [ ] **% Partially Correct displays correctly** (grade="good" or "hard" divided by total grades)
- [ ] **Three percentages sum to 100%** across all sessions (within ±1% rounding tolerance)
- [ ] **Tested Count = count of unique word IDs** (displayed in separate column)
- [ ] **Tested Characters = comma-separated character list** (in separate column; same character listed once even if graded multiple times)
- [ ] **Failed Count = count of "again" grades only** (displayed in separate column; "hard" grades do not count as failed)
- [ ] **Failed Characters = comma-separated character list of "again" grades only** (in separate column; excludes "hard" and "easy" grades)
- [ ] **Character lists are truncated gracefully** to first 8–10 characters with "…" appended if longer
- [ ] **% Fully Correct and % Failed columns are sortable** (users can click to sort by percentage value)
- [ ] **Percentage sorting works correctly** — ascending/descending toggle works as expected
- [ ] **Characters display in order tested/failed** (first tested/failed appears first in list)
- [ ] **Duration column displays correctly** with format "Xm Ys" (e.g., "4m 32s", "2m 5s", "45s")
- [ ] **Duration is positioned after % metrics** in table layout
- [ ] **Coins Earned column displays "0"** for all sessions (ready for Phase 3 update)
- [ ] **Summary card overall percentages** calculate correctly when multiple sessions exist (weighted average of all grades)
- [ ] **Clear History button visible above table** when sessions exist
- [ ] **Clear History button hidden or disabled** when no sessions exist
- [ ] **Confirmation dialog displays** on button click with warning: "Are you sure? This will permanently delete all session history."
- [ ] **Deletion is cancelable** — user can dismiss dialog without deleting
- [ ] **Deletion is permanent** — no undo or recovery available
- [ ] **All data cleared on deletion:** table is empty, summary cards reset to N/A
- [ ] **Button disabled during deletion** — shows loading state, prevents double-clicks
- [ ] **IndexedDB `quizSessions` table actually emptied** (not just UI cleared)
- [ ] **Page can safely reload after deletion** — no stale data remains
- [ ] **Responsive layout works** at mobile (375px), tablet (768px), desktop (1920px)
- [ ] **Locale strings** are complete in both English and Simplified Chinese
- [ ] **No console errors** on page load, session create, deletion, or navigation
- [ ] **Page loads within 1s** even with 100+ sessions in `quizSessions` table
- [ ] **Results page auto-refreshes** after new session completion — session history and summary cards update without requiring manual page reload
- [ ] **Duration seconds stored and retrieved correctly** from IndexedDB
- [ ] **Duration formatting is consistent** across all display contexts (table, summary cards, etc.)

---

## Open Questions

1. **When is the session record created?**
   - **Decision:** Create on session completion (after final grade) to ensure all grade data is captured. This is a grading-flow responsibility, not results-page responsibility.
   - **Duration measurement:** Grading flow must measure elapsed seconds from session start to session completion and include `durationSeconds` in the `QuizSession` object passed to `createQuizSession()`. Duration captures completed sessions only, measured from session start to session completion.

2. **How is duration measured?**
   - **Decision:** Grading flow (fill-test review component) records a start timestamp when the session begins and an end timestamp when the final grade is submitted. `durationSeconds = Math.round((endTime - startTime) / 1000)`. Measure elapsed real time. Future refinements (pause/resume tracking) deferred to Phase 2.5+.

3. **Should results page auto-refresh when a new session completes?**
   - **Decision:** Results page should refresh after each new session completion to ensure accurate stats. Implement real-time updates (polling or event listeners) in Phase 1; static read on mount is insufficient. This ensures users see updated session history and summary cards immediately after completing a quiz.

4. **What happens if a user navigates away during a fill-test session and returns?**
   - **Decision:** Incomplete sessions should NOT be persisted in `quizSessions` table. Grading flow should enforce this; results page assumes all sessions are complete. Future phases may add session save/load functionality (Phase 2.5+), but the foundational rule holds: `quizSessions` captures completed session data only.

5. **Should sessions be editable (e.g., delete a bad session, recalculate)?**
   - **Decision:** No. Sessions are immutable (view-only) in Phase 1 and beyond. Individual session deletion deferred to Phase 2/3 if needed. Only full Clear History action is available.

6. **How will future quiz types (Phase 3+) integrate with this spec?**
   - **Decision:** Agreed. The `sessionType` field is a string designed for extensibility. New quiz types (e.g., "multi-choice", "flashcard-graded") will create new session records with their `sessionType` value. Phase 3+ specs must define new quiz types and update this page's schema if needed. Results page will need to handle new types: re-enable session type column in table, add summary stats per type if needed.

---

## Related Documents

- [0_ARCHITECTURE.md](../architecture/0_ARCHITECTURE.md) — Data schema, layer boundaries
- [0_PRODUCT_ROADMAP.md](../architecture/0_PRODUCT_ROADMAP.md) — Phase 2/3 features, grading logic, rewards system
- [2026-03-03-grading-logic-model.md](../architecture/2026-03-03-grading-logic-model.md) — Grade types and calculation rules
- _Future: Rewards System (Phase 3) spec_ — Will define coins calculation
