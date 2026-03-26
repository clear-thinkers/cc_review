# Feature Spec — 2026-03-23 — Content Admin Batch Generation Toolbar

## Problem

The Content Admin page currently splits batch generation controls from the main action toolbar. This separates filter controls from action controls and makes the generation workflows less consistent than the other batch actions.

The existing generation buttons also expose only one batch behavior each:
- AI content generation skips saved targets only
- pinyin generation refreshes missing example pinyin only

The page now needs action-toolbar versions of both buttons with explicit scope choices.

## Scope

- Move the two batch generation buttons into the existing Content Admin action toolbar
- Keep the existing yellow and purple visual identities
- Match toolbar button sizing with the other toolbar actions
- Rename the visible labels to:
  - `AI Content Generation`
  - `Pinyin Generation`
  - `AI生成内容`
  - `批量生成拼音`
- Add scope menus for both buttons
- Add warning confirmation dialogs for the destructive “all” variants
- Preserve existing AI/service-layer boundaries

## Out of scope

- New routes
- New AI providers
- Changes to scheduler or review behavior
- Redesigning the row-level admin actions

## Proposed behavior

### AI Content Generation

Menu options:
- Generate for missing ones only
- Regenerate everything
- Regenerate filtered only
- Regenerate selected only

Behavior rules:
- `missing only` resolves against all admin targets and skips targets that already have saved content
- `everything` resolves against all admin targets and overwrites saved content
- `filtered only` resolves against the current filtered target set and overwrites saved content
- `selected only` resolves against the current selected target set and overwrites saved content
- `everything` requires a warning confirmation dialog before execution
- Batch execution keeps the existing concurrency cap of 3

### Pinyin Generation

Menu options:
- Generate for phrases and examples missing pinyin
- Refresh pinyin for all saved contents
- Regenerate filtered only
- Regenerate selected only

Behavior rules:
- `missing only` resolves against saved admin content and only fills missing phrase/example pinyin fields
- `all saved contents` resolves against saved admin content and refreshes phrase/example pinyin for the whole scope
- `filtered only` resolves against the current filtered saved targets and refreshes phrase/example pinyin
- `selected only` resolves against the current selected saved targets and refreshes phrase/example pinyin
- `all saved contents` requires a warning confirmation dialog before execution

## Layer impact

- UI: `AdminSection.tsx` toolbar layout, menus, confirmation dialogs
- Domain/state: `words.shared.state.ts` scoped batch-generation handlers
- Strings/types: admin strings and batch-generation types
- Docs: architecture rules for Content Admin batch actions

## Edge cases

- No filtered targets
- No selected targets
- Selected targets without saved content for pinyin actions
- Missing-only AI action when everything is already saved
- Missing-only pinyin action when all eligible pinyin is already present
- Ongoing generation should keep conflicting actions disabled

## Risks

- Toolbar crowding on smaller screens
- Confusion between selection controls and selection-scoped generation unless labels stay explicit
- Destructive “all” actions need stronger confirmation language than the scoped actions

## Test Plan

- Unit test any new batch-generation scope types/helpers
- Verify EN/ZH admin string parity for the new toolbar/menu/dialog strings
- Run the existing AdminSection tests after the toolbar refactor

## Acceptance criteria

- Both generation buttons live in the Content Admin action toolbar
- Both buttons keep their color identity but match toolbar sizing
- Clicking each button opens the correct four-option menu
- The “all” option for each button shows a warning confirmation dialog
- Filtered and selected options use the current filter/selection state
- Batch AI generation and pinyin refresh still run through existing admin/service flows only

## Open questions

- None at build start; the existing `phrase_details` and `example_pinyin` routes are sufficient for phrase/example pinyin refresh without adding a new API mode.
