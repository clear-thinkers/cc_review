/**
 * Café Strings — Last updated: 2026-11-21
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

    // Section: Shelf
    shelfTitle: "Your shelf",
    shelfEmpty: "Your shelf is empty. Cook something and Organize it in the kitchen!",
    shelfCountTemplate: "× {count}",
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

    // Section: Shelf
    shelfTitle: "我的货架",
    shelfEmpty: "货架是空的。去厨房做点好吃的，再整理到货架上吧！",
    shelfCountTemplate: "× {count}",
    closeButton: "关闭",
  },
};

export type CafeLocaleStrings = typeof cafeStrings.en;
