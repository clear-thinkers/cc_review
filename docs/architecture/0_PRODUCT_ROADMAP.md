# Product Roadmap — HanziQuest (`cc_review`)

_Last updated: 2026-08-13 · Authority hierarchy: see `AI_CONTRACT.md`_

**Current state:** Tier 1, Phase 2 complete. Pre-pilot.
Bundled phrase quiz mode shipped on 2026-05-02. Phrase-keyed input (item D) fully shipped 2026-08-13, including live QA of quiz-taking/packaging/grading — see §4.
Item I Phase 1 (article import → known/unknown triage) shipped 2026-08-17 — migration deployed, `verify:rls` passing for `paragraphs`, and live-QA'd in-browser; one real bug found and fixed along the way (pre-existing `TagCascadePicker.tsx` gap, unrelated to this feature's own code). Item I Phase 2 (paragraph library, re-import, test-mode prep) shipped 2026-08-18, same day — see item I row for detail. Ships nothing playable yet; a Phase 3 (not yet spec'd) is needed before a test mode can actually run as a quiz.
One Tier 1 gate remains open: mobile layout for quiz results.
Tier 2 is blocked until all Tier 1 gates close.

---

## 1 · Active Work

> If a feature isn't in this table or §3, it's deferred — see §2.

| ID | Feature | Notes | Spec | Status |
|----|---------|-------|------|--------|
| A | Mobile quiz results layout | `/words/results` table breaks on iPhone | — | 📋 Planned |
| C | Parent difficulty setting | Beginner-level AI prompts scoped per family; admin configures via Prompts page | TBD | 📋 Planned |
| D | Phrase-keyed input | Parent manages phrases (new `vocab_phrases` entity: Chinese phrase, pinyin, English definition, multiple example sentences) on the same Content Admin page as characters (Characters/Phrases toggle); batch-add via comma-separated list + batch tag assignment on `/words/add`; AI generation via a new `prompt_type`; taggable via a new `vocab_phrase_lesson_tags` join; packageable into fill-test sessions (own selection/packaging flow); a phrase blank uses the app's existing drag-and-match mechanic in its own round, never mixed with character rounds; correct answers nudge SRS familiarity of the phrase's own component characters (if already added), wrong answers touch nothing; no auto-SRS for the phrase itself; a correctly-answered phrase earns a flat 1 coin. **Unblocked item I.** | `docs/feature-specs/2026-07-26-phrase-keyed-input.md` | ✅ Shipped 2026-08-13 — quiz-taking, packaging, and `/words/add` batch entry all live-verified; see §4 for the bugs live QA found and fixed |
| E | Pilot feedback triage | Collect and triage structured feedback from pilot families | — | 🔄 In Progress |
| F | Ingredient shopping for kids | Add shopping controls to the ingredient detail page so kids can mark/add ingredients while viewing a recipe's ingredients | `docs/feature-specs/2026-03-30-shop-ingredient-shopping.md` | 📋 Planned |
| G | Coin cash-out (redemption) | Kids draw real-dollar value from usable coin balance at 100 coins = $1; each redemption is documented with a child-supplied note and signature; usable balance decreases but quiz results (coins earned from sessions) are unaffected; lives on `/words/shop` | `docs/feature-specs/2026-05-11-coin-redemption.md` | ✅ Shipped 2026-05-11 |
| H | Save & resume test session progress | Child can pause any test session (due-review or packaged) and resume later; autosave after each answer, multiple paused sessions allowed, parent read-only visibility; new `review_session_progress` table, authorized 2026-07-24 | `docs/feature-specs/2026-07-24-save-resume-test-session-progress.md` | ✅ Shipped 2026-07-25 |
| I | Article import → known/unknown triage | **Most immediate Tier 1 need.** Phase 1 shipped a new route, `/words/add-paragraph` ("Manage Paragraphs" in nav), parent/platform-admin only: paste a block of Chinese text, see it split into sentences with every Hanzi character and every substring matching an existing family phrase flagged known vs. unknown, click/drag-select spans (`ParagraphSpanSelector.tsx`), and bulk-add + tag the selection through the unmodified `/words/add` ingestion services, persisting to a new `paragraphs` table. Phase 2 added, on the *same* route (no new route): a filterable library list (title + tags), **Continue Import** (re-triage an existing paragraph against current family state to add more spans, additive-only, title editable, raw text immutable), and **Prep Fill Test** (a three-state known/ineligible/eligible span selector — reusing `ParagraphSpanSelector.tsx`'s token-building but click-to-toggle only — that carves eligible spans into a numbered word-bank block, previewing the eventual child-facing blank layout, and saves the selection as a named, editable **test mode** in a new `paragraph_test_modes` table, uniquely named *per paragraph* rather than family-wide). Neither phase ships anything playable — a saved test mode creates no `review_test_sessions` row; that's a future, not-yet-spec'd Phase 3. See `0_ARCHITECTURE.md`'s "Add Paragraph Rules" section (rules 1–21) for full behavior. | `docs/feature-specs/2026-08-17-add-paragraph-article-import.md` (Phase 1), `docs/feature-specs/2026-08-17-paragraph-fill-test.md` (Phase 2) | ✅ Phase 1 shipped 2026-08-17; ✅ Phase 2 shipped 2026-08-18 — migrations deployed and confirmed via `db:status`; `scripts/verify-rls.ts` Sections 7–8 pass live for `paragraphs`/`paragraph_test_modes`, including the per-paragraph (not family-wide) unique-name constraint; manually QA'd in-browser end to end (import → filter → Continue Import → Prep Fill Test → create/edit/duplicate-reject a test mode). Live QA surfaced two real bugs, both fixed same day: (1, Phase 1) `TagCascadePicker.tsx`'s custom grade/unit/lesson value rendered blank after confirming — pre-existing gap in that shared component, fixed by porting `AddSection.tsx`'s existing `appendSelectedOption` fix over; (2, Phase 2) `vm.words`/`vm.vocabPhrases` went stale after a successful add and were never refreshed, so a second submission later in the same session (e.g. Continue Import right after the original import) re-triaged against outdated data and tried to re-insert something already added, failing with a real Postgres unique-constraint conflict instead of the intended silent skip — fixed by calling `refreshAllData()` after every successful word/phrase insert in both `AddParagraphSection.tsx` and `ContinueImportSection.tsx`. See `docs/fix-log/build-fix-log-2026-08-17-tag-cascade-picker-custom-value-blank.md` and `docs/fix-log/build-fix-log-2026-08-18-paragraph-stale-triage-state.md`. |

> Planned features with a `TBD` spec require a feature spec before build. See `AI_CONTRACT.md §2` for scope confirmation rules.

---

## 2 · Deferred — Do Not Build

Stop and confirm before acting on any of these:

- Tier 2 / Tier 3 features of any kind
- Content pack import, purchase, or monetization
- New AI provider integrations
- Flashcard data export / import

---

## 3 · Tier Strategy

| Tier | Name | Scope | Status |
|------|------|-------|--------|
| 1 | Controlled Micro Context | Word-level Spaced Repetition System (SRS), controlled cognitive load | 🔄 Active |
| 2 | Structured Text Context | Phrase/paragraph fill tasks | 🔒 Not started — blocked on Tier 1 completion |
| 3 | Authentic Reading Layer | Long-form reading comprehension | 🔒 Not started — blocked on Tier 2 |

---

## 4 · Shipped Features (reference only)

All prior feature specs are archived at `docs/archive/specs/`.
Note that specs may not reflect the current implementation — the codebase has evolved through multiple iterations and specs were not always updated to match. Treat them as historical context, not ground truth. When in doubt, read the code.

- 2026-04-22: Quiz Results can package one session's failed Hanzi into a named review test session via the existing packaged-session flow.
  Spec: `docs/feature-specs/2026-04-22-results-failed-to-test-session.md`
- 2026-05-02: Bundled phrase quiz mode allows one- and two-phrase characters to enter fill-test sessions through runtime bundles, with per-character grading and unchanged coin logic.
  Spec: `docs/feature-specs/2026-05-02-grouped-phrase-quiz-mode.md`
- 2026-05-11: Coin cash-out (redemption) ships on `/words/shop`. Kids redeem usable coins at 100:1 for real-dollar value with a child-written note and signature. Four-part breakdown panel replaces single wallet balance display. `redeem_coins` RPC is atomic; quiz results remain immutable.
  Spec: `docs/feature-specs/2026-05-11-coin-redemption.md`
- 2026-07-23: Parents can delete a single packaged character from an active review test session on Due Review without deleting the whole session; deleting the last remaining character deletes the session. No new RLS, RPC, or schema — reuses the existing parent-scoped delete policy on `review_test_session_targets`.
  Spec: `docs/feature-specs/2026-07-23-delete-target-from-review-test-session.md`
- 2026-07-25: Save & resume test session progress — children can pause any fill-test session (ad-hoc due-review or packaged) and resume later from Due Review's unified "Paused Sessions" list. Autosave fires after every graded word; resume re-validates the unanswered tail against current content (and, for packaged sessions, current packaged targets) and never re-grades an already-graded word. New `review_session_progress` table with family-scoped read (parent read-only visibility) / user-scoped write RLS; packaged-session cleanup happens server-side in `complete_review_test_session`.
  Spec: `docs/feature-specs/2026-07-24-save-resume-test-session-progress.md`
- 2026-08-13: Phrase-keyed input (item D) completed live QA against a live Supabase dev project, closing the spec's "Handoff — Current State" punch list. An actual quiz run surfaced four real bugs that no amount of mocked testing had caught: Due Review's quiz-ready count/gate ignored phrase targets entirely, so a phrase-only packaged session always read 0/0 and could never start; starting a packaged session always routed through the character-only flashcard phase first, which bounced a phrase-only session straight back out; `getSessionMetadata()` resolved `family_id`/`user_id` from the Supabase JS client's `session.user.app_metadata` (the `auth.users` DB row, frozen since the 2026-08-08 session-scoped-claims migration stopped writing it) instead of the access token's own claims, silently failing autosave RLS for any profile other than whichever happened to be active before that migration; and `cloneFillTest` silently dropped `vocabPhraseMembers` when building the live quiz queue, so phrase-round grading, `vocab_phrases.test_count`, and the familiarity nudge had never actually fired in production despite passing every mocked unit test. Also shipped: a flat 1-coin rule for a correctly-answered phrase (distinct from the character `easy/good/hard/again` coin table), and an inline correct-answer reveal — ruby pinyin plus, for phrase rounds, a bilingual definition card — shown under each wrong sentence in the fill-test review step, for both character and phrase rounds.
  Spec: `docs/feature-specs/2026-07-26-phrase-keyed-input.md`
