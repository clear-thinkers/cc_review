## Fill Test Grading Function + Tests (cc_review)
THIS IS OUTDATED, READ WITH CAUTION

### Summary
Implement a new pure grading utility in `cc_review/src/lib` that:
1. Grades 3 sentence-blank placements against `answerIndex`.
2. Handles duplicate placements (`last wins`) and invalid indices (ignored).
3. Returns stable per-sentence results for indices `0..2` in order.
4. Maps score to SRS tier (`again|hard|good|easy`).
5. Adds focused `vitest` coverage for all required scenarios.

### Public API / Type Changes
1. Add `src/lib/fillTest.ts` exporting these exact types:
   - `FillSentence`
   - `FillTest`
   - `Placement`
   - `Tier`
   - `FillResult`
2. Add and export:
   - `gradeFillTest(fillTest: FillTest, placements: Placement[]): FillResult`
3. No changes to existing `scheduler`/`db` APIs in this task.

### Implementation Details
1. In `src/lib/fillTest.ts`, define a small runtime index guard:
   - valid index is integer `0 | 1 | 2`.
2. Process placements in input order and build final per-sentence choices:
   - keep only entries with valid `sentenceIndex` and valid `chosenPhraseIndex`.
   - overwrite by `sentenceIndex` so the last valid entry is retained.
3. Build `sentenceResults` by iterating `[0, 1, 2]`:
   - `expectedPhraseIndex` from `fillTest.sentences[i].answerIndex`
   - `chosenPhraseIndex` from final map, else `null`
   - `isCorrect` when chosen is non-null and equals expected.
4. Compute `correctCount` from `sentenceResults`.
5. Tier mapping:
   - `3 => "easy"`
   - `2 => "good"`
   - `1 => "hard"`
   - `0 => "again"`
6. Return:
   - `correctCount`
   - `tier`
   - `sentenceResults` (always length 3, ordered 0/1/2)
   - `placements` (raw input copy for logging)

### Test Plan (Vitest)
Create `src/lib/fillTest.test.ts` with fixture `FillTest` and these cases:
1. Perfect match: 3/3 returns `easy`.
2. Two correct: 2/3 returns `good`.
3. One correct: 1/3 returns `hard`.
4. None/missing: no placements (or all wrong) returns `again`, missing choices become `null`.
5. Duplicate sentence placement: same `sentenceIndex` appears multiple times, last valid one is used.
6. Out-of-range placement ignored:
   - inject runtime-invalid values via `as unknown as Placement[]`
   - verify grading ignores invalid entries and still returns ordered results.

### Acceptance Criteria
1. `gradeFillTest` is pure (no side effects, deterministic from inputs).
2. No throws on malformed placement entries.
3. Result always includes sentence results for `0,1,2` in order.
4. All new tests pass with existing `vitest` setup (`npm test`).

### Assumptions / Defaults
1. Use existing `vitest` (already configured) instead of adding Jest.
2. This task is limited to utility + tests; no UI wiring or DB persistence changes.
3. Raw placements are preserved in output for logging; invalid entries are ignored only for scoring logic.
