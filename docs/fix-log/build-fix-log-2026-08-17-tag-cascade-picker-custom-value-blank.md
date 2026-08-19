---
title: Fix Log – 2026-08-17 – TagCascadePicker custom grade/unit/lesson value renders blank
---

## Context

Found live-testing `/words/add-paragraph` (Tier 1, Item I, Phase 1). Reported by the user as "the tag section won't let me add new values." Reproduced with a headless-Chromium driver against the running dev server + live dev Supabase project: selecting an existing textbook, then choosing "+ Enter custom value" for Grade, typing a new value, and confirming left the Grade `<select>` showing its placeholder — visually indistinguishable from the value never having been captured.

## Root Cause

`TagCascadePicker.tsx` (`src/app/words/shared/TagCascadePicker.tsx`) computes `gradeOptions`/`unitOptions`/`lessonOptions` solely from `lessonTags` — rows fetched from the database for the selected textbook. A custom value the parent just typed via "+ Enter custom value" is stored correctly in the component's own `grade`/`unit`/`lesson` React state (confirmed via DOM inspection: `<select>`'s underlying value was in fact the typed string), but isn't persisted to `lesson_tags` until the final Assign/submit step elsewhere — so it never appears in `lessonTags`, and the `<select>`'s `value` prop has no matching `<option>`. The browser renders that as blank.

`src/app/words/add/AddSection.tsx` has its own separate, older inline implementation of this same Textbook → Grade → Unit → Lesson cascade (predates `TagCascadePicker.tsx`) and already carries the fix for exactly this gap — an `appendSelectedOption(options, selectedValue)` helper that ensures the current value always has a matching option. `TagCascadePicker.tsx`, the newer shared component now used by `AddVocabPhraseSection`, Content Admin's phrase tagging, and this session's new `AddParagraphSection`, never received the equivalent fix. It was a pre-existing latent defect — not introduced by the Add Paragraph feature — that had apparently never been hit before (existing callers' manual testing evidently always used already-persisted grade/unit/lesson values, never a brand-new one through this specific component).

## Changes Applied

- `src/app/words/shared/TagCascadePicker.tsx` — added an exported `appendSelectedOption` helper (same logic as `AddSection.tsx`'s private copy) and applied it to `gradeOptions`, `unitOptions`, and `lessonOptions`.
- `src/app/words/shared/TagCascadePicker.test.ts` (new) — regression coverage for `appendSelectedOption`.

## Architectural Impact

None — UI-layer-only fix to a shared presentational component's option-list computation. No schema, RLS, route, or service-layer change.

## Preventative Rule

None new. Notable for future spec/build work: when a shared component duplicates logic from an older single-purpose implementation (here, `TagCascadePicker.tsx` re-implementing `AddSection.tsx`'s cascade), check the older implementation for fixes/edge-case handling it may already carry before assuming the newer shared version is complete.

## Verification

- Reproduced and confirmed fixed live: headless-Chromium driver against `npm run dev` + the live dev Supabase project (`.env.local`), signed in as the seeded platform-admin account, through `/words/add-paragraph` → paste → parse → drag-select a span → Add tags → select textbook → enter custom grade/unit/lesson values → confirmed each now renders correctly in its `<select>` → submitted → got "Added 1 item(s)." success notice → verified the new word/tag persisted (character rendered "known" on a subsequent parse).
- `npm test` — 653/653 pass (branch total, including the 6 new `appendSelectedOption` tests).
- `npm run typecheck` — clean.
- `npm run check:encoding` — clean.
- `npm run lint` — no new errors/warnings.

## Docs Updated

- AI_CONTRACT.md: no.
- 0_ARCHITECTURE.md: no — no behavioral rule changed, this is a rendering-correctness fix to an existing, already-documented tag-cascade interaction.
- 0_BUILD_CONVENTIONS.md: no.
- 0_PRODUCT_ROADMAP.md: yes — see updated item I verification status in this same commit.
