---
title: Fix Log – 2026-08-18 – Paragraph Library, Re-Import & Test-Mode Prep (Phase 2)
---

## Context

Roadmap item I, Phase 2, per `docs/feature-specs/2026-08-17-paragraph-fill-test.md` (revised same day per user direction — see the spec's own "Revision note" — to drop the originally-drafted new `/words/paragraphs` route and full runtime-quiz-integration scope in favor of managing the library on the existing `/words/add-paragraph` page, with a separate, simpler "test mode" concept and no runtime integration at all). User further redirected the blank-selection UI mid-build to reuse `ParagraphSpanSelector.tsx`'s token rendering (three-state known/ineligible/eligible, click-to-carve into a numbered word bank) instead of a plain checklist, and to support editing an existing test mode, not just create/delete. Authorized by the user for the schema migration and RLS policy boundaries this crosses.

## Root Cause

N/A — new-feature work, not a bug fix. Logged per `AI_CONTRACT.md §5`'s "Security fixes or changes to route/permission logic" trigger (new RLS-governed table), matching the precedent set by Phase 1's fix log.

## Changes Applied

- **Migration:** `supabase/migrations/20260818000000_paragraph_test_modes.sql` — new `paragraph_test_modes` table; family-scoped read, parent/platform-admin-only write; `unique (paragraph_id, name)` — per-paragraph, not family-wide.
- **Domain layer:** `src/lib/paragraphTestMode.types.ts` (types); `src/lib/paragraphLibrary.ts` + test (`resolveParagraphTagIds`, `matchesParagraphTitleFilter` — tag matching itself reuses the existing `matchesSelectedTagFilter`/`NO_TAG_FILTER_ID` convention from `tagFilter.utils.ts` unchanged, rather than a redundant bespoke matcher).
- **Service layer:** `src/lib/supabase-service.ts` — `updateParagraph`, `listParagraphTestModes`, `listAllParagraphTestModes` (bulk, for the library list's per-row test-mode count), `createParagraphTestMode`, `updateParagraphTestMode`, `deleteParagraphTestMode`, plus the `PARAGRAPH_TEST_MODE_NAME_TAKEN` distinguishable-error convention for translating the unique-constraint violation into a friendly inline error; `src/lib/supabase-service.paragraphTestModes.test.ts` (new), `supabase-service.paragraphs.test.ts` extended for `updateParagraph`.
- **Domain module extension:** `addParagraphIngestion.ts`'s `mergeResolvedSpansIntoSentences` changed from replace- to append-based (backward-compatible — a brand-new paragraph's sentences always start with `spans: []`), required for Continue Import to add onto an existing paragraph's tracked spans without dropping what's there.
- **New route-adjacent components**, all within the existing `src/app/words/add-paragraph/` directory (no new route directory) and mounted flatly in `WordsWorkspace.tsx` alongside `AddParagraphSection.tsx`, each self-gating on `vm.paragraphViewMode`: `ParagraphLibrarySection.tsx` (filterable list), `ContinueImportSection.tsx` (re-triage + additive span selection + title edit), `TestModeSection.tsx` (per-paragraph test-mode list, create/edit/delete), `TestModeBlankSelector.tsx` (new three-state token selector — exports `classifyTokenEligibility` and `assignBlankDisplayIndexes` as independently-tested pure helpers, reuses `ParagraphSpanSelector.tsx`'s exported `buildSentenceRenderTokens`).
- **Shared state:** `useAddParagraphState.ts` gained navigation state (`paragraphs`, `paragraphViewMode`, filter state, `paragraphSelectedId`); `words.shared.state.ts` wired it through and added `listParagraphs()` to `refreshAll()`.
- **Nav rename:** `words.strings.ts`'s `nav.addParagraph` value (key unchanged) — "Add Paragraph" → "Manage Paragraphs" / "导入短文" → "管理短文", EN and ZH.
- **RLS verification:** `scripts/verify-rls.ts` — `paragraph_test_modes` added to the Section 1 table list; new Section 8 covering child-write-rejection, parent-write-success, cross-family isolation, **and** the per-paragraph unique-constraint behavior specifically (same name on the same paragraph rejected; same name on a different paragraph succeeds).

## Architectural Impact

- New table + RLS surface (Data layer). No new route (deliberate — see Context).
- `paragraphLibrary.ts` and the rest of the Domain layer additions keep the established Domain→UI non-dependency (no `src/app/**` imports).
- No changes to `review_test_sessions`, `FillTest`/`fillTest.ts`, the quiz runtime, Due Review, or coins — this phase ships nothing playable by design.

## Preventative Rule

None new beyond what's noted in the companion fix log (`build-fix-log-2026-08-18-paragraph-stale-triage-state.md`) for the stale-state bug this phase's live QA surfaced.

## Verification Status

- ✅ `npm test` — 694/694 pass.
- ✅ `npm run typecheck` — clean.
- ✅ `npm run check:encoding` — clean.
- ✅ `npm run lint` — no new errors; two new warnings/errors surfaced during development (`react-hooks/set-state-in-effect` in `ContinueImportSection.tsx`, `react-hooks/exhaustive-deps` in `ParagraphLibrarySection.tsx`) were fixed before landing, not left in place.
- ✅ Migration `20260818000000_paragraph_test_modes.sql` deployed to the live dev Supabase project via `npm run db:push`.
- ✅ `npm run verify:rls` — Section 8 (`paragraph_test_modes`) passes 6/6 live, including both unique-constraint directions. Overall run 59/60; the one failure is the same pre-existing, unrelated `lesson_tags` schema-drift issue already documented in `0_BUILD_CONVENTIONS.md`.
- ✅ Manual in-browser QA — headless-Chromium driver against `npm run dev` + the live dev project: confirmed the nav rename, library-first default view with the always-visible "+ Import New Paragraph" CTA, title-filtered the library down to one exact match, ran Continue Import on that paragraph (confirmed the raw-text field is read-only, added another span), opened Prep Fill Test (confirmed all four legend states render — Unknown/Known-not-eligible/Eligible/Blank — and that carving an eligible token produces a numbered blank + matching word-bank chip), created a test mode, edited it (confirmed the form pre-populates from the saved state), and confirmed a same-paragraph duplicate name is rejected with the friendly inline error. This same pass is what surfaced the stale-state bug — see the companion fix log.

## Docs Updated

- AI_CONTRACT.md: no.
- 0_ARCHITECTURE.md: yes — `paragraph_test_modes` table, "Add Paragraph Rules" section extended with rules 13–21 covering the library/Continue-Import/test-mode behavior.
- 0_BUILD_CONVENTIONS.md: no — followed existing conventions throughout (standalone strings file, composed state hook, pure-helper test seam, `/words/all`'s Tags Cascade filter pattern reused as-is).
- 0_PRODUCT_ROADMAP.md: yes — item I row and current-state summary updated to reflect Phase 2 shipped, and that a Phase 3 is still needed before anything is playable.
