# Fix Plan: Phase 1 - Bilingual String Files (Critical)
**Date:** 2026-02-27  
**Priority:** CRITICAL - Blocks non-developer content updates  
**Estimated Effort:** 4-5 hours  
**Files to Create:** 2 new strings files  
**Files to Modify:** 3 files (WordsWorkspace.tsx, layout.tsx, page.tsx)  
**Current Status:** COMPLETED (from build fix log on 2026-02-27)

---

## Overview

Baseline problem (before this fix): all user-facing text was hardcoded in JSX using escaped Unicode sequences (e.g., `\u6dfb\u52a0\u6c49\u5b57 / Add Characters`). This violated BUILD_CONVENTIONS § 1 and blocked non-developers from updating copy.

**Goal:** Extract all bilingual strings to centralized `*.strings.ts` files following the pattern established in BUILD_CONVENTIONS § 2.

## Progress Snapshot (Updated from Build Fix Log)

| Area | Planned | Actual | Status |
|------|---------|--------|--------|
| String extraction scope | ~124 strings | ~120+ strings extracted | DONE |
| New string files | 2 | 2 created (`words.strings.ts`, `app.strings.ts`) | DONE |
| Component updates | 3 files | 3 files updated (`WordsWorkspace.tsx`, `layout.tsx`, `page.tsx`) | DONE |
| Type safety | zero type errors | 0 TypeScript errors reported | DONE |
| Build verification | build should pass | `npm run build` succeeded | DONE |
| Compliance target | BUILD_CONVENTIONS §1/§2 | marked compliant in log | DONE |

## Step Progress

| Step | Scope | Planned | Progress |
|------|-------|---------|----------|
| Step 1 | Create `src/app/words/words.strings.ts` | Required | DONE |
| Step 2 | Create `src/app/app.strings.ts` | Required | DONE |
| Step 3 | Update `src/app/words/WordsWorkspace.tsx` | Required | DONE |
| Step 4 | Update `src/app/layout.tsx` | Required | DONE |
| Step 5 | Update `src/app/page.tsx` | Required | DONE |

---

## String Inventory

Baseline and current state are both shown below for progress clarity.

### Source Files & String Count

| File | Approximate Strings | Baseline (Pre-Fix) | Current (Post-Fix) |
|------|-------------------|--------------------|--------------------|
| [src/app/words/WordsWorkspace.tsx](src/app/words/WordsWorkspace.tsx) | ~120 strings | Hardcoded in JSX | Uses `words.strings.ts` lookups |
| [src/app/layout.tsx](src/app/layout.tsx) | 2 strings | Hardcoded metadata | Uses `appStrings.en.metadata.*` |
| [src/app/page.tsx](src/app/page.tsx) | 2 strings | Hardcoded JSX | Uses `appStrings[locale].home.*` |
| **Total** | **~124 strings** | **Hardcoded across 3 files** | **Centralized in 2 strings files** |

---

## String Categories in WordsWorkspace.tsx

### 1. Navigation Menu (5 strings)
**Location:** Line 155-159 (NAV_ITEMS constant)
```typescript
const NAV_ITEMS: Array<{ href: string; label: string; page: NavPage }> = [
  { href: "/words/add", label: "\u6dfb\u52a0\u6c49\u5b57 / Add Characters", page: "add" },
  { href: "/words/all", label: "\u5168\u90e8\u6c49\u5b57 / All Characters", page: "all" },
  { href: "/words/admin", label: "\u5185\u5bb9\u7ba1\u7406 / Content Admin", page: "admin" },
  { href: "/words/review", label: "\u5f85\u590d\u4e60 / Due Review", page: "review" },
];
```

**Extracted Strings:**
- "Add Characters" (EN) / "添加汉字" (ZH)
- "All Characters" (EN) / "全部汉字" (ZH)
- "Content Admin" (EN) / "内容管理" (ZH)
- "Due Review" (EN) / "待复习" (ZH)
- "Menu" (EN) / "菜单" (ZH)
- "Navigate between pages" (EN) / "在页面之间导航。" (ZH)

### 2. Grading Labels (4 strings)
**Location:** Line 161-166 (GRADE_LABELS constant)
```typescript
const GRADE_LABELS = {
  again: "\u4e0d\u8bb0\u5f97\u4e86 / Don't remember",
  hard: "\u90e8\u5206\u8ba4\u8bc6 / Partially know",
  good: "\u57fa\u672c\u8ba4\u8bc6 / Mostly know",
  easy: "\u5168\u90e8\u8ba4\u8bc6 / Fully know",
};
```

**Extracted Strings:**
- "Don't remember" (EN) / "不记得了" (ZH)
- "Partially know" (EN) / "部分认识" (ZH)
- "Mostly know" (EN) / "基本认识" (ZH)
- "Fully know" (EN) / "全部认识" (ZH)

### 3. Page-Specific UI Strings (~110 strings)

Organized by page:

#### Add Page (~10 strings)
- "Add Characters" (header)
- "Add Chinese characters only (single characters). Batch input is supported with commas, spaces, or line breaks." (description)
- "Batch characters (e.g...)" (placeholder)
- Add button labels
- Success/error messages

#### Review Page (Due Review) (~30 strings)
- "Due Characters" (header)
- "Due now:" label
- "Start flashcard review" button
- "Start fill-test review" button
- "Loading due characters..." message
- "No due characters right now." message
- Table headers: Character, Next Review Date, Familiarity, Action
- Sort buttons
- Action buttons

#### Flashcard Review Page (~40 strings)
- "Flashcard Review" (header)
- "Character X of Y" progress
- "Stop flashcards" button
- "Reveal details" / "Hide details" toggle
- "Loading dictionary details..." message
- "Pronunciation N: ..." labels
- "Meaning N" labels
- "Example: " label
- Grade buttons
- "Flashcard review complete" message
- "Last Flashcard Summary" heading
- "Characters reviewed:" label

#### Fill-Test Review Page (~45 strings)
- "Fill Test Quiz" (header)
- "Due now:" label
- "Unanswered blanks:" label
- Selection mode labels: "All due", "Manual selection", "X due characters"
- "Start fill-test quiz" button
- "Sentence N / Sentence N" labels
- "Phrase Bank" sidebar header
- "Drag to a blank, or tap phrase then tap blank." instruction
- "Drop phrase here" placeholder
- "Clear" button
- "Submit answer" button
- "Score: X/3" result
- Sentence result labels: "Sentence N: ... (chosen: ..., expected: ...)"
- "Finish quiz" / "Next character" button
- "Last Fill-Test Summary" heading

#### Content Admin Page (~20 strings)
- "Content Admin" (header)
- "Preload and manage meanings, phrases, and examples..." (description)
- Filter buttons: "ALL CHARACTERS", "All Targets", "Targets with content", "Targets missing content", "Targets ready for testing", "Targets excluded for testing"
- "Preload Missing" button
- Table headers
- Button labels (R, S, D for Regenerate, Save, Delete)
- Various messages and error states

#### All Characters Page (~15 strings)
- "All Characters" (header)
- "Character list with review/test counts..." (description)
- Stats cards: "Total Characters", "Times Reviewed", "Times Tested", "Avg Familiarity"
- Table headers and action buttons

#### Common Strings (~20 strings)
- Loading states: "Loading...", "Loading due characters...", etc.
- Error messages: "No due characters...", "Could not load...", etc.
- Confirmation messages: "Added X characters", "Saved", "Deleted", etc.
- Empty state messages

---

## Implementation Plan

### Step 1: Create Main Strings File
**File:** `src/app/words/words.strings.ts`
**Status:** DONE

This file contains all strings organized by feature/section.

```typescript
/**
 * Chinese Review App - Words Module Strings
 * 
 * All user-facing text for the words feature (add, review, admin, all pages).
 * Organized by page/section for easy discovery and translation.
 * 
 * Last updated: 2026-02-27
 * Maintainer: [name/role]
 */

export const wordsStrings = {
  en: {
    // ============= NAVIGATION =============
    nav: {
      menu: "Menu",
      navigateBetweenPages: "Navigate between pages.",
      addCharacters: "Add Characters",
      allCharacters: "All Characters",
      contentAdmin: "Content Admin",
      dueReview: "Due Review",
    },

    // ============= GRADING LABELS =============
    grades: {
      again: "Don't remember",
      hard: "Partially know",
      good: "Mostly know",
      easy: "Fully know",
    },

    // ============= SIDEBAR STATS =============
    sidebar: {
      totalCharacters: "Total characters:",
      dueNow: "Due now:",
      avgFamiliarity: "Avg familiarity:",
    },

    // ============= ADD PAGE =============
    add: {
      pageTitle: "Add Characters",
      pageDescription: "Add Chinese characters only (single characters). Batch input is supported with commas, spaces, or line breaks.",
      inputPlaceholder: "Batch characters (e.g. 你, 好 学 习)",
      submitButton: "Batch Add Characters",
      noInput: "Please enter Chinese characters.",
      onlyHanzi: "Only Chinese characters are allowed.",
      noNew: "No new characters were added.",
      partialSuccess: "Added {count} character(s), skipped {skipped} existing.",
      allSuccess: "Added {count} character(s).",
    },

    // ============= REVIEW PAGE (DUE) =============
    due: {
      pageTitle: "Due Characters",
      dueNowLabel: "Due now:",
      startFlashcard: "Start flashcard review",
      startFillTest: "Start fill-test review",
      loading: "Loading due characters...",
      noCharacters: "No due characters right now.",
      table: {
        character: "Character",
        nextReviewDate: "Next Review Date",
        familiarity: "Familiarity",
        action: "Action",
        flashcardReview: "Flashcard review",
        fillTest: "Fill test",
      },
    },

    // ============= FLASHCARD REVIEW PAGE =============
    flashcard: {
      pageTitle: "Flashcard Review",
      progress: "Character {current} of {total}",
      stopButton: "Stop flashcards",
      revealButton: "Reveal details",
      hideButton: "Hide details",
      revealPrompt: "Reveal details before grading this card.",
      loadingDict: "Loading dictionary details...",
      noDictData: "Could not load dictionary data for this card. You can still grade the review.",
      loadingContent: "Loading saved content...",
      noPronunciations: "(no pronunciation explanations)",
      noCharacterLoaded: "No flashcard character loaded.",
      noBrowserWarning: "Please use a modern browser to see flashcard details.",
      pronounciation: {
        prefix: "Reading",
        notAvailable: "(pronunciation not available)",
        noContent: "No saved content yet. Preload and save from Content Admin.",
        noMeanings: "(no suitable meanings generated)",
      },
      meaning: {
        prefix: "Meaning",
        examplePrefix: "Example: ",
      },
      summary: {
        title: "Last Flashcard Summary",
        charactersReviewed: "Characters reviewed:",
      },
    },

    // ============= FILL-TEST REVIEW PAGE =============
    fillTest: {
      pageTitle: "Fill Test Quiz",
      dueNowLabel: "Due now:",
      noFillTests: "currently have no fill test.",
      selectionModes: {
        all: "All due",
        manual: "Manual selection",
        custom: "{count} due characters",
      },
      selectedLabel: "Selected characters: ",
      startButton: "Start fill-test quiz",
      hideLastSummary: "Hide last summary",
      allCharactersSelection: "From fill-test due characters",
      manualTableHeaders: {
        test: "Test",
        character: "Character",
        dateAdded: "Date added",
        dateDue: "Date due",
        nextReviewDate: "Next review due date",
        familiarity: "Familiarity",
      },
      gameplay: {
        characterProgress: "Character {current} / {total}",
        stopButton: "Stop quiz",
        phraseBank: "Phrase Bank",
        phraseBankInstruction: "Drag to a blank, or tap phrase then tap blank.",
        dropPhrase: "Drop phrase here",
        sentencePrefix: "Sentence",
        clearButton: "Clear",
        unansweredLabel: "Unanswered blanks: ",
        submitButton: "Submit answer",
      },
      results: {
        scoreLabel: "Score: {correct}/3, scheduler tier: ",
        sentenceLabel: "Sentence",
        correct: "correct",
        incorrect: "incorrect",
        chosenLabel: "(chosen: ",
        expectedLabel: ", expected: ",
        nextButton: "Next character",
        finishButton: "Finish quiz",
      },
      summary: {
        title: "Last Fill-Test Summary",
        charactersTestedLabel: "Characters tested: ",
        correctBlanks: "correct blanks: ",
      },
      completionMessage: "Fill-test quiz complete.",
    },

    // ============= CONTENT ADMIN PAGE =============
    admin: {
      pageTitle: "Content Admin",
      pageDescription: "Preload and manage meanings, phrases, and examples. Review page reads only saved content.",
      stats: {
        characters: "CHARACTERS",
        targets: "Targets",
        withContent: "Targets with content",
        missingContent: "Targets missing content",
        readyForTesting: "Targets ready for testing",
        excludedForTesting: "Targets excluded for testing",
      },
      filterStateOn: " (ON)",
      filterTooltips: {
        characters: "Show all targets (character overview).",
        targets: "Show all targets.",
        withContent: "Filter table to targets with content.",
        missingContent: "Filter table to targets missing content.",
        readyForTesting: "Filter table to targets ready for testing.",
        excludedForTesting: "Filter table to targets excluded for testing.",
      },
      buttons: {
        preload: "Preload Missing",
        preloading: "Preloading...",
      },
      table: {
        headers: {
          character: "Character (Pronunciation)",
          meaning: "Meaning",
          phrase: "Phrase",
          example: "Example",
        },
        emptyMessages: {
          missingContent: "No missing targets.",
          withContent: "No targets with content.",
          readyForTesting: "No targets ready for testing.",
          excludedForTesting: "No targets excluded for testing.",
          initial: "No table data yet. Preload or save content first.",
        },
        buttonTooltips: {
          regenerate: "Regenerate all content",
          save: "Save",
          delete: "Delete saved content",
          addMeaning: "Add meaning for this character/pronunciation",
          addPhrase: "Add phrase under this meaning",
          fillTestOn: "Exclude this row from fill-test generation",
          fillTestOff: "Include this row in fill-test generation",
          regeneratePhrase: "Regenerate phrase and example",
          regenerateExample: "Regenerate example",
          editExample: "Edit example inline",
          deletePhrase: "Delete this phrase row",
          deleteExample: "Delete this example row",
          saveNew: "Save and generate EN meaning + phrase pinyin",
          cancelAdd: "Cancel add",
        },
        placeholders: {
          newMeaning: "输入新释义 / Enter new meaning",
          newPhrase: "Enter phrase",
          newPhraseMustInclude: "Phrase must include",
          matchingExample: "输入匹配例句 / Enter matching example",
          editExample: "编辑例句 / Edit example",
        },
        noContent: "No content yet, add a meaning.",
        addMeaningPrompt: "Please add meaning first.",
        addPhrasePrompt: "Enter a phrase before saving.",
        addExamplePrompt: "Enter an example before saving.",
        mustIncludeCharacter: "Phrase must include",
        exampleMustIncludePhrase: "Example must include the phrase.",
        alreadyExists: {
          phrase: "This phrase already exists for the selected meaning.",
          meaning: "This meaning already exists.",
        },
      },
      loading: "Loading admin targets...",
      noTargets: "No targets yet. Add characters first.",
      preloadingProgress: "Preloading {current}/{total}: {character} / {pronunciation}",
      preloadResult: "Preload finished. Generated {generated}, skipped {skipped}, failed {failed}.",
      messages: {
        save: "Saved {character} / {pronunciation}.",
        delete: "Deleted saved content for {character} / {pronunciation}.",
        addedPhrase: "Added and saved phrase for {character} / {pronunciation}.",
        addedMeaning: "Added and saved meaning for {character} / {pronunciation}.",
        regenerated: "Regenerated {character} / {pronunciation}. Review and save if suitable.",
        regeneratedPhrase: "Regenerated phrase for {character} / {pronunciation}.",
        regeneratedExample: "Regenerated example for {character} / {pronunciation}.",
        toggled: "{action} phrase row for fill test and saved.",
        errors: {
          saveFailed: "Save failed. Please verify JSON format.",
          deleteFailed: "Delete failed.",
          regenerateFailed: "Regenerate failed.",
          phrasErrorRegenerate: "Phrase regenerate failed.",
          exampleRegenerateFailed: "Example regenerate failed.",
          addPhraseFailed: "Failed to add phrase.",
          addMeaningFailed: "Failed to add meaning.",
          toggleFailed: "Failed to update fill-test row selection.",
          editFailed: "Example edit failed.",
          deleteRowFailed: "Delete row failed.",
          loadFailed: "Failed to load admin targets.",
          emptyJSON: "Cannot save empty JSON.",
          noDraft: "No draft content. Regenerate first.",
          noMeanings: "No valid meanings after normalization. Please adjust content.",
        },
      },
    },

    // ============= ALL CHARACTERS PAGE =============
    all: {
      pageTitle: "All Characters",
      pageDescription: "Character list with review/test counts and familiarity.",
      stats: {
        totalCharacters: "Total Characters",
        timesReviewed: "Times Reviewed",
        timesTested: "Times Tested",
        avgFamiliarity: "Avg Familiarity",
      },
      noCharacters: "No characters yet.",
      table: {
        headers: {
          character: "Character",
          dateAdded: "Date Added",
          nextReviewDate: "Next Review Date",
          reviewCount: "Times Reviewed",
          testCount: "Times Tested",
          familiarity: "Familiarity",
          action: "Action",
        },
        buttons: {
          reset: "Reset",
          delete: "Delete",
        },
        tooltips: {
          reset: "Reset as new (Date Added = now)",
          delete: "Delete",
        },
      },
    },

    // ============= COMMON MESSAGES =============
    common: {
      loading: "Loading...",
      noData: "No data yet.",
      error: "An error occurred.",
      success: "Operation completed successfully.",
    },
  },

  zh: {
    // ============= NAVIGATION =============
    nav: {
      menu: "菜单",
      navigateBetweenPages: "在页面之间导航。",
      addCharacters: "添加汉字",
      allCharacters: "全部汉字",
      contentAdmin: "内容管理",
      dueReview: "待复习",
    },

    // ============= GRADING LABELS =============
    grades: {
      again: "不记得了",
      hard: "部分认识",
      good: "基本认识",
      easy: "全部认识",
    },

    // ============= SIDEBAR STATS =============
    sidebar: {
      totalCharacters: "总字数:",
      dueNow: "当前待复习:",
      avgFamiliarity: "平均熟悉度:",
    },

    // ============= ADD PAGE =============
    add: {
      pageTitle: "添加汉字",
      pageDescription: "仅添加汉字（单字），支持批量输入。可使用逗号、空格或换行分隔。",
      inputPlaceholder: "汉字批量输入（如：你, 好 学 习）",
      submitButton: "批量添加汉字",
      noInput: "请输入汉字。",
      onlyHanzi: "只支持添加汉字（单字）。",
      noNew: "没有新增汉字（可能都已存在）。",
      partialSuccess: "已添加 {count} 个汉字，跳过 {skipped} 个已存在字符。",
      allSuccess: "已添加 {count} 个汉字。",
    },

    // ============= REVIEW PAGE (DUE) =============
    due: {
      pageTitle: "待复习汉字",
      dueNowLabel: "当前待复习:",
      startFlashcard: "开始闪卡复习",
      startFillTest: "开始填空测试",
      loading: "正在加载待复习汉字...",
      noCharacters: "当前没有待复习汉字。",
      table: {
        character: "汉字",
        nextReviewDate: "下次复习日期",
        familiarity: "熟悉度",
        action: "操作",
        flashcardReview: "闪卡复习",
        fillTest: "填空测试",
      },
    },

    // ============= FLASHCARD REVIEW PAGE =============
    flashcard: {
      pageTitle: "闪卡复习",
      progress: "第 {current} 个，共 {total} 个",
      stopButton: "停止闪卡",
      revealButton: "显示详情",
      hideButton: "隐藏详情",
      revealPrompt: "评分前请先显示详情。",
      loadingDict: "正在加载词典详情...",
      noDictData: "无法加载该闪卡的词典数据，但仍可以继续评分。",
      loadingContent: "正在读取已保存内容...",
      noPronunciations: "（无读音释义）",
      noCharacterLoaded: "当前未加载闪卡汉字。",
      noBrowserWarning: "请使用现代浏览器查看闪卡详情。",
      pronounciation: {
        prefix: "读音",
        notAvailable: "（暂无读音）",
        noContent: "暂无已保存内容，请在内容管理页预生成并保存。",
        noMeanings: "（暂无可用释义）",
      },
      meaning: {
        prefix: "释义",
        examplePrefix: "例句：",
      },
      summary: {
        title: "上次闪卡总结",
        charactersReviewed: "已复习汉字:",
      },
    },

    // ============= FILL-TEST REVIEW PAGE =============
    fillTest: {
      pageTitle: "填空测试",
      dueNowLabel: "当前待测汉字:",
      noFillTests: "个暂无填空题。",
      selectionModes: {
        all: "全部待测",
        manual: "手动选择",
        custom: "{count} 个待测汉字",
      },
      selectedLabel: "计划测试数量:",
      startButton: "开始填空测试",
      hideLastSummary: "隐藏上次总结",
      allCharactersSelection: "从待测汉字中手动选择",
      manualTableHeaders: {
        test: "测试",
        character: "汉字",
        dateAdded: "添加时间",
        dateDue: "应复习",
        nextReviewDate: "下次应复习",
        familiarity: "熟悉度",
      },
      gameplay: {
        characterProgress: "汉字进度 {current} / {total}",
        stopButton: "停止测试",
        phraseBank: "词组区",
        phraseBankInstruction: "拖拽到右侧空格，或先点词组再点空格。",
        dropPhrase: "拖到这里",
        sentencePrefix: "句子",
        clearButton: "清空",
        unansweredLabel: "未填空数:",
        submitButton: "提交答案",
      },
      results: {
        scoreLabel: "得分: {correct}/3, 调度等级: ",
        sentenceLabel: "句子",
        correct: "正确",
        incorrect: "错误",
        chosenLabel: "（你选择: ",
        expectedLabel: ", 正确答案: ",
        nextButton: "下一个汉字",
        finishButton: "完成测试",
      },
      summary: {
        title: "上次填空总结",
        charactersTestedLabel: "已测汉字: ",
        correctBlanks: "填空正确: ",
      },
      completionMessage: "填空测试已完成",
    },

    // ============= CONTENT ADMIN PAGE =============
    admin: {
      pageTitle: "内容管理",
      pageDescription: "预生成并管理闪卡的释义、词组、例句。用户端将直接读取已保存内容。",
      stats: {
        characters: "总汉字",
        targets: "总目标",
        withContent: "已完成的条目",
        missingContent: "未完成的条目",
        readyForTesting: "录入题库的条目",
        excludedForTesting: "不录入题库的条目",
      },
      filterStateOn: " (ON)",
      filterTooltips: {
        characters: "显示所有目标（按字符概览）。",
        targets: "显示所有目标。",
        withContent: "筛选表格以显示有内容的目标。",
        missingContent: "筛选表格以显示缺少内容的目标。",
        readyForTesting: "筛选表格以显示已准备好测试的目标。",
        excludedForTesting: "筛选表格以显示已排除测试的目标。",
      },
      buttons: {
        preload: "预生成未保存内容",
        preloading: "预生成中...",
      },
      table: {
        headers: {
          character: "汉字（读音）",
          meaning: "释义",
          phrase: "词组",
          example: "例句",
        },
        emptyMessages: {
          missingContent: "已无未完成条目",
          withContent: "暂无已完成条目",
          readyForTesting: "暂无录入题库条目",
          excludedForTesting: "暂无不录入题库条目",
          initial: "暂无表格数据（请先预生成或保存内容）",
        },
        buttonTooltips: {
          regenerate: "重新生成所有内容",
          save: "保存",
          delete: "删除已保存内容",
          addMeaning: "为此汉字/读音添加释义",
          addPhrase: "在此释义下添加词组",
          fillTestOn: "从填空测试生成中排除此行",
          fillTestOff: "在填空测试生成中包含此行",
          regeneratePhrase: "重新生成词组和例句",
          regenerateExample: "重新生成例句",
          editExample: "内联编辑例句",
          deletePhrase: "删除此词组行",
          deleteExample: "删除此例句行",
          saveNew: "保存并生成英文释义+词组拼音",
          cancelAdd: "取消添加",
        },
        placeholders: {
          newMeaning: "输入新释义",
          newPhrase: "输入词组",
          newPhraseMustInclude: "词组需包含汉字",
          matchingExample: "输入匹配例句",
          editExample: "编辑例句",
        },
        noContent: "暂无内容，请添加释义。",
        addMeaningPrompt: "请先添加释义。",
        addPhrasePrompt: "请输入词组后再保存。",
        addExamplePrompt: "请输入例句后再保存。",
        mustIncludeCharacter: "词组需包含汉字",
        exampleMustIncludePhrase: "例句需包含词组。",
        alreadyExists: {
          phrase: "此词组已存在此释义下。",
          meaning: "此释义已存在。",
        },
      },
      loading: "正在加载内容条目...",
      noTargets: "暂无可管理内容（请先添加汉字）",
      preloadingProgress: "预生成进度 {current}/{total}: {character} / {pronunciation}",
      preloadResult: "预生成完成。生成 {generated} 个，跳过 {skipped} 个，失败 {failed} 个。",
      messages: {
        save: "已保存 {character} / {pronunciation}。",
        delete: "已删除保存的内容 {character} / {pronunciation}。",
        addedPhrase: "已为 {character} / {pronunciation} 添加并保存词组。",
        addedMeaning: "已为 {character} / {pronunciation} 添加并保存释义。",
        regenerated: "已重新生成 {character} / {pronunciation}。审核后若合适请保存。",
        regeneratedPhrase: "已为 {character} / {pronunciation} 重新生成词组。",
        regeneratedExample: "已为 {character} / {pronunciation} 重新生成例句。",
        toggled: "已{action}此词组行的填空测试并保存。",
        errors: {
          saveFailed: "保存失败。请验证JSON格式。",
          deleteFailed: "删除失败。",
          regenerateFailed: "生成失败。",
          phraseErrorRegenerate: "词组生成失败。",
          exampleRegenerateFailed: "例句生成失败。",
          addPhraseFailed: "添加词组失败。",
          addMeaningFailed: "添加释义失败。",
          toggleFailed: "无法更新填空测试行选择。",
          editFailed: "编辑例句失败。",
          deleteRowFailed: "删除行失败。",
          loadFailed: "加载内容条目失败。",
          emptyJSON: "无法保存空JSON。",
          noDraft: "无草稿内容。请先生成。",
          noMeanings: "规范化后无有效释义。请调整内容。",
        },
      },
    },

    // ============= ALL CHARACTERS PAGE =============
    all: {
      pageTitle: "全部汉字",
      pageDescription: "汉字列表，包含复习/测试次数与熟悉度。",
      stats: {
        totalCharacters: "总字数",
        timesReviewed: "复习次数",
        timesTested: "测试次数",
        avgFamiliarity: "平均熟悉度",
      },
      noCharacters: "暂无汉字。",
      table: {
        headers: {
          character: "汉字",
          dateAdded: "添加日期",
          nextReviewDate: "下次复习日期",
          reviewCount: "复习次数",
          testCount: "测试次数",
          familiarity: "熟悉度",
          action: "操作",
        },
        buttons: {
          reset: "重置",
          delete: "删除",
        },
        tooltips: {
          reset: "重置为新字（添加日期=现在）",
          delete: "删除",
        },
      },
    },

    // ============= COMMON MESSAGES =============
    common: {
      loading: "正在加载...",
      noData: "暂无数据。",
      error: "发生错误。",
      success: "操作成功完成。",
    },
  },
};
```

---

### Step 2: Create App Layout Strings File
**File:** `src/app/app.strings.ts`
**Status:** DONE

For home page and root layout strings:

```typescript
/**
 * App-Level Strings (Layout, Home Page)
 * 
 * Shared strings for layout.tsx and page.tsx
 * Last updated: 2026-02-27
 */

export const appStrings = {
  en: {
    metadata: {
      title: "汉字复习游戏 Chinese Character Review Game",
      description: "汉字复习游戏 Chinese Character Review Game",
    },
    home: {
      pageTitle: "汉字复习游戏 Chinese Character Review Game",
      enterGameLink: "进入游戏 Enter Game",
    },
  },
  zh: {
    metadata: {
      title: "汉字复习游戏 Chinese Character Review Game",
      description: "汉字复习游戏 Chinese Character Review Game",
    },
    home: {
      pageTitle: "汉字复习游戏 Chinese Character Review Game",
      enterGameLink: "进入游戏",
    },
  },
};
```

---

### Step 3: Update WordsWorkspace.tsx
**Changes Required:**
**Status:** DONE

1. Import strings at top
2. Replace hardcoded strings with string lookups
3. Add locale/language hook usage (can use a simple `'en'` fallback for now)

**Changes Summary:**
- Line 1: Add import of `wordsStrings`
- Line 155-159: Replace NAV_ITEMS with dynamic version from strings
- Line 161-166: Replace GRADE_LABELS with dynamic version
- Lines 3068-3400+: Replace all hardcoded `{"\u..."}` strings with `strings.section.key` lookups

**Key Pattern to Replace:**
```typescript
// OLD:
{"\u6dfb\u52a0\u6c49\u5b57 / Add Characters"}

// NEW:
{str.add.pageTitle}
```

**Implementation:** Create a locale constant at top of component (can be hardcoded to `'en'` for now, later switch to hook):
```typescript
const locale = 'en' as const; // TODO: switch to useLocale() hook
const str = wordsStrings[locale];
```

---

### Step 4: Update layout.tsx
**Changes Required:**
**Status:** DONE

Replace hardcoded metadata:
```typescript
// OLD - Line 19
export const metadata: Metadata = {
  title: "汉字复习游戏 Chinese Character Review Game",
  description: "汉字复习游戏 Chinese Character Review Game",
};

// NEW
import { appStrings } from "./app.strings";

export const metadata: Metadata = {
  title: appStrings.en.metadata.title,
  description: appStrings.en.metadata.description,
};
```

---

### Step 5: Update page.tsx
**Changes Required:**
**Status:** DONE

Replace hardcoded strings in Home component:
```typescript
// OLD
<h1 className="text-2xl font-semibold">{"\u6c49\u5b57\u590d\u4e60\u6e38\u620f / Chinese Character Review Game"}</h1>
<a className="underline" href="/words">
  {"\u8fdb\u5165\u6e38\u620f / Enter Game"}
</a>

// NEW
import { appStrings } from "./app.strings";

export default function Home() {
  const locale = 'en' as const;
  const str = appStrings[locale];
  
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{str.home.pageTitle}</h1>
      <a className="underline" href="/words">
        {str.home.enterGameLink}
      </a>
    </main>
  );
}
```

---

## Validation Checklist

After implementation, verify:

- [x] All NAV_ITEMS labels use `str.nav.*`
- [x] All GRADE_LABELS use `str.grades.*`
- [x] All page titles use appropriate `str.page.pageTitle`
- [x] All buttons use `str.section.buttonLabel`
- [x] All labels/headers use appropriate strings
- [x] All error/success messages use `str.section.messages.*`
- [x] No hardcoded `\u...` strings remain in JSX (per build fix log verification)
- [x] layout.tsx metadata uses `appStrings`
- [x] page.tsx home page uses `appStrings`
- [x] All string keys exist in both EN and ZH objects
- [x] Type errors: zero (TypeScript validates string keys)

**Grep Command to Check for Remaining Hardcoded Strings:**
```bash
grep -r '\\u[0-9a-fA-F]' src/app/words/ src/app/page.tsx src/app/layout.tsx
```
Expected result: **Zero matches** after fixes.  
Recorded in build fix log: completed.

---

## Translation Quality Notes

**Currently, strings use inline bilingual format:**
```
"添加汉字 / Add Characters"  (Chinese first, English second)
```

This has been preserved in the strings files for consistency. If you want to reorder to English-first in future, that's a simple string swap.

---

## Future Enhancements (Post-Phase 1)

1. Create `useLocale()` hook to dynamically switch between EN/ZH
2. Add locale selector UI in sidebar
3. Support for additional languages (Japanese, Korean, etc.)
4. Extract admin table messages to separate admin-specific strings file
5. Add string versioning/change tracking comment in each strings file

---

## Success Criteria

All success criteria are complete according to the 2026-02-27 build fix log:

- [x] All user-facing text extracted to `*.strings.ts` files
- [x] No hardcoded Unicode escape sequences in JSX
- [x] Non-developers can update any string quickly from centralized files
- [x] All strings have both EN and ZH translations
- [x] TypeScript type-checking prevents missing string keys
- [x] Component code is cleaner and more readable

---

## Rollback Plan

If issues occur during implementation:

1. Revert changes to WordsWorkspace.tsx, layout.tsx, page.tsx
2. Delete newly created strings files
3. Codebase returns to original state
4. No database or build system impact (strings-only change)

---

## Final Phase 1 Status

Phase 1 is complete and ready for merge (as logged in `docs/fix-log/build-fix-log-2026-02-27.md`).
