---
title: Fix Log – 2026-08-19 – Prep Fill Test eligibility wrongly scoped to "already a span on this paragraph"
---

## Context

User-reported while testing Phase 2 (`docs/fix-log/build-fix-log-2026-08-18-paragraph-library-test-mode-prep.md`), with a screenshot: "身材魁梧 has content but is greyed out in the text. It is enabled in a different paragraph from which it was first imported, but should be eligible for this paragraph too."

## Root Cause

`classifyTokenEligibility` (`TestModeBlankSelector.tsx`) required a token to already match a persisted `ParagraphSpan` on the *specific paragraph being viewed* before it counted as "eligible" — a known word/phrase that existed in `words`/`vocab_phrases` (curated, real content, already used successfully in a different paragraph's test mode) but had never been explicitly selected via Import/Continue Import *on this particular paragraph* rendered as "known, not eligible" (gray, inert) instead of "eligible" (green, clickable).

This was a deliberate design decision made earlier in the same build (see the spec's now-superseded "Implicitly adding a new span... Prep Fill Test only ever selects among already-eligible, already-persisted spans" bullet), reasoned as keeping Continue Import and Prep Fill Test cleanly separated. In practice it was wrong: whether a word is *testable* has nothing to do with which paragraph's import flow happened to select it first. The user's screenshot is the concrete case — a phrase with real curated content, demonstrably already in productive use elsewhere, blocked from testing here for no real reason, requiring a pointless "go re-import the same phrase into this paragraph too" step.

## Changes Applied

- `src/app/words/add-paragraph/TestModeBlankSelector.tsx`:
  - `classifyTokenEligibility` — now returns `"eligible"` for any token known to the family at all; `"ineligible"` only when a persisted span on this paragraph is explicitly flagged `fillTestEligible: false` (still unreachable in practice — nothing sets it false — but now the semantically correct trigger rather than "not yet a span here").
  - Added `computeSpanId`/`parseSpanId` (the same deterministic `s{sentenceIndex}-{startOffset}-{endOffset}` id format `addParagraphIngestion.ts` already assigns real spans) so a not-yet-persisted eligible token has a stable, addressable id before it's ever saved.
  - Added `resolvePendingSpan` — re-derives a full `ParagraphSpan` for a given id by re-running token classification at that position, used to materialize a real span from a selection that wasn't backed by one.
  - Added `mergePendingSpansIntoSentences` — groups newly-materialized spans by sentence and appends them, a sibling to `addParagraphIngestion.ts`'s `mergeResolvedSpansIntoSentences`.
  - Rendering and the word-bank position map now key selection state off `computeSpanId` for every eligible token (falling back to the real span's id when one already exists), not just tokens that already had one.
- `src/app/words/add-paragraph/TestModeSection.tsx`:
  - `handleSave` now diffs `formSpanIds` against the paragraph's currently-persisted span ids, resolves and merges any that are missing via the new helpers, persists via `updateParagraph` (updating `vm.paragraphs`), and only then creates/updates the test mode — restoring the implicit-materialization path removed earlier in this same build.
  - `eligibleSpanCount` (gating whether "+ New Test Mode" is even offered) now counts via live token classification instead of only counting already-persisted, already-flagged spans, matching the corrected eligibility rule.
- `src/app/words/add-paragraph/TestModeBlankSelector.test.ts` — updated the two assertions that encoded the old (wrong) behavior; added coverage for `computeSpanId`/`parseSpanId`/`resolvePendingSpan`/`mergePendingSpansIntoSentences`.
- `docs/feature-specs/2026-08-17-paragraph-fill-test.md` and `docs/architecture/0_ARCHITECTURE.md` (Add Paragraph Rules 17–18) updated in place with a dated correction note, rather than pretending the spec always said this.

## Architectural Impact

None structural — no schema change (`paragraph_test_modes.span_ids` always could and still does only ever reference real `ParagraphSpan.id`s; the fix is *when* a span gets materialized, at test-mode-save time rather than requiring it to already exist). UI/domain-layer logic only.

## Preventative Rule

When a "have I done X already" check is scoped to a narrower unit than the resource the check is actually about (here: "is this word trackable *on this paragraph*" when the real question is "is this word known *to the family*"), verify the narrower scope is actually load-bearing before shipping it — it wasn't here, and produced a confusing, blocking UX with no corresponding benefit.

## Verification

- Reproduced and confirmed fixed live: seeded a `vocab_phrases` row via the service role (simulating "curated, already known, imported through a different paragraph"), imported a brand-new paragraph containing that phrase *without* selecting it, opened Prep Fill Test — confirmed the phrase now renders `(Eligible)` and is clickable; carved it out and saved a test mode referencing it, confirming the materialize-then-save path works end to end (`Test mode saved.`, no errors).
- `npm test` — 705/705 pass (11 new assertions for the newly-exported helpers, 2 corrected).
- `npm run typecheck` / `npm run lint` / `npm run check:encoding` — clean, no new issues.

## Docs Updated

- AI_CONTRACT.md: no.
- 0_ARCHITECTURE.md: yes — Add Paragraph Rules 17–18 corrected in place with a dated note, not silently rewritten.
- 0_BUILD_CONVENTIONS.md: no.
- 0_PRODUCT_ROADMAP.md: no — this is a within-phase correction, not a new milestone; item I's existing Phase 2 entry stands.
