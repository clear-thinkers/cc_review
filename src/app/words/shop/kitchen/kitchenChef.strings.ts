import type { KitchenChefLocaleStrings } from "./kitchenChef.types";

/**
 * Kitchen Chef Strings — Last updated: 2026-10-28
 * Chef Shrewy's lines (roadmap item O, docs/feature-specs/2026-10-24-kitchen-chef-dialogue.md).
 * No generic line names a food, an ingredient, or coins. Recipe-specific lines
 * override the generic set per trigger. Shelf-aware lines (`shelf`) may name food
 * types and dishes (owner-approved 2026-10-26). Challenge lines (`challenge`, roadmap
 * item T, 2026-10-28) are spec decision 6 of 2026-10-28-chef-challenge-paw-prints.md.
 */
export const kitchenChefStrings: { en: KitchenChefLocaleStrings; zh: KitchenChefLocaleStrings } = {
  en: {
    chefName: "Chef Shrewy",
    tapAria: "Chat with Chef Shrewy",
    hideLabel: "Hide chef",
    showLabel: "Show chef",
    generic: {
      unlock: ["Wow! A brand-new dish just unlocked!"],
      start: ["Okay, let's cook! Stay focused!", "Careful with the heat. Here we go!", "I've got the spatula ready!"],
      success: ["Ta-da! That looks delicious!", "Perfect! You're a real chef now!", "Yum! Another tasty dish done!"],
      tapServed: ["Mmm, that smells so good...", "My tummy is rumbling!", "Can I have a taste? Please?"],
      tapEmpty: ["Let's cook something yummy together!", "What shall we make today?"],
    },
    recipes: {
      "crystal-dumpling": {
        unlock: [
          "Whoa! Look at that golden glow! You gathered every secret ingredient. The imperial kitchen is open!",
        ],
        start: ["Careful now! When the steam clears, these little dumplings shine just like real jade crystals!"],
        success: ["Perfection! Tender, sweet, and glowing! Even the Emperor would ask for seconds!"],
        tapServed: ["Mmm, that crunchy bamboo shoot and sweet tiger prawn... my mouth is watering!"],
      },
      "crystal-pear-dew": {
        unlock: ["Whoa! Smell that? Snow pears and golden blossoms... a secret royal tea is ready to brew!"],
        start: ["Low and slow now! When the amber crystals melt, the whole pot turns sparkly gold!"],
        success: ["Ahh, so warm and sweet! One sip and you feel cozy all the way to your toes!"],
        tapServed: ["Sweet pear, ruby goji berries, a little floating flower... can I have just one sip?"],
      },
    },
    shelf: {
      foodTypes: { drinks: "drinks", hotmeal: "hot meals", desserts: "desserts" },
      lines: {
        foodTypeImbalance: "So many {have}! How about some {missing} next?",
        favoriteAgain: "{dish} again? You really love it, huh!",
        favoriteSpecialty: "I think {dish} is our specialty now!",
      },
    },
    challenge: {
      offer: [
        "Chef's challenge! Answer my question and I'll give you my paw print!",
        "Before we cook, a little culture quiz! Ready?",
        "Psst... I have a secret question for you. Get it right for a paw print!",
      ],
      correct: [
        "Paw-fect! Here's my paw print for you!",
        "You know so much! Stamp! One paw print for you!",
        "Wow, a true little culture chef! Take my paw print!",
      ],
      wrong: [
        "Oops, not this time! Now you know the answer. Try again next time!",
        "So close! Remember this one, and we'll try again next cook!",
        "That was a tricky one! Let's try again next time!",
      ],
      dismiss: ["No rush! Tap me when you're ready."],
    },
  },
  zh: {
    chefName: "鼩仔",
    tapAria: "和鼩仔聊聊天",
    hideLabel: "收起厨师",
    showLabel: "显示厨师",
    generic: {
      unlock: ["哇！一道新菜解锁啦！"],
      start: ["好，开始做饭啦！专心哦！", "小心火候，我们开始吧！", "锅铲准备好啦！"],
      success: ["当当当！看起来好好吃！", "太棒了！你已经是真正的大厨啦！", "好香呀！又做好一道美味！"],
      tapServed: ["嗯～好香啊……", "我的肚子咕咕叫啦！", "我可以尝一口吗？拜托啦！"],
      tapEmpty: ["我们一起做点好吃的吧！", "今天做点什么好呢？"],
    },
    recipes: {
      "crystal-dumpling": {
        unlock: ["哇！快看这道金光！你集齐了所有神秘食材，御膳房的大门打开啦！"],
        start: ["小心烫哦！等蒸汽散开，虾饺就会像水晶一样透亮！"],
        success: ["太棒啦！皮薄馅大，晶莹剔透！连皇帝吃了都要再来一笼！"],
        tapServed: ["吸溜……脆生生的笋尖配上大虾仁，看得我都流口水啦！"],
      },
      "crystal-pear-dew": {
        unlock: ["哇！闻到了吗？雪梨和金菊的香气……神秘的御用甜饮可以开炖啦！"],
        start: ["小火慢慢炖哦！等琥珀冰晶化开，整锅都会变得金灿灿的！"],
        success: ["好暖好甜呀！喝一口，从头暖到脚趾头！"],
        tapServed: ["清甜的雪梨，红红的杞果，还漂着一朵小金菊……让我喝一小口嘛！"],
      },
    },
    shelf: {
      foodTypes: { drinks: "饮品", hotmeal: "热菜", desserts: "甜点" },
      lines: {
        foodTypeImbalance: "好多{have}呀！下次做点{missing}怎么样？",
        favoriteAgain: "又是{dish}？你真的超爱它耶！",
        favoriteSpecialty: "{dish}已经是我们的招牌菜啦！",
      },
    },
    challenge: {
      offer: [
        "大厨挑战！答对我的问题，就送你一个爪印！",
        "开火之前，先来一道文化小问题！准备好了吗？",
        "嘘……我有一个秘密问题，答对就送你爪印哦！",
      ],
      correct: ["答对啦！送你我的爪印！", "你懂得真多！啪——盖个爪印给你！", "哇，真是文化小厨神！我的爪印送给你！"],
      wrong: [
        "哎呀，这次没答对！现在你知道答案啦，下次再来！",
        "差一点点！记住这个答案，下次做菜再挑战！",
        "这题有点难哦！下次再试试吧！",
      ],
      dismiss: ["不着急！准备好了再点我哦。"],
    },
  },
};
