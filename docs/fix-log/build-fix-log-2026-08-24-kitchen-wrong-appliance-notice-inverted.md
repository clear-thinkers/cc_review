---
title: Fix Log – 2026-08-24 – Kitchen wrong-appliance notice names the wrong appliance
---

## Context

Reported via a screenshot from `/words/shop/kitchen`: clicking the stovetop for a
recipe that actually needs the oven ("Bubble Tea") produced the notice "Bubble Tea
needs the Oven, not this one." — the recipe requires the **stovetop**, so the
notice named the exact opposite of the appliance the child should actually use.

## Root Cause

In `KitchenSection.tsx`'s `handleCook(method)`, the mismatch-notice branch built
`applianceLabel` from `method` — the appliance the child just clicked (and got
wrong) — instead of from `selectedRecipe.cookMethod` — the recipe's actual
required appliance:

```ts
if (selectedRecipe.cookMethod !== method) {
  const applianceLabel = method === "stove" ? str.stovetopLabel : str.ovenLabel;
  // ...text: "{title} needs the {appliance}, not this one."
```

Since `method` is guaranteed to differ from `selectedRecipe.cookMethod` inside this
branch, the notice always named the wrong appliance — the one the recipe does
*not* need.

## Changes Applied

- `src/app/words/shop/kitchen/kitchen.types.ts`: added a pure helper
  `resolveApplianceLabel(cookMethod, labels)` that maps a recipe's own
  `cookMethod` to its localized label.
- `src/app/words/shop/kitchen/KitchenSection.tsx`:
  - `handleCook`'s mismatch branch now derives `applianceLabel` from
    `selectedRecipe.cookMethod` via `resolveApplianceLabel`, not from the
    clicked `method`.
  - The recipe-book list's existing inline `cookMethod === "stove" ? ... : ...`
    ternary (which was already correct) was switched to the same shared helper
    to remove the duplicated mapping.
- `src/app/words/shop/kitchen/kitchen.test.ts`: added a unit test for
  `resolveApplianceLabel` covering both cook methods.

## Architectural Impact

None — pure UI-layer logic fix within `src/app/words/shop/kitchen/`. No schema,
RLS, RPC, or API surface touched.

## Preventative Rule

When building a "you did X, but Y was required" notice, always source the
"required" half from the domain/target's own field, never from the user's
just-rejected input — the two are the same only in the success path, and this
mismatch branch is by definition the failure path, so mistakenly reusing the
rejected value silently states the exact opposite of the truth without ever
throwing or failing type checks.

## Docs Updated
- AI_CONTRACT.md: no — no boundary or hard-stop change
- 0_ARCHITECTURE.md: no — existing Shop Kitchen rules already describe correct
  per-recipe `cookMethod` gating; this was an implementation bug against those
  rules, not a rule change
- 0_BUILD_CONVENTIONS.md: no — no convention change
- 0_PRODUCT_ROADMAP.md: no — item J status already notes live-QA is pending;
  this fix doesn't change that status
