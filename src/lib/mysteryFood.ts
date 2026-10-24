import type {
  MysteryFoodDefinition,
  MysteryFoodProgress,
  MysteryHoldings,
  MysteryIngredientRequirement,
  MysteryMadeCounts,
  MysteryRewardEntry,
  WinSessionInput,
} from "./mysteryFood.types";

/** Mystery ingredient TYPES rewarded per win (each at its per-food quantity). */
export const MYSTERY_REWARD_QUOTA = 3;

/**
 * A win session: character/phrase/mixed -> Failed Count is 0 (and at least one
 * graded entry). A paragraph quiz has no "again" outcome by design (Fill-Test
 * Review Rule 32), so failed_count is always 0 for it; instead it wins only
 * with zero bounces -- every blank first-try "easy".
 */
export function isWinSession(session: WinSessionInput): boolean {
  if (session.gradeData.length === 0) {
    return false;
  }

  if (session.gradeData.some((entry) => entry.isParagraphBlank)) {
    return session.gradeData.every((entry) => entry.grade === "easy");
  }

  return session.failedCount === 0 && session.totalGrades > 0;
}

/** Valid requirements only: a key, and a positive whole quantity. */
function validRequirements(
  ingredients: MysteryIngredientRequirement[]
): MysteryIngredientRequirement[] {
  return ingredients.filter(
    (row) =>
      row.ingredientKey.trim() !== "" && Number.isInteger(row.quantity) && row.quantity > 0
  );
}

function held(holdings: MysteryHoldings, key: string): number {
  return Math.max(holdings.get(key) ?? 0, 0);
}

/** "N/M": ingredient types currently held in full per-food quantity. */
export function getMysteryFoodProgress(
  food: Pick<MysteryFoodDefinition, "ingredients">,
  holdings: MysteryHoldings
): MysteryFoodProgress {
  const requirements = validRequirements(food.ingredients);
  const satisfiedTypes = requirements.filter(
    (row) => held(holdings, row.ingredientKey) >= row.quantity
  ).length;

  return {
    satisfiedTypes,
    totalTypes: requirements.length,
    isComplete: requirements.length > 0 && satisfiedTypes === requirements.length,
  };
}

type Candidate = {
  food: MysteryFoodDefinition;
  requirements: MysteryIngredientRequirement[];
  madeCount: number;
};

function buildCandidates(
  foods: MysteryFoodDefinition[],
  madeCounts: MysteryMadeCounts
): Candidate[] {
  return foods
    .filter((food) => food.isActive)
    .map((food) => ({
      food,
      requirements: validRequirements(food.ingredients),
      madeCount: madeCounts.get(food.recipeId) ?? 0,
    }))
    .filter((candidate) => candidate.requirements.length > 0);
}

function unsatisfiedCount(candidate: Candidate, holdings: MysteryHoldings): number {
  return candidate.requirements.filter(
    (row) => held(holdings, row.ingredientKey) < row.quantity
  ).length;
}

/**
 * Plans one win's mystery-ingredient reward, or null when there are no active
 * mystery foods at all (the caller then falls back to the regular random
 * reward so a win never pays less than a non-win).
 *
 * Priority (spec item N): fewest unsatisfied ingredient types first (closest
 * to complete), then least-made (so never-made, count 0, wins ties), then
 * display order. Each chosen ingredient is topped up to its full per-food
 * quantity. At most `quota` types per win, none repeated; a shared ingredient
 * already chosen is raised to the larger needed quantity without using a slot.
 *
 * Phase 1 fills quota from unsatisfied types, walking foods in priority order
 * (so a food needing fewer than `quota` types hands the remainder to the next
 * food). Phase 2 runs only if slots remain after every food is satisfied: it
 * stockpiles another full set so a win always pays out and repeat cooking stays
 * possible. Foods are ranked by FEWEST ingredient types first (owner decision,
 * 2026-10-24); foods tied on that are picked in random order. `random` is
 * injectable (default Math.random) so tests are deterministic -- the SQL uses
 * `order by random()` for the same tie-break.
 */
export function planMysteryReward(
  foods: MysteryFoodDefinition[],
  holdings: MysteryHoldings,
  madeCounts: MysteryMadeCounts,
  quota: number = MYSTERY_REWARD_QUOTA,
  random: () => number = Math.random
): MysteryRewardEntry[] | null {
  const candidates = buildCandidates(foods, madeCounts);
  if (candidates.length === 0) {
    return null;
  }

  // Working copy so grants made earlier in this same win count toward later
  // satisfaction checks (shared ingredients, and the stockpile phase).
  const working = new Map<string, number>();
  for (const candidate of candidates) {
    for (const row of candidate.requirements) {
      working.set(row.ingredientKey, held(holdings, row.ingredientKey));
    }
  }

  const chosen = new Map<string, number>(); // ingredientKey -> quantity to grant, insertion-ordered

  const grant = (key: string, quantity: number) => {
    const existing = chosen.get(key);
    if (existing !== undefined) {
      // Shared ingredient already chosen this win: keep the larger need, no new slot.
      if (quantity > existing) {
        working.set(key, (working.get(key) ?? 0) + (quantity - existing));
        chosen.set(key, quantity);
      }
      return;
    }
    if (chosen.size >= quota) {
      return;
    }
    chosen.set(key, quantity);
    working.set(key, (working.get(key) ?? 0) + quantity);
  };

  const byPriority = (a: Candidate, b: Candidate) =>
    a.madeCount - b.madeCount || a.food.displayOrder - b.food.displayOrder;

  // Phase 1: top up unsatisfied types, closest-to-complete food first.
  const unsatisfiedFoods = candidates
    .map((candidate) => ({ candidate, unsatisfied: unsatisfiedCount(candidate, holdings) }))
    .filter((entry) => entry.unsatisfied > 0)
    .sort(
      (a, b) =>
        a.unsatisfied - b.unsatisfied || byPriority(a.candidate, b.candidate)
    );

  for (const { candidate } of unsatisfiedFoods) {
    for (const row of candidate.requirements) {
      if (chosen.size >= quota && !chosen.has(row.ingredientKey)) {
        continue;
      }
      // Need is measured against what the child held BEFORE this win, so a
      // shared ingredient's two foods compare total need to total need.
      const need = row.quantity - held(holdings, row.ingredientKey);
      if (need <= 0) {
        continue;
      }
      grant(row.ingredientKey, need);
    }
    if (chosen.size >= quota) {
      break;
    }
  }

  // Phase 2: every food satisfied (or quota not yet met) -> stockpile another set.
  if (chosen.size < quota) {
    const stockpileOrder = candidates
      .map((candidate) => ({ candidate, tieBreak: random() }))
      .sort(
        (a, b) =>
          a.candidate.requirements.length - b.candidate.requirements.length ||
          a.tieBreak - b.tieBreak
      )
      .map((entry) => entry.candidate);

    for (const candidate of stockpileOrder) {
      if (chosen.size >= quota) {
        break;
      }
      const sets = Math.min(
        ...candidate.requirements.map((row) =>
          Math.floor((working.get(row.ingredientKey) ?? 0) / row.quantity)
        )
      );
      const targetSets = sets + 1;
      for (const row of candidate.requirements) {
        if (chosen.size >= quota) {
          break;
        }
        if (chosen.has(row.ingredientKey)) {
          continue;
        }
        const need = targetSets * row.quantity - (working.get(row.ingredientKey) ?? 0);
        if (need > 0) {
          grant(row.ingredientKey, need);
        }
      }
    }
  }

  return Array.from(chosen, ([ingredientKey, quantity]) => ({ ingredientKey, quantity }));
}
