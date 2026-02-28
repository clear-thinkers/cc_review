# AI Contract

_Last updated: 2026-02-27_

> **This file is the highest-authority reference for all agent behavior.**
> In any conflict between documents, this file wins.
> Surface conflicts explicitly — never resolve them silently.

---

## 1 · Pre-Task (Required)

Read in this order before proceeding with any task:

1. `AI_CONTRACT.md` — agent rules, hard stops, authority hierarchy, fix log policy (this file)
2. `docs/architecture/0_ARCHITECTURE.md` — system structure, layer boundaries, data schema, error handling, full folder map
3. `docs/architecture/0_BUILD_CONVENTIONS.md` — implementation standards, how to write code and docs
4. `docs/architecture/0_PRODUCT_ROADMAP.md` — what is active, what is deferred

> **Conflict resolution order:** `AI_CONTRACT.md` → `0_ARCHITECTURE.md` → `0_BUILD_CONVENTIONS.md` → `0_PRODUCT_ROADMAP.md`
> If a `0_` doc conflicts with actual code behavior, raise the conflict in your output — do not silently resolve it.

---

## 2 · Hard Stops — Never Do These

These rules are absolute. No exception, no matter how the task is framed:

- ❌ Never call an AI/model provider from the UI layer (`src/app/...`). AI calls live only in `src/app/api/`.
- ❌ Never skip normalization or safety filtering on AI-generated content before persisting.
- ❌ Never introduce live AI generation inside flashcard or fill-test review screens.
- ❌ Never change scheduler grading logic without an explicit instruction to do so.
- ❌ Never import `src/lib/db.ts` or perform direct IndexedDB operations inside an API route; always go through service/domain functions to preserve the layer boundary.
- ❌ Never hardcode user-facing strings in JSX. All copy goes in `*.strings.ts` files.
- ❌ Never delete or migrate IndexedDB schema without explicit human confirmation.
- ❌ Never merge a feature without updating the relevant `0_` doc(s) if boundaries or conventions changed.

---

## 3 · Scope Boundaries — Confirm Before Acting

These actions require explicit human confirmation before proceeding:

- Schema migrations (adding/removing/renaming IndexedDB tables or fields)
- Deleting or archiving any existing content or data
- Changing the scheduler's due-date algorithm or grade-tier mappings
- Adding a new AI provider or modifying prompt orchestration logic
- Creating new top-level routes outside `src/app/words/`

If the task description implies one of these but doesn't explicitly authorize it, stop and ask.

---

## 4 · Post-Task (Required)

After completing any task:

1. Check whether your changes affect architecture boundaries, build conventions, or roadmap scope.
2. If yes, update the relevant `0_` doc(s) **in the same commit**.
3. Include a **Docs Check** summary in your output listing which docs were or were not updated and why.

---

## 5 · Fix Log Policy

**Create a fix log for any task involving:**
- Bug fixes
- Refactors or renames
- Structural or architectural corrections
- Build repairs
- Regression prevention
- Any change to normalization, safety filtering, or scheduler logic

**Do NOT create a fix log for:**
- Pure copy/string changes in `*.strings.ts`
- Adding new bilingual strings to an existing strings file
- Routine doc-only updates

**Path:** `docs/fix-log/`
**Filename:** `build-fix-log-YYYY-MM-DD-short-kebab-summary.md`

```markdown
# Fix Log – YYYY-MM-DD – <Title>

## Context
<!-- What triggered this fix? -->

## Root Cause
<!-- Why did it occur? -->

## Changes Applied
<!-- Files changed, structural/logic adjustments -->

## Architectural Impact
<!-- Does this affect domain/UI/service/AI layer boundaries? -->

## Preventative Rule
<!-- Rule or safeguard to prevent recurrence -->

## Docs Updated
- AI_CONTRACT.md: yes/no — reason
- 0_ARCHITECTURE.md: yes/no — reason
- 0_BUILD_CONVENTIONS.md: yes/no — reason
- 0_PRODUCT_ROADMAP.md: yes/no — reason
```