---
title: Fix Log – 2026-08-20 – Paragraph Quiz Word Bank Duplicate Entry and Freeze
---

## Context

User reported that while taking a paragraph quiz (`/words/review/fill-test`'s `ParagraphQuizReviewSection.tsx`), the word "帮助" appeared duplicated in the per-page word bank, and the quiz page subsequently froze mid-interaction (during a drag gesture, per the user's screenshot).

## Root Cause

`mergePendingSpansIntoSentences` (`src/app/words/add-paragraph/TestModeBlankSelector.tsx`), called from `TestModeSection.tsx`'s `handleSave` to persist a not-yet-tracked eligible token before a test mode references it, appended every materialized span onto a sentence's existing `spans[]` array with no check for an id already present. `computeSpanId` is deterministic (a pure function of sentence index + character offsets), so re-materializing the *same* not-yet-persisted token a second time — e.g. saving a test mode again before local `vm.paragraphs` state had refreshed from the first save, or a second test mode on the same paragraph independently selecting the same not-yet-tracked token — silently inserted a second `ParagraphSpan` object sharing the first one's `id`.

Downstream, `resolveParagraphQuizBlanks` (`src/lib/paragraphQuizBuilder.ts`) filtered a sentence's `spans` by set-membership without deduplicating by id, so the duplicated span produced two identical `ParagraphQuizBlank` entries with the same `spanId`. Both flowed into `page.bankSpanIds`, and `ParagraphQuizReviewSection.tsx` rendered two word-bank `<button>` elements keyed by `blank.spanId` — the same React key twice. Two elements sharing one key while one of them is the target of a live native HTML5 drag operation (`draggable`/`onDragStart`/`onDrop`) is a known trigger for React reconciling/reusing the wrong DOM node mid-drag, which can leave the browser's native drag state stuck — the reported freeze.

## Changes Applied

- `src/app/words/add-paragraph/TestModeBlankSelector.tsx` — `mergePendingSpansIntoSentences` now skips any new span whose id already exists in that sentence's current `spans[]`, making the merge idempotent. A sentence with no genuinely-new spans to add is returned unchanged (same object reference) rather than a needlessly-cloned copy.
- `src/lib/paragraphQuizBuilder.ts` — `resolveParagraphQuizBlanks` now also dedupes by span id defensively at the runtime-resolution layer, so a paragraph that already has a duplicated span persisted from before this fix (or any other unforeseen source of a duplicate) can never produce two blanks sharing one spanId/React key. This is a belt-and-suspenders fix independent of the source-side one above, matching this codebase's existing skip-invalid-silently precedent (`resultsReviewTestSession.ts`, `paragraphLibrary.ts`).
- Tests added: `src/lib/paragraphQuizBuilder.test.ts` (`resolveParagraphQuizBlanks` collapses a duplicated span id to one blank) and `src/app/words/add-paragraph/TestModeBlankSelector.test.ts` (`mergePendingSpansIntoSentences` skips a new span whose id already exists on that sentence).

## Architectural Impact

UI/domain-layer only. `TestModeBlankSelector.tsx`'s merge helper lives in the UI feature folder per `0_BUILD_CONVENTIONS.md §5` but is a pure function; `paragraphQuizBuilder.ts` is the existing domain-layer module for this feature (no `src/app/**` imports). No schema, RPC, RLS, or service-layer changes — this is a pure in-memory data-shape correctness fix on both sides of an existing, already-shipped feature (Item I, Phase 2/3).

## Preventative Rule

Any merge/append operation building a collection keyed by a deterministic, re-derivable id (here: `computeSpanId`, a pure function of position) must be idempotent against its own id — check for an existing entry before appending, never assume the caller only invokes it once per id. Any UI list rendered with `key={someId}` that is fed by data assembled through more than one path (persisted state + a pending/materialized addition, as here) should also defend at the render/consumption layer by deduplicating on that same id, not rely solely on the producer never emitting a duplicate — a corrupted-data safety net for existing rows, not just new ones.

## Verification

- `npx vitest run src/lib/paragraphQuizBuilder.test.ts src/app/words/add-paragraph/TestModeBlankSelector.test.ts` — new tests pass (45/45 in those two files).
- `npm test` — 769/769 pass (762 pre-existing + 7 new).
- `npx tsc --noEmit` — clean.
- `npx eslint` on all four changed/touched files — clean.
- `npm run check:encoding` — passes.
- Not re-verified live in-browser by the implementing session (no browser-automation tool available here); the root cause (duplicate span materialization → duplicate React key → stuck native drag) was traced statically from code, not confirmed against a live Supabase project's actual paragraph data. The user should confirm the fix resolves it the same way they reproduced it.

## Docs Updated

- AI_CONTRACT.md: no — no hard-stop, boundary, or layer-crossing behavior involved.
- 0_ARCHITECTURE.md: no — this corrects an implementation bug in already-documented behavior (Add Paragraph Rule 18's "materializes one first" step, Fill-Test Review Rule 30's word-bank rendering); no documented rule changed.
- 0_BUILD_CONVENTIONS.md: no — no new convention introduced.
- 0_PRODUCT_ROADMAP.md: no — Item I is already tracked as shipped; this is a bug fix within existing shipped scope.
