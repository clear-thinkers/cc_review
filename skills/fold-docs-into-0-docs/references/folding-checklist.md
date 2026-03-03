# Folding Checklist

_Reference for: `fold-docs-into-0-docs` skill_
_Step numbers align with SKILL.md workflow steps._

---

## Step 1 — Read Order

Read these files in this exact order before touching anything:

```
AI_CONTRACT.md                              ← repo root (NOT docs/)
docs/architecture/0_ARCHITECTURE.md
docs/architecture/0_BUILD_CONVENTIONS.md
docs/architecture/0_PRODUCT_ROADMAP.md
```

---

## Step 2 — Stop Points (confirm before acting)

- Schema migration → stop and ask
- Deleting content → stop and ask
- Archiving docs → stop and ask **unless task explicitly authorizes it**
- Renaming `0_` docs or restructuring their sections → stop and ask

---

## Step 3 — Fast Inventory Commands

List all docs in scope:
```powershell
rg --files docs -g "*.md"
```

Check for mixed authoritative + flow content in source doc (scan for rule keywords):
```powershell
rg -n "must|never|always|required|rule|invariant|guarantee" docs/architecture/SOURCE-FILE.md -S
```

Check for stale references to the source file:
```powershell
rg -n "SOURCE-FILE-NAME" docs src README.md -S
```

---

## Step 3 — Fold Mapping

Fold into `0_ARCHITECTURE.md`:
- System boundaries and layer rules
- Schema fields and invariants
- Authority/folder map rules
- System guarantees and error-handling behaviors

Fold into `0_BUILD_CONVENTIONS.md`:
- Coding, testing, and doc-writing conventions

Fold into `0_PRODUCT_ROADMAP.md`:
- Active/deferred scope and sequencing

**Keep as dated companion doc** (never fold these):
- Processing flow and entry points
- Known risks and operational caveats
- Implementation notes and extension guardrails

**Mixed-content source docs:** Fold the rule sections into the appropriate `0_` doc
and keep (or extract) the flow/risk sections in a companion doc. Both outputs coexist.

---

## Step 4 — Editing `0_` Docs

- Edit only required sections; do not reorder others.
- If target section doesn't exist: create it at the end of the relevant parent section.
- Use code-accurate names (not source doc names if they differ); call out mismatches.
- Update `_Last updated:` on every modified `0_` doc.

---

## Step 5 — Companion Doc Decision

| Source doc situation | Action |
|---|---|
| Still has active flow/risk value | Keep it; add/update top pointer |
| Being retired; replacement needed | Create new `docs/architecture/YYYY-MM-DD-name.md` |
| No companion content after folding | No companion; skip to archive step |

Required top pointer format (copy exactly):
```
> Authoritative rules are in `0_ARCHITECTURE.md §[Section Name]`[and/or other 0_ docs].
> This doc covers implementation flow and known risks only.
```

---

## Step 6 — Archive Execution

Only run if task explicitly authorizes archiving.

```powershell
# Create archive folder (adjust YYYY-MM to current month)
New-Item -ItemType Directory -Force docs/archive/YYYY-MM

# Move (do not delete) the source file
Move-Item docs/architecture/OLD-FILE.md docs/archive/YYYY-MM/OLD-FILE.md
```

After moving, run reference repair scan (Step 7).

---

## Step 7 — Reference Repair Scan

After any file move or rename:
```powershell
# Scan for stale references to the old filename
rg -n "OLD-FILE-NAME" docs src README.md -S

# Verify companion pointers point to correct 0_ sections
rg -n "Authoritative rules are in" docs/architecture -S
```

---

## Step 8 — Validation Commands

```powershell
# Encoding check (must pass before PR)
npm run check:encoding

# Scan for mojibake
rg -n "Â|â|â|ï|Ã|æ|å" docs -S

# Confirm no stale references to retired docs
rg -n "RETIRED-FILENAME" docs src README.md -S

# Confirm all companion docs have a top pointer
rg -rn "Authoritative rules are in" docs/architecture -l
```

---

## Handoff Template

```markdown
## Fold Summary

### Files Folded Into 0_ Docs
- SOURCE-FILE.md → 0_ARCHITECTURE.md §[Section] (rules: ...)
- SOURCE-FILE.md → 0_BUILD_CONVENTIONS.md §[Section] (conventions: ...)

### Companion Docs Created or Updated
- docs/architecture/YYYY-MM-DD-name.md — [created/updated]; top pointer added

### Docs Archived
- docs/archive/YYYY-MM/OLD-FILE.md — archived from docs/architecture/OLD-FILE.md

### References Repaired
- [file]: OLD-FILE-NAME → NEW-PATH

### Conflicts Surfaced
- [source doc name] vs. code: [describe mismatch]
- [doc A] vs. [doc B]: [describe conflict]

### Stop-and-Confirm Items Raised
- [none / describe if any]

### Validation
- No stale references: pass/fail
- Naming compliance: pass/fail
- Encoding check: pass/fail
- Companion pointers: pass/fail
- _Last updated_ fields: pass/fail
- Fold target sections clean: pass/fail
- Archive authorization confirmed: pass/fail/n/a

## Docs Check
- AI_CONTRACT.md: yes/no — reason
- 0_ARCHITECTURE.md: yes/no — reason
- 0_BUILD_CONVENTIONS.md: yes/no — reason
- 0_PRODUCT_ROADMAP.md: yes/no — reason
```
