---
name: fold-docs-into-0-docs
description: >
  Fold individual dated markdown docs into authoritative 0_ docs, split implementation
  details into dated companion docs, and archive superseded docs safely.
  Use this skill whenever the user asks to consolidate, fold, promote, merge, or migrate
  docs/architecture/*.md content into 0_ARCHITECTURE.md, 0_BUILD_CONVENTIONS.md, or
  0_PRODUCT_ROADMAP.md. Also use when a user says "update the governance docs",
  "promote these rules into the 0_ files", or "clean up the architecture docs".
  Keeps naming, section hierarchy, companion-doc pointers, and Docs Check output
  consistent with the project's authority structure.
---

# Fold Docs Into 0 Docs

## Canonical Path References

These are the actual repo paths for the authority documents. Use them in every
reference and command — do not invent alternate paths.

| File | Repo path |
|---|---|
| AI_CONTRACT.md | `AI_CONTRACT.md` (repo root) |
| 0_ARCHITECTURE.md | `docs/architecture/0_ARCHITECTURE.md` |
| 0_BUILD_CONVENTIONS.md | `docs/architecture/0_BUILD_CONVENTIONS.md` |
| 0_PRODUCT_ROADMAP.md | `docs/architecture/0_PRODUCT_ROADMAP.md` |
| Companion/dated docs | `docs/architecture/YYYY-MM-DD-short-description.md` |
| Archive | `docs/archive/YYYY-MM/` |

---

## Workflow

### Step 1 — Read authority docs in order

Read each file before touching anything:

1. `AI_CONTRACT.md`
2. `docs/architecture/0_ARCHITECTURE.md`
3. `docs/architecture/0_BUILD_CONVENTIONS.md`
4. `docs/architecture/0_PRODUCT_ROADMAP.md`

> Do not skip this step, even for small folds. Section boundaries and naming rules
> differ between docs and must be confirmed fresh each session.

---

### Step 2 — Confirm scope and stop points

Before touching files, identify whether the task requires explicit human authorization per
`AI_CONTRACT.md §3`:

- Schema migrations → stop and ask.
- Deleting any content or data → stop and ask.
- Archiving docs → stop and ask **unless the task explicitly says to archive**.
- Renaming `0_` docs or changing their section hierarchy → stop and ask.

If the task implies one of these but does not explicitly authorize it, output a clear
stop-and-confirm message before proceeding. Do not silently proceed.

---

### Step 3 — Classify every source doc before editing

For each source doc, categorize every section before writing a single line of output:

| Content type | Classification | Action |
|---|---|---|
| Rules, schema fields, layer boundaries, system-wide invariants | Authoritative | Fold into `0_` doc |
| Processing steps, entry points, operational flow | Implementation | Keep in dated companion doc |
| Known risks, caveats, extension guardrails | Implementation | Keep in dated companion doc |
| Historical or superseded content | Obsolete | Move to archive (with authorization) |

**Mixed-content docs (most common case):** A source doc usually contains both
authoritative rules and implementation details. Do not treat the whole doc as one type.
Fold the authoritative sections into the appropriate `0_` doc. Leave or extract the
implementation sections into a dated companion doc. The two outputs can (and usually
should) co-exist.

---

### Step 4 — Apply updates to `0_` docs

Editing rules:
- Edit only the sections that need updating. Do not reorder unrelated sections.
- Preserve section hierarchy and authority ordering throughout.
- Insert new subsections at the end of the relevant parent section unless the task
  specifies a different location.
- **If the fold target section does not yet exist** in the `0_` doc: create it at the
  end of the relevant parent section with a clear heading. Do not embed content
  silently into an unrelated section.
- Update `_Last updated:` on each modified `0_` doc.
- Use names and field identifiers from code, not from source docs. If there is a
  mismatch between a source doc's names and the actual codebase, use the code-accurate
  name in the `0_` doc and call out the mismatch explicitly in your output.

---

### Step 5 — Handle companion docs

A companion doc holds the implementation flow, processing notes, and risks for a
specific route or feature. It is always a dated file at `docs/architecture/YYYY-MM-DD-short-description.md`.

**Decision: update existing vs. create new**

| Situation | Action |
|---|---|
| Source doc already exists as a companion doc and still has active value | Keep source doc; add/update top pointer to the `0_` sections it now depends on |
| Source doc is being retired and replacement companion content is needed | Create new `docs/architecture/YYYY-MM-DD-short-description.md`; include top pointer |
| Source doc has no companion-worthy content after folding | No companion needed; proceed to archive step |

**Companion doc required fields:**

Every companion doc must contain:
1. A `_Created:` date line at the top.
2. A `_Covers:` line listing the routes, files, or features it describes.
3. A top pointer block in this exact format:
   ```
   > Authoritative rules are in `0_ARCHITECTURE.md §[Section Name]`[and/or other 0_ docs].
   > This doc covers implementation flow and known risks only.
   ```
4. Sections for: Entry Point, Processing Flow, Known Risks / Operational Caveats.

Do not include authoritative rules (schema fields, layer boundary rules, invariants) in
companion docs — those live in the `0_` docs only.

---

### Step 6 — Archive superseded docs (with authorization)

Archive decision rules:
- **Archive** when: all authoritative content has been folded into `0_` docs AND the
  remaining content is fully superseded, duplicated in a new companion, or no longer
  relevant.
- **Do not archive** when: the source doc still serves as an active companion holding
  useful flow/risk context.
- **Stop and confirm** if archiving authorization is not explicit in the task prompt.

Archive execution rules:
1. Target path: `docs/archive/YYYY-MM/` using the current month unless the task
   specifies another archive period.
2. Create the archive folder if it does not exist.
3. Move files — never delete. Preserve the original filename unless a naming-rule
   correction is explicitly required.
4. After moving, repair every reference to the old path in `docs/`, `src/`,
   `README.md`, and any other active files.
5. Report archived files explicitly in the final output.

---

### Step 7 — Repair all references

After every edit or move:
1. Search for the old filename and any stale inline path mentions across `docs/`, `src/`,
   and `README.md`.
2. Update all links and mentions to point to the new paths.
3. Verify that no companion doc still points to an archived source.

See `references/folding-checklist.md` for the exact search commands to run.

---

### Step 8 — Validate before reporting

Run every check before writing the Docs Check section:

| Check | Pass criteria |
|---|---|
| No stale references | `rg` scan finds no references to retired or moved filenames |
| Naming compliance | All new/renamed docs match rules in `0_ARCHITECTURE.md §6` |
| Encoding integrity | `npm run check:encoding` passes; no mojibake or replacement glyphs |
| Companion pointers | Every companion doc has the required top pointer block (exact format from Step 5) |
| `_Last updated:` | All modified `0_` docs have an updated date |
| Fold target sections | No authoritative content remains in companion docs |
| Archive authorization | Archiving was explicitly authorized, or no archiving occurred |

---

### Step 9 — Report with Docs Check

Include this section in every final output:

```markdown
## Docs Check

- AI_CONTRACT.md: yes/no — reason
- 0_ARCHITECTURE.md: yes/no — reason
- 0_BUILD_CONVENTIONS.md: yes/no — reason
- 0_PRODUCT_ROADMAP.md: yes/no — reason
```

Also report:
- Files folded and which `0_` sections they were folded into.
- Companion docs created or updated.
- Docs archived (if any).
- References repaired.
- Conflicts surfaced (source doc naming vs. code; doc vs. doc contradictions).
- Any stop-and-confirm items raised.
- Validation results (all pass, or list which checks failed).

---

## Output Rules

- Prefer minimal, file-scoped edits. Do not restructure sections you did not need to touch.
- If a source doc's names differ from code names, use code-accurate names in `0_` docs
  and call out the mismatch.
- Follow `AI_CONTRACT.md §5` for fix-log policy. Do not create fix logs for
  routine doc-only updates unless explicitly requested.
- Surface all conflicts explicitly — never resolve them silently.

## Reference

See `references/folding-checklist.md` for the command sequence and handoff template.
