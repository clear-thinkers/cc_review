---
title: Fix Log – 2026-10-28 – Kitchen music silent after returning to the kitchen
---

## Context
Found by the owner during QA of the new kitchen background music (roadmap item R, spec `docs/feature-specs/2026-10-28-kitchen-background-music.md`), before it was committed. After leaving Shop Kitchen and coming back, the music did not play. Muting and unmuting started it.

## Root Cause
Each `/words/*` route renders its own `WordsWorkspace`, so returning to the kitchen remounts `KitchenSection` and its `useKitchenMusic` effect. In development, React Strict Mode runs that effect as start → cleanup → start. The first attempt's `play()` was still pending when its cleanup paused the audio. When that attempt settled, its "I was cancelled" branch called `pause()` **again**. By then the second, real attempt's `play()` was pending, so this late pause rejected it (`AbortError`). The hook then fell back to waiting for a tap, so nothing played until the mute button click supplied one. Any quick re-run of the effect (not only Strict Mode) could hit the same race.

## Changes Applied
- `src/app/words/shop/kitchen/kitchenMusic.sound.ts`: the effect body moved into `startKitchenMusicPlayback({ play, pause, doc })`, which returns the stop function. A stopped attempt now just returns when it settles; it never pauses (stop already paused, and that pause rejects a pending play). `AbortError` from an interrupted `play()` is treated as expected (no console warning). The tap listeners use `{ capture: true }` instead of a bare `true`, which some `EventTarget` implementations (Node's) don't match on removal.
- `src/app/words/shop/kitchen/useKitchenMusic.ts`: the effect now calls `startKitchenMusicPlayback()`.
- `src/app/words/shop/kitchen/kitchenMusic.test.ts`: tests for the playback function using a fake audio player and fake document. They cover start → stop → start (fails on the old code), autoplay blocked then a tap, listeners removed on stop, and a hidden tab.

## Architectural Impact
None. UI layer only; no data, service, or AI change.

## Preventative Rule
An async effect's cleanup must undo its side effects itself. Code that resolves after cleanup must only bail out, never act on shared state (here, the single shared audio element), because a newer run of the same effect may already own it.

## Docs Updated
- AI_CONTRACT.md: no — no agent rule affected
- 0_ARCHITECTURE.md: yes — Shop Kitchen Rule 19 notes that a stopped start never pauses a newer one
- 0_BUILD_CONVENTIONS.md: no — no convention changed
- 0_PRODUCT_ROADMAP.md: yes — item R row references this fix
