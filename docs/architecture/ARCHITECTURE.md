# ARCHITECTURE

## 1) System Overview

This app is a local-first Next.js Chinese character review system with four main product areas: add characters, view all characters, run due reviews (flashcard/fill-test), and manage/generated flashcard content per character+pronunciation. Persistence is browser IndexedDB (Dexie), dictionary pronunciation data is loaded from local `public/data/char_detail.json`, and AI generation is mediated through a server route that calls DeepSeek.  
Evidence: [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):2625, [src/lib/db.ts](D:/Documents/coding/cc_review/src/lib/db.ts):28, [src/lib/xinhua.ts](D:/Documents/coding/cc_review/src/lib/xinhua.ts):4, [src/app/api/flashcard/generate/route.ts](D:/Documents/coding/cc_review/src/app/api/flashcard/generate/route.ts):440, [README.md](D:/Documents/coding/cc_review/README.md):16

Primary user flows:
- Home -> `/words` entry -> redirect to due review. Evidence: [src/app/page.tsx](D:/Documents/coding/cc_review/src/app/page.tsx):5, [src/app/words/page.tsx](D:/Documents/coding/cc_review/src/app/words/page.tsx):4
- Add characters in `/words/add` -> parse Hanzi -> store new `Word` rows in IndexedDB. Evidence: [src/app/words/add/page.tsx](D:/Documents/coding/cc_review/src/app/words/add/page.tsx):4, [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):2625, [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):2660
- Due review at `/words/review` -> launch flashcard or fill-test sessions -> grade -> update schedule. Evidence: [src/app/words/review/page.tsx](D:/Documents/coding/cc_review/src/app/words/review/page.tsx):4, [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):3090, [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):2814, [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):2984
- Content Admin at `/words/admin` -> preload/regenerate/edit/save flashcard content -> review reads saved content only. Evidence: [src/app/words/admin/page.tsx](D:/Documents/coding/cc_review/src/app/words/admin/page.tsx):4, [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):3742, [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):2059, [README.md](D:/Documents/coding/cc_review/README.md):17

Key architectural decisions observed:
- Single large client workspace component (`WordsWorkspace`) hosts multiple routes/sections by `page` prop. Evidence: [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):776, [src/app/words/review/flashcard/page.tsx](D:/Documents/coding/cc_review/src/app/words/review/flashcard/page.tsx):4
- Local persistence via Dexie/IndexedDB with schema versioning in code. Evidence: [src/lib/db.ts](D:/Documents/coding/cc_review/src/lib/db.ts):28, [src/lib/db.ts](D:/Documents/coding/cc_review/src/lib/db.ts):36
- AI generation is server-routed (`/api/flashcard/generate`), not direct provider calls from UI. Evidence: [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):1503, [src/app/api/flashcard/generate/route.ts](D:/Documents/coding/cc_review/src/app/api/flashcard/generate/route.ts):221
- Fill-test content is derived from saved flashcard content, not generated ad hoc during quiz. Evidence: [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):579, [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):1462

---

## 2) Layer Model + Responsibility Boundaries

### UI layer (pages/components)
- What it IS responsible for: Route entry, rendering, user interaction, local view state/session state (`WordsWorkspace`, page wrappers).
- What it is NOT allowed to do: Should not call DeepSeek directly; should not bypass domain normalization before persistence.
- “Unit logic lives here” rules: Pure formatting/view helpers may exist here, but side-effect logic should call service/domain functions (`db`, API route, scheduler/fill-test funcs).
- Evidence: [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):1503, [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):1437, [src/app/words/add/page.tsx](D:/Documents/coding/cc_review/src/app/words/add/page.tsx):1

### Domain layer (pure logic/models)
- What it IS responsible for: Deterministic scheduling, grading, request/response normalization, model typing.
- What it is NOT allowed to do: No DB/network/filesystem side effects.
- “Unit logic lives here” rules: Pure functions should live in `src/lib` domain modules (`scheduler.ts`, `fillTest.ts`, `flashcardLlm.ts`, `types.ts`). Side effects should be delegated to service layer.
- Evidence: [src/lib/scheduler.ts](D:/Documents/coding/cc_review/src/lib/scheduler.ts):22, [src/lib/fillTest.ts](D:/Documents/coding/cc_review/src/lib/fillTest.ts):52, [src/lib/flashcardLlm.ts](D:/Documents/coding/cc_review/src/lib/flashcardLlm.ts):212

### Service layer (IO: DB/network/filesystem)
- What it IS responsible for: IndexedDB access (`db.ts`), dictionary data loading (`xinhua.ts`), external API calls (`route.ts`), dataset download script.
- What it is NOT allowed to do: No UI rendering/state ownership.
- “Unit logic lives here” rules: Side effects (Dexie, `fetch`, filesystem writes) belong here; domain normalization should be reused before writes/returns.
- Evidence: [src/lib/db.ts](D:/Documents/coding/cc_review/src/lib/db.ts):57, [src/lib/xinhua.ts](D:/Documents/coding/cc_review/src/lib/xinhua.ts):167, [src/app/api/flashcard/generate/route.ts](D:/Documents/coding/cc_review/src/app/api/flashcard/generate/route.ts):229, [scripts/download-xinhua-data.mjs](D:/Documents/coding/cc_review/scripts/download-xinhua-data.mjs):90

### AI layer (prompts/calling/guardrails)
- What it IS responsible for: Prompt templates, provider invocation, response extraction/validation, payload normalization/safety filters.
- What it is NOT allowed to do: AI should not decide persistence keys/scheduler state directly; grading/scheduling remains deterministic code.
- “Unit logic lives here” rules: Prompting + call orchestration in route; schema/safety normalization in `flashcardLlm.ts`; UI consumes normalized saved outputs.
- Evidence: [src/app/api/flashcard/generate/route.ts](D:/Documents/coding/cc_review/src/app/api/flashcard/generate/route.ts):13, [src/app/api/flashcard/generate/route.ts](D:/Documents/coding/cc_review/src/app/api/flashcard/generate/route.ts):326, [src/lib/flashcardLlm.ts](D:/Documents/coding/cc_review/src/lib/flashcardLlm.ts):84, [src/lib/flashcardLlm.ts](D:/Documents/coding/cc_review/src/lib/flashcardLlm.ts):149, [src/lib/db.ts](D:/Documents/coding/cc_review/src/lib/db.ts):77

---

## 3) Directory + Module Map (Implementation-based)

```text
src/
  app/
    layout.tsx                     Root layout + global metadata/font wiring.
    page.tsx                       Landing page linking to /words.
    words/page.tsx                 Redirects /words -> /words/review.
    words/WordsWorkspace.tsx       Main client UI/state engine for add/all/review/admin + review sessions.
    words/add/page.tsx             Route wrapper with Suspense: WordsWorkspace(page="add").
    words/all/page.tsx             Route wrapper with Suspense: WordsWorkspace(page="all").
    words/admin/page.tsx           Route wrapper with Suspense: WordsWorkspace(page="admin").
    words/review/page.tsx          Route wrapper with Suspense: WordsWorkspace(page="review").
    words/review/flashcard/page.tsx Route wrapper with Suspense: WordsWorkspace(page="flashcard").
    words/review/fill-test/page.tsx Route wrapper with Suspense: WordsWorkspace(page="fillTest").
    api/flashcard/generate/route.ts Server endpoint for DeepSeek prompt execution + validation.
    globals.css                    App-wide styling tokens and component class overrides.
  hooks/
    useXinhuaFlashcardInfo.ts      Client hook to load/cached dictionary pronunciation info.
  lib/
    db.ts                          Dexie schema + IndexedDB data access APIs.
    scheduler.ts                   Spaced-repetition interval/next-state pure logic.
    fillTest.ts                    Fill-test grading pure logic + types.
    flashcardLlm.ts                Flashcard request/response normalization + safety filtering.
    xinhua.ts                      Dictionary dataset loader/parser + flashcard info builder.
    types.ts                       Shared app data types (Word + fill-test type re-exports).
    id.ts                          ID generator utility.
    review.ts                      Review grading type contract.
    *.test.ts                      Unit tests for scheduler/fillTest/xinhua/flashcard normalization.
archive/
  2026-02/src/lib/
    fillTestRepo.ts                Archived unused fill-test seed/custom repository module.
    fillTestContent.ts             Archived seed fill-test content map.
scripts/
  download-xinhua-data.mjs         Downloads dictionary JSON into public/data.
docs/
  spec.md                          Placeholder MVP spec.
  architecture/ARCHITECTURE.md     Consolidated architecture overview and evidence map.
  architecture/add-characters-page.md Route/page architecture notes (human docs).
  architecture/all-characters-page.md Route/page architecture notes (human docs).
  architecture/content-admin-page.md Route/page architecture notes (human docs).
  architecture/due-review-page.md  Route/page architecture notes (human docs).
  architecture/build-fix-log-2026-02-26.md Build blocker fix log and validation record.
  archive/2026-02/
    flashcard-content-rules.md     Archived outdated content-rule document.
    plan_fill-test-dragdrop.md     Archived outdated implementation plan.
root configs:
  package.json                     Runtime scripts/deps, including data download script aliases.
  tsconfig.json                    TS strict mode + @/* alias; excludes `archive/**`.
  next.config.ts                   Next config stub.
  eslint.config.mjs                ESLint config preset + ignore policy.
  postcss.config.mjs               Tailwind v4 PostCSS plugin config.
```

Evidence: [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):776, [src/lib/db.ts](D:/Documents/coding/cc_review/src/lib/db.ts):28, [scripts/download-xinhua-data.mjs](D:/Documents/coding/cc_review/scripts/download-xinhua-data.mjs):78, [package.json](D:/Documents/coding/cc_review/package.json):4

---

## 4) AI Prompt / LLM Integration (if present)

- Exactly where prompt text/templates live:
  - All prompt templates are inline constants in one file: `FULL_SYSTEM_PROMPT`, `PHRASE_SYSTEM_PROMPT`, `EXAMPLE_SYSTEM_PROMPT`, `PHRASE_DETAIL_SYSTEM_PROMPT`, `MEANING_DETAIL_SYSTEM_PROMPT`, `EXAMPLE_PINYIN_SYSTEM_PROMPT` in [src/app/api/flashcard/generate/route.ts](D:/Documents/coding/cc_review/src/app/api/flashcard/generate/route.ts):13.
- Exactly where model calling logic lives:
  - Provider call logic is in `callDeepSeek(...)` in [src/app/api/flashcard/generate/route.ts](D:/Documents/coding/cc_review/src/app/api/flashcard/generate/route.ts):221.
  - UI invokes only internal route via `fetch("/api/flashcard/generate")` in [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):1503.
- Boundaries: what AI is allowed to decide vs not decide:
  - Allowed: content generation (meanings, phrases, examples, pinyin) for requested `character` + `pronunciation`. Evidence: [src/app/api/flashcard/generate/route.ts](D:/Documents/coding/cc_review/src/app/api/flashcard/generate/route.ts):254.
  - Not allowed: arbitrary output shape/unsafe content/invalid lengths/duplicates; runtime validators and normalizers enforce this. Evidence: [src/app/api/flashcard/generate/route.ts](D:/Documents/coding/cc_review/src/app/api/flashcard/generate/route.ts):326, [src/lib/flashcardLlm.ts](D:/Documents/coding/cc_review/src/lib/flashcardLlm.ts):109, [src/lib/flashcardLlm.ts](D:/Documents/coding/cc_review/src/lib/flashcardLlm.ts):149.
  - Not allowed: scheduling decisions; scheduling remains deterministic in `scheduler.ts` and `gradeWord`. Evidence: [src/lib/scheduler.ts](D:/Documents/coding/cc_review/src/lib/scheduler.ts):22, [src/lib/db.ts](D:/Documents/coding/cc_review/src/lib/db.ts):77.
- How prompts are versioned/tested/evaluated (observed):
  - Versioning: no separate prompt version files/IDs; prompts are code constants in a single route file.
  - Testing: unit tests exist for normalization modules (`flashcardLlm`, `scheduler`, `fillTest`, `xinhua`), but no test file for `api/flashcard/generate/route.ts` was found.
  - Evaluation harness: none observed in repo.
  - Evidence: [src/app/api/flashcard/generate/route.ts](D:/Documents/coding/cc_review/src/app/api/flashcard/generate/route.ts):13, [src/lib/flashcardLlm.test.ts](D:/Documents/coding/cc_review/src/lib/flashcardLlm.test.ts):1, [src/lib/scheduler.test.ts](D:/Documents/coding/cc_review/src/lib/scheduler.test.ts):1, [src/lib/fillTest.test.ts](D:/Documents/coding/cc_review/src/lib/fillTest.test.ts):1, [src/lib/xinhua.test.ts](D:/Documents/coding/cc_review/src/lib/xinhua.test.ts):1

---

## 5) Legacy / Outdated / Archive Candidates

Validation run on February 26, 2026:
- `npm run typecheck`: pass.
- `npm test`: pass (`5` files, `30` tests).
- `npm run build`: pass.
- Build blocker fix completed by adding `Suspense` wrappers to route-wrapper pages and excluding `archive/**` from TS compilation.

### `src/lib/fillTestRepo.ts`
- Why it is likely legacy (evidence): Repository-wide reference scan found no imports/calls from active app modules; matches were only inside this file before archive. Evidence: static search and prior file path [archive/2026-02/src/lib/fillTestRepo.ts](D:/Documents/coding/cc_review/archive/2026-02/src/lib/fillTestRepo.ts):35
- Suggested action: ARCHIVED (completed 2026-02-26)
- Safe archive location: `/archive/2026-02/src/lib/fillTestRepo.ts`

### `src/lib/fillTestContent.ts`
- Why it is likely legacy (evidence): Referenced only by `fillTestRepo.ts`; active review flow derives fill tests from saved flashcard content instead. Evidence: [archive/2026-02/src/lib/fillTestContent.ts](D:/Documents/coding/cc_review/archive/2026-02/src/lib/fillTestContent.ts):3, [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):579
- Suggested action: ARCHIVED (completed 2026-02-26)
- Safe archive location: `/archive/2026-02/src/lib/fillTestContent.ts`

### `docs/plan_fill-test-dragdrop.md`
- Why it is likely legacy (evidence): Explicitly marked outdated and its described work already exists in code/tests. Evidence: [docs/archive/2026-02/plan_fill-test-dragdrop.md](D:/Documents/coding/cc_review/docs/archive/2026-02/plan_fill-test-dragdrop.md):2, [src/lib/fillTest.ts](D:/Documents/coding/cc_review/src/lib/fillTest.ts):52, [src/lib/fillTest.test.ts](D:/Documents/coding/cc_review/src/lib/fillTest.test.ts):13
- Suggested action: ARCHIVED (completed 2026-02-26)
- Safe archive location: `/docs/archive/2026-02/plan_fill-test-dragdrop.md`

### `docs/spec.md`
- Why it is likely legacy (evidence): Placeholder only, no implementation linkage discovered. Evidence: [docs/spec.md](D:/Documents/coding/cc_review/docs/spec.md):1 and static scan (`no references found` in `src/`, `scripts/`, root configs).
- Suggested action: NEEDS HUMAN CONFIRMATION
- Safe archive location: `/docs/archive/2026-02/spec.md`

### `docs/flashcard-content-rules.md`
- Why it is likely legacy (evidence): Explicitly marked outdated; described `char_detail.json` content-selection behavior does not match current runtime behavior (review uses admin-saved generated meanings/phrases/examples; dictionary path is pronunciation source). Evidence: [docs/archive/2026-02/flashcard-content-rules.md](D:/Documents/coding/cc_review/docs/archive/2026-02/flashcard-content-rules.md):2, [README.md](D:/Documents/coding/cc_review/README.md):16, [README.md](D:/Documents/coding/cc_review/README.md):19, [src/lib/xinhua.ts](D:/Documents/coding/cc_review/src/lib/xinhua.ts):203, [src/app/words/WordsWorkspace.tsx](D:/Documents/coding/cc_review/src/app/words/WordsWorkspace.tsx):3277
- Suggested action: ARCHIVED (completed 2026-02-26)
- Safe archive location: `/docs/archive/2026-02/flashcard-content-rules.md`
