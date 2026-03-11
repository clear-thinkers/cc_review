# Feature Spec — Content Model & Schema
_Created: 2026-03-10_
_Status: Draft — Awaiting human review before implementation_
_Supersedes: deferred "Content packs / curated word bank tables" entry in `0_PRODUCT_ROADMAP.md`_

---

## 1. Problem

The current schema was designed for a single-family, admin-curated model where each family manages their own content pipeline (add words → generate flashcard content → review). This creates too much operational burden for family users and doesn't support:

- Platform-level content library shared across families
- Pack-based content distribution (buy a pack, start reviewing immediately)
- Admin-managed curation queue for family-submitted words
- Family-requested enrichment content
- Flexible textbook hierarchies (curriculum vs. literary)

This spec defines the full content model, the required schema delta, and the new user flows for both platform admin and family users.

---

## 2. User Flows

### Platform Admin Flow (Chengyuan)

```
1. Manage textbooks    → /admin/textbooks   → textbooks table
                                               (define slot labels per textbook)
2. Author packs        → /admin/packs       → packs, pack_words, pack_flashcard_contents
                                               (add words, curate content, set status → publish)
3. Process word queue  → /admin/queue       → words pending content across all families
                                               → generate/edit flashcard_contents per family
                                               → flip words.content_status → 'ready'
4. Fulfill requests    → /admin/requests    → content_requests table
                                               → add phrases to existing flashcard_contents
                                               → flip content_requests.status → 'fulfilled'
5. Adjust prompts      → /admin/prompts     → prompt_templates table
                                               (platform-level defaults + per-family overrides)
```

### Family User Flow

```
Option A — Buy a pack
  Browse & purchase pack → pack_purchases row written
                         → pack_words copied → words (content_status = 'ready')
                         → pack_flashcard_contents copied → flashcard_contents
                         → review immediately

Option B — Add words manually
  Add Hanzi   → /words/add  → words (content_status = 'pending')
  Tag words   → /words/tag  → words (textbook_id + slot values set)
              → admin sees word in queue → curates content → flips to 'ready'
              → word becomes reviewable

Either path — Request enrichment
  Flag a character  → /words/all or flashcard screen
                    → content_requests row written
                    → admin fulfills → additional phrases added to flashcard_contents
```

### Family Content Admin Page (`/words/admin`) — Revised Behaviour

```
Shows all words with content_status = 'ready' (from any source)
FT toggle per phrase          → writable (persists immediately)
Add/edit/delete phrases       → writable (family owns their copy)
Regenerate via AI             → NOT available (admin-only tooling)
```

---

## 3. Current Schema — Observations

### What is correct and unchanged

| Table | Status | Notes |
|---|---|---|
| `families` | ✅ Keep as-is | Tenant table, no changes needed |
| `users` | ✅ Keep as-is | Roles, PIN, `is_platform_admin` all correct |
| `quiz_sessions` | ✅ Keep as-is | No changes needed |
| `wallets` | ✅ Keep as-is | No changes needed |
| `prompt_templates` | ✅ Keep as-is | Nullable `family_id` correctly models platform default vs. family override |
| `word_lesson_tags` | ✅ Keep as-is | Junction table is correct; label changes live in `lesson_tags` only |
| `flashcard_contents` | ⚠️ Alter | Needs `content_source` column added |
| `words` | ⚠️ Alter | Needs `content_status` and `content_source` columns added |
| `textbooks` | ⚠️ Alter | Needs flexible slot labels replacing implied grade/unit/lesson |
| `lesson_tags` | ⚠️ Alter | Fixed `grade/unit/lesson` columns must become flexible `slot_1/2/3_value` |

### What is missing

- `packs` — named, publishable content bundles
- `pack_words` — words belonging to a pack
- `pack_flashcard_contents` — curated content belonging to a pack
- `pack_purchases` — family purchase records (audit + idempotency)
- `content_requests` — family-initiated enrichment requests to admin

---

## 4. Migration Context

### Environment state (as of 2026-03-10)

| Table | Dev | Prod | Migration risk |
|---|---|---|---|
| `lesson_tags` | Empty | Empty | None — safe to drop and recreate |
| `word_lesson_tags` | Empty | Empty | None — safe to drop and recreate |
| `words` | Empty | 20 rows (1 family, no tags) | Low — additive columns with safe defaults |
| `flashcard_contents` | Empty | Empty | None — additive column with safe default |
| `textbooks` | Unknown | Unknown | Low — additive columns only |
| All other tables | — | — | No changes |

### Prod words note

The 20 existing `words` rows in prod will receive `content_status = 'pending'`
and `content_source = null` from the column defaults. This is correct — they have
no flashcard content yet and should not appear in the due review queue.

After migration, manually curate those 20 words via the admin queue and flip
`content_status = 'ready'` to restore reviewability for that family.

### Migration order constraint

`word_lesson_tags` has a FK to `lesson_tags`. Drop `word_lesson_tags` first,
then `lesson_tags`, then recreate both. All other steps are independent.

---

## 5. Schema Delta

### 5a. Alter `textbooks`

**Add flexible slot label columns. Remove implied grade/unit/lesson semantics.**

```sql
alter table public.textbooks
  add column slot_1_label text,      -- e.g. "Grade"      | "Collection" | null
  add column slot_2_label text,      -- e.g. "Unit"       | "Work"       | null
  add column slot_3_label text;      -- e.g. "Lesson"     | null (unused)
```

**Semantics:**
- `is_shared = true` + `family_id = null` → platform-level textbook (admin-managed)
- `is_shared = false` + `family_id = <uuid>` → family-created textbook (private)
- A null slot label means that slot is not used for this textbook
- The UI renders only the slots with non-null labels

**Examples:**

| `name` | `slot_1_label` | `slot_2_label` | `slot_3_label` |
|---|---|---|---|
| Blingo | Grade | Unit | Lesson |
| 唐诗三百首 | Collection | Work | null |
| Custom Family Book | Chapter | null | null |

---

### 5b. Alter `lesson_tags`

**Replace fixed `grade/unit/lesson` with flexible `slot_1/2/3_value`.**

```sql
-- Remove fixed columns
alter table public.lesson_tags
  drop column grade,
  drop column unit,
  drop column lesson;

-- Add flexible slot value columns
alter table public.lesson_tags
  add column slot_1_value text,    -- e.g. "Grade 1"   | "五言绝句"
  add column slot_2_value text,    -- e.g. "Unit 3"    | "静夜思"
  add column slot_3_value text;    -- e.g. "Lesson 2"  | null
```

**Constraints:**
- `slot_1_value` is required when `textbook.slot_1_label` is non-null
- `slot_2_value` and `slot_3_value` are always optional
- Application layer validates slot value presence against textbook slot label definitions
- `textbook_id` is mandatory on all `lesson_tags` rows (already enforced by FK)

**Pack naming** is derived from slot values:
```
"Blingo · Grade 1 · Unit 3 · Lesson 2"
"唐诗三百首 · 五言绝句 · 静夜思"
```

---

### 5c. Alter `words`

**Add content lifecycle fields.**

```sql
alter table public.words
  add column content_status  text not null default 'pending'
    check (content_status in ('pending', 'ready')),
  add column content_source  text
    check (content_source in ('pack', 'admin_curated', null));
    -- null = no content yet (pending)
    -- 'pack' = content arrived via pack purchase (copied)
    -- 'admin_curated' = content curated by platform admin for this family's request
```

**Lifecycle:**
```
pending       → word added, no flashcard content exists, not reviewable
ready         → flashcard content exists, word is reviewable
```

**Due review queue** must be updated to filter on `content_status = 'ready'`
instead of deriving readiness from whether `flashcard_contents` rows exist.

---

### 5d. Alter `flashcard_contents`

**Add provenance field.**

```sql
alter table public.flashcard_contents
  add column content_source  text not null default 'admin_curated'
    check (content_source in ('pack', 'admin_curated'));
```

This field drives admin visibility into how a family received content.
It does **not** affect family-facing UI — families have full edit rights on all
`flashcard_contents` rows regardless of source.

---

## 6. New Tables

### `packs`

Named, publishable content bundles authored by platform admin.

```sql
create table public.packs (
  id            uuid not null default gen_random_uuid(),
  textbook_id   uuid not null references public.textbooks(id),
  name          text not null,
    -- auto-derived from slot values: "Blingo · Grade 1 · Unit 3"
    -- stored explicitly for display without joining lesson data
  slot_1_value  text,
  slot_2_value  text,
  slot_3_value  text,
  price         numeric(10,2) not null default 0.00,
  status        text not null default 'draft'
    check (status in ('draft', 'published')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint packs_pkey primary key (id),
  constraint packs_textbook_id_fkey foreign key (textbook_id)
    references public.textbooks(id)
);

create index packs_textbook_id_idx on public.packs(textbook_id);
create index packs_status_idx on public.packs(status);
```

---

### `pack_words`

Words included in a pack. Platform-level — no `family_id`.

```sql
create table public.pack_words (
  id            uuid not null default gen_random_uuid(),
  pack_id       uuid not null references public.packs(id) on delete cascade,
  hanzi         text not null,
  order_index   integer not null default 0,
    -- display and learning order within the pack
  constraint pack_words_pkey primary key (id),
  constraint pack_words_pack_id_fkey foreign key (pack_id)
    references public.packs(id)
);

create index pack_words_pack_id_idx on public.pack_words(pack_id);
create unique index pack_words_pack_hanzi_idx on public.pack_words(pack_id, hanzi);
```

---

### `pack_flashcard_contents`

Curated flashcard content belonging to a pack. Platform-level — no `family_id`.

```sql
create table public.pack_flashcard_contents (
  id            text not null,
    -- "{character}|{pronunciation}|{pack_id}"
  pack_id       uuid not null references public.packs(id) on delete cascade,
  character     text not null,
  pronunciation text not null,
  meanings      jsonb not null default '[]'::jsonb,
  phrases       jsonb not null default '[]'::jsonb,
  examples      jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now(),
  constraint pack_flashcard_contents_pkey primary key (id, pack_id),
  constraint pack_flashcard_contents_pack_id_fkey foreign key (pack_id)
    references public.packs(id)
);

create index pack_flashcard_contents_pack_id_idx
  on public.pack_flashcard_contents(pack_id);
```

---

### `pack_purchases`

Family purchase records. Provides audit trail and prevents re-purchase.

```sql
create table public.pack_purchases (
  id            uuid not null default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  pack_id       uuid not null references public.packs(id),
  purchased_at  timestamptz not null default now(),
  price_paid    numeric(10,2) not null default 0.00,
  constraint pack_purchases_pkey primary key (id),
  constraint pack_purchases_family_id_fkey foreign key (family_id)
    references public.families(id),
  constraint pack_purchases_pack_id_fkey foreign key (pack_id)
    references public.packs(id)
);

create unique index pack_purchases_family_pack_idx
  on public.pack_purchases(family_id, pack_id);
  -- enforces one purchase per family per pack
create index pack_purchases_family_id_idx on public.pack_purchases(family_id);
```

---

### `content_requests`

Family-initiated requests for additional phrases/examples for a specific character.

```sql
create table public.content_requests (
  id            uuid not null default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  requested_by  uuid not null references public.users(id),
    -- the specific parent who submitted the request
  hanzi         text not null,
  textbook_id   uuid references public.textbooks(id),
    -- optional context — which textbook scope they want more content for
  note          text,
    -- family's free-text note to admin, e.g.
    -- "She confuses 学 with 习, needs more verb-usage phrases"
  status        text not null default 'pending'
    check (status in ('pending', 'in_progress', 'fulfilled')),
  created_at    timestamptz not null default now(),
  fulfilled_at  timestamptz,
  constraint content_requests_pkey primary key (id),
  constraint content_requests_family_id_fkey foreign key (family_id)
    references public.families(id),
  constraint content_requests_requested_by_fkey foreign key (requested_by)
    references public.users(id),
  constraint content_requests_textbook_id_fkey foreign key (textbook_id)
    references public.textbooks(id)
);

create index content_requests_family_id_idx on public.content_requests(family_id);
create index content_requests_status_idx on public.content_requests(status);
```

**Fulfillment flow:**
Admin adds phrases directly to the family's existing `flashcard_contents` row
for that `character|pronunciation`, then sets `content_requests.status = 'fulfilled'`
and `fulfilled_at = now()`. No separate enrichment table needed — the family's
`flashcard_contents` is the single record of truth for their content.

---

## 7. On-Purchase Copy Contract

When a family purchases a pack, the following must execute atomically (single DB transaction):

```
1. Write pack_purchases row (idempotency check: unique index prevents double-copy)

2. For each row in pack_words:
   INSERT INTO words (id, family_id, hanzi, content_status, content_source, ...)
   VALUES (makeId(), <family_id>, <hanzi>, 'ready', 'pack', ...)
   ON CONFLICT (family_id, hanzi) DO UPDATE
     SET content_status = 'ready',
         content_source = 'pack'
   -- words the family already added manually get their status upgraded

3. For each row in pack_flashcard_contents:
   INSERT INTO flashcard_contents (id, family_id, meanings, phrases, examples, content_source)
   VALUES ('<char>|<pronunciation>', <family_id>, <meanings>, <phrases>, <examples>, 'pack')
   ON CONFLICT (id, family_id) DO NOTHING
   -- preserve any manual edits the family may have already made
```

**Key rules:**
- If the family already has a word (added manually), `content_status` is upgraded to `ready`; scheduler fields are preserved
- If the family already has `flashcard_contents` for a character (hand-curated by admin), existing content is not overwritten
- Transaction rollback on any failure — no partial state

---

## 8. Content Status Lifecycle

```
                  ┌─────────────────────────────────┐
                  │           words row              │
                  │  content_status  content_source  │
                  └─────────────────────────────────┘
                              │
         ┌────────────────────┴────────────────────┐
         │                                         │
   Family adds word                        Family buys pack
   /words/add                              pack_purchases write
         │                                         │
         ▼                                         ▼
    pending | null                          ready | 'pack'
         │
         │   Admin curates content
         │   flashcard_contents written
         │   content_status flipped
         ▼
    ready | 'admin_curated'
         │
         │   Family requests enrichment
         │   content_requests row written
         │
         │   Admin fulfills: adds phrases to
         │   existing flashcard_contents row
         │   content_requests.status → 'fulfilled'
         ▼
    ready | 'admin_curated'  (same status, richer content)
```

---

## 9. Permission Summary

| Action | Platform Admin | Family Parent | Family Child |
|---|---|---|---|
| Create/publish packs | ✅ | ❌ | ❌ |
| Buy packs | ❌ | ✅ | ❌ |
| Add words manually | ✅ | ✅ | ❌ |
| Tag words | ✅ | ✅ | ❌ |
| Curate flashcard content (AI) | ✅ | ❌ | ❌ |
| Edit own flashcard_contents | ✅ | ✅ | ❌ |
| Toggle FT on/off | ✅ | ✅ | ❌ |
| Request enrichment | N/A | ✅ | ❌ |
| Fulfill enrichment requests | ✅ | ❌ | ❌ |
| Review / fill-test | ✅ | ❌ | ✅ |

---

## 10. Route Changes

### New platform admin routes (platform admin only)

| Route | Purpose |
|---|---|
| `/admin/textbooks` | Create and manage textbooks, set slot labels |
| `/admin/packs` | Author packs, add words, curate content, publish |
| `/admin/queue` | Words pending content across all families |
| `/admin/requests` | Enrichment requests queue |

### Revised family routes

| Route | Change |
|---|---|
| `/words/add` | Unchanged — words land as `pending` |
| `/words/tag` | New — assign textbook + slot values to words |
| `/words/admin` | Revised — read/edit own content; no AI generation buttons |
| `/words/review` | Updated — filter due queue by `content_status = 'ready'` |

### Removed from family nav

| Route | Reason |
|---|---|
| `/words/prompts` | Prompt management is platform-admin-only |

---

## 11. RLS Policy Notes

- `packs`, `pack_words`, `pack_flashcard_contents` — readable by all authenticated users; writable by platform admin only
- `pack_purchases` — readable and writable by own `family_id`; platform admin reads all
- `content_requests` — readable and writable by own `family_id`; platform admin reads all
- All existing RLS policies on `words`, `flashcard_contents`, `quiz_sessions`, `wallets` — unchanged

---

## 12. What Is Deferred

- Pack browsing / storefront UI
- Payment processing (all packs are free for pilot)
- Family-to-family content sharing
- Admin bulk-tagging across families
- Child-initiated enrichment requests (parent-only for now)
- Pack versioning / content update distribution to existing purchasers

---

## 13. Implementation Notes

### `content_requests` — fulfilled_at constraint

The DB constraint `content_requests_fulfilled_at_check` enforces that `fulfilled_at`
is set **if and only if** `status = 'fulfilled'`:

```sql
check (
  (status = 'fulfilled' and fulfilled_at is not null) or
  (status != 'fulfilled' and fulfilled_at is null)
)
```

This is a business rule encoded at the DB level. The service layer **must** set both
fields together in a single update — setting `status = 'fulfilled'` without
`fulfilled_at`, or vice versa, will be rejected by Postgres.

Correct service layer call:
```typescript
await supabase
  .from('content_requests')
  .update({
    status: 'fulfilled',
    fulfilled_at: new Date().toISOString(),  // must be set together
  })
  .eq('id', requestId);
```

Any update path that sets only one of these two fields is a bug.

---

### `lesson_tags` — null slot values and the unique index

The unique index on `lesson_tags` is:
```sql
unique (family_id, textbook_id, slot_1_value, slot_2_value, slot_3_value)
```

Postgres treats nulls as **distinct** in unique indexes — two rows where
`slot_3_value = null` are considered different values and both are allowed.

This is acceptable for now because:
- Slot 3 is optional and sparse (many textbooks won't use it)
- The application layer controls tag creation and should prevent semantic duplicates
  before they reach the DB

**Application layer responsibility:** When creating a `lesson_tags` row, the service
must query for an existing row matching `(family_id, textbook_id, slot_1_value,
slot_2_value, slot_3_value)` with explicit null handling before inserting, rather than
relying solely on the unique index for deduplication.

If deduplication becomes an issue at scale, the fix is a partial unique index or a
generated column that normalises nulls to a sentinel value — but this is deferred
until it is a real problem.

---

## 14. Documentation Updates Required (on approval)

- [ ] `docs/architecture/0_ARCHITECTURE.md` — update Primary admin user flow, Content Admin Curation Rules, Due Review Queue Rules
- [ ] `docs/architecture/0_PRODUCT_ROADMAP.md` — move content packs from Deferred to Phase 2 Planned; add new admin routes
- [ ] `docs/architecture/2026-03-05-supabase-schema-rls.md` — append new tables and altered columns
- [ ] `docs/architecture/2026-03-05-role-based-routing.md` — add `/admin/*` routes to permission matrix
