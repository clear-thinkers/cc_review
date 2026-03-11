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
      textbookPlaceholder: "Select a textbook…",
      createOption: "+ Create \"{value}\"",
      partialTagError: "Please select a textbook (and fill in any configured slots) or clear the tag.",
      loadingTextbooks: "Loading textbooks…",
      noTextbooks: "No textbooks yet.",
      creatingTextbook: "Creating…",
      createNewOption: "+ Create new textbook",
      createNewPlaceholder: "New textbook name…",
      createNewConfirm: "Create",
      createNewCancel: "Cancel",
    },

    // ─── Tags column (All Characters / All Words table) ────────────────────
    column: {
      header: "Tags",
      noTags: "",
    },

    // ─── Filter bar (All Characters + Content Admin) ─────────────────────────
    filter: {
      textbookLabel: "Textbook",
      slot1Label: "Slot 1",
      slot2Label: "Slot 2",
      slot3Label: "Slot 3",
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
      sectionLabel: "加标签（可选）",
      expandButton: "加标签",
      collapseButton: "清除标签",
      textbookPlaceholder: "选择教材…",
      createOption: "+ 创建\"{value}\"",
      partialTagError: "请选择教材（如有分层，请填写各层级），或清除标签。",
      loadingTextbooks: "加载教材中…",
      noTextbooks: "暂无教材。",
      creatingTextbook: "创建中…",
      createNewOption: "+ 新建教材",
      createNewPlaceholder: "新教材名称…",
      createNewConfirm: "创建",
      createNewCancel: "取消",
    },

    // ─── Tags column ─────────────────────────────────────────────────────────
    column: {
      header: "标签",
      noTags: "",
    },

    // ─── Filter bar ──────────────────────────────────────────────────────────
    filter: {
      textbookLabel: "教材",
      slot1Label: "第1层",
      slot2Label: "第2层",
      slot3Label: "第3层",
      allOption: "全部",
      clearFilters: "清除筛选",
      saveFilters: "保存筛选",
      filtersSaved: "筛选已保存。",
      emptyState: "没有字符匹配所选筛选条件。",
      clearFiltersLink: "清除筛选",
    },
  },
};
