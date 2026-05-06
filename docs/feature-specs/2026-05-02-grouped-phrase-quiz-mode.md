# Feature Spec - 2026-05-02 - Bundled Phrase Quiz Mode

## Status: Shipped 2026-05-02

## Problem
The current fill-test quiz presents one character at a time. Each quiz item is built from exactly three eligible phrases for the same Hanzi. Characters with only one or two eligible phrase/example rows never enter the quiz, even when those phrase rows are valid and useful.

Some characters naturally have only one or two phrases. This feature includes those characters through **bundled mode**, pairing a low-phrase character with another quiz-ready character while preserving the existing fill-test interaction model as much as possible.

Bundled mode must preserve the existing Tier 1 review model: persisted content only, deterministic grading, character-level scheduler updates, and quiz-session result reporting.

## Scope
- Update the current fill-test quiz model so characters with one or two eligible phrase/example rows can enter quizzes by being bundled with another eligible character.
- Start fill-test sessions with bundled low-phrase quizzes first, followed by ordinary three-sentence character quizzes.
- Support variable-length bundled quizzes from one to five example sentences depending on pairing outcome.
- Build quizzes from due entries that already have saved fill-test content.
- Grade each underlying character through the existing `gradeWord` service path.
- Record completed sessions through the existing `recordQuizSession` flow with `sessionType: "fill-test"`.
- Support packaged review test sessions using only the packaged session's quiz-ready characters.
- Keep all user-facing copy in `src/app/words/words.strings.ts`.

## Out of scope
- Adding a new route.
- Adding tables, columns, RPCs, or RLS policies.
- Changing scheduler grade mappings or due-date algorithms.
- Changing coin formulas.
- Calling AI or generating live quiz content.
- Changing Content Admin phrase generation or `include_in_fill_test` semantics.
- Replacing the existing character-by-character fill-test mode.
- Persisting per-blank answer history beyond the current quiz-session grade summary.

## Proposed behavior
### Current Grading Logic
The current fill-test grading logic lives in `src/lib/fillTest.ts` and assumes exactly three blanks.

1. A `FillTest` has exactly three phrase options and exactly three sentences.
2. Each sentence has one expected phrase index.
3. User placements are normalized into three selected phrase slots. Missing, malformed, or out-of-range placements are ignored and count as unanswered.
4. Each sentence is correct only when the selected phrase index equals that sentence's expected phrase index.
5. `correctCount` is the number of correct sentences out of three.
6. `tierFromCorrectCount` maps:
   - `3/3` correct -> `easy`
   - `2/3` correct -> `good`
   - `1/3` correct -> `hard`
   - `0/3` correct -> `again`
7. The resulting tier is passed to `gradeWord(word.id, { grade: result.tier, source: "fillTest" })`, so scheduler updates remain character-level.
8. Quiz-session history stores one grade entry per tested character, not one grade entry per blank.

This is the baseline that bundled mode grading must extend without changing scheduler internals.

### Bundled Mode
1. Fill-test eligibility changes from "character must have at least three eligible phrase/example rows" to "character must have at least one eligible phrase/example row."
2. At session start, the runtime partitions eligible due characters into:
   - low-phrase characters: one or two eligible phrase/example rows.
   - standard characters: three or more eligible phrase/example rows.
3. Low-phrase characters are matched in priority order before ordinary quizzes are queued:
   - first, with an available standard character; each standard character may serve as bundle partner at most once per session,
   - then, with another low-phrase character when their combined unique phrases total at least three,
   - after all preferred pairings, any two remaining one-phrase characters are bundled together as a two-blank quiz,
   - a single remaining one-phrase character that cannot be paired is tested as a one-blank solo quiz.
4. Quiz size is determined by the total unique phrases contributed:
   - one-phrase + three-phrase → four-sentence quiz,
   - two-phrase + three-phrase → five-sentence quiz,
   - one-phrase + two-phrase → three-sentence quiz,
   - two-phrase + two-phrase → four-sentence quiz,
   - two one-phrase characters → two-sentence quiz,
   - one-phrase character alone → one-sentence quiz.
5. All bundled quizzes appear first in the session queue, before remaining ordinary three-sentence quizzes.
6. The bundled quiz UI should remain recognizably the current fill-test interaction:
   - a phrase bank with one option per sentence,
   - one blank per example sentence,
   - drag/drop and tap-to-place support,
   - clear buttons,
   - submit / next controls.
7. The bundled quiz header displays all included Hanzi. A solo one-phrase quiz displays only that character's Hanzi.
8. Phrase options are unique by normalized phrase key within the bundled quiz. If duplicate phrases prevent a valid bundle, the low-phrase character remains unqueued and a notice may report skipped characters. The standard partner, if any, returns to the ordinary three-sentence quiz queue.
9. Standard characters used as bundle partners do not appear later as ordinary three-sentence quizzes in the same session.
10. Characters with three or more eligible phrase/example rows continue to use the current three-sentence quiz shape when they are not used as bundle partners.
11. The final session history remains character-level. Each bundled quiz appends one `QuizHistoryItem` per included character, not one item per sentence.
12. Bundled mode grading is computed separately per character using each character's own blanks only. Each blank in the bundled quiz carries a character attribution identifier so the grader can split results correctly.
13. A standard character in a bundle (three blanks) is graded using the existing three-blank rule, unchanged:
   - `3/3` correct → `easy`
   - `2/3` correct → `good`
   - `1/3` correct → `hard`
   - `0/3` correct → `again`
14. A low-phrase character is graded using the generalized correct-rate rule applied to its own blanks only. This applies whether the character is paired with a standard character, another low-phrase character, or tested solo:
   - all correct → `easy`
   - correct rate greater than 50% → `good`
   - correct rate less than or equal to 50% → `hard`
   - none correct → `again`
   Derived tables by phrase count:
   - One-phrase character (one blank): `1/1` → `easy`; `0/1` → `again`
   - Two-phrase character (two blanks): `2/2` → `easy`; `1/2` → `hard` (50% ≤ 50%); `0/2` → `again`
   - `good` is not reachable for low-phrase characters: reaching `good` requires a partial result strictly above 50%, which requires at least three blanks (2/3 = 67%).
15. Coin logic stays unchanged. Bundled mode still records one grade entry per character, and `calculateSessionCoins` continues to award coins from those grade entries using the existing table: `easy` = 5, `good` = 3, `hard` = 1, `again` = 0.
16. Completing the session records the existing `QuizSession` shape:
   - `sessionType` remains `"fill-test"`.
   - `gradeData` remains character-level.
   - `totalGrades` remains number of graded characters, not number of blanks.

## Implementation Plan
1. Extract eligible phrase/example candidate collection from `buildFillTestFromSavedContent` in `src/app/words/shared/words.shared.utils.tsx`:
   - preserve `include_in_fill_test` filtering,
   - preserve example-must-contain-phrase filtering,
   - preserve normalized phrase-key dedupe.
2. Add runtime types in `src/app/words/review/fill-test/fillTest.types.ts` for variable-length quizzes:
   - `FillTestCandidate`
   - `BundledFillTest`
   - `BundledFillTestMember` — each blank must carry a `characterId` attribution field so per-character grading can split results without inspecting sentence order
   - selection/result types that support one through five blanks.
3. Add a builder such as `buildFillTestPlanFromSavedContent(...)` that emits, in order:
   - standard-partner bundles (due-order priority, one standard per bundle),
   - low+low bundles (combined unique phrases ≥ 3),
   - terminal two-blank bundle if exactly two one-phrase characters remain unpaired,
   - solo one-blank quiz if exactly one one-phrase character remains unpaired,
   - remaining ordinary three-sentence quizzes,
   - skipped low-phrase character metadata when no valid pairing is possible.
4. Update due and packaged runtime eligibility so one- and two-phrase characters are not filtered out before the plan builder can bundle them.
5. Update `FillTestReviewSection.tsx` to render a quiz with a dynamic number of phrase options and blanks while keeping the existing three-sentence UI behavior for ordinary quizzes.
6. Add bundled submit/grade aggregation that produces one character-level grade per bundled member and calls `gradeWord` once per character.
7. Implement per-character bundled grading:
   - grade any standard character in the bundle using the existing three-blank rule (3=easy, 2=good, 1=hard, 0=again),
   - grade any low-phrase character using the generalized correct-rate rule applied to its own blanks only (all=easy, >50%=good, ≤50%=hard, none=again); this applies in standard-partner bundles, low+low bundles, and solo quizzes,
   - call `gradeWord` once per character with its independently derived grade.
8. Preserve existing quiz-session recording and coin calculation by appending character-level `QuizHistoryItem` entries.
9. Remove any debug `console.log` calls encountered while touching the quiz-completion flow, as build conventions disallow production logging.
10. Add focused tests:
   - one-phrase + three-phrase produces a four-sentence quiz,
   - two-phrase + three-phrase produces a five-sentence quiz,
   - one-phrase + two-phrase produces a three-sentence quiz,
   - two-phrase + two-phrase produces a four-sentence quiz,
   - two one-phrase characters produce a two-sentence quiz,
   - one-phrase character alone produces a one-sentence quiz,
   - standard character grades by the three-blank rule independently: `3/3`→`easy`, `2/3`→`good`, `1/3`→`hard`, `0/3`→`again`,
   - one-phrase character grades by its own blank independently in all pairing contexts: `1/1`→`easy`, `0/1`→`again`,
   - two-phrase character grades by its own blanks independently in all pairing contexts: `2/2`→`easy`, `1/2`→`hard`, `0/2`→`again`,
   - two members of the same bundled quiz can receive different grades,
   - bundled coin totals continue to use existing grade-entry coin values per character,
   - all bundled quizzes are ordered before ordinary three-sentence quizzes,
   - each standard character appears as bundle partner at most once per session,
   - a failed bundle due to duplicates returns the standard partner to the ordinary quiz queue,
   - low-phrase characters whose pairing fails are skipped with metadata.

## Layer impact
- UI: `/words/review/fill-test`, `words.strings.ts`
- Domain: bundled fill-test planning and per-character grading aggregation helpers
- Service: reuse `gradeWord`, `recordQuizSession`, and `completeReviewTestSession`
- Data: no schema or RLS changes
- AI: no AI changes

## Edge cases
- Low-phrase character has no standard partner available: fall through to low+low pairing, then terminal or solo quiz rules from point 3.
- Multiple low-phrase characters and too few standard partners: pair with standard partners in due-order priority, then apply low+low and terminal pairing rules to all remaining low-phrase characters.
- Only low-phrase characters are due: no standard-partner bundles can be built; apply low+low pairing for combined-unique-phrase count ≥ 3, then terminal two-blank bundle for remaining two one-phrase characters, then solo one-blank quiz for a single remaining one-phrase character.
- A standard partner has more than three eligible phrases: use three phrase/example rows for the bundled quiz; remaining rows do not create a second quiz for that same character in the same session.
- Duplicate phrase text across bundle members: skip duplicates; if the bundle falls below its required minimum size, attempt another partner or apply the next-priority pairing rule.
- Example contains the phrase multiple times: replace only the first phrase occurrence with the blank, matching current behavior.
- One or more `gradeWord` calls fail after the answer view is shown: surface the existing non-blocking schedule-save error and continue to let the child finish.
- Packaged session has skipped quiz characters: bundled mode uses only quiz-ready characters and keeps existing skipped notices.
- Parent attempts to start a fill-test quiz: preserve existing permission behavior and block via current route/access checks.

## Risks
- Bundled mode introduces one- through five-blank quiz surfaces, so the existing three-slot assumptions in state, UI, and grading helpers must be found and generalized carefully.
- Bundled mode grading can affect scheduler outcomes for low-phrase characters for the first time; implementation must use the per-character grading rules exactly and cover all blank-count cases in tests.
- The current fill-test component is state-heavy. Mitigation: extract pure bundled helpers first and keep UI changes narrowly scoped.
- The current implementation has debug `console.log` calls near quiz completion. This feature should remove those while touching the flow, because build conventions disallow production `console.log`.

## Test plan
- Unit test candidate collection, low-phrase partitioning, partner selection, and queue ordering.
- Unit test bundled result aggregation into per-character grades.
- Unit test bundled coin totals remain derived from existing character-level grade entries.
- Unit test `QuizSession` construction remains character-level.
- Regression test that ordinary three-sentence quizzes continue to build and grade the same way.
- Run:
  - `npx vitest run src/app/words/review/fill-test/fillTest.types.test.ts`
  - `npx vitest run src/app/words/shared/words.shared.utils.test.tsx`
  - targeted fill-test / review tests added during implementation
  - `npm run check:encoding`

## Acceptance criteria
- A child can quiz a one-phrase character paired with a three-phrase character (four-sentence quiz).
- A child can quiz a two-phrase character paired with a three-phrase character (five-sentence quiz).
- A child can quiz a one-phrase character paired with a two-phrase character (three-sentence quiz).
- A child can quiz two one-phrase characters paired with each other (two-sentence quiz).
- A child can quiz a single one-phrase character with no available partner (one-sentence solo quiz).
- All bundled quizzes appear before ordinary three-sentence quizzes in the session queue.
- Completing a bundled quiz grades each included character independently through the existing scheduler service path.
- A standard character in a bundle is graded by the existing three-blank rule: `3/3=easy`, `2/3=good`, `1/3=hard`, `0/3=again`.
- A one-phrase character is graded by its own blank in any context: `1/1=easy`, `0/1=again`.
- A two-phrase character is graded by its own blanks in any context: `2/2=easy`, `1/2=hard`, `0/2=again`.
- Two characters in the same bundled quiz may receive different grades.
- Coin earning stays unchanged and is calculated from the resulting character-level grade entries.
- Completing a session records one existing-shape fill-test quiz session and awards coins through the existing RPC.
- Packaged review test sessions can use bundled mode without new persistence.
- Existing character-by-character fill-test behavior remains available and covered by regression tests.
- No new route, schema field, RPC, RLS policy, or AI call is introduced.
- All new user-facing text is bilingual and sourced from `words.strings.ts`.
