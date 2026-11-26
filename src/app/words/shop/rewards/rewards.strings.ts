/**
 * Rewards Strings — Last updated: 2026-11-21
 * All user-facing text for /words/shop/rewards (roadmap item T, feature spec
 * 2026-10-28-chef-challenge-paw-prints.md, section B). Reward titles/descriptions are
 * keyed by `paw_print_rewards.reward_key`; giver names by `PawPrintGiver`.
 */
export const rewardsStrings = {
  en: {
    // Section: Page Header
    pageTitle: "Rewards",
    pageDescription:
      "Collect paw prints from Chef Shrewy and tokens from your Café visitors, then spend them on special rewards.",
    loading: "Loading your rewards…",
    loadError: "Could not load your rewards. Please try again.",

    // Section: Collection
    collectionHeading: "Chef Shrewy's paw prints",
    collectedLabel: "Collected",
    availableLabel: "Available",
    emptySheet: "No paw prints yet! Cook a recipe with Shrewy's challenge to earn one.",
    stampAriaTemplate: "Paw print earned {date}",
    usedBadge: "Redeemed",

    // Section: Stamp Details
    stampDetailTitle: "Paw print",
    stampEarnedLabel: "Earned",
    stampRecipeLabel: "Recipe",
    stampFromLabel: "From",
    stampUnknownRecipe: "A recipe no longer on the menu",
    stampStatusUsed: "Spent on a reward",
    stampStatusAvailable: "Ready to spend",
    closeButton: "Close",

    // Section: Givers
    giverNames: { shrewy: "Chef Shrewy" },

    // Section: Character Tokens (Café, roadmap item U)
    sheetHeadingTemplate: "{name}'s {token} collection",
    tokenAriaTemplate: "{token} earned {date}",
    tokenDetailTitle: "Token",
    tokenOrderLabel: "Café order",
    stackAriaTemplate: "{label}: {count}. Tap to see each one.",
    stackCountTemplate: "×{count}",

    // Section: Wishlist
    wishlistHeading: "Wishlist rewards",
    wishlistDescription: "Real rewards a grown-up has picked for you. Redeem one together!",
    wishlistEmpty: "No wishlist rewards yet. Ask a grown-up to add one!",
    wishlistPhotoAltTemplate: "Photo of {title}",
    wishlistRedeemedBadge: "Redeemed",
    wishlistNeedTemplate: "Need {count} more {token}",
    wishlistConfirmTitle: "Redeem together",
    wishlistConfirmBodyTemplate: "Spend {price} on {title}? A grown-up should be here to sign and hand it over.",
    childSignatureLabel: "Child's signature",
    parentSignatureLabel: "Parent's signature",
    signaturePlaceholder: "Type your name",
    wishlistSignButton: "Sign and redeem",
    wishlistSuccessTemplate: "Redeemed: {title}! Enjoy!",
    wishlistErrors: {
      invalid_child_signature: "Please add the child's signature.",
      invalid_parent_signature: "Please add the parent's signature.",
      same_signature: "The child and the parent each need to sign their own name.",
      unknown_reward: "This reward isn't available right now.",
      already_redeemed: "You've already redeemed this one.",
      insufficient_tokens: "Not enough tokens yet.",
      forbidden: "Only a child profile can redeem rewards.",
      unknown: "Could not redeem right now. Please try again.",
    },

    // Section: Rewards
    rewardsHeading: "Shrewy's rewards",
    costTemplate: "{cost} paw prints",
    redeemButton: "Redeem",
    needMoreTemplate: "Need {count} more",
    unlockedBadge: "Unlocked",
    confirmTitle: "Redeem this reward?",
    confirmBodyTemplate: "Spend {cost} paw prints on {title}? Once unlocked, it's yours for good.",
    confirmButton: "Redeem",
    cancelButton: "Cancel",
    redeeming: "Redeeming…",
    redeemSuccessTemplate: "Unlocked: {title}!",
    redeemErrors: {
      insufficient_paw_prints: "Not enough paw prints yet.",
      already_redeemed: "You've already unlocked this one.",
      unknown_reward: "This reward isn't available right now.",
      forbidden: "Only a child profile can redeem rewards.",
      unknown: "Could not redeem right now. Please try again.",
    },
    catalog: {
      "shrewy-hand-wash": {
        title: "Shrewy washes his hands",
        description:
          "A clean chef is a good chef! Shrewy washes his paws at the sink every time you choose a recipe.",
      },
    },
  },
  zh: {
    // Section: Page Header
    pageTitle: "奖励",
    pageDescription: "收集鼩仔的爪印和小餐馆客人的信物，再用它们兑换特别奖励。",
    loading: "正在加载你的奖励…",
    loadError: "无法加载奖励，请重试。",

    // Section: Collection
    collectionHeading: "鼩仔的爪印",
    collectedLabel: "已收集",
    availableLabel: "可使用",
    emptySheet: "还没有爪印哦！做一道有鼩仔挑战的菜来赢取吧。",
    stampAriaTemplate: "{date}获得的爪印",
    usedBadge: "已兑换",

    // Section: Stamp Details
    stampDetailTitle: "爪印",
    stampEarnedLabel: "获得时间",
    stampRecipeLabel: "菜谱",
    stampFromLabel: "来自",
    stampUnknownRecipe: "一道已经下架的菜",
    stampStatusUsed: "已用于兑换奖励",
    stampStatusAvailable: "可以使用",
    closeButton: "关闭",

    // Section: Givers
    giverNames: { shrewy: "鼩仔大厨" },

    // Section: Character Tokens (Café, roadmap item U)
    sheetHeadingTemplate: "{name}的{token}",
    tokenAriaTemplate: "{date}获得的{token}",
    tokenDetailTitle: "信物",
    tokenOrderLabel: "小餐馆订单",
    stackAriaTemplate: "{label}：{count} 个，点一下查看每一个",
    stackCountTemplate: "×{count}",

    // Section: Wishlist
    wishlistHeading: "心愿奖励",
    wishlistDescription: "大人为你挑选的真实奖励，一起来兑换吧！",
    wishlistEmpty: "还没有心愿奖励，请大人添加一个吧！",
    wishlistPhotoAltTemplate: "{title}的照片",
    wishlistRedeemedBadge: "已兑换",
    wishlistNeedTemplate: "还差 {count} 个{token}",
    wishlistConfirmTitle: "一起兑换",
    wishlistConfirmBodyTemplate: "用 {price} 兑换「{title}」？请大人在旁边签名并把奖励交给你。",
    childSignatureLabel: "孩子签名",
    parentSignatureLabel: "家长签名",
    signaturePlaceholder: "写下你的名字",
    wishlistSignButton: "签名并兑换",
    wishlistSuccessTemplate: "兑换成功：{title}！",
    wishlistErrors: {
      invalid_child_signature: "请填写孩子的签名。",
      invalid_parent_signature: "请填写家长的签名。",
      same_signature: "孩子和家长要各自签自己的名字。",
      unknown_reward: "这个奖励现在不能兑换。",
      already_redeemed: "这个奖励你已经兑换过了。",
      insufficient_tokens: "信物还不够哦。",
      forbidden: "只有孩子的账号可以兑换奖励。",
      unknown: "现在无法兑换，请重试。",
    },

    // Section: Rewards
    rewardsHeading: "鼩仔的奖励",
    costTemplate: "{cost}个爪印",
    redeemButton: "兑换",
    needMoreTemplate: "还差{count}个",
    unlockedBadge: "已解锁",
    confirmTitle: "要兑换这个奖励吗？",
    confirmBodyTemplate: "用{cost}个爪印兑换「{title}」？解锁后就永远是你的啦。",
    confirmButton: "兑换",
    cancelButton: "取消",
    redeeming: "兑换中…",
    redeemSuccessTemplate: "已解锁：{title}！",
    redeemErrors: {
      insufficient_paw_prints: "爪印还不够哦。",
      already_redeemed: "这个奖励你已经解锁啦。",
      unknown_reward: "这个奖励现在不能兑换。",
      forbidden: "只有孩子的账号可以兑换奖励。",
      unknown: "现在无法兑换，请重试。",
    },
    catalog: {
      "shrewy-hand-wash": {
        title: "鼩仔洗手",
        description: "干干净净才是好厨师！每次你选好菜谱，鼩仔都会先去水槽洗洗爪子。",
      },
    },
  },
};

export type RewardsLocaleStrings = typeof rewardsStrings.en;
