---
title: Fix Log – 2026-08-24 – Package as Quiz fails with "Something went wrong creating the quiz session"
---

## Context

User-reported: on `/words/add-paragraph`'s "Prep Fill Test" screen, clicking "Package as Quiz" on a saved test mode ("easy", 3 blanks) always failed with "Something went wrong creating the quiz session. Please try again." — no session was ever created.

## Root Cause

`TestModeSection.tsx`'s `submitPackage()` builds one `ReviewTestSessionTargetDraft` per blank. For a blank whose span resolved to a `vocab_phrases` row, `pronunciation` is looked up from the phrase's saved pinyin; for a blank that resolved to a standalone `words` row (a plain character), `pronunciation` is hardcoded to `""` — documented in the surrounding comment as intentional, since pinyin isn't cheaply available client-side for a bare character and `character`/`pronunciation` are denormalized *display* data only for a paragraph-quiz target (real resolution happens via the span's `resolvedWordId`/`resolvedVocabPhraseId` at runtime, per `0_ARCHITECTURE.md`'s Fill-Test Review Rule 28).

`normalizeReviewTestSessionDraftTargets` in `src/lib/supabase-service.ts` (shared by every `createReviewTestSession`/`appendTargetsToReviewTestSession` caller) silently drops any target where `!character || !pronunciation`. That filter was written for the Content Admin and Due Review flows, where a target always carries real pinyin by the time it reaches this function — Content Admin only surfaces targets with a resolved dictionary pronunciation in the first place. It was never updated when paragraph-quiz targets were added in Phase 3, so every standalone-word blank was silently filtered out.

For the reported test mode, all 3 blanks were standalone-word spans, so `normalizeReviewTestSessionDraftTargets` returned an empty array, `createReviewTestSession` threw `"Select at least one target for the session."`, and `submitPackage`'s catch-all swallowed it into the generic `packageError` string shown in the screenshot. `openPackageForm`'s pre-check (`spanIds.length < 2`) and `submitPackage`'s own `drafts.length < 2` check both ran on the *pre-normalization* draft count, so they never caught this — the drop happens one step later, inside `createReviewTestSession`.

The existing test coverage for the paragraph-quiz path (`supabase-service.reviewTestSessions.test.ts`) only exercised targets with non-empty pronunciation (`"tu2"`), so it never caught this gap.

## Changes Applied

- `src/lib/supabase-service.ts` — `normalizeReviewTestSessionDraftTargets` now only requires non-empty `pronunciation` when the target has no `paragraphSpanId`. A paragraph-quiz target is kept as long as `character` is non-empty; its `pronunciation` may legitimately be `""`.
- `src/lib/supabase-service.reviewTestSessions.test.ts` — added a regression test creating a paragraph-quiz session from 3 targets with `pronunciation: ""`, asserting all 3 survive normalization and are inserted.

## Architectural Impact

None — service-layer-only fix (`src/lib/supabase-service.ts`), no schema, RPC, or RLS change. Does not touch the resolution mechanism (`resolvedWordId`/`resolvedVocabPhraseId`), which was already correct; only the input-validation gate ahead of it was wrong.

## Preventative Rule

A shared normalization/validation helper's rules must be re-audited whenever a new caller starts passing a value the helper wasn't written to expect (here: a legitimately-empty `pronunciation`) — "the field looks required" from one caller's perspective can be actively meaningless from another's. Test each caller's boundary conditions independently rather than assuming one caller's happy-path test covers a shared helper for all callers.

## Verification

- `npx vitest run src/lib/supabase-service.reviewTestSessions.test.ts` — 10/10 pass, including the new regression test.
- `npm test` — 895/895 pass.
- `npx tsc --noEmit` — clean.
- `npm run check:encoding` — clean.
- Not yet re-verified live in-browser by the implementing session (no browser-automation tool available here) — the user should confirm "Package as Quiz" now succeeds for the same "easy" test mode from the bug report.

## Docs Updated

- AI_CONTRACT.md: no.
- 0_ARCHITECTURE.md: no — no behavioral/schema rule changed; this restores the already-documented Fill-Test Review Rule 28 behavior (pronunciation as display-only data for paragraph targets), which the shared validation helper had been silently violating.
- 0_BUILD_CONVENTIONS.md: no.
- 0_PRODUCT_ROADMAP.md: no.

---

## Follow-up — 2026-08-24 (same day)

### Context

After the fix above, the user reviewed the specific test mode from the bug report and clarified: for that test mode, the block itself was correct — none of its blanks have any saved flashcard/vocab-phrase content, so a child hitting the Reveal-after-3-bounces Hint on any of them during the quiz would see nothing useful (`ParagraphQuizRevealPopup.tsx`'s `noContentMessage` empty state, per Fill-Test Review Rule 38). The ask: keep blocking "Package as Quiz" in this situation, but make the block explicit and informative — name which characters/phrases are missing content — instead of surfacing it as an accidental, unexplained "Something went wrong" error.

This does not conflict with the fix above. That fix was about an *unrelated* false-positive: `normalizeReviewTestSessionDraftTargets` was dropping targets purely because their denormalized-display `pronunciation` field was `""`, even when the underlying word had real `flashcard_contents` — pronunciation is never eagerly looked up client-side for a standalone character, content or no content. That fix still stands and is still needed for a blank that *does* have content. This follow-up adds a second, independent, deliberate gate: content-completeness, checked at the UI layer before a session is even attempted.

### Changes Applied

- `src/app/words/add-paragraph/paragraphQuizContentCheck.ts` (new) — `spanHasHintableContent(span, words, vocabPhrases, allFlashcardContents)`, a pure helper mirroring exactly what `ParagraphQuizRevealPopup.tsx` needs to render something: a word-backed span needs at least one `flashcard_contents` row for its hanzi (same criterion as `resolveCharacterRevealContent`'s null-return case); a phrase-backed span reuses `vocabPhraseHasContent` (Content Admin's existing "with content" bar: pinyin + both meanings + at least one example) rather than the popup's own always-non-null `resolvePhraseRevealContent`, since a technically-non-null-but-empty popup is just as unhelpful as no popup.
- `src/app/words/add-paragraph/TestModeSection.tsx` — `openPackageForm` now resolves every blank's span before opening the package dialog and blocks (via the existing `notice` slot, matching the adjacent `packageMinBlanksError` precedent) if any lack hintable content, listing their text. The dialog only opens once every blank has content.
- `src/app/words/add-paragraph/addParagraph.strings.ts` — new `packageMissingContentError` key (EN + ZH) with a `{list}` placeholder for the missing items.
- `src/app/words/add-paragraph/addParagraph.strings.test.ts` (new) — recursive EN/ZH key-parity + non-empty-value test for this strings file, which had no parity test before (`0_BUILD_CONVENTIONS.md §8`).
- `src/app/words/add-paragraph/paragraphQuizContentCheck.test.ts` (new) — unit tests for `spanHasHintableContent` covering: word-backed span with/without a matching `flashcard_contents` row, unresolved word id, phrase-backed span with full/partial content, unresolved phrase id, and a span resolved to neither.
- The helper lives in its own module (not inlined in `TestModeSection.tsx`) specifically so it can be unit-tested without transitively importing `@/lib/supabase-service` (which throws at module load outside a configured Supabase env) the way `TestModeSection.tsx` itself does.

### Architectural Impact

UI-layer only. No schema, RPC, or RLS change. `createReviewTestSession`'s own validation (this fix log's first entry) is unchanged and still the last line of defense; this is a proactive, earlier, more specific check with a better message.

### Preventative Rule

When a UI action's failure mode has a specific, checkable, already-known-at-click-time cause (here: which blanks lack content the next step of the flow needs), surface that specific cause inline before attempting the action — don't let a generic downstream validation error (or its generic catch-all UI message) be the first time the user learns why. This is the same "block-then-explain" precedent Fill-Test Review Rule 37 already established for delete actions on an active session; this extends it to a create action blocked on a content precondition.

### Verification

- `npx tsc --noEmit` — clean.
- `npx eslint` on all changed/new files — clean.
- `npm test` — 905/905 pass (7 new tests for `spanHasHintableContent`, 3 new parity tests for `addParagraph.strings.ts`).
- `npm run check:encoding` — clean.
- Not yet re-verified live in-browser — the user should confirm the same "easy" test mode from the original report now shows the specific missing-content message (rather than opening the package dialog) before packaging, and that a test mode whose blanks DO have content still packages successfully.

### Docs Updated

- AI_CONTRACT.md: no.
- 0_ARCHITECTURE.md: no — this is a UI-layer precondition check on an already-documented action (Fill-Test Review Rule 28's "Package as Quiz"), not a new rule or schema change. Considered adding an explicit rule 28a documenting the content-completeness gate but held off — the existing Rule 38 (Hint's own no-content fallback) already documents why content matters here; this is enforcement of that, not new product behavior.
- 0_BUILD_CONVENTIONS.md: no.
- 0_PRODUCT_ROADMAP.md: no.
