# Button Style Reference - HanziQuest (`cc_review`)

_Last updated: 2026-03-27. Audited against the current `src/app/words/` implementation._

## Base Patterns

**Primary Tailwind base**
`rounded-md border-2 px-4 py-2 font-medium disabled:opacity-50`

Color families actually in use with this base:
- `border-emerald-600 bg-emerald-600 text-white`
- `border-sky-300 bg-sky-50 text-sky-800`
- `border-amber-400 bg-amber-100 text-amber-900`
- `border-amber-500 bg-amber-100 text-amber-900`
- `border-green-500 bg-green-100 text-green-900`
- `border-gray-400 bg-gray-100 text-gray-700`
- `border-gray-300 bg-gray-50 text-gray-700`
- `border-rose-500 bg-rose-50 text-rose-700`
- `border-purple-300 bg-purple-100 text-purple-700`

**Secondary Tailwind base**
Admin table reference:
`inline-flex min-h-5 items-center justify-center rounded border-2 px-1.5 py-px text-[11px] font-medium leading-none disabled:opacity-50`

Close variants also in use:
- `rounded border-2 px-1.5 py-0.5 text-[11px] font-medium leading-none disabled:opacity-50`
- `rounded border px-2 py-1 text-xs disabled:opacity-50`
- `rounded border px-3 py-1 text-sm disabled:opacity-50`

Global overrides that change the visual result inside `.kids-page`:
- `button.bg-black` is restyled to a green gradient with a green border in `src/app/globals.css:130`
- `button.border:not(.admin-toolbar-button)` is restyled to the gold workspace button in `src/app/globals.css:143`

## Primary Buttons

| Intent | Class string | Reference file |
| --- | --- | --- |
| Add word / submit quiz | `rounded-md bg-black px-4 py-2 text-white disabled:opacity-50` | `src/app/words/add/AddSection.tsx:462 (AddSection)` |
| Batch save / save form | `rounded-md border-2 border-emerald-600 bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50` | `src/app/words/prompts/PromptsSection.tsx:326 (PromptsSection)` |
| Batch update / add slot | `rounded-md border-2 border-sky-300 bg-sky-50 px-4 py-2 font-medium text-sky-800 disabled:opacity-50` | `src/app/words/all/AllWordsSection.tsx:876 (AllWordsSection)` |
| Start flashcard review | `rounded-md border-2 border-green-500 bg-green-100 px-4 py-2 font-medium text-green-900 disabled:opacity-50` | `src/app/words/review/DueReviewSection.tsx:202 (DueReviewSection)` |
| Start fill-test review | `rounded-md border-2 border-amber-500 bg-amber-100 px-4 py-2 font-medium text-amber-900 disabled:opacity-50` | `src/app/words/review/DueReviewSection.tsx:210 (DueReviewSection)` |
| Neutral cancel / reset | `rounded-md border-2 border-gray-400 bg-gray-100 px-4 py-2 font-medium text-gray-700 disabled:opacity-50` | `src/app/words/prompts/PromptsSection.tsx:335 (PromptsSection)` |
| Admin toolbar preload | `admin-toolbar-button inline-flex items-center gap-1 rounded-md border px-3 py-1.5 font-medium leading-none disabled:opacity-50` + `border-amber-400 bg-amber-100 text-amber-900` | `src/app/words/admin/AdminSection.tsx:837,1246 (AdminSection)` |
| Admin toolbar refresh all pinyin | `admin-toolbar-button inline-flex items-center gap-1 rounded-md border px-3 py-1.5 font-medium leading-none disabled:opacity-50` + `border-purple-300 bg-purple-100 text-purple-700` | `src/app/words/admin/AdminSection.tsx:837,1268 (AdminSection)` |
| Admin toolbar review-test session | `admin-toolbar-button admin-toolbar-button--session inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 font-medium leading-none text-sky-800 disabled:opacity-50` | `src/app/words/admin/AdminSection.tsx:1282 (AdminSection)` |
| Admin toolbar batch fill-test toggle | `admin-toolbar-button rounded-md border border-teal-600 bg-teal-50 px-3 py-1.5 font-medium leading-none text-teal-700 disabled:opacity-50` | `src/app/words/admin/AdminSection.tsx:835,1328 (AdminSection)` |
| Shop admin save bar | `shop-admin-pill border border-[#d2b15b] bg-[#fff0bf] px-5 py-2 text-sm font-semibold text-[#8b6f2f] shadow-[0_8px_20px_rgba(210,177,91,0.18)] disabled:cursor-not-allowed disabled:opacity-50` | `src/app/words/shop-admin/ShopAdminSection.tsx:1609 (ShopAdminSection)` |
| Shop admin add button | `shop-admin-pill border border-[#d2b15b] bg-[#fff4d9] px-4 py-2 text-sm font-semibold text-[#8b6f2f]` | `src/app/words/shop-admin/ShopAdminSection.tsx:726 (ShopAdminSection)` |
| Home flow CTA link | `inline-flex min-h-10 items-center rounded-full border-2 border-[#dcc38a] bg-[#fcf8ef] px-5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-[#f8f1e3]` | `src/app/words/home/HomeFlowSection.tsx:118 (HomeFlowSection)` |
| Empty-state link to review | `rounded-md border-2 border-green-500 bg-green-100 px-4 py-2 text-sm font-medium text-green-900` | `src/app/words/review/flashcard/FlashcardReviewSection.tsx:52 (FlashcardReviewSection)` |
| Empty-state link to home | `rounded-md border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700` | `src/app/words/review/flashcard/FlashcardReviewSection.tsx:58 (FlashcardReviewSection)` |

## Secondary Buttons

| Intent | Class string | Reference file |
| --- | --- | --- |
| Admin table regenerate | `inline-flex min-h-5 items-center justify-center rounded border-2 px-1.5 py-px text-[11px] font-medium leading-none disabled:opacity-50` + `border-amber-400 bg-amber-100 text-amber-900` | `src/app/words/admin/AdminSection.tsx:240 (AdminTableRowComponent)` |
| Admin table save | `inline-flex min-h-5 items-center justify-center rounded border-2 px-1.5 py-px text-[11px] font-medium leading-none disabled:opacity-50` + `border-emerald-600 bg-emerald-600 text-white` | `src/app/words/admin/AdminSection.tsx:249 (AdminTableRowComponent)` |
| Admin table add / edit | `inline-flex min-h-5 items-center justify-center rounded border-2 px-2 py-px text-[11px] font-medium leading-none disabled:opacity-50 border-sky-300 bg-sky-50 text-sky-800` | `src/app/words/admin/AdminSection.tsx:278 (AdminTableRowComponent)` |
| Admin table cancel / clear | `inline-flex min-h-5 items-center justify-center rounded border-2 px-2 py-px text-[11px] font-medium leading-none disabled:opacity-50 border-gray-400 bg-gray-100 text-gray-700` | `src/app/words/admin/AdminSection.tsx:316 (AdminTableRowComponent)` |
| All words row reset | `rounded border-2 border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900` | `src/app/words/all/AllWordsSection.tsx:1066 (AllWordsSection)` |
| All words / prompts / debug edit actions | `rounded border-2 border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-sky-800` | `src/app/words/prompts/PromptsSection.tsx:404 (SlotCard)` |
| Due table quick-review actions | `rounded border-2 border-green-500 bg-green-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-green-900 disabled:opacity-50` | `src/app/words/review/DueReviewSection.tsx:232 (DueReviewSection)` |
| Due table quick fill-test actions | `rounded border-2 border-amber-500 bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-amber-900 disabled:opacity-50` | `src/app/words/review/DueReviewSection.tsx:242 (DueReviewSection)` |
| Pagination controls | `rounded border px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200` | `src/app/words/all/AllWordsSection.tsx:970 (AllWordsSection)` |
| Compact viewer / navigation controls | `rounded border px-2 py-1 text-xs disabled:opacity-50` | `src/app/words/review/fill-test/FillTestReviewSection.tsx:252 (FillTestReviewSection)` |
| Sort headers | `inline-flex items-center gap-1` | `src/app/words/all/AllWordsSection.tsx:970 (AllWordsSection)` |
| Section expand / clear links | `text-sm text-blue-600 underline` and `text-xs text-blue-600 underline disabled:opacity-50` | `src/app/words/all/AllWordsSection.tsx:485 (AllWordsSection)` |
| Shop recipe details CTA | `mt-auto border-2 border-[#d8bc76] bg-[#fff6dc] px-4 py-2.5 text-sm font-semibold text-[#7b5b24] shadow-[0_8px_18px_rgba(168,127,43,0.12)] transition hover:bg-[#fff0c6]` | `src/app/words/shop/ShopSection.tsx:763 (ShopSection)` |

## Destructive Buttons

| Intent | Class string | Reference file |
| --- | --- | --- |
| Admin table delete | `inline-flex min-h-5 items-center justify-center rounded border-2 px-1.5 py-px text-[11px] font-medium leading-none disabled:opacity-50 border-rose-500 bg-rose-50 text-rose-700` | `src/app/words/admin/AdminSection.tsx:269 (AdminTableRowComponent)` |
| All words delete | `rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700` | `src/app/words/all/AllWordsSection.tsx:1075 (AllWordsSection)` |
| Review-test session delete | `rounded border-2 border-rose-500 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-rose-700 disabled:opacity-50` | `src/app/words/review/DueReviewSection.tsx:152 (DueReviewSection)` |
| Debug cleanup | `mt-3 rounded-md border-2 border-rose-500 bg-rose-50 px-4 py-2 font-medium text-rose-700 disabled:opacity-50` | `src/app/words/debug/DebugSection.tsx:449 (DebugSection)` |
| Fill-test / flashcard stop session | `rounded-md border-2 border-red-500 bg-red-50 px-3 py-2 text-red-800` | `src/app/words/review/fill-test/FillTestReviewSection.tsx:138 (FillTestReviewSection)` |
| Quiz exit leave button | `rounded-full border-2 border-red-600 bg-red-600 px-5 py-2.5 font-semibold text-white transition hover:bg-red-700` | `src/app/words/shared/WordsShell.tsx:234 (WordsShell)` |
| Shop admin delete / remove | `shop-admin-pill border border-[#e7b8b2] bg-[#fff3f1] px-4 py-2 text-sm font-semibold text-[#a04f46]` | `src/app/words/shop-admin/ShopAdminSection.tsx:937 (ShopAdminSection)` |
| Results clear history | `styles.clearHistoryButton` | `src/app/words/results/SessionHistoryTable.tsx:111 (SessionHistoryTable)` |
| Results dialog confirm delete | `styles.dialogButton + " " + styles.dialogButtonDelete` | `src/app/words/results/ClearHistoryDialog.tsx:32 (ClearHistoryDialog)` |

## Toggle States

| Intent | Class string | Reference file |
| --- | --- | --- |
| Admin fill-test include on / off | `row.includeInFillTest ? "inline-flex min-h-5 items-center justify-center rounded border-2 px-1.5 py-px text-[11px] font-medium leading-none disabled:opacity-50 border-teal-600 bg-teal-50 text-teal-700" : "inline-flex min-h-5 items-center justify-center rounded border-2 px-1.5 py-px text-[11px] font-medium leading-none disabled:opacity-50 border-gray-400 bg-gray-100 text-gray-700"` | `src/app/words/admin/AdminSection.tsx:479 (AdminTableRowComponent)` |
| Admin stats cards active / inactive | `isAdminStatsFilterActive(filter) ? "admin-stats-card flex min-h-[58px] w-full flex-col items-center justify-center border border-black bg-gray-100 px-2 py-1 text-center" : "admin-stats-card flex min-h-[58px] w-full flex-col items-center justify-center border px-2 py-1 text-center"` | `src/app/words/shared/words.shared.state.ts:912 and src/app/words/admin/AdminSection.tsx:1041` |
| Prompt tab active / inactive | `activeTab === type ? "rounded-md border-2 border-sky-400 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-800" : "rounded-md border px-3 py-1 text-sm font-medium hover:bg-gray-50"` | `src/app/words/prompts/PromptsSection.tsx:177 (PromptsSection)` |
| Prompt slot card (`role="button"`) editing / selected / active / default | `isEditing ? "rounded-lg border-2 border-sky-400 p-3" : isSelected ? "rounded-lg border-2 border-amber-400 bg-amber-50 p-3" : displayAsActive ? "rounded-lg border-2 border-[#7bc28f] bg-[#e8f6e8] p-3" : "rounded-lg border p-3"` | `src/app/words/prompts/PromptsSection.tsx:381 (SlotCard)` |
| Shop admin collapse toggle | `shop-admin-pill border border-[#d7c8a5] bg-white px-4 py-2 text-sm font-semibold text-[#6b6658] transition hover:border-[#c9ae63] hover:text-[#8b6f2f]` | `src/app/words/shop-admin/ShopAdminSection.tsx:46,717 (ShopAdminSection)` |
| Shop admin ingredient filter active / inactive | `isActive ? "shop-admin-pill border px-4 py-2 text-sm font-semibold transition border-[#d2b15b] bg-[#fff0bf] text-[#8b6f2f] shadow-[0_8px_20px_rgba(210,177,91,0.18)]" : "shop-admin-pill border px-4 py-2 text-sm font-semibold transition border-[#d7c8a5] bg-white text-[#6b6658]"` | `src/app/words/shop-admin/ShopAdminSection.tsx:777 (ShopAdminSection)` |
| Flashcard reveal / hide | `rounded-md border-2 border-blue-500 bg-blue-50 px-3 py-2 text-blue-800` | `src/app/words/review/flashcard/FlashcardReviewSection.tsx:80 (FlashcardReviewSection)` |
| Shell nav link active / inactive | `vm.activeMenuPage === item.page ? "rounded-md border-2 border-[#7bc28f] bg-[#e8f6e8] px-4 py-2 text-sm font-semibold text-[#2d4f3f]" : "rounded-md border px-4 py-2 text-sm font-medium"` | `src/app/words/shared/WordsShell.tsx:165 (WordsShell)` |
| Avatar picker selection active / inactive | `session.avatarId === id ? "rounded-lg border-2 p-1 transition hover:border-[#7bc28f] hover:bg-[#e8f6e8] border-[#7bc28f] bg-[#e8f6e8]" : "rounded-lg border-2 p-1 transition hover:border-[#7bc28f] hover:bg-[#e8f6e8] border-transparent"` | `src/app/words/shared/WordsShell.tsx:127 (WordsShell)` |

## Inputs

| Intent | Class string | Reference file |
| --- | --- | --- |
| Add page main text input | `w-full rounded-md border px-3 py-2` | `src/app/words/add/AddSection.tsx:205 (AddSection)` |
| Add page full-width select | `w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50` | `src/app/words/add/AddSection.tsx:230 (AddSection)` |
| Add page inline create-mode input | `flex-1 rounded-md border px-3 py-2 text-sm disabled:opacity-50` | `src/app/words/add/AddSection.tsx:254 (AddSection)` |
| Compact table / editor text input | `w-full rounded-md border px-2 py-1 text-sm` | `src/app/words/admin/AdminSection.tsx:295 (AdminTableRowComponent)` |
| Compact filter controls | `flex-shrink-0 rounded-md border px-2 py-1 text-sm` and `flex-grow rounded-md border px-2 py-1 text-sm` | `src/app/words/all/AllWordsSection.tsx:523 (AllWordsSection)` |
| Prompt editor textarea | `w-full rounded-md border px-2 py-1 text-sm font-mono` | `src/app/words/prompts/PromptsSection.tsx:306 (PromptsSection)` |
| Admin review-test session name input | `h-9 min-w-[12rem] rounded-md border border-indigo-300 px-3 py-1.5 text-xs` | `src/app/words/admin/AdminSection.tsx:1299 (AdminSection)` |
| Shop admin editable input / select / textarea | `mt-2 w-full rounded-xl border border-[#d8cfba] bg-white px-4 py-3 text-sm text-[#24423a] outline-none transition focus:border-[#c9ae63] focus:ring-1 focus:ring-[#e8d79b]` | `src/app/words/shop-admin/ShopAdminSection.tsx:44,1102 (ShopAdminSection)` |
| Shop admin readonly field shell | `mt-2 rounded-xl border border-[#e5dcc9] bg-[#f8f4ea] px-4 py-3 text-sm text-[#536859]` | `src/app/words/shop-admin/ShopAdminSection.tsx:46,1211 (ShopAdminSection)` |
| Native checkbox inputs with no class | `no className` | `src/app/words/all/AllWordsSection.tsx:509,1035; src/app/words/admin/AdminSection.tsx:218,1148; src/app/words/shop-admin/ShopAdminSection.tsx:1551` |

## Rules

- Use `src/app/words/admin/AdminSection.tsx` as the default reference implementation for new primary and secondary buttons. It is the most internally consistent button system in the workspace.
- Source user-facing labels, tooltips, placeholders, ARIA text, and notices from bilingual string objects. In the current audit, nearly all button text does this already.
- Do not assume a class string is the whole visual result. `src/app/globals.css` changes all `.kids-page button.bg-black` and bare `.kids-page button.border` buttons.
- If a feature needs a section-specific visual language, extend the existing local system instead of inventing a new one. Current local systems are `results/results.module.css`, the `shop-admin` gold pill set, and the `shop` card/button set.
- If a new button cannot reuse one of the patterns in this file, document the reason in the feature spec and update this reference in the same change.

## Known Inconsistencies

- No button was found that combines Tailwind classes with a JSX `style={{}}` prop. The closest nearby exception is `src/app/words/results/SessionHistoryTable.tsx:118`, which uses inline style on the table wrapper while the buttons in that section use CSS modules.
- `src/app/globals.css:130` means code that looks like a black button is not visually black. This affects `src/app/words/add/AddSection.tsx:262`, `src/app/words/add/AddSection.tsx:462`, and `src/app/words/review/fill-test/FillTestReviewSection.tsx:273`.
- `src/app/globals.css:143` means bare `border` buttons are visually gold workspace buttons, not neutral defaults. This affects pagination buttons, viewer close buttons, and several compact controls that only declare `border`.
- `src/app/words/results/SessionHistoryTable.tsx:111`, `src/app/words/results/EmptyState.tsx:23`, and `src/app/words/results/ClearHistoryDialog.tsx:25` use CSS-module button classes instead of the Tailwind systems used across the rest of `/words`.
- `src/app/words/shared/WordsShell.tsx:158` still contains a hardcoded English fallback: `vm.str.nav.logout ?? 'Logout'`.
- `src/app/words/shop-admin/ShopAdminSection.tsx` relies on many arbitrary Tailwind values and hex tokens such as `border-[#d2b15b]`, `bg-[#fff0bf]`, and `shadow-[0_8px_20px_rgba(210,177,91,0.18)]`. This is a separate local system from the dominant admin-table palette.
- `src/app/words/shop/ShopSection.tsx:658` uses a bespoke wallet/history button with arbitrary size and motion values: `h-[90px]`, `max-w-[200px]`, `rounded-[1.5rem]`, `hover:scale-[1.02]`, and `lg:w-[200px]`.
- `src/app/words/review/fill-test/FillTestReviewSection.tsx:177` uses a custom `quiz-phrase-pill` interaction style, and `src/app/words/review/fill-test/FillTestReviewSection.tsx:222` uses a bespoke sentence-slot button with `min-w-[10rem]`. These do not fit the primary/secondary action system.
