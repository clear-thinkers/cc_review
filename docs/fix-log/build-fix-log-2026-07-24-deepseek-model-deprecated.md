---
title: Fix Log – 2026-07-24 – DeepSeek Model Alias Deprecated ("Failed to generate flashcard content")
---

## Context

User reported that editing an existing example sentence in Content Admin (e.g. changing
`很久没弹钢琴，手法有些生疏了。` to `很久没弹钢琴，我的手法有些生疏了。`) threw "Failed to generate
flashcard content" and no AI content was generated at all. User suspected the AI provider was down.

## Root Cause

Not an outage. DeepSeek retired the `deepseek-chat` model alias. A direct request to
`https://api.deepseek.com/chat/completions` with `model: "deepseek-chat"` now returns:

```
HTTP 400 invalid_request_error: "The supported API model names are deepseek-v4-pro or
deepseek-v4-flash, but you passed deepseek-chat."
```

`DEEPSEEK_MODEL=deepseek-chat` was set in both `.env.local` and `.env.production.local`, and
`DEFAULT_DEEPSEEK_MODEL` in `src/app/api/flashcard/generate/route.ts` had the same stale value as
its fallback. Every call to `/api/flashcard/generate` — all modes (`full`, `phrase`, `example`,
`phrase_details`, `meaning_details`, `example_pinyin`) — failed at the DeepSeek fetch call inside
`callDeepSeek()`, which throws and is caught by the route's outer catch, producing the generic
"Failed to generate flashcard content." error. This wasn't specific to the user's edit — editing
an example sentence triggers a live `example_pinyin` regeneration call (`generateExamplePinyin` in
`words.shared.state.ts`), which hit the same broken model name as every other generation path.

Confirmed the fix by calling the DeepSeek API directly with `deepseek-v4-flash` and
`deepseek-v4-pro` — both returned `200`.

## Changes Applied

- `src/app/api/flashcard/generate/route.ts`: `DEFAULT_DEEPSEEK_MODEL` changed from
  `"deepseek-chat"` to `"deepseek-v4-flash"` (user's choice — faster/cheaper, appropriate for
  short phrase/example/pinyin generations).
- `.env.local`, `.env.production.local`: `DEEPSEEK_MODEL` updated from `deepseek-chat` to
  `deepseek-v4-flash`.
- Added `src/app/api/flashcard/generate/route.test.ts` — first test coverage for this route.
  Covers: default model fallback (regression guard against the deprecated alias), respecting an
  explicit `DEEPSEEK_MODEL` env override, the provider-rejection error path (502 + generic
  message, matching `0_ARCHITECTURE.md §5` error-handling rules), and missing-API-key (503).

**Action still required by the user:** `.env.production.local` is gitignored and only affects
local tooling/scripts — it is not necessarily what the deployed production app reads at runtime.
The `DEEPSEEK_MODEL` environment variable must also be updated in whatever platform actually
hosts the production deployment (e.g. Vercel project environment variables) for the live site to
pick up this fix.

## Architectural Impact

None. Fix is entirely within the AI/API layer (`src/app/api/flashcard/generate/route.ts`) plus
local env config. No schema, RLS, route, or prompt-orchestration-logic changes — only the model
identifier sent to the existing provider. Error-handling behavior for AI generation failures is
unchanged and still matches `0_ARCHITECTURE.md §5`.

## Preventative Rule

Provider-side model deprecations are invisible until every generation call starts failing with a
generic error. The new regression test asserts the default model is not the known-deprecated
`deepseek-chat` string, so a future revert or copy-paste of the old default will fail CI instead
of failing silently in production. If DeepSeek deprecates `deepseek-v4-flash`/`deepseek-v4-pro` in
the future, repeat this diagnosis: curl the endpoint directly with the configured model before
assuming an outage.

## Docs Updated
- AI_CONTRACT.md: no — no hard stop or boundary touched.
- 0_ARCHITECTURE.md: no — error-handling behavior (§5) is unchanged, just now actually reachable on the success path.
- 0_BUILD_CONVENTIONS.md: no — no new convention introduced.
- 0_PRODUCT_ROADMAP.md: no — no scope change.
