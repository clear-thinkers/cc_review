# ARCHITECTURE

_Last updated: 2026-08-13_

---

## About This Document

This document covers: system structure, layer boundaries, data schema, error handling behavior, and docs filing rules.
It does **not** define agent operating rules — those live in `AI_CONTRACT.md`. See `AI_CONTRACT.md §3` for the required reading order before starting any task.

---

## 1) Product Rules

This project is a **Supabase-backed Chinese memory engine** with deterministic review behavior.

Tier 1 rules (active):
- Review is scheduler-driven and deterministic (`again|hard|good|easy` grade mapping — no stochastic grading).
- Review sessions consume **persisted content only** — no live generation.
- AI generation is scoped to admin authoring workflows only: `/words/admin` → `/api/flashcard/generate` (characters) or `/api/vocab-phrase/generate` (phrases).
- Flashcard content is keyed by `character|pronunciation` and normalized before persistence. Vocab phrases are keyed by `(family_id, phrase)` and are flat — no nested meanings.
- Fill-test eligibility is derived from saved phrase/example rows and `include_in_fill_test` flags. One eligible phrase/example row is enough for runtime quiz eligibility; low-phrase characters are bundled at session start. A vocab phrase needs one eligible example and always forms its own round, never bundled with characters.
- Unsafe content and malformed payloads are dropped during normalization before they can be persisted.
- Coins are earned from completed quiz sessions and spent through shop unlocks or redeemed for real-dollar value; neither action changes scheduler state or quiz history.
- `wallets.total_coins` is a running spendable balance — it is decremented by shop unlocks and coin redemptions. It is NOT a total-earned counter; `quiz_sessions.coins_earned` is the immutable per-session earned record and is never modified by redemptions.

Primary admin user flow:
1. Add Hanzi/phrases → `/words/add`   → Supabase `words` table (characters) or `vocab_phrases` table (comma/space/line-separated batch), both unreviewed until curated.
2. Manage tags     → `/words/add`, `/words/all`, `/words/admin`
                                         → assign textbook / grade / unit / lesson
                                         → Supabase `word_lesson_tags` / `vocab_phrase_lesson_tags` + tag tables.
3. Adjust prompts  → `/words/prompts` → edit/version AI prompt templates → Supabase prompts table.
4. Curate content  → `/words/admin`   → `/api/flashcard/generate` (characters) or `/api/vocab-phrase/generate` (phrases) + manual edits
                                         → Supabase `flashcard_contents` / `vocab_phrases` tables.
5. Package tests   → `/words/admin`   → named review test sessions, characters and/or phrases
                                         → Supabase `review_test_sessions*` tables.
6. Review & quiz   → `/words/review`, `/words/review/flashcard`, `/words/review/fill-test`
                                         → reads persisted data only; phrase rounds run separately from character rounds.
7. Reward loop     → `/words/results`, `/words/shop`
                                         → Supabase `quiz_sessions`, `wallets`, and shop tables.
8. Manage shop     → `/words/shop-admin`, `/words/debug`
                                         → shared recipe metadata, ingredient catalog, and icon audits.


### Ingestion Rules

These rules govern all character ingestion via `/words/add`:

1. Input accepts free text — only Hanzi characters are extracted. Non-Hanzi symbols (letters, punctuation, numbers, emoji) are ignored.
2. Multi-character strings are split into individual Hanzi characters.
3. Duplicate characters within the same submission are removed before writing.
4. Characters already present in the `words` table are skipped — no overwrite occurs.
5. New records are initialized as unreviewed (`repetitions=0`, `nextReviewAt=0`, no fill-test content).
6. A bilingual status message is shown after every submission covering three states: nothing added, all added, some added and some skipped.
7. Add flow does not auto-generate flashcard or admin content — Content Admin remains a separate step.
8. An optional collapsible "Assign to Lesson" section below the Hanzi input allows a 4-level cascade tag (Textbook → Grade → Unit → Lesson) to be applied to all words in the batch.
9. Tag selection is all-or-nothing: if the section is open, all 4 levels must be filled before submitting. Partial selection blocks submission with an inline error.
10. If the section is collapsed or untouched, no tag is applied and no validation is performed.
11. Tag assignment is performed after word insertion checks complete. When a valid 4-level tag is selected, it is applied to all submitted matching characters in the family collection, including already-existing words that were skipped for insertion.
12. Children cannot access `/words/add` — the route is blocked; tag UI is not visible to child profiles.
13. Submitting Hanzi to `/words/add` also clears any matching `hidden_admin_targets` rows for that family, restoring previously deleted Content Admin rows for those characters.

### Add Paragraph Rules (`/words/add-paragraph`)

These rules govern the Phase 1 article-import route (Tier 1, Item I), added 2026-08-17. Spec: `docs/feature-specs/2026-08-17-add-paragraph-article-import.md`.

1. `/words/add-paragraph` is parent/platform-admin only, matching `/words/add`'s role gate. Children are redirected, no error shown.
2. A pasted submission is split into sentences (`splitIntoSentences`/`buildParagraphSentences` in `src/lib/paragraphParsing.ts`) on Chinese/ASCII sentence-ending punctuation and newlines; a blank line (2+ consecutive newlines) between two sentences sets `paragraphBreakBefore: true` on the following sentence, for faithful re-rendering only — it never affects round-building.
3. Pasted input over 5,000 characters (`MAX_PARAGRAPH_INPUT_LENGTH`) is truncated to the first 5,000 characters with a notice, rather than blocked outright or left unbounded.
4. Every Hanzi occurrence is triaged against `words` (`triageParagraphCharacters`); every substring matching an existing `vocab_phrases.phrase` is triaged against `vocab_phrases` (`triagePhrasesInText`), both in `src/lib/paragraphTriage.ts`. A character appearing multiple times produces one independently-selectable match per occurrence.
5. Overlap resolution: when a known-phrase match and a character match cover the same text, the phrase always wins for both rendering and selection — the phrase renders/selects as one atomic unit, and its component characters are never independently selectable within that range. This merge lives in the UI layer (`ParagraphSpanSelector.tsx`'s `buildSentenceRenderTokens`), not in the pure triage functions.
6. Selection is free — any span, known or unknown, character or phrase, can be selected via click or click-and-drag. Re-adding an already-known word/phrase is a harmless no-op skip, same as `/words/add`'s existing ingestion rules. **Updated 2026-08-20**: click-and-drag now also works on touchscreens — `touchstart`/`touchmove`/`touchend` drive the same anchor/hover drag state as `mousedown`/`mouseenter`/`mouseup`, hit-testing the token under the finger via `document.elementFromPoint` on every `touchmove` (a two-sequential-tap alternative was tried first and reverted: it couldn't reliably extend a selection across 3-4+ characters). See `docs/fix-log/build-fix-log-2026-08-20-paragraph-selector-touch-and-merge-visibility.md`.
7. A drag selection can only extend within one contiguous run of selectable (Hanzi) tokens — crossing a non-Hanzi token (punctuation, space) clamps the selection back to the anchor token alone rather than merging across the gap. **Updated 2026-08-20**: a committed multi-token selection renders as one continuous pill (`groupTokensForSelection` in `ParagraphSpanSelector.tsx`) instead of N individually-bordered character boxes, so a selected phrase is visually distinguishable from several adjacent single-character selections; clicking/tapping anywhere on the pill deselects the whole phrase in one action.
8. On submit, a selected single-character span resolves against `words`; a selected multi-character span resolves against `vocab_phrases` — whether or not that exact range was already a known-phrase match. Ingestion reuses `addWords`/`addVocabPhrases` unmodified (Ingestion Rules 1–7 above apply identically: uncurated, `repetitions=0`, no flashcard content, Content Admin remains the separate curation step).
9. An optional single Textbook → Grade → Unit → Lesson tag may be applied to the whole submitted batch (both newly-added and already-existing selected items), following the same all-or-nothing completeness rule as Ingestion Rule 9.
10. The full pasted text and its parsed sentence/span structure persist to one `paragraphs` row per submission — never split into multiple rows regardless of how many paragraph breaks or sentences it contains. Only the spans the parent actually selected and submitted are recorded in `sentences[].spans[]`; a known-but-unselected triage match is not persisted as a span.
11. Partial failure mid-submit (e.g. word/phrase insert succeeds but the `paragraphs` row fails to save) surfaces an error notice and keeps the pasted text in the textarea for retry; already-inserted words/phrases are never rolled back, matching the same non-atomic tolerance `/words/add`'s batch phrase flow already accepts.
12. Phase 1 ships no way to view, edit, re-triage, or package a saved paragraph — it is write-only from the user's perspective until the separate Phase 2 spec's library page exists.

Rules 13+ govern Phase 2 (library, re-import, test-mode prep — 2026-08-18). Spec: `docs/feature-specs/2026-08-17-paragraph-fill-test.md`. Still no new route — everything lives on `/words/add-paragraph`, now titled "Manage Paragraphs" in the nav. **Updated 2026-08-19**: Phase 3 (packaging a test mode into a runnable, playable session) has since shipped — see Fill-Test Review Rules 28+ below and `docs/feature-specs/2026-08-19-paragraph-quiz-runtime.md`. Rules 13–21 below (Phase 2 itself) are otherwise unchanged.

13. `/words/add-paragraph` is library-first once the family has ≥1 saved paragraph; the blank-import form is the default only when the library is empty. A prominent "+ Import New Paragraph" button (not a buried link) is always available from the library view, and a "← Browse saved paragraphs" link is always available from the import form once the library is non-empty.
14. The library list is filterable by title (case-insensitive substring match against `paragraphs.title`) and by tags — mirroring `/words/all`'s Tags (Cascade) multi-select filter exactly (OR logic, "None" option) — resolved against the **union of lesson tags across every one of a paragraph's resolved spans' underlying `words`/`vocab_phrases` rows**, since a paragraph carries no tags of its own.
15. **Continue Import** re-triages an already-saved paragraph's immutable `raw_text` against the family's *current* `words`/`vocab_phrases` and lets the parent select and add new spans. It is strictly additive: previously-added spans on that paragraph are never removed or replaced, only appended to. The paragraph's title is editable in this flow (title-only saves, with no new span selection, are a valid submission). The raw text itself is never editable.
16. Adding words/phrases from `/words/add-paragraph` (fresh import or Continue Import) triggers a full `refreshAllData()` (not just a local optimistic patch) immediately after the insert succeeds — required because a second submission later in the same browser session would otherwise re-triage against stale `words`/`vocab_phrases` state and attempt to re-insert something already added, which fails as a real Postgres unique-constraint conflict rather than the intended silent skip (`addWords`'s upsert `onConflict` target is `id`, which is always fresh client-side, not `hanzi`).
17. **Prep Fill Test** splits Phase 1's single "known" token state into three for span-selection purposes: unknown (not in `words`/`vocab_phrases` at all), ineligible (a persisted span on *this* paragraph explicitly flagged `fillTestEligible: false` — currently unreachable, since nothing sets it false, kept correct for a future per-span toggle), and eligible (known to the family at all, **regardless of whether this specific paragraph has already tracked it as one of its own persisted spans**). Only eligible tokens are selectable as blanks. **Corrected 2026-08-19**: eligibility originally required the token to already be a persisted span on this specific paragraph, so a phrase curated and imported via a different paragraph wrongly showed as ineligible here — fixed to key off family-wide known status instead. See `docs/fix-log/build-fix-log-2026-08-19-paragraph-eligibility-scoped-too-narrowly.md`.
18. Selecting an eligible token in Prep Fill Test carves it out of its rendered sentence position (leaving a numbered blank marker) into a word-bank block below all the sentences — a deliberate preview of the eventual child-facing blank layout. Numbering always reflects paragraph reading order (sentence index, then offset), never click/selection order, and is recomputed on every selection change. If the selected token wasn't already a persisted span on this paragraph, saving the test mode materializes one first (from the already-resolved `wordId`/`vocabPhraseId` triage found — no new `words`/`vocab_phrases` insert) via `updateParagraph`, before the test mode is created/updated to reference its id.
19. A **test mode** (`paragraph_test_modes`) is a named, saved selection of blank span ids for one paragraph — nothing more. Saving one does not create a `review_test_sessions` row or anything runnable. A paragraph may have multiple test modes; test-mode names are unique **per paragraph**, not family-wide, so two different paragraphs may each have a test mode with the same name.
20. An existing test mode's name and blank selection are both editable in place (not create/delete-only) via the same form used to create one, pre-populated from the test mode's saved state.
21. Creating or renaming a test mode to a name already used by another test mode on the *same* paragraph is rejected with an inline error (surfaced from the DB's `(paragraph_id, name)` unique-constraint violation); renaming a test mode to its own current name is not a collision.

### All Characters Inventory Rules

These rules govern the inventory view at `/words/all`:

1. The page renders all rows from the local `words` table, subject to filtering and pagination.
2. Summary cards are computed from in-memory `words` state (before filters applied):
   - `Total Characters`: `words.length`
   - `Times Reviewed`: sum of `reviewCount` with fallback to `repetitions`
   - `Times Tested`: sum of `testCount`
   - `Avg Familiarity`: mean of `getMemorizationProbability(word)`
3. Table sorting is client-side and single-column.
4. Re-clicking the active sort column toggles direction (`asc`/`desc`).
5. Sort tie-breaker is `createdAt` ascending for deterministic ordering.
6. `Next Review Date` shows `Now` when `nextReviewAt` is empty or `0`.
7. `Reset` keeps the same `id` and `hanzi`, resets scheduling counters to baseline values, and updates `createdAt`.
8. `Delete` removes the row from Supabase immediately (no confirmation dialog). **Updated 2026-08-19**: blocked outright (inline error, no delete attempted) if the character's hanzi is referenced by any active (`completed_at is null`) packaged session's target — character, phrase, mixed, or paragraph-quiz alike — via `getActiveSessionTargetKeys()`. This composes with the existing conditional `window.confirm` for flashcard-content loss (rule stays the same when the character isn't blocked). An unrelated character with no active-session involvement is completely unaffected.
9. `Reset` and `Delete` action buttons are hidden for child profiles. Only parents and platform admins can reset or delete words.
10. The page does not call AI generation routes.
11. The page does not generate or edit flashcard/admin content.
12. The page does not deduplicate historical duplicate rows; it renders stored data as-is.
13. **Pagination**: The table shows 50 words per page. Navigation uses First, Previous, Next, Last buttons. Page info shows "Page X of Y". Pagination applies after all filters.
14. The page owns display/sorting behavior only; scheduler logic remains in `scheduler.ts`.
15. A **Tags column** displays cascade tag pills (`TextbookName · Grade · Unit · Lesson`) for non-child roles. Multiple tags stack vertically; no tags = empty cell.
16. **Default Filter Bar** (always available at top): Four filter sections:
    - **Due Now**: Checkbox to show only characters with `nextReviewAt <= now` (or `0`/empty).
    - **Familiarity**: Operator dropdown (`<=` or `>=`) and number input (0-100) to filter by `getMemorizationProbability(word)`.
    - **Tags (Cascade)**: Multi-select dropdown showing all available cascade tags (format: `TextbookName · Grade · Unit · Lesson`) plus a `None` option for characters with no tags. OR logic: word must have ANY selected tag, or no tags when `None` is selected, to be shown.
    - **Filter by Tag Part**: Four cascade dropdowns (Textbook → Grade → Unit → Lesson). Each level narrows the options in the levels below it. When any level is set, a word must have at least one tag satisfying ALL specified levels to pass. Operates independently of Tags (Cascade); when both are active, a word must satisfy both (AND logic). Clearing a parent level resets all child levels.
    - **Character Search**: Text input that extracts Hanzi using `extractUniqueHanzi`. A word must have its `hanzi` in the extracted character set to pass. When the input is empty or contains no valid Hanzi, the filter is inactive and all words pass.
17. Default filters can be individually toggled on/off; a [Clear Filters] button resets all four.
18. When filters are active and no words match, "No characters match the selected filters." is shown with a Clear Filters link.
19. Default filter state is local UI state and does NOT persist via URL params.
20. The page does not expose a separate legacy Textbook / Grade / Unit / Lesson filter bar.
21. Non-child users can multi-select words in the table and batch-assign a single 4-level cascade tag (Textbook / Grade / Unit / Lesson) to all selected words.
22. Batch tag assignment uses existing tag creation and assignment services; duplicate assignments are ignored by upsert behavior.
23. The Tags column and tag batch-editing controls are hidden for child users on `/words/all`.

Rules 24+ govern the `/words/all` **Phrases** view — a Characters/Phrases toggle (the shared `CharacterPhraseToggle` component, the same one used on Content Admin) swaps the whole content area below the page header; rules 1-23 above are unchanged when Characters is active. Page title is "All Characters & Phrases".

24. The Phrases view is a flat table over `vocab_phrases`, mirroring the Characters table's inventory purpose (read-mostly, delete, tag management) rather than Content Admin's curation purpose — no AI generation, no content editing here.
25. Summary cards: **Total Phrases**, **Times Tested** (sum of `test_count`), **With Content** (`vocabPhraseHasContent()` count, same helper Content Admin's Phrases filter uses), and **Contains Added Characters** (count of phrases with at least one component Hanzi that exists in the family's `words` table — resolved via `extractUniqueHanzi` the same way the fill-test familiarity nudge resolves a phrase's component characters).
26. The default filter bar mirrors the Characters view's filter bar exactly in structure and interaction (Phrase Search, Tags multi-select with a "None" option, Filter by Tag Part 4-level cascade, Has Content?) but omits Due Now and Familiarity — `vocab_phrases` has no SRS/due-date/familiarity state at all, so neither concept applies.
27. The table's **Added Characters** column (replacing Characters' Definition/Next-Review-Date/Familiarity columns) lists the phrase's own component Hanzi that already exist as standalone added characters, dash when none.
28. Actions column is **Delete only**, immediate with no confirmation dialog (matching the Characters view's no-content-cascade delete path) — no Reset button, since phrases carry no scheduling counters to reset. **Updated 2026-08-19**: blocked outright (inline error) if the phrase's id is referenced by any active packaged session's target, via the same `getActiveSessionTargetKeys()` check as All Characters Inventory Rule 8.
29. Tag management is a single "assign tag to selected phrases" flow via the shared `TagCascadePicker` in immediate mode — not the Characters view's three-action Save/Update/Clear batch editor.
30. Pagination is 50/page, matching the Characters view — unlike Content Admin's Phrases view, which has none.
31. The checkbox column, Tags column, batch tag-assignment section, and Actions column are all hidden for child users, matching rule 23 for the Characters view.

### Content Admin Curation Rules

These rules govern content curation at `/words/admin`:

1. Curation targets are `character|pronunciation` pairs derived from `words.hanzi` plus Xinhua pronunciation discovery.
2. The page may load, draft, normalize, and persist flashcard content only in `flashcardContents`.
3. The page must not write to `words`, modify scheduler fields, or run review sessions.
4. Generation calls are routed through `/api/flashcard/generate` (no direct provider calls from UI code).
5. Every persisted admin save path must pass through normalization before write.
6. Invalid draft rows are dropped during normalization; unsaved drafts are not review content.
7. `include_in_fill_test` is persisted immediately on toggle and directly controls testing eligibility.
8. Content-status buckets are defined as:
   - `with content`: at least one normalized phrase row exists
   - `missing content`: no normalized phrase row exists
   - `ready for testing`: has content and at least one phrase included for fill test; runtime bundled fill-test mode can quiz one- or two-phrase characters
   - `excluded for testing`: has content but no phrase included for fill test
9. Batch AI content generation has four scopes on the Content Admin toolbar: `missing only` (skips targets that already have content), `all` (overwrites every target), `filtered only`/`selected only` (overwrites their resolved target set). The destructive `all` action requires a confirmation dialog.
10. Characters with no dictionary pronunciation are skipped with notice; this is not a fatal load error.
11. Batch AI content generation runs at a fixed concurrency of 3 (`Promise.allSettled`), capped to avoid saturating the AI provider; do not raise it without validating provider rate limits. No per-character retry — a failure is counted and skipped, the loop continues, and the completion notice reports succeeded/failed totals. Batch pinyin generation shares the same toolbar and four scopes but only touches saved content rows: `missing only` fills missing pinyin, the other three refresh pinyin for their resolved set. The destructive `all` pinyin action requires confirmation.
12. A **default filter bar** is displayed above the character list. It includes:
   - **Due Now**: Checkbox to show only admin targets whose associated character has at least one due word (`nextReviewAt <= now` or `0`/empty).
   - **Familiarity**: Operator dropdown (`<=` or `>=`) and number input (0-100) to filter by `getMemorizationProbability(word)` of the target's underlying character word, keyed by `target.character`. No separate Has Content? dropdown is offered here — the With Content/Missing Content/Ready for Testing/Excluded for Testing stat cards above the filter bar already cover content-status filtering for the Characters view.
   - **Tags (Cascade)**: Multi-select dropdown showing available cascade tags (`TextbookName · Grade · Unit · Lesson`). Content Admin tag matching uses OR logic within a target's associated word tags.
   - **Filter by Tag Part**: Four cascade dropdowns (Textbook → Grade → Unit → Lesson). Each level narrows the options in the levels below it. When any level is set, a target must have at least one tag satisfying ALL specified levels to pass. This filter operates independently of the Tags (Cascade) filter; when both are active, a target must satisfy both (AND logic). Clearing any parent level resets all child levels.
   - **Character Search**: Text input that extracts Hanzi using `matchesCharacterSearchFilter`. A target must have its `character` in the extracted set to pass. When the input is empty or contains no valid Hanzi, the filter is inactive and all targets pass.
13. Characters with no tags are hidden when any filter is active.
14. No Lessons column is added to the admin table (filter-only in this phase).
15. Target-level destructive actions are split:
   - `C/清` clears saved `flashcard_contents` only and keeps the row visible.
   - `D/删` deletes the entire Content Admin row for that `character|pronunciation` pair.
16. The `D/删` row-delete action requires a confirmation dialog before mutation.
17. The app must not allow deleting the last remaining Content Admin pronunciation row for a character. If attempted, a blocking popup instructs the user to delete the character from `/words/all` instead.
18. Deleted Content Admin rows are persisted in `hidden_admin_targets` and excluded from future admin target derivation for that family.
19. Re-adding a Hanzi on `/words/add` restores any hidden Content Admin targets for that Hanzi across all pronunciations in the current family.
20. Content Admin pagination must not split a character across pages. If a page boundary would cut through a character's rows, the entire character block stays together on the earlier page, even when that page exceeds the nominal row count.
21. Parent and platform-admin users can multi-select Content Admin targets and package them into a named review test session.
22. Review test session selection unit is the existing Content Admin target key: `character|pronunciation`.
23. Review test session names are unique per family among active sessions and remain case-sensitive.
24. Reusing an existing active session name with exact case appends only new `character|pronunciation` targets to that session instead of creating a duplicate session row.
25. Review test session creation order is computed at save time by familiarity ascending, then character ascending, then pronunciation ascending.
26. Creating or appending a review test session persists only target membership metadata; it does not duplicate flashcard content into a second content table.

Rules 27+ govern the Content Admin **Phrases** view — a Characters/Phrases toggle swaps the whole table body; rules 1–26 above are untouched when Characters is active:

27. The Phrases view is a flat table over `vocab_phrases` — one row per phrase, no character→meaning→phrase nesting (there is nothing to nest at the phrase level). Phrase creation happens only via `/words/add`'s batch entry, not on this page — there is no inline "+ New Phrase" row.
28. Generation calls route through `/api/vocab-phrase/generate` (never `/api/flashcard/generate`), with two modes: a default one-shot full generate (pinyin + both definitions + one example) and `mode: "example_pinyin"` (pinyin for one hand-typed or hand-edited sentence, used by the per-example E/+Example actions).
29. The Phrases view has its own default filter bar (Phrase Search, Has Content?, Tags Cascade, Filter by Tag Part) mirroring the Characters filter bar, minus **Due Now** and **Familiarity** — `vocab_phrases` has no SRS/due-date/familiarity state at all (no `repetitions`/`ease`/`next_review_at`), so neither concept applies. **Has Content?** (All/Yes/No) filters on `vocabPhraseHasContent(phrase)` — the same helper the batch "missing only" content-generation scope already uses — unlike the Characters view, the Phrases view has no content-status stat cards, so this dropdown is its only content-status filter.
30. The Phrases view has its own selection/batch toolbar mirroring the Characters one (batch AI generation at concurrency 3, Add to Review Test Session, batch include-in-test-bank toggle) with two deliberate non-1:1 behaviors: batch "Pinyin Generation" only refreshes `examples[].pinyin` via the narrow `example_pinyin` mode (phrase-level pinyin/definitions are generated together with the full one-shot generate, so there's no batch-pinyin-only precedent to port); batch "Include in test bank" toggles `include_in_fill_test` on every example of every selected phrase (all-or-nothing), since the flag lives per-example, not per-phrase. There is no "Select page" action — the Phrases view has no pagination. **No tag-assignment action on this toolbar** — batch tag assignment for phrases was removed from here and now lives only on `/words/all`'s Phrases tab (rule 29 below `/words/all`'s All Characters Inventory Rules), to avoid two separate tag-assignment entry points for the same `vocab_phrase_lesson_tags` data. The Tags Cascade/Filter-by-Tag-Part *filters* in this view's own filter bar (rule 29 above) are unaffected — only the assign-a-tag action was removed.
31. Packaging phrases into a review test session is a standalone selection/toolbar parallel to the Characters one (not the same `adminTargets` state, which is character-specific), calling the same underlying `createReviewTestSession`/`appendTargetsToReviewTestSession` service functions. A session may mix character and phrase targets.

### Due Review Queue Rules

These rules govern the due queue view at `/words/review`:

1. `/words` redirects to `/words/review`, making due review the operational review entry route.
2. Due eligibility is sourced from `getDueWords()`:
  - rows with `nextReviewAt <= now` are due
  - missing/zero `nextReviewAt` is treated as due
3. The page derives and displays due-list presentation state only (count, sort order, familiarity, action availability).
4. Fill-test availability is derived from saved `flashcardContents` and attached in-memory to due rows; this page does not persist fill-test content.
5. The page routes to `/words/review/flashcard` and `/words/review/fill-test`, optionally scoped by `wordId`.
6. This page must not grade words, mutate scheduler fields, create/delete words, or persist admin content edits.
7. Due-table sorting is client-side; default due ordering uses `nextReviewAt` then `createdAt` as tie-breaker.
8. Fill-test start/action controls are enabled when a due row has at least one usable derived fill-test phrase/example row.
9. Fill-test sessions use bundled runtime planning: one- and two-phrase characters are queued in bundled quizzes before ordinary three-sentence quizzes; standard characters used as bundle partners do not appear again as ordinary quizzes in the same session.
10. Any change to fill-test eligibility or semantics must be reflected here and in the Content Admin Curation Rules (§1) concurrently. Failure to update both documents is a documentation gap.
11. Due Review also lists active packaged review test sessions for both parent and child users.
12. Packaged review test sessions are visible on Due Review even when their packaged characters are not currently due.
13. Parents may inspect packaged targets from Due Review and may delete an active packaged review test session, but cannot initiate one.
14. Children (and platform admin) may initiate a packaged review test session from Due Review only when at least one packaged character has usable quiz content.
15. Packaged review test sessions run in two phases: flashcard review first, then immediate handoff into bundled fill-test planning for the same packaged character set.
16. Runtime groups multiple packaged targets for the same Hanzi back into one character-level review/test unit; grading remains character-level on the underlying `words.id`.
17. If duplicate `words` rows for the same Hanzi are encountered at packaged-session runtime despite the schema uniqueness rule, the session must block with an error rather than guess.
18. Completing a packaged review test session marks it complete and removes it from the active Due Review session list; its name becomes reusable for a future session in the same family.
19. Parents may remove a single packaged target (one `character|pronunciation` row) from an active review test session without deleting the rest of the session. This uses the existing parent-scoped `DELETE` policy on `review_test_session_targets` — no new RLS policy, RPC, or route.
20. Removing a packaged target is immediate with no confirmation dialog, matching the `/words/all` delete precedent (§ All Characters Inventory Rules, rule 8) — except when the target being removed is the session's last remaining target, in which case the removal deletes the whole session and reuses the existing whole-session delete confirmation dialog instead.
21. Per-target delete controls are visible to parents only, matching the visibility rule for whole-session deletion; children never see per-target delete controls on Due Review.
22. Due Review lists paused sessions of BOTH source types — ad-hoc due-review AND packaged — in one unified "Paused Sessions" table, sourced via `listReviewSessionProgress()` with no `source_type` filter. Packaged and ad-hoc paused sessions are never split into separate list UIs; they share one Resume/Discard affordance.
23. Child and platform-admin viewers see only their OWN paused sessions (client-filtered by `userId`, even though `listReviewSessionProgress` returns the whole family under the family-scoped read RLS policy) with **Resume** and **Discard** actions. One child must never resume or discard a sibling's paused session, even though the user-scoped write RLS policy would independently reject the attempt.
24. Parents see every family member's paused sessions unfiltered, read-only (existence + last-saved time + characters remaining only) — no Resume or Discard controls, matching the existing read-only visibility pattern for packaged sessions (rule 13).
25. The Paused Sessions section does not render when the current viewer has no paused sessions to show (no empty-state message), matching the surrounding page's density.
26. Discarding a paused session is immediate with no confirmation dialog, matching the `/words/all` delete precedent (§ All Characters Inventory Rules, rule 8).
27. Resuming a paused session branches by `source_type`: an ad-hoc due-review row navigates to `/words/review/fill-test?resumeProgressKey=<clientSessionKey>`; a packaged row navigates to `/words/review/fill-test?reviewTestSessionId=<packagedSessionId>` instead — the SAME entry point as starting a fresh packaged session — deliberately skipping the flashcard phase, since flashcard review is non-graded and re-doing it isn't required to resume grading.
28. Each Paused Sessions row displays a session label alongside its saved/remaining info: a packaged row shows the packaged session's name (resolved from the same session list backing the Test Sessions table above, falling back to the raw session id if that list hasn't loaded yet); an ad-hoc due-review row shows a generic "Due Review" label.
29. A packaged session's "quiz-ready" count and its Start-button gate both cover character targets (`quizWords`) **and** vocab-phrase targets (`vocabPhrases`, filtered to phrases with at least one fill-test-eligible example) — a phrase-only session must never read as 0/0 quiz-ready. **Updated 2026-08-19**: a resolved paragraph-quiz session's blank count folds into this same `quizReadyCount` mechanism too (see Fill-Test Review Rule 37) — a paragraph-quiz session must never read as 0/0 either.
30. Starting a packaged session routes through the flashcard phase first only when it has at least one character target. A phrase-only packaged session skips flashcard review entirely and goes straight to `/words/review/fill-test?reviewTestSessionId=<id>` — vocab phrases have no flashcard entity, so that phase would always be empty. Mixed sessions are unaffected: the flashcard phase still runs for their character targets.
31. The due-words table (not the Test Sessions or Paused Sessions tables) has a checkbox column plus a header "Select all visible" checkbox, matching the same pattern already used on `/words/all`. Selection is local UI state, not persisted.
32. Three batch actions act on the current selection, each visible to the same role set as its existing single-word equivalent: **Review Selected** (parent + child, matching the always-visible per-row Flashcard button) opens `/words/review/flashcard?wordIds=<comma-separated ids>`; **Test Selected** (child + platform-admin only, matching the existing `canAccessFillTest`-gated per-row Fill Test button) opens `/words/review/fill-test?wordIds=<...>`; **Add Selected to Session** (parent + platform-admin only, matching Content Admin's existing packaging permission — gated by the same `/words/admin` route-access check) packages the selection into a new or existing `review_test_sessions` row, reusing `createReviewTestSession`/`appendTargetsToReviewTestSession` exactly as Content Admin does.
33. `wordIds` is a new query param on `/words/review/flashcard` and `/words/review/fill-test`, parallel to the existing single-word `wordId` param (both still supported; `wordIds` takes precedence if somehow both are present). It is purely a runtime queue filter — no `review_test_sessions` row is created, unlike Add Selected to Session. This is the mechanism the batch Review/Test actions use.
34. Add Selected to Session resolves each selected due word to Content Admin target rows by matching `adminTargets` where `character === word.hanzi` (a word can have more than one pronunciation target) — not by inventing a pronunciation, since fill-test content resolution at runtime requires an exact `character|pronunciation` key match against `flashcard_contents` (see `buildReviewTestSessionRuntime`). A word with zero matching admin targets is silently skipped, the same skip-invalid-silently precedent used elsewhere (e.g. `resultsReviewTestSession.ts`). The `adminTargets`-loading effect (Xinhua pronunciation lookup + saved-content fetch, previously gated to `page === "admin"` only) now also runs on `page === "review"` so this data is populated before Due Review needs it; the Add Selected to Session button is disabled with a loading tooltip (`adminLoading`) until that fetch completes, since it's async and can lag behind the page's own due-words load.
35. Add Selected to Session's name field mirrors Content Admin's Characters-view session form exactly: a single name input (no separate existing-session dropdown), pre-filled with the first existing session's name as a convenience default; typing an existing active session's name with exact case appends to it instead of creating a duplicate, matching Content Admin Curation Rule 24.
36. **Quick Add 25** is a fourth toolbar action, visible to the same role set as Add Selected to Session (parent + platform-admin only, gated by the same `/words/admin` route-access check). It auto-selects the lowest-familiarity currently-due characters (up to 25, ties broken by `createdAt` ascending) into the SAME checkbox selection state the due-words table uses, then opens the SAME session-name form Add Selected to Session uses — the user still must confirm or enter a session name before anything is created. It adds no new selection, target-resolution, or session-creation logic of its own; only the auto-selection step (rank due words by familiarity, take the lowest 25) is new.
37. **Added 2026-08-19 (Item I, Phase 3)**: `ParagraphLibrarySection.tsx` gains a Delete action (none existed before) and `TestModeSection.tsx`'s existing Delete action is upgraded — both now check `hasActiveParagraphQuizSession`/`hasActiveTestModeQuizSession` first: blocked outright (no dialog, inline error) while an active packaged session exists, confirmation dialog (`ConfirmDeleteDialog.tsx`, portal-rendered, shared component) otherwise — a deliberate departure from this doc's default immediate-delete-no-dialog convention (0_BUILD_CONVENTIONS.md §5), per explicit product direction. `hasActiveTestModeQuizSession` is scoped to that specific test mode; a sibling test mode on the same paragraph with no active session of its own is unaffected.

### Flashcard Review Rules (`/words/review/flashcard`)

These rules govern the flashcard review screen for memory consolidation:

1. Flashcard is **review-only** — it does not award grades or update scheduling. Grading happens exclusively in dedicated test interfaces (`/words/review/fill-test` or other test modes).
2. Flashcard displays:
   - **Always visible:** Character (Hanzi) with pinyin support, meaning(s), and a pinyin toggle button
   - **Conditionally visible:** Phrase-example pairs marked with `include_in_fill_test: true`
   - **Placeholder when empty:** If no phrases are marked for testing, display "No phrases included for testing" instead of blank space
3. Character and meaning are always displayed; only phrases are conditionally rendered based on the `include_in_fill_test` flag.
4. Pinyin toggle (`showPinyin` state in parent `FlashcardReviewSection`) controls visibility of pinyin spans across all text (character, phrases, examples). When toggled off, pinyin is removed from DOM (not hidden via CSS).
5. Parent component manages session-level state (toggle, word sequence); individual cards are stateless display components.
6. No grading buttons, no progress tracking, no scheduler mutations on this screen.
7. Any change to how flashcard content is displayed (phrases, pinyin, layout) must be codified here before implementation.

### Fill-Test Review Rules (`/words/review/fill-test`)

These rules govern bundled fill-test quiz sessions:

1. Fill-test review reads persisted `flashcardContents` only and uses phrase/example rows where `include_in_fill_test=true`.
2. One eligible phrase/example row is enough to make a character eligible for runtime bundled planning.
3. Session planning partitions eligible characters into low-phrase characters (one or two eligible rows) and standard characters (three or more eligible rows).
4. Bundled quizzes are queued before ordinary quizzes. Planning priority is: low+standard bundles, then low+low bundles with at least three combined unique phrases, then two one-phrase characters as a two-blank bundle, then a single one-phrase character as a one-blank quiz, then remaining ordinary three-blank standard quizzes.
5. A standard character can be used as a bundle partner at most once per session. If used in a bundle, it does not appear later as an ordinary quiz in that session.
6. Ordinary standard quizzes continue to use exactly three phrase/example rows. Standard bundle partners also contribute exactly three rows.
7. The fill-test UI supports one through five blanks, with one phrase option per blank.
8. Each sentence/blank carries character attribution so bundled grading can split results by underlying character.
9. Grading remains character-level. A bundled quiz appends one grade entry per included character, not one grade entry per blank.
10. Standard characters with three blanks use the existing three-blank rule: `3/3=easy`, `2/3=good`, `1/3=hard`, `0/3=again`.
11. Low-phrase characters use the correct-rate rule on their own blanks: all correct is `easy`, partial and greater than 50% is `good`, partial and less than or equal to 50% is `hard`, none correct is `again`.
12. Character grade entries earn coins from the unchanged table: `easy=5`, `good=3`, `hard=1`, `again=0`. Vocab-phrase entries earn a separate flat rule instead — see rule 26.
13. Packaged review test sessions use the same bundled fill-test planner over the packaged quiz-ready character set.
14. This character-only fill-test path (rules 1–13) adds no routes, tables, columns, RPCs, RLS policies, or AI calls of its own. Rules 22+ below cover the phrase-round path, which does — see Data Schema.
15. Fill-test sessions of BOTH source types (ad-hoc due-review and packaged) autosave progress after every graded word via `saveReviewSessionProgress`, upserted under a `client_session_key` — a client-minted `crypto.randomUUID()` for a NEW ad-hoc session, or the `review_test_sessions.id` itself for a packaged session — held for the life of that runtime session. Autosave is fire-and-forget: a failed save is logged and never blocks quiz interaction or surfaces an error toast.
16. The saved resume position is always `quizIndex + 1` (the NEXT unanswered word), never the just-graded `quizIndex` — `gradeWord()` already mutates the scheduler for a word the moment it is graded, independent of the "Next" click, so replaying the same word on resume would double-grade it. No autosave row is written when the just-graded word was the last item in the queue (the session is about to complete normally instead).
17. `/words/review/fill-test?resumeProgressKey=<clientSessionKey>` loads the matching `review_session_progress` row and initializes runtime state from its saved `progress_data` instead of building a fresh plan from due words. If the row is missing (already discarded/completed elsewhere, or points at a non-`due_review` row), the child is redirected to `/words/review?reviewTestSessionStatus=resume_missing`.
18. On resume, only the NOT-YET-ANSWERED tail of the saved queue (from the saved resume index onward) is re-validated against current `words`/`flashcard_contents` state; each queued item (or, for a bundled item, every member word) must still exist and still resolve usable fill-test content, or the whole item is silently dropped — mirrors the existing skip-invalid-silently precedent in `src/lib/resultsReviewTestSession.ts`. If re-validation drops every remaining item, the session resumes into the same "no eligible targets" empty state as a fresh ad-hoc session with none due, and the now-useless saved row is deleted.
19. Stopping an in-progress session via the existing "Stop quiz" button leaves its saved `review_session_progress` row intact — only explicit Discard (from the Due Review Paused Sessions list) and normal session completion delete it. Completing an ad-hoc session deletes the row after the `quiz_sessions` insert succeeds; completing a packaged session relies on server-side cleanup in the `complete_review_test_session` RPC instead (not duplicated client-side) — the client never issues its own `deleteReviewSessionProgress` call for packaged completion.
20. `/words/review/fill-test?reviewTestSessionId=<id>` (the existing packaged entry point, unchanged) checks for a saved `review_session_progress` row for that session id BEFORE building a fresh bundled plan. If one exists (`source_type = 'packaged'`), the session resumes from it instead of starting over; this check runs on every packaged-session entry, so a child who clicks "Start session" again while paused (e.g. after re-doing the non-graded flashcard phase) still lands back on their saved progress rather than a duplicate fresh plan.
21. Packaged resume re-validation runs the same NOT-YET-ANSWERED-tail check as rule 18, PLUS one packaged-only check: every member word of each remaining queued item must still be one of the session's CURRENT quiz-ready targets (`activeReviewTestSessionRuntime.quizWords`), not just still word/content-eligible. A parent may have removed a packaged target (or its content) while the session was paused; an item referencing a removed target is dropped even if the word and its content are otherwise still valid. If this drops every remaining item, the session redirects to the existing packaged `no_quiz_ready` empty state (not a new status code) and the now-useless saved row is deleted. A corrupted/unreadable saved payload redirects to the existing packaged `invalid` status instead of the ad-hoc `resume_missing` status, which is reserved for the `resumeProgressKey` entry point.

Rules 22+ govern **vocab-phrase rounds** (`vocab_phrases`, packaged-only — see Data Schema). A phrase blank uses the identical drag-and-match mechanic as a character blank; the differences are all in round construction and grading:

22. Phrases always form their own round(s), never mixed with a character in the same round — `buildFillTestPlanForVocabPhrases` is a standalone planner alongside (never inside) `buildBundledFillTestPlan`. A session with both kinds produces a sequence of rounds, some character-only, some phrase-only. Phrases are chunked into groups of up to 3 per round (same convention as the ordinary 3-blank character quiz); each phrase contributes exactly one blank per round from one randomly-chosen fill-test-eligible example, since a phrase can never supply its own distractor. A phrase with zero eligible examples is skipped from the round (unlike characters, it gets no explicit "skipped" notice — a known gap, not silently shipped).
23. A phrase round has no low/standard split and no partial credit: it's graded through the same `gradeBundledFillTest` call every round uses, but with exactly one blank per phrase, so the tier is always binary — `easy` (correct) or `again` (wrong).
24. Grading writes to `vocab_phrases.test_count` only via `gradeVocabPhrase` — no `repetitions`/`ease`/`next_review_at` on the phrase row (phrases are packaged-only, never auto-scheduled).
25. On a correct phrase answer only (tier `easy`), the phrase's own component Hanzi (via `extractUniqueHanzi`, deduped) are looked up against the family's standalone `words`; each match gets its familiarity nudged via `calculateNextState(word, tier, now)`, persisted by `nudgeWordFamiliarity` — which increments `reviewCount` but deliberately **not** `testCount` (reserved for direct standalone tests of that character). A character never added standalone is silently skipped. A wrong phrase answer touches no character state at all. **Updated 2026-08-19**: `nudgeWordFamiliarity`'s signature gained a `tier: Grade = "good"` parameter (Phase 3, Item I) so the paragraph-quiz path (rules 28+ below) can pass its own earned tier instead of a hardcoded grade; this call site's own behavior is unchanged (it never passes a tier, so it keeps defaulting to `"good"`).
26. A correctly-answered phrase round entry earns a flat **1 coin**, independent of the character `easy=5/good=3/hard=1/again=0` table in rule 12 — a wrong entry earns 0. `SessionGradeData.isVocabPhrase` is the discriminator `calculateSessionCoins` branches on; grading writes both kinds of entries into the same `quiz_sessions.grade_data` array.
27. After a wrong sentence in EITHER a character or phrase round, the review step shows the correct sentence inline, directly under that sentence — never only in an aggregate list — with ruby pinyin on the revealed phrase (ruby lives in a companion card beside the sentence, never inside the answer pill itself, so pill sizing/alignment stays identical whether right or wrong). A phrase round's companion card additionally shows the Chinese definition first, English below; a character round's does not, since a character's blank has no single-phrase definition (its definition lives one level up, on the meaning group).

Rules 28+ govern **paragraph-quiz sessions** (Item I, Phase 3, shipped 2026-08-19) — a third, sibling round kind alongside character and phrase rounds above, packaged from a `paragraph_test_modes` row via a new session-level discriminator (`review_test_sessions.paragraph_test_mode_id`) rather than per-target. A paragraph-quiz session is never mixed with character/phrase targets in the same session.

28. `TestModeSection.tsx` gains a **Package as Quiz** action per test mode: prompts for a session name (pre-filled with the test mode's own name, editable), blocked with an inline error if the test mode has fewer than 2 blanks (a 1-item word bank has no matching puzzle at all). Packaging snapshots the test mode's current `span_ids` into one `review_test_session_targets` row per blank (`paragraph_id` + `paragraph_span_id` set, `character`/`pronunciation` denormalized display text only, resolution happens via the span's own `resolvedWordId`/`resolvedVocabPhraseId` at runtime, not via character/pronunciation matching); editing the test mode afterward never retroactively changes an already-packaged session.
29. `buildReviewTestSessionRuntime` (`src/app/words/review/reviewSession.utils.ts`) resolves a paragraph-quiz session via a third branch, parallel to (not interleaved with) the character/phrase resolution, gated on `session.paragraphTestModeId`. Returns `paragraphQuiz: { paragraph, testMode, pages } | null`; `quizWords`/`vocabPhrases` stay empty for a paragraph-quiz session. New error codes `missing_paragraph`/`missing_paragraph_test_mode` join the existing `missing_word`/`duplicate_word`/`missing_vocab_phrase` set.
30. The whole paragraph renders as continuous, readable text with blanks in place of each packaged word/phrase, paginated by `buildParagraphQuizPages` (`src/lib/paragraphQuizBuilder.ts`) into pages of ~20 blanks each, never splitting one sentence's blanks across a page boundary — mirrors Content Admin Curation Rule 20's "entire character block stays together on the earlier page" precedent. Each page has its own shuffled word bank (`shuffleBankOrder`), scoped to that page's blanks only.
31. A child drags (or clicks a bank item, then clicks a blank) a word into place. A correct drop fills that blank permanently; a wrong drop bounces back to the bank with no SRS/grading dispatch at all (matches rule 25's "wrong phrase answer touches no character state" precedent) — only the blank's own retry count increments. The session completes only once every blank on every page is correctly filled; there is no partial-submit.
32. Grade tier is derived from retry count, not a phrase-count ratio: first-try-correct → `easy`, correct on the second attempt → `good`, correct on the third attempt or later → `hard`. There is no `again` outcome — a closed matching puzzle (every bank item has exactly one correct home) is always eventually solvable by elimination, and completion requires every blank correct.
33. On a blank's correct placement: `gradeWord`/`gradeVocabPhrase` dispatches on the same id the span already resolved to (the same functions every other quiz path uses). A phrase blank's earned tier additionally nudges every one of its component characters found standalone in `words`, via `nudgeWordFamiliarity(wordId, tier)` (rule 25's mechanism, generalized) — sequentially, each against its own just-updated state, same behavior as rule 25 already has for two phrases in one session sharing a component character.
34. Coins are a **session-level flat sum**, not a per-entry accumulation — structurally different from every rule above. `calculateParagraphQuizSessionCoins(totalIncorrectTries, totalBlanks)` (`src/lib/coins.ts`) buckets by **error rate** (not raw count) against the ~20-blank pagination reference size: `<25%→50`, `<50%→40`, `<75%→20`, else `10`. `calculateSessionCoins` branches to this formula whenever any `SessionGradeData` entry has `isParagraphBlank: true` — a session is never a mix, so this is a full session-level override of the normal per-entry reduce, not a per-entry rule like rule 26's flat-1-coin phrase rule.
35. Autosave/resume reuses the existing `review_session_progress` machinery (`source_type: "packaged"`, `packaged_session_id = review_test_sessions.id` — identical to how every other packaged session already persists progress) with a differently-shaped `progress_data` (`ParagraphQuizProgressData`: current page index, per-blank `{status, retryCount}` keyed by span id, session start time) rather than a flat quiz queue — no new `source_type` value, since the paragraph-quiz discriminator (`session.paragraphTestModeId`) is already known before `progress_data` is even inspected. `resolveParagraphQuizResume` re-validates saved blank ids against the paragraph's current pages (a span no longer resolving is dropped silently); if this empties the saved current page, resume advances to the first page with remaining work rather than a dead end.
36. Starting a paragraph-quiz session skips the flashcard phase entirely (no flashcard entity exists for a paragraph blank) — the existing `orderedWords.length === 0` routing check in `openReviewTestSession` already produces this for free, since a paragraph-quiz session's `orderedWords` is always empty. `ParagraphQuizReviewSection.tsx` mounts as a sibling of `FillTestReviewSection.tsx` under the same `/words/review/fill-test` entry point (no new route) — the two sections dispatch on whether `activeReviewTestSessionRuntime.paragraphQuiz` is set, never rendering simultaneously.
37. Due Review's quiz-ready gate folds a paragraph-quiz session's ready blank count into the same `quizReadyCount` mechanism rule-29-of-Due-Review-Queue-Rules established for phrase-only sessions (a paragraph-quiz session is "ready" the moment it resolves with no error — every blank's target was already validated at packaging time) — a paragraph-quiz session's Start button must never read as disabled/0-ready.

### Quiz Results Rules (`/words/results`)

These rules govern the results/history view for session data reporting:

1. Results page is read-only with respect to `quizSessions`. It must not edit existing quiz-session records, and it may mutate persisted state only through the explicit `Clear History` action and the explicit `Send Failed to Test Session` action.
2. The page displays all completed fill-test sessions in a table/list sorted by `createdAt` (newest first).
3. Each session row displays: Session Date, % Fully Correct, % Failed, % Partial, Duration, Tested Count, Tested Characters, Failed Count, Failed Characters, Coins Earned.
4. **Accuracy calculation rules:**
   - `% Fully Correct = (fullyCorrectCount / totalGrades) × 100`, rounded to nearest integer
   - `% Failed = (failedCount / totalGrades) × 100`, rounded to nearest integer
   - `% Partial = (partiallyCorrectCount / totalGrades) × 100`, rounded to nearest integer
   - Only `grade="easy"` counts as fully correct for accuracy; `grade="hard"` and `grade="again"` do not contribute to accuracy
   - The three percentages must sum to 100% (within ±1% rounding tolerance)
5. **Character list derivation:**
   - Tested characters = unique hanzi from all grade entries in `gradeData`, deduplicated and ordered by first appearance
   - Failed characters = unique hanzi from grade entries where `grade="again"` only; excludes `grade="hard"` or `grade="easy"`
   - **Updated 2026-08-19**: display is a clickable popup (`SessionCharacterListPopup.tsx`, anchored via `SendFailedToSessionDialog.tsx`'s `calculateAnchoredDialogPosition` precedent) listing every item in full, for **every** completed session row — replaces the old inline comma-separated truncation-to-8–10-plus-"…" display universally, not just for paragraph-quiz rows. `truncateCharacters`/`isCharacterListTruncated` (the old inline-truncation helpers) were removed, not left as dead code.
6. **Summary card calculations:** When multiple sessions exist, compute weighted averages across all sessions:
   - Total Sessions = count of all records
   - Overall % Fully Correct = (sum of fullyCorrectCounts across all sessions / sum of totalGrades across all sessions) × 100
   - Overall % Failed and Overall % Partial calculated similarly
   - Total Characters Tested = sum of unique character counts across all sessions
   - Total Duration = sum of durationSeconds across all sessions, displayed in human-readable format (hh:mm:ss)
7. **Clear History action:**
   - Single destructive action button available only when sessions exist
   - Clear History button is hidden for child profiles. Only parents and platform admins can clear quiz history.
   - Requires confirmation dialog before deletion
   - On confirmation, all records in `quizSessions` table are deleted permanently with no undo
   - Table and summary cards clear immediately upon successful deletion
8. **Send Failed to Test Session action:**
   - Each session row may expose a `Send Failed to Test Session` action when that row has at least one failed Hanzi
   - The action opens a dialog with a required review-test session name
   - Submission must not modify `quizSessions`; it packages the row's failed Hanzi into `review_test_sessions*` using the existing packaged-session flow
   - Failed Hanzi resolve against the current family state only: existing `words` rows plus currently saved `flashcard_contents`
   - For each eligible failed Hanzi, all currently saved `character|pronunciation` content rows for that Hanzi are packaged into the session
   - Hanzi with no current word row, duplicate current word rows, or no saved flashcard content are skipped instead of creating an invalid packaged session
   - If the entered session name matches an existing active packaged review test session with exact case, the action appends only new targets to that session
   - If no eligible targets remain after resolution, no mutation occurs and the UI surfaces an error notice
9. **Empty state:** When no sessions exist, display a placeholder message directing users to start a review session; hide all table and summary UI elements.
10. **Known gap — vocab-phrase entries in `gradeData`:** a phrase round's grade entries share the same `SessionGradeData` shape as character entries (`hanzi` holds the phrase text, `isVocabPhrase: true` is the only discriminator), so "Tested Characters"/"Failed Characters" and the accuracy percentages in rules 3–6 don't distinguish them — a phrase shows up in those Hanzi lists like a character would. Accepted, not fixed. **Send Failed to Test Session (rule 8) is unaffected in practice**: `resolveFailedCharactersToReviewTestTargets` matches failed entries against `words.hanzi` (always a single Hanzi character), so a multi-character phrase entry never matches and is silently skipped via the same "no current word row" path rule 8 already documents — it does not need special-casing to behave correctly.
11. **Added 2026-08-19 (Item I, Phase 3) — paragraph-quiz popup detail:** for a session row where any `gradeData` entry has `isParagraphBlank: true`, the Tested Characters popup shows each blank's text, earned tier, and retry count instead of a flat hanzi list (built directly from `gradeData`, not from the pre-computed `charactersTested` array). The Failed Characters column naturally shows the empty-state placeholder for a paragraph-quiz row — a paragraph blank has no `grade="again"` outcome (Fill-Test Review Rule 32), so `charactersFailed` is always empty for these sessions; no special-casing was needed there.

### Recipe Shop Rules (`/words/shop`)

These rules govern the child-facing reward shop:

1. `/words/shop` is accessible to child profiles and platform admin only. Parent profiles are route-blocked.
2. The shop reads persisted data only from `wallets`, `shop_recipes`, `shop_ingredient_prices`, `shop_recipe_unlocks`, `shop_coin_transactions`, and `coin_redemptions`.
3. Recipe unlocks are persisted through the `unlock_shop_recipe` RPC only. UI code must not manually write unlock rows, wallet deductions, or transaction rows.
4. `unlock_shop_recipe` is atomic: it ensures a wallet row exists, rejects forbidden / unavailable / already-unlocked / insufficient-coin states, inserts the unlock row, decrements the wallet, and appends a spend-history row in one transaction boundary.
5. Recipe catalog content is shared/global. Unlock state and spend history are per-user.
6. Unlocking a recipe or opening ingredient/history modals must not modify `words`, `flashcard_contents`, scheduler fields, or quiz history.
7. Only active recipes are unlockable. Empty wall slots render as reserved content, not ad-hoc generated recipes.
8. Shop history is read-only and sourced from `shop_coin_transactions`.
9. **Coin breakdown panel:** The shop displays a four-part coin summary: Total Earned (sum of `quiz_sessions.coins_earned`), Spent on Recipes (sum of `shop_coin_transactions.coins_spent`), Redeemed (sum of `coin_redemptions.coins_redeemed`), and Available (`wallets.total_coins`). The invariant `Total Earned − Spent on Recipes − Redeemed = Available` must hold.
10. **Cash-out (coin redemption):** Children and platform admin may redeem coins for real-dollar value at a 100:1 rate (100 coins = $1.00). Redemptions are persisted through the `redeem_coins` RPC only. UI code must not manually write redemption rows or wallet decrements.
11. `redeem_coins` is atomic: it validates the coin amount (must be a positive multiple of 100, ≤ available balance), validates note (1–200 chars) and signature (non-empty), decrements the wallet, and inserts a `coin_redemptions` row with beginning/ending balances in one transaction boundary.
12. Minimum redemption amount is 100 coins. Maximum is the user's current available balance.
13. Redemption does not modify `quiz_sessions.coins_earned` — the earned total is immutable.
14. Cash-out form validation errors (not a multiple of 100, exceeds balance, missing note/signature) are shown inline and block submission. Server-side codes (`insufficient_coins`, `invalid_amount`, `invalid_note`, `invalid_signature`, `forbidden`) surface as translated error messages.
15. A confirmation modal (portal-rendered) shows coins, dollar value, note, and signature before committing the redemption.
16. Inline redemption history table (within the cash-out section) is sourced from `coin_redemptions` for the session user.

### Shop Admin Rules (`/words/shop-admin`)

These rules govern the platform-admin recipe metadata editor:

1. `/words/shop-admin` is platform-admin only. Parents and children are route-blocked.
2. Shop Admin edits shared/global shop content, not family-scoped learning content.
3. Recipe saves may update localized title/intro copy, localized base-ingredient rows, localized special-ingredient rows, and variant icon match mappings.
4. Ingredient catalog saves may update shared ingredient key, localized labels, price, and optional icon path in `shop_ingredient_prices`.
5. Recipe drafts must keep English and Chinese ingredient rows aligned by index. Variant mappings may reference only known special-ingredient keys.
6. Each recipe must retain at least one base ingredient row after validation.
7. Removing an ingredient from the shared catalog must also remove that key from recipe ingredient rows and variant mappings before persistence.
8. Shop Admin must never award or spend coins, and must never modify scheduler, quiz, or flashcard content state.
9. If the database schema lacks `shop_ingredient_prices.icon_path`, icon-path saves must fail with an explicit admin-facing error rather than silently dropping the field.

### Debug Tools Rules (`/words/debug`)

These rules govern the platform-admin maintenance page:

1. `/words/debug` is platform-admin only.
2. Shop ingredient-icon audits compare persisted ingredient icon paths against files under `public/ingredients`.
3. Shop reward-icon audits compare persisted recipe reward icon rules against files under `public/rewards`.
4. Ingredient-audit actions may edit or clear broken ingredient icon paths. Reward-audit actions may edit, create, or delete reward icon rules.
5. Debug maintenance actions must not modify scheduler state, words, flashcard content, or quiz results.

### Login & Avatar Protection Rules (`/login`)

These rules govern the two-layer authentication and session protection system:

1. Login page (`/login`) and registration page (`/register`) are **not protected by session guard** — they are always accessible for authentication flows.
2. All other pages and routes require a valid Supabase session to access; unauthenticated requests redirect to `/login`.
3. **Two-layer authentication model:**
   - **Layer 1 — Family Authentication (Supabase Auth):** One Supabase Auth account per family. Standard email + password. Supabase handles token issuance, refresh, and recovery. This layer proves the person belongs to the family.
   - **Layer 2 — Profile Selection + PIN (App Layer):** After Layer 1, the user sees their family's profile cards and taps a profile. A 4-digit PIN entry screen renders. The app hashes the PIN and compares it to `users.pin_hash` for the selected profile. On match, `/api/auth/pin-verify` upserts an `auth_session_profiles` row keyed by the caller's own Auth `session_id` (not the shared `auth.users` row — see §11 below), and the client calls `supabase.auth.refreshSession()` so its next token carries the new claims via `custom_access_token_hook`.
4. **Registration flow:**
   - User visits `/register` and enters family name, email, and password
   - Supabase Auth creates the account
   - App creates a `families` row and a parent `users` row (`role: 'parent'`)
   - Parent sets their own 4-digit PIN
   - Parent creates at least one child profile (name + PIN per child)
   - User is redirected to `/login`
5. **Login flow:**
   - Layer 1: User enters email + password; Supabase Auth validates and issues JWT
   - Layer 2: Profile picker renders all `users` rows for the authenticated `family_id`; user taps a profile and enters their PIN
   - On PIN match: `auth_session_profiles` upserted for this session, token refreshed, redirect to `/words`
   - On PIN mismatch: `failed_pin_attempts` incremented on the `users` row
6. **PIN security:**
   - PIN hashed with `scrypt` (N=16384, r=8, p=1, keylen=32); stored format: `{32-hex-salt}:{64-hex-hash}`
   - Salt is 16 random bytes generated per hash; verification uses `crypto.timingSafeEqual`
   - PIN verification is performed server-side via `/api/auth/pin-verify` — client never compares hashes directly
   - Layer 2 PIN is a profile switcher, not the primary authentication gate; real security lives in Layer 1
7. **Lockout rules:**
   - After 5 consecutive failed PIN attempts, the profile is locked
   - Locked message: "Too many attempts. Please ask a parent to unlock."
   - Parent unlock: re-enter Layer 1 (email + password) to reset the failed attempt counter
   - Successful PIN entry resets `failed_pin_attempts` to 0
8. **Avatars:**
   - 8 avatar options: `bubble_tea_excited_1`, `cake_sleep_1`, `donut_wink_1`, `rice_ball_sleep_1`, `zongzi_smile_1`, `ramen_excited_1`, `babaorice_smile_1`, `bun_wink_1` (images in `/public/avatar/`)
   - Avatar stored as `avatar_id` on the `users` row
   - Avatar displayed in nav bar when logged in
9. **Session persistence:**
   - Supabase Auth manages JWT lifecycle (issuance, refresh, expiration)
   - App session context (`family_id`, `user_id`, `role`) is derived from JWT `app_metadata` claims, kept current by `custom_access_token_hook` on every refresh — never from the Supabase JS client's `session.user.app_metadata` (see Data Schema § RLS above)
   - `AuthProvider` React context exposes session state to all components
   - `SessionGuard` wraps protected routes and redirects to `/login` when no valid session exists
10. **Logout flow:**
    - Logout button available in main app nav bar
    - Logout calls `supabase.auth.signOut()` to invalidate the Supabase session
    - App session context is cleared
    - User is redirected to `/login`
11. **Data isolation (critical):**
    - All data is scoped by `family_id` in Supabase Postgres with Row Level Security policies
    - Words, flashcard content, quiz sessions, wallet, and all learning data are **never shared** across families
    - Within a family, `user_id`-scoped tables (wallet, quiz_sessions) isolate per-profile data
    - Platform admin (`is_platform_admin = true`) bypasses RLS for data management
    - No cross-tenant data leakage is possible at the database layer
    - Because Layer 1 is one shared Supabase Auth account per family, isolating *which profile* a given browser tab/device is acting as is a session-level concern, not a family-level one — `auth_session_profiles` scopes claims per Auth `session_id`, so a parent switching profiles on their own device can never change what a child's already-open device resolves to on its own token refresh. Before this (a real production incident, see `docs/fix-log/build-fix-log-2026-07-30-packaged-session-limbo.md`), claims were written to the shared `auth.users` row and any concurrent device's next refresh silently picked up whichever profile was switched to last, anywhere.

### Role-Based Routing Rules (`/words/*`)

Route access enforced by client-side RouteGuard using session role:
- **Child**: Can access review (flashcard and fill-test), all characters, quiz results. Cannot access add or admin (content curation restricted to parents).
- **Parent**: Can access add, add-paragraph, admin, all, results, review, flashcard. Cannot access fill-test (learning mode restricted to children).
- **Platform admin**: Full access (isPlatformAdmin flag bypasses role restrictions).

Blocked routes are hidden from navigation (not shown as disabled). Direct URL access to blocked routes redirects to `/words/review` with no error message.

Role enforcement is UI-only; database operations protected by RLS policies at the data layer.

**In-page action restrictions (child role):**
- `/words/all`: Reset and Delete buttons are hidden — children cannot modify or remove words.
- `/words/results`: Clear History button is hidden — children cannot delete quiz session records.

**Permission matrix**:
| Route | Child | Parent | Platform Admin |
|---|---|---|---|
| `/words/add` | ❌ | ✅ | ✅ |
| `/words/add-paragraph` | ❌ | ✅ | ✅ |
| `/words/all` | ✅ | ✅ | ✅ |
| `/words/admin` | ❌ | ✅ | ✅ |
| `/words/prompts` | ❌ | ✅ | ✅ |
| `/words/results` | ✅ | ✅ | ✅ |
| `/words/shop` | ✅ | ❌ | ✅ |
| `/words/shop-admin` | ❌ | ❌ | ✅ |
| `/words/review` | ✅ | ✅ | ✅ |
| `/words/review/flashcard` | ✅ | ✅ | ✅ |
| `/words/review/fill-test` | ✅ | ❌ | ✅ |
| `/words/debug` | ❌ | ❌ | ✅ |

---

## 2) Layer Boundaries

### Layers and Ownership

| Layer | Location | Responsibility |
|---|---|---|
| UI | `src/app/...`, `WordsWorkspace` | Interaction, view state, locale rendering |
| Domain | `src/lib/scheduler.ts`, `src/lib/fillTest.ts`, `src/lib/flashcardLlm.ts` | Pure logic: scheduling, grading, normalization |
| Service | `src/lib/supabase-service.ts`, `src/lib/supabaseClient.ts`, `src/lib/xinhua.ts` | IO: Supabase reads/writes (all data access), static data loading |
| AI | `src/app/api/flashcard/generate/route.ts`, `src/app/api/vocab-phrase/generate/route.ts` | Prompt orchestration, provider calls, active-prompt resolution from `prompt_templates` |

### Call Graph (Structural)

This describes how layers are wired — the actual call and import relationships the system uses:

- `src/app/**` communicates with `src/app/api/**` via **fetch calls only** — no direct imports.
- `src/app/api/**` is invoked only from admin authoring flows — never from review execution paths.
- **All database operations use `src/lib/supabase-service.ts`** — this is the single service module for all data access.
  - `src/lib/supabase-service.ts` uses the browser Supabase client (`supabase` from `supabaseClient.ts`), which passes the session JWT automatically.
  - RLS policies scope all reads/writes to the current family/user via JWT `app_metadata` claims.
  - Service functions handle camelCase (TypeScript) ↔ snake_case (Postgres) conversion.
  - For inserts requiring `family_id`/`user_id`, the service layer's `getSessionMetadata()` resolves them from the **access token's own** `app_metadata` claim (`decodeJwtPayload.ts`'s `getJwtAppMetadata()`) — never from the Supabase JS client's `session.user.app_metadata`, which reflects the `auth.users` DB row, not the active session-scoped profile. See Data Schema § RLS and `AI_CONTRACT.md §1`.
  - API routes import `getServerSupabaseClient()` (service role, for admin operations only)
  - **No direct IndexedDB/Dexie operations** — IndexedDB is fully retired; `src/lib/db.ts` has been deleted.
- `src/lib/scheduler.ts` has no dependency on UI or API layers — it is a pure domain module.
- AI output flows through normalization in `src/lib/flashcardLlm.ts` before reaching Supabase writes.

> For the agent rules that enforce these boundaries (what to never do), see `AI_CONTRACT.md §1`.

---

## 3) Data Schema

### Supabase Postgres Tables

The application stores all persistent data in Supabase Postgres. Row Level Security (RLS) policies enforce family-scoped data isolation. All tables include RLS enabled. IndexedDB is fully retired — `src/lib/db.ts` has been deleted.

**`families` table** — one row per tenant (one family = one tenant)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `name` | text | Family display name (e.g., "Nora's Family") |
| `created_at` | timestamptz | Server timestamp |

**`users` table** — all human users (parents and children)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `family_id` | uuid | Foreign key → `families.id` |
| `auth_user_id` | uuid (nullable) | Links to Supabase Auth user (non-null for parents, null for children) |
| `name` | text | User display name |
| `role` | text | Either `'parent'` or `'child'` |
| `pin_hash` | text (nullable) | `scrypt` hash of 4-digit PIN (see Login Rules §6); null for parents (use Supabase Auth PASSWORD) |
| `is_platform_admin` | boolean | True only for Chengyuan (platform admin); bypasses RLS on all tables |
| `failed_pin_attempts` | integer | Incremented on wrong PIN; reset on success; application locks at 5 attempts |
| `avatar_id` | text (nullable) | Filename stem; valid values: `bubble_tea_excited_1`, `cake_sleep_1`, `donut_wink_1`, `rice_ball_sleep_1`, `zongzi_smile_1`, `ramen_excited_1`, `babaorice_smile_1`, `bun_wink_1` |
| `created_at` | timestamptz | Server timestamp |

**`auth_session_profiles` table** — active Layer 2 profile per Supabase Auth session (not per family), keyed by the JWT's own `session_id`; enables one Layer 1 account to be signed in as different profiles on different devices simultaneously without cross-contaminating claims. Default-deny RLS — only `service_role` and `supabase_auth_admin` may touch it; see Login Rules §3 and `custom_access_token_hook` below

| Field | Type | Notes |
|---|---|---|
| `session_id` | uuid | Primary key; matches the Supabase Auth session (and JWT `session_id` claim) this profile applies to |
| `auth_user_id` | uuid | The shared Layer 1 auth account this session belongs to |
| `family_id` | uuid | Foreign key → `families.id` |
| `user_id` | uuid | Foreign key → `users.id`; the active profile |
| `role` | text | `'parent'` or `'child'`, mirrors `users.role` at PIN-verify time |
| `is_platform_admin` | boolean | Mirrors `users.is_platform_admin` at PIN-verify time |
| `updated_at` | timestamptz | Set on every PIN switch |

**`words` table** — one row per Hanzi character, scoped to family

| Field | Type | Notes |
|---|---|---|
| `id` | text | Primary key; preserves existing `makeId()` pattern |
| `family_id` | uuid | Foreign key → `families.id` |
| `hanzi` | text | Single Hanzi character |
| `pinyin` | text (nullable) | Optional pronunciation |
| `meaning` | text (nullable) | Optional translation |
| `repetitions` | integer | SRS repetition count (default: 0) |
| `interval_days` | numeric | Current SRS interval in days (default: 0) |
| `ease` | numeric | Scheduler stability/ease value (default: 21) |
| `next_review_at` | bigint | Unix timestamp in milliseconds; 0 means immediately due |
| `review_count` | integer | Count of flashcard review attempts (default: 0) |
| `test_count` | integer | Count of fill-test attempts (default: 0) |
| `fill_test` | jsonb (nullable) | FillTest object; populated only after Content Admin curation |
| `created_at` | timestamptz | Server timestamp |
| **Unique constraint** | | `(family_id, hanzi)` — prevents duplicate characters per family |

**`flashcard_contents` table** — curated content per character+pronunciation pair, scoped to family

| Field | Type | Notes |
|---|---|---|
| `id` | text | Composite value: `{character}\|{pronunciation}` |
| `family_id` | uuid | Foreign key → `families.id` |
| `meanings` | jsonb | String array of definitions |
| `phrases` | jsonb | Array of Phrase objects: `{ zh, pinyin, en, include_in_fill_test }` |
| `examples` | jsonb | Array of Example objects: `{ zh, pinyin, en, include_in_fill_test }` |
| `updated_at` | timestamptz | Server timestamp |
| **Primary key** | | `(id, family_id)` — composite key enforces scoped uniqueness |

**`hidden_admin_targets` table** — family-scoped exclusions for Content Admin rows

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `family_id` | uuid | Foreign key → `families.id`; cascades on delete |
| `character` | text | Hanzi whose admin row is hidden |
| `pronunciation` | text | Pinyin variant hidden for this family |
| `created_at` | timestamptz | Server timestamp |
| **Unique constraint** | | `(family_id, character, pronunciation)` |

**`vocab_phrases` table** — standalone multi-character phrase content, parallel to `words` but with no SRS scheduling (packaged-only, no auto-review)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `family_id` | uuid | Foreign key → `families.id`; cascades on delete |
| `phrase` | text | `check (char_length(phrase) between 2 and 10)` |
| `pinyin` | text (nullable) | Nullable until AI-generated or hand-entered |
| `meaning_zh` / `meaning_en` | text (nullable) | Chinese and English definitions |
| `examples` | jsonb | `{ zh, pinyin, include_in_fill_test }[]`; `check (jsonb_array_length(examples) <= 20)` |
| `test_count` | integer | Default 0; incremented by `gradeVocabPhrase` only — no `repetitions`/`ease`/`next_review_at` |
| `created_at` | timestamptz | Server timestamp |
| **Unique constraint** | | `(family_id, phrase)` |

**`vocab_phrase_lesson_tags` table** — join table assigning lesson tags to phrases, mirrors `word_lesson_tags`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `vocab_phrase_id` | uuid | Foreign key → `vocab_phrases.id`; cascades on delete |
| `lesson_tag_id` | uuid | Foreign key → `lesson_tags.id`; cascades on delete |
| `family_id` | uuid | Denormalized for RLS |
| **Unique constraint** | | `(vocab_phrase_id, lesson_tag_id)` |

**`paragraphs` table** — raw pasted article text + parsed sentence/span structure (Tier 1, Item I, Phase 1 — Article Import). Write-only from the user's perspective in Phase 1: no view/edit/package UI ships yet — it exists purely as fill-test source material for the separate Phase 2 spec

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `family_id` | uuid | Foreign key → `families.id`; cascades on delete |
| `title` | text (nullable) | Optional; parent-entered or left null |
| `raw_text` | text | Exactly as pasted, immutable source of truth |
| `sentences` | jsonb | `ParagraphSentence[]` (`src/lib/paragraph.types.ts`), default `'[]'::jsonb`; each sentence carries `spans[]` — the character/phrase ranges the parent selected and added this submission, with `resolvedWordId`/`resolvedVocabPhraseId` baked in |
| `created_by_user_id` | uuid | Foreign key → `users.id`; cascades on delete |
| `created_at` | timestamptz | Server timestamp |
| `updated_at` | timestamptz | Server timestamp |
| **RLS Guarantee** | | Family-scoped read; insert/update/delete are parent (or platform admin) only — **not** family-scoped-for-children the way `vocab_phrases`' UPDATE policy is, since a paragraph is never graded or written to by a child |

**`paragraph_test_modes` table** — named, reusable blank-selection templates per paragraph (Tier 1, Item I, Phase 2). Purely a saved selection of which of a paragraph's already-eligible spans should become fill-test blanks — creates nothing runnable on its own (no `review_test_sessions` row). Actually wiring a test mode into the quiz runtime is a future Phase 3, not yet built

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `paragraph_id` | uuid | Foreign key → `paragraphs.id`; cascades on delete |
| `family_id` | uuid | Foreign key → `families.id`; cascades on delete; denormalized for RLS |
| `name` | text | Test mode display name |
| `span_ids` | jsonb | `string[]` — `ParagraphSpan.id` values (from `paragraphs.sentences[].spans[]`) selected as blanks; default `'[]'::jsonb` |
| `created_by_user_id` | uuid | Foreign key → `users.id`; cascades on delete |
| `created_at` | timestamptz | Server timestamp |
| `updated_at` | timestamptz | Server timestamp; a test mode is editable, not create/delete-only |
| **Unique constraint** | | `(paragraph_id, name)` — **per-paragraph**, not family-wide; a deliberate departure from every other named/unique thing in this app (textbooks, lesson tags, `review_test_sessions`) |
| **RLS Guarantee** | | Family-scoped read; insert/update/delete are parent (or platform admin) only — same posture as `paragraphs` |

**`review_test_sessions` table** — active/completed packaged review sessions, scoped to family

| Field | Type | Notes |
|---|---|---|
| `id` | text | Primary key; unique session ID |
| `family_id` | uuid | Foreign key → `families.id`; cascades on delete |
| `name` | text | Session display name; case-sensitive uniqueness among active sessions |
| `created_by_user_id` | uuid | Foreign key → `users.id`; parent/platform admin creator |
| `created_at` | timestamptz | Server timestamp |
| `completed_at` | timestamptz (nullable) | Null while active; set when child completes the session |
| `completed_by_user_id` | uuid (nullable) | Foreign key → `users.id`; child who completed the session |
| **Active-name uniqueness** | | Partial unique index on `(family_id, name)` where `completed_at is null` |

**`review_test_session_targets` table** — packaged Content Admin targets for a review session

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `session_id` | text | Foreign key → `review_test_sessions.id`; cascades on delete |
| `family_id` | uuid | Foreign key → `families.id`; cascades on delete |
| `character` | text | Packaged Hanzi character, or a phrase target's own `phrase` text (display data) |
| `pronunciation` | text | Packaged pronunciation, or a phrase target's own `pinyin` (display data) |
| `vocab_phrase_id` | uuid (nullable) | Foreign key → `vocab_phrases.id`; cascades on delete. Discriminator: non-null means this target grades against `vocab_phrases`, not `words` — `character`/`pronunciation` stay populated either way so existing display/grouping code needs no branch |
| `display_order` | integer | Save-time target order after familiarity/character/pronunciation sorting |
| **Unique constraint** | | `(session_id, character, pronunciation)` |

**`review_session_progress` table** — paused/in-progress test-session state, per user

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | Foreign key → `users.id`; cascades on delete; owning child (or platform admin) |
| `family_id` | uuid | Foreign key → `families.id`; cascades on delete; denormalized for RLS |
| `client_session_key` | text | Stable key for the paused session — `review_test_sessions.id` for packaged sessions, a client-minted UUID for ad-hoc due-review sessions |
| `source_type` | text | `'due_review'` or `'packaged'` (checked) |
| `packaged_session_id` | text (nullable) | Foreign key → `review_test_sessions.id`; cascades on delete; null for `due_review` |
| `progress_data` | jsonb | Serialized runtime state: quiz queue, index, selections, grade history, elapsed time |
| `started_at` | timestamptz | When the session was originally started |
| `last_saved_at` | timestamptz | Updated on every autosave |
| `created_at` | timestamptz | Server timestamp |
| **Unique constraint** | | `(user_id, client_session_key)` — autosave upserts this row |
| **RLS Guarantee** | | Family-scoped read (parents get read-only visibility into a child's paused sessions); insert/update/delete scoped to `user_id = current_user_id()` — one family member cannot write another's progress row |

**`quiz_sessions` table** — completed fill-test session records, immutable audit

| Field | Type | Notes |
|---|---|---|
| `id` | text | Primary key; unique session ID |
| `user_id` | uuid | Foreign key → `users.id` |
| `family_id` | uuid | Foreign key → `families.id` (denormalized for RLS efficiency) |
| `created_at` | timestamptz | Server timestamp when session was completed |
| `session_type` | text | Currently `'fill-test'`; reserved for future quiz types |
| `grade_data` | jsonb | Array of SessionGradeData: `{ wordId, hanzi, grade, timestamp, isVocabPhrase? }`. `isVocabPhrase` entries hold a `vocab_phrases.id`/phrase text in `wordId`/`hanzi` instead of a word — see Fill-Test Review Rules |
| `fully_correct_count` | integer | Count of grades === `'easy'` (default: 0) |
| `failed_count` | integer | Count of grades === `'again'` (default: 0) |
| `partially_correct_count` | integer | Count of grades === `'good'` or `'hard'` (default: 0) |
| `total_grades` | integer | Sum of all grades (default: 0) |
| `duration_seconds` | integer | Elapsed time in seconds from session start to completion (default: 0) |
| `coins_earned` | integer | Coins earned in this session (default: 0) |
| **RLS Guarantee** | | Insert-only for non-admins (no update); immutable audit record |

**`wallets` table** — cumulative coin balance, one row per user

| Field | Type | Notes |
|---|---|---|
| `user_id` | uuid | Primary key → `users.id` (singleton pattern per user) |
| `family_id` | uuid | Foreign key → `families.id` (denormalized for RLS efficiency) |
| `total_coins` | integer | Cumulative coins earned across all sessions (default: 0) |
| `last_updated_at` | timestamptz | Server timestamp of last wallet update |
| `version` | integer | Schema version for future upgrades (currently 1) |

**`shop_recipes` table** — shared recipe catalog for the reward layer

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `slug` | text | Unique stable recipe key |
| `title` | text | Fallback / legacy title |
| `title_i18n` | jsonb | Localized recipe titles `{ en, zh }` |
| `display_order` | integer | Unique wall ordering |
| `is_active` | boolean | Controls whether the recipe is visible and unlockable |
| `intro` | text | Fallback / legacy intro copy |
| `intro_i18n` | jsonb | Localized intro copy `{ en, zh }` |
| `unlock_cost_coins` | integer | Unlock cost; must be non-negative |
| `base_ingredients` | jsonb | Legacy/base ingredient rows |
| `base_ingredients_i18n` | jsonb | Localized base-ingredient rows aligned by index |
| `special_ingredient_slots` | jsonb | Persisted special-ingredient rows |
| `special_ingredient_slots_i18n` | jsonb | Localized special-ingredient rows aligned by index |
| `variant_icon_rules` | jsonb | Variant icon rules keyed by ingredient-match combinations |
| `created_at` | timestamptz | Server timestamp |
| `updated_at` | timestamptz | Server timestamp |
| **Scope** | | Shared/global content; authenticated read, platform-admin write |

**`shop_recipe_unlocks` table** — per-user recipe unlock records

| Field | Type | Notes |
|---|---|---|
| `user_id` | uuid | Foreign key → `users.id`; part of primary key |
| `family_id` | uuid | Foreign key → `families.id` |
| `recipe_id` | uuid | Foreign key → `shop_recipes.id`; part of primary key |
| `coins_spent` | integer | Coins spent for this unlock; must be non-negative |
| `unlocked_at` | timestamptz | Server timestamp |
| **Primary key** | | `(user_id, recipe_id)` |

**`shop_coin_transactions` table** — immutable shop spend history per user

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | Foreign key → `users.id` |
| `family_id` | uuid | Foreign key → `families.id` |
| `recipe_id` | uuid (nullable) | Foreign key → `shop_recipes.id`; null if source row is later deleted |
| `action_type` | text | Currently `unlock_recipe` |
| `coins_spent` | integer | Non-negative spend amount |
| `beginning_balance` | integer | Balance before the shop action |
| `ending_balance` | integer | Balance after the shop action |
| `created_at` | timestamptz | Server timestamp |
| **RLS Guarantee** | | Family-scoped read; insert-only for the acting user except platform admin |

**`coin_redemptions` table** — immutable record of each cash-out transaction, per user

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | Foreign key → `users.id` |
| `family_id` | uuid | Foreign key → `families.id` (denormalized for RLS efficiency) |
| `coins_redeemed` | integer | Must be positive and a multiple of 100 |
| `dollar_value` | numeric(10,2) | `coins_redeemed / 100`; always positive |
| `note` | text | Child-written free-form note; 1–200 chars |
| `child_signature` | text | Child-written signature; non-empty |
| `beginning_balance` | integer | Wallet balance before decrement; non-negative |
| `ending_balance` | integer | Wallet balance after decrement; non-negative |
| `created_at` | timestamptz | Server timestamp |
| **Constraints** | | `coins_redeemed % 100 = 0`, `coins_redeemed > 0`, `dollar_value > 0`, balances `≥ 0` |
| **RLS Guarantee** | | Family-scoped read; insert-only via `redeem_coins` RPC (no direct inserts from client) |

**`shop_ingredient_prices` table** — shared ingredient catalog pricing and icon metadata

| Field | Type | Notes |
|---|---|---|
| `ingredient_key` | text | Primary key; stable catalog key |
| `cost_coins` | integer | Non-negative shared ingredient price |
| `label_i18n` | jsonb | Localized ingredient labels `{ en, zh }` |
| `icon_path` | text (nullable) | Optional `/ingredients/...` asset path |
| `created_at` | timestamptz | Server timestamp |
| `updated_at` | timestamptz | Server timestamp |
| **Scope** | | Shared/global catalog; authenticated read, platform-admin write |

**`prompt_templates` table** — configurable LLM prompt templates (Phase 2, Feature #1)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `family_id` | uuid (nullable) | Foreign key → `families.id`; null for Default rows |
| `user_id` | uuid (nullable) | Foreign key → `users.id`; null for Default rows |
| `prompt_type` | text | One of: `full`, `phrase`, `example`, `phrase_details`, `meaning_details`, `vocab_phrase` |
| `slot_name` | text | User-visible name; max 50 chars; Default rows always named `"Default"` |
| `prompt_body` | text | System prompt sent to DeepSeek; per-type min/max enforced in service layer |
| `is_active` | boolean | True on the currently active slot; at most one per `(family_id, prompt_type)` |
| `is_default` | boolean | True only for the platform-wide Default rows (`family_id = null`) |
| `created_at` | timestamptz | Server timestamp |
| `updated_at` | timestamptz | Server timestamp of last update |
| **Active constraint** | | At most one `is_active = true` per `(family_id, prompt_type)` — enforced in service layer |
| **Slot limit** | | Max 5 user-owned rows per `(family_id, prompt_type)` — enforced in service layer |

**`textbooks` table** — curriculum textbooks for cascade tagging (Phase 2, Feature #7)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `name` | text | Human-readable textbook name |
| `is_shared` | boolean | `true` = admin-curated, visible to all families; `false` = family-private |
| `family_id` | uuid (nullable) | Foreign key → `families.id`; null when `is_shared = true` |
| `created_by` | uuid (nullable) | Foreign key → `auth.users.id` |
| `created_at` | timestamptz | Server timestamp |

**`lesson_tags` table** — unique Textbook → Grade → Unit → Lesson combinations (Phase 2, Feature #7)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `textbook_id` | uuid | Foreign key → `textbooks.id`; cascades on delete |
| `grade` | text | e.g. `"G2"`, `"二年级"` |
| `unit` | text | e.g. `"Unit 8"`, `"第八单元"` |
| `lesson` | text | e.g. `"Lesson 4"`, `"第四课"` |
| `created_at` | timestamptz | Server timestamp |
| **Unique constraint** | | `(textbook_id, grade, unit, lesson)` |

**`word_lesson_tags` table** — family-scoped join table assigning lesson tags to words (Phase 2, Feature #7)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `word_id` | uuid | Foreign key → `words.id`; cascades on delete |
| `lesson_tag_id` | uuid | Foreign key → `lesson_tags.id`; cascades on delete |
| `family_id` | uuid | Foreign key → `families.id`; cascades on delete |
| `created_at` | timestamptz | Server timestamp |
| **Unique constraint** | | `(word_id, lesson_tag_id, family_id)` |

---

### Row Level Security Policies

All tables have RLS enabled. Policies are applied based on JWT `app_metadata` claims (`family_id`, `user_id`, `role`, `is_platform_admin`) — session-scoped per `auth_session_profiles` above, not a static value written once at login. Application code must resolve these the same way: via `getSessionMetadata()` in `supabase-service.ts` (or `getJwtAppMetadata()` in `decodeJwtPayload.ts`), never via the Supabase JS client's `session.user.app_metadata`, which reflects the `auth.users` DB row and does not track PIN switches (see `AI_CONTRACT.md §1`, Auth / Session Claims).

**Helper functions (used by all RLS policies), all reading `request.jwt.claims -> app_metadata`:**
- `current_family_id()` / `current_user_id()` — extract the `family_id`/`user_id` claim
- `is_platform_admin()` — true if the claim's `is_platform_admin` is true
- `current_jwt_role()` — extracts the `role` claim (`'parent'` or `'child'`); used by role-gated RPCs like `complete_review_test_session`

**`custom_access_token_hook`** (Postgres function, registered as a Supabase Auth Hook — dashboard config per project, not applied by `supabase db push`): runs on every token mint/refresh, looks up `auth_session_profiles` by the token's own `session_id`, and injects that row's claims into `app_metadata`. A lookup miss passes the token through unchanged. See `docs/feature-specs/2026-08-08-session-scoped-profile-claims.md`.

**Policy patterns:**
- **Family-scoped read:** Most user data tables allow reads where `family_id = current_family_id()`, OR if `is_platform_admin() = true`
- **Shared catalog read:** Global shop catalog tables (`shop_recipes`, `shop_ingredient_prices`) are readable to authenticated users; platform admin owns writes
- **User-scoped write:** Users can insert/update only when `family_id = current_family_id()` AND (for wallet/sessions) `user_id = current_user_id()`
- **Immutable records:** `quiz_sessions` cannot be updated or deleted by non-admins; only platform admin can delete for data management
- **Platform admin bypass:** When `is_platform_admin() = true`, user can read/write/delete all rows on all tables

---

### Supabase Client Initialization

**Browser client** (`src/lib/supabaseClient.ts`):
- Initialized with anon key (public, scoped by RLS)
- Automatically passes session JWT if user is authenticated
- All database operations automatically respect RLS policies

**Server client** (API routes only):
- Initialized with service role key (admin, bypasses RLS)
- Only for platform admin operations (seeding, bulk deletes)
- Never exposed to browser

---

### Static Data

- **Pronunciation candidates:** `public/data/char_detail.json` plus supplementary pinyin from `public/data/char_base.json` — loaded via `src/lib/xinhua.ts`; pinyin is canonicalized before dedupe so Xinhua's phonetic `ɡ` does not create duplicate `g` pronunciations.

### localStorage Schema (Legacy — Fully Retired)

**Phase 1 localStorage authentication has been replaced by Supabase Auth (Feature 4).** The following keys are no longer in use. All auth state is managed by the Supabase client session and React context (`AuthProvider`).

Retired keys: `sessionToken`, `selectedAvatarId`, `sessionCreatedAt`, `storedPinHash`, `lastSelectedAvatarId`, `migration_completed`.

### Database State Management (Retired)

PIN-scoped IndexedDB has been fully replaced by Supabase Postgres. The `currentDb` and `currentPinHash` in-memory state no longer exists. Data isolation is now enforced by Supabase RLS policies using JWT `app_metadata` claims (`family_id`, `user_id`).

---

### Normalization & Validation Rules

To prevent data quality drift, the system enforces the following invariants whenever flashcard content is written or updated. Normalization functions in `src/lib/flashcardLlm.ts` and related helpers implement these checks; any row failing them is dropped and logged.

- **Top-level payload shape:** must be an object with `meanings` (string array), `phrases` (array), and `examples` (array). Missing fields are treated as empty arrays.
- **Strings:** all text fields (`meanings` entries, `phrase.zh`, `phrase.pinyin`, `phrase.en`, `example.*`) must be non‑empty strings. Trim whitespace; if the trimmed value is empty, the row is invalid.
- **Boolean flags:** `include_in_fill_test` must be a boolean; non-boolean values default to `false`.
- **Array lengths:** there is no hard limit, but individual items are capped at 500 characters; anything longer is truncated or the item dropped to avoid performance issues.
- **Required fields for phrases/examples:** at minimum `zh` and `en` must be present. Rows lacking either are invalid.
- **No nulls or undefineds:** any `null` or `undefined` in a phrase/example object causes that object to be removed.
- **Key invariants:** `id` for `flashcardContents` is always `character|pronunciation`; the service layer protects this composite key from alteration.

These rules are the authoritative definition of "bad content" referred to elsewhere. They live here so agents implementing normalization know exactly what to enforce.

---

## 4) System Guarantees

These are the technical behaviors the system upholds. They are the factual basis behind the hard stops in `AI_CONTRACT.md §1` — refer there for agent-facing rules.

1. **Review screens read only from `flashcardContents`.** No path from `/words/review/*` reaches `/api/flashcard/generate`.
2. **Every value written to `flashcard_contents` has been normalized.** Schema shape is enforced before any Supabase write.
3. **Normalization drops bad content — it does not pass it through.** Invalid phrases/examples are removed; the rest of the payload proceeds.
4. **Pinyin rendering on review screens uses per-character ruby alignment (not inline or line-level pinyin):**
   - Each Hanzi character displays its pinyin token on a separate line directly above the character.
   - Pinyin is mapped only to Hanzi code points (CJK #3400–#4DBF, #4E00–#9FFF, #F900–#FAFF); non-Hanzi characters (punctuation, spaces, English) do not consume pinyin tokens.
   - Pinyin tokens are cleaned (punctuation removed via regex `/[^\p{L}\p{M}0-9]/gu`) and normalized to lowercase before display.
   - Pinyin appears italicized and in gray (#888) at a smaller font size than the associated Hanzi.
   - This alignment applies to character, phrase, and example text in flashcard review (`/words/review/flashcard`).
5. **Flashcard review conditionally displays phrases based on `include_in_fill_test` flag:**
   - Only phrases marked `include_in_fill_test: true` in `flashcardContents` are rendered as visible blocks on the flashcard.
   - If no phrases are marked for testing, a placeholder message ("No phrases included for testing") is displayed in place of the phrase-example blocks.
   - Character and meaning remain visible regardless of phrase-test inclusion; phrases are the only conditional element.
   - Parent component (`FlashcardReviewSection`) controls visibility toggle via `showPinyin` state (boolean); when `false`, pinyin spans are removed from DOM entirely (not hidden via CSS).
6. **Shop recipe unlocks are atomic.** The `unlock_shop_recipe` RPC is the only write path that may create unlock rows, decrement wallets, and append shop spend history.
6a. **Coin redemptions are atomic.** The `redeem_coins` RPC is the only write path that may decrement wallets and insert redemption rows. It validates coin amount, note, and signature; locks the wallet row with `FOR UPDATE`; checks available balance; decrements; and inserts the record in one transaction boundary. Direct client inserts to `coin_redemptions` are blocked by RLS.
7. **Shop writes do not affect learning state.** Shop unlocks, spend history, coin redemptions, ingredient catalog edits, and recipe metadata edits never update `words`, `flashcard_contents`, scheduler fields, or quiz-session grading data.
7a. **`quiz_sessions.coins_earned` is immutable.** Coin redemptions decrement `wallets.total_coins` only. The per-session earned totals in `quiz_sessions` are never modified by any redemption path.
8. **`nextReviewAt` and `interval` are updated only by the deterministic grade functions in `scheduler.ts`.** No other write path exists — this holds for the vocab-phrase familiarity nudge too, since `nudgeWordFamiliarity` calls the same unmodified `calculateNextState`, not a parallel scheduling path.
9. **Due review pages wrap `WordsWorkspace` in `<Suspense>`.** Required for correct search-param handling in Next.js.
10. **A quiz round is never mixed-kind.** Every round is either all-character or all-phrase; `memberResults` and `vocabPhraseMemberResults` on a single `gradeBundledFillTest` call are mutually exclusive, never both non-empty.
11. **Identity resolution is session-scoped, not account-scoped.** `current_family_id()`/`current_user_id()`/`is_platform_admin()`/`current_jwt_role()` all read the access token's `app_metadata`, kept current per-session by `custom_access_token_hook` reading `auth_session_profiles`. `auth.users.app_metadata` is written nowhere in the app and must never be treated as a source of truth for identity.

---

## 5) Error Handling

Required error behaviors for each failure mode. Do not improvise alternatives.

| Failure | Required Behavior |
|---|---|
| AI generation failure (`/api/flashcard/generate` or `/api/vocab-phrase/generate`) | Return error to admin UI. Do not fall back to cached or unvalidated output. Surface the error to the user. |
| Normalization failure (malformed AI payload) | Log the failure. Drop the affected phrase/example. Continue with remaining valid content. Never write a partial payload. |
| Supabase read failure (review screens) | Show a graceful error state in the UI. Do not re-fetch from AI. Session fails cleanly. |
| Missing `char_detail.json` entry | Return empty pronunciation candidates. Do not throw. UI handles the empty state. |

---

## 6) Docs Structure

### Companion-Doc Audit Requirement

Dated flow documents under `docs/architecture/` (e.g. `2026-02-27-content-admin-curation-flow.md`) are allowed to contain narrative, risks, and examples. However any behavioral rule or implementation guardrail appearing in a companion doc must also be copied verbatim into this `0_` file. Agents are required to perform a quick audit when a companion doc is created or edited and elevate missing rules to maintain a single source of truth.

### Authority Order

The following order is derived from `AI_CONTRACT.md` and reproduced here for local reference. `AI_CONTRACT.md` is the canonical source — if these conflict, AI_CONTRACT wins.

1. `docs/architecture/AI_CONTRACT.md` — agent rules and authority hierarchy
2. `docs/architecture/0_ARCHITECTURE.md` — system structure (this file)
3. `docs/architecture/0_BUILD_CONVENTIONS.md` — development conventions
4. `docs/architecture/0_PRODUCT_ROADMAP.md` — scope and priorities
5. `README.md`

---

### Folder Map

```
docs/
  architecture/
    AI_CONTRACT.md                        ← highest authority; agent rules
    0_ARCHITECTURE.md                     ← system structure (this file)
    0_BUILD_CONVENTIONS.md                ← code and doc conventions
    0_PRODUCT_ROADMAP.md                  ← scope, sprint, deferrals
    YYYY-MM-DD-short-description.md       ← dated feature/domain behavior docs
  feature-specs/
    YYYY-MM-DD-short-feature-name.md      ← one file per feature; drafted before build
  code-review/
    YYYY-MM-DD-short-scope.md             ← periodic code quality reviews
  fix-log/
    build-fix-log-YYYY-MM-DD-summary.md   ← one file per fix; created after merge
  skills/
    SKILL-[name].md                       ← reusable agent skills; one file per skill
  archive/
    YYYY-MM/
      *.md                                ← superseded docs moved here
```

---

### Filing Rules by Doc Type

**`docs/architecture/` — system behavior docs**
- Create when: a feature or domain rule needs to be documented for future builders.
- Filename: `YYYY-MM-DD-short-description.md`
- Retire to `docs/archive/YYYY-MM/` when the content is superseded by a `0_` file update or a newer dated doc.

**`docs/feature-specs/` — pre-build feature specifications**
- Create when: a feature is prioritized in `0_PRODUCT_ROADMAP.md §Active Sprint` and needs a spec before implementation starts.
- Filename: `YYYY-MM-DD-short-feature-name.md`
- Content: problem statement, non-goals, behavior rules, edge cases, risks, test plan, acceptance criteria, open questions.
- Status: once the feature ships, add a `## Status: Shipped YYYY-MM-DD` header — do not delete. Move to `docs/archive/YYYY-MM/` after one sprint cycle.
- Authority: feature specs are implementation guidance only. If a spec conflicts with `0_ARCHITECTURE.md`, the spec loses — update the spec before building.

**`docs/code-review/` — periodic code quality reviews**
- Create when: a scheduled or triggered review of code quality, compliance, or architectural drift is conducted.
- Filename: `YYYY-MM-DD-short-scope.md` (e.g., `2026-02-27-code-compliance-review.md`)
- Content: scope, findings, recommended actions, severity ratings.
- Authority: findings are advisory. Accepted findings that produce rule changes must be written into the relevant `0_` doc — the review file itself is not authoritative.
- Do not move to archive — keep all code reviews in `docs/code-review/` as a permanent audit trail.

**`docs/fix-log/` — post-merge fix records**
- Create when: any bug fix, refactor, structural correction, or regression prevention is merged. See `AI_CONTRACT.md §5` for full policy and template.
- Filename: `build-fix-log-YYYY-MM-DD-short-kebab-summary.md`
- Do not move to archive — fix logs are a permanent record.

**`docs/skills/` — reusable agent skill files**
- Create when: a repeatable multi-step workflow is worth encoding so agents invoke it
  consistently rather than improvising.
- Filename: `SKILL-[kebab-name].md`
- Do not move to archive — skills are active references, not historical records. Deprecate
  by adding a `deprecated: true` note in the frontmatter and a replacement pointer.
---

### Archive Rule

If archived content conflicts with active docs or current implementation, active docs and implementation win. Archive material is historical context only — it is never justification for a design choice.
