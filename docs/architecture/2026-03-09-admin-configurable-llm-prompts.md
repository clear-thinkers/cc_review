# Feature Spec — 2026-03-09 — Admin-Configurable LLM Prompts

## Status
✅ Done — 2026-03-09

---

## Problem

All system prompts sent to DeepSeek are hardcoded in
`src/app/api/flashcard/generate/route.ts`. There is no mechanism for admins
or parents to tune content complexity, tone, or pedagogical level without a
code deploy. As the app is used across different family contexts (e.g. K-1 vs
Grade 3-4), educators and parents need a way to adjust how AI-generated
content is phrased — without touching code.

---

## Scope

- New page `/words/prompts` — accessible to parent and platform_admin roles only.
- Prompt slot management: create, name, edit, save, delete, and activate prompt
  slots — up to 5 per user per prompt type.
- 5 configurable prompt types: `full`, `phrase`, `example`, `phrase_details`,
  `meaning_details`. (`example_pinyin` is NOT user-configurable.)
- One "Default" slot per prompt type — owned and editable by platform_admin
  only; read-only for parent accounts.
- One active slot per prompt type per family at any time.
- Active slot drives the system prompt sent to DeepSeek at generation time.
- New Supabase table: `prompt_templates`. (Schema migration — see Risks.)
- API route update: `/api/flashcard/generate` reads the active prompt for the
  family before calling DeepSeek.

---

## Out of Scope

- `example_pinyin` prompt is not configurable (low pedagogical impact; pinyin
  accuracy must remain strict).
- Prompt versioning or diff history beyond the 5-slot save system.
- Prompt sharing between families.
- Per-child prompt overrides (prompts are family-scoped, set by the parent).
- Prompt preview / test-fire from the prompts page (deferred to a future
  iteration).
- Bulk prompt import/export.
- Any changes to scheduler logic.

---

## Proposed Behavior

### Page Layout: `/words/prompts`

The page uses a tab strip across the top — one tab per configurable prompt
type:

```
[ Full ]  [ Phrase ]  [ Example ]  [ Phrase Details ]  [ Meaning Details ]
```

Each tab displays the slot grid for that prompt type.

---

### Slot Grid (per tab)

Inspired by an address-picker card layout (Amazon-style). Each tab renders
up to 6 cards: one locked **Default** card, then up to 5 user-owned slots.

```
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  🔒 Default            ACTIVE │  │  1st Grade Level              │
│  ─────────────────────────── │  │  ─────────────────────────── │
│  You are a professional...   │  │  You are a friendly tutor...  │
│                              │  │                              │
│  [Read only for parents]     │  │  [Make Active]  [Edit] [Del] │
└──────────────────────────────┘  └──────────────────────────────┘

┌──────────────────────────────┐
│  + Add New Slot               │
│  (4 of 5 used)               │
└──────────────────────────────┘
```

**Card anatomy:**
- **Slot name** — user-defined, max 50 chars. Default card always shows "Default".
- **Prompt body preview** — first 120 characters, truncated with "…".
- **ACTIVE badge** — shown on the currently active card for the family.
  Highlighted with a distinct border color (e.g. brand accent). Only one card
  per tab can show this badge.
- **Actions:**
  - Default card (parent view): read-only; no edit/delete; no Make Active if
    already active.
  - Default card (platform_admin view): **[Edit]** available; no delete.
  - User-owned cards: **[Make Active]**, **[Edit]**, **[Delete]**.
  - **[Make Active]** is hidden on the card that is already active.

**Add New Slot button:**
- Shows remaining count "(N of 5 used)".
- Disabled (grayed) when 5 user-owned slots exist.

---

### Active Prompt Logic

- Exactly one slot per prompt type per family is active at any time.
- Scope: the parent's active prompt applies to the **whole family** — all
  content generated under that family uses the active family prompt.
- Default behavior: if no user-owned slot is marked active, the Default
  prompt is used automatically. This requires no explicit "Make Active" action
  on the Default card.
- When a user marks a slot active, any previously active slot for that prompt
  type and family is deactivated atomically.
- If a parent **deletes** their active slot, the system falls back to the
  Default automatically.
- Platform_admin editing the Default does NOT override a family's active
  custom slot — their active slot continues to take precedence.

---

### Slot Edit View

Clicking **[Edit]** or **[+ Add New Slot]** opens an inline edit panel
(below the card, not a modal) with:

- **Name field** — text input, max 50 chars, required.
- **Prompt body textarea** — multi-line, with:
  - Live character counter: `423 / 1000` (styled red when out of range).
  - Min/max limits enforced on save (not while typing).
- **[Save]** — validates name and body, then writes to Supabase.
- **[Cancel]** — discards changes.

Character limits by prompt type (instructions only — format suffix not included):

| Prompt Type      | Min | Max |
|------------------|-----|-----|
| `full`           | 30  | 700 |
| `phrase`         | 30  | 600 |
| `example`        | 30  | 500 |
| `phrase_details` | 30  | 600 |
| `meaning_details`| 20  | 400 |

Validation errors are shown inline below the relevant field.

---

### API Integration (`/api/flashcard/generate`)

Before constructing the DeepSeek call, the route must:

1. Identify the requesting family (from Supabase session JWT `app_metadata`).
2. Query `prompt_templates` for the active slot matching `family_id` and
   `prompt_type`. If none found, query for the Default (`is_default = true`,
   `prompt_type` match).
3. Compose the final system prompt: `${resolvedInstructions}\n${formatSuffix}`.
   The `prompt_body` stored in the DB (and edited by users) contains
   **instructions + rules only**. A hardcoded per-type format suffix
   (JSON return schema + "Return JSON only.") is **always appended at call
   time** and is **not** user-editable. This separation prevents users from
   accidentally breaking the response format.
4. If neither a custom nor a default prompt is found (should not occur in
   normal operation), fall back to the hardcoded constant and log a warning.

`example_pinyin` mode continues to use its hardcoded `EXAMPLE_PINYIN_SYSTEM_PROMPT`
— no lookup performed for this mode.

---

### Navigation

Add `/words/prompts` to the nav immediately after `/words/admin` (Content
Admin), labelled **"AI Prompts"**. Entry is hidden for child role (not shown
as disabled).

Updated permission matrix:

| Route              | Child | Parent | Platform Admin |
|--------------------|-------|--------|----------------|
| `/words/add`       | ❌    | ✅     | ✅             |
| `/words/admin`     | ❌    | ✅     | ✅             |
| `/words/prompts`   | ❌    | ✅     | ✅             |
| `/words/all`       | ✅    | ✅     | ✅             |
| `/words/results`   | ✅    | ✅     | ✅             |
| `/words/review`    | ✅    | ✅     | ✅             |

---

## Supabase Schema

### New table: `prompt_templates`

```sql
create table prompt_templates (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid references families(id) on delete cascade,  -- null for defaults
  user_id         uuid references auth.users(id) on delete cascade, -- null for defaults
  prompt_type     text not null
                    check (prompt_type in
                      ('full','phrase','example','phrase_details','meaning_details')),
  slot_name       text not null,
  prompt_body     text not null,
  is_active       boolean not null default false,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

**Constraints:**
- `is_default = true` rows must have `family_id IS NULL` and
  `user_id IS NULL`.
- Only one `is_active = true` row per `(family_id, prompt_type)` at any time
  — enforced by a partial unique index or application-level atomic upsert.
- Max 5 user-owned rows per `(family_id, prompt_type)` — enforced in the
  service layer (not a DB constraint).

**Indexes:**
```sql
create index on prompt_templates (family_id, prompt_type, is_active);
create index on prompt_templates (is_default, prompt_type);
```

### RLS Policies

- Family members can **read** rows where `family_id` matches their own
  family OR `is_default = true`.
- Parents and platform_admins can **insert/update/delete** rows where
  `family_id` matches their own family.
- Platform_admin can **insert/update** rows where `is_default = true`.
- No client can **delete** a `is_default = true` row.

### Seed Data

On first deploy, a migration seeds one Default row per prompt type using the
current hardcoded prompt constants from `route.ts`. Platform_admin slot_name
for defaults: `"Default"`.

---

## Layer Impact

| Layer   | Change |
|---------|--------|
| UI      | New page `src/app/words/prompts/` (page, strings, types) |
| Domain  | No changes |
| Service | New functions in `supabase-service.ts`: `getActivePrompt`, `listPromptSlots`, `upsertPromptSlot`, `deletePromptSlot`, `setActivePromptSlot` |
| AI      | `src/app/api/flashcard/generate/route.ts` — resolve system prompt from DB before DeepSeek call |
| Schema  | New `prompt_templates` table + RLS + seed migration |

**Hard stop compliance:**
- ✅ All DB access via `supabase-service.ts` — no direct Supabase calls from UI.
- ✅ No AI calls from UI layer — prompt lookup happens server-side in the API route.
- ✅ Hardcoded strings extracted to `prompts.strings.ts`.

---

## Edge Cases

1. **Parent deletes active slot** → system falls back to Default for that
   prompt type. No error surfaced to the user.
2. **Admin updates Default while a family has a custom active slot** → no
   effect on that family. Their active custom slot remains in use.
3. **5 slots full, user tries to add** → "Add New Slot" button is disabled;
   a tooltip explains the limit.
4. **Prompt body below minimum characters** → save blocked; inline error shown.
5. **Two concurrent edits (e.g. two browser tabs)** → last-write-wins on save;
   no optimistic locking in v1.
6. **DeepSeek call with no prompt resolved** → falls back to hardcoded
   constant and logs a warning server-side. Should not occur post-seed.
7. **Child navigates directly to `/words/prompts`** → RouteGuard redirects to
   `/words/review`.

---

## Risks

1. **Schema migration required** — `prompt_templates` is a new table. Confirm
   before build (AI_CONTRACT §3: schema migrations require explicit human
   confirmation). _This spec itself constitutes that confirmation once approved._
2. **Prompt orchestration logic change** — modifying how system prompts are
   resolved in `/api/flashcard/generate` is a scope boundary item
   (AI_CONTRACT §3). Authorized by this spec.
3. **Bad custom prompts breaking generation** — a poorly written prompt could
   cause the AI to return malformed JSON. The existing normalization layer
   already handles this (malformed responses are dropped); no new risk.
4. **Default seed gap** — if the seed migration runs before the table exists
   in a given environment, generation falls back to hardcoded constants
   gracefully.

---

## Test Plan

- Unit: `getActivePrompt` returns custom active slot when one exists; returns
  Default when none; returns hardcoded fallback when table is empty.
- Unit: Service layer enforces 5-slot maximum.
- Unit: Character limit validation (below min, above max, within range).
- Unit: Deleting active slot triggers fallback to Default.
- Integration: Full generation call uses active custom prompt body as system
  prompt.
- Integration: `example_pinyin` mode always uses hardcoded prompt (no DB
  lookup).
- UI: Child role cannot access `/words/prompts` (redirect to review).
- UI: Parent cannot edit or delete Default card.
- UI: "Make Active" deactivates previous active slot in same tab.
- UI: Add New Slot button disabled at slot limit.

---

## Acceptance Criteria

- [ ] `/words/prompts` page renders for parent and platform_admin roles; is
      hidden from nav and redirect-protected for child role.
- [ ] Page appears in nav immediately after `/words/admin`.
- [ ] Each of the 5 prompt types has its own tab with an independent slot grid.
- [ ] Default card is visible, shows first 120 chars, and is read-only for
      parents.
- [ ] Platform_admin can edit (but not delete) the Default card.
- [ ] Parents can create up to 5 named prompt slots per prompt type.
- [ ] Slot names are max 50 chars; prompt body enforces per-type min/max with
      live counter.
- [ ] Exactly one slot (custom or Default) is visually marked ACTIVE per tab
      per family at all times.
- [ ] Making a slot active deactivates the previous active slot atomically.
- [ ] Deleting the active slot falls back to Default with no error.
- [ ] Active custom prompt is used as the system prompt in the next generation
      call to DeepSeek for the matching prompt type.
- [ ] `example_pinyin` mode is unaffected — continues using hardcoded prompt.
- [ ] All user-facing strings are in `prompts.strings.ts` (bilingual EN/ZH).

---

## Open Questions

_All resolved 2026-03-09._

1. ~~Should the platform_admin's Default edits take effect immediately?~~
   **→ Yes. Default edits are live immediately for all families.**
2. Should the Prompts page show a live word count as a secondary indicator?
   _(Nice to have — deferred unless easy to add.)_
3. ~~Nav label?~~ **→ "AI Prompts".**
   Concurrent-write risk is acknowledged as negligible in v1: each family has
   exactly one parent account, and child accounts have no access to this page.
