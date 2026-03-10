# Fix Log – 2026-03-09 – Stuck Loading State and Admin Preload Fixes

## Context

Two reported bugs triggered this batch:
1. After a crash or session expiry, reloading any page in the app left users permanently stuck on a loading screen with no way to navigate — the entire app was unusable until a hard browser refresh.
2. The "Preload targets with missing content" function on `/words/admin` could run for 10+ minutes on large character sets and had no way to cancel, abort, or recover from a stalled AI request.

## Root Cause

**Bug 1 — Permanent stuck loading:**
The initial `refreshAll()` call in `useWordsWorkspaceState` was not wrapped in try/catch. After a crash, Supabase's session may be expired or missing, causing `getSessionMetadata()` to throw `"No active Supabase session"`. The exception propagated through the bare IIFE and `setLoading(false)` was never called. Every page in the app rendered a permanent loading state with no error message.

A secondary variant of the same pattern existed on the admin page: `setAdminLoading(false)` was placed inside an `if (!active) return` guard in the `finally` block. When the `[page, words]` effect re-ran (e.g. when words loaded and triggered a second effect execution), the in-flight async was abandoned with `active = false`, which caused `setAdminLoading(false)` to be skipped, permanently locking the admin loading indicator.

**Bug 2 — Preload hang:**
- The preload loop was fully serial (one `await` per character). At 4 s average LLM latency per character, 100 characters = ~7 min. No mechanism to interrupt.
- `fetch()` calls had no timeout or `AbortController` signal. A single stalled DeepSeek request could freeze the entire loop indefinitely.
- No cancel button; once started, the only escape was a hard page refresh (losing all partial results).
- The API route resolved all 5 prompt templates on every incoming request regardless of which mode was actually used, adding ~8 wasted Supabase round-trips per character in `full` mode.

## Changes Applied

**Fix 1 — Wrap `refreshAll` in try/catch/finally**
- `src/app/words/shared/words.shared.state.ts`
- Added `try/catch/finally` around the initial data load. The `catch` block calls `setLoadError(str.common.loadError)` and `console.error`. `setLoading(false)` is now in `finally`, guaranteeing it runs regardless of what throws.

**+ Error surfacing**
- `src/app/words/shared/state/useWordsBaseState.ts` — added `loadError` / `setLoadError` state.
- `src/app/words/words.strings.ts` — added `common.loadError` string in both `en` and `zh`.
- `src/app/words/shared/WordsShell.tsx` — renders a red error banner above page content when `loadError` is non-null. Visible on every route in the app.

**Fix 2 — `adminLoading` stuck after effect re-run**
- `src/app/words/shared/words.shared.state.ts`
- Moved `setAdminLoading(false)` to the top of the `finally` block, before the `if (!active) return` guard. Loading state now always clears; new effect runs immediately set it back to `true` if needed.

**Fix 3 — 30-second AbortController timeout on LLM fetch**
- `src/app/words/shared/words.shared.state.ts` — `requestFlashcardGeneration()`
- Added `AbortController` with a 30-second timeout. The signal is passed to `fetch`. Timeout is cleaned up in `finally`. A stalled request throws an abort error, which the preload loop counts as a per-batch failure and continues.

**Fix 4 — Batched concurrency (3 at a time)**
- `src/app/words/shared/words.shared.state.ts` — `handleAdminPreloadAll()`
- Replaced the serial `for` loop with batched `Promise.allSettled`, processing 3 targets per batch. Reduces a 100-character preload from ~7 min to ~2–3 min. Batch size fixed at 3 to stay within safe single-session concurrency limits.

**Fix 5 — Cancel button**
- `src/app/words/shared/state/useAdminState.ts` — added `preloadCancelRef` (ref flag), `adminPreloadCancelling` state, and `cancelAdminPreload()` function.
- `src/app/words/shared/words.shared.state.ts` — the batch loop checks `preloadCancelRef.current` at the start of each batch. On cancel, the loop breaks; partial results are preserved; the notice reads "Preload cancelled." with counts.
- `src/app/words/admin/AdminSection.tsx` — "Cancel" button appears next to the Preload button while running; shows "Cancelling…" once clicked (one-shot, disabled after).
- `src/app/words/words.strings.ts` — added `buttons.cancelPreload`, `buttons.cancellingPreload`, `preloadingBatchProgress`, and `preloadCancelled` strings in both `en` and `zh`.

**Fix 6 — Lazy prompt resolution in the API route**
- `src/app/api/flashcard/generate/route.ts`
- Moved each `resolveSystemPrompt()` call inside its respective mode branch. A `mode: "full"` preload request now fires 2 Supabase queries instead of 10 per request.

## Architectural Impact

- **UI layer:** `WordsShell` now renders a persistent error banner when the initial data load fails. All section pages remain navigable.
- **Domain layer:** Preload concurrency model changed from serial to batched-parallel. Cancel and timeout are handled in-component with refs and `AbortController`; no new global state or external APIs introduced.
- **Service layer:** No changes. `supabase-service.ts` untouched.
- **AI layer:** API route now performs lazy prompt resolution — only the prompt type for the active `mode` is resolved per request.
- **Layer boundaries:** No boundaries crossed or violated.

## Preventative Rules

1. Any `useEffect` that calls async operations setting loading state must use `try/catch/finally` with `setLoading(false)` in the `finally` block. Never place `setLoading(false)` after `await` without a `finally` guard.
2. `setXxxLoading(false)` in a `finally` block must never be inside an `if (!active) return` check — the loading state must always clear, regardless of whether the effect was superseded. Only data-mutation state setters should be guarded by `active`.
3. All client-side `fetch` calls to AI generation routes must carry an `AbortController` signal with a timeout to prevent indefinite hangs.
4. Batch size for concurrent AI requests is fixed at 3. Do not increase without validating provider rate limits and documenting a backoff policy.

## Docs Updated

- `AI_CONTRACT.md`: no — no changes to agent rules, hard stops, or scope boundaries.
- `0_ARCHITECTURE.md`: **yes** — appended rule #11 to Content Admin Curation Rules documenting batch concurrency, rate limit cap, retry policy, and error policy. Renumbered subsequent tag-filter rules to 12–14.
- `0_BUILD_CONVENTIONS.md`: no — the preventative rules above are internal to the admin preload subsystem and do not rise to the level of a global build convention.
- `0_PRODUCT_ROADMAP.md`: no — no feature scope change; all changes are bug fixes and reliability improvements to existing shipped features.
- `docs/architecture/2026-02-27-content-admin-curation-flow.md`: **yes** — updated Operational Caveat #3 and Extension Guardrail #4 with resolved status, batch concurrency rationale, and rate limit policy.
