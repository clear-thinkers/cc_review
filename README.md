# HanziQuest

A full-stack Chinese-character spaced-repetition (SRS) app built for family use. Parents curate AI-assisted flashcard content; children work through scheduled review sessions and earn rewards. The system is designed around deterministic scheduling, strict data isolation, and a spec-first engineering discipline.

**Stack:** Next.js 14 (App Router) · Supabase Postgres (RLS) · DeepSeek LLM · TypeScript

---

## Architecture Highlights

### Deterministic SRS Scheduling
SM-2-derived scheduler with `again / hard / good / easy` grade mapping. All scheduling logic lives in a pure domain module (`src/lib/scheduler.ts`) with no UI or database imports — the only write path to `nextReviewAt` is through its grade functions.

### Two-Layer Authentication
- **Layer 1 — Family auth:** Supabase Auth (email + password); one account per family, JWT issued on success
- **Layer 2 — Profile PIN:** scrypt-hashed 4-digit PINs per profile; verified server-side via `/api/auth/pin-verify` using `crypto.timingSafeEqual`; lockout after 5 consecutive failures with parent-unlock flow

### Role-Based Access Control
Three roles — child / parent / platform admin — enforced at both the route layer (client-side `RouteGuard`) and the database layer (Supabase RLS). JWT `app_metadata` claims carry `family_id`, `user_id`, and `role`; all Postgres queries are automatically scoped to the authenticated family. No cross-tenant data leakage is possible at the DB layer.

### AI Content Pipeline with Normalization Guards
Content generation is admin-only and routes through `/api/flashcard/generate`. All LLM output passes through a normalization layer (`src/lib/flashcardLlm.ts`) before any Supabase write — malformed phrases are dropped, not passed through. Review screens consume only persisted, normalized content; they never call the AI provider.

### Atomic Shop Unlock
The coin reward loop uses a single Postgres RPC (`unlock_shop_recipe`) as its only write path: wallet decrement, unlock row insert, and spend-history append happen in one transaction boundary, preventing partial states.

### Configurable LLM Prompts
Families can version and switch AI prompt templates per generation type at runtime. Prompt slots are family-scoped with a platform-wide default fallback; the active slot is resolved at generation time.

### Cascade Curriculum Tagging
4-level Textbook → Grade → Unit → Lesson tag system. Tags can be assigned at ingestion time, batch-assigned from the character inventory, and used as OR-logic filters across review and content-admin views.

### Packaged Review Sessions
Parents package named sets of characters into review sessions. Children run them in two phases — flashcard review then fill-test — for the same character set. Session completion is atomic: it marks the session, records the completing user, and frees the session name for reuse.

---

## Key Pages

| Route | Role | Purpose |
|---|---|---|
| `/words/add` | Parent | Ingest Hanzi characters; optional cascade tag assignment |
| `/words/all` | All | Character inventory with SRS stats, filtering, and batch tag editing |
| `/words/admin` | Parent | AI content curation: generate, edit, normalize, and persist flashcard content |
| `/words/prompts` | Parent | Manage and version LLM prompt templates |
| `/words/review` | All | Due-review queue + active packaged sessions |
| `/words/review/flashcard` | All | Flashcard review (read-only; no grading) |
| `/words/review/fill-test` | Child / Admin | Cloze fill-test with SRS grading |
| `/words/results` | All | Quiz session history with accuracy breakdowns and failed-character packaging |
| `/words/shop` | Child / Admin | Coin-funded recipe unlock shop |
| `/words/shop-admin` | Admin | Global recipe and ingredient catalog editor |
| `/words/debug` | Admin | Icon-path audits and DB/filesystem reconciliation |

---

## Docs

Engineering decisions are captured in a spec-first docs structure:

- [`docs/architecture/0_ARCHITECTURE.md`](docs/architecture/0_ARCHITECTURE.md) — system structure, layer boundaries, data schema, and error-handling guarantees
- [`docs/architecture/AI_CONTRACT.md`](docs/architecture/AI_CONTRACT.md) — agent operating rules and authority hierarchy
- [`docs/architecture/0_BUILD_CONVENTIONS.md`](docs/architecture/0_BUILD_CONVENTIONS.md) — code and doc conventions
- [`docs/feature-specs/`](docs/feature-specs/) — active pre-build feature specs
- [`docs/archive/specs/`](docs/archive/specs/) — full spec history (38 shipped features)
- [`docs/fix-log/`](docs/fix-log/) — post-merge fix records

---

## Local Setup

1. Clone the repo and install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DEEPSEEK_API_KEY=your_deepseek_key
# Optional
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
```

3. Run the development server:

```bash
npm run dev
```

Pronunciation candidates are sourced from `public/data/char_detail.json` (Xinhua dictionary data). No external call is made at review time — all content served to review screens is pre-curated and persisted.
