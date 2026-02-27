# Content Admin Curation - Processing Flow and Risks

_Created: 2026-02-27_
_Covers: `/words/admin` route, target loading, draft/edit/save operations, preload, and filter stats_

> Authoritative behavior rules are maintained in `0_ARCHITECTURE.md` under `Content Admin Curation Rules`.
> This companion doc covers implementation flow, constraints, and operational risks.

---

## Entry Point

- Route: `/words/admin`
- UI host: `WordsWorkspace` with `page="admin"`

---

## Processing Flow

1. On admin page load, build unique Hanzi inventory from `words` (including legacy multi-character rows by splitting to individual Hanzi).
2. Resolve pronunciations per Hanzi from Xinhua and build deduplicated targets keyed by `character|pronunciation`.
3. Load persisted `flashcardContents` per target and seed editable JSON drafts.
4. Render table rows from normalized draft content, including placeholder rows for empty targets.
5. Support per-target and per-row actions:
   - regenerate full target
   - save normalized draft
   - delete persisted target content
   - add/save/cancel meaning and phrase rows
   - regenerate/edit/save/delete example rows
6. `FT On/Off` toggles `include_in_fill_test` and persists immediately.
7. `Preload Missing` iterates targets, skips existing content, generates missing content, and persists successful results.

---

## Content Status Derivation

Stats/filter buckets are computed from normalized draft content per target:

- `with content`: target has at least one phrase row
- `missing content`: target has no phrase rows
- `ready for testing`: target has content and at least one phrase with fill-test inclusion
- `excluded for testing`: target has content but no phrase included for fill test

---

## Operational Caveats

1. Duplicate Hanzi race conditions from add flow can inflate target inventory before deduping by `character|pronunciation`.
2. Row identity and mutations depend on value matching and are sensitive to concurrent local edits.
3. Sequential preload can be slow for large target sets.
4. Table derivations repeatedly parse/normalize drafts and may degrade at larger scales.
5. Deleting target content does not alter `words` inventory rows.

---

## Extension Guardrails

1. Keep save pipeline as draft -> normalize -> persist.
2. Keep `flashcardContents` key contract as `character|pronunciation` unless architecture review explicitly approves change.
3. Do not introduce scheduler or `words` writes from this page.
4. If switching preload to parallel/batch execution, define rate limits, retries, and error policy first.
5. If changing fill-test semantics, update both admin status definitions and due-review derivation docs.

---

## Archive Note

- Source file archived from `docs/architecture/2026-02-27-content-admin-page.md` to `docs/archive/2026-02/2026-02-27-content-admin-page.md` on 2026-02-27.
