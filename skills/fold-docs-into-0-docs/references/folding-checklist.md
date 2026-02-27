# Folding Checklist

## 1) Read Order

1. `docs/AI_CONTRACT.md`
2. `docs/architecture/0_ARCHITECTURE.md`
3. `docs/architecture/0_BUILD_CONVENTIONS.md`
4. `docs/architecture/0_PRODUCT_ROADMAP.md`

## 2) Fast Inventory Commands

```powershell
rg --files docs -g "*.md"
rg -n "old-file-name|old-title" docs -S
```

## 3) Fold Mapping

- Fold into `0_ARCHITECTURE.md`:
  - system boundaries
  - schema and invariants
  - authority/folder map rules
- Fold into `0_BUILD_CONVENTIONS.md`:
  - coding, testing, and doc-writing conventions
- Fold into `0_PRODUCT_ROADMAP.md`:
  - active/deferred scope and sequencing
- Keep as dated doc:
  - processing flow
  - known risks
  - implementation notes

## 4) Archive Rule

- Decide archive vs keep:
  - Archive when authoritative content has been folded and remaining content is superseded.
  - Keep as companion when the file still holds active flow/risk/context details.
- If archiving is not explicitly authorized, ask first.
- Archive path is `docs/archive/YYYY-MM/` (current month unless task says otherwise).
- Move files (do not delete), preserve filenames, and repair references.

## 5) Consistency Checks

```powershell
rg -n "old-file-name|retired-doc-name" docs -S
rg -n "Â|â|�" docs -S
```

## 6) Handoff Template

- Files folded into 0_ docs:
- New dated docs created:
- Docs archived:
- Links/references updated:
- Conflicts surfaced (doc vs code):
- Docs Check:
  - AI_CONTRACT.md:
  - 0_ARCHITECTURE.md:
  - 0_BUILD_CONVENTIONS.md:
  - 0_PRODUCT_ROADMAP.md:
