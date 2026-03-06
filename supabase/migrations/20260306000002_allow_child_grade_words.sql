-- Migration: Allow children to update words (grading during review/quiz)
-- 2026-03-06
--
-- Reason: The previous migration (20260306000001_words_parent_only_writes.sql)
-- restricted all writes — including UPDATE — to parent role only. This broke
-- grading for child users because gradeWord() must UPDATE scheduler fields
-- (next_review_at, ease, interval_days, repetitions, review_count, test_count)
-- when a child completes a flashcard review or fill-test session.
--
-- Fix: Relax UPDATE back to family-scoped (any family member may update).
-- INSERT and DELETE remain parent-only — children still cannot add or remove words.
-- The RouteGuard UI layer prevents children from reaching /words/add and /words/admin;
-- this policy provides defense-in-depth for INSERT/DELETE while unblocking grading.

drop policy if exists "words: family scoped update" on words;
create policy "words: family scoped update"
on words for update
using (
  is_platform_admin()
  or family_id = current_family_id()
);
