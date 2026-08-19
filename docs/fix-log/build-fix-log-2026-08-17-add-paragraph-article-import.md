---
title: Fix Log – 2026-08-17 – Add Paragraph: Article Import & Known/Unknown Triage (Phase 1)
---

## Context

Roadmap item I (Tier 1, "most immediate need") per `docs/architecture/0_PRODUCT_ROADMAP.md`. Implements `docs/feature-specs/2026-08-17-add-paragraph-article-import.md` in full: new route `/words/add-paragraph`, new `paragraphs` table + RLS, and the net-new click/drag span-selection UI. Authorized by the user for the three `AI_CONTRACT.md §2` boundaries this crosses (schema migration, new RLS policy, new top-level route); three spec Open Questions (overlap-resolution rule, max paste length, selection scope) were resolved with the user via `AskUserQuestion` before implementation.

## Root Cause

N/A — this is new-feature work, not a bug fix. Logged per `AI_CONTRACT.md §5`'s "Security fixes or changes to route/permission logic" trigger, since the change adds a new protected route and a new RLS-governed table.

## Changes Applied

- **Migration:** `supabase/migrations/20260817000000_paragraphs.sql` — new `paragraphs` table (family-scoped read; parent/platform-admin-only insert/update/delete, deliberately not family-scoped-for-children the way `vocab_phrases`' UPDATE is).
- **Domain layer:** `src/lib/paragraph.types.ts` (types), `src/lib/paragraphParsing.ts` + test (sentence splitting, truncation guard), `src/lib/paragraphTriage.ts` + test (character/phrase triage against `words`/`vocab_phrases`).
- **Service layer:** `src/lib/supabase-service.ts` — `createParagraph`/`listParagraphs`/`getParagraph`/`deleteParagraph` + row converters/normalizers; `src/lib/supabase-service.paragraphs.test.ts`.
- **Route:** `src/app/words/add-paragraph/` — `page.tsx`, `AddParagraphPage.tsx`, `AddParagraphSection.tsx`, `ParagraphSpanSelector.tsx` (+ exported pure helpers `buildSentenceRenderTokens`/`computeDragSelectionRange`), `addParagraphIngestion.ts` + test, `addParagraph.types.ts` + test, `addParagraph.strings.ts`, `addParagraph.test.tsx`.
- **Shared infra:** `src/app/words/shared/state/useAddParagraphState.ts` (new composed state hook) wired into `words.shared.state.ts`; `shell.types.ts`/`shell.types.test.ts` gained `"addParagraph"`; `words.shared.utils.tsx`'s `getNavItems` gained a nav entry; `words.strings.ts` gained `nav.addParagraph` (EN+ZH); `WordsWorkspace.tsx` mounts `<AddParagraphSection>`.
- **Permissions:** `src/lib/permissions.ts` — `ProtectedRoute` gained `'/words/add-paragraph'`; `canAccessRoute` gained a parent-only case (the switch's `default` branch passes unknown routes through, so an explicit case was required rather than relying on fallthrough); `src/lib/permissions.test.ts` extended.
- **RLS verification:** `scripts/verify-rls.ts` — `paragraphs` added to the Section 1 table-accessibility list; new Section 7 covering child-write-rejection (insert/update/delete), parent-write-success, and cross-family read isolation.
- **Docs:** `docs/architecture/0_ARCHITECTURE.md` (Data Schema: `paragraphs` table; permission matrix row; new "Add Paragraph Rules" section) and `docs/architecture/0_PRODUCT_ROADMAP.md` (item I row + current-state summary) updated in this commit.

## Architectural Impact

- New table + RLS surface (Data layer).
- New protected route + permission-matrix entry (UI/routing layer).
- No changes to any existing `/words/add` code path, RPC, scheduler, or AI generation boundary — this feature reuses `addWords`/`addVocabPhrases`/`assignWordLessonTags`/`assignVocabPhraseLessonTags`/`createLessonTagIfNew` unmodified.
- `src/lib/paragraphParsing.ts` and `src/lib/paragraphTriage.ts` deliberately do not import from `src/app/**` (UI layer) to keep the Domain→UI dependency direction intact — Hanzi detection is a local regex rather than a reuse of `words.shared.utils.tsx`'s `isHanziCharacter`.

## Preventative Rule

None new — this follows existing patterns (`vocab_phrases` migration/RLS shape, `/words/prompts`' standalone-strings-file precedent, `AddVocabPhraseSection`'s multi-step non-atomic submit tolerance).

## Verification Status

Updated after a second pass — see `docs/fix-log/build-fix-log-2026-08-17-tag-cascade-picker-custom-value-blank.md` for the one real bug this surfaced (unrelated to this table/route; a pre-existing shared-component gap in `TagCascadePicker.tsx`).

- ✅ `npm test` — 653/653 pass.
- ✅ `npm run typecheck` — clean.
- ✅ `npm run check:encoding` — clean.
- ✅ `npm run lint` — no new errors/warnings.
- ✅ Migration `20260817000000_paragraphs.sql` — confirmed applied to the live dev Supabase project via `npm run db:status` (a `.env.local` with real dev credentials exists in this environment; the initial claim above of "no live project available" was wrong — the file was never checked).
- ✅ `npm run verify:rls` — Section 7 (`paragraphs`) passes 6/6 live against the dev project. Overall run is 51/52 passing; the one failure (`vocab_phrase_lesson_tags setup`) is the pre-existing, unrelated `lesson_tags` schema-drift issue already documented in `0_BUILD_CONVENTIONS.md`'s "Known state" note for `verify-rls.ts`.
- ✅ Manual in-browser QA — performed via a headless-Chromium driver against `npm run dev` + the live dev project: logged in as the seeded platform-admin, navigated `/words/add-paragraph`, pasted text, parsed, drag-selected a span, opened Add tags, selected/created a textbook and custom grade/unit/lesson values, submitted, got the success notice, confirmed the added word persisted (rendered "known" on the next parse). Child-redirect was not separately re-verified in this pass (covered by `permissions.test.ts` and the unmodified, pre-existing `RouteGuard`/`canAccessRoute` mechanism shared by every other parent-only route).

## Docs Updated

- AI_CONTRACT.md: no — no boundary/hard-stop rule changed, only executed under existing §2 authorization flow.
- 0_ARCHITECTURE.md: yes — `paragraphs` table, permission matrix row, new "Add Paragraph Rules" section.
- 0_BUILD_CONVENTIONS.md: no — no new convention introduced; followed existing ones (standalone strings file, composed state hook, pure-helper test seam).
- 0_PRODUCT_ROADMAP.md: yes — item I row and current-state summary updated to reflect Phase 1 built-but-unverified status.
