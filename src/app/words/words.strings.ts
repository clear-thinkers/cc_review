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
      pageDescription:
        "Add Chinese characters only (single characters). Batch input is supported with commas, spaces, or line breaks.",
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
        flashcard: "Flashcard",
        fillTest: "Fill test",
      },
      sortButtons: {
        sort: "Sort",
      },
    },

    // ============= FLASHCARD REVIEW PAGE =============
    flashcard: {
      pageTitle: "Flashcard Review",
      progress: "Character {current} of {total}",
      stopButton: "Stop flashcards",
      noActiveSession: "Please start a flashcard review from the due-character actions above.",
      revealButton: "Reveal details",
      hideButton: "Hide details",
      revealPrompt: "Reveal details before grading this card.",
      loadingDict: "Loading dictionary details...",
      noDictData:
        "Could not load dictionary data for this card. You can still grade the review.",
      loadingContent: "Loading saved content...",
      noPronunciations: "(no pronunciation explanations)",
      noCharacterLoaded: "No flashcard character loaded.",
      noBrowserWarning: "Please use a modern browser to see flashcard details.",
      pronounciation: {
        prefix: "Reading",
        notAvailable: "(not available)",
        noSavedContent: "No saved content yet. Preload and save from Content Admin.",
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
        manualSelection: "Manual selection",
        custom: "{count} due characters",
      },
      selectedLabel: "Selected characters: ",
      startButton: "Start fill-test quiz",
      hideLastSummary: "Hide last summary",
      allCharactersSelection: "From fill-test due characters",
      manualTableHeaders: {
        test: "Test",
        hanzi: "Hanzi",
        dateAdded: "Date added",
        dateDue: "Date due",
        nextReviewDate: "Next Review Date",
        familiarity: "Familiarity",
      },
      gameplay: {
        characterProgress: "Character {current} / {total}",
        stopButton: "Stop quiz",
        noQuizCharacterLoaded: "No quiz character loaded.",
        unansweredBlanks: "Unanswered blanks:",
        sentenceLabel: "Sentence {current} / {total}",
        phraseBankHeader: "Phrase Bank",
        dragInstruction: "Drag to a blank, or tap phrase then tap blank.",
        dropPlaceholder: "Drop phrase here",
        clearButton: "Clear",
        submitButton: "Submit answer",
      },
      results: {
        scoreLabel: "Score: {correct}/3, scheduler tier: ",
        nextCharacterButton: "Next character",
        sentenceResult: "Sentence {index}: {result} (chosen: {chosen}, expected: {expected})",
        correct: "correct",
        incorrect: "incorrect",
        emptyChoice: "(empty)",
        finishButton: "Finish quiz",
      },
      summary: {
        title: "Last Fill-Test Summary",
        charactersReviewed: "Characters reviewed:",
        correctBlanks: "correct blanks: ",
      },
      completionMessage: "Fill-test quiz complete.",
    },

    // ============= CONTENT ADMIN PAGE =============
    admin: {
      pageTitle: "Content Admin",
      pageDescription:
        "Preload and manage meanings, phrases, and examples. Review page reads only saved content.",
      stats: {
        characters: "CHARACTERS",
        allTargets: "All Targets",
        withContent: "Targets with content",
        missingContent: "Targets missing content",
        readyForTesting: "Targets ready for testing",
        excludedForTesting: "Targets excluded for testing",
      },
      filterStateOn: " (ON)",
      filterTooltips: {
        characters: "Show all targets (character overview).",
        allTargets: "Show all targets (including with content).",
        withContent: "Filter table to targets with saved content.",
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
          character: "Character",
          pronunciation: "Pronunciation",
          meaningZh: "Meaning ZH",
          meaningEn: "Meaning EN",
          phrase: "Phrase",
          phrasePinyin: "Phrase Pinyin",
          example: "Example",
          examplePinyin: "Example Pinyin",
          includeInFillTest: "Include in Fill Test",
          actions: "Actions",
        },
        actionButtons: {
          regenerate: "R",
          save: "S",
          delete: "D",
          edit: "E",
          addMeaning: "+ Meaning",
          addPhrase: "+ Phrase",
          saveNew: "Save New",
          cancel: "Cancel",
          fillTestOn: "FT On",
          fillTestOff: "FT Off",
        },
        actionTooltips: {
          regenerate: "Regenerate all content",
          save: "Save",
          delete: "Delete saved content",
          addMeaning: "Add meaning for this character/pronunciation",
          addPhrase: "Add phrase under this meaning",
          saveNew: "Save and generate EN meaning + phrase pinyin",
          cancelAdd: "Cancel add",
          fillTestOn: "Exclude this row from fill-test generation",
          fillTestOff: "Include this row in fill-test generation",
          regeneratePhrase: "Regenerate phrase and example",
          deletePhrase: "Delete this phrase row",
          regenerateExample: "Regenerate example",
          editExample: "Edit example inline",
          deleteExample: "Delete this example row",
        },
        placeholders: {
          newMeaning: "Enter new meaning",
          newPhrase: "Enter phrase (must include \"{char}\")",
          matchingExample: "Enter matching example",
          editExample: "Edit example",
        },
        helper: {
          generatedOnSave: "Pinyin and example will be generated on save.",
        },
        emptyMessages: {
          noContent: "No content yet, add a meaning.",
          addMeaningFirst: "Add meaning first.",
          addMeaningAndPhraseFirst: "Add meaning and phrase first.",
        },
      },
      loading: "Loading admin targets...",
      noTargets: "No targets yet. Add characters first.",
      preloadingProgress: "Preloading {current}/{total}: {character} / {pronunciation}",
      preloadResult: "Preload finished. Generated {generated}, skipped {skipped}, failed {failed}.",
      messages: {
        saveMeaning: "Saved {character} / {pronunciation}.",
        deleteEmpty: "Deleted empty (no content).",
        deleteWithContent: "Deleted with content.",
        noContentForExclude: "Cannot exclude entry with no content.",
        upsertSuccess: "Content upserted.",
        upsertError: "Failed to upsert. Please try again.",
        regeneratePhrase: "Regenerating phrase...",
        regenerateExample: "Regenerating example...",
        saveError: "Could not save. Please try again.",
        deleteError: "Could not delete. Please try again.",
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
          reviewCount: "Review Count",
          testCount: "Test Count",
          familiarity: "Familiarity",
          nextReviewDate: "Next Review Date",
          actions: "Actions",
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
        flashcard: "闪卡",
        fillTest: "填空测试",
      },
      sortButtons: {
        sort: "排序",
      },
    },

    // ============= FLASHCARD REVIEW PAGE =============
    flashcard: {
      pageTitle: "闪卡复习",
      progress: "第 {current} 个，共 {total} 个",
      stopButton: "停止闪卡",
      noActiveSession: "请先从上方待复习区域开始闪卡复习。",
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
        notAvailable: "（暂无）",
        noSavedContent: "暂无已保存内容，请先在内容管理中预生成并保存。",
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
        manualSelection: "手动选择",
        custom: "{count} 个待测汉字",
      },
      selectedLabel: "计划测试数量:",
      startButton: "开始填空测试",
      hideLastSummary: "隐藏上次总结",
      allCharactersSelection: "从待测汉字中手动选择",
      manualTableHeaders: {
        test: "测试",
        hanzi: "汉字",
        dateAdded: "添加日期",
        dateDue: "应复习日期",
        nextReviewDate: "下次复习日期",
        familiarity: "熟悉度",
      },
      gameplay: {
        characterProgress: "汉字进度 {current} / {total}",
        stopButton: "停止测试",
        noQuizCharacterLoaded: "当前未加载测试汉字。",
        unansweredBlanks: "未填空白:",
        sentenceLabel: "例句 {current} / {total}",
        phraseBankHeader: "词组库",
        dragInstruction: "拖动到空白处，或点击短语然后点击空白处。",
        dropPlaceholder: "在这里放置短语",
        clearButton: "清空",
        submitButton: "提交答案",
      },
      results: {
        scoreLabel: "得分: {correct}/3, 调度等级: ",
        nextCharacterButton: "下一个汉字",
        sentenceResult: "例句 {index}: {result}（选择: {chosen}，正确: {expected}）",
        correct: "正确",
        incorrect: "错误",
        emptyChoice: "（空）",
        finishButton: "完成测试",
      },
      summary: {
        title: "上次填空总结",
        charactersReviewed: "已测试汉字:",
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
        allTargets: "全部条目",
        withContent: "有内容的条目",
        missingContent: "缺少内容的条目",
        readyForTesting: "可用于测试的条目",
        excludedForTesting: "不录入题库的条目",
      },
      filterStateOn: " (ON)",
      filterTooltips: {
        characters: "显示所有目标（按字符概览）。",
        allTargets: "显示所有目标（包括有内容的）。",
        withContent: "筛选表格以显示有保存内容的目标。",
        missingContent: "筛选表格以显示缺少内容的目标。",
        readyForTesting: "筛选表格以显示可用于测试的目标。",
        excludedForTesting: "筛选表格以显示已排除测试的目标。",
      },
      buttons: {
        preload: "预生成未保存内容",
        preloading: "预生成中...",
      },
      table: {
        headers: {
          character: "汉字",
          pronunciation: "读音",
          meaningZh: "释义（中文）",
          meaningEn: "释义（英文）",
          phrase: "词组",
          phrasePinyin: "词组拼音",
          example: "例句",
          examplePinyin: "例句拼音",
          includeInFillTest: "录入填空题",
          actions: "操作",
        },
        actionButtons: {
          regenerate: "重",
          save: "保",
          delete: "删",
          edit: "编",
          addMeaning: "+ 释义",
          addPhrase: "+ 词组",
          saveNew: "保存新项",
          cancel: "取消",
          fillTestOn: "测开",
          fillTestOff: "测关",
        },
        actionTooltips: {
          regenerate: "重新生成全部内容",
          save: "保存",
          delete: "删除已保存内容",
          addMeaning: "为该汉字/读音添加释义",
          addPhrase: "在该释义下添加词组",
          saveNew: "保存并生成英文释义和拼音",
          cancelAdd: "取消添加",
          fillTestOn: "从填空测试中排除此行",
          fillTestOff: "在填空测试中包含此行",
          regeneratePhrase: "重新生成词组和例句",
          deletePhrase: "删除该词组行",
          regenerateExample: "重新生成例句",
          editExample: "行内编辑例句",
          deleteExample: "删除该例句行",
        },
        placeholders: {
          newMeaning: "输入新释义",
          newPhrase: "输入词组（需包含“{char}”）",
          matchingExample: "输入匹配例句",
          editExample: "编辑例句",
        },
        helper: {
          generatedOnSave: "保存后将自动生成拼音和例句。",
        },
        emptyMessages: {
          noContent: "暂无内容，请添加释义。",
          addMeaningFirst: "请先添加释义。",
          addMeaningAndPhraseFirst: "请先添加释义和词组。",
        },
      },
      loading: "正在加载内容条目...",
      noTargets: "暂无可管理内容（请先添加汉字）",
      preloadingProgress: "预生成进度 {current}/{total}: {character} / {pronunciation}",
      preloadResult:
        "预生成完成。生成 {generated} 个，跳过 {skipped} 个，失败 {failed} 个。",
      messages: {
        saveMeaning: "已保存 {character} / {pronunciation}。",
        deleteEmpty: "已删除空条目（无内容）。",
        deleteWithContent: "已删除含内容条目。",
        noContentForExclude: "无法排除没有内容的条目。",
        upsertSuccess: "内容已更新。",
        upsertError: "更新失败。请重试。",
        regeneratePhrase: "重新生成词组中...",
        regenerateExample: "重新生成例句中...",
        saveError: "保存失败。请重试。",
        deleteError: "删除失败。请重试。",
      },
    },

    // ============= ALL CHARACTERS PAGE =============
    all: {
      pageTitle: "全部汉字",
      pageDescription: "显示所有汉字及其复习/测试计数和熟悉度。",
      stats: {
        totalCharacters: "总汉字数",
        timesReviewed: "已复习次数",
        timesTested: "已测试次数",
        avgFamiliarity: "平均熟悉度",
      },
      noCharacters: "暂无汉字。",
      table: {
        headers: {
          character: "汉字",
          dateAdded: "添加日期",
          reviewCount: "复习次数",
          testCount: "测试次数",
          familiarity: "熟悉度",
          nextReviewDate: "下次复习日期",
          actions: "操作",
        },
        buttons: {
          reset: "重置",
          delete: "删除",
        },
        tooltips: {
          reset: "重置为新字（添加日期为当前时间）",
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
