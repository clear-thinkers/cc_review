import type { KitchenChefLocaleStrings } from "./kitchenChef.types";

/**
 * Kitchen Chef Strings — Last updated: 2026-10-24
 * Chef Shrewy's lines (roadmap item O, docs/feature-specs/2026-10-24-kitchen-chef-dialogue.md).
 * No generic line names a food, an ingredient, or coins. Recipe-specific lines
 * override the generic set per trigger.
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
    },
  },
};
