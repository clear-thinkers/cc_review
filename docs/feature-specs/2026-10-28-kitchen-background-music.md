# Feature Spec — 2026-10-28 — Kitchen Background Music

Roadmap item **R**. A small presentational add-on to Shop Kitchen (item J); no schema, RPC, route, RLS, or AI change.

## Status

Approved 2026-10-28 (scope confirmed by the owner: add as item R with a spec; mute covers the music only; the track is instrumental).

## Problem

Shop Kitchen is silent apart from the dish-reveal chime. The owner made an instrumental track (Suno) to give the kitchen some atmosphere.

## Scope

- Loop `public/sound/kitchen_01.mp3` (instrumental, ~3.3 MB) quietly while the child is on `/words/shop/kitchen`.
- A mute toggle on the kitchen page, remembered per profile on that device.
- The music dips while the dish-reveal popup is open so the celebration chime is clearly heard.

## Out of scope

- Muting the celebration chime (in the kitchen or the quiz screens) — owner chose "music only".
- An app-wide sound setting, a volume slider, more than one track, music on any other page.
- Persisting the mute choice in the database (would need a schema migration).

## Proposed behavior

1. **Track and level.** One cached `HTMLAudioElement` (`kitchenMusic.sound.ts`, same pattern as `shared/coins.sound.ts`), `loop = true`, volume `KITCHEN_MUSIC_VOLUME` (0.3).
2. **Starting.** When the kitchen page is showing and the music is not muted, the app tries to play straight away (works when the child arrived by clicking the nav link, since the browser already counts that as a user gesture). If the browser blocks autoplay, playback starts on the child's first tap or key press anywhere on the page. A blocked or failed play never shows an error.
3. **Stopping.** Leaving the kitchen page pauses the music; returning resumes it from where it stopped. Switching to another tab or app pauses it; coming back resumes it (unless muted).
4. **Ducking.** While the dish-reveal popup (`KitchenDishReveal`) is open, the volume drops to `KITCHEN_MUSIC_DUCKED_VOLUME` (0.1) and returns to normal when it closes.
5. **Mute toggle.** A small 🔊/🔇 button in the kitchen page header (outside the illustration, so it can never cover a hotspot or the chef). Muting pauses the music at once; unmuting plays it (the click itself is the user gesture). Bilingual label + ARIA text from `kitchen.strings.ts`. The chime is unaffected.
6. **Remembering mute.** Stored in `localStorage` under `hq-kitchen-music-muted:<userId>` (`"1"` = muted, anything else/missing = playing), the same per-profile precedent as the chef's seen-unlock flag (Shop Kitchen Rule 18). Storage being unavailable just means the default (playing) is used.

## Layer impact

UI only: new `kitchenMusic.sound.ts`, new `useKitchenMusic.ts`, edits to `KitchenSection.tsx` and `kitchen.strings.ts`. No service, domain, or AI change.

## Edge cases

- **Autoplay blocked** (direct URL load / page refresh): waits for the first tap; never errors.
- **Missing or undecodable file:** `play()` rejects → warned in the console, kitchen works normally.
- **Profile switch on the same device:** the mute choice is re-read for the new profile.
- **Muted before the first tap:** nothing ever plays.
- **Dish reveal while muted:** nothing to duck; the chime still plays.

## Risks

- A 3.3 MB file on first kitchen visit. Acceptable — the browser streams it and caches it afterwards; `preload` is left to the browser.
- Background music could annoy or distract; the mute button is one tap and remembered.

## Test plan

- Unit (`kitchenMusic.test.ts`): storage-key builder, mute parse/serialize round trip and junk input, volume resolution (normal / ducked).
- `kitchen.strings` parity test covers the new keys.
- Manual in-browser: arrive via nav → music plays; refresh → plays after first tap; mute → stops and stays muted after reload; unmute → plays; cook → music dips during the reveal and returns; leave the page → stops; switch tabs → pauses/resumes.

## Acceptance criteria

- [ ] Music loops quietly on the kitchen page and nowhere else.
- [ ] Mute toggle works, is bilingual, and is remembered per profile.
- [ ] Music dips during the dish reveal; the chime is unchanged.
- [ ] No console errors other than a warning when autoplay/playback fails.
- [ ] `tsc`, `eslint`, `npm test`, `check:encoding` pass.

## Open questions

None.
