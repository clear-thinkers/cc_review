---
title: Fix Log – 2026-09-14 – Pinyin alignment fabricates garbage on token-count mismatch
---

## Context

User reported wrong pinyin displayed in two places (screenshots):
1. A fill-test example's phrase pill for "昂首挺胸" showed `s h o 3u` instead of `áng shǒu tǐng xiōng`.
2. A Content Admin phrase example for "我们班同学同心协力，终于赢得了拔河比赛。" showed pinyin ending in `... bǐ sài sài sài` (duplicated) instead of `... bǐ sài` once.

## Root Cause

Both bugs live in `alignPinyinPartsForCount` (`src/app/words/shared/words.shared.utils.tsx`), the shared helper that aligns a stored pinyin string to a per-Hanzi-character array for ruby rendering (`renderPhraseWithPinyin`, `renderSentenceWithPinyin`, and `flashcard.ruby.ts`'s `getAlignedPinyinTokens`), used whenever the naive whitespace-token count doesn't equal the Hanzi character count.

Two distinct defects:

1. **Fabricated padding**: when the real tokenized pinyin had *fewer* tokens than the Hanzi count and no exact-count compact segmentation was found, the code padded the deficit by repeating the **last real token** (`[...tokens, ...Array(deficit).fill(tokens[tokens.length - 1])]`). For the 拔河比赛 example, the stored pinyin tokenized short by 2, so the fallback duplicated `sài` twice, producing `sài sài sài`.
2. **Overly permissive syllable validator**: `isLikelyPinyinSyllable` (used by `segmentCompactPinyin`'s brute-force DFS, the compact-pinyin-without-spaces fallback) used the regex `/[a-zv]+[1-5]?$/` with **no `^` start anchor and no vowel requirement**. This let nonsense substrings like `"s"`, `"h"`, or `"3u"` pass as "valid syllables" (the unanchored `$`-only regex matches any trailing letter run, and no vowel was ever required). Because the DFS tries the shortest candidate length first at each position, it greedily accepted single-letter garbage, reproducing `s h o 3u` for a phrase whose real pinyin should have been 4 real syllables.

Both defects directly violate the already-documented rule in `0_BUILD_CONVENTIONS.md §7`: "When token count mismatches, render Hanzi without pinyin — no placeholder." The code was guessing/fabricating instead of declining.

## Changes Applied

`src/app/words/shared/words.shared.utils.tsx`:
- `isLikelyPinyinSyllable`: anchored the regex at the start and required an actual vowel (`a/e/i/o/u/v`) — `/^[a-z]*[aeiouv][a-z]*[1-5]?$/` — so single-consonant or digit-fronted fragments can no longer pass as syllables.
- `alignPinyinPartsForCount`: removed both guessing fallbacks (truncating extra tokens, padding with a repeated last token). When neither the direct regex tokenization nor the compact DFS segmentation produces an exact-count match, it now returns an all-blank array (`Array(partCount).fill("")`), matching the documented "no placeholder" behavior.

`src/app/words/review/flashcard/flashcard.ruby.test.ts`:
- Updated a test (`"returns available tokens when counts still mismatch"`) that had encoded the old duplicate-padding bug as expected behavior (asserted `getAlignedPinyinTokens("新知", "xīn")` returns 2 tokens by padding). Now asserts it returns only the 1 real token — no fabrication.

`src/app/words/shared/words.shared.utils.test.tsx`:
- Added two regression tests under "pinyin rendering regression guard" reproducing both screenshot bugs directly: no `sài` duplication when padding would otherwise occur, and no single-letter/garbage syllable tokens from a malformed compact pinyin string.

## Architectural Impact

None. Pure-function fix confined to one shared rendering/domain utility file; no layer boundary crossed, no schema/API/RLS/AI surface touched.

## Preventative Rule

None needed beyond what's already documented in `0_BUILD_CONVENTIONS.md §7` — this fix brings the code into compliance with that existing rule rather than introducing a new one.

## Note on remaining garbled data

This fix stops the UI from ever fabricating garbage pinyin going forward. It does **not** retroactively repair any already-corrupted pinyin values already persisted in `vocab_phrases`/`flashcard_contents` — after this fix, a phrase/example with a genuinely mismatched stored pinyin will render with **no pinyin** (blank ruby) instead of wrong pinyin. If the two example sentences from the screenshots still need correct pinyin displayed, an admin should use Content Admin's existing batch "refresh pinyin" action (`0_ARCHITECTURE.md`, Content Admin Curation Rule 11) to regenerate pinyin for those specific phrases via `/api/vocab-phrase/generate` (`mode: "example_pinyin"`) — this is a data-repair step, not a code change, and wasn't performed here since it requires selecting specific phrases in a live family's data.

## Docs Updated
- AI_CONTRACT.md: no — no hard stop or scope boundary involved
- 0_ARCHITECTURE.md: no — no behavior/rule change, brings code into compliance with an existing documented rule
- 0_BUILD_CONVENTIONS.md: no — the "no placeholder on mismatch" rule already existed in §7; this fix implements it correctly
- 0_PRODUCT_ROADMAP.md: no — bug fix within already-shipped item D (Phrase-keyed input), no scope change
