# Fix Log - 2026-03-02 - Locale Hydration Mismatch

## Context
`LanguageToggle` triggered a recoverable hydration error because server-rendered text (`Language`) sometimes differed from first client render (`语言`).

## Root Cause
`LocaleProvider` read `localStorage` inside the `useState` initializer. Server render always started with `en`, but client first render could start with persisted `zh`, causing text mismatch during hydration.

## Changes Applied
- Updated locale initialization to always start from `DEFAULT_LOCALE` on first render.
- Moved persisted locale read to a mount `useEffect`.
- Added an inline hydration guardrail comment in `src/app/shared/locale.tsx`.

## Architectural Impact
- UI locale state behavior only.
- No schema, API, domain, or scheduler changes.

## Preventative Rule
Do not read browser-only mutable values (e.g., `localStorage`) in state initializers for SSR-rendered client components when they affect visible text. Load them after mount.

## Docs Updated
- AI_CONTRACT.md: no - contract unchanged.
- 0_ARCHITECTURE.md: no - no boundary/schema impact.
- 0_BUILD_CONVENTIONS.md: no - no global convention change.
- 0_PRODUCT_ROADMAP.md: no - bug fix only.
