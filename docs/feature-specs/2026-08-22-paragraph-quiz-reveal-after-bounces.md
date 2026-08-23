# Feature Spec — 2026-08-22 — Paragraph Quiz Reveal After 3 Bounces

## Status

Extends the already-shipped paragraph quiz runtime (`docs/feature-specs/2026-08-19-paragraph-quiz-runtime.md`, Item I Phase 3, shipped 2026-08-19). No Tier 2 gate re-check needed — that exception was already exercised and authorized for the paragraph quiz as a whole; this spec only adds a display feature on top of an already-runnable quiz mode. No `AI_CONTRACT.md §2` scope boundary is triggered (no schema/RLS/route/scheduler/AI change) — no "authorized" needed.

**Fully shipped 2026-08-23** — manual UI QA against the actual app confirmed all acceptance criteria (see below).

**Live QA correction, 2026-08-22 (fix 1):** the initial implementation placed the purple styling and Hint badge on the blank pill inside the paragraph text. Manual testing found this wrong — the affordance belongs on the corresponding **word-bank item** instead (the draggable word the child picks from), not the "?" placeholder in the reading text. This doc is updated throughout to reflect the corrected (bank-item) placement.

**Live QA correction, 2026-08-22 (fix 2):** fix 1 still read eligibility from `blankState[spanId].retryCount` — which counts wrong attempts **at a target blank**, from whichever bank items were dropped there, not wrong attempts **by a specific bank item** across whichever blanks it was tried on. Manual testing found this wrong too: if a child drags word B onto the wrong blank three times (across one or several different blanks), B itself should light up — not whatever word happens to be the *correct* answer for whichever blank absorbed those three wrong drops. These are genuinely different counters keyed by the same `spanId` space but counting different things. Fixed by adding a second, independent, persisted counter — `wrongDragCounts`, keyed by the DRAGGED (bank) item's own `spanId` — used for reveal eligibility instead of `retryCount`. `retryCount` is untouched and still exclusively drives `deriveParagraphBlankTier` grading. This doc is updated throughout to reflect the corrected (per-dragged-item) counter.

## Problem

A child stuck on a paragraph-quiz blank has no way to see what a word/phrase means — a wrong drop just bounces the bank item back with no other feedback (`ParagraphQuizReviewSection.tsx`'s `handlePlacement`, wrong-drop branch). For a child who has already missed the same blank several times, silently repeating the same wrong guesses is frustrating and not the point of the exercise (the app teaches vocabulary, not blind trial-and-error). We want an escape hatch that surfaces the word's meaning after repeated failure, without weakening the SRS/coin signal a solved-without-help attempt provides.

## Scope

- After a specific word-bank item has itself been dragged onto a WRONG blank **3 times, cumulative across every blank it was tried on** (`wrongDragCounts[itemSpanId] >= 3` — a new persisted counter, see Proposed Behavior), that bank item becomes eligible for **reveal** (corrected 2026-08-22, fix 1 — the bank item, not the blank pill in the paragraph text; corrected again, fix 2 — counts wrong drags OF this item, not wrong attempts AT whichever blank it happened to hit; see Status):
  - The bank item's button switches to a distinct purple style (currently: gray default / blue selected).
  - A small **Hint** (提示) badge/button appears next to the bank item — doubles as both the visual "you can get help here" indicator and the click target; not a separate explanatory sentence (resolved 2026-08-22, see Open Questions).
  - Clicking it opens a popup:
    - **Character blank** — flashcard-style content: hanzi, pinyin, meaning(s), and any `include_in_fill_test` phrases/examples for that character, sourced from already-in-memory `flashcard_contents` (`vm.allFlashcardContents`). **All matching pronunciation entries are shown, stacked** — resolved 2026-08-22 (see Open Questions).
    - **Phrase blank** — phrase text, pinyin, Chinese and English meaning, and the **first** `include_in_fill_test` example — resolved 2026-08-22 (see Open Questions).
  - Reveal is **read-only**: opening/closing the popup never calls `gradeWord`, `gradeVocabPhrase`, `nudgeWordFamiliarity`, or mutates `blankState`/`retryCount`/coins in any way. The blank remains unfilled and must still be correctly placed to complete the page/session — reveal only removes the mystery, not the task.
  - Only one popup open at a time. Opening a second bank item's Hint replaces the first popup's content — resolved 2026-08-22 (see Open Questions).
- Applies to the paragraph quiz only (`ParagraphQuizReviewSection.tsx`), the one quiz mode in the app that already has a retry/bounce mechanic and a persisted per-item attempt counter. **Confirmed not to extend to the classic character/phrase fill-test** — resolved 2026-08-22 (see Out of scope, Open Questions).

## Out of scope

- The classic character/phrase fill-test (`FillTestReviewSection.tsx`, `/words/review/fill-test`'s non-paragraph branches). That mode grades each item once with no requeue and has no attempt counter at all — adding a "3rd bounce" mechanic there would mean inventing new retry/requeue session state and likely touching session-length/grading semantics, a materially larger and separate feature. **Confirmed out of scope, resolved 2026-08-22** — no future extension implied by this spec; a hypothetical equivalent for the classic fill-test would need its own spec from scratch.
- Any change to `deriveParagraphBlankTier`, grading dispatch, coin calculation, or the retry-count-driven tier mapping (`easy`/`good`/`hard`) — reveal is purely additive display, confirmed not to touch this path anywhere in Proposed Behavior.
- Any DB schema change. `wrongDragCounts` is a new `progress_data` JSON field (see Proposed Behavior, superseding the original "no new persisted field" plan per fix 2), but `progress_data` is jsonb on the existing `review_session_progress` table — no column, table, or migration is added. Whether the child has actually opened the popup for a given item is not tracked or persisted anywhere.
- A parent-configurable reveal threshold. The "3" is a hardcoded constant in this spec, not exposed via item C ("Parent difficulty setting") or any admin surface.
- Any change to the standard character/phrase fill-test's existing inline correct-answer reveal (`FillTestReviewSection.tsx` rule 27 — shown after a wrong AND submitted answer, always, not gated by an attempt count). That is a different, already-shipped mechanic; this spec does not touch it.

## Proposed behavior

### New persisted counter, no schema change

**Superseded 2026-08-22 (fix 2).** The original plan reused `ParagraphQuizBlankProgress.retryCount` for eligibility — wrong, per Status: `retryCount` is keyed by the TARGET blank, not the dragged item, so it doesn't answer "has this specific word been dragged wrong 3 times."

`ParagraphQuizProgressData` (`paragraphQuiz.types.ts`) gains a second field: `wrongDragCounts?: Record<string, number>`, keyed by a word-bank item's own `spanId`. On every wrong drop, `handlePlacement` now bumps **two** independent counters — `blankState[targetSpanId].retryCount` (unchanged, still drives grading tier) and `wrongDragCounts[bankSpanId]` (new, drives reveal eligibility only) — both via functional `setState` (not a direct closure read) since rapid consecutive wrong drops aren't guarded by `submitting` the way a correct placement is. Both are folded into the same `autosave` call/payload, so no new save round-trip.

Still no schema migration — `progress_data` is jsonb, and `wrongDragCounts` is optional in the type guard (`isParagraphQuizProgressData`) so a progress row saved before this field existed resumes with every count defaulting to 0 rather than being rejected as invalid.

### New pure helpers — `paragraphQuiz.utils.ts`

```ts
export function isRevealEligible(retryCount: number): boolean; // retryCount >= 3

export function resolveCharacterRevealContent(
  word: Word,
  allFlashcardContents: Record<string, FlashcardContent>
): CharacterRevealContent | null; // every flashcard_contents entry where character === word.hanzi

export function resolvePhraseRevealContent(
  vocabPhrase: VocabPhrase
): PhraseRevealContent | null; // phrase, pinyin, meaningZh, meaningEn, first include_in_fill_test example
```

Both resolvers return `null` (not throw) when nothing resolves — mirrors the codebase's existing skip-invalid-silently precedent (e.g. `resultsReviewTestSession.ts`, `paragraphQuizBuilder.ts`'s stale-span handling) for the case where a blank's underlying word/phrase was deleted mid-session or a character has no curated content yet.

### UI changes — `ParagraphQuizReviewSection.tsx`

- New local state: `revealOpenSpanId: string | null` — which item's popup (if any) is open. Only one popup at a time; opening a second bank item's Hint badge replaces the content rather than stacking (confirmed 2026-08-22).
- New local state: `wrongDragCounts: Record<string, number>` — mirrors the persisted counter (see above), loaded on resume / reset to `{}` on a fresh session start, same lifecycle as `blankState`.
- **Corrected 2026-08-22 (fix 1):** the reveal affordance lives on the word-bank item, not the blank pill in the paragraph text.
- **Corrected 2026-08-22 (fix 2):** eligibility reads `wrongDragCounts[blank.spanId]`, NOT `blankState[blank.spanId]?.retryCount` — the latter counts wrong attempts at whichever blank this item's `spanId` happens to also identify (its own correct blank), not wrong attempts of dragging this item somewhere wrong.
- For each bank item where `isRevealEligible(wrongDragCounts[blank.spanId] ?? 0)` (bank items are already filtered to unfilled ones, so no separate "not yet filled" check is needed):
  - The bank item's button gets a purple variant (`border-purple-500 bg-purple-50 text-purple-900`) instead of its default gray/blue-selected style.
  - A small Hint (提示) badge/button renders adjacent to the bank item — a single clickable element, not a separate sentence plus button. It is a separate element from the bank item's own drag-start/click-to-select target — clicking it must `stopPropagation` and must never call `setSelectedBankSpanId` or `handlePlacement`.
  - Its `onClick` only sets `revealOpenSpanId`.
- The blank pill inside the paragraph text is unchanged by this feature — it keeps its original three states only (dashed-gray unfilled / rose flash-on-wrong / emerald filled).
- New component `ParagraphQuizRevealPopup.tsx` — centered, Tailwind-only, portal-rendered modal (not the `results/results.module.css` pattern, which `BUILD_CONVENTIONS.md §7` scopes to `results/` only). Branches on `blank.wordId` vs `blank.vocabPhraseId`, renders the resolved content using `renderRubyLine`/`renderPhraseWithPinyin`/`renderSentenceWithPinyin` from `words.shared.utils.tsx` for all pinyin (per the existing house rule against hand-rolling ruby rendering). If the resolver returns `null`, renders a graceful empty state rather than nothing/crashing.

### Strings

New keys added to `words.strings.ts`'s existing `paragraphQuiz` section (EN + ZH, both language blocks at lines 326 and 1610) — no new strings file. Copy confirmed 2026-08-22:

```
revealBadgeLabel: "Hint" / "提示"
revealPopupCloseButton: "Close" / "关闭"
```

No separate explanatory sentence — the "Hint"/提示 badge itself is the entire on-blank affordance (label + click target in one).

## Layer impact

UI layer only. No Domain (`src/lib/`) change beyond the new pure helpers, which live in the existing UI-adjacent `paragraphQuiz.utils.ts` (not `src/lib/paragraphQuizBuilder.ts`). No Service layer change — `vm.allFlashcardContents` and `vm.vocabPhrases` are already loaded workspace-wide by `words.shared.state.ts` and passed down via `WordsWorkspaceVM`; no new fetch, RPC, or route. Per `BUILD_CONVENTIONS.md §1`, a single-layer UI change with no schema/RPC/route touch does not strictly require a spec — this one exists because you asked for it, not because the decision table requires it.

## Edge cases

- **A blank's underlying word/phrase was deleted after the session started** (parent edits content mid-session on another device) — `resolveCharacterRevealContent`/`resolvePhraseRevealContent` return `null`; popup shows an empty state, never throws. Matches the existing resume-time revalidation precedent for the same scenario.
- **A character has multiple pronunciation entries in Content Admin** (multiple `flashcard_contents` rows sharing one `hanzi`) — all matching entries are shown stacked; the resolver does not guess which pronunciation is "the" one for this blank (confirmed 2026-08-22).
- **wrongDragCounts keeps climbing past 3 for an item** (child keeps dragging it wrong after reveal unlocks) — purple styling and Hint badge remain on the bank item; nothing further changes. This is fully independent of `retryCount`/grading, which is still capped at `hard` for any `retryCount >= 2` at that item's own blank, regardless of `wrongDragCounts` (existing `deriveParagraphBlankTier` behavior, untouched).
- **A bank item is dragged wrong onto multiple DIFFERENT blanks** (e.g. tried on blank 1 twice, then blank 3 once) — `wrongDragCounts[itemSpanId]` accumulates across all of them (3 total, eligible), while each target blank's own `retryCount` only reflects wrong attempts made AT that specific blank (blank 1: 2, blank 3: 1) — the two counters diverge by design (fix 2).
- **Session paused and resumed after a bank item became reveal-eligible** — eligibility is re-derived from the resumed `wrongDragCounts`, so the purple state and Hint badge reappear correctly on the bank item with no extra persistence work beyond the new field itself.
- **Resuming a progress row saved before fix 2 shipped** — `wrongDragCounts` is absent from the old saved JSON; the type guard treats it as optional and `resolveParagraphQuizResume` defaults it to `{}`, so every bank item resumes with 0 wrong drags rather than the resume being rejected as invalid.
- **Opening a second bank item's Hint while one popup is already open** — replaces the popup's content in place (single `revealOpenSpanId`), does not stack multiple popups (confirmed 2026-08-22).
- **A bank item is dragged/clicked onto its correct blank while its popup happens to be open** — the popup is left open (`revealOpenSpanId` is independent of `blankState`/placement logic); the item disappears from the bank on the next render since `bankItems` filters to unfilled items, but the popup itself only closes via its own Close button or the backdrop click. Acceptable: the content shown (already resolved at open time) stays valid to look at even after the blank is filled.

## Risks

- Low. No SRS, coin, schema, or RLS surface touched — the highest-risk parts of this codebase (packaged-session resume/autosave, cross-family isolation) are unaffected because this feature reads already-loaded, already-persisted state and writes nothing new.
- The main risk is UI clutter, now scoped to the word-bank panel rather than the paragraph text (corrected 2026-08-22, fix 1) — a page can have up to ~20 blanks/bank items, and if several are simultaneously reveal-eligible, the bank's `flex-wrap` layout gets a purple button + badge pair for each, which could crowd the panel. The paragraph text itself is no longer at risk of this, since it never renders the badge.

## Test plan

- `isRevealEligible` — unit tests at count 0/1/2/3/4 (false/false/false/true/true) — generic threshold check, used against `wrongDragCounts` values (fix 2), not `retryCount`.
- `resolveParagraphQuizResume` / `isParagraphQuizProgressData` — carries `wrongDragCounts` through for still-valid span ids, drops stale ones (mirrors `blankState`'s existing stale-span handling), defaults to `{}` when the field is absent from an old saved row, and rejects a malformed `wrongDragCounts` (non-number value) as invalid.
- `resolveCharacterRevealContent` — a word with one matching `flashcard_contents` entry, a word with multiple (multi-pronunciation) entries, a word with none (`null`).
- `resolvePhraseRevealContent` — a phrase with an eligible example, a phrase with no `include_in_fill_test` example (`null` or omits the example field — pin down which in Open Questions), a phrase with multiple eligible examples (confirms only the first is used).
- `ParagraphQuizRevealPopup` focused subcomponent test — renders correct content for a character blank vs. a phrase blank vs. an unresolvable blank (empty state).
- Manual/UI check: confirm the Hint badge click never fires `gradeWord`/`gradeVocabPhrase`/`nudgeWordFamiliarity`/autosave-of-a-different-blankState, and never fires `setSelectedBankSpanId` (e.g. spy/mock these in the subcomponent test and assert zero calls on Hint-badge interaction).

## Acceptance criteria

- [x] A word-bank item's button turns purple once IT (not its target blank) has been dragged wrong 3 times cumulative across every blank it was tried on, and stays purple thereafter while it remains in the bank (corrected 2026-08-22, fix 1 — bank item not blank pill; fix 2 — counts wrong drags of this item, not wrong attempts at its blank).
- [x] A "Hint"/提示 badge appears next to a reveal-eligible bank item, in both EN and ZH.
- [x] Clicking the Hint badge opens a popup with flashcard-style content (all matching pronunciation entries) for a character-backed item, or phrase/pinyin/meaning/first-example content for a phrase-backed item. Confirmed via manual UI QA, 2026-08-23.
- [x] Clicking the Hint badge never calls any grading/coin/scheduler function, never selects the bank item for placement, and never changes `blankState`/`retryCount`. Confirmed via manual UI QA, 2026-08-23.
- [x] Only one reveal popup is open at a time; opening a second bank item's Hint badge replaces the first popup's content. Confirmed via manual UI QA, 2026-08-23.
- [x] The blank still requires a correct drag/drop placement to be filled — reveal does not auto-fill or skip it. Confirmed via manual UI QA, 2026-08-23.
- [x] Reveal eligibility (purple state) survives a pause/resume of the session, via the new `wrongDragCounts` progress-data field. Confirmed via manual UI QA, 2026-08-23.
- [x] A resumed session started before fix 2 shipped (no `wrongDragCounts` in its saved JSON) loads without error, with every item's wrong-drag count defaulting to 0. Confirmed via manual UI QA, 2026-08-23.
- [x] No new route, table, column, RPC, or RLS policy is introduced (jsonb `progress_data` field addition only).

## Open questions

All open questions are now resolved by explicit user direction, 2026-08-22.

1. ~~Multi-pronunciation character cards~~ — **Resolved: show all.** When a character has more than one `flashcard_contents` entry, every matching entry is shown stacked in the popup; no guessing which pronunciation is "the" one. See Proposed Behavior, Edge cases.
2. ~~Extend to the classic character/phrase fill-test?~~ — **Resolved: no.** This spec is paragraph-quiz-only. The classic fill-test has no retry/attempt-counter mechanic at all today; an equivalent there would need its own from-scratch spec, not implied by this one. See Out of scope.
3. ~~Phrase example selection~~ — **Resolved: show the first eligible example** (deterministic), not a randomly-chosen one — a deliberate deviation from the ordinary phrase-round quiz's random-selection precedent, kept simple for a read-only reveal popup where reproducibility (same blank always shows the same example) is more useful than variety.
4. ~~Hint copy~~ — **Resolved: "Hint" / 提示.** Not a full explanatory sentence — the badge/button itself carries the label. See Proposed Behavior → Strings.
5. ~~Reveal threshold configurability~~ — **Resolved: 3 is fine**, hardcoded, no parent-configurable setting.
6. ~~Multiple simultaneous popups~~ — **Resolved: confirmed, one popup at a time.** Opening a second blank's Hint badge replaces the first popup's content rather than stacking or disabling other badges.
