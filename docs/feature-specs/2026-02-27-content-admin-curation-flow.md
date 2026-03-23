# Content Admin Curation - Processing Flow and Risks

_Created: 2026-02-27_
_Last updated: 2026-03-11_ (Added pagination (25 rows/page) and default filters bar)
_Covers: `/words/admin` route, target loading, draft/edit/save operations, preload, filters, and pagination_

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

## Default Filters and Pagination

**Filters** (always visible above the table):
- **Due Now**: Checkbox to show only targets whose character(s) have `nextReviewAt <= now` in the `words` table.
- **Tags (Cascade)**: Multi-select dropdown showing all available cascade tags (`TextbookName · Grade · Unit · Lesson`). AND logic: target must have a word with ALL selected tags to be shown.
- **[Clear Filters]** button resets all filters.

**Pagination**:
- Table displays 25 rows per page (different from `/words/all` which uses 50).
- Navigation: `First`, `Previous`, `Next`, `Last` buttons.
- Page info shows "Page X of Y".
- Pagination applies after all stats-based and default filters are applied.
- Filters reset to page 1 when changed.

**Preload and Refresh Buttons**:
- "Generate phrases and examples" and "Regenerate missing pinyin" pills now apply to only the characters visible on the current page.
- Buttons are disabled if the current page has no rows.

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
3. Preload runs in batches of 3 concurrent requests (`Promise.allSettled`). Batch size was chosen to reduce total preload time (~3× faster than serial) while staying within safe concurrency limits for a single-user admin session against the AI provider. This is not a guarantee against rate limiting — if the provider returns 429s at this concurrency level, reduce batch size to 1 and revert to serial execution.
4. Table derivations repeatedly parse/normalize drafts and may degrade at larger scales.
5. Deleting target content does not alter `words` inventory rows.
6. **Pagination scope** (2026-03-11): Default filters and pagination are applied in sequence: stats-based filters first, then default filters (due now, tags), then pagination. The preload and refresh buttons process only the targets visible on the current page, not all filtered targets. If the admin resets page 1 when filters change, the user may lose contextual scroll position.

---

## Extension Guardrails

1. Keep save pipeline as draft -> normalize -> persist.
2. Keep `flashcardContents` key contract as `character|pronunciation` unless architecture review explicitly approves change.
3. Do not introduce scheduler or `words` writes from this page.
4. If switching preload to parallel/batch execution, define rate limits, retries, and error policy first. Resolved (2026-03-09): Preload uses `Promise.allSettled` with batch size 3. Rate limit policy: cap at 3 concurrent requests per preload run; no automatic backoff implemented — reduce to 1 if 429s are observed. Retry policy: no per-character retry; failures are non-fatal and the loop continues to the next batch. Error policy: final notice reports succeeded count and failed count; individual failures are logged to console. Do not increase batch size without re-evaluating provider rate limits.
5. If changing fill-test semantics, update both admin status definitions and due-review derivation docs.
6. **Pagination scope** (2026-03-11): The preload and refresh buttons now operate only on targets visible on the current page. When modifying these buttons, ensure they respect the paginated row set and disable appropriately when the current page is empty. If batch processing scope needs to change, update this caveat and the affecting button handlers.
7. **Filter scope**: Default filters scope both the stats cards and the table display. When adding new filters, ensure they propagate to the paginated row set and stat count derivations consistently.

---

## Archive Note

- Source file archived from `docs/architecture/2026-02-27-content-admin-page.md` to `docs/archive/2026-02/2026-02-27-content-admin-page.md` on 2026-02-27.
