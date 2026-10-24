---
title: Fix Log – 2026-10-24 – Paragraph quiz: identical blanks must be interchangeable
---

## Context
In the paragraph quiz, when a paragraph had two blanks with the same character/phrase (e.g. 你 twice), the child had to drop the word-bank items in the exact original order. Dropping either identical bank item on either identical blank should have been accepted.

## Root Cause
`handlePlacement` in `ParagraphQuizReviewSection.tsx` treated a drop as correct only when `bankSpanId === targetSpanId`. Each bank item is keyed by its own span id, so two visually identical items were not interchangeable.

## Changes Applied
- `paragraphQuiz.utils.ts`: new pure helper `isPlacementCorrect(bankText, targetText, bankSpanId, targetSpanId)` — correct when span ids match or the two blanks' text is identical.
- `ParagraphQuizReviewSection.tsx`: `handlePlacement` uses it for the wrong-drop branch. On a match across different span ids, the target blank's own bank entry (identical text) is the one consumed; grading, retry counts, coins, autosave are unchanged.
- `paragraphQuiz.utils.test.ts`: 4 cases for the helper.
- Verified in a real browser against the dev Supabase project with an isolated throwaway family (removed afterward): original code bounced 16/32 identical-text drops, fixed code bounced 0/32; a different-text drop still bounces; a full playthrough completed, recorded the quiz session and marked the packaged session complete.

## Architectural Impact
Original fix: none (UI layer + a pure helper in the same feature folder). The revision below also touches the domain layer (`scheduler.ts` stability ceiling) — no schema, RPC, route, or RLS change.

## Preventative Rule
Quiz answer-matching compares what the child sees (text), not the internal id of the bank item.

## Revision 2026-10-24 — two related bugs found while verifying, both fixed (scheduler change explicitly authorized)
1. **Last blank missing from `grade_data`.** `finishSession()` built `grade_data` from `history` read via closure, before `setHistory` for the final blank had committed, so the last placed blank was dropped (9 entries for a 10-blank quiz; `total_grades` one short). Fix: `handlePlacement` now builds `nextHistory` eagerly, sets it, and passes it to `finishSession(finalHistory)`. Re-verified in browser: 10 grades recorded for a 10-blank quiz, final blank included.
2. **Unbounded stability overflowed `bigint`.** `calculateNextState` multiplied stability by 3x (easy) / 2x+ (good) with no ceiling; after ~20 back-to-back easy grades of one word `ease`/`interval_days`/`next_review_at` exceeded Postgres `bigint` range and the `gradeWord` write failed, so the blank could never be placed. Fix: `S_MAX = 3650` days (~10 years) in `scheduler.ts`; stability is clamped after the grade branches (interval at the cap is ~390 days, so no realistic schedule changes). Tests: new clamp test in `scheduler.test.ts`; the existing "floating-point stability at high values" test, which asserted the old unbounded 0.5·3^20 growth, now uses 8 grades (3280.5, under the cap) to keep its float-precision intent.

## Still open (not fixed — not requested)
Resuming a paused paragraph quiz does not restore `history` (only `blankState`), so blanks completed before the pause are absent from the recorded `grade_data`/coins. Pre-existing.

## Docs Updated
- AI_CONTRACT.md: no — no rule change
- 0_ARCHITECTURE.md: yes — Fill-Test Review Rule 31 now defines a correct drop as text-equal; `words.ease` row notes the stability ceiling
- 0_BUILD_CONVENTIONS.md: no — no convention change
- 0_PRODUCT_ROADMAP.md: no — bug fix inside shipped item I, no scope change
