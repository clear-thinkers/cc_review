---
title: Fix Log – 2026-08-18 – Stale vm.words/vm.vocabPhrases causes a real insert conflict on a second submission
---

## Context

Found live-testing the Phase 2 paragraph work (`docs/fix-log/build-fix-log-2026-08-18-paragraph-library-test-mode-prep.md`). Reproduced with a headless-Chromium driver against the running dev server + live dev Supabase project: import a fresh paragraph as a parent, immediately open Continue Import on that same paragraph, select one of the "remaining unknown" characters, and save — the request failed with an HTTP 409 and the form showed the generic save-error notice, even though nothing about the request should have been in conflict.

## Root Cause

Neither `AddParagraphSection.tsx`'s submit handler (Phase 1) nor `ContinueImportSection.tsx`'s (this phase) refreshed `vm.words`/`vm.vocabPhrases` after a successful `addWords`/`addVocabPhrases` call. Both components' triage passes (`triageParagraphCharacters`/`triagePhrasesInText`) read `vm.words`/`vm.vocabPhrases` from React state to decide known vs. unknown — state that was only ever loaded once, at page load, via `refreshAll()`.

Within one continuous browser session, a second submission — including Continue Import run moments after the original import of the very same paragraph, the first realistic workflow this phase introduces that reliably hits this — re-triaged against that now-stale snapshot. A character genuinely already inserted into `words` a moment earlier still read as "unknown" (its `existingWordId` didn't resolve, since `vm.words` didn't have it yet), so it was selectable again, and selecting it fed it back into `charactersToAdd` → `addWords`.

`addWords`'s upsert targets `onConflict: "id"` — the row's primary key, which is a fresh client-generated id (`makeId()`) on every call and therefore never collides. It does **not** target `(family_id, hanzi)`, the table's actual duplicate-prevention constraint (see `0_ARCHITECTURE.md`'s `words` table definition) — that constraint was never meant to be hit at all; the existing invariant throughout the app is that callers already filter out existing hanzi *before* calling `addWords` (via `computeIngestionResult`/`resolveSelectedSpans`'s `existingId` check), not that the function tolerates a genuine duplicate gracefully. With a truly duplicate hanzi in the batch, the real `(family_id, hanzi)` unique constraint fired, and PostgREST surfaced it as an HTTP 409 — caught by the surrounding `try/catch`, which showed the generic `saveError` notice rather than anything indicating why.

## Changes Applied

- `src/app/words/add-paragraph/AddParagraphSection.tsx` and `src/app/words/add-paragraph/ContinueImportSection.tsx` — both now call `await vm.refreshAllData()` immediately after a successful `addWords`/`addVocabPhrases` call (guarded to only fire when something was actually inserted), before proceeding to tag assignment and the paragraph write. This reloads `words`, `vocabPhrases`, and everything else `refreshAll()` covers from the DB, so any subsequent triage pass in the same session sees accurate state.

## Architectural Impact

None structural — no schema, RLS, or route change. Confirms (rather than changes) the existing invariant that `addWords`/`addVocabPhrases` assume pre-filtered input; the fix is keeping the client-side filtering data source (`vm.words`/`vm.vocabPhrases`) actually current, not changing the service-layer contract.

## Preventative Rule

Any UI flow that inserts into `words`/`vocab_phrases` and then may re-triage or re-filter against that same family's word/phrase set again **within the same session** must refresh (or locally patch) the state it reads for that filtering immediately after the insert succeeds — don't assume a page-load-time snapshot stays valid for the life of the session. This app already had the pattern right elsewhere (e.g. `handleStopFlashcardSession`/`performStopQuizSession` call `refreshAll()` after mutating); the paragraph-import submit paths were the gap.

## Verification

- Reproduced and confirmed fixed live, same headless-Chromium session used for the Phase 2 feature QA pass: import → Continue Import on the same paragraph immediately after → save succeeded with no console errors, correctly reported a fresh addition, and the paragraph's `words` count reflected both submissions with no duplicate-hanzi row created.
- `npm test` — 694/694 pass (no new tests added for this specific fix — it's a live-session state-freshness issue not expressible against the existing mocked-service test harness without a live Supabase round trip; covered by the manual QA pass instead, consistent with how the equivalent Phase 1 bug was verified).
- `npm run typecheck` — clean.
- `npm run lint` — no new errors/warnings.

## Docs Updated

- AI_CONTRACT.md: no.
- 0_ARCHITECTURE.md: yes — folded into Add Paragraph Rules rule 16 in the same commit as the Phase 2 feature (see the companion fix log), rather than a separate doc edit here.
- 0_BUILD_CONVENTIONS.md: no.
- 0_PRODUCT_ROADMAP.md: yes — noted in item I's verification status alongside the Phase 1 `TagCascadePicker` bug.
