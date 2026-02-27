---
name: fold-docs-into-0-docs
description: Fold individual dated markdown docs into authoritative 0_ docs, split implementation details into dated companion docs, and archive superseded docs safely. Use when asked to consolidate docs/architecture/*.md content into 0_ARCHITECTURE.md, 0_BUILD_CONVENTIONS.md, or 0_PRODUCT_ROADMAP.md while keeping naming, references, and docs-check output consistent.
---

# Fold Docs Into 0 Docs

## Workflow

### 1. Read authority docs in order

1. `AI_CONTRACT.md` at repo root.
2. `docs/architecture/0_ARCHITECTURE.md`
3. `docs/architecture/0_BUILD_CONVENTIONS.md`
4. `docs/architecture/0_PRODUCT_ROADMAP.md`

### 2. Confirm scope and safety

- For moving, archiving, or retiring existing docs, follow `AI_CONTRACT.md` section 3 and require explicit authorization when needed.
- If a source doc conflicts with actual code behavior, update the relevant `0_` doc to match code and call out the conflict explicitly.

### 3. Classify source content before editing

Use this classification before editing:

| Content type | Action |
|---|---|
| Authoritative rules, layer boundaries, schema fields, system-wide conventions | Fold into the appropriate `0_` doc |
| Route flow, processing steps, operational notes, known risks, implementation context | Keep in or create a dated companion doc |
| Historical, superseded, replaced content | Move to `docs/archive/YYYY-MM/` |

### 4. Apply updates to `0_` docs

- Edit only required sections; do not reorder unrelated sections.
- Keep section hierarchy and authority ordering intact.
- Insert new subsections at the end of the relevant parent section unless a task specifies another location.
- Update `_Last updated:` on each modified `0_` doc.

### 5. Create or update dated companion docs

- Always produce a companion artifact for each folded source doc:
  - If the source doc still has non-authoritative implementation value, keep it as the companion file and add/update a top pointer to the folded `0_` sections.
  - If the source doc is being retired, create a replacement companion file in `docs/architecture/` using `YYYY-MM-DD-short-description.md`.
- Keep companion scope limited to flow, entry points, processing notes, risks, and operational context.
- Add a top pointer to the folded `0_` sections in this format:
  - `> Authoritative rules are in 0_ARCHITECTURE.md section X (and/or other 0_ docs).`

### 6. Retire superseded docs

Archive decision rules:

- Archive a source doc when all of its authoritative rules were folded into `0_` docs and the remaining content is duplicate, obsolete, or intentionally replaced.
- Do not archive a source doc when it still serves as the active companion for flow/risk/context.
- If archiving authorization is not explicit in the task, stop and ask before moving files.

Archive execution rules:

- Target folder: `docs/archive/YYYY-MM/` using the current month unless the task specifies another archive month.
- Create archive folder when missing.
- Move files (do not delete) and preserve filename unless a naming-rule correction is required.
- After move, repair all references to old paths.
- Report archived files explicitly in final output.

### 7. Repair references

- Search for old filenames and stale inline mentions.
- Update links in `docs/`, `src/`, `README.md`, and active working files.

### 8. Validate before reporting

- No references to retired filenames remain.
- New and renamed docs match naming rules in `0_ARCHITECTURE.md`.
- Modified files have clean encoding (no mojibake or replacement glyphs).
- Companion docs point to relevant `0_` sections.
- `_Last updated:` fields are current on modified `0_` docs.

### 9. Report with Docs Check

Use this section in final output:

```markdown
## Docs Check

- AI_CONTRACT.md: yes/no - reason
- 0_ARCHITECTURE.md: yes/no - reason
- 0_BUILD_CONVENTIONS.md: yes/no - reason
- 0_PRODUCT_ROADMAP.md: yes/no - reason
```

## Output Rules

- Prefer minimal, file-scoped edits.
- If schema names in source docs differ from code, use code-accurate names in `0_` docs and explicitly call out the mismatch.
- Follow `AI_CONTRACT.md` section 5 for fix-log policy.
- Do not create fix logs for routine doc-only updates unless explicitly requested.

## Reference

Use `references/folding-checklist.md` for command sequence and handoff template.
