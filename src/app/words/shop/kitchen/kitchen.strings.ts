/**
 * Shop Kitchen Strings — Last updated: 2026-08-23
 * All user-facing text for /words/shop/kitchen (feature spec 2026-08-23-kitchen-page.md).
 */
export const kitchenStrings = {
  en: {
    // Section: Page Header
    pageTitle: "Shop Kitchen",
    pageDescription:
      "Click the fridge to see what you've collected, open the recipe book to pick something to make, then click the stovetop or the oven to cook it.",
    loading: "Loading your kitchen…",
    loadError: "Could not load the kitchen. Please try again.",

    // Section: Fridge
    fridgeLabel: "Fridge",
    fridgeOpenAria: "Open the fridge to view your ingredients",
    fridgeModalTitle: "Your ingredients",
    fridgeModalDescription: "Everything you've collected so far from quiz rewards and purchases.",
    fridgeCloseButton: "Close",
    fridgeEmpty: "Nothing here yet — finish a paragraph quiz to earn ingredients!",
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
    missingIngredientsTemplate: "You need more {ingredients}. Check the fridge!",
    countertopFullMessage: "Your countertop is full! Click Organize to move everything to the shelf first.",
    cookSuccessTemplate: "{title} is done! Look at the countertop.",
    cookFailedGeneric: "Could not cook that right now. Please try again.",
    cooking: "Cooking…",

    // Section: Countertop
    countertopLabel: "Fresh from the Kitchen",
    countertopCountTemplate: "{count}/{capacity}",
    countertopEmpty: "No fresh dishes yet.",
    organizeButton: "Organize",
    organizeButtonAria: "Move everything on the countertop onto the shelf",
    organizeSuccessTemplate: "Moved {count} dishes to the shelf!",
    organizeNothingToMove: "Nothing to organize yet.",
    organizeFailedGeneric: "Could not organize the countertop. Please try again.",

    // Section: Shelf
    shelfLabel: "Shelf",
    shelfOpenAria: "Open the shelf to see your organized dishes",
    shelfModalTitle: "Your shelf",
    shelfModalDescription: "Every dish you've organized, sorted by type.",
    shelfCloseButton: "Close",
    shelfSummaryTemplate: "{count} dishes made",
    shelfSummarySingular: "1 dish made",
    tabDrinksLabel: "Drinks",
    tabHotMealLabel: "Hot Meal",
    tabDessertsLabel: "Desserts",
    shelfTabEmptyTemplate: "No {tab} yet.",

    // Section: Dish Enlarge (countertop and shelf tiles both use this)
    dishEnlargeAriaTemplate: "Enlarge {title}",
    dishEnlargeCloseButton: "Close",

    // Section: Special Ingredients
    specialModalTitleTemplate: "Add special ingredients to {title}?",
    specialModalDescription: "Tap any you'd like to add. Matching the right combination makes a special version — but any you pick get used either way.",
    specialModalEmpty: "You don't have enough of any special ingredient for this recipe yet.",
    specialSelectedBadge: "Added",
    specialDoneButton: "Done",
    specialAddPillLabel: "+ Add special ingredients",
    specialEditPillTemplate: "{count} special added — tap to edit",
  },
  zh: {
    // Section: Page Header
    pageTitle: "食谱厨房",
    pageDescription: "点冰箱查看你收集的食材,打开食谱书选一道菜,然后点炉灶或烤箱做出来。",
    loading: "正在加载你的厨房…",
    loadError: "无法加载厨房,请重试。",

    // Section: Fridge
    fridgeLabel: "冰箱",
    fridgeOpenAria: "打开冰箱查看你的食材",
    fridgeModalTitle: "你的食材",
    fridgeModalDescription: "这是你从答题奖励和购买中收集到的所有食材。",
    fridgeCloseButton: "关闭",
    fridgeEmpty: "这里还没有食材——完成一次段落测验来获得食材吧!",
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
    missingIngredientsTemplate: "你还需要更多{ingredients}。去冰箱看看吧!",
    countertopFullMessage: "台面满了!先点“整理”把菜都放到架子上吧。",
    cookSuccessTemplate: "{title}做好了!看看台面上。",
    cookFailedGeneric: "现在无法烹饪,请重试。",
    cooking: "烹饪中…",

    // Section: Countertop
    countertopLabel: "厨房新鲜出炉",
    countertopCountTemplate: "{count}/{capacity}",
    countertopEmpty: "还没有新鲜出炉的菜。",
    organizeButton: "整理",
    organizeButtonAria: "把台面上的菜都放到架子上",
    organizeSuccessTemplate: "已经把{count}道菜放到架子上了!",
    organizeNothingToMove: "还没有需要整理的菜。",
    organizeFailedGeneric: "无法整理台面,请重试。",

    // Section: Shelf
    shelfLabel: "架子",
    shelfOpenAria: "打开架子查看你整理好的菜",
    shelfModalTitle: "你的架子",
    shelfModalDescription: "你整理好的每一道菜,按类型分类。",
    shelfCloseButton: "关闭",
    shelfSummaryTemplate: "已经做了{count}道菜",
    shelfSummarySingular: "已经做了1道菜",
    tabDrinksLabel: "饮品",
    tabHotMealLabel: "热菜",
    tabDessertsLabel: "甜点",
    shelfTabEmptyTemplate: "还没有{tab}。",

    // Section: Dish Enlarge (countertop and shelf tiles both use this)
    dishEnlargeAriaTemplate: "放大{title}",
    dishEnlargeCloseButton: "关闭",

    // Section: Special Ingredients
    specialModalTitleTemplate: "要给{title}加特殊食材吗?",
    specialModalDescription: "点你想加的食材。凑对正确的组合会做出特别版本——但不管有没有凑对,选中的食材都会被用掉。",
    specialModalEmpty: "这道菜需要的特殊食材你现在还不够多。",
    specialSelectedBadge: "已添加",
    specialDoneButton: "完成",
    specialAddPillLabel: "+ 添加特殊食材",
    specialEditPillTemplate: "已添加{count}种特殊食材——点击编辑",
  },
};

export type KitchenLocaleStrings = typeof kitchenStrings.en;
