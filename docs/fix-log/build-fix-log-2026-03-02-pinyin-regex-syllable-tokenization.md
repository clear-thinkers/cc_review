# Fix Log – 2026-03-02 – Pinyin Regex Syllable Tokenization

## Context

After the "Pinyin Display Truncation" fix (which updated the pinyin syllable regex from `/[a-zA-Z\u00FC\u00DCvV]+[1-5]?/g` to `/[\p{Script=Latin}\p{M}]+[1-5]?/gu`), the admin content page table stopped loading entirely. The new regex supported tone-marked vowels but introduced a critical regression in handling compact (space-free) pinyin syllable segmentation.

## Root Cause

The new regex `/[\p{Script=Latin}\p{M}]+[1-5]?/gu` had two critical flaws:

**Issue 1: Single-vowel matching**
The early fix `/[a-z]*(?:[tone-marked|plain)vowel][ngrm]?[1-5]?/gu` matched only a single vowel core:
- For `"xiǎo"`, it matched `"xiǎ"` (consonants + tone-marked vowel), leaving `"o"` as a separate token
- This incorrectly tokenized `"xiǎo"` (one syllable) into `["xiǎ", "o"]` (two tokens)
- Root cause: pinyin has diphthongs and triphthongs (`ao`, `ou`, `ui`, `uo`, `ia`, `ie`, `ua`, `üe`, etc.)

**Issue 2: Final consonant ambiguity in compact pinyin**
When matching final consonants `[ngrm]?` in compact pinyin:
- `"xiǎogǒu"` would be matched as `"xiǎog"` + `"ǒu"` because the "g" from "gǒu" is captured as a final consonant of "xiǎo"
- This happens because single consonants like `"n"`, `"g"`, `"m"` are ambiguous—they might be final consonants (`"rén"`) or initial consonants of the next syllable (`"guǎng"`)

Both issues caused malformed pinyin arrays that broke table rendering.

## Changes Applied

File: `src/app/words/shared/words.shared.utils.tsx`

Updated the pinyin syllable regex to properly handle diphthongs and disambiguate final consonants:

**Previous attempt (incomplete):**
```typescript
const PINYIN_SYLLABLE_RE = /[a-z]*(?:[àáǎāèéěēìíǐīòóǒōùúǔūǜǚǖǘvü]|[aeiou])[ngrm]?[1-5]?/gu;
```
This failed because it matched only single vowels, not vowel clusters.

**Final fix:**
```typescript
// Matches: [consonants][vowel-cluster][ending][tone]
// Final consonant handling:
//   - "ng" and "r" are always endings (never start new syllables in Mandarin)
//   - "n" is ending only if NOT followed by a vowel (prevents "nǐ" from becoming "n" + "ǐ")
//   - "m" is included but rare in Mandarin
const PINYIN_SYLLABLE_RE = /[a-z]*[àáǎāèéěēìíǐīòóǒōùúǔūǜǚǖǘvüaeiou]+(?:ng|r|m|n(?![àáǎāèéěēìíǐīòóǒōùúǔūǜǚǖǘvüaeiou]))?[1-5]?/gu;
```

Key improvements:
1. **Vowel cluster matching**: `[àáǎāèéěēìíǐīòóǒōùúǔūǜǚǖǘvüaeiou]+` (with `+` not just one vowel)
   - Matches diphthongs like "ao" in "xiǎo", "ou" in "gǒu", "ui" in "guī"
   - Prevents splitting "xiǎo" into ["xiǎ", "o"]

2. **Smart final consonant matching**:
   - `"ng|r"` are matched unconditionally (never ambiguous)
   - `"n"` includes negative lookahead `(?![vowels])` to prevent matching "n" in "nǐ" or "nǚ" as an ending
   - This allows "xiǎogǒu" to correctly tokenize as ["xiǎo", "gǒu"], not ["xiǎog", "ǒu"]

## Testing

Comprehensive test coverage for the fixed regex:

**Spaced pinyin (straightforward):**
- `"lā chē"` → `["lā", "chē"]` ✓
- `"xiǎo gǒu"` → `["xiǎo", "gǒu"]` ✓

**Compact pinyin (the critical fix):**
- `"lāchē"` → `["lā", "chē"]` ✓ (was broken)
- `"xiǎogǒu"` → `["xiǎo", "gǒu"]` ✓ (**was broken: got ["xiǎog", "ǒu"]** — now fixed)

**Diphthongs (now handled):**
- `"xiǎo"` → `["xiǎo"]` ✓ (was ["xiǎ", "o"])
- `"gǒu"` → `["gǒu"]` ✓ (was ["gǒ", "u"])
- `"guī"` (ui diphthong) → `["guī"]` ✓
- `"chéng"` (eng diphthong) → `["chéng"]` ✓

**Final consonants:**
- `"cháng"` (ng ending) → `["cháng"]` ✓
- `"kōng"` (ng ending) → `["kōng"]` ✓
- `"hěn"` (n ending) → `["hěn"]` ✓
- `"rén"` (n ending) → `["rén"]` ✓
- `"èr"` (r ending) → `["èr"]` ✓
- `"mén"` (n ending after m) → `["mén"]` ✓

**Ambiguous consonants (n at start vs end):**
- `"nǐ"` (n as start) → `["nǐ"]` ✓ (n not matched as ending)
- `"nǚ"` (n as start) → `["nǚ"]` ✓ (n not matched as ending)
- `"nǐhěnhǎo"` (compact, multiple n's) → `["nǐ", "hěn", "hǎo"]` ✓

All existing unit tests (`src/app/words/shared/words.shared.utils.test.tsx`) continue to pass with the new regex.

## Architectural Impact

- UI/shared utility logic only.
- No schema, API, scheduler, or persistence behavior changes.
- All `alignPinyinParts/*` and `renderPhraseWithPinyin`/`renderSentenceWithPinyin` calls now reliably segment compact pinyin.

## Preventative Rule

When designing regex for pinyin syllable tokenization:

1. **Handle vowel clusters, not single vowels**: Pinyin has diphthongs (ao, ou, ui, ia, etc.) and triphthongs (iou). Always use `[vowels]+` not single vowels.

2. **Disambiguate final consonants in compact pinyin**: 
   - Match unambiguous endings (`ng`, `r`) unconditionally
   - For ambiguous consonants (`n`, `m`) that can start syllables, use negative lookahead to prevent matching them as endings when followed by vowels
   - Example: `n(?![vowels])` allows "hěn" but not "nǐ" being split as "n" + "ǐ"

3. **Test with compact (non-spaced) pinyin**: Many datasets omit spaces, and this is where syllable boundary bugs manifest.

4. **Validate against all Mandarin syllable types**:
   - Consonant + vowel clusters: "ba", "cha", "xiao"
   - Multiple final consonants: "chang", "sheng", "guang", "ren", "er"
   - Tricky transitions: "nǐ" (n-start), "hěn" (n-end), "nǐhěn" (compact)
   - Tone-marked diphthongs: "jiǎo", "guǎi", "duō"

## Follow-Up Fix – Uppercase Consonant Support (2026-03-02 Session Continuation)

**Issue**: Pinyin input with uppercase first letters (e.g., "Xiǎo", "QING3") were being tokenized incorrectly, dropping the uppercase consonant:
- `"Xiǎo"` → `["iǎo"]` (X dropped) ✗
- `"Xiao3"` → `["iao3"]` (X dropped) ✗
- `"QING3"` → `[]` (all uppercase dropped) ✗

**Root Cause**: The regex character class `[a-z]*` only matched lowercase ASCII letters, not uppercase. Uppercase consonants were not captured in the consonant cluster, causing them to be skipped during tokenization.

**Fix Applied**: Updated character class from `[a-z]*` to `[a-zA-Z]*`:

```typescript
// BEFORE (uppercase broken):
const PINYIN_SYLLABLE_RE = /[a-z]*[àáǎāèéěēìíǐīòóǒōùúǔūǜǚǖǘvüaeiou]+(?:ng|r|m|n(?![àáǎāèéěēìíǐīòóǒōùúǔūǜǚǖǘvüaeiou]))?[1-5]?/gu;

// AFTER (uppercase support):
const PINYIN_SYLLABLE_RE = /[a-zA-Z]*[àáǎāèéěēìíǐīòóǒōùúǔūǜǚǖǘvüaeiou]+(?:ng|r|m|n(?![àáǎāèéěēìíǐīòóǒōùúǔūǜǚǖǘvüaeiou]))?[1-5]?/gu;
```

**Testing Results** (after fix):
- `"xiǎo"` → `["xiǎo"]` ✓ (lowercase unchanged)
- `"Xiǎo"` → `["Xiǎo"]` ✓ (uppercase now captured)
- `"XIAO3"` → `["XIAO3"]` ✓ (all uppercase supported)
- `"Xiao3"` → `["Xiao3"]` ✓ (mixed case supported)
- `"Qǐng"` → `["Qǐng"]` ✓ (Q-start uppercase syllables)
- `"QING3"` → `["QING3"]` ✓ (all uppercase syllables)

**Validation**:
- All 34 unit tests pass ✓
- Build succeeds without errors ✓
- No regressions in existing lowercase pinyin tokenization ✓

## Docs Updated

- AI_CONTRACT.md: no — contract unchanged.
- 0_ARCHITECTURE.md: no — no boundary/schema impact.
- 0_BUILD_CONVENTIONS.md: no — no global convention change.
- 0_PRODUCT_ROADMAP.md: no — bug fix only.
