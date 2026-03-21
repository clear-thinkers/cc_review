# Feature Spec — 2026-03-21 — Content Admin Row Deletion

## Status: Shipped 2026-03-21

## Problem

The Content Admin page currently offers a single target-level delete action that removes saved `flashcard_contents` for a `character|pronunciation` pair, but the row itself reappears as an empty target because admin targets are derived from `words` plus dictionary pronunciations.

Users need a second destructive action that deletes the entire Content Admin row for a specific `character|pronunciation` pair and keeps it hidden across refreshes.

## Scope

- Add a new persistent family-scoped hidden-target record for Content Admin rows.
- Split target-level destructive actions into:
  - clear saved content only
  - delete row entirely from Content Admin
- Add confirmation only to the new row-delete action.
- Prevent deleting the last remaining pronunciation row for a character.
- Restore deleted admin rows when the same Hanzi is re-added on the Add Characters page.

## Out of scope

- Deleting the underlying `words` record
- Adding a dedicated restore UI
- Changing phrase/example row deletion behavior
- Changing scheduler, review, or quiz semantics

## Proposed behavior

- Current target-level `D/删` becomes `C/清` and clears saved content only.
- New target-level `D/删` deletes the entire Content Admin row for that `character|pronunciation`.
- Clicking the new row-delete button opens a confirmation dialog.
- If the target is the last remaining pronunciation row for that character, deletion is blocked and a popup tells the user to delete the character from the All Characters page instead.
- Confirmed row deletion:
  - deletes saved `flashcard_contents` for that target
  - inserts or preserves a hidden-target record for that family/character/pronunciation
  - removes the target from the current table immediately
- Re-adding a Hanzi on `/words/add` clears hidden-target records for that Hanzi across all pronunciations in the current family.

## Layer impact

- UI: Content Admin action pills, confirmation dialog, notices, and empty-state messaging
- Domain/UI state: admin target derivation excludes hidden targets; add flow restores hidden targets
- Service: new hidden-target read/write/delete helpers and row-delete business action
- Database: new `hidden_admin_targets` table with family-scoped RLS

## Edge cases

- Deleting a row with no saved content still hides the row successfully.
- Deleting the same row twice is idempotent.
- Cancelling the confirmation makes no changes.
- Deleting the last remaining pronunciation row for a character is blocked.
- Re-adding an already-existing Hanzi still restores hidden targets even if no new `words` row is inserted.
- If deleting the last row on a page, pagination clamps to the nearest valid page.
- If all admin rows are deleted but words still exist, the page should show a restore-oriented empty message instead of “Add characters first.”

## Risks

- Confusing row deletion with content clearing if labels/tooltips remain ambiguous
- Hidden targets drifting from admin target derivation if filtering is applied only in UI and not in shared state
- Restore path failing for existing Hanzi if hidden-target cleanup is tied only to newly inserted words

## Test Plan

- Service test: deleting an admin row inserts/retains hidden-target state and deletes matching `flashcard_contents`
- Service test: row deletion is idempotent
- Service test: restoring by Hanzi removes hidden targets for all pronunciations of submitted Hanzi
- Admin strings parity test for new EN/ZH action, tooltip, message, and confirmation keys
- Admin types test for new hidden-target type
- Manual verification:
- clear content leaves row visible
- delete row prompts for confirmation
- delete last pronunciation shows the blocking popup and makes no changes
- cancel leaves row unchanged
- confirm removes row immediately
  - re-adding the Hanzi restores deleted pronunciations on Content Admin

## Acceptance criteria

- Content Admin shows separate `C/清` and `D/删` target-level pills.
- The new `D/删` action shows a confirmation popup before mutation.
- The new `D/删` action is blocked when it would remove the last remaining pronunciation for a character.
- After confirmation, the target row disappears from Content Admin and stays hidden after refresh.
- The old content-clear action no longer hides the row.
- Re-adding the Hanzi restores hidden Content Admin rows for that character.
- New behavior is documented in `0_ARCHITECTURE.md`.

## Open questions

- None. This spec uses the confirmed decisions:
  - row deletion is implemented as persistent hiding, not `words` deletion
  - the existing delete-content pill becomes `C/清`
  - the new row-delete pill becomes `D/删`
  - restore happens through re-adding the Hanzi
