/**
 * Admin Queue Strings — Last updated: 2026-03-10
 * All user-facing text for the content queue page.
 */
export const adminQueueStrings = {
  en: {
    // Section: Page Header
    pageTitle: "Content Queue",
    pageDescription: "Words across all families — curate flashcard content and ship to family.",

    // Section: States
    loading: "Loading words…",
    noWords: "No words in queue.",

    // Section: Table
    tableCaption: "word in queue",
    tableCaptionPlural: "words in queue",
    colCharacter: "Character",
    colPinyin: "Pinyin",
    colFamily: "Family",
    colDateAdded: "Date Added",
    colStatus: "Status",
    colAction: "Action",
    noPinyin: "—",

    // Section: Status badges
    statusPending: "Pending",
    statusReady: "Ready",

    // Section: Actions
    curateButton: "Curate",
    shipButton: "Ship",
    shipping: "Shipping…",
    closeButton: "Close",

    // Section: Curation drawer
    curatingLabel: "Curating:",
    generateButton: "Generate with AI",
    generating: "Generating…",
    contentJsonLabel: "Content JSON (edit before saving)",
    contentJsonPlaceholder: "{\"character\":\"…\",\"pronunciation\":\"…\",\"meanings\":[…]}",
    saveButton: "Save & Mark Ready",
    saving: "Saving…",
    cancelButton: "Cancel",
    generateNotice: "Content generated. Review and save.",
  },
  zh: {
    // Section: Page Header
    pageTitle: "内容队列",
    pageDescription: "所有家庭的词语——管理闪卡内容并发布给家庭。",

    // Section: States
    loading: "加载中…",
    noWords: "队列中暂无词语。",

    // Section: Table
    tableCaption: "个词语",
    tableCaptionPlural: "个词语",
    colCharacter: "汉字",
    colPinyin: "拼音",
    colFamily: "家庭",
    colDateAdded: "添加日期",
    colStatus: "状态",
    colAction: "操作",
    noPinyin: "—",

    // Section: Status badges
    statusPending: "待处理",
    statusReady: "已就绪",

    // Section: Actions
    curateButton: "审核",
    shipButton: "发布",
    shipping: "发布中…",
    closeButton: "关闭",

    // Section: Curation drawer
    curatingLabel: "正在审核：",
    generateButton: "AI 生成",
    generating: "生成中…",
    contentJsonLabel: "内容 JSON（保存前可编辑）",
    contentJsonPlaceholder: "{\"character\":\"…\",\"pronunciation\":\"…\",\"meanings\":[…]}",
    saveButton: "保存并标记就绪",
    saving: "保存中…",
    cancelButton: "取消",
    generateNotice: "内容已生成。请检查后保存。",
  },
};
