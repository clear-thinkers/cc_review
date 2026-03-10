/**
 * Tagging Feature Strings
 *
 * Bilingual (EN / ZH) user-facing strings for the character level tagging feature.
 * Used in AddSection cascade dropdowns, Lessons column, and filter bars.
 */

export const taggingStrings = {
  en: {
    // ─── Add Page — cascade tag section ─────────────────────────────────────
    add: {
      sectionLabel: "Assign to Lesson (optional)",
      expandButton: "Assign to Lesson",
      collapseButton: "Clear tag",
      textbookPlaceholder: "Select or create textbook…",
      gradePlaceholder: "Select or create grade…",
      unitPlaceholder: "Select or create unit…",
      lessonPlaceholder: "Select or create lesson…",
      createOption: "+ Create \"{value}\"",
      partialTagError: "Please complete all 4 levels or clear the tag.",
      loadingTextbooks: "Loading textbooks…",
      noTextbooks: "No textbooks found. Type to create one.",
      creatingTextbook: "Creating textbook…",
      willCreateTextbook: "New textbook — will be created on save.",
    },

    // ─── Lessons column (All Characters / All Words table) ───────────────────
    column: {
      header: "Lessons",
      noTags: "",
    },

    // ─── Filter bar (All Characters + Content Admin) ─────────────────────────
    filter: {
      textbookLabel: "Textbook",
      gradeLabel: "Grade",
      unitLabel: "Unit",
      lessonLabel: "Lesson",
      allOption: "All",
      clearFilters: "Clear Filters",
      saveFilters: "Save Filters",
      filtersSaved: "Filters saved.",
      emptyState: "No characters match the selected filters.",
      clearFiltersLink: "Clear Filters",
    },
  },

  zh: {
    // ─── Add Page — cascade tag section ─────────────────────────────────────
    add: {
      sectionLabel: "分配到课程（可选）",
      expandButton: "分配到课程",
      collapseButton: "清除标签",
      textbookPlaceholder: "选择或创建教材…",
      gradePlaceholder: "选择或创建年级…",
      unitPlaceholder: "选择或创建单元…",
      lessonPlaceholder: "选择或创建课…",
      createOption: "+ 创建\"{value}\"",
      partialTagError: "请选择全部4级，或清除标签。",
      loadingTextbooks: "加载教材中…",
      noTextbooks: "未找到教材，输入名称创建。",
      creatingTextbook: "正在创建教材…",
      willCreateTextbook: "新教材 — 失去焦点时将创建。",
    },

    // ─── Lessons column ──────────────────────────────────────────────────────
    column: {
      header: "课程",
      noTags: "",
    },

    // ─── Filter bar ──────────────────────────────────────────────────────────
    filter: {
      textbookLabel: "教材",
      gradeLabel: "年级",
      unitLabel: "单元",
      lessonLabel: "课",
      allOption: "全部",
      clearFilters: "清除筛选",
      saveFilters: "保存筛选",
      filtersSaved: "筛选已保存。",
      emptyState: "没有字符匹配所选筛选条件。",
      clearFiltersLink: "清除筛选",
    },
  },
};
