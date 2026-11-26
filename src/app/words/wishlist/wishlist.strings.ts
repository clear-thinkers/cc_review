/**
 * Wishlist Strings — Last updated: 2026-11-21
 * All user-facing text for the parent page /words/wishlist (roadmap item U, feature spec
 * 2026-11-21-cafe-visitors-character-tokens-wishlist.md).
 */
export const wishlistStrings = {
  en: {
    // Section: Page Header
    pageTitle: "Wishlist Rewards",
    pageDescription:
      "Set up real-world rewards your child can earn with the tokens they collect. When they redeem one, you both sign and you hand it over.",
    loading: "Loading rewards…",
    loadError: "Could not load rewards. Please try again.",

    // Section: Form
    addHeading: "Add a reward",
    editHeading: "Edit reward",
    titleLabel: "What's the reward?",
    titlePlaceholder: "e.g. New backpack",
    priceLabel: "Price in tokens",
    priceHelp: "Enter a number for one or more characters. Leave the rest blank.",
    tokenCountAriaTemplate: "How many {token} from {name}",
    childLabel: "Who is it for?",
    everyChild: "Any child",
    repeatLabel: "Can be redeemed more than once",
    photoLabel: "Photo of the real item (optional)",
    photoHelp: "Your child sees this photo on their Rewards page. Only your family can see it.",
    choosePhoto: "Choose a photo",
    replacePhoto: "Change photo",
    removePhoto: "Remove photo",
    photoAltTemplate: "Photo of {title}",
    photoReadError: "Couldn't read that photo. Please try a JPG or PNG.",
    photoUploadError: "Couldn't upload the photo. Please try again.",
    saveButton: "Save reward",
    saving: "Saving…",
    cancelButton: "Cancel",
    savedNotice: "Reward saved.",
    formErrors: {
      missing_title: "Please name the reward.",
      title_too_long: "Please keep the name to 60 characters or fewer.",
      missing_price: "Please set a price for at least one character.",
      invalid_price: "Prices must be whole numbers from 1 to 999.",
      duplicate_price: "Each character can appear only once in a price.",
    },
    saveErrors: {
      forbidden: "Only a parent can set up rewards.",
      invalid_title: "Please check the reward's name.",
      invalid_child: "That child isn't in your family.",
      invalid_price: "Please check the price.",
      invalid_image: "The photo couldn't be attached. Please choose it again.",
      unknown_reward: "This reward no longer exists.",
      unknown: "Could not save right now. Please try again.",
    },

    // Section: List
    listHeading: "Your rewards",
    empty: "No rewards yet. Add the first one above!",
    forEveryChild: "Any child",
    forChildTemplate: "For {name}",
    oneTime: "One time",
    repeatable: "Repeatable",
    hiddenBadge: "Hidden",
    editButton: "Edit",
    hideButton: "Hide",
    showButton: "Show",

    // Section: History
    historyHeading: "Redeemed",
    historyEmpty: "Nothing redeemed yet.",
    historyRowTemplate: "Signed by {child} and {parent}",
  },
  zh: {
    // Section: Page Header
    pageTitle: "心愿奖励",
    pageDescription: "设置孩子可以用收集到的信物兑换的真实奖励。孩子兑换时，你们一起签名，然后把奖励交给孩子。",
    loading: "正在加载奖励…",
    loadError: "无法加载奖励，请重试。",

    // Section: Form
    addHeading: "添加奖励",
    editHeading: "修改奖励",
    titleLabel: "奖励是什么？",
    titlePlaceholder: "例如：新书包",
    priceLabel: "需要多少信物",
    priceHelp: "给一个或多个角色填上数量，其余留空。",
    tokenCountAriaTemplate: "需要{name}的{token}数量",
    childLabel: "给谁的？",
    everyChild: "任何孩子",
    repeatLabel: "可以多次兑换",
    photoLabel: "实物照片（可选）",
    photoHelp: "孩子会在奖励页面看到这张照片。只有你们家能看到。",
    choosePhoto: "选择照片",
    replacePhoto: "换一张",
    removePhoto: "删除照片",
    photoAltTemplate: "{title}的照片",
    photoReadError: "读不了这张照片，请换一张 JPG 或 PNG。",
    photoUploadError: "照片上传失败，请重试。",
    saveButton: "保存奖励",
    saving: "保存中…",
    cancelButton: "取消",
    savedNotice: "奖励已保存。",
    formErrors: {
      missing_title: "请填写奖励名称。",
      title_too_long: "名称请不要超过 60 个字。",
      missing_price: "请至少给一个角色设置数量。",
      invalid_price: "数量必须是 1 到 999 的整数。",
      duplicate_price: "同一个角色只能出现一次。",
    },
    saveErrors: {
      forbidden: "只有家长可以设置奖励。",
      invalid_title: "请检查奖励名称。",
      invalid_child: "这个孩子不在你的家庭中。",
      invalid_price: "请检查数量。",
      invalid_image: "照片没能附上，请重新选择。",
      unknown_reward: "这个奖励已经不存在了。",
      unknown: "现在无法保存，请重试。",
    },

    // Section: List
    listHeading: "你的奖励",
    empty: "还没有奖励，在上面添加第一个吧！",
    forEveryChild: "任何孩子",
    forChildTemplate: "给{name}",
    oneTime: "一次性",
    repeatable: "可重复",
    hiddenBadge: "已隐藏",
    editButton: "修改",
    hideButton: "隐藏",
    showButton: "显示",

    // Section: History
    historyHeading: "已兑换",
    historyEmpty: "还没有兑换记录。",
    historyRowTemplate: "{child} 和 {parent} 已签名",
  },
};

export type WishlistLocaleStrings = typeof wishlistStrings.en;
