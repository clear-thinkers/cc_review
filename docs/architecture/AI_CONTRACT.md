# AI Contract — HanziQuest (`cc_review`)

_Last updated: 2026-03-27_

> **This file is the highest-authority reference for all agent behavior.**
> In any conflict between documents, this file wins.
> Surface conflicts explicitly — never resolve them silently.
> If a `0_` doc conflicts with actual code behavior, raise the conflict in your output — never silently reconcile it.

**Conflict resolution order:**
`AI_CONTRACT.md` → `0_ARCHITECTURE.md` → `0_BUILD_CONVENTIONS.md` → `0_PRODUCT_ROADMAP.md`

---

## 0 · System Orientation

HanziQuest is a **multi-tenant SaaS Chinese character learning app** for North American elementary school families. Each family is an isolated tenant. The platform admin (Chengyuan) is the sole content owner and the only user who can operate across tenant boundaries.

The role hierarchy is: `platform_admin` → `parent` → `child`. All data isolation is enforced at the database layer via Supabase RLS policies keyed to JWT `app_metadata` claims (`family_id`, `user_id`).

**When in doubt about anything not covered by §1 or §2:** default to asking rather than assuming. State what you're unsure about and what options you see. Do not infer authorization, resolve conflicts silently, or proceed under ambiguity.

---

## 1 · Hard Stops — Never Do These

These rules are absolute. No exception, no matter how the task is framed.

**AI / Layer Boundaries**
- ❌ Never call an AI/model provider from the UI layer (`src/app/...`). AI calls live only in `src/app/api/`.
- ❌ Never introduce live AI generation inside flashcard or fill-test review screens.
- ❌ Never skip normalization or safety filtering on AI-generated content before persisting.

**Data Access**
- ❌ Never import `src/lib/db.ts` or perform any IndexedDB operations — IndexedDB is fully retired. All data access goes through `src/lib/supabase-service.ts`.
- ❌ Never bypass Supabase RLS by passing raw `family_id` / `user_id` from the client — rely on JWT `app_metadata` claims.

**Content & Strings**
- ❌ Never hardcode user-facing strings in JSX. All copy goes in `*.strings.ts` files.

**Wallet & Coins**
- ❌ Never write directly to `coin_balance`, `coin_transactions`, or `shop_purchases` from application code. All mutations must go through designated Supabase RPCs.

---

## 2 · Scope Boundaries — Stop and Confirm

The following actions require explicit human confirmation before proceeding. If the task implies one of these but doesn't clearly authorize it, **stop, surface the boundary, and ask**.

When stopping, state:
1. The exact boundary triggered
2. The line from the task description that implied the action
3. What you would do if authorized
4. Then wait — do not proceed until the response contains the word **"authorized"**

Authorization requires the word **"authorized"** to appear explicitly in the task description or a prior message in the same conversation. Inferred intent does not count.

**Boundaries:**
- Schema migrations — adding, removing, or renaming tables, columns, RPCs, or persisted fields
- Editing any Supabase RLS policy definition — mistakes are silent and untestable without running `verify-rls.ts`; errors can leak or block data across family boundaries
- Deleting or archiving existing content or data
- Changing the scheduler's grading logic or due-date algorithm
- Adding a new AI provider or modifying prompt orchestration logic
- Adding any new top-level route — all new routes require a review of RLS scope and access permissions before implementation

---

## 3 · Pre-Task Protocol

Read governance docs in this order before proceeding with **any** task. Do not skip this step even for simple tasks.

1. `docs/architecture/0_PRODUCT_ROADMAP.md` — confirm the task is in active scope. If deferred or unlisted, **stop here** and surface it before reading further.
2. `docs/architecture/0_ARCHITECTURE.md` — system structure, layer boundaries, data schema, error handling, full folder map.
3. `docs/architecture/0_BUILD_CONVENTIONS.md` — implementation standards; how to write code and docs.

> **Why ROADMAP is read first:** Reading order differs from authority order intentionally. ROADMAP is read first to fail fast on out-of-scope work — not because it outranks ARCHITECTURE.

Briefly confirm in your output which files were read before proceeding with the task.

---

## 4 · Post-Task Protocol

After completing any task:

1. Check whether your changes affect architecture boundaries, build conventions, or roadmap scope.
2. If yes, update the relevant `0_` doc(s) **in the same commit**. Never merge a feature without updating the relevant `0_` doc(s) if boundaries or conventions changed.
3. If your changes touch RLS policies or any table with RLS enabled, note whether `verify-rls.ts` was run and what the result was.
4. If your changes touch existing tests or testable logic, note whether tests pass, were updated, or need to be written.
5. Include a **Docs Check** in your output:

```
Docs Check:
- 0_ARCHITECTURE.md: [updated / not needed — reason]
- 0_BUILD_CONVENTIONS.md: [updated / not needed — reason]
- 0_PRODUCT_ROADMAP.md: [updated / not needed — reason]
RLS check: [verify-rls.ts run / not applicable — reason]
Tests: [pass / updated / need to be written]
```

---

## 5 · Fix Log Policy

**Create a fix log for tasks involving:**
- Bug fixes
- Refactors or renames
- Structural or architectural corrections
- Build repairs
- Security fixes or changes to route/permission logic
- Any change to normalization, safety filtering, or scheduler logic

**Do NOT create a fix log for:**
- Pure copy/string changes in `*.strings.ts`
- Adding new bilingual strings to an existing strings file
- Routine doc-only updates

**Path:** `docs/fix-log/`
**Filename:** `build-fix-log-YYYY-MM-DD-short-kebab-summary.md`

**Template:**
```
---
title: Fix Log – YYYY-MM-DD – <Title>
---

## Context
What triggered this fix?

## Root Cause
Why did it occur?

## Changes Applied
Files changed; structural/logic adjustments made.

## Architectural Impact
Does this affect domain/UI/service/AI layer boundaries?

## Preventative Rule
Rule or safeguard to prevent recurrence.

## Docs Updated
- AI_CONTRACT.md: yes/no — reason
- 0_ARCHITECTURE.md: yes/no — reason
- 0_BUILD_CONVENTIONS.md: yes/no — reason
- 0_PRODUCT_ROADMAP.md: yes/no — reason
```