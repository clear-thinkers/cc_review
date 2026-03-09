# Feature Spec — 2026-03-09 — Character Level Tagging

## Status
📋 Planned

---

## Problem

Words in the app have no curriculum context. Families using specific Chinese
textbooks (e.g. New Oriental Bingo Chinese, 马莉萍) have no way to group
characters by textbook, grade, unit, or lesson. This makes it impossible to
practice "just this week's lesson" or filter content by curriculum source.
Platform admin also needs to curate and eventually sell structured textbook
tag sets to families.

---

## Scope

- New 4-level cascade tag structure: **Textbook → Grade → Unit → Lesson**.
- A word can carry **multiple** cascade tags (many-to-many).
- Tags are **family-scoped** — each family's tagging data is isolated. Admin
  curates shared textbooks visible to all families; families may add their
  own private textbooks.
- Tag assignment at word-add time: one cascade tag optionally applied to the
  whole batch submission (optional, not required).
- Tag display and AND-logic filtering on `/words/all` (All Characters page).
- Tag AND-logic filtering on `/words/admin` (Content Admin page).
- Three new Supabase tables: `textbooks`, `lesson_tags`, `word_lesson_tags`.
  (Schema migration — authorized by this spec.)

---

## Out of Scope

- Editing or removing cascade tags from an already-saved word (deferred —
  tag management UI is a follow-on feature).
- Filtering the review queue (`/words/review`) by tag (roadmap note says
  scheduler unaffected; review scope filter deferred).
- Purchasing shared admin textbooks (future commercial feature — data model
  must not block it, but no UI or payment logic in this phase).
- Sub-lesson ordering or word ordering within a lesson.
- Flexible hierarchy depth (fewer than 4 levels) — revisit post-launch.
- Tag visibility for child role — children do not see or assign tags.
- Bulk re-tagging existing words.

---

## Data Model

### Table: `textbooks`

```sql
create table textbooks (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  is_shared    boolean not null default false,  -- true = admin-curated, visible to all
  family_id    uuid references families(id) on delete cascade, -- null if is_shared
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
```

- `is_shared = true` rows: `family_id` is NULL; created/edited by platform_admin only.
- `is_shared = false` rows: scoped to a single family; created by parent or admin.
- A family can read all `is_shared = true` rows plus their own `family_id` rows.

### Table: `lesson_tags`

Represents one unique Textbook → Grade → Unit → Lesson combination.

```sql
create table lesson_tags (
  id           uuid primary key default gen_random_uuid(),
  textbook_id  uuid not null references textbooks(id) on delete cascade,
  grade        text not null,   -- e.g. "G2", "Grade 2", "二年级"
  unit         text not null,   -- e.g. "Unit 8", "第八单元"
  lesson       text not null,   -- e.g. "Lesson 4", "第四课"
  created_at   timestamptz not null default now(),
  unique (textbook_id, grade, unit, lesson)
);
```

- Created implicitly when a user selects a combination not yet in the table.
- Owned by the textbook's `family_id` (or shared if textbook is shared).
- No standalone CRUD UI in this phase — rows are created on-demand via the
  type-ahead flow.

### Table: `word_lesson_tags`

Join table — family-scoped assignment of a cascade tag to a word.

```sql
create table word_lesson_tags (
  id              uuid primary key default gen_random_uuid(),
  word_id         uuid not null references words(id) on delete cascade,
  lesson_tag_id   uuid not null references lesson_tags(id) on delete cascade,
  family_id       uuid not null references families(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (word_id, lesson_tag_id, family_id)
);
```

- A word can have multiple rows (multiple cascade tags).
- `family_id` allows each family's tagging to be isolated even for the same
  word and shared lesson tag.
- Deleting a word cascades to delete its tag assignments.

### RLS Policies

- `textbooks`: families can read `is_shared = true` rows + their own
  `family_id` rows. Only platform_admin can insert/update `is_shared = true`
  rows. Parents can insert/update their own family rows.
- `lesson_tags`: readable if the parent textbook is readable by the family.
  Insertable if the parent textbook belongs to the family (or is_shared and
  user is platform_admin).
- `word_lesson_tags`: full CRUD scoped to `family_id` matching the session.

### Indexes

```sql
create index on textbooks (family_id, is_shared);
create index on lesson_tags (textbook_id);
create index on word_lesson_tags (word_id);
create index on word_lesson_tags (lesson_tag_id);
create index on word_lesson_tags (family_id);
```

### Seed Data

Migration seeds one shared textbook for demo/testing:
- `name: "New Oriental Bingo Chinese"`, `is_shared: true`.
- No lesson_tags pre-seeded — created on first use.

---

## Proposed Behavior

### Tag Assignment at Word-Add (`/words/add`)

Below the Hanzi input field, an optional collapsible section labeled
**"Assign to Lesson (optional)"** contains a 4-level cascade dropdown:

```
Textbook  [________ ▼]   ← type-ahead; shows shared + family textbooks
Grade     [________ ▼]   ← populated after textbook is chosen
Unit      [________ ▼]   ← populated after grade is chosen
Lesson    [________ ▼]   ← populated after unit is chosen
```

**Cascade behavior:**
- Each dropdown is disabled until the level above it is selected.
- Options are populated from existing `lesson_tags` rows for the selected
  parent values — type-ahead filters as user types.
- If the typed value does not match any existing option, a **"+ Create
  '[value]'"** option appears at the bottom of the dropdown. Selecting it
  creates the new `lesson_tag` row on save.
- Selecting a higher-level value resets all dropdowns below it.

**Batch application:**
- The cascade tag section is above the submit button.
- When submitted, the same cascade tag is applied to **every word** in the
  batch. If no tag is selected, words are saved without tags.
- Tag assignment is performed in the same transaction as word insertion.
  If a word is skipped (already exists), its tag assignment is also skipped.

**Validation:**
- Tag is all-or-nothing: if the section is open, all 4 levels must be
  selected before submitting. Partial selection blocks submit with an inline
  error: "Please complete all 4 levels or clear the tag."
- If the section is collapsed/untouched, no validation is applied.

---

### All Characters Page (`/words/all`)

**Filter bar** (above the existing table):

```
Textbook [All ▼]   Grade [All ▼]   Unit [All ▼]   Lesson [All ▼]   [Clear Filters]
```

- Dropdowns are cascading: Grade options are scoped to selected Textbook;
  Unit options scoped to selected Grade; etc.
- Filter logic: **AND** — only words matching all selected levels are shown.
- Selecting a higher-level filter resets lower-level filters.
- "All" (default) means no filter applied at that level.
- **[Clear Filters]** resets all four to "All".
- Filter state **persists across in-app navigations** within the session
  (implement via URL search params: `?textbook=...&grade=...&unit=...&lesson=...`).
  State resets on profile switch or logout. If URL param implementation
  proves costly during build, fall back to session-level in-memory state
  (resets on hard refresh) and flag it in the fix log.

**Tag column in the character table:**

New column **"Lessons"** inserted after the existing columns (before actions).
- Displays each cascade tag as a compact pill:
  `NewOriental · G2 · U8 · L4`
- Multiple tags stack vertically within the cell, one pill per row.
- If no tags assigned: cell is empty (no placeholder text).
- Column is sortable: sorts by first tag's textbook name alphabetically.

---

### Content Admin Page (`/words/admin`)

**Filter bar** (above the existing character list, same style as `/words/all`):

```
Textbook [All ▼]   Grade [All ▼]   Unit [All ▼]   Lesson [All ▼]   [Clear Filters]
```

- Same AND logic and cascade behavior as above.
- Filters the character list to show only characters with a matching tag
  assignment.
- Characters with no tags are hidden when any filter is active.

No tag column added to the admin table in this phase — filter-only.

---

## Layer Impact

| Layer   | Change |
|---------|--------|
| UI      | `/words/add` — optional tag section; `/words/all` — filter bar + Lessons column; `/words/admin` — filter bar |
| Domain  | No changes to scheduler or grading logic |
| Service | New functions in `supabase-service.ts`: `listTextbooks`, `listLessonTags`, `createLessonTagIfNew`, `assignWordLessonTags`, `getWordLessonTags`, `listWordsByLessonTag`. All write paths normalize grade/unit/lesson strings (trim, collapse whitespace, title-case ASCII, preserve CJK) before insert or dedup comparison. |
| AI      | No changes |
| Schema  | Three new tables: `textbooks`, `lesson_tags`, `word_lesson_tags` + RLS + seed |

**Hard stop compliance:**
- ✅ No scheduler changes.
- ✅ No AI layer changes.
- ✅ All DB access via `supabase-service.ts`.
- ✅ All user-facing strings in `tagging.strings.ts` (bilingual EN/ZH).
- ✅ Types in `tagging.types.ts`.

---

## Edge Cases

1. **Word already exists on batch add** — tag assignment for that word is
   skipped silently (consistent with existing "already exists" skip behavior).
2. **User partially fills cascade then collapses the section** — treat as
   no tag selected; clear partial state on collapse.
3. **Shared textbook deleted by admin** — cascade deletes associated
   `lesson_tags` and `word_lesson_tags`. Affected families lose those tag
   assignments. Acceptable in v1; no soft-delete in this phase.
4. **Family creates a textbook with the same name as a shared one** — allowed;
   they are separate rows with different `is_shared` values.
5. **Filter active, all words filtered out** — show empty state: "No
   characters match the selected filters." with a [Clear Filters] link.
6. **Word has tags from a textbook the family no longer has access to** —
   RLS prevents reading the textbook row, but `word_lesson_tags` row still
   exists. Service layer should handle gracefully: omit the unresolvable tag
   from display rather than throwing.
7. **Type-ahead "Create" option: duplicate after normalization** — before
   creating a new `lesson_tag`, the service layer trims and lowercases for
   comparison to prevent near-duplicate rows (e.g. "Unit 8 " vs "Unit 8").

---

## Risks

1. **Schema migration** — three new tables required. Authorized by this spec.
2. **Type-ahead UX complexity** — cascading dropdowns with inline creation
   are the most complex UI element in the app to date. Budget extra time for
   the `/words/add` section.
3. **Future purchase flow** — the `is_shared` + `family_id` model supports a
   purchase gate (add a `purchased_textbooks` join table later), but that
   table does not exist yet. Do not build it now; just ensure the data model
   does not conflict.
4. **Performance** — `word_lesson_tags` could grow large for families with
   many words and tags. The indexes defined above should be sufficient for
   Phase 1 scale.

---

## Test Plan

- Unit: `listTextbooks` returns shared rows + family's own rows; excludes
  other families' private rows.
- Unit: `createLessonTagIfNew` deduplicates on (textbook_id, grade, unit,
  lesson) after normalization.
- Unit: `assignWordLessonTags` skips already-tagged (word_id, lesson_tag_id,
  family_id) combinations without error.
- Unit: AND filter logic — words missing any selected filter level are
  excluded.
- Integration: batch add 3 words with a cascade tag → all 3 have
  `word_lesson_tags` rows; a 4th skipped word has no tag row.
- Integration: shared textbook visible to a family that did not create it.
- UI: cascade dropdown — selecting Textbook populates Grade; changing
  Textbook resets Grade/Unit/Lesson.
- UI: partial tag selection blocks form submission with correct error.
- UI: filter bar on `/words/all` — AND logic across all 4 levels; Clear
  Filters restores full list.
- UI: "Lessons" column renders multiple pills correctly for a word with 2
  cascade tags.

---

## Acceptance Criteria

- [ ] Three new tables (`textbooks`, `lesson_tags`, `word_lesson_tags`) exist
      with correct RLS policies.
- [ ] Platform_admin can create shared textbooks; parent can create family
      textbooks; neither can see the other's private data.
- [ ] `/words/add` has an optional "Assign to Lesson" section with 4
      cascading type-ahead dropdowns.
- [ ] Typing a new value in any dropdown offers a "+ Create '[value]'"
      option; selecting it creates the row on save.
- [ ] One cascade tag is applied to all words in a batch submission; words
      that already exist are skipped without error.
- [ ] Partial tag selection (1–3 levels filled) blocks submission with an
      inline error.
- [ ] `/words/all` shows a "Lessons" column with compact pills per tag.
- [ ] `/words/all` filter bar filters by AND logic across all 4 levels;
      Clear Filters works.
- [ ] `/words/admin` filter bar filters by AND logic across all 4 levels;
      Clear Filters works.
- [ ] Characters with no tags are hidden (not shown as empty) when a filter
      is active.
- [ ] All strings are bilingual in `tagging.strings.ts`.
- [ ] Child role sees the Lessons column on `/words/all` (display-only).
      Filter bar is hidden for child role on all pages. Tag assignment UI
      on `/words/add` is moot — children cannot access that route per the
      existing permission matrix.

---

## Open Questions

_All resolved 2026-03-09._

1. ~~Should the "Lessons" column be visible to child accounts?~~
   **→ Yes. Children see the Lessons column** — they know which lesson they
   are on and benefit from the context.

2. ~~Should filter bar state persist across navigations or reset?~~
   **→ Persist in session until profile switch or logout** (URL params or
   session-level state). If URL param implementation adds significant
   complexity, descope to session-level in-memory state (resets on hard
   refresh but not on navigation) and note it in the build task.

3. ~~Grade/Unit/Lesson stored as free text or normalized?~~
   **→ Normalize on save.** Trim whitespace and apply consistent
   capitalization before writing to `lesson_tags`. Display uses the
   normalized form. Deduplication comparison operates on the normalized
   value. Normalization rule: trim, collapse internal whitespace, title-case
   ASCII words, preserve CJK characters as-is.
   Example: `"  unit  8 "` → `"Unit 8"`, `"第八单元"` → `"第八单元"`.
