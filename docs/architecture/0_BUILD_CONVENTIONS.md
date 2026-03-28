# Build Conventions — HanziQuest (`cc_review`)

_Last updated: 2026-03-28 (§10 added)_

For authority hierarchy, hard stops, doc update policy, and fix log policy — see `AI_CONTRACT.md`.
For where to file new documents — see `0_ARCHITECTURE.md §6`.
This document covers how to write code. Nothing more.

---

## 0 · Pre-Build Checklist

Before writing any code:

1. Complete the pre-task reading protocol in `AI_CONTRACT.md §3` — governance docs must be read before any implementation begins.
2. Check `docs/feature-specs/` for an existing spec. If found, read it. If none exists and the feature touches more than one layer or adds DB fields, draft one before coding (see §1).
3. Create `[feature].strings.ts` with full EN + ZH coverage before writing any JSX.
4. Plan file structure per §5 before writing any component code.
5. Write tests per §6 alongside implementation — not after.
6. Run `npm run check:encoding` before opening a PR.
7. Run npm test and confirm all existing tests pass before opening a PR.

**If the feature touches wallet or coin data:** see `AI_CONTRACT.md §1` — the full rule and rationale live there.

---

## 1 · Feature Specs

**When required:**

| Condition | Spec Required? |
|---|---|
| Touches ≥ 2 architectural layers (UI, Domain, Service, AI) | ✅ Yes |
| Adds a new DB table | ✅ Yes |
| Adds or modifies an RPC | ✅ Yes |
| Adds or modifies a persisted schema field | ✅ Yes |
| Adds a new API route | ✅ Yes |
| Single-layer UI change (copy, styling, layout) | ❌ No |
| Bug fix with no schema or API surface changes | ❌ No |
| Refactor within a single file or module | ❌ No |
| Anything not listed above | ✅ Yes — default to required |

**File location:** `docs/feature-specs/YYYY-MM-DD-name.md`

**Template:**
```markdown
# Feature Spec — YYYY-MM-DD — Short Title

## Problem
## Scope
## Out of scope
## Proposed behavior
## Layer impact
## Edge cases
## Risks
## Test plan
## Acceptance criteria
## Open questions
```

---

## 2 · TypeScript Rules

- `strict: true` must be enabled in `tsconfig.json` — never disable it.
- No `any` types. Use `unknown` and narrow, or define a proper interface.
- All exported functions must have explicit return type annotations.
- All React component props must have a named interface or type alias.
- No `@ts-ignore` or `@ts-expect-error` without a comment explaining why.
- No `console.log` in production code. Use structured logging or remove before opening a PR.

---

## 3 · Type File Organization

Types live in feature-scoped `*.types.ts` files, never inline in component files.

**Rules:**
- Each feature directory owns one `[feature].types.ts` file.
- Navigation/layout types shared across features → `shared/shell.types.ts`.
- Sub-features own their own types (e.g. `review/flashcard/flashcard.types.ts`).
- Feature code imports from its adjacent `[feature].types.ts` — not from the central hub.
- `words.shared.types.ts` is a re-export hub for backward compatibility only. Do not add new types there.
- Each `[feature].types.ts` must have a companion `[feature].types.test.ts` validating type construction, union values, and tuple shapes.

---

## 4 · Bilingual Strings

All user-facing text must support English and Simplified Chinese. Never hardcode user-facing strings in JSX.

---

### 4.1 · Which Strings File to Use

| Feature Type | Rule |
|---|---|
| Workspace module (under `src/app/words/`) | Add copy to shared `words.strings.ts` |
| Standalone route (e.g. `prompts`, `tagging`) | Create `[feature].strings.ts` in the feature directory |

---

### 4.2 · What Belongs

| ✅ Include | ❌ Exclude |
|---|---|
| Labels, titles, buttons, errors, placeholders, ARIA labels | Conditional rendering logic, JSX, HTML, template literals |

---

### 4.3 · Anti-Patterns

- ❌ Hardcoded string literal in JSX
- ❌ Mismatched EN/ZH keys
- ❌ HTML or formatting inside string values
- ❌ Template literals in the strings object

---

### 4.4 · File Structure
```ts
/**
 * [Feature] Strings — Last updated: YYYY-MM-DD
 */
export const featureStrings = {
  en: {
    // Section: Page Header
    pageTitle: "...",
    // Section: Actions
    saveButton: "Save",
    // Section: Feedback
    saveSuccess: "...",
    saveError: "...",
  },
  zh: {
    pageTitle: "...",
    saveButton: "保存",
    saveSuccess: "...",
    saveError: "...",
  },
};
```

---

### 4.5 · CI Enforcement

`en` and `zh` must have identical key sets across all `*.strings.ts` files. **Build fails on mismatch.**

---

## 5 · Component File Structure
```
src/app/words/[feature]/
  ├── page.tsx                  (Next.js route entry — minimal, no logic)
  ├── [FeatureName]Page.tsx     (main component: layout + orchestration)
  ├── [Component].tsx           (subcomponents as needed)
  ├── [feature].strings.ts      (standalone features only — see §4)
  ├── [feature].types.ts        (TypeScript types for this feature)
  ├── [feature].test.tsx        (tests — see §6)
  └── README.md                 (optional)
```

**New feature checklist:**
- [ ] Strings owner confirmed (local file or workspace file extended)
- [ ] `[feature].types.ts` created if new domain types introduced
- [ ] No hardcoded text in JSX
- [ ] Locale hook: useLocale() from src/lib/locale/useLocale.ts (or wherever it lives) — confirm path in 0_ARCHITECTURE.md
- [ ] ARIA labels sourced from strings file
- [ ] All buttons have bilingual labels, tooltips, and notifications
- [ ] Tests added per §6

**Destructive actions:** default UX is immediate removal with no confirmation dialog. Deviations must be justified in the spec.

---

## 6 · Testing Conventions

Every new feature must have tests before it is considered complete.

| Scope | Requirement |
|-------|-------------|
| Domain logic (`src/lib/`) | Unit tests — happy path, edge cases, invalid input |
| Normalization & safety | Verify malformed/unsafe inputs are dropped, not passed through |
| API routes | Integration test: success and error response |
| Scheduler logic | Unit test each grade tier — verify `nextReviewAt` and `interval` |
| UI components | Test at the closest seam to the logic (see below) |

**UI seam priority (highest to lowest):**
1. Extracted pure helpers — extract branching logic to a named function and test it directly.
2. Focused subcomponent tests — for stable, self-contained behaviors.
3. Section-level smoke test — only when no better seam exists. Not required by default.

**Mocking rules:**
- Mock Supabase client / RPC boundaries — never hit live data.
- Mock AI provider calls — never make real network calls.
- Do not mock `src/lib/` when testing UI components.

**Done when:** happy path passes, error states covered, normalization drops bad input without throwing.

---

## 7 · Styling Conventions

- Tailwind CSS only. No `style={{}}`. No new CSS modules (see exceptions below).
- No arbitrary Tailwind values (e.g. `w-[347px]`) without a documented reason.
- New pages must match the `/words/admin` page as the visual baseline — read `src/app/words/admin/AdminSection.tsx` before writing component JSX.

**CSS module exceptions (do not create new ones):**
- `results/results.module.css` — predates Tailwind-only rule; all new styling for `results/` must extend this file, not mix with Tailwind.
- `review/fill-test/coins.animation.module.css` — animation keyframes only. A new CSS module is only permitted for keyframe animations Tailwind cannot express; document the reason at the top of the file.

**Pinyin (ruby) alignment:** render as per-character units (Hanzi + pinyin token), not a full pinyin line above a full Hanzi line. Map pinyin tokens only to Hanzi code points; skip punctuation and non-Hanzi characters. When token count mismatches, render Hanzi without pinyin — no placeholder. Remove from DOM when pinyin is hidden (not CSS `visibility: hidden`). See `FlashcardCard.tsx` for the reference DOM pattern.

**Styling rules:** see `docs/architecture/style-ref.md` for the full styling rules to follow for colors and buttons. If docs/architecture/style-ref.md is not readable, stop and flag before writing any styled components.

---

## 8 · Build & CI Guardrails

- **Encoding check:** `npm run check:encoding` — runs `scripts/check-mojibake.mjs`, scans for garbled characters in source and docs.
- **String parity check:** asserts identical EN/ZH key sets across all `*.strings.ts` files. Runs as part of `npm test`.
- **CI workflow:** `.github/workflows/encoding-guardrails.yml` — triggers on all PRs and pushes to `main`/`master`.

---

## 9 · Database Migration Workflow

Migrations live in `supabase/migrations/`. They are applied manually — there is no automatic deployment on push.

**Project configuration**
- `supabase/config.toml` — committed to the repo; contains the dev project ref (`project_id`). Required for the CLI to target the correct dev project. Generate with `supabase init` then `supabase link`.
- `SUPABASE_PROD_DB_URL` — stored in `.env.production.local` (gitignored). Used only by `scripts/db-push-prod.mjs` for prod deployments.
- Auth: run `supabase login` once per machine. Token stored in `~/.supabase/` and persists across sessions.

**Getting the prod connection string**
1. Supabase dashboard → prod project → **Settings → Database → Connection string → URI**
2. Switch **Method** to **Session Pooler** (required for IPv4 networks — direct connection is IPv6 only)
3. Copy the URI and replace `[YOUR-PASSWORD]` with the actual password — **remove the square brackets**, they are a UI placeholder, not part of the password
4. Add to `.env.production.local`: `SUPABASE_PROD_DB_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`

**Note on `--project-ref`:** this flag is not supported by `supabase db push` or `supabase migration list`. Prod deployments use `--db-url` via `scripts/db-push-prod.mjs`, which reads `SUPABASE_PROD_DB_URL` from `.env.production.local` and handles special character encoding in the password automatically.

**Dev workflow**
```bash
npm run db:status       # confirm new migration shows as pending
npm run db:push         # apply pending migrations to dev
npm run db:status       # confirm migration shows as applied
```

**Prod workflow**
```bash
npm run db:push:prod:dry    # preview what will be applied (dry run)
npm run db:push:prod        # apply pending migrations to prod
```

**Rules**
- Always run `db:push:prod:dry` before `db:push:prod` — review the output before committing to prod.
- `supabase migration list` only works for the linked dev project — there is no prod equivalent.
- Mocked RPC tests confirm the service-layer contract only. They do not validate the live database function. A fix involving a migration is not complete until deployment is confirmed.
- If `supabase login` has not been run on the current machine, `db:push` will fail with an auth error — run `supabase login` first.

---

## 10 · Admin and Repair Scripts

Scripts in `scripts/` that operate outside the app runtime. Each entry records the script's purpose, required env vars, key flags, and the fix-log that introduced it.

When invoking a prod-targeting repair script through `npm run`, prefer `npm run <script> -- prod ...`. The explicit-flag fallback is `npm run <script> -- --env prod ...`. On Windows/npm, `--prod` may be consumed by npm before the script receives it.

**Rules**
- All repair scripts must be idempotent — safe to run more than once without double-applying changes.
- Scripts that target prod data must load `.env.production.local` explicitly and support a clear prod selector. Dev is the default.
- A repair script must validate its target before emitting any SQL or performing any write (e.g. confirm the target user exists and has the expected role).
- Do not perform manual table edits ad hoc without a checked-in repair script or SQL artifact.

---

### `scripts/generate-coin-compensation-fix.ts`

**npm command:** `npm run generate:coin-compensation-sql`

**Purpose:** Generates an idempotent SQL transaction that compensates a child profile for coins missed due to a failed `record_quiz_session()` RPC. Writes a `quiz_sessions` row and a matching `wallets` increment in a single transaction so both Quiz Results and the Recipe Shop wallet reflect the credit.

**When to use:** A child's quiz completion was recorded in the session log but the coin credit was never applied (e.g. due to an RPC timing bug). Run this to produce the SQL patch, review it, then apply it via Supabase SQL editor or migration.

**Env vars required**
| Var | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` / `.env.production.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` / `.env.production.local` |

**Required flags**
| Flag | Type | Description |
|---|---|---|
| `--child-user-id` | UUID | Target child profile's `users.id` |
| `--coins` | integer | Number of coins to credit |
| `--reason` | string | Human-readable reason (stored in the session row) |

**Optional flags**
| Flag | Default | Description |
|---|---|---|
| `--created-at` | now | ISO 8601 timestamp for the backfilled session row |
| `--session-id` | deterministic | Override the auto-generated deterministic session UUID |
| `--output` | stdout | Write SQL to a file path instead of printing |
| `--prod` | off | Load `.env.production.local` and target prod |
| `prod` | off | Preferred leading positional prod selector when running this script through `npm run` |
| `--env prod` | off | Explicit prod selector that is safer than `--prod` under `npm run` |

**Key behaviours**
- Fetches and validates the target `users` row via the service-role client; aborts if the user is not found or is not `role="child"`.
- Session ID is deterministic (derived from `childUserId + createdAt`) — re-running with the same inputs produces the same UUID, making the transaction idempotent.
- No new route, RPC, schema field, or RLS policy is touched; the script writes only through existing table shapes.

**Example**
```bash
npm run generate:coin-compensation-sql -- \
  prod \
  11111111-2222-3333-4444-555555555555 \
  13 \
  "Missed coins after RPC bug" \
  supabase/manual/coin-fix.sql
```

**Equivalent explicit-flag form**
```bash
npm run generate:coin-compensation-sql -- \
  --env prod \
  --child-user-id 11111111-2222-3333-4444-555555555555 \
  --coins 13 \
  --reason "Missed coins after RPC bug" \
  --output supabase/manual/coin-fix.sql
```

**Fix log:** `docs/fix-log/build-fix-log-2026-03-28-child-coin-compensation-script.md`
**Shared lib:** `src/lib/coinCompensationFix.ts` (validation, session-id generation, SQL builder)
**Tests:** `src/lib/coinCompensationFix.test.ts`

---

### `scripts/verify-rls.ts`

**Purpose:** Verifies RLS policy correctness against a live Supabase dev project. Covers table accessibility, platform-admin bypass, unenriched session isolation, cross-family isolation, child write scope, and quiz session immutability.

**When to use:** After any migration that adds or modifies RLS policies, or as a sanity check before a prod deployment that touches auth or RLS.

**Env vars required**
| Var | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` |

Runs against dev only — no `--prod` flag. Never point this at prod without first auditing the test sections for destructive writes.
