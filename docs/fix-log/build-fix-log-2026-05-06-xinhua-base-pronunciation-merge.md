---
title: Fix Log - 2026-05-06 - Xinhua Base Pronunciation Merge
---

## Context
The character `悄` was present in input data, but only the third-tone pronunciation `qiǎo` displayed. The expected first-tone pronunciation `qiāo` was missing from the app's pronunciation candidates.

## Root Cause
`public/data/char_detail.json` contains only `qiǎo` for `悄`, while `public/data/char_base.json` contains both `qiǎo` and `qiāo`. The Xinhua loader read only `char_detail.json`, so any pronunciation present only in the base file was lost before Content Admin or flashcard review could render it.

## Changes Applied
- Updated `src/lib/xinhua.ts` to load `char_base.json` in addition to `char_detail.json`.
- Added an indexed base lookup and merged base pronunciations with detail pronunciations, preserving detail order and deduping duplicate pinyin values.
- Added a regression test in `src/lib/xinhua.test.ts` covering the `悄` detail/base mismatch.

## Architectural Impact
This stays within the domain/static-data layer. No UI, service, database schema, RLS, scheduler, coin, or AI/API boundary changed.

## Preventative Rule
When deriving pronunciation candidates from Xinhua data, treat `char_detail.json` as the primary source and `char_base.json` as a supplementary source; do not assume the trimmed detail file contains every pronunciation variant.

## Docs Updated
- AI_CONTRACT.md: no - no hard stop, boundary, or agent rule changed.
- 0_ARCHITECTURE.md: no - static-data behavior remains within the existing Xinhua pronunciation candidate rule.
- 0_BUILD_CONVENTIONS.md: no - no build or test convention changed.
- 0_PRODUCT_ROADMAP.md: no - shipped pronunciation behavior fix only.

---

## Retry Attempt - 2026-05-06

### Why the Prior Attempt Failed
The first attempt merged base pronunciations by exact string. Xinhua base data sometimes spells pinyin `g` as the phonetic letter `ɡ`; for example, `char_detail.json` has `东 -> dōng`, while `char_base.json` has `东 -> dōnɡ`. Those strings look almost identical in the UI but produced different `character|pronunciation` keys.

### Revised Root Cause
The missing `悄 -> qiāo` pronunciation still came from relying only on detail data, but the merge also needed pinyin canonicalization before dedupe and target-key creation.

### Changes Applied
- Canonicalized Xinhua pinyin by converting `ɡ` to `g` before pronunciation dedupe.
- Added a regression test proving `东` does not produce duplicate `dōng`/`dōnɡ` pronunciation targets.
- Updated `0_ARCHITECTURE.md` Static Data notes to document the supplementary base source and canonicalization rule.

### Architectural Impact
Still contained to the domain/static-data layer. No UI, service, database schema, RLS, scheduler, coin, or AI/API boundary changed.

### Preventative Rule
Normalize pinyin glyph variants before deduping or constructing `character|pronunciation` keys.

### Docs Updated
- AI_CONTRACT.md: no - no hard stop, boundary, or agent rule changed.
- 0_ARCHITECTURE.md: yes - static-data pronunciation sources and canonicalization are now documented.
- 0_BUILD_CONVENTIONS.md: no - no build or test convention changed.
- 0_PRODUCT_ROADMAP.md: no - shipped behavior fix only.
