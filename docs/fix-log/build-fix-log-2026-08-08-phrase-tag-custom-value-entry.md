---
title: Fix Log – 2026-08-08 – Phrase Tag Cascade Missing Custom-Value Entry
---

## Context

After moving the phrase batch-add tag section to sit before the submit
button (matching the character add form's layout), the parent reported
that the Grade/Unit/Lesson fields in the phrase tag picker did not let
them add a new value — unlike the character tag section on the same page,
which offers an explicit "+ Enter custom value" option.

## Root Cause

`TagCascadePicker.tsx` (the shared component behind both `/words/add`'s
phrase batch section and Content Admin's phrase tagging) rendered
Grade/Unit/Lesson as `<input list=... />` + `<datalist>` combo boxes —
a different, more limited pattern than the character tag section in
`AddSection.tsx`, which uses a `<select>` populated with existing values
plus a `"+ Enter custom value"` option that switches to a dedicated
text-input + Create/Cancel affordance. The Textbook field already used the
`<select>` + create-mode pattern; Grade/Unit/Lesson never did — they were
never given the matching `customValueOption` string or create-mode UI in
the first place, so there was no discoverable way to add a new value that
didn't already exist in the cascade.

## Changes Applied

- `src/app/words/shared/TagCascadePicker.tsx`: replaced the Grade/Unit/Lesson
  `<input list>`/`<datalist>` combo boxes with the same `<select>` +
  `"__custom__"` create-mode pattern the character tag section
  (`AddSection.tsx`) already uses — a dropdown of existing values plus a
  `"+ Enter custom value"` option that reveals a text input with
  Create/Cancel buttons. Added `gradeCreateMode`/`unitCreateMode`/
  `lessonCreateMode` local state (mirroring `AddSection.tsx`) and
  `handleGradeChange`/`handleUnitChange`/`resetCascadeBelowTextbook` helpers
  so selecting a textbook, grade, or unit resets the levels below it and
  clears any in-progress create-mode input, exactly as the character form
  does.
- `TagCascadePickerStrings` gained a required `customValueOption` field
  (already present in `taggingStrings.add` for both locales — no new
  bilingual copy needed). Both callers (`AddVocabPhraseSection.tsx`,
  `VocabPhraseAdminSection.tsx`) now pass `tagStr.customValueOption`
  through.
- Removed the now-unused `useId` datalist-id plumbing.

## Architectural Impact

UI-layer only, confined to the shared `TagCascadePicker.tsx` component and
its two existing callers. No schema, RPC, RLS, or route changes. No change
to the component's public `mode`/`onAssign`/`onSelectionChange` contract
introduced in the prior phrase-tag-section-placement change — this fix only
changes how Grade/Unit/Lesson render internally.

## Preventative Rule

When a shared component is built to "mirror" an existing pattern
(`TagCascadePicker.tsx`'s own docstring claims this), verify field-by-field
parity against the original at build time — not just the overall shape.
Here the Textbook field was copied faithfully but Grade/Unit/Lesson quietly
became a different (input+datalist) pattern, which shipped without the
"add new" affordance the character form has always had.

## Docs Updated

- AI_CONTRACT.md: no — no boundary or hard-stop change.
- 0_ARCHITECTURE.md: no — no product rule, schema, or layer-boundary change.
- 0_BUILD_CONVENTIONS.md: no — no convention change.
- 0_PRODUCT_ROADMAP.md: no — still under item D's existing "Built" entry.
