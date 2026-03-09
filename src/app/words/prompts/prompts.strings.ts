/**
 * AI Prompts Strings — Last updated: 2026-03-09
 * All user-facing text for the admin-configurable LLM prompts page.
 * Keep formatting OUT of strings (use JSX for styling).
 */
export const promptsStrings = {
  en: {
    // Section: Page Header
    pageTitle: "AI Prompts",
    pageDescription:
      "Manage AI prompt templates used for content generation. Changes affect all future generations for your family.",

    // Section: Tabs
    tabs: {
      full: "Full",
      phrase: "Phrase",
      example: "Example",
      phrase_details: "Phrase Details",
      meaning_details: "Meaning Details",
    },

    // Section: Slot Cards
    activeBadge: "ACTIVE",
    defaultReadOnlyNotice: "Read only for parents",
    slotCount: "of 5 used",
    addNewSlot: "+ Add New Slot",
    addNewSlotLimitTooltip: "Maximum of 5 custom slots reached",

    // Section: Card Actions
    makeActive: "Make Active",
    edit: "Edit",
    deleteSlot: "Delete",
    makeActiveTooltip: "Set this slot as the active prompt for this type",
    editTooltip: "Edit this prompt slot",
    deleteTooltip: "Delete this prompt slot",

    // Section: Edit Form
    editFormTitle: "Edit Slot",
    addFormTitle: "New Slot",
    nameLabel: "Name",
    namePlaceholder: "Slot name (max 50 characters)",
    bodyLabel: "Prompt Body",
    charCount: "characters",
    save: "Save",
    cancel: "Cancel",
    saveTooltip: "Save this prompt slot",
    cancelTooltip: "Discard changes",

    // Section: Validation
    nameRequired: "Name is required.",
    nameTooLong: "Name must be 50 characters or fewer.",
    bodyTooShort: "Prompt body is too short for this type.",
    bodyTooLong: "Prompt body exceeds the maximum length for this type.",

    // Section: Feedback Messages
    saveSuccess: "Slot saved.",
    saveError: "Failed to save. Please try again.",
    deleteSuccess: "Slot deleted.",
    deleteError: "Failed to delete. Please try again.",
    activateSuccess: "Slot activated.",
    activateError: "Failed to activate. Please try again.",
    loading: "Loading...",
    loadError: "Failed to load prompt slots. Please refresh.",
    viewerTitle: "Full Prompt",
    closeViewer: "Close",
    formatNote: "The JSON return format is hardcoded and will be appended automatically. Edit instructions and rules only.",
  },
  zh: {
    // Section: Page Header
    pageTitle: "AI提示词",
    pageDescription: "管理用于内容生成的AI提示词模板。更改将影响您家庭所有未来的内容生成。",

    // Section: Tabs
    tabs: {
      full: "完整",
      phrase: "词组",
      example: "例句",
      phrase_details: "词组详情",
      meaning_details: "释义详情",
    },

    // Section: Slot Cards
    activeBadge: "已激活",
    defaultReadOnlyNotice: "家长只读",
    slotCount: "已用 / 5",
    addNewSlot: "+ 添加新槽位",
    addNewSlotLimitTooltip: "已达到5个自定义槽位上限",

    // Section: Card Actions
    makeActive: "设为激活",
    edit: "编辑",
    deleteSlot: "删除",
    makeActiveTooltip: "将此槽位设为该类型的激活提示词",
    editTooltip: "编辑此提示词槽位",
    deleteTooltip: "删除此提示词槽位",

    // Section: Edit Form
    editFormTitle: "编辑槽位",
    addFormTitle: "新建槽位",
    nameLabel: "名称",
    namePlaceholder: "槽位名称（最多50个字符）",
    bodyLabel: "提示词内容",
    charCount: "个字符",
    save: "保存",
    cancel: "取消",
    saveTooltip: "保存此提示词槽位",
    cancelTooltip: "放弃更改",

    // Section: Validation
    nameRequired: "名称不能为空。",
    nameTooLong: "名称不得超过50个字符。",
    bodyTooShort: "该类型的提示词内容过短。",
    bodyTooLong: "该类型的提示词内容超过最大长度。",

    // Section: Feedback Messages
    saveSuccess: "槽位已保存。",
    saveError: "保存失败，请重试。",
    deleteSuccess: "槽位已删除。",
    deleteError: "删除失败，请重试。",
    activateSuccess: "槽位已激活。",
    activateError: "激活失败，请重试。",
    loading: "加载中...",
    loadError: "加载提示词槽位失败，请刷新。",
    viewerTitle: "完整提示词",
    closeViewer: "关闭",
    formatNote: "JSON返回格式已固定，将自动附加。请仅编辑指令与规则部分。",
  },
};
