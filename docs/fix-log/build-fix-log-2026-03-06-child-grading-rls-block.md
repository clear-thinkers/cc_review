# Fix Log – 2026-03-06 – Child grading blocked by words RLS policy

## Context

When a child user submits a fill-test or flashcard review, the console shows:
`gradeWord write: new row violates row-level security policy for table "words"`

## Root Cause

Migration `20260306000001_words_parent_only_writes.sql` restricted all words
writes (INSERT, UPDATE, DELETE) to the `parent` role as defense-in-depth for the
product rule "Child: no add/edit/admin." This was too broad — UPDATE is required
for grading (scheduling field persistence) during review/quiz sessions, which
children are expected to do.

Additionally, `gradeWord` used `.upsert()` which triggers the INSERT policy even
though the row already exists. PostgreSQL evaluates the INSERT WITH CHECK clause
first for `INSERT ... ON CONFLICT DO UPDATE`, adding a second point of failure.

## Changes Applied

| File | Change |
|---|---|
| `supabase/migrations/20260306000002_allow_child_grade_words.sql` | New migration: drops parent-only UPDATE policy, recreates it as family-scoped (any family member) |
| `src/lib/supabase-service.ts` | `gradeWord`: changed `.upsert(row)` → `.update(row).eq("id", id)` since the row is known to exist from the preceding read |

## Architectural Impact

- INSERT and DELETE on `words` remain parent-only (defense-in-depth intact for add/delete)
- UPDATE on `words` is family-scoped (no role restriction) to support child grading
- No changes to RouteGuard, permission matrix, or UI layer

## Preventative Rule

When restricting write policies by role, verify that *every* service function writing
to that table is mapped against the role that calls it. Grading is a write operation
invoked by both parent and child roles.

## Docs Updated

- No `0_` doc changes needed (architecture boundaries unchanged; RLS spec describes
  the intent but does not enumerate per-policy role filters at this level of detail)
