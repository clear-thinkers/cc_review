---
name: hanziquest-bug-fix
description: >
  Use this skill for any bug fix task in the HanziQuest (`cc_review`) codebase.
  Covers: pre-task gate checks, scope boundary evaluation, hard stop enforcement,
  fix implementation standards, test requirements, fix log creation, and post-task
  doc update protocol. Derived from AI_CONTRACT.md, 0_ARCHITECTURE.md,
  0_BUILD_CONVENTIONS.md, and 0_PRODUCT_ROADMAP.md.
---

# Bug Fix Skill — HanziQuest (`cc_review`)

Follow every section in order. Do not skip steps, even for small fixes.

---

## Step 1 · Read Governance Files

Read these four files before doing anything else:

1. `docs/architecture/AI_CONTRACT.md`
2. `docs/architecture/0_ARCHITECTURE.md`
3. `docs/architecture/0_BUILD_CONVENTIONS.md`
4. `docs/architecture/0_PRODUCT_ROADMAP.md`

Confirm in your output which files were read before proceeding.

---

## Step 1b · Check for a Prior Fix Attempt

Before any analysis, scan `docs/fix-log/` for an existing fix log whose title or filename matches this bug.

**If a prior fix log exists:**
- Read it in full.
- Identify what was attempted, what failed, and what the prior root cause diagnosis was.
- State in your output:
  1. The filename of the prior log found.
  2. What the prior attempt tried.
  3. Why it is believed to have failed (if recorded).
  4. How your current approach differs.
- You will **append** to the existing log in Step 9 — do not create a new file.

**If no prior fix log exists:**
- Note this and continue. You will create a new log in Step 9.

---

## Step 2 · Scope Gate

Check `0_PRODUCT_ROADMAP.md §1 · Active Work`.

- If the area being fixed is in **§2 Deferred** or clearly out of scope, **stop and surface this** before proceeding.
- Bug fixes in shipped/active features are in scope by default; fixes that require touching deferred features are not.

---

## Step 3 · Hard Stop Check

Before writing any code, verify the fix does **not** require any of the following.
These are absolute — no exception regardless of how the task is framed.

| Rule | Source |
|---|---|
| ❌ No direct writes to `coin_balance`, `coin_transactions`, or `shop_purchases` — use RPCs only | AI_CONTRACT.md §1 |
| ❌ No import of `src/lib/db.ts` or any IndexedDB operation — it is fully retired | AI_CONTRACT.md §1 |
| ❌ No AI/model provider calls from `src/app/...` (UI layer) — AI calls live in `src/app/api/` only | AI_CONTRACT.md §1 |
| ❌ No bypassing Supabase RLS by passing raw `family_id`/`user_id` from the client | AI_CONTRACT.md §1 |
| ❌ No hardcoded user-facing strings in JSX — all copy goes in `*.strings.ts` files | AI_CONTRACT.md §1 |
| ❌ No live AI generation inside flashcard or fill-test review screens | AI_CONTRACT.md §1 |
| ❌ No skipping normalization/safety filtering on AI-generated content before persisting | AI_CONTRACT.md §1 |
| ❌ No merging without updating affected `0_` doc(s) if the fix changes boundaries or conventions | AI_CONTRACT.md §1 |

If your fix would require crossing any hard stop: **halt and tell the user why you cannot proceed**.

---

## Step 4 · Scope Boundary Check

The following actions require **explicit human confirmation** before proceeding.
If the fix implies one of these but the task doesn't clearly authorize it, **stop now**.

When stopping, state:
1. The exact boundary triggered
2. The line in the task description that implied the action
3. What you would do if authorized
4. Wait for the word **"authorized"** in the response before continuing

**Boundaries that require confirmation:**
- Schema migrations (adding, removing, or renaming tables, columns, RPCs, or persisted fields)
- Editing any Supabase RLS policy definition
- Deleting or archiving existing content or data
- Changing scheduler grading logic or due-date algorithm
- Adding a new AI provider or modifying prompt orchestration logic
- Adding a new top-level route that requires new RLS policies

**Note on schema changes in bug fixes:**
If the root cause is a schema or RLS error, the fix must go through the scope boundary gate above AND requires a feature spec per `0_BUILD_CONVENTIONS.md §1` before implementation.

---

## Step 5 · Spec Requirement Check

| Fix type | Spec required? |
|---|---|
| Bug fix with no schema or API surface changes | ❌ No |
| Bug fix that requires a new or modified DB field, RPC, table, or API route | ✅ Yes — draft spec first (`docs/feature-specs/YYYY-MM-DD-name.md`) |

If a spec is required, draft it before writing any code. Template is in `0_BUILD_CONVENTIONS.md §1`.

---

## Step 6 · Diagnose Before Touching Code

Before writing any fix:

1. Identify the **root cause** — not just the symptom.
2. Identify which **layer** the bug lives in:
   - `src/app/...` → UI layer
   - `src/lib/scheduler.ts`, `src/lib/fillTest.ts`, `src/lib/flashcardLlm.ts` → Domain layer
   - `src/lib/supabase-service.ts`, `src/lib/supabaseClient.ts` → Service layer
   - `src/app/api/...` → AI/API layer
3. Confirm the fix stays **within that layer's responsibility**. Do not move logic across layer boundaries to achieve a quick fix — that is an architectural violation.
4. Check `0_ARCHITECTURE.md §4 System Guarantees` — confirm the fix does not violate a system guarantee.
5. Check `0_ARCHITECTURE.md §5 Error Handling` — confirm the fix uses the required error behavior for the failure mode, not an improvised alternative.

State your diagnosis in your output before applying changes.

---

## Step 7 · Implementation Rules

All changes must comply with:

**TypeScript**
- `strict: true` is non-negotiable — never disable it or add suppressions without a comment explaining why.
- No `any` types. Use `unknown` + narrowing or a proper interface.
- All exported functions must have explicit return type annotations.
- No `@ts-ignore` or `@ts-expect-error` without an explanatory comment.
- No `console.log` — remove before PR.

**Strings**
- Never write string literals in JSX. Source from the relevant `*.strings.ts` file.
- If the fix adds new user-facing copy, add it to both `en` and `zh` key sets. Build fails on mismatch.

**Styling (if the fix touches UI)**
- Tailwind CSS only. No `style={{}}`. No new CSS modules (see `0_BUILD_CONVENTIONS.md §7` for the two allowed exceptions).
- Use semantic button classes from `globals.css`: `btn-primary`, `btn-secondary`, `btn-caution`, `btn-confirm`, `btn-neutral`, `btn-destructive`, `btn-nav`, `btn-toggle-on`.
- Read `docs/architecture/style-ref.md` before writing any styled component.

**Data access**
- All database operations must go through `src/lib/supabase-service.ts`. No direct Supabase client calls from UI components.
- RLS scoping is handled via JWT `app_metadata` claims — never pass `family_id`/`user_id` as raw client values to bypass it.

**Normalization**
- Any fix touching content persistence must preserve the normalization pipeline in `src/lib/flashcardLlm.ts`. Fixes must drop bad content — not pass it through.

---

## Step 7b · Deploy Migration (if the fix includes a migration file)

If a migration file was written as part of this fix, it must be applied to the remote database before the fix is complete.
Mocked RPC tests confirm the service-layer contract only — they cannot detect whether the live Postgres function has been updated.

**Steps:**

1. Verify the migration is pending (not yet applied):
   ```bash
   supabase migration list
   ```
   Confirm the new migration appears in the "not applied" column.

2. Push all pending migrations with user approval:
   ```bash
   supabase db push --include-all
   ```
   This will prompt for confirmation before executing. Wait for explicit user approval before running.

3. After push completes, re-run `supabase migration list` and confirm the migration now shows as applied.

**If `supabase migration list` fails or `config.toml` is missing:**
- Stop and tell the user the CLI is not linked to the project.
- Provide the migration SQL inline so the user can apply it manually via the Supabase dashboard SQL editor.
- Document in the fix log that deployment was blocked and what manual step is needed.

**Note:** `supabase db push` requires a valid `SUPABASE_ACCESS_TOKEN` (set via `supabase login` or env var) and `supabase/config.toml` with `project_id` present.

---

## Step 8 · Tests

Every bug fix must include or update tests before it is considered done.

| What was fixed | Test requirement |
|---|---|
| Domain logic in `src/lib/` | Unit test — happy path, the bug scenario, edge cases |
| Normalization or safety filtering | Test that malformed/unsafe input is dropped, not passed through |
| API route | Integration test — success and error response |
| Scheduler logic | Unit test each affected grade tier — verify `nextReviewAt` and `interval` |
| UI component bug | Test at the closest seam: extracted helper > focused subcomponent > smoke test (last resort) |

**Mocking rules:**
- Mock the Supabase client and RPC boundaries — never hit live data.
- Mock AI provider calls — never make real network calls in tests.
- Do not mock `src/lib/` when testing UI components.

Run `npm test` and confirm all existing tests pass alongside the new ones. Run `npm run check:encoding` before opening a PR.

---

## Step 9 · Fix Log

A fix log is mandatory for every bug fix. Whether you create a new one or append to an existing one depends on Step 1b.

---

### Path A — No prior fix log (first attempt)

Create a new file.

**Path:** `docs/fix-log/`
**Filename:** `build-fix-log-YYYY-MM-DD-short-kebab-summary.md`

```markdown
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

---

### Path B — Prior fix log exists (retry attempt)

Do **not** create a new file. Append a retry block to the existing log.

Keep the original content intact above the appended block.

```markdown
---

## Retry Attempt — YYYY-MM-DD

### Why the Prior Attempt Failed
What specifically did not work, and why.

### Revised Root Cause
How the diagnosis changed (if at all).

### Changes Applied
Files changed in this attempt; what was different from the prior approach.

### Architectural Impact
Does this attempt affect layer boundaries differently than the prior one?

### Preventative Rule
Updated or additional rule to prevent recurrence.

### Docs Updated
- AI_CONTRACT.md: yes/no — reason
- 0_ARCHITECTURE.md: yes/no — reason
- 0_BUILD_CONVENTIONS.md: yes/no — reason
- 0_PRODUCT_ROADMAP.md: yes/no — reason
```

If multiple retry attempts have already been logged, append after the last retry block. Each retry block is dated independently.

---

## Step 10 · Post-Task Protocol

After completing the fix:

1. Check whether your changes affect architecture boundaries, build conventions, or roadmap scope.
2. If yes — update the relevant `0_` doc(s) in the same commit.
3. Include a **Docs Check** in your output:

```
Docs Check:
- 0_ARCHITECTURE.md: [updated / not needed — reason]
- 0_BUILD_CONVENTIONS.md: [updated / not needed — reason]
- 0_PRODUCT_ROADMAP.md: [updated / not needed — reason]
```

4. Note whether existing tests pass, were updated, or need to be written.

---

## Quick Reference — Layer Boundaries

| Layer | Location | Owns |
|---|---|---|
| UI | `src/app/...` | Interaction, view state, locale rendering |
| Domain | `src/lib/scheduler.ts`, `src/lib/fillTest.ts`, `src/lib/flashcardLlm.ts` | Pure logic: scheduling, grading, normalization |
| Service | `src/lib/supabase-service.ts`, `src/lib/supabaseClient.ts` | All Supabase reads/writes |
| AI/API | `src/app/api/...` | Prompt orchestration, provider calls |

**Call graph rules:**
- `src/app/**` → `src/app/api/**` via **fetch only** — no direct imports.
- `src/app/api/**` is for admin authoring flows only — never from review execution paths.
- All DB access → `src/lib/supabase-service.ts` only.

---

## Quick Reference — When to Stop and Ask

Stop and surface the issue (do not proceed) when:
- The root cause requires a schema migration or RLS edit.
- The fix requires touching a deferred feature area.
- The fix cannot stay within the layer where the bug lives without crossing a boundary.
- Any hard stop in Step 3 applies.
- Any situation not clearly covered by governance — default to asking, not assuming.
