---
title: Fix Log – 2026-10-29 – Question import re-added questions deleted in Shop Admin
---

## Context
The owner reviewed the imported chef-challenge questions in Shop Admin on dev and deleted 5 of them (two bubble tea, one bun, one popcorn chicken, one rice ball). Later, the owner asked for 5 new 盖浇饭 questions to be added. Running `npm run seed:chef-challenge-questions` for those imported **10** questions: the 5 new ones, plus the 5 the owner had just deleted, which came back from the content file.

## Root Cause
`scripts/seed-chef-challenge-questions.ts` treated `content/chef-challenges/questions.zh.json` as the source of truth and added any file question whose prompt its recipe didn't already have. A question deleted in Shop Admin is indistinguishable from a brand-new one by that rule. The file had not been updated after the owner's review, so it still held the deleted questions.

## Changes Applied
- **dev data:** the 5 re-added rows were deleted. They were matched exactly by their insert timestamp and prompt; nothing else was touched, so the owner's review is restored. The 5 new 盖浇饭 questions (recipe `fried-egg-over-rice`) stay.
- **`scripts/seed-chef-challenge-questions.ts`:**
  - **`--export`:** writes the database's current questions back to the content file, so the file can follow the Shop Admin review (deletions, edits, additions, inactive questions as `is_active: false`).
  - **`--recipe <slug>[,<slug>]`:** imports only the listed recipes' questions.
  - **Listing:** every question about to be added is printed (also on `--dry-run`).
  - The file's `is_active` is honored on import.
- **`content/chef-challenges/questions.zh.json`:** re-exported from dev. It now holds the owner-reviewed 67 questions, including one the owner added for ramen in Shop Admin.

## Architectural Impact
None. The script is admin tooling; no schema, RPC or app code changed.

## Preventative Rule
Once questions live in the database, Shop Admin is the source of truth and the content file is a copy. After reviewing in Shop Admin, run `--export` before any further import. When adding new questions, import with `--recipe` and check the dry-run listing first.

## Docs Updated
- AI_CONTRACT.md: no
- 0_ARCHITECTURE.md: yes — Shop Admin Rule 13 notes that the database is the source of truth and describes the export workflow
- 0_BUILD_CONVENTIONS.md: yes — §10 seed script entry (flags, workflow, last run)
- 0_PRODUCT_ROADMAP.md: no — no scope change
