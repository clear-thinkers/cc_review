# Fix Log – 2026-03-09 – Keyboard PIN Entry Support

## Context
PIN entry currently only accepts clicks on the on-screen keypad. PC users found typing PIN digits directly more convenient than clicking each button.

## Root Cause
The PIN entry component (`src/app/(auth)/pin-entry/page.tsx`) only had click handlers on the numeric buttons. No keyboard event listeners were wired up.

## Changes Applied
- `src/app/(auth)/pin-entry/page.tsx`: Added keyboard input handler:
  - New `useEffect` hook listens for `keydown` events
  - Number keys (`0–9`) trigger `handleDigit()`
  - `Backspace` key triggers `handleBackspace()`
  - Input is ignored when locked out or verifying (consistent with button behavior)
  - Auto-submit still triggers when 4 digits are reached via keyboard or click

## Architectural Impact
- UI layer only — no API or service layer changes.
- No schema, RLS, or authentication flow changes.
- Keyboard and click input now have identical behavior and interaction model.

## Testing Notes
- Typing `1 2 3 4` followed by Enter should auto-submit (4 digits detected)
- Typing `1 2 3` then Backspace should return to 2 digits displayed
- Lockout after 5 failed attempts still blocks keyboard input
- No regression on click-based entry

## Docs Updated
- AI_CONTRACT.md: no — no contract behavior changed.
- 0_ARCHITECTURE.md: no — no boundary or schema change.
- 0_BUILD_CONVENTIONS.md: no — no convention change.
- 0_PRODUCT_ROADMAP.md: no — minor UX enhancement to feature #4 (auth), no new feature.
