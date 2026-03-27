# Button Style Reference - HanziQuest (`cc_review`)

_Last updated: 2026-03-27. Ground truth after semantic workspace token rollout, results button migration, toggle-token extraction, and flashcard reveal-button remapping._

## Base Patterns

**Current semantic color classes in `src/app/globals.css`**

- `.btn-primary` -> `border-emerald-600 bg-emerald-600 text-white`
- `.btn-secondary` -> `border-sky-300 bg-sky-50 text-sky-800`
- `.btn-caution` -> `border-amber-400 bg-amber-100 text-amber-900`
- `.btn-confirm` -> `border-green-500 bg-green-100 text-green-900`
- `.btn-neutral` -> `border-gray-400 bg-gray-100 text-gray-700`
- `.btn-destructive` -> `border-rose-500 bg-rose-50 text-rose-700`
- `.btn-nav` -> `border-[#dcc38a] bg-[#fcf8ef] text-[#6a5530]`
- `.btn-toggle-on` -> `border-teal-600 bg-teal-50 text-teal-700`

`btn-nav` is commonly paired with a local hover utility such as `hover:bg-[#fff1cd]` when the control needs a stronger page-navigation affordance.

**Shared size shapes currently in use**

- Full action buttons: `rounded-md border-2 px-4 py-2 font-medium disabled:opacity-50`
- Compact inline buttons: `rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none`
- Admin compact reference: `inline-flex min-h-5 items-center justify-center rounded border-2 px-1.5 py-px text-[11px] font-medium leading-none disabled:opacity-50`

**Shop Admin local theme**

- `src/app/words/shop-admin/ShopAdminSection.tsx` now reads its gold/cream palette from scoped CSS custom properties in `src/app/globals.css` under `.shop-admin-pane`.
- Shop Admin cards, text, inputs, and helper surfaces remain intentionally distinct from the workspace action palette.
- Shop Admin buttons now use the shared workspace semantic button classes chosen by intent: `btn-primary`, `btn-secondary`, `btn-caution`, `btn-destructive`, and `btn-nav`.

## Semantic Tokens

| Token | Role | Current class |
| --- | --- | --- |
| `btn-primary` | Save, submit, create/confirm | `btn-primary` |
| `btn-secondary` | Edit, add row, batch update, selection actions | `btn-secondary` |
| `btn-caution` | Reset, preload/generate, fill-test entry, review-test launch | `btn-caution` |
| `btn-confirm` | Start review, review navigation | `btn-confirm` |
| `btn-neutral` | Cancel, clear, disabled child-only labels, some dialogs | `btn-neutral` |
| `btn-destructive` | Delete, clear history path, stop/leave session | `btn-destructive` |
| `btn-nav` | Page navigation, pagination, tab switching, viewer close, non-mutating flow controls | `btn-nav` |
| `btn-toggle-on` | Toggle on-state for testing inclusion | `btn-toggle-on` |

## Primary Buttons

| Intent | Class string | Reference file |
| --- | --- | --- |
| Add characters submit | `btn-primary rounded-md border-2 px-4 py-2` | `src/app/words/add/AddSection.tsx` |
| Add page create-new confirm | `btn-primary rounded-md border-2 px-3 py-2 text-sm` | `src/app/words/add/AddSection.tsx` |
| Prompts save | `btn-primary rounded-md border-2 px-4 py-2 font-medium disabled:opacity-50` | `src/app/words/prompts/PromptsSection.tsx` |
| All words batch save | `btn-primary rounded-md border-2 px-4 py-2 font-medium disabled:opacity-50` | `src/app/words/all/AllWordsSection.tsx` |
| All words batch update | `btn-secondary rounded-md border-2 px-4 py-2 font-medium disabled:opacity-50` | `src/app/words/all/AllWordsSection.tsx` |
| Due review start flashcard | `btn-confirm rounded-md border-2 px-4 py-2 font-medium disabled:opacity-50` | `src/app/words/review/DueReviewSection.tsx` |
| Due review start fill-test | `btn-caution rounded-md border-2 px-4 py-2 font-medium disabled:opacity-50` | `src/app/words/review/DueReviewSection.tsx` |
| Fill-test submit | `btn-primary rounded-md border-2 px-4 py-2 disabled:opacity-50` | `src/app/words/review/fill-test/FillTestReviewSection.tsx` |
| Flashcard empty-state CTA | `btn-confirm rounded-md border-2 px-4 py-2 text-sm font-medium` | `src/app/words/review/flashcard/FlashcardReviewSection.tsx` |
| Flashcard empty-state home link | `btn-neutral rounded-md border px-4 py-2 text-sm font-medium` | `src/app/words/review/flashcard/FlashcardReviewSection.tsx` |
| Admin preload | `admin-toolbar-button ... btn-caution` | `src/app/words/admin/AdminSection.tsx` |
| Admin add to review-test session | `admin-toolbar-button ... admin-toolbar-button--session btn-secondary` | `src/app/words/admin/AdminSection.tsx` |
| Home flow CTA | `btn-nav inline-flex min-h-10 items-center rounded-full border-2 px-5 py-2 text-sm font-semibold transition` | `src/app/words/home/HomeFlowSection.tsx` |
| Results empty-state review CTA | `btn-nav rounded-full border-2 px-6 py-3 text-lg font-bold transition` | `src/app/words/results/EmptyState.tsx` |

## Secondary Buttons

| Intent | Class string | Reference file |
| --- | --- | --- |
| Admin table save | `inline-flex ... btn-primary` | `src/app/words/admin/AdminSection.tsx` |
| Admin table regenerate | `inline-flex ... btn-caution` | `src/app/words/admin/AdminSection.tsx` |
| Admin table add/edit | `inline-flex ... btn-secondary` | `src/app/words/admin/AdminSection.tsx` |
| Admin table clear/cancel | `inline-flex ... btn-neutral` | `src/app/words/admin/AdminSection.tsx` |
| All words row reset | `rounded border-2 px-1.5 py-0.5 text-[11px] ... btn-caution` | `src/app/words/all/AllWordsSection.tsx` |
| Prompts slot edit | `rounded border-2 px-1.5 py-0.5 text-[11px] ... btn-secondary` | `src/app/words/prompts/PromptsSection.tsx` |
| Due table flashcard | `rounded border-2 px-1.5 py-0.5 text-[11px] ... btn-confirm` | `src/app/words/review/DueReviewSection.tsx` |
| Due table fill-test | `rounded border-2 px-1.5 py-0.5 text-[11px] ... btn-caution` | `src/app/words/review/DueReviewSection.tsx` |
| Debug edit/save/cancel rows | compact buttons using `btn-primary`, `btn-secondary`, `btn-neutral` | `src/app/words/debug/DebugSection.tsx` |
| Pagination / viewer controls | compact buttons using `btn-nav` | `src/app/words/all/AllWordsSection.tsx`, `src/app/words/admin/AdminSection.tsx`, `src/app/words/review/fill-test/FillTestReviewSection.tsx`, `src/app/words/prompts/PromptsSection.tsx` |
| Shop Admin add/save/reset/toggle actions | `btn-secondary`, `btn-primary`, `btn-caution`, `btn-nav` | `src/app/words/shop-admin/ShopAdminSection.tsx` |

## Destructive Buttons

| Intent | Class string | Reference file |
| --- | --- | --- |
| Admin row delete | `inline-flex ... btn-destructive` | `src/app/words/admin/AdminSection.tsx` |
| All words delete | `rounded border-2 px-1.5 py-0.5 text-[11px] ... btn-destructive` | `src/app/words/all/AllWordsSection.tsx` |
| Due review test-session delete | `rounded border-2 px-1.5 py-0.5 text-[11px] ... btn-destructive` | `src/app/words/review/DueReviewSection.tsx` |
| Debug cleanup | `btn-destructive rounded-md border-2 px-4 py-2 font-medium` | `src/app/words/debug/DebugSection.tsx` |
| Flashcard stop | `btn-destructive rounded-md border-2 px-3 py-2` | `src/app/words/review/flashcard/FlashcardReviewSection.tsx` |
| Fill-test stop | `btn-destructive rounded-md border-2 px-3 py-2` | `src/app/words/review/fill-test/FillTestReviewSection.tsx` |
| Quiz exit leave | `btn-destructive rounded-full border-2 px-5 py-2.5 font-semibold` | `src/app/words/shared/WordsShell.tsx` |
| Results clear history | `btn-destructive rounded border-2 px-3 py-1 text-[11px] font-medium leading-none` | `src/app/words/results/SessionHistoryTable.tsx` |
| Results confirm delete | `btn-destructive rounded-md border px-3 py-2 text-sm font-medium` | `src/app/words/results/ClearHistoryDialog.tsx` |
| Shop Admin remove/delete actions | `btn-destructive` | `src/app/words/shop-admin/ShopAdminSection.tsx` |

## Toggle States

| Intent | Class string | Reference file |
| --- | --- | --- |
| Admin fill-test include off-state | `inline-flex ... btn-neutral` | `src/app/words/admin/AdminSection.tsx` |
| Admin fill-test include on-state | `inline-flex ... btn-toggle-on` | `src/app/words/admin/AdminSection.tsx` |
| Prompt tab active | `rounded-md border-2 border-sky-400 bg-sky-50 ...` | `src/app/words/prompts/PromptsSection.tsx` |
| Prompt tab inactive | `btn-nav rounded-md border-2 px-3 py-1 text-sm font-medium` | `src/app/words/prompts/PromptsSection.tsx` |
| Flashcard reveal / hide | `rounded-md border-2 px-3 py-2 btn-secondary` | `src/app/words/review/flashcard/FlashcardReviewSection.tsx` |
| Shop Admin filter / recipe-selection states | active `btn-secondary`; inactive `btn-nav` | `src/app/words/shop-admin/ShopAdminSection.tsx` |
| Shared shell/theme-specific toggles | bespoke local patterns | `src/app/words/shared/WordsShell.tsx` |

## Dialog Buttons

| Intent | Class string | Reference file |
| --- | --- | --- |
| Results cancel delete | `btn-neutral rounded-md border px-3 py-2 text-sm font-medium` | `src/app/words/results/ClearHistoryDialog.tsx` |
| Results confirm delete | `btn-destructive rounded-md border px-3 py-2 text-sm font-medium` | `src/app/words/results/ClearHistoryDialog.tsx` |

## Inputs

| Intent | Class string | Reference file |
| --- | --- | --- |
| Add page text input | `w-full rounded-md border px-3 py-2` | `src/app/words/add/AddSection.tsx` |
| All words filter controls | `rounded-md border px-2 py-1 text-sm` | `src/app/words/all/AllWordsSection.tsx` |
| Admin inline editors | `w-full rounded-md border px-2 py-1 text-sm` | `src/app/words/admin/AdminSection.tsx` |
| Prompt textarea | `w-full rounded-md border px-2 py-1 text-sm font-mono` | `src/app/words/prompts/PromptsSection.tsx` |
| Review-test session name input | `h-9 min-w-[12rem] rounded-md border border-indigo-300 px-3 py-1.5 text-xs` | `src/app/words/admin/AdminSection.tsx` |
| Shop admin form controls | custom rounded-xl gold/cream system backed by scoped CSS variables | `src/app/words/shop-admin/ShopAdminSection.tsx` |

## Rules

- Prefer the semantic button classes in `src/app/globals.css` for workspace actions: `btn-primary`, `btn-secondary`, `btn-caution`, `btn-confirm`, `btn-neutral`, `btn-destructive`, `btn-nav`, `btn-toggle-on`.
- Amber has been collapsed to one caution token: use `btn-caution` instead of mixing `amber-400` and `amber-500`.
- Destructive actions have been collapsed to rose: use `btn-destructive` instead of red button variants.
- Use `btn-nav` as the default for page navigation, pagination, tab switches, viewer close controls, and other actions that move the user without changing persisted content.
- Keep size and layout local for now. This repo still uses multiple size patterns; only the color intent is centralized in this step.
- Source user-facing labels, tooltips, placeholders, ARIA text, and notices from bilingual string objects.
- Do not rely on bare `border` or raw gold token strings for buttons. Use a semantic button class instead.
- Use `src/app/words/admin/AdminSection.tsx` as the reference implementation for semantic action buttons in the workspace.
- Keep the Shop Admin surface theme separate from workspace semantic buttons, but source its gold/cream palette from scoped CSS custom properties instead of repeated literal hex values.
- `/words/results` no longer maintains a separate CSS-module button system. Use the shared semantic tokens there as well.
- On `/words/shop-admin`, choose shared semantic button classes by usage:
  `btn-primary` save, `btn-secondary` add/create/select-active, `btn-caution` reset/reorder, `btn-destructive` remove/delete, `btn-nav` collapse and non-mutating navigation/view-state controls.

## Known Inconsistencies

- `src/app/words/review/fill-test/FillTestReviewSection.tsx` still uses custom `quiz-phrase-pill` and sentence-slot visuals that do not fit the semantic button system.
- `src/app/words/shop/ShopSection.tsx` still uses a separate shop skin and bespoke button sizing. That visual separation is intentional and should be cleaned up through shop-specific variables, not by forcing the admin token set onto the shop.
- `src/app/words/shared/WordsShell.tsx` still contains a hardcoded English fallback: `vm.str.nav.logout ?? 'Logout'`.
