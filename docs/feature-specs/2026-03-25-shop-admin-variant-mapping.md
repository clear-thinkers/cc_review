# Feature Spec — 2026-03-25 — Shop Admin Variant Mapping

## Problem

Platform admin can currently edit special ingredient labels and notes, but cannot configure which special ingredient combinations map to each food variant icon from the main shop admin UI.

## Scope

- Allow shop admin to edit the `match` arrays inside `variant_icon_rules`
- Support many-to-one mappings such as `["chocolate", "sprinkles"]`
- Keep variant icon paths visible in admin UI
- Save variant mapping changes through the existing shop admin recipe save flow

## Out of scope

- Creating or deleting variant image assets
- Inferring mappings from the filesystem at runtime
- Changing child-facing recipe rendering logic
- Replacing the debug reward icon maintenance screen

## Proposed behavior

- Each variant icon card in shop admin shows its current mapped special ingredient keys
- For non-plain variants, admin can toggle multiple special ingredient keys onto the same card
- Plain variants remain the empty-match fallback and are not assigned special ingredient keys
- Saving recipe metadata also saves updated variant mappings
- Validation rejects duplicate match combinations and unknown special ingredient keys

## Layer impact

- UI: add editable variant mapping controls to shop admin
- Domain: extend shop admin draft normalization and validation for `variantIconRules`
- Service: update the shop admin recipe PATCH route to persist variant mappings

## Edge cases

- Recipe has no special ingredient options
- Recipe has only a plain variant
- Two variant cards are assigned the same ingredient combination
- Variant card references an ingredient key that no longer exists in special slots
- Match arrays arrive unsorted or with duplicates

## Risks

- Invalid duplicate mappings could make variant resolution ambiguous
- Editing plain-rule matches could break fallback icon behavior
- Special ingredient labels can change while the underlying option keys remain stable

## Test Plan

- Validate duplicate and unknown variant match keys are rejected
- Validate variant matches are normalized and preserved in draft equality checks
- Verify many-to-one combinations save and return in the updated recipe payload shape

## Acceptance criteria

- Admin can assign more than one special ingredient key to a single variant icon
- Combo mappings persist after save and reload
- Existing runtime variant resolution continues to work without code changes
- Plain/fallback variant behavior remains intact

## Open questions

- Should admin also be able to create entirely new variant rules from this screen later, or is editing existing asset-backed rules enough for now?
