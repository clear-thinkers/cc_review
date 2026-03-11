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
      sectionLabel: "Tag words by textbook/article to better organize them (optional)",
      expandButton: "Add tags",
      collapseButton: "Close",
      textbookPlaceholder: "Select a textbook…",
      gradePlaceholder: "Select or create grade…",
      unitPlaceholder: "Select or create unit…",
      lessonPlaceholder: "Select or create lesson…",
      createOption: "+ Create \"{value}\"",
      partialTagError: "Please complete all 4 levels or clear the tag.",
      loadingTextbooks: "Loading textbooks…",
      noTextbooks: "No textbooks yet.",
      creatingTextbook: "Creating…",
      createNewOption: "+ Create new textbook",
      createNewPlaceholder: "New textbook name…",
      createNewConfirm: "Create",
      createNewCancel: "Cancel",
      customValueOption: "+ Enter custom value",
    },

    // ─── Lessons column (All Characters / All Words table) ───────────────────
    column: {
      header: "Tags",
      noTags: "",
    },

    // ─── All Characters page batch tag editor ───────────────────────────────
    allEditor: {
      title: "Batch Tag Management",
      expandButton: "Batch Tag Management",
      collapseButton: "Close",
      selectedCount: "Selected: {count}",
      selectAllVisible: "Select all visible",
      clearSelection: "Clear selection",
      saveBatch: "Add tags",
      savingBatch: "Adding...",
      noSelection: "Select at least one word.",
      incompleteTagError: "Please complete Textbook, Grade, Unit, and Lesson.",
      saveSuccess: "Added tags for {count} words.",
      saveError: "Failed to add tags. Please try again.",
      clearTags: "Clear Tags",
      clearingTags: "Clearing...",
      clearTagsSuccess: "Cleared tags for {count} words.",
      clearTagsError: "Failed to clear tags. Please try again.",
      tooltips: {
        selectAllVisible: "Select all rows currently visible in the table.",
        saveBatch: "Add the selected tag to all selected words.",
        clearSelection: "Clear all currently selected rows.",
        clearTags: "Remove all lesson tags from all selected words.",
      },
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
      sectionLabel: "添加教材或者文章名字可以方便之后搜索。",
      expandButton: "添加标签",
      collapseButton: "收起",
      textbookPlaceholder: "选择教材…",
      gradePlaceholder: "选择或创建年级…",
      unitPlaceholder: "选择或创建单元…",
      lessonPlaceholder: "选择或创建课…",
      createOption: "+ 创建\"{value}\"",
      partialTagError: "请选择全部4级，或清除标签。",
      loadingTextbooks: "加载教材中…",
      noTextbooks: "暂无教材。",
      creatingTextbook: "创建中…",
      createNewOption: "+ 新建教材",
      createNewPlaceholder: "新教材名称…",
      createNewConfirm: "创建",
      createNewCancel: "取消",
      customValueOption: "+ 手动输入",
    },

    // ─── Lessons column ──────────────────────────────────────────────────────
    column: {
      header: "标签",
      noTags: "",
    },

    // ─── 全部汉字页面批量标签编辑 ─────────────────────────────────────────────
    allEditor: {
      title: "标签管理",
      expandButton: "标签管理",
      collapseButton: "收起",
      selectedCount: "已选择：{count}",
      selectAllVisible: "全选当前列表",
      clearSelection: "清除选择",
      saveBatch: "添加标签",
      savingBatch: "添加中...",
      noSelection: "请至少选择一个汉字。",
      incompleteTagError: "请完整填写教材、年级、单元和课。",
      saveSuccess: "已为 {count} 个汉字添加标签。",
      saveError: "添加标签失败，请重试。",
      clearTags: "清除标签",
      clearingTags: "清除中...",
      clearTagsSuccess: "已清除 {count} 个汉字的标签。",
      clearTagsError: "清除标签失败，请重试。",
      tooltips: {
        selectAllVisible: "选择当前表格中可见的所有行。",
        saveBatch: "将所选标签添加到所有已选择的汉字。",
        clearSelection: "清除当前所有已选择行。",
        clearTags: "移除所选汉字的所有标签。",
      },
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
