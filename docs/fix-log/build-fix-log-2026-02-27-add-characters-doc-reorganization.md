# Fix Log - 2026-02-27 - Add Characters Doc Reorganization

## Context
Reorganize Add Characters documentation so canonical ingestion rules and schema live in `0_ARCHITECTURE.md`, while flow/risk details live in a dated architecture doc, and retire the superseded page doc to archive.

## Root Cause
The previous Add Characters page doc mixed authoritative rules, schema details, and implementation flow in one place, which conflicted with the authority model in `0_ARCHITECTURE.md`.

## Changes Applied
- Updated `docs/architecture/0_ARCHITECTURE.md`:
  - Added `### Ingestion Rules` under Section 1.
  - Replaced the `words` table schema in Section 3 with implementation-accurate fields and initial values.
- Added `docs/architecture/2026-02-27-add-characters-ingestion.md` for route entry point, processing flow, and known risks.
- Moved `docs/architecture/2026-02-27-add-characters-page.md` to `docs/archive/2026-02/2026-02-27-add-characters-page.md`.

## Architectural Impact
No runtime architecture or code path changes. Documentation authority is clearer:
- Rules and schema are centralized in `0_ARCHITECTURE.md`.
- Implementation detail and risks are isolated in a dated supporting doc.

## Preventative Rule
When a feature doc contains authoritative product rules or schema definitions, fold those into `0_ARCHITECTURE.md` and keep dated docs scoped to implementation flow, risks, and historical context.

## Docs Updated
- AI_CONTRACT.md: no - no agent rule changes
- 0_ARCHITECTURE.md: yes - added ingestion rules subsection and expanded words table schema
- 0_BUILD_CONVENTIONS.md: no - no convention changes
- 0_PRODUCT_ROADMAP.md: no - no scope changes
