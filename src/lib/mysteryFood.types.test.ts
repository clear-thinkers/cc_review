import { describe, expect, it } from "vitest";
import type {
  MysteryFoodDefinition,
  MysteryFoodProgress,
  MysteryRewardEntry,
  WinSessionInput,
} from "./mysteryFood.types";

describe("mysteryFood types", () => {
  it("constructs a food definition", () => {
    const food: MysteryFoodDefinition = {
      recipeId: "r1",
      displayOrder: 1,
      isActive: true,
      ingredients: [{ ingredientKey: "wild-tiger-prawn", quantity: 2 }],
    };
    expect(food.ingredients[0].quantity).toBe(2);
  });

  it("constructs progress, reward entry, and win-session input shapes", () => {
    const progress: MysteryFoodProgress = { satisfiedTypes: 2, totalTypes: 4, isComplete: false };
    const entry: MysteryRewardEntry = { ingredientKey: "gilded-sesame-oil", quantity: 1 };
    const session: WinSessionInput = {
      gradeData: [{ grade: "easy" }, { grade: "again", isParagraphBlank: false }],
      failedCount: 1,
      totalGrades: 2,
    };
    expect(progress.isComplete).toBe(false);
    expect(entry.quantity).toBe(1);
    expect(session.gradeData).toHaveLength(2);
  });

  it("accepts every grade literal", () => {
    const grades: WinSessionInput["gradeData"][number]["grade"][] = ["again", "hard", "good", "easy"];
    expect(grades).toHaveLength(4);
  });
});
