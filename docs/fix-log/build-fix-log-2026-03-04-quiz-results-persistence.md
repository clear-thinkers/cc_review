# Fix Log – 2026-03-04 – Quiz Results Persistence

## Context
The Quiz Results page had been wired up, but quizzes launched from `/words/review/fill-test` never produced records in `quizSessions`, so the history table stayed empty even after completing a review session.

## Root Cause
The fill-test auto-start effect initialized quiz state without recording the session start time (`quizSessionStartTime` remained null). The end-of-session logic only persists a record when a start time exists, so the `createQuizSession()` branch never executed for auto-started sessions.

## Changes Applied
- Set `quizSessionStartTime` when the auto-start effect begins a fill-test session so the completion branch can build and save `QuizSession` records.
- Marked the Quiz Results feature spec as shipped and updated the roadmap entry to reflect the completed status.

## Architectural Impact
- UI/domain: ensures fill-test orchestration now consistently records session timings for subsequent domain logic and UI reporting.
- Service: no schema changes; data is persisted to the existing `quizSessions` table as expected.

## Preventative Rule
Always capture and persist session timing metadata before relying on it in completion/outcome logic (e.g., guard clauses that skip persistence when the start time is missing).

## Docs Updated
- AI_CONTRACT.md: no — not touched
- 0_ARCHITECTURE.md: no — no new architectural rules
- 0_BUILD_CONVENTIONS.md: no — no coding convention changes
- 0_PRODUCT_ROADMAP.md: yes — marked Quiz Results Summary as shipped
