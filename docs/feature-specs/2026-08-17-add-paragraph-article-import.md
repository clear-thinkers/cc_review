# Feature Spec — 2026-08-17 — Add Paragraph: Article Import & Known/Unknown Triage (Tier 1, Item I, Phase 1)

## Problem

Today the only ways to add vocabulary are (1) a free-text Hanzi box on `/words/add` that explodes input into individual characters, and (2) a comma-separated phrase textarea — both require the parent to already know which characters/phrases are new. Neither can ingest a real article: there's no way to paste running prose, see it rendered as readable text with known content visually distinguished from unknown content, and select just the unknown spans to add. This blocks roadmap item I ("Article import → known/unknown triage"), called out as the most immediate Tier 1 need now that phrase storage (item D) has shipped.

## Scope

- New route `/words/add-paragraph`, parent/platform-admin only (children blocked, matching `/words/add`).
- Parent pastes a block of Chinese text (may contain multiple paragraph breaks and sentences). The app splits it into sentences and renders it in readable form.
- Every Hanzi character occurrence and every substring matching an existing `vocab_phrases.phrase` is flagged known (already in `words`/`vocab_phrases` for the family) or unknown, rendered inline over the sentence text.
- A net-new click/drag span-selection interaction lets the parent select one or more unknown (or known — selection is not restricted to unknown-only) character/phrase spans across the rendered text.
- Selected spans are bulk-added to `words`/`vocab_phrases` and optionally tagged via the existing Textbook → Grade → Unit → Lesson cascade, in one submission — reusing the exact ingestion/tagging services `/words/add` already uses.
- The imported text itself is persisted as a `paragraphs` row (raw text + parsed sentence/span structure), because it is fill-test source material for Phase 2 — but Phase 1 ships no way to view, edit, or package a saved paragraph. It is write-only from the user's perspective until Phase 2's library page exists.

## Out of scope

- Fill-test packaging, the paragraph library page (`/words/paragraphs`), and any runtime quiz integration — covered by the separate Phase 2 spec, `docs/feature-specs/2026-08-17-paragraph-fill-test.md`.
- Editing or re-triaging a paragraph after import (see Open Questions — punted to Phase 2 since it's only relevant once paragraphs are viewable/packageable).
- Splitting one pasted submission into multiple `paragraphs` rows. A single submission — however many paragraph breaks or sentences it contains — becomes exactly **one** `paragraphs` row. Paragraph-break position within that one row is preserved as a per-sentence flag (see Data model) purely for faithful re-rendering, not as a reason to create multiple rows.
- AI generation of any kind (pinyin, meanings, examples) for spans added through this flow — added characters/phrases land exactly where they do today via `/words/add` (uncurated, `repetitions=0`, no flashcard content), and Content Admin remains the separate curation step, matching Ingestion Rule #7 in `0_ARCHITECTURE.md`.
- Changing `extractUniqueHanzi`, `computeIngestionResult`, `computePhraseIngestionResult`, or any existing `/words/add` code path — this feature reuses them as pure functions, unmodified.

## Proposed behavior

### Data model

New table `paragraphs`, family-scoped RLS, modeled on `vocab_phrases`:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `family_id` | uuid | FK → `families.id`, cascade delete |
| `title` | text (nullable) | Optional; parent-entered or left null |
| `raw_text` | text | Exactly as pasted, immutable source of truth |
| `sentences` | jsonb | `ParagraphSentence[]`, default `'[]'::jsonb` — see shape below |
| `created_by_user_id` | uuid | FK → `users.id`, cascade delete |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Default `now()` |

RLS: family-scoped read (`current_family_id()` or `is_platform_admin()`); insert/update/delete restricted to `current_jwt_role() = 'parent'` or platform admin — **not** family-scoped-for-children the way `vocab_phrases`' UPDATE policy is, since a paragraph is never graded or written to by a child.

`sentences` jsonb shape, following the `flashcard_contents.phrases`/`vocab_phrases.examples` flat-jsonb-array convention:

```ts
type ParagraphSpan = {
  id: string;                      // stable, e.g. `${paragraphId}-s${sentenceIndex}-${startOffset}`
  text: string;                    // exact substring, e.g. "图书馆"
  startOffset: number;             // char offset within this sentence's `text`
  endOffset: number;               // exclusive
  kind: "character" | "phrase";
  resolvedWordId?: string;         // set once added/matched to words.id (kind: "character")
  resolvedVocabPhraseId?: string;  // set once added/matched to vocab_phrases.id (kind: "phrase")
  fillTestEligible: boolean;       // parent's explicit choice; consumed by Phase 2 only
};

type ParagraphSentence = {
  index: number;
  text: string;                    // raw sentence text
  paragraphBreakBefore: boolean;   // true if a blank line/paragraph break preceded this sentence in raw_text — rendering-only, does not affect round-building
  spans: ParagraphSpan[];          // ordered by startOffset
};
```

New domain type file `src/lib/paragraph.types.ts` (mirrors the placement of `VocabPhrase`/`VocabPhraseExample` in `src/lib/types.ts`): `ParagraphSpan`, `ParagraphSentence`, `Paragraph = { id, familyId, title, rawText, sentences, createdByUserId, createdAt, updatedAt }`.

No new RPC — paragraph creation is a plain sequence of service calls, the same non-atomic tolerance `AddVocabPhraseSection.handleSubmit` already accepts for its own multi-step add+tag flow.

### New pure domain modules

Co-located `.test.ts`, no I/O — follows `src/app/words/add/addIngestion.ts`'s convention exactly.

**`src/lib/paragraphParsing.ts`**
- `splitIntoSentences(rawText: string): { text: string; paragraphBreakBefore: boolean }[]` — Chinese-punctuation-aware split (`。！？!?` plus newlines-as-sentence-boundaries), trimmed, empties dropped; a blank line (two or more consecutive newlines) between two sentences sets `paragraphBreakBefore: true` on the following sentence. No existing precedent splits running prose — `extractUniqueHanzi` explodes to individual characters, `parseCommaSeparatedPhrases` splits an already-flat list — this is new logic.
- `buildParagraphSentences(rawText: string): ParagraphSentence[]` — wraps split output into `{ index, text, paragraphBreakBefore, spans: [] }` skeletons.

**`src/lib/paragraphTriage.ts`** — the genuinely novel logic; no existing function detects a known phrase's occurrence inside arbitrary running text (`computePhraseIngestionResult` only dedupes an already-tokenized flat list against existing phrases).
- `triageParagraphCharacters(sentences: string[], existingHanzi: Map<string, string>): CharacterTriageMatch[]` — one match per Hanzi occurrence (not deduped; a character appearing three times produces three independently-selectable matches), reusing `extractUniqueHanzi`'s Han-range detection rather than duplicating it. `existingWordId` is `null` when the character isn't yet in `words` for the family — that's the "unknown" flag the UI renders on.
- `triagePhrasesInText(sentences: string[], existingPhrases: Map<string, string>): PhraseTriageMatch[]` — substring scan per sentence, longest-match-first at each start offset, so a longer known phrase (e.g. "图书馆") isn't also flagged as containing a separately-highlighted shorter known phrase ("图书") at an overlapping position.
- Overlap resolution between a character match and a phrase match covering the same text is a UI-layer rendering decision on top of these two independent lists (see Open Questions) — kept out of the pure functions themselves, matching `addIngestion.ts`'s small-single-purpose-function style.

**`src/app/words/add-paragraph/addParagraphIngestion.ts`** — orchestration-adjacent pure helpers specific to this flow (e.g. resolving which selected spans need a new `words`/`vocab_phrases` insert vs. already resolve to an existing row, merging freshly-resolved ids back into the `sentences` structure before `createParagraph`), mirroring `addIngestion.ts`'s role for `/words/add`.

### Service layer (`src/lib/supabase-service.ts`)

Following the `vocab_phrases` converter pattern (`toVocabPhrase`/`fromVocabPhraseExamples`):

```ts
function toParagraph(row: SupabaseParagraphRow): Paragraph;
function normalizeParagraphSentences(sentences: unknown): ParagraphSentence[]; // defensive parse, mirrors normalizeVocabPhraseExamples
export async function createParagraph(rawText: string, title: string | null, sentences: ParagraphSentence[]): Promise<Paragraph>;
export async function listParagraphs(): Promise<Paragraph[]>; // unused by Phase 1 UI, needed by Phase 2's library page — added now since it's trivial alongside createParagraph
export async function getParagraph(id: string): Promise<Paragraph | null>;
export async function deleteParagraph(id: string): Promise<void>;
```

`createParagraph` does not itself write `words`/`vocab_phrases` rows. The submit handler sequences: resolve existing hanzi/phrases → `addWord`/`addVocabPhrases` for newly-selected spans → `assignWordLessonTags`/`assignVocabPhraseLessonTags` if a tag was selected → `createParagraph` with resolved ids baked into the `sentences` jsonb. This exactly mirrors `AddVocabPhraseSection.handleSubmit`'s existing multi-step orchestration — no new combined-write pattern.

### Route & components

Per `0_BUILD_CONVENTIONS.md §5`, new directory `src/app/words/add-paragraph/`:

- `page.tsx` — `<WordsWorkspace page="addParagraph" />`, mirrors `add/page.tsx`.
- `AddParagraphPage.tsx` — thin layout wrapper, mirrors `AddPage.tsx`.
- `AddParagraphSection.tsx` — mounted unconditionally in `WordsWorkspace.tsx`, self-gates on `vm.page !== "addParagraph"` (same pattern every section uses). Paste box → parse → triage render → selection → bulk add+tag submit → notice.
- `ParagraphSpanSelector.tsx` — the net-new selection UI (standalone, reusable by Phase 2's library page too).
- `addParagraph.strings.ts` — standalone strings file, not an extension of `words.strings.ts`. Precedent: `/words/prompts` mounts through the identical shared `WordsWorkspace`/VM architecture yet owns `prompts.strings.ts` independently — mounting mechanism is orthogonal to strings-file ownership, and `words.strings.ts` is already 2400+ lines.
- `addParagraph.types.ts`, `addParagraph.test.tsx`, `addParagraphIngestion.ts` + `.test.ts`.

**`ParagraphSpanSelector.tsx`** — presentation-only, controlled component. Click-to-toggle per-token selection via `onMouseDown`/`onMouseEnter`(while a mousedown flag is set)/`onMouseUp` on each token `<span>` — deliberately not the native `Selection`/`Range` API, which doesn't hit-test reliably against the ruby/pinyin DOM `renderPhraseWithPinyin` already injects for known spans. This supports contiguous-token drag selection only (sufficient — a character/phrase span is always a contiguous run). Reuses `renderPhraseWithPinyin`/`renderSentenceWithPinyin`/`tokenizePinyinSyllables` as the per-character rendering primitive for known spans (per `0_BUILD_CONVENTIONS.md §7`'s "never hand-roll ruby DOM again" rule) — this component only layers the click/drag selection interaction on top. The caller (`AddParagraphSection`) owns selection state and resolves it at submit time, mirroring `TagCascadePicker`'s `"controlled"` mode.

Props:
```ts
type ParagraphSpanSelectorProps = {
  sentence: ParagraphSentence;
  characterMatches: CharacterTriageMatch[];
  phraseMatches: PhraseTriageMatch[];
  selectedRanges: { startOffset: number; endOffset: number }[];
  onSelectionChange: (ranges: { startOffset: number; endOffset: number }[]) => void;
  str: AddParagraphStrings["selector"];
};
```

### State

New composed hook `src/app/words/shared/state/useAddParagraphState.ts` — paste input, parsed sentences, triage match lists, current selection, tag-cascade selection, submit/notice state. Follows the existing `state/use*.ts` extraction precedent (`useAdminState.ts`, `useFillTestReviewState.ts`) rather than growing `words.shared.state.ts` further. Reads `words`/`vocabPhrases` already loaded in `useWordsBaseState.ts` to build the `existingHanzi`/`existingPhrases` maps `paragraphTriage.ts` needs — no new base-state fields required.

Required additive touches to shared infrastructure:
- `useWordsWorkspaceState` (`words.shared.state.ts`) — import and spread the new hook.
- `WordsSectionPage`/`NavPage` (`src/app/words/shared/shell.types.ts`) — add `"addParagraph"`.
- `getNavItems` (`words.shared.utils.tsx`) — add a nav entry, visible to parent/platform-admin only.
- `canAccessRoute` (`src/lib/permissions.ts`) — add `'/words/add-paragraph'` to `ProtectedRoute` and a `case '/words/add-paragraph': return role === 'parent';` branch.
- `WordsWorkspace.tsx` — add `<AddParagraphSection vm={vm} />` to the flat mount list.

## Edge cases

- **Empty or whitespace-only paste** — submit button disabled / blocked with a notice, matching the existing `disabled={submitting || !input.trim()}` pattern on `AddVocabPhraseSection`'s submit button.
- **Paragraph with zero Hanzi content** (e.g. pasted English or punctuation only) — parses to zero triage matches; UI shows an explicit empty-state notice rather than a blank render.
- **Every character/phrase in the paragraph is already known** — triage renders with everything flagged known; selection is still possible (not restricted to unknown-only, per Scope) but the notice after submit should clarify nothing new was added if the parent submits with no selection.
- **Overlapping character/phrase matches** — see Open Questions; must not silently double-count or corrupt span offsets when both a character-level and phrase-level match cover the same text.
- **Very long paragraph / many sentences** — no hard cap specified; the selection UI and triage render must not degrade unusably (defer performance tuning to implementation, not a spec-level constraint, but flag if a paste exceeds some reasonable bound, e.g. 5,000 characters, for a friendlier truncation notice rather than a silent freeze).
- **Partial failure mid-submit** (e.g. `addVocabPhrases` succeeds, `createParagraph` fails) — same tolerance as the existing `/words/add` flows: surface an error notice, don't silently lose the paragraph text (keep it in the textarea so the parent can retry), don't attempt automatic rollback of already-inserted words/phrases.
- **Tag section opened but incomplete** — blocks submission with the existing `isTagFormComplete`/`tagStr.partialTagError` pattern, unchanged.
- **Child or unauthenticated access to `/words/add-paragraph` via direct URL** — redirected by `RouteGuard`/`canAccessRoute`, same as `/words/add` today, no new error state needed.

## Risks

- New table/RLS surface — `scripts/verify-rls.ts` must be extended to cover `paragraphs` before this ships to a live project.
- Schema-drift caution: live `lesson_tags` columns (`slot_1_value`/`slot_2_value`/`slot_3_value` per `src/lib/supabase-service.ts`'s `SupabaseLessonTagRow`) don't match what migration files and `0_ARCHITECTURE.md` document (`grade`/`unit`/`lesson`) — this feature's new table doesn't touch `lesson_tags` directly, but verify actual live columns on `words`/`vocab_phrases` (e.g. via `npm run db:status` + a fresh introspection) before writing the `paragraphs` migration, in case similar undocumented drift exists there too.
- The span-selection interaction is genuinely novel UI with no precedent to copy — budget extra iteration/QA time relative to a typical form-based feature; a first pass may not get click/drag hit-testing right against the ruby-annotated known-span rendering.
- The phrase-in-running-text substring scan (`triagePhrasesInText`) is O(sentences × phrases × sentence length) in the naive implementation — acceptable for expected family-scale phrase counts (dozens to low hundreds), but worth a basic performance sanity check against the largest expected library size before shipping.

## Test plan

- `src/lib/paragraphParsing.test.ts` — sentence splitting (Chinese punctuation, mixed EN/ZH, newline-as-paragraph-break detection), empty/whitespace input.
- `src/lib/paragraphTriage.test.ts` — character triage (repeated occurrences, mix of known/unknown), phrase triage (longest-match-first at overlapping start offsets, phrase spanning a sentence boundary is never matched, zero-match paragraph).
- `src/app/words/add-paragraph/addParagraphIngestion.test.ts` — resolving selected spans to insert-needed vs. already-resolved, merging resolved ids back into `sentences`.
- `src/lib/supabase-service.paragraphs.test.ts` (new, mirrors `supabase-service.vocabPhrases.test.ts`) — `createParagraph`/`listParagraphs`/`getParagraph`/`deleteParagraph` CRUD, `normalizeParagraphSentences` defensive parsing of malformed jsonb, RLS boundary assertions mocked.
- UI: `addParagraph.test.tsx` — paste → parse → triage render shows correct known/unknown flags against seeded `words`/`vocab_phrases`; span selection toggles correctly; submit with tag section incomplete blocks with the existing error; submit with valid selection calls `addWord`/`addVocabPhrases`/tag-assignment/`createParagraph` in the right sequence.
- `scripts/verify-rls.ts` extended and passing for `paragraphs`.
- Manual: exercise `/words/add-paragraph` in-browser as a parent — paste a multi-sentence article, confirm known/unknown flagging, select spans, bulk add + tag, confirm new words/phrases appear on `/words/all`. Confirm a child profile is redirected away from the route.

## Acceptance criteria

- [ ] Parent/platform-admin can navigate to `/words/add-paragraph`; children are blocked (redirected, no error shown), matching `/words/add`'s role gate.
- [ ] Pasting Chinese text renders it split into sentences, with every Hanzi character and every substring matching an existing family phrase visually flagged known vs. unknown.
- [ ] Parent can click/drag-select one or more character or phrase spans across the rendered text.
- [ ] Parent can bulk-add the selection to `words`/`vocab_phrases` (skipping already-existing entries, matching the existing "some added, some skipped" notice pattern) and optionally apply a single Textbook/Grade/Unit/Lesson tag to the whole submitted batch, in one submission.
- [ ] The full pasted text and its parsed sentence/span structure persist to a new `paragraphs` row on submit.
- [ ] `scripts/verify-rls.ts` passes with `paragraphs` covered.
- [ ] All new pure-logic modules have passing unit tests; `npm test`, `tsc --noEmit`, and `npm run check:encoding` are clean.

## Open questions

1. **Overlap-resolution rule** for character-span vs. phrase-span highlighting when they cover the same text — which wins visually by default, and can the parent independently select the phrase-level span vs. a character-level span within it in the same interaction? Needs a decision before `ParagraphSpanSelector.tsx` is built, not just before Phase 2.
2. **Maximum paste length** — is there a hard cap, or is graceful degradation (truncation notice) sufficient? Affects whether `paragraphParsing.ts` needs an explicit length-guard function.
3. **Selection restricted to unknown spans only, or free selection of anything (including already-known spans)?** Scope currently states free selection (harmless — re-adding an already-existing word/phrase is a no-op skip, same as today's ingestion rules) but this should be confirmed as intentional rather than assumed.
4. **Paragraph mutability after import** — deferred to the Phase 2 spec, since it only matters once a library/edit surface exists, but flagging here so Phase 1's `sentences` schema isn't accidentally designed in a way that blocks a future edit path.
