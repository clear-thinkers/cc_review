---
title: Fix Log – 2026-08-20 – Packaged Session Quiz-Ready Count Reads 0 For Every Character
---

## Context

User report: after the 2026-08-19 "paragraph quiz runtime" update, every packaged review test session's quiz-ready count (可测汉字数) read 0, for every character, in every session — no fill test could be started. Screenshot showed a 25-character parent-specified session reading 0/25 ready.

## Root Cause

`toReviewTestSessionTarget` (`src/lib/supabase-service.ts:260`) was changed to build `target.key` as `` `${character}|${pronunciation}|${row.paragraph_span_id ?? ""}` `` for every target — widened so a paragraph-quiz blank's dedup key includes its span id. For an ordinary (non-paragraph) character target, `paragraph_span_id` is always `null` in the DB, so `target.key` now gets a trailing empty segment, e.g. `"好|hao3|"` instead of `"好|hao3"`.

`buildReviewTestSessionRuntime` (`src/app/words/review/reviewSession.utils.ts`) resolves each character target's saved flashcard content via `contentByKey.get(target.key)`, where `contentByKey` is built from `getAllFlashcardContents()` entries keyed by the *plain* `character|pronunciation` format (matching `flashcard_contents.id`, e.g. `"好|hao3"`). The widened key never matches, so `fillTestContentEntries` was always empty for every character target, `buildFillTestFromSavedContent([])` always returned `undefined`, and every character was silently pushed into `skippedQuizCharacters` instead of `quizWords` — collapsing `quizReadyCount` to 0 for every packaged session, regardless of how much curated content the family actually had.

Confirmed against the live dev Supabase project: a pre-existing session's 25 of 26 character targets had real `flashcard_contents` rows with `include_in_fill_test: true` phrases, proving this was a code regression and not a missing-content data issue.

Paragraph-quiz sessions themselves were unaffected (they resolve via the earlier `session.paragraphTestModeId` branch, never reaching this lookup), and phrase targets were unaffected (they resolve via `vocabPhraseId`, not `target.key`) — the bug was scoped entirely to ordinary character targets in packaged sessions, which is every non-paragraph, non-phrase quiz.

## Changes Applied

- `src/app/words/review/reviewSession.utils.ts`: the character-target content lookup now builds its own plain `` `${target.character}|${target.pronunciation}` `` key instead of using `target.key`, matching the format `contentByKey`/`flashcard_contents.id` actually use. `target.key` itself is untouched — it still correctly carries the paragraph-span suffix for the dedup role it plays in `normalizeReviewTestSessionDraftTargets` and the DB unique constraint.
- `src/app/words/review/reviewSession.utils.test.ts`: added a regression test that constructs a target with `key` in the real DB-round-trip shape (`"好|hao3|"`, trailing empty segment) and asserts `quizWords` still resolves — this is the shape the existing tests didn't cover, since they all hand-wrote targets with the old plain-format `key`.

## Architectural Impact

None — fix is confined to a single lookup inside `reviewSession.utils.ts`'s existing character-resolution branch. No layer boundary crossed, no schema/API change, no new abstraction.

## Preventative Rule

`target.key` is a dedup-only key (matches the DB's `(session_id, character, pronunciation, paragraph_span_id)` unique constraint); it must never be used to look up data in a map keyed by a *different* identity format (like `flashcard_contents.id`, which is `character|pronunciation` with no span component). When two different "key" concepts share a field name, derive the lookup key locally from its own source fields instead of reusing a key built for another purpose.

## Docs Updated
- AI_CONTRACT.md: no — no boundary/hard-stop change
- 0_ARCHITECTURE.md: no — no product-rule or schema change, existing Fill-Test Review Rules already describe the intended behavior correctly; this was a pure implementation bug
- 0_BUILD_CONVENTIONS.md: no — no convention change
- 0_PRODUCT_ROADMAP.md: no — not adding/changing scope, a straight bug fix in already-shipped Tier 1 functionality
