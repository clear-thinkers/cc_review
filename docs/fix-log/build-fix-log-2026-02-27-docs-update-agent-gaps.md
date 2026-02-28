# Fix Log – 2026-02-27 – Docs update to close agent drift gaps

## Context
A review identified multiple documentation gaps that could lead the autonomous agent to drift from intended conventions. The gaps covered spec templates, normalization contracts, roadmap velocity signals, companion doc enforcement, test examples, destructive action policy, bilingual string parity CI, and API layer boundaries.

## Root Cause
The `0_` reference docs did not explicitly codify several important conventions and thresholds. Without clear templates and invariants, an agent under instruction pressure might skip spec creation, mis-handle validation, misinterpret status labels, ignore companion-doc rules, write insufficient tests, introduce unintended UX patterns, or breach the API/service boundary.

## Changes Applied
- Added `Feature Specs` section (with template and non-triviality trigger) to `0_BUILD_CONVENTIONS.md`.
- Inserted UX policy for destructive actions in `0_BUILD_CONVENTIONS.md`.
- Expanded testing section with domain-specific examples.
- Added bilingual string parity requirement to CI guardrails.
- Added normalization & validation rules to `0_ARCHITECTURE.md` with explicit invariants.
- Added API import prohibition and companion-doc audit requirement to `0_ARCHITECTURE.md`.
- Augmented `0_PRODUCT_ROADMAP.md` with status icons, last-touched column, and velocity guidance.
- Added hard stop about API routes importing `db.ts` to `AI_CONTRACT.md`.

## Architectural Impact
The updates clarify layer boundaries and data validation but do not change code. They strengthen the authoritative docs and reduce future drift risk.

## Preventative Rule
Whenever an agent identifies a procedural or structural gap, update the applicable `0_` docs immediately and record the change in a fix log. Explicit templates and thresholds prevent implicit assumptions.

## Docs Updated
- AI_CONTRACT.md: yes — new API boundary hard stop
- 0_ARCHITECTURE.md: yes — normalization rules, API import ban, companion-doc audit
- 0_BUILD_CONVENTIONS.md: yes — spec template, testing examples, destructive UX, bilingual lint
- 0_PRODUCT_ROADMAP.md: yes — status/velocity columns

