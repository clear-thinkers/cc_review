/**
 * Café Strings — Last updated: 2026-11-27 (register visitor board)
 * All user-facing text for /words/shop/cafe (roadmap item U, feature spec
 * 2026-11-21-cafe-visitors-character-tokens-wishlist.md). Characters' own lines come from
 * `shop_characters.lines_i18n`; these are the fallbacks and the page's own copy.
 */
export const cafeStrings = {
  en: {
    // Section: Page Header
    pageTitle: "Café",
    pageDescription:
      "Characters drop by to buy food from your shelf. Serve their whole order and they'll pay you with their own special tokens.",
    loading: "Opening the Café…",
    loadError: "Could not open the Café. Please try again.",
    sceneAlt: "A cozy café with a display case, a register counter, a green door and a little table.",

    // Section: Scene
    displayCaseLabel: "Your shelf",
    displayCaseAria: "Open your shelf to see the dishes you can serve",
    noVisitors: "No one's here yet. Check back soon!",
    noVisitorsToday: "Everyone has already dropped by. Come back another day!",

    // Section: Order
    orderHeadingTemplate: "{name}'s order",
    onShelfTemplate: "{have}/{need} on your shelf",
    payTemplate: "Pays {count} × {token}",
    serveButton: "Serve",
    serving: "Serving…",
    notNowButton: "Not now",
    notReadyHint: "You need every dish on your shelf. Cook what's missing, then Organize it in the kitchen. This visitor will wait!",
    unknownDish: "A dish no longer on the menu",
    pinnedPlainNote: "Plain, with nothing added",
    pinnedVariantNote: "Only this kind will do",

    // Section: Fallback lines
    fallbackOrderLine: "Hello! Could I have this, please?",
    fallbackServedLine: "Delicious! Thank you!",
    fallbackDismissedLine: "No problem, another time!",
    tapToContinue: "Tap to continue",
    talkAgainAriaTemplate: "Tap {name} to hear them again",

    // Section: Results
    paidTemplate: "{name} paid you {count} × {token}!",
    serveErrors: {
      not_on_shelf: "Some of those dishes aren't on your shelf anymore.",
      visit_closed: "This visitor has already left.",
      no_visit: "This visitor has already left.",
      forbidden: "Only a child profile can serve visitors.",
      unknown: "Could not serve right now. Please try again.",
    },
    dismissError: "Could not send the visitor off. Please try again.",

    // Section: Visitor board (the register screen)
    registerLabel: "Visitors",
    registerAria: "Open the register to see who visits and what they like",
    boardTitle: "Who visits the Café",
    boardIntro: "Everyone who might drop by, how often they come, and what they like to order.",
    boardLoading: "Loading the visitor list…",
    boardError: "Could not load the visitor list. Please try again.",
    boardEmpty: "No visitors are set up yet.",
    boardLikesHeading: "Likes to order",
    boardPaysTemplate: "→ pays {count} × {token}",
    frequencyTemplates: {
      unlimited: "Can drop by any time",
      daily: "Up to {n} visits a day",
      weekly: "Up to {n} visits a week",
      monthly: "Up to {n} visits a month",
      random_days: "Comes on {n} days each month",
    },
    plainDishTemplate: "{dish} (plain)",
    mysteryDish: "A mystery food",

    // Section: Shelf
    shelfTitle: "Your shelf",
    shelfEmpty: "Your shelf is empty. Cook something and Organize it in the kitchen!",
    shelfCountTemplate: "× {count}",
    shelfExtrasTemplate: "with {names}",
    namesSeparator: ", ",
    closeButton: "Close",
  },
  zh: {
    // Section: Page Header
    pageTitle: "小餐馆",
    pageDescription: "客人们会来买你货架上的美食。把整份订单端给他们，他们就会用自己特别的信物付给你。",
    loading: "小餐馆开门中…",
    loadError: "无法打开小餐馆，请重试。",
    sceneAlt: "一间温馨的小餐馆，有展示柜、收银台、绿色的门和一张小桌子。",

    // Section: Scene
    displayCaseLabel: "我的货架",
    displayCaseAria: "打开货架，看看可以端出哪些菜",
    noVisitors: "现在还没有客人，过一会儿再来看看吧！",
    noVisitorsToday: "客人们都来过啦，改天再来看看吧！",

    // Section: Order
    orderHeadingTemplate: "{name}的订单",
    onShelfTemplate: "货架上有 {have}/{need}",
    payTemplate: "付给你 {count} 个{token}",
    serveButton: "上菜",
    serving: "上菜中…",
    notNowButton: "下次吧",
    notReadyHint: "每道菜都要在货架上才能上菜。去厨房做好缺的菜，再整理到货架上。这位客人会等你哦！",
    unknownDish: "一道已经下架的菜",
    pinnedPlainNote: "要原味的，什么都不加",
    pinnedVariantNote: "只要这一种哦",

    // Section: Fallback lines
    fallbackOrderLine: "你好！我想要这些，可以吗？",
    fallbackServedLine: "真好吃！谢谢你！",
    fallbackDismissedLine: "没关系，下次再来！",
    tapToContinue: "点一下继续",
    talkAgainAriaTemplate: "点一下{name}，再听一遍",

    // Section: Results
    paidTemplate: "{name}付给你 {count} 个{token}！",
    serveErrors: {
      not_on_shelf: "有些菜已经不在货架上了。",
      visit_closed: "这位客人已经走啦。",
      no_visit: "这位客人已经走啦。",
      forbidden: "只有孩子的账号可以招待客人。",
      unknown: "现在无法上菜，请重试。",
    },
    dismissError: "现在无法送走客人，请重试。",

    // Section: Visitor board (the register screen)
    registerLabel: "客人名单",
    registerAria: "打开收银台，看看有哪些客人、他们喜欢点什么",
    boardTitle: "小餐馆的客人们",
    boardIntro: "可能来的客人都在这里：他们多久来一次，喜欢点什么。",
    boardLoading: "正在打开客人名单…",
    boardError: "无法打开客人名单，请重试。",
    boardEmpty: "还没有客人哦。",
    boardLikesHeading: "喜欢点",
    boardPaysTemplate: "→ 付 {count} 个{token}",
    frequencyTemplates: {
      unlimited: "随时都可能来",
      daily: "每天最多来 {n} 次",
      weekly: "每周最多来 {n} 次",
      monthly: "每月最多来 {n} 次",
      random_days: "每月有 {n} 天会来",
    },
    plainDishTemplate: "{dish}（原味）",
    mysteryDish: "神秘美食",

    // Section: Shelf
    shelfTitle: "我的货架",
    shelfEmpty: "货架是空的。去厨房做点好吃的，再整理到货架上吧！",
    shelfCountTemplate: "× {count}",
    shelfExtrasTemplate: "加了{names}",
    namesSeparator: "、",
    closeButton: "关闭",
  },
};

export type CafeLocaleStrings = typeof cafeStrings.en;
