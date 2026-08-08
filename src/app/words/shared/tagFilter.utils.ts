export type TagFilterOption = {
  id: string;
};

export const NO_TAG_FILTER_ID = "__no-tags__";

export function getAllTagFilterOptionIds(options: readonly TagFilterOption[]): string[] {
  return options.map((option) => option.id);
}

export function toggleTagFilterId(
  selectedIds: readonly string[],
  tagId: string,
  isSelected: boolean
): string[] {
  if (isSelected) {
    return selectedIds.includes(tagId) ? [...selectedIds] : [...selectedIds, tagId];
  }

  return selectedIds.filter((id) => id !== tagId);
}

export function matchesSelectedTagFilter(
  wordTagIds: ReadonlySet<string>,
  selectedIds: readonly string[]
): boolean {
  if (selectedIds.length === 0) {
    return true;
  }

  return selectedIds.some((tagId) =>
    tagId === NO_TAG_FILTER_ID ? wordTagIds.size === 0 : wordTagIds.has(tagId)
  );
}

export type PartialTagFilterSelection = {
  textbooks: readonly string[];
  grades: readonly string[];
  units: readonly string[];
  lessons: readonly string[];
};

export type PartialTagFilterCandidate = {
  textbookName: string;
  grade: string;
  unit: string;
  lesson: string;
};

export function hasActivePartialTagFilter(selection: PartialTagFilterSelection): boolean {
  return (
    selection.textbooks.length > 0 ||
    selection.grades.length > 0 ||
    selection.units.length > 0 ||
    selection.lessons.length > 0
  );
}

export function matchesPartialTagFilter(
  tags: readonly PartialTagFilterCandidate[],
  selection: PartialTagFilterSelection
): boolean {
  if (!hasActivePartialTagFilter(selection)) {
    return true;
  }

  return tags.some(
    (t) =>
      (selection.textbooks.length === 0 || selection.textbooks.includes(t.textbookName)) &&
      (selection.grades.length === 0 || selection.grades.includes(t.grade)) &&
      (selection.units.length === 0 || selection.units.includes(t.unit)) &&
      (selection.lessons.length === 0 || selection.lessons.includes(t.lesson))
  );
}
