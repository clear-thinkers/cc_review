/**
 * Size-tiered reward picks (roadmap item P; spec
 * docs/feature-specs/2026-10-24-child-packaged-sessions-and-reward-picks.md).
 *
 * TypeScript reference implementation of what `reward_session_ingredients` computes
 * server-side. "Slots" are the session's Tested Count -- the same number the Quiz
 * Results table shows (distinct tested items), never the number of packaged targets.
 */

/** Smallest Tested Count that earns any reward. */
export const REWARD_MIN_TESTED_COUNT = 10;
/** How many candidate ingredients every offer contains. */
export const REWARD_OFFER_SIZE = 3;

/**
 * Tested Count as the Results table shows it: distinct `hanzi` values in the saved
 * grade data (a phrase is its text; a paragraph blank is its text, so a word used in
 * several blanks counts once).
 */
export function countTestedItems(gradeData: ReadonlyArray<{ hanzi: string }>): number {
  return new Set(gradeData.map((entry) => entry.hanzi)).size;
}

/**
 * How many of the offered ingredients the child may pick:
 * < 10 -> 0 (no reward), 10-19 -> 1, 20-29 -> 2, >= 30 -> 3.
 */
export function rewardPicksForTestedCount(testedCount: number): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(testedCount) || testedCount < REWARD_MIN_TESTED_COUNT) return 0;
  if (testedCount < 20) return 1;
  if (testedCount < 30) return 2;
  return 3;
}

/** Picks actually allowed once the offer is built: never more than the offers that exist. */
export function effectiveRewardPicks(tierPicks: number, offerCount: number): number {
  return Math.max(0, Math.min(tierPicks, offerCount));
}

/** True when a claim of `selectedKeys` is acceptable for this offer: exactly `picksAllowed` distinct offered keys. */
export function isValidRewardClaim(
  offeredKeys: ReadonlyArray<string>,
  picksAllowed: number,
  selectedKeys: ReadonlyArray<string>
): boolean {
  const distinct = new Set(selectedKeys);
  if (distinct.size !== selectedKeys.length) return false;
  if (selectedKeys.length !== picksAllowed) return false;
  const offered = new Set(offeredKeys);
  return selectedKeys.every((key) => offered.has(key));
}

/**
 * Tap handler for the reward picker. One pick: tapping another choice swaps it. Several
 * picks: tapping toggles a choice, but nothing more can be added once the allowance is
 * full (deselect one first). Never returns more than `picksAllowed` keys.
 */
export function toggleRewardSelection(
  selected: ReadonlyArray<string>,
  key: string,
  picksAllowed: number
): string[] {
  if (selected.includes(key)) {
    return selected.filter((existing) => existing !== key);
  }
  if (picksAllowed <= 1) {
    return picksAllowed === 1 ? [key] : [];
  }
  return selected.length >= picksAllowed ? [...selected] : [...selected, key];
}

/** True when a finished session tested too few items to earn a reward (under REWARD_MIN_TESTED_COUNT). */
export function isBelowRewardThreshold(testedCount: number): boolean {
  return rewardPicksForTestedCount(testedCount) === 0;
}
