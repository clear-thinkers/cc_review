# Fix Log – 2026-03-03 – Notification Text Bilingual Encoding

## Context
Admin form validation notifications were displaying both English and Chinese text simultaneously, with the Chinese part showing as mojibake (乱码) due to improper encoding handling. Affected 8 distinct notification messages used during content curation workflows.

## Root Cause
Multiple hardcoded bilingual strings were concatenated in validation logic within `showAdminManualEditPopup()` and inline admin form handlers:
- Manual edit required popup
- Phrase input validation  
- Phrase must include character validation
- Meaning input validation
- Example input validation  
- Example must include phrase validation

The garbled Chinese characters indicated double-encoding or UTF-8 text being displayed incorrectly. Per BUILD_CONVENTIONS § 2, all user-facing text must respect the chosen locale — never show both languages simultaneously.

## Changes Applied

### [src/app/words/words.strings.ts](src/app/words/words.strings.ts)
Added 6 new validation message strings to admin messages in both locales:
- EN: `meaningRequired: "Enter meaning before saving."`
- EN: `phraseRequired: "Enter a phrase before saving."`
- EN: `phraseMustInclude: "Phrase must include {character}."`
- EN: `exampleRequired: "Enter an example before saving."`
- EN: `exampleMustInclude: "Example must include the phrase."`
- ZH: `"请输入释义后再保存。"`
- ZH: `"请输入短语后再保存。"`
- ZH: `"短语需要包含汉字 {character}。"`
- ZH: `"请输入例句后再保存。"`
- ZH: `"例句需要包含短语。"`

### [src/app/words/shared/words.shared.state.ts](src/app/words/shared/words.shared.state.ts)
Replaced 7 hardcoded bilingual mojibake notifications with locale-aware strings:

**Line 1174**: `phraseRequired`
```typescript
// Before
setAdminNotice("è¯·è¾"å…¥è¯ç»„åŽå†ä¿å­˜ / Enter a phrase before saving.");

// After
setAdminNotice(str.admin.messages.phraseRequired);
```

**Line 1179**: `phraseMustInclude` (with character variable)
```typescript
// Before
setAdminNotice(`è¯ç»„éœ€åŒ…å«æ±‰å­— "${target.character}" / Phrase must include ${target.character}.`);

// After
setAdminNotice(str.admin.messages.phraseMustInclude.replace("{character}", target.character));
```

**Lines 1267, 1273**: `meaningRequired` and `phraseRequired`
```typescript
setAdminNotice(str.admin.messages.meaningRequired);
setAdminNotice(str.admin.messages.phraseRequired);
```

**Line 1278**: `phraseMustInclude` (duplicate context)
```typescript
setAdminNotice(str.admin.messages.phraseMustInclude.replace("{character}", target.character));
```

**Line 1284**: `exampleRequired`
```typescript
// Before
setAdminNotice("è¯·è¾"å…¥ä¾‹å¥åŽå†ä¿å­˜ / Enter an example before saving.");

// After
setAdminNotice(str.admin.messages.exampleRequired);
```

**Line 1289**: `exampleMustInclude`
```typescript
// Before
setAdminNotice("ä¾‹å¥éœ€åŒ…å«è¯ç»„ / Example must include the phrase.");

// After
setAdminNotice(str.admin.messages.exampleMustInclude);
```

**Line 1006** (from previous commit): `manualEditRequired` (already fixed)

## Architectural Impact
- UI layer only — all validation notifications now respect locale selection
- No schema, domain, service, or scheduler changes
- Maintains clean separation: strings in `words.strings.ts`, composition in state
- Validation logic unchanged; only message source moved to strings file

## Preventative Rule
Never hardcode bilingual text (English + Chinese mixed) in any notification, alert, or user-facing message. All multi-language content must be extracted to `*.strings.ts` files and composed via the current locale (`str` object). This applies to:
- Alert dialogs
- Toast/notification messages
- Form validation errors
- Admin UI feedback messages

## Docs Updated
- **AI_CONTRACT.md**: No — contract unchanged
- **0_ARCHITECTURE.md**: No — no boundary/schema impact
- **0_BUILD_CONVENTIONS.md**: No — BUILD_CONVENTIONS § 2 already prohibits hardcoding; these fixes enforce existing rule
- **0_PRODUCT_ROADMAP.md**: No — bug fix only

