/**
 * Shop Kitchen Strings — Last updated: 2026-08-23
 * All user-facing text for /words/shop/kitchen (feature spec 2026-08-23-kitchen-page.md).
 */
export const kitchenStrings = {
  en: {
    // Section: Page Header
    pageTitle: "Shop Kitchen",
    pageDescription:
      "Open the cupboard to see everything you've collected, open the recipe book to pick something to make, then cook it on the stovetop or in the oven.",
    loading: "Loading your kitchen…",
    loadError: "Could not load the kitchen. Please try again.",

    // Section: Cupboard
    cupboardLabel: "Cupboard",
    cupboardOpenAria: "Open the cupboard to view your ingredients",
    cupboardModalTitle: "Your ingredients",
    cupboardModalDescription: "Everything you've collected so far from quiz rewards.",
    cupboardCloseButton: "Close",
    cupboardEmpty: "Nothing here yet — finish a paragraph quiz to earn ingredients!",
    ingredientCountSuffix: "kinds",

    // Section: Recipe Book
    bookLabel: "Recipe Book",
    bookOpenAria: "Open the recipe book to view all recipes",
    bookModalTitle: "All recipes",
    bookModalDescription: "Tap a recipe, then close the book and tap the stove or oven it belongs to.",
    bookCloseButton: "Close",
    bookEmpty: "No cookable recipes yet — check back soon!",
    readyToCook: "Ready to cook",
    missingIngredientsPrefix: "Missing:",
    recipeLocked: "Not unlocked yet",
    recipeLockedLinkText: "Unlock it on the Recipe Shop",
    recipesReadySuffix: "ready to cook",
    recipeSelectedPrefix: "Selected:",

    // Section: Appliances
    stovetopLabel: "Stovetop",
    ovenLabel: "Oven",
    stovetopAria: "Cook the selected recipe on the stovetop",
    ovenAria: "Bake the selected recipe in the oven",
    pickRecipeFirst: "Open the recipe book and pick a recipe first.",
    wrongApplianceTemplate: "{title} needs the {appliance}, not this one.",
    missingIngredientsTemplate: "You need more {ingredients}. Check the cupboard!",
    cookSuccessTemplate: "{title} is done! Look at your shelf.",
    cookFailedGeneric: "Could not cook that right now. Please try again.",
    cooking: "Cooking…",

    // Section: Shelves
    shelfSummaryTemplate: "{count} dishes made",
    shelfSummarySingular: "1 dish made",
    shelfDefaultLabel: "Fresh from the Kitchen",
    shelfDrinksLabel: "Drinks",
    shelfDessertsLabel: "Desserts",
    shelfHotMealLabel: "Hot Meals",
    shelfItemCountTemplate: "{count} items",
    shelfItemCountSingular: "1 item",
    shelfDefaultEmpty: "No dishes yet — open the recipe book to cook something!",
    shelfDrinksEmpty: "Drag a drink here to organize it.",
    shelfDessertsEmpty: "Drag a dessert here to organize it.",
    shelfHotMealEmpty: "Drag a hot meal here to organize it.",
    moveFailedGeneric: "Could not move that dish. Please try again.",
  },
  zh: {
    // Section: Page Header
    pageTitle: "食谱厨房",
    pageDescription: "打开橱柜查看你收集的一切,打开食谱书选一道菜,然后用炉灶或烤箱做出来。",
    loading: "正在加载你的厨房…",
    loadError: "无法加载厨房,请重试。",

    // Section: Cupboard
    cupboardLabel: "橱柜",
    cupboardOpenAria: "打开橱柜查看你的食材",
    cupboardModalTitle: "你的食材",
    cupboardModalDescription: "这是你从答题奖励中收集到的所有食材。",
    cupboardCloseButton: "关闭",
    cupboardEmpty: "这里还没有食材——完成一次段落测验来获得食材吧!",
    ingredientCountSuffix: "种",

    // Section: Recipe Book
    bookLabel: "食谱书",
    bookOpenAria: "打开食谱书查看所有食谱",
    bookModalTitle: "所有食谱",
    bookModalDescription: "点一个食谱,关闭书后点它所属的炉灶或烤箱。",
    bookCloseButton: "关闭",
    bookEmpty: "还没有可以烹饪的食谱——请稍后再来看看!",
    readyToCook: "可以烹饪",
    missingIngredientsPrefix: "缺少:",
    recipeLocked: "尚未解锁",
    recipeLockedLinkText: "去食谱商店解锁",
    recipesReadySuffix: "个食谱可以烹饪",
    recipeSelectedPrefix: "已选择:",

    // Section: Appliances
    stovetopLabel: "炉灶",
    ovenLabel: "烤箱",
    stovetopAria: "在炉灶上烹饪选中的食谱",
    ovenAria: "在烤箱里烘焙选中的食谱",
    pickRecipeFirst: "请先打开食谱书选一个食谱。",
    wrongApplianceTemplate: "{title}需要用{appliance},不是这个。",
    missingIngredientsTemplate: "你还需要更多{ingredients}。去橱柜看看吧!",
    cookSuccessTemplate: "{title}做好了!看看你的架子。",
    cookFailedGeneric: "现在无法烹饪,请重试。",
    cooking: "烹饪中…",

    // Section: Shelves
    shelfSummaryTemplate: "已经做了{count}道菜",
    shelfSummarySingular: "已经做了1道菜",
    shelfDefaultLabel: "厨房新鲜出炉",
    shelfDrinksLabel: "饮品",
    shelfDessertsLabel: "甜点",
    shelfHotMealLabel: "热菜",
    shelfItemCountTemplate: "{count}件",
    shelfItemCountSingular: "1件",
    shelfDefaultEmpty: "还没有菜——打开食谱书做点什么吧!",
    shelfDrinksEmpty: "把饮品拖到这里整理。",
    shelfDessertsEmpty: "把甜点拖到这里整理。",
    shelfHotMealEmpty: "把热菜拖到这里整理。",
    moveFailedGeneric: "无法移动这道菜,请重试。",
  },
};

export type KitchenLocaleStrings = typeof kitchenStrings.en;
