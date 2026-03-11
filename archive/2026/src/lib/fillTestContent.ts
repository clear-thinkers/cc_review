import type { FillTest } from "./fillTest";

export const FILL_TESTS_BY_HANZI: Record<string, FillTest> = {
  吃: {
    phrases: ["eat", "drink", "cook"],
    sentences: [
      { text: "I ___ breakfast at home.", answerIndex: 0 },
      { text: "We ___ dinner together.", answerIndex: 0 },
      { text: "They ___ fruit every day.", answerIndex: 0 },
    ],
  },
  跑: {
    phrases: ["run", "walk", "jump"],
    sentences: [
      { text: "I ___ in the park every morning.", answerIndex: 0 },
      { text: "She can ___ very fast.", answerIndex: 0 },
      { text: "We ___ to the bus stop.", answerIndex: 0 },
    ],
  },
  睡: {
    phrases: ["sleep", "study", "work"],
    sentences: [
      { text: "I ___ at 10 PM.", answerIndex: 0 },
      { text: "Babies ___ many hours a day.", answerIndex: 0 },
      { text: "He likes to ___ early.", answerIndex: 0 },
    ],
  },
};
