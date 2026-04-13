export type TagFilterOption = {
  id: string;
};

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
