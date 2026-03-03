# Fix Log - 2026-03-02 - Pinyin Display Truncation

## Context
On `/words/admin`, phrase and example pinyin appeared cut off. Example symptom: `la` rendered as `l`, and `che` rendered as `ch`.

## Root Cause
The pinyin syllable tokenizer in `src/app/words/shared/words.shared.utils.tsx` only matched ASCII letters.

- Old regex: `/[a-zA-Z\u00FC\u00DCvV]+[1-5]?/g`
- This dropped tone-mark vowels (`a/e/i/o/u` with diacritics) during tokenization.
- Resulting truncation examples:
  - `l\u0101` -> `l`
  - `ch\u0113` -> `ch`

The renderer displayed these broken tokens, so the issue appeared as UI clipping.

## Changes Applied

### 1) Tokenization fix (actual defect)
File: `src/app/words/shared/words.shared.utils.tsx`

- Replaced pinyin tokenizer regex with Unicode-aware Latin matching:
  - New regex: `/[\p{Script=Latin}\p{M}]+[1-5]?/gu`
- Added `tokenizePinyinSyllables(pinyin: string)` helper.
- Updated `alignPinyinPartsForCount` to use the helper, so all pinyin splitting goes through one code path.

### 2) Regression guardrails
File: `src/app/words/shared/words.shared.utils.test.tsx`

- Added unit tests for `tokenizePinyinSyllables` with tone-mark pinyin.
- Added render regression tests for:
  - `renderPhraseWithPinyin`
  - `renderSentenceWithPinyin`
- Tests assert `<rt>` values keep complete syllables for tone-mark input.

## Architectural Impact
- UI/shared utility logic only.
- No schema, API, scheduler, or persistence behavior changes.

## Preventative Rule
Any pinyin tokenization logic must support Unicode Latin characters with diacritics. Tokenizer changes require regression tests that verify full `<rt>` syllable output for tone-mark input.

## Docs Updated
- AI_CONTRACT.md: no - no contract-level behavior changed.
- 0_ARCHITECTURE.md: no - no boundary or data model change.
- 0_BUILD_CONVENTIONS.md: no - no global convention change.
- 0_PRODUCT_ROADMAP.md: no - bug fix only.
