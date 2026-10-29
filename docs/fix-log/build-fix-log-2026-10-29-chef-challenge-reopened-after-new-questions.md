---
title: Fix Log – 2026-10-29 – Finished chef challenge reopened after questions were added
---

## Context
On 2026-10-29 the owner changed Chef Shrewy's challenge to 3 questions per challenge, drawn at random. A wrong answer ends the challenge, and only a fully correct one earns a paw print (migration `20261029150000`). The bug was found before any child played the new version: `scripts/verify-chef-challenge.ts` failed on its "deactivated mid-challenge" scenario. A short challenge that had already ended with a paw print came back as "question 3 of 3".

## Root Cause
A challenge's size is `min(3, correct so far + active questions not yet asked)`, so a recipe with fewer than 3 active questions still gets a finishable challenge. Both RPCs recomputed "finished" from the **current** active questions on every call: `wrong > 0 or correct >= least(3, correct + unasked)`.

Here's what happened in the test. A recipe had 2 active questions, so the challenge size was 2. The child answered both correctly, which finished the challenge and earned a paw print. Then the admin reactivated 3 questions. Now `unasked` was 3, the size became 3, and 2 correct answers no longer met it. `get_chef_challenge` treated the old challenge as still in progress and handed out a third question. A correct answer there would have inserted a **second** `paw_print_awards` row for the same challenge.

## Changes Applied
- `supabase/migrations/20261029160000_chef_challenge_finished_sticky.sql`:
  - `chef_challenge_progress` now also returns `earned`: whether any attempt of this challenge already has a paw print.
  - `get_chef_challenge` and `answer_chef_challenge` treat an earned challenge as finished for good.
  - `answer_chef_challenge` never awards twice for one challenge.
  - Deployed to dev only, like the rest of item T.
- `src/lib/pawPrints.ts` / `pawPrints.types.ts`: the TypeScript reference (`isChefChallengeFinished`, `earnsPawPrint`) takes `alreadyEarned`, with a unit test for the reopen case.
- `scripts/verify-chef-challenge.ts`: the reference comparison now accounts for an earlier award. A new check asserts that a finished short challenge doesn't reopen when questions come back; a new 3-question challenge starts instead. The script passes 36/36 on dev.

## Architectural Impact
None to layer boundaries. This is a server-side rule inside the existing security-definer RPCs; there is no new table, column or policy.

## Preventative Rule
When a state is derived from data an admin can change later (here, which questions are active), anything that has already been settled must be stored or anchored, not recomputed. A challenge's end is anchored by its wrong answer or by its award row. Paw prints must stay one per challenge.

## Docs Updated
- AI_CONTRACT.md: no — no agent rule affected
- 0_ARCHITECTURE.md: yes — Shop Kitchen Rule 22 and guarantee 6e describe the three-question challenge, including that an earned challenge stays finished
- 0_BUILD_CONVENTIONS.md: yes — `verify-chef-challenge.ts` entry (scenarios, 36/36)
- 0_PRODUCT_ROADMAP.md: yes — item T row lists the migrations
