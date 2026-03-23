# Feature Spec - 2026-03-10 - All Characters Batch Tag Editing

## Problem
The All Characters page currently displays existing tags but does not allow users to add/edit tags directly. Users need to tag multiple words at once from the table.

## Scope
- Add row multi-select controls on `/words/all` for non-child users.
- Add a tag editor panel on `/words/all` using existing 4-level cascade fields (Textbook, Grade, Unit, Lesson).
- Allow batch save to assign the selected tag to all selected words using existing Supabase service functions.
- Refresh tag pills and keep existing sorting/filtering behavior.

## Out of scope
- Removing existing tags from words.
- Editing tag labels or textbook metadata globally.
- Child-role permission changes.
- Admin-page tagging behavior changes.

## Proposed behavior
- Non-child users can select one or many rows via checkbox controls.
- A batch tag panel appears on the All Characters page.
- User selects textbook/grade/unit/lesson and clicks save.
- Save creates the lesson tag if needed and assigns it to all selected word IDs.
- Success/error notices are shown via existing form notice area.

## Layer impact
- UI: `src/app/words/all/AllWordsSection.tsx`
- Shared state/view model: `src/app/words/shared/words.shared.state.ts`, `src/app/words/shared/state/useWordsBaseState.ts`
- Service: reuse existing functions (`listTextbooks`, `listLessonTags`, `createTextbook`, `createLessonTagIfNew`, `assignWordLessonTags`), no schema change.

## Edge cases
- Save with zero selected rows should show notice and do nothing.
- Incomplete cascade selection should be blocked with localized validation message.
- Existing tag assignments should be deduped by service upsert behavior.

## Risks
- UI complexity in table row actions and selection state.
- Potential mismatch between selected IDs and sorted/filtered visible rows.

## Test Plan
- Unit test helper logic for selection toggles and validation in shared state.
- Manual verification:
  - Select multiple rows and save one tag.
  - Verify pills update after save.
  - Verify child users cannot see tag editing controls.

## Acceptance criteria
- Non-child users can select multiple words and assign a tag in one save action.
- Table header/actions remain bilingual and role-restricted.
- Existing data model and RLS behavior remain unchanged.

## Open questions
- Whether future iteration should support unassign/removal of tags in batch.
