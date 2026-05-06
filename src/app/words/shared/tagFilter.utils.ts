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
