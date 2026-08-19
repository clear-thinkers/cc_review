# Feature Spec — 2026-08-17 — Paragraph Library, Re-Import & Test-Mode Prep (Tier 1, Item I, Phase 2)

## Status

Depends on Phase 1 (`docs/feature-specs/2026-08-17-add-paragraph-article-import.md`) — `paragraphs` table, `/words/add-paragraph` import flow, `ParagraphSpanSelector.tsx`, and `addParagraphIngestion.ts` must exist first. They do (shipped 2026-08-17).

**Revision note (2026-08-17):** this supersedes the original Phase 2 draft in this same file. That draft proposed a new `/words/paragraphs` route, reused `review_test_sessions` directly for packaging, and bundled in full runtime quiz integration (Due Review gate, drag-and-match play-through, grading dispatch, coin rule) as one phase. Following user direction, the scope is now split differently:

- **This spec (Phase 2)** — manage the paragraph library **on the existing `/words/add-paragraph` page**, not a new route. Covers: listing/filtering saved paragraphs, re-importing (adding more characters/phrases) into an already-saved paragraph, and defining named, reusable **test modes** (which spans should become fill-test blanks) per paragraph. **Ships no runtime quiz integration at all** — a saved test mode is not yet playable.
- **A future Phase 3 spec (not written yet)** — takes a saved test mode and actually wires it into the quiz runtime: `review_test_sessions` packaging, Due Review's quiz-ready gate, drag-and-match play-through, grading dispatch, coin rule, autosave/resume. All of the original draft's "Runtime integration" and "Coins" sections belong there, not here, once test modes exist to package.

**Scope-boundary note:** unlike the original draft, this phase does not touch anything child-facing and never runs a quiz — it is parent-facing content-preparation tooling, same shape as Phase 1. It does not need Phase 1's original Tier-2-exception framing (`0_PRODUCT_ROADMAP.md §3`'s "Structured Text Context: Phrase/paragraph fill tasks" gate is about *running* fill tasks, which this phase never does). Flagging this explicitly rather than silently dropping the caveat — worth a conscious roadmap call when this ships, not an assumption baked in silently.

## Problem

Phase 1 lets a parent import an article and persist it as fill-test source material, but a saved paragraph is completely inert afterward: there's no way to see what's already been imported, add more vocabulary to it later as the family's `words`/`vocab_phrases` library grows, or define which spans should eventually become quiz blanks. Every re-visit to `/words/add-paragraph` today only supports starting a brand-new paragraph from scratch.

## Scope

- **No new route.** `/words/add-paragraph` (Phase 1's existing route) gains a library/management surface alongside its existing paste-and-import form.
- A **paragraph list** on that page: title (or a raw-text preview when untitled), created date, and tag pills, filterable by:
  1. **Title** — free-text substring match against `paragraphs.title`.
  2. **Tags** — mirrors `/words/all`'s Tags (Cascade) multi-select filter exactly (`TextbookName · Grade · Unit · Lesson` format, plus a "None" option, OR-logic across selections) — but resolved against the **union of lesson tags across every one of a paragraph's resolved spans' underlying `words`/`vocab_phrases` rows**, not a tag on the paragraph itself (paragraphs carry no tags of their own).
- Selecting a paragraph from the list offers two actions:
  1. **Continue Import** — re-enter the paste/parse/select flow against that paragraph's existing (immutable) `raw_text`, re-triaged against the family's *current* `words`/`vocab_phrases` (which may have grown since the original import), so newly-known or still-unknown spans can be selected and added. This *appends* to the paragraph's existing `sentences[].spans[]` — it never replaces or removes what's already there. The paragraph's title is also editable during this flow (useful immediately, since title is now a filter key).
  2. **Prep Fill Test** — define one or more named, **editable** **test modes**: a saved, reusable selection of which of the paragraph's eligible (family-known) words/phrases should become blanks. Each test mode has its own name, **unique per paragraph** (not family-wide — two different paragraphs may each have a test mode named "Quiz 1"). A paragraph may have multiple test modes (e.g. "Easy — 3 blanks" and "Hard — 8 blanks" over the same text). An existing test mode's name and blank selection can both be revised later, not just created and deleted.
- The blank-selection UI (`TestModeBlankSelector.tsx`) renders every token in three, not two, visually distinct states — splitting Phase 1's single "known" bucket in two:
  1. **Unknown** — not in `words`/`vocab_phrases` at all. Inert, same as Phase 1.
  2. **Known, not eligible** — a persisted span on THIS paragraph whose `fillTestEligible` flag is explicitly `false`. Nothing sets this today (see Out of Scope), so in practice this state is currently unreachable — kept correct and forward-compatible for whenever a per-span toggle exists.
  3. **Eligible** — known to the family at all (in `words`/`vocab_phrases`), **regardless of whether this specific paragraph has already tracked it as one of its own persisted spans**. Clickable; carving it out adds it to the test mode's blank selection. **Corrected 2026-08-19** — the original build of this phase required a token to already be a persisted span on *this* paragraph to count as eligible, so a phrase curated and imported via a *different* paragraph showed as ineligible here even though it's exactly as real and gradable. That was wrong: being known to the family is what matters, not which paragraph's import flow happened to select it first. See the fix log for detail.
- Selecting an eligible token that isn't yet a persisted span on this paragraph is fine — saving the test mode **materializes** it: a `ParagraphSpan` is built from the same already-resolved `wordId`/`vocabPhraseId` triage found (no new `words`/`vocab_phrases` insert — it's already known), merged into `paragraph.sentences` via `updateParagraph`, *before* the test mode is created/updated to reference its id. This restores the implicit-span-materialization mechanism an earlier pass of this same build had removed (see Out of Scope) — removing it was the mistake the 2026-08-19 correction above undoes, not a good idea kept.
- Saving a test mode does **not** create a `review_test_sessions` row or anything runnable — seeing "playable" state is Phase 3's job. A test mode here is purely a saved blank-selection template.

## Out of scope

- The new `/words/paragraphs` route, `ParagraphDetailView.tsx`, and all runtime-integration work from the original draft (schema on `review_test_session_targets`, `FillSentence`/`FillTest` extensions, `gradeBundledFillTest` extension, `submitCurrentQuizWord` dispatch, `wrapParagraphRoundAsQuizWord`, Due Review's quiz-ready gate, coins) — all deferred to the future Phase 3 spec.
- Editing a paragraph's `raw_text` after import — it remains the immutable source of truth, per Phase 1. "Continue Import" only ever adds new spans against the existing text; it cannot change the pasted text itself.
- Removing or un-selecting an already-added span from a paragraph (Continue Import is additive-only). Deleting the whole paragraph remains the only removal path, unchanged from Phase 1.
- A UI to toggle an individual span's `fillTestEligible` flag to `false`. Every span still defaults to `fillTestEligible: true` at add-time (Phase 1) or at materialization time (this phase's Prep Fill Test) — nothing in this phase ever writes `false`. (Worth a follow-up once there's a real reason for a parent to exclude one specific already-tracked word from testing.)
- Any child-facing surface. Everything in this phase is parent/platform-admin only, same as Phase 1.

## Proposed behavior

### Schema: new table `paragraph_test_modes`

New table, modeled on `paragraphs`:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `paragraph_id` | uuid | FK → `paragraphs.id`, cascade delete |
| `family_id` | uuid | FK → `families.id`, cascade delete — denormalized for RLS, matching every other family-scoped table |
| `name` | text | Test mode display name |
| `span_ids` | jsonb | `string[]` — the `ParagraphSpan.id` values (from `paragraphs.sentences[].spans[]`) selected as blanks for this test mode; default `'[]'::jsonb` |
| `created_by_user_id` | uuid | FK → `users.id`, cascade delete |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Default `now()`; a test mode is now editable (see Scope), so this needs to be real, not vestigial |
| **Unique constraint** | | `(paragraph_id, name)` — **not** family-wide, a deliberate departure from `review_test_sessions`' family-wide active-name uniqueness, since a test mode is scoped to one paragraph |

RLS: family-scoped read; insert/update/delete restricted to `current_jwt_role() = 'parent'` or platform admin — same posture as `paragraphs` (not family-scoped-for-children; nothing here is child-facing).

### Schema: `paragraphs.updated_at` becomes meaningful

Phase 1 already has this column (default `now()` at insert, never explicitly written since nothing updated a paragraph). "Continue Import" is the first write path that updates an existing row — `updateParagraph` must set `updated_at = now()` explicitly on every write (Postgres `default now()` only applies at insert).

### Domain module extension — `src/app/words/add-paragraph/addParagraphIngestion.ts`

Reuses Phase 1's `resolveSelectedSpans`/`splitSpansNeedingInsert` unchanged. `mergeResolvedSpansIntoSentences` needs one small, backward-compatible change: today it *replaces* each sentence's `spans[]` outright; Continue Import needs it to *append* newly-resolved spans onto whatever a sentence's `spans[]` already contains.

```ts
export function mergeResolvedSpansIntoSentences(
  sentences: ParagraphSentence[],
  resolved: ResolvedParagraphSpan[],
  wordIdByHanzi: Map<string, string>,
  vocabPhraseIdByPhrase: Map<string, string>
): ParagraphSentence[] {
  // unchanged logic building `built: ParagraphSpan` per resolved span, EXCEPT:
  // spans: [...sentence.spans, ...(spansBySentence.get(sentence.index) ?? [])].sort(...)
  //        ^^^^^^^^^^^^^^^^^^^ new — preserves what was already there.
}
```

This is safe for Phase 1's original call site too: a brand-new paragraph always starts every sentence with `spans: []`, so appending onto an empty array is behaviorally identical to the current replace-based logic — no regression.

No new triage logic is needed for "which spans are already covered" — re-running `triageParagraphCharacters`/`triagePhrasesInText` against the paragraph's *current* `raw_text` and the family's *current* `words`/`vocab_phrases` naturally reports a previously-added span as "known" (its `existingWordId`/`existingVocabPhraseId` now resolves, since it's really in the DB), so it renders known/unselected and needs no special exclusion. Re-selecting and re-submitting it anyway is a harmless no-op skip, consistent with every other re-add path in the app.

### New pure module — `src/lib/paragraphLibrary.ts`

Co-located `.test.ts`, no I/O, mirrors `paragraphTriage.ts`'s placement (Domain layer, no `src/app/**` imports).

```ts
/** Union of lesson-tag ids across every resolved span in a paragraph. */
export function resolveParagraphTagIds(
  paragraph: Paragraph,
  wordTagsMap: WordLessonTagsMap,
  vocabPhraseTagsMap: VocabPhraseLessonTagsMap
): Set<string>;

/** Title substring match (case-insensitive); always true for an empty query. */
export function matchesParagraphTitleFilter(paragraph: Paragraph, query: string): boolean;

/** OR-logic tag match, "None" option support, mirrors tagFilter.utils.ts's existing cascade-tag matching convention used by /words/all. */
export function matchesParagraphTagFilter(
  resolvedTagIds: Set<string>,
  selectedTagIds: string[],
  includeNone: boolean
): boolean;
```

### Service layer (`src/lib/supabase-service.ts`)

```ts
export async function updateParagraph(
  id: string,
  fields: { title?: string | null; sentences?: ParagraphSentence[] }
): Promise<Paragraph>;

// paragraph_test_modes — following the vocab_phrases/paragraphs converter pattern
export async function listParagraphTestModes(paragraphId: string): Promise<ParagraphTestMode[]>;
export async function createParagraphTestMode(
  paragraphId: string,
  name: string,
  spanIds: string[]
): Promise<ParagraphTestMode>;
export async function updateParagraphTestMode(
  id: string,
  fields: { name?: string; spanIds?: string[] }
): Promise<ParagraphTestMode>;
export async function deleteParagraphTestMode(id: string): Promise<void>;
```

`createParagraphTestMode`/`updateParagraphTestMode` both surface the DB's unique-constraint violation as a typed "name already used for this paragraph" error the UI translates into an inline field error — mirrors how `review_test_sessions`' active-name uniqueness is handled today (exact-name reuse case), except here a collision is a hard error rather than an append-to-existing, since a test mode has no "existing session to append targets to" concept. Renaming a test mode to its own current name is not a collision (standard Postgres unique-constraint behavior — the constraint checks against *other* rows, not the row being updated).

`src/lib/paragraphTestMode.types.ts` — new domain type file, mirrors `paragraph.types.ts`'s placement:

```ts
export type ParagraphTestMode = {
  id: string;
  paragraphId: string;
  name: string;
  spanIds: string[];
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
};
```

### Route & components

All within the existing `src/app/words/add-paragraph/` directory — no new route directory:

- `AddParagraphSection.tsx` — gains a top-level view-mode switch: `"import" | "library" | "continueImport" | "testModes"`. Default view is `"library"` once the family has at least one saved paragraph, `"import"` (today's paste-and-parse form) when it's empty (nothing to list yet). The library view carries a prominent, primary-styled "+ Import New Paragraph" button (not a buried text link) as its call-to-action into `"import"`; the import view keeps a lighter "Browse saved paragraphs" link back, for whichever direction the parent didn't land on by default.
- `ParagraphLibrarySection.tsx` (new) — the filterable list. Visual baseline `AdminSection.tsx` per `0_BUILD_CONVENTIONS.md §7`, filter-bar structure mirrors `/words/all`'s Tags (Cascade) filter exactly (per user decision). Each row: title/preview, created date, tag pills, span count, test-mode count, "Continue Import" and "Prep Fill Test" actions.
- `ContinueImportSection.tsx` (new) — loads the selected paragraph's `raw_text` read-only (never re-editable, per Out of Scope), an editable title field, re-runs triage against current family state, reuses `ParagraphSpanSelector.tsx` unchanged for the new-span selection UI, submits via `updateParagraph` using the extended `mergeResolvedSpansIntoSentences`.
- `TestModeSection.tsx` (new) — per-paragraph test-mode management: lists existing test modes (name, blank count, **Edit** and **Delete** actions — delete is immediate, no confirmation dialog, matching the codebase default), and a "+ New Test Mode" form built around `TestModeBlankSelector.tsx` (below) plus a required name input and a save button. **Edit** opens the identical form pre-populated with that test mode's current name and carved-out spans (see below) and calls `updateParagraphTestMode` instead of `createParagraphTestMode` on save.
- `TestModeBlankSelector.tsx` (new) — **revised per user direction to closely resemble `ParagraphSpanSelector.tsx`, as a deliberate preview of the child-facing quiz layout**, not a plain checklist. Controlled component (implemented props: `{ paragraph, characterMatchesBySentence, phraseMatchesBySentence, selectedSpanIds, onSelectedSpanIdsChange, vocabPhrasePinyinByPhrase, str }`) — the same component serves both "+ New Test Mode" (`selectedSpanIds: []`) and "Edit" (`selectedSpanIds` pre-populated from the test mode's saved value); it never talks to `supabase-service.ts` directly, matching every other controlled-component pattern in this codebase (e.g. `TagCascadePicker`'s `"controlled"` mode).
  - Re-runs `triageParagraphCharacters`/`triagePhrasesInText` against the paragraph's sentence texts and the family's *current* `words`/`vocab_phrases` (same triage re-run Continue Import already does — no new triage logic needed).
  - Reuses `buildSentenceRenderTokens` (already exported from `ParagraphSpanSelector.tsx`) to merge those matches into per-sentence tokens — phrase-wins-over-character, same overlap rule as Phase 1.
  - New pure helper, exported and independently tested: `classifyTokenEligibility(token, persistedSpansForSentence): "unknown" | "ineligible" | "eligible"` — `"unknown"` when the token isn't known to the family at all; `"eligible"` when the token is known **at all**, regardless of whether this paragraph has tracked it as a persisted span yet; `"ineligible"` only when a persisted span on this paragraph is explicitly flagged `fillTestEligible: false` (see Scope's 2026-08-19 correction). Only `"eligible"` tokens are clickable.
  - Each eligible token gets a stable id whether or not it's already a persisted span: `computeSpanId(sentenceIndex, startOffset, endOffset)` produces the same deterministic `s{sentenceIndex}-{startOffset}-{endOffset}` format `addParagraphIngestion.ts` already assigns real spans, so a not-yet-tracked token's virtual id is exactly what its real span's id will be once materialized. `parseSpanId` inverts this; `resolvePendingSpan(spanId, paragraph, characterMatchesBySentence, phraseMatchesBySentence)` re-derives the full `ParagraphSpan` (text, kind, resolved word/phrase id) by re-running token classification at that id's position — used at save time (see `TestModeSection.tsx` below) to materialize anything selected that wasn't already a real span. `mergePendingSpansIntoSentences(sentences, newSpans)` groups newly-materialized spans by the sentence index embedded in their id and appends them.
  - Unlike Phase 1's selector, this is **click-to-toggle only — no drag/range-selection**. A blank is always exactly one already-atomic eligible token (one character or one whole phrase); there is no "build an arbitrary new span" need here the way free-form vocabulary selection had in Phase 1.
  - Selecting an eligible token **carves it out of its sentence** — the sentence renders a numbered blank marker (e.g. a dashed box showing "①") in its place, the same shape as the eventual child-facing drag-and-match blank (previewing Phase 3's actual runtime rendering, per the user's explicit ask to "let user see how child sees it"). The extracted token itself moves into a **word-bank block below all the sentences**, each entry showing its extracted text and the same number as its blank marker.
  - **Numbering is by paragraph reading position, not click/selection order**: recomputed on every selection change by sorting selected spans' `(sentenceIndex, startOffset)` and assigning 1, 2, 3… — a token from sentence 2 selected before one from sentence 1 still numbers as if reading left to right, top to bottom. This holds for the pre-populated Edit case too (an existing test mode's stored `spanIds` carry no order of their own; display order is always recomputed from position). Extracted as a pure helper, independently tested: `assignBlankDisplayIndexes(selectedSpanIds: string[], positionBySpanId: ReadonlyMap<string, SpanPosition>): Map<string, number>`.
  - Clicking a token's blank marker inline, or its chip in the word-bank block, un-carves it (moves it back into the sentence, renumbering the rest). On the Edit path this can shrink an existing test mode down to fewer blanks than it started with, including to zero (blocked at save time, per Edge Cases — not blocked at toggle time).
  - `TestModeSection.tsx`'s save handler (not this component) is what actually materializes pending spans: before creating/updating the test mode, it diffs `formSpanIds` against the paragraph's current persisted span ids, calls `resolvePendingSpan` for each id that isn't yet real, merges the results via `mergePendingSpansIntoSentences`, and persists via `updateParagraph` — only then does it call `createParagraphTestMode`/`updateParagraphTestMode` with the (now all real) span ids.
- `addParagraph.types.ts` — gains the view-mode union and any new prop types for the three new sub-components.
- `addParagraph.strings.ts` — gains library/filter/continue-import/test-mode copy (still the standalone file from Phase 1, per `0_BUILD_CONVENTIONS.md §4.1`).
- Test files alongside each new module, per `0_BUILD_CONVENTIONS.md §6`.

### State

Extends `src/app/words/shared/state/useAddParagraphState.ts` (Phase 1's composed hook) rather than adding a second one — same page, same vm, avoids splitting one page's state across two hooks. New fields: view mode, loaded `Paragraph[]`, title/tag filter state, selected paragraph (for Continue Import / Prep Fill Test), loaded `ParagraphTestMode[]` for the selected paragraph, new-test-mode form state (carved-token selection + name input).

`refreshAll()` in `words.shared.state.ts` gains a `listParagraphs().then(setParagraphs)` call, mirroring how `vocabPhrases` is loaded unconditionally today — the library list needs to be populated on page load, not lazily.

## Edge cases

- **Re-parsing a paragraph where nothing new resolves** (every Hanzi/phrase in the text is already known) — same "everything already known, selection still possible" tolerance as Phase 1's own edge case; submitting with no selection is a no-op that still allows a title change to save.
- **Title-only edit via Continue Import, no new spans selected** — must still succeed and persist the title change; `updateParagraph` should not require `sentences` to change.
- **Creating a test mode with zero tokens carved out** — blocked with a notice ("select at least one word or phrase to test"), mirroring the empty-selection guard pattern used elsewhere (e.g. batch tag assignment's "select at least one word").
- **Test-mode name collision within the same paragraph** — blocked with an inline error surfaced from the DB unique-constraint violation, input retains focus so the parent can rename and retry. Applies identically to create and to rename-via-edit.
- **Same name used for test modes on two different paragraphs** — must succeed on both; this is the whole point of per-paragraph (not family-wide) uniqueness.
- **Paragraph has zero eligible tokens yet** (nothing in the text is known to the family at all — every token is genuinely unknown) — "Prep Fill Test" shows an explicit empty state ("add characters or phrases to this paragraph first, via Continue Import") rather than a paragraph rendered entirely inert with no explanation. This is now a narrow case (fixed 2026-08-19): a phrase known via a *different* paragraph's import no longer needs its own Continue Import pass on *this* paragraph before it counts.
- **A token that was carved out gets un-carved, then the same token is carved out again in the same editing session** — must renumber correctly and not leave a stale/duplicate word-bank entry; covered by testing `assignBlankDisplayIndexes` directly against add/remove/re-add sequences.
- **Editing a test mode down to zero blanks and saving** — blocked with the same "select at least one" notice as creating with zero selected; the existing test mode is left unchanged rather than saved empty.
- **Editing a test mode without changing anything (open Edit, immediately Save)** — must succeed as a no-op update, not treated as a name collision against itself.
- **A previously-eligible span becomes ineligible while a test mode referencing it still exists** (only possible once a `fillTestEligible`-toggle UI exists — not this phase, per Out of Scope, but the data shape allows it) — `paragraph_test_modes.span_ids` is not defensively validated against current eligibility on read; a stale reference is a display/Phase-3 concern, not something this phase needs to reconcile.
- **Deleting a paragraph that has test modes** — `on delete cascade` on `paragraph_test_modes.paragraph_id` removes them; no separate confirmation beyond the existing immediate-delete-no-dialog paragraph-deletion precedent (Phase 1 ships no paragraph-delete UI yet either, so this is forward-looking for whenever that lands — flagging, not blocking).
- **Tag filter against a paragraph with spans resolving to characters/phrases that have since been deleted from `words`/`vocab_phrases`** — a `resolvedWordId`/`resolvedVocabPhraseId` with no matching current row simply contributes no tags (silent skip), matching the existing skip-invalid-silently precedent used elsewhere in the codebase (e.g. `resultsReviewTestSession.ts`).

## Risks

- **`mergeResolvedSpansIntoSentences`'s behavior change** (replace → append) is a shared function now serving two call sites (fresh import, Continue Import) — needs test coverage for both to guard against a regression silently wiping Phase 1's original create-time behavior.
- **Per-paragraph unique constraint on `paragraph_test_modes`** is a new pattern in this codebase (every other named/unique thing — textbooks, lesson tags, review test sessions — is family-wide unique). Double-check the Postgres composite unique index syntax is correct and the service-layer error-translation path actually distinguishes this constraint's violation from other insert/update failures before surfacing it as a friendly inline error — for `updateParagraphTestMode` specifically, confirm a rename-to-self doesn't false-positive as a collision.
- **Eligibility classification correctness** — `classifyTokenEligibility` cross-references live triage tokens against persisted spans by offset match; an off-by-one in offset comparison would silently misclassify a span as ineligible (or vice versa) rather than throwing, so this needs direct, deliberate test coverage rather than only incidental coverage through higher-level flows.
- **Scope creep risk**: it will be tempting to sneak Phase 3's runtime work in "since we're already touching paragraph UI." Resist — this phase ships nothing playable, by design, per the user's explicit direction.

## Test plan

- `src/lib/paragraphLibrary.test.ts` — `resolveParagraphTagIds` (union across word + phrase tags, empty when no spans resolve, skips deleted/dangling ids), `matchesParagraphTitleFilter` (case-insensitivity, empty-query passthrough), `matchesParagraphTagFilter` (OR-logic, "None" option).
- `src/app/words/add-paragraph/addParagraphIngestion.test.ts` extension — `mergeResolvedSpansIntoSentences` appends onto pre-existing spans without disturbing them, and the original fresh-paragraph (empty-spans) behavior is unchanged.
- `src/lib/supabase-service.paragraphs.test.ts` extension — `updateParagraph` (title-only update, sentences-only update, both).
- `src/lib/supabase-service.paragraphTestModes.test.ts` (new) — `listParagraphTestModes`/`createParagraphTestMode`/`updateParagraphTestMode`/`deleteParagraphTestMode` CRUD, unique-constraint-violation error translation on both create and update (including the rename-to-self non-collision case), RLS boundary assertions mocked.
- `addParagraph.test.tsx` extension — view-mode switching, filter-list rendering against seeded paragraphs.
- `TestModeBlankSelector.test.tsx` (new, or added to `addParagraph.test.tsx` per the existing "extracted pure helpers" seam) — `classifyTokenEligibility` (unknown vs. ineligible-not-yet-spanned vs. ineligible-flagged-false vs. eligible, exact offset matching), `assignBlankDisplayIndexes` (paragraph-position ordering regardless of click/selection order, renumbering on toggle-off, add/remove/re-add sequences, pre-populated Edit case), and a check that only eligible tokens can be toggled (unknown/ineligible clicks are no-ops).
- `scripts/verify-rls.ts` extended for `paragraph_test_modes`, mirroring the `paragraphs` Section 7 pattern (child-write-rejected, parent-write-succeeds including UPDATE, cross-family isolation) plus a same-paragraph-different-name-succeeds / same-paragraph-same-name-rejected pair specific to the new unique constraint.
- Manual: exercise the full Continue-Import and Prep-Fill-Test flows in-browser as a parent against a paragraph imported in Phase 1; confirm the title filter and tag filter both narrow the list correctly; confirm two test modes with the same name on two different paragraphs both save successfully; confirm a same-paragraph name collision is rejected on both create and rename; confirm editing an existing test mode's blanks and saving updates it in place, not as a duplicate.

## Acceptance criteria

- [ ] `/words/add-paragraph` shows a filterable list of previously-saved paragraphs (title search + tags cascade filter) once at least one exists.
- [ ] Selecting "Continue Import" on a paragraph re-triages its existing text against current family state, lets the parent select and add new characters/phrases, and lets the parent edit the title — all persisted back to the same `paragraphs` row via `updateParagraph`, never creating a duplicate.
- [ ] Selecting "Prep Fill Test" renders the paragraph in three visually distinct states — unknown / known-but-ineligible / known-and-eligible — and lets the parent click only eligible tokens to carve them out into a numbered word-bank block below (previewing the child-facing blank layout), then save that selection as a named test mode.
- [ ] Blank numbers always reflect paragraph reading order, not click/selection order.
- [ ] An existing test mode can be edited: its name and its blank selection (add and remove) can both be changed and re-saved in place, not just created and deleted.
- [ ] A paragraph can have multiple test modes; test-mode names are unique per paragraph but may repeat across different paragraphs, on both create and rename.
- [ ] No new route, no changes to `review_test_sessions`/`FillTest`/quiz runtime/Due Review/coins — a saved test mode is not playable yet.
- [ ] `scripts/verify-rls.ts` passes with `paragraph_test_modes` covered.
- [ ] All new pure-logic modules have passing unit tests; `npm test`, `tsc --noEmit`, and `npm run check:encoding` are clean.

## Open questions

1. ~~Blank-selection checklist UI~~ — **Resolved.** `TestModeBlankSelector.tsx` reuses `ParagraphSpanSelector.tsx`'s token-building (click-to-toggle only, no drag), carving selected eligible tokens out into a numbered word-bank block below the paragraph, previewing the child-facing blank layout. See Route & Components.
2. ~~`fillTestEligible` as a pre-carved default~~ — **Resolved, redefined.** Rather than auto-pre-selecting, `fillTestEligible` now drives a real three-way visual/interactive split (unknown / ineligible / eligible) — only eligible tokens are selectable at all, and nothing is pre-carved automatically on a brand-new test mode; the parent clicks every blank explicitly, even eligible ones. (The Edit path does pre-populate, but from that specific test mode's own previously-saved `spanIds`, not from `fillTestEligible` — that's not "pre-checking a default," it's restoring what was actually saved.)
3. ~~Editing an existing test mode's span selection~~ — **Resolved.** In scope now — see Scope, Service layer, and Route & Components.
4. ~~Default view~~ — **Resolved.** Library-first once the family has ≥1 saved paragraph, with a prominent, unmissable call-to-action (button, not a buried link) to start a new import — see Route & Components.
5. **Exact color/style for the "ineligible-known" middle state** — unknown reuses Phase 1's existing orange; eligible reuses Phase 1's existing green (clickable) and blue (carved/selected). Ineligible-known needs a fourth, new, visually distinct-but-clearly-related color — proceeding with a muted/desaturated gray-green ("this is a real word, just not usable here" — not an error state, so not red) per the earlier recommendation, since this wasn't redirected.

## Nav & naming

The nav item and page title for this route rename from "Add Paragraph" to **"Manage Paragraphs"** — the page's primary job is now browsing/managing a library, not just one-shot importing. `words.strings.ts`'s `nav.addParagraph` key keeps its existing key name (no reason to touch every call site that already imports it) but its EN/ZH string values change to "Manage Paragraphs" / "管理短文". The route itself stays `/words/add-paragraph` (URL unchanged — renaming a live route is out of scope and not what was asked).
