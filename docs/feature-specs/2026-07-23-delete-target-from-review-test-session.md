# Feature Spec — 2026-07-23 — Delete a Character from a Packaged Review Test Session

## Status: Shipped 2026-07-23

## Problem

Parents can already delete an entire active packaged review test session from Due
Review (`/words/review`), but cannot remove a single mis-packaged character without
destroying the whole session and re-creating it. There was no way to correct a
packaged session in place.

## Scope

- Add a per-character "Remove" control to each active packaged review test session
  row on Due Review, visible to parents (and platform admin) only.
- Removing a character deletes only that `review_test_session_targets` row.
- If the removed character is the session's last remaining target, the whole
  `review_test_sessions` row is deleted instead (an empty session cannot exist).

## Out of scope

- Any change to `quiz_sessions` (the completed-session audit history on
  `/words/results`). That table remains an immutable, insert-only audit record —
  this feature does not touch it.
- New RPC, new route, or RLS policy changes. The existing parent-scoped `DELETE`
  policy on `review_test_session_targets` (from
  `supabase/migrations/20260322000001_review_test_sessions_delete_policy.sql`)
  already covers this.
- Re-ordering or renumbering `display_order` on the remaining targets after a
  deletion — gaps in `display_order` are harmless since sessions sort by value,
  not contiguity.

## Proposed behavior

- Each packaged target renders as a chip (character + inline "Remove" button) in
  the "Packaged targets" column, for parent view only. Child/non-parent view keeps
  the existing plain comma-joined character preview.
- Removing a non-last target is immediate, no confirmation dialog — matches the
  existing `/words/all` word-delete precedent (immediate removal, no dialog).
- Removing the session's last remaining target reuses the existing whole-session
  delete confirmation dialog text before proceeding, since the outcome (whole
  session gone) matches deleting the session directly.
- Service layer: `deleteReviewTestSessionTarget(sessionId, character, pronunciation)`
  deletes the one target row scoped by `family_id`, then re-counts remaining
  targets for that session. If none remain, it calls the existing
  `deleteReviewTestSession(sessionId)` to remove the now-empty session row.

## Layer impact

| Layer | Touched | Notes |
|---|---|---|
| UI | Yes | `src/app/words/review/DueReviewSection.tsx` |
| Domain | No | No scheduler/grading logic involved |
| Service | Yes | `src/lib/supabase-service.ts` — new `deleteReviewTestSessionTarget` |
| AI | No | — |

Also touched: `src/app/words/shared/words.shared.state.ts` (handler wiring),
`src/app/words/words.strings.ts` (bilingual strings).

Two layers touched would normally require a full spec before coding per
`BUILD_CONVENTIONS §1`; this file is written after implementation instead, per the
explicit substitution allowed for low-risk changes (no schema, RPC, route, or RLS
change) — logged per user request for an audit trail.

## Edge cases

- Removing the only target in a session deletes the session (by design, per
  explicit product decision — not a blocked action, unlike the analogous Content
  Admin rule that blocks deleting the last pronunciation row for a character).
- Two rapid clicks on the same target's remove button are guarded by a
  `deletingTargetKey` disabled state in the UI, preventing a duplicate request for
  the same target while one is in flight.
- No transaction wraps the delete-then-recount-then-maybe-delete-session sequence,
  matching the existing non-transactional style already used by
  `appendTargetsToReviewTestSession` in the same file. Acceptable at current pilot
  family scale; would need revisiting only if concurrent multi-device edits to the
  same session become common.

## Risks

- None to wallet, coin, or scheduler state — this feature does not touch those
  tables or RPCs.
- Small theoretical race: if a target is deleted from two sessions/devices at
  nearly the same instant, the recount could momentarily race. Low likelihood at
  family scale and no data-integrity consequence (worst case, a session is deleted
  one click later than expected, or a redundant delete no-ops).

## Test plan

- `src/lib/supabase-service.reviewTestSessions.test.ts`:
  - Deletes a target and leaves the session intact when other targets remain
    (`sessionDeleted: false`).
  - Deletes a target and cascades into a full session delete when it was the last
    target (`sessionDeleted: true`).
  - Propagates the underlying error and never attempts a session delete when the
    target delete itself fails.
- Full existing suite (`npx vitest run`) re-run to confirm no regressions: 38 test
  files, 404 tests passing.
- `npm run check:encoding` and `npx tsc --noEmit` both pass.

## Acceptance criteria

- [x] Parent can remove a single character from an active packaged review test
      session without affecting the other packaged characters.
- [x] Removing the last character in a session deletes the session.
- [x] Children never see the per-target delete control.
- [x] No RLS, RPC, schema, or route changes were introduced.
- [x] All new and existing tests pass; encoding and typecheck are clean.

## Open questions

None outstanding.
