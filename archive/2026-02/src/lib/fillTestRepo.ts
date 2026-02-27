import {
  deleteDisabledFillTest,
  deleteCustomFillTest,
  getAllDisabledFillTests,
  getAllCustomFillTests,
  getCustomFillTest,
  putDisabledFillTest,
  putCustomFillTest,
} from "./db";
import type { FillTest } from "./fillTest";
import { FILL_TESTS_BY_HANZI } from "./fillTestContent";

export type FillTestAdminEntry = {
  hanzi: string;
  fillTest: FillTest;
  source: "seed" | "custom";
  hasSeed: boolean;
};

function cloneFillTest(fillTest: FillTest): FillTest {
  return {
    phrases: [...fillTest.phrases] as [string, string, string],
    sentences: fillTest.sentences.map((sentence) => ({ ...sentence })) as [
      FillTest["sentences"][0],
      FillTest["sentences"][1],
      FillTest["sentences"][2],
    ],
  };
}

function normalizeHanzi(hanzi: string): string {
  return hanzi.trim();
}

export async function getFillTestForHanzi(hanzi: string): Promise<FillTest | undefined> {
  const normalizedHanzi = normalizeHanzi(hanzi);
  if (!normalizedHanzi) {
    return undefined;
  }

  const custom = await getCustomFillTest(normalizedHanzi);
  if (custom) {
    return cloneFillTest(custom);
  }

  const disabledEntries = await getAllDisabledFillTests();
  const disabledHanzi = new Set(disabledEntries.map((entry) => entry.hanzi));
  if (disabledHanzi.has(normalizedHanzi)) {
    return undefined;
  }

  const seeded = FILL_TESTS_BY_HANZI[normalizedHanzi];
  if (seeded) {
    return cloneFillTest(seeded);
  }

  return undefined;
}

export async function getMergedFillTestsByHanzi(): Promise<Record<string, FillTest>> {
  const merged: Record<string, FillTest> = {};
  const disabledEntries = await getAllDisabledFillTests();
  const disabledHanzi = new Set(disabledEntries.map((entry) => entry.hanzi));

  for (const [hanzi, fillTest] of Object.entries(FILL_TESTS_BY_HANZI)) {
    if (disabledHanzi.has(hanzi)) {
      continue;
    }

    merged[hanzi] = cloneFillTest(fillTest);
  }

  const customEntries = await getAllCustomFillTests();
  for (const entry of customEntries) {
    merged[entry.hanzi] = cloneFillTest(entry.fillTest);
  }

  return merged;
}

export async function listFillTestsForAdmin(): Promise<FillTestAdminEntry[]> {
  const customEntries = await getAllCustomFillTests();
  const disabledEntries = await getAllDisabledFillTests();
  const disabledHanzi = new Set(disabledEntries.map((entry) => entry.hanzi));
  const customByHanzi = new Map(customEntries.map((entry) => [entry.hanzi, entry.fillTest]));
  const allHanzi = new Set<string>([
    ...Object.keys(FILL_TESTS_BY_HANZI),
    ...Array.from(customByHanzi.keys()),
  ]);

  return Array.from(allHanzi)
    .sort((left, right) => left.localeCompare(right))
    .map((hanzi) => {
      const customFillTest = customByHanzi.get(hanzi);
      const seedFillTest = FILL_TESTS_BY_HANZI[hanzi];
      const seedIsDisabled = disabledHanzi.has(hanzi);

      if (customFillTest) {
        return {
          hanzi,
          fillTest: cloneFillTest(customFillTest),
          source: "custom" as const,
          hasSeed: Boolean(seedFillTest && !seedIsDisabled),
        };
      }

      if (!seedFillTest || seedIsDisabled) {
        return null;
      }

      return {
        hanzi,
        fillTest: cloneFillTest(seedFillTest),
        source: "seed" as const,
        hasSeed: true,
      };
    })
    .filter((entry): entry is FillTestAdminEntry => Boolean(entry));
}

export async function saveFillTestForHanzi(hanzi: string, fillTest: FillTest): Promise<void> {
  const normalizedHanzi = normalizeHanzi(hanzi);
  if (!normalizedHanzi) {
    return;
  }

  await putCustomFillTest(normalizedHanzi, cloneFillTest(fillTest));
  await deleteDisabledFillTest(normalizedHanzi);
}

export async function deleteFillTestEntry(hanzi: string): Promise<void> {
  const normalizedHanzi = normalizeHanzi(hanzi);
  if (!normalizedHanzi) {
    return;
  }

  const hasSeed = Boolean(FILL_TESTS_BY_HANZI[normalizedHanzi]);

  await deleteCustomFillTest(normalizedHanzi);

  if (hasSeed) {
    await putDisabledFillTest(normalizedHanzi);
  } else {
    await deleteDisabledFillTest(normalizedHanzi);
  }
}

export async function removeFillTestOverride(hanzi: string): Promise<void> {
  const normalizedHanzi = normalizeHanzi(hanzi);
  if (!normalizedHanzi) {
    return;
  }

  await deleteCustomFillTest(normalizedHanzi);
}
