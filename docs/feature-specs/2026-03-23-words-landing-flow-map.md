# Feature Spec - 2026-03-23 - Words Landing Flow Map

## Status: Proposed

## Problem

The current `/words` route immediately redirects to `/words/review`, which makes the review area feel like the default entry point even though the real family flow starts earlier:

1. parent adds characters
2. parent adds content
3. child finds what is due
4. child does flashcard review
5. child takes quizzes

The app needs a clear landing page that explains this full flow at a glance and lets the user jump directly to each major step.

## Scope

- Replace the `/words` redirect with a real landing page.
- Present the learning flow as a vertical map with 5 major numbered steps.
- Make each step link to the page or route that represents that stage.
- Keep the page visually aligned with the existing Words shell and section styling.
- Keep the implementation lightweight:
  - no new database work
  - no new scheduler or review logic
  - no new orchestration flow state
- Add role-aware CTA behavior so parent-only and child-only steps are clearly labeled.
- Ensure runtime-only review pages have a useful empty state when opened directly from the map with no active session.

## Out of Scope

- Step completion tracking or progress persistence
- Auto-launching review or quiz sessions from the landing page
- New tagging, packaging, prompt-management, or batch-generation flows
- Changes to review grading, due logic, or reward logic
- Any redesign of the left-nav shell
- Any new backend tables or APIs

## Route Choice

### Landing route

- `/words` becomes the landing page for the Words area.
- The current redirect in `src/app/words/page.tsx` is removed.
- `/words` remains accessible to both parent and child users.

### Step destinations

The vertical map has 5 major steps with these primary destinations:

1. `Parent Adds Characters`
   - route: `/words/add`
2. `Parent Adds Content`
   - route: `/words/admin`
3. `Child Finds What's Due`
   - route: `/words/review`
4. `Child Does Flashcard Review`
   - route: `/words/review/flashcard`
5. `Child Takes Quiz`
   - route: `/words/review/fill-test`

### Route rationale

- Step 1 and Step 2 point to their existing parent setup pages directly.
- Step 3 points to Due Review because it is already the review entry page and queue overview.
- Step 4 and Step 5 point to the existing runtime routes so each step maps to the page it refers to.
- Because Step 4 and Step 5 are runtime pages, direct access with no active session must show a helpful empty state instead of a blank or confusing screen.

## Architecture Choice

Use the existing Words shell and workspace pattern, with one new lightweight page type:

- add `home` to the Words page model
- render a new home section inside the existing shell
- keep the 5-step map content presentational and static in v1
- do not add new shared workflow state beyond recognizing `page="home"`

This keeps the landing page aligned with the rest of the Words area while avoiding a second shell or a new state system.

## Proposed Behavior

### 1. Landing page layout

- The landing page uses the existing Words shell layout:
  - left navigation
  - shared app title/subtitle
  - shared account/profile area
  - main content column on the right
- The main content contains a single primary section that introduces the flow and then renders the vertical map.
- The map is a top-to-bottom roadmap, not a dashboard grid.

### 2. Vertical map structure

- The map contains exactly 5 major numbered steps.
- The steps are stacked vertically in order from 1 to 5.
- A vertical connector line visually links each step to the next.
- Each step renders as a bordered card/node on the timeline.
- Each step card includes:
  - step number
  - step title
  - short one-sentence description
  - role chip: `Parent` or `Child`
  - route label or page label
  - CTA button/link
- Steps 1-2 should read as setup.
- Steps 3-5 should read as child practice.
- The page should remain fully readable on mobile, with the line/cards collapsing cleanly into one column.

### 3. Step definitions

#### Step 1

- Title: `Parent Adds Characters`
- Description: parent adds the Hanzi that the family wants to study.
- Role chip: `Parent`
- CTA label: `Go to Add Characters`
- Destination: `/words/add`

#### Step 2

- Title: `Parent Adds Content`
- Description: parent generates or edits meanings, phrases, and examples for the new characters.
- Role chip: `Parent`
- CTA label: `Go to Content Admin`
- Destination: `/words/admin`

#### Step 3

- Title: `Child Finds What's Due`
- Description: child opens the due list to see which characters are ready to practice now.
- Role chip: `Child`
- CTA label: `Open Due Review`
- Destination: `/words/review`

#### Step 4

- Title: `Child Does Flashcard Review`
- Description: child reviews the character cards before moving on to quiz practice.
- Role chip: `Child`
- CTA label: `Open Flashcards`
- Destination: `/words/review/flashcard`

#### Step 5

- Title: `Child Takes Quiz`
- Description: child completes the fill-in quiz after review.
- Role chip: `Child`
- CTA label: `Open Quiz`
- Destination: `/words/review/fill-test`

### 4. Role-aware behavior

- Both parent and child users can view the landing page.
- If the current user cannot access a step route, the step remains visible but its CTA is disabled.
- Disabled CTA copy should stay explicit rather than disappearing.
- Parent-only steps should be visibly parent-labeled in child view.
- Child-only steps should be visibly child-labeled in parent view.
- Existing route guard logic remains the source of truth for route access.

### 5. Direct runtime page behavior

To support map links for Step 4 and Step 5:

- Opening `/words/review/flashcard` with no active flashcard session should show a friendly empty state.
- Opening `/words/review/fill-test` with no active quiz session should also show a friendly empty state.
- Each empty state should tell the user to start from Due Review if no session is active.
- Each empty state should include a simple return action back to `/words/review` or `/words`.

This is a supporting usability fix so the map can link to the actual runtime pages without dead-end behavior.

## Component Structure

### New or updated routes

- `src/app/words/page.tsx`
  - stop redirecting
  - render the new home page instead
- `src/app/words/HomePage.tsx`
  - mirror the existing page wrapper pattern used by Add/Review/Admin pages
  - render `WordsWorkspace page="home"` inside `Suspense`

### New UI component

- `src/app/words/home/HomeFlowSection.tsx`
  - presentational section for the landing page
  - owns the 5-step map markup and step metadata
  - no backend fetches
  - no new domain state

Optional helper:

- `src/app/words/home/home.types.ts`
  - only if a dedicated step type improves clarity

### Existing shared files to update

- `src/app/words/WordsWorkspace.tsx`
  - render `HomeFlowSection`
- `src/app/words/shared/shell.types.ts`
  - add `home` to `NavPage`
  - add `home` to `WordsSectionPage`
- `src/app/words/shared/words.shared.state.ts`
  - accept `page="home"`
  - set `activeMenuPage` correctly for home
  - do not add new review/admin orchestration state
- `src/app/words/shared/words.shared.utils.tsx`
  - include `/words` in nav generation
- `src/app/words/words.strings.ts`
  - add nav label and home-page copy for EN/ZH
- `src/lib/permissions.ts`
  - add `/words` to the protected-route type and permission matrix for clarity

### Supporting review-page updates

- `src/app/words/review/flashcard/FlashcardReviewSection.tsx`
  - ensure direct access empty state stays clear and actionable
- `src/app/words/review/fill-test/FillTestReviewSection.tsx`
  - add a direct-access empty state when no quiz session is active

## Visual Direction

- Match the existing shell and section framing already used in the Words pages.
- Reuse the app's current border, radius, spacing, and button language.
- Avoid turning the landing page into a card dashboard.
- The page should feel like a guided roadmap:
  - numbered markers
  - one vertical path
  - simple directional flow
- Parent setup steps and child practice steps may use slightly different accent colors, but the page should stay within the current design language.

## Layer Impact

### UI

- new landing-page section and route
- nav item for home
- role-aware step CTA states
- runtime empty-state improvement for direct route access

### Shared state / shell

- add a new `home` page mode only
- no new business logic or persistence

### Routing / permissions

- `/words` becomes a first-class page rather than a redirect
- permissions explicitly cover `/words`

### Strings

- new bilingual nav label
- new bilingual home-page title, description, step titles, step descriptions, role labels, and CTA labels
- new bilingual direct-access empty-state copy for fill-test if needed

## Edge Cases

- Child views the landing page and sees parent-only setup steps.
- Parent views the landing page and sees child-only quiz step.
- User clicks Step 4 or Step 5 directly with no active session.
- User on mobile must still understand the order and connector line.
- Very long translated copy must not break the numbered step layout.
- Existing quiz-exit warning behavior must still work when navigating away from active review flows through normal shell navigation.

## Risks

- If `/words` is added outside the current shell model, the landing page could drift visually from the rest of the Words area.
- If Step 4 or Step 5 routes are linked without direct-access empty states, the map will feel broken.
- If the page becomes too dynamic in v1, it may pull landing-page concerns into shared review/admin state unnecessarily.
- If role-disabled steps are hidden instead of shown, the map will stop explaining the full family flow.

## Test Plan

- Route test: `/words` renders the landing page and no longer redirects to `/words/review`.
- Nav test: home/landing nav item appears in the Words shell and is active on `/words`.
- UI test: the map renders exactly 5 numbered steps in the correct order.
- UI test: each step CTA points to the expected route.
- UI test: inaccessible step CTAs are disabled for the current role.
- UI test: parent-labeled and child-labeled steps remain visible regardless of viewer role.
- Review UI test: direct access to `/words/review/flashcard` with no active session shows a helpful empty state.
- Review UI test: direct access to `/words/review/fill-test` with no active session shows a helpful empty state.
- Manual verification:
  - desktop layout reads clearly as one vertical roadmap
  - mobile layout preserves order and readability
  - step links feel consistent with the existing shell and page styles

## Acceptance Criteria

- Visiting `/words` shows a landing page instead of redirecting to Due Review.
- The landing page uses the existing Words shell and visually matches the current Words area.
- The landing page shows a vertical flow map with exactly 5 major numbered steps.
- Each step includes a title, description, role label, and CTA.
- Each step CTA points to the route chosen for that stage:
  - `/words/add`
  - `/words/admin`
  - `/words/review`
  - `/words/review/flashcard`
  - `/words/review/fill-test`
- Users can see the full family flow even when some steps are not available to their current role.
- Steps with inaccessible routes are clearly disabled rather than hidden.
- Directly opening the flashcard or fill-test route from the landing page does not leave the user on a blank or confusing screen when no session is active.
- The implementation does not add new backend storage, service methods, or review/admin workflow state.

## Open Questions

- None. The landing-page nav label is confirmed as:
  - EN: `App Flow`
  - ZH: `使用流程`
