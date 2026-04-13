---
name: feature-workflow-design
description: >
  Use this skill whenever a HanziQuest feature request arrives that needs to be turned into
  a concrete, agent-ready implementation plan. Triggers include: vague or informal requirements
  (e.g. "add X to page Y"), user testing feedback that surfaces unplanned work, requests phrased
  as product enhancements without a spec or roadmap entry, or any multi-enhancement batch
  request. Produces a scope assessment, sequencing rationale, design decision gates for human
  sign-off, and precise agent build prompts. Always use this skill before handing any feature
  work to an implementation agent — even for apparently simple UI-only changes.
---

# Feature Workflow Design — HanziQuest (`cc_review`)

This skill takes vague or informal product requirements and produces a structured, agent-ready
implementation plan. It is not an implementation skill — it designs the workflow that implementation
agents will follow.

---

## Step 1 — Governance Gate

Read the four governance docs **in this exact order** before any analysis:

1. `docs/architecture/0_PRODUCT_ROADMAP.md` — is this work in active scope?
2. `docs/architecture/AI_CONTRACT.md` — do any hard stops (§1) or scope boundaries (§2) apply?
3. `docs/architecture/0_ARCHITECTURE.md` — which product rules, layer boundaries, and schema sections are relevant?
4. `docs/architecture/0_BUILD_CONVENTIONS.md` — which spec, strings, testing, and styling conventions apply?

**Roadmap check (fail fast):**
- If the feature is in §2 Deferred, stop and surface this before proceeding.
- If the feature is unlisted, note it explicitly and continue — unlisted ≠ blocked, but the human must be informed.
- User testing feedback that surfaces unplanned work is a legitimate addition path; note the origin.

**Hard stop check:**
Scan each enhancement against `AI_CONTRACT.md §1`. If any enhancement touches:
- AI calls from the UI layer
- Normalization bypass
- Direct writes to coin/wallet tables outside RPCs
- IndexedDB or `db.ts` imports

→ Block immediately. Do not design a workflow for a hard-stopped feature.

**Scope boundary check:**
Scan each enhancement against `AI_CONTRACT.md §2`. Flag if any enhancement implies:
- Schema migration (new table, column, RPC, or persisted field)
- RLS policy changes
- New top-level route
- Scheduler logic changes
- New AI provider or prompt orchestration changes

→ Do not assume authorization. Surface the boundary and ask. Wait for the word **"authorized"** before including that path in the workflow.

---

## Step 2 — Per-Enhancement Assessment

For each enhancement in the request, produce:

### 2a — Layer Classification

Identify which architectural layers are touched:

| Layer | Location | Touched? |
|---|---|---|
| UI | `src/app/...` | ? |
| Domain | `src/lib/scheduler.ts`, `fillTest.ts`, etc. | ? |
| Service | `src/lib/supabase-service.ts` | ? |
| AI | `src/app/api/...` | ? |

### 2b — Spec Requirement

Apply `BUILD_CONVENTIONS.md §1` spec decision table:

- Touches ≥ 2 layers → **spec required**
- Adds DB table, RPC, persisted field, or API route → **spec required**
- Single-layer UI change (copy, styling, layout) → **no spec required**
- Bug fix with no schema or API surface changes → **no spec required**

If spec required but the risk profile is low (no schema change, no new routes, no RLS touch):
a lightweight **build prompt** substitutes for a full spec file. Note this explicitly and justify it.

### 2c — Design Decision Gates

Identify any decision the human must make before the agent can proceed. Common gates:

**Data display decisions** (e.g. what "failed" means — count vs. flag vs. rate)
→ Present options as a table: option name, what it displays, what question it answers.
→ Give a recommendation with rationale. Wait for confirmation before encoding the choice.

**Data access decisions** (e.g. client-side aggregation vs. new RPC)
→ If a new RPC is required: surface as a §2 scope boundary, await "authorized".
→ If client-side reuse of existing service functions is viable: recommend it and note the scale caveat.

**Role visibility decisions** (e.g. should a new column be visible to children?)
→ Check `0_ARCHITECTURE.md` Role-Based Routing Rules and in-page action restrictions.
→ Flag if the new feature would give children access to data they currently cannot see.

Do not proceed past Step 2 until all design decision gates are resolved.

---

## Step 3 — Sequencing

Order enhancements by this priority:

1. **Zero data risk first** — pure UI state changes with no service layer touch go before anything that reads or aggregates data.
2. **Unblocked before blocked** — if one enhancement has an unresolved design gate and another does not, ship the unblocked one first.
3. **Lower spec overhead first** — no-spec changes before spec-required changes.

State the sequencing decision and the reason for it explicitly. Example:
> "E2 before E1: E2 is pure UI with zero data risk and zero ambiguity. E1 has a data design gate that requires your sign-off before implementation."

---

## Step 4 — Output Format

Produce two artifacts for each enhancement:

### Artifact A — Workflow Summary

```
## Task [ID] — [Short Title] ([Route(s)])

What the agent does:
1. Pre-task reads (list governance docs in AI_CONTRACT §3 order, noting relevance of each)
2. [Step-by-step implementation actions]
3. Strings additions (file, keys, EN + ZH values — before any JSX)
4. Service layer actions (if any)
5. Test requirements (per BUILD_CONVENTIONS §6)

Constraints:
- Target files: [list]
- No new files / No schema changes / etc.
- [Any hard stops or scope boundaries that apply]
```

### Artifact B — Agent Build Prompt

A self-contained prompt block ready to paste to an implementation agent. Must include:

```
Pre-task: read governance docs in AI_CONTRACT.md §3 order before writing any code.
Confirm which files were read before proceeding.

Target files: [explicit list]
[Authorized scope statement — what the agent may and may not touch]

Strings: add the following to [strings file] with full EN + ZH coverage before writing any JSX:
  [key]: "[EN]" / "[ZH]"

Styling: [relevant style constraint from style-ref.md]
[Any other BUILD_CONVENTIONS constraints relevant to this task]
[Any design decisions already resolved — encode the chosen option explicitly]

Hard stops that apply to this task:
  [List any §1 rules relevant to the touched layers]
```

---

## Step 5 — Final Workflow Summary

After all per-enhancement artifacts, produce a top-level execution plan:

```
Sequencing:
  Step 1 → [Enhancement ID] — [Title] — reason: [why first]
  Step 2 → [Enhancement ID] — [Title] — reason: [why second]
  ...

Design decisions awaiting confirmation before Step N:
  - [Decision]: [options presented, recommendation made]

Design decisions already resolved (encode in build prompts):
  - [Decision]: [chosen option + rationale]
```

---

## Critical Design Principles

These are the reasoning patterns this skill encodes. Reference them when making recommendations:

**Governance docs are read before every task, even simple ones.**
`AI_CONTRACT.md §3` is unconditional. An agent that skips conventions on a "simple" task
is highest risk for drift precisely because review attention is lowest on simple changes.

**Strings are a pre-condition, not a step.**
`BUILD_CONVENTIONS §4` requires `*.strings.ts` files with full EN + ZH coverage
*before* any JSX is written. Build prompts must encode this as a pre-condition.

**Client-side reuse beats new RPCs at pilot scale.**
New RPCs hit `AI_CONTRACT §2` scope boundaries. For small family-level data volumes,
aggregating from existing service functions in-memory is zero-friction and correct.
Flag the scale caveat; defer the RPC to post-pilot.

**"—" beats "0" for zero-value columns.**
When a new data column will have many zero-value rows, displaying an em dash reduces
visual noise and lets non-zero values stand out — which is the point of the column.

**Sequencing by risk, not by request order.**
The order the human listed enhancements is not the implementation order.
Always sequence by risk profile, data gate dependencies, and spec overhead.

**Spec files vs. build prompts.**
Multi-layer work technically requires a spec file (`BUILD_CONVENTIONS §1`).
But when there are no schema changes, no new routes, and no RLS touch, a precise
build prompt carries the same behavioral enforcement at lower overhead.
Document this substitution explicitly so the choice is auditable.
