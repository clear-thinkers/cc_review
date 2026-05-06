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
