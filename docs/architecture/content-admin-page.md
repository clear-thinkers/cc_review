# Content Admin Page

## 1. Purpose

- This page curates flashcard learning content per `character + pronunciation` target.
- It exists to preload, regenerate, edit, and persist meanings/phrases/examples before learner review starts.
- It is the control point between raw character inventory (`words`) and review consumption of saved flashcard content.
- In the product loop, this page sits between `Add Characters` and review flows (`Flashcard` and `Fill Test`).

## 2. Responsibilities

- Allowed:
- Build admin targets from unique Hanzi in `db.words` and dictionary pronunciations.
- Load persisted entries from `db.flashcardContents` into editable draft JSON.
- Generate content through `/api/flashcard/generate` in modes: `full`, `phrase`, `example`, `phrase_details`, `meaning_details`, `example_pinyin`.
- Normalize and validate draft content before persistence.
- Persist per-target content to `flashcardContents`.
- Support manual authoring flows for new meaning/phrase/example rows.
- Render phrase/example pinyin with alignment logic.
- Toggle `include_in_fill_test` (`FT On/Off`) and persist immediately.
- Compute and apply filterable target stats (targets, with content, missing, ready, excluded).

- Must NOT:
- Grade words or modify spaced-repetition scheduling state.
- Write to `db.words`.
- Start/drive review sessions.
- Treat unsaved drafts as persisted review content.

## 3. Data Dependencies

- Models/types consumed:
- `Word` (`src/lib/types.ts`) for `hanzi` source inventory.
- `XinhuaFlashcardInfo` (`src/lib/xinhua.ts`) for pronunciation discovery.
- `FlashcardLlmRequest`, `FlashcardLlmResponse`, `FlashcardMeaning`, `FlashcardMeaningPhrase` (`src/lib/flashcardLlm.ts`).
- Admin-local view models in `WordsWorkspace.tsx`: `AdminTarget`, `AdminTableRow`, `AdminPendingPhrase`, `AdminPendingMeaning`, `AdminStatsFilter`.

- Fields read:
- From `words`: `hanzi`.
- From `flashcardContents`: `key`, `character`, `pronunciation`, `content`, `updatedAt`.
- From `content.meanings[]`: `definition`, `definition_en`.
- From `content.meanings[].phrases[]`: `phrase`, `pinyin`, `example`, `example_pinyin`, `include_in_fill_test`.

- Fields written:
- `flashcardContents` via `putFlashcardContent(character, pronunciation, normalizedContent)`.
- `flashcardContents` deletion via `deleteFlashcardContent(character, pronunciation)`.
- No writes to `words`, `fillTests`, or `disabledFillTests` from this page.

- Coupling to scheduler or persistence:
- Direct persistence coupling to Dexie (`flashcardContents` table).
- No direct scheduler writes.
- Indirect coupling to testing pipeline: saved content plus `include_in_fill_test` drives `buildFillTestFromSavedContent(...)` used by due review generation.

## 4. Processing Flow

- Page load sequence:
1. When `page === "admin"`, start admin load.
2. Collect unique Hanzi from `words`, including legacy rows by splitting multi-character `word.hanzi` values.
3. Resolve pronunciations via `getXinhuaFlashcardInfo(..., { includeAllMatches: true })`.
4. Build deduped `AdminTarget[]` keyed by `character|pronunciation`.
5. Load persisted `flashcardContents` for each target.
6. Seed `adminTargets`, `adminJsonByKey`, `adminSavedByKey`, and `flashcardLlmData`.
7. Emit notice for characters skipped due to missing dictionary pronunciation.

- State transitions:
- Draft-only state: regenerate/edit/delete-row actions update `adminJsonByKey` and mark unsaved.
- Persisted state: explicit save actions write normalized content to DB and mark saved.
- Inline example edit sets `example_pinyin` to empty until save regenerates it.
- `FT On/Off` toggle is immediate-save and updates stats-driving content state.

- User interactions:
- Target-level actions: `R` regenerate all, `S` save target, `D` delete saved target, `+ Meaning` add pending meaning row.
- Meaning-level actions: `+ Phrase`, pending-meaning `Save New`/`Cancel`.
- Phrase-level actions: `FT On/Off`, `R` regenerate phrase, `S` save, `D` delete phrase, pending-phrase `Save New`/`Cancel`.
- Example-level actions: `R` regenerate example, `E` inline edit, `S` save, `D` delete row.
- Batch action: `Preload Missing` iterates targets, skipping existing persisted entries.
- Stats cards act as filters for visible targets.

- Side effects:
- Network calls to `/api/flashcard/generate`.
- DB writes/deletes in `flashcardContents`.
- Notice updates and alert popup for manual-edit fallback cases.
- Filter and row-group recomputation through memoized derivations.

## 5. Invariants (Must Always Be True)

- UI invariants:
- Stats cards are clickable filter controls.
- Stats cards share `admin-stats-card` class and must override global pill button radius.
- Top and bottom spacing and layout are consistent across stats cards.
- Table always renders an empty placeholder row (`empty_target`) when a visible target has no rows.
- `adminEditingExampleRowKey` is cleared when that row is no longer present.

- Data invariants:
- `Targets` count equals all admin targets, regardless of content.
- `Targets with content` means at least one phrase row exists after normalization.
- `Targets missing content` means no phrase row exists after normalization.
- `Targets ready for testing` means target has content and at least one phrase with `include_in_fill_test !== false`.
- `Targets excluded for testing` means target has content and no phrase included for fill-test.
- Ready/excluded counts are subsets of targets-with-content only.
- `FT On/Off` click persists immediately and triggers stats refresh from updated content state.

- Performance assumptions:
- Current implementation assumes manageable target volume; derivations repeatedly parse/normalize JSON in-memory.
- Preload runs sequentially and assumes acceptable latency for one-target-at-a-time generation.

## 6. Edge Cases

- Empty state:
- No words -> no admin targets.
- Active filter with no matching targets -> filter-specific empty message.

- Corrupt data:
- If draft JSON parse fails during stats/row derivation, target is treated as no content.
- `readAdminDraft` throws when draft is empty or invalid for actions requiring a draft.
- Normalization drops invalid meanings/phrases and enforces response shape before save.

- Future compatibility concerns handled in current code:
- Legacy multi-character `word.hanzi` entries are decomposed into individual targets.
- Characters with no dictionary pronunciation are skipped with notice, not fatal.
- Pending rows are pruned when targets change.

## 7. Known Risks

- Technical debt:
- Content Admin architecture is embedded inside `WordsWorkspace.tsx` with heavy shared-state concentration.
- Row identity/mutation relies on value-matching (`meaning + phrase + pinyin + example + example_pinyin`), which is brittle under concurrent draft edits.

- Tight coupling:
- Admin stats, table rendering, normalization, and persistence are tightly coupled in one component.
- Review content availability depends on this page saving normalized `flashcardContents` entries.

- Scalability concerns:
- Sequential preload and per-render normalization/JSON parsing may degrade with large target sets.
- No server-side concurrency control; draft edits are local and optimistic.

## 8. Explicit Non-Goals

- This page is not a scheduler tuning or grading surface.
- This page is not the place for character inventory CRUD (`Add Characters` / `All Characters` own that).
- This page is not the runtime review UI for flashcards/fill-test sessions.
- This page is not a standalone server-side CMS with multi-user locking/version history.

## 9. Extension Boundaries

- Safe extension zones:
- Add validations in normalization and save pipelines without changing persistence schema.
- Add new stats cards only if derived from normalized per-target content state.
- Add row-level actions that follow the existing draft -> normalize -> persist pattern.
- Enhance notices and filter messaging without altering data semantics.

- Changes requiring architecture review:
- Changing `flashcardContents` key contract (`character|pronunciation`) or table ownership.
- Auto-saving all draft mutations by default.
- Introducing writes from this page into `words` or scheduler state.
- Changing FT semantics (`include_in_fill_test`) or target classification rules.
- Moving preload/generation strategy to parallel/batch execution without rate-limit/error policy design.
