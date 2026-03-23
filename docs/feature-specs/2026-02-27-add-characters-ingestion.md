# Add Characters — Ingestion Flow and Known Risks

_Created: 2026-02-27_
_Covers: `/words/add` route, `extractUniqueHanzi`, `bulkAdd`, `refreshAll`_

> For ingestion rules and data schema, see `0_ARCHITECTURE.md §1` and `§3`.
> This doc covers implementation flow and known risks only.

---

## Entry Point

- Route: `/words/add`
- UI host: `WordsWorkspace` with `page="add"`
- Accessible from: main navigation

---

## Processing Flow

1. User submits form.
2. Input is trimmed — empty input is rejected with a bilingual notice.
3. `extractUniqueHanzi(input)` parses a deduplicated Hanzi list from the raw input.
4. DB query fetches all Hanzi entries already present in the `words` table.
5. New `Word` objects are created for the remaining (non-duplicate, non-existing) Hanzi.
6. `bulkAdd(newWords)` writes all new words in a single operation.
7. `refreshAll()` refreshes the words list and due words count in the UI.

---

## Known Risks

1. **No server sync.** Data is local IndexedDB only. No backup or cross-device sync exists.

2. **Check-then-add is not atomic across tabs or sessions.** If two submissions race, the same Hanzi can be inserted twice because `hanzi` is indexed but not enforced as unique at the DB level. This is a known limitation — do not attempt to fix it without explicit instruction, as the fix requires a schema migration.

3. **No auto-generation of flashcard content.** Adding a character here does not trigger AI generation. The character must be curated separately in Content Admin before it appears in review flows.

4. **No semantic grouping.** Input parsing extracts individual Hanzi only — multi-character words are split into characters. Semantic grouping is intentionally not supported in Tier 1.

