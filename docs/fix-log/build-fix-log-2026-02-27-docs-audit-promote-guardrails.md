# Fix Log – 2026-02-27 – Audit and promote companion‑doc guardrails

## Context
Following an initial round of documentation updates, the reviewer pointed out that some behavioral rules remained locked in companion flow documents (`2026-02-27-content-admin-curation-flow.md` and others) and therefore were not authoritative. Test example wording also needed clarification.

## Root Cause
The first patch added a companion‑doc audit requirement but did not actually move the specific rules themselves. The audit requirement hinged on developers performing the promotion, which hadn't yet occurred. Additionally, the earlier test example used a placeholder function name that doesn't exist in the codebase.

## Changes Applied
- Added an “Extension Guardrails (promoted from companion docs)” subsection under Content Admin Curation Rules in `0_ARCHITECTURE.md` containing five invariants pulled from the companion doc.  
- Added a cross‑reference bullet to Due Review Queue Rules reminding maintainers that fill-test semantics changes must update both docs.  
- Clarified the normalization test example in `0_BUILD_CONVENTIONS.md` to reference the real function (`normalizeFlashcardLlmResponse` or similar).  
- Documented these changes in a new fix log.

## Architectural Impact
These updates have no code impact but ensure the authoritative architecture document fully encapsulates all behavioral rules, preventing agent drift and human oversight.

## Preventative Rule
After auditing or editing a companion flow doc, always perform the explicit promotion step immediately; do not rely solely on the audit requirement clause.

## Docs Updated
- AI_CONTRACT.md: no — unchanged this round
- 0_ARCHITECTURE.md: yes — added promoted guardrails and cross‑doc reminder
- 0_BUILD_CONVENTIONS.md: yes — clarified normalization example
- 0_PRODUCT_ROADMAP.md: no — unchanged this round
