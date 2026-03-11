/**
 * Tagging Feature Types
 *
 * Types for the slot-based cascade tag system.
 * A Textbook defines up to 3 slot labels (slot1Label … slot3Label); a LessonTag
 * stores the corresponding slot values (slot1Value … slot3Value), all nullable.
 *
 * Per BUILD_CONVENTIONS §1a: Types live adjacent to the features that use them.
 * This file is shared by add/, all/, and admin/ features.
 */

// ─── Database row shapes (camelCase) ────────────────────────────────────────

export type Textbook = {
  id: string;
  name: string;
  isShared: boolean;
  familyId: string | null;
  createdBy: string | null;
  createdAt: number;
  slot1Label: string | null;
  slot2Label: string | null;
  slot3Label: string | null;
  slot1LabelZh: string | null;
  slot2LabelZh: string | null;
  slot3LabelZh: string | null;
};

export type LessonTag = {
  id: string;
  textbookId: string;
  familyId: string;
  slot1Value: string | null;
  slot2Value: string | null;
  slot3Value: string | null;
  createdAt: number;
};

export type WordLessonTag = {
  id: string;
  wordId: string;
  lessonTagId: string;
  familyId: string;
  createdAt: number;
};

// ─── Resolved / display shapes ───────────────────────────────────────────────

/** A cascade tag resolved to display strings for the Lessons pill column. */
export type ResolvedLessonTag = {
  lessonTagId: string;
  textbookId: string;
  textbookName: string;
  slot1Value: string | null;
  slot2Value: string | null;
  slot3Value: string | null;
};

// ─── Cascade dropdown state (used in AddSection and filter bars) ─────────────

/**
 * Represents the user's active selection in the optional tag section.
 * textbookId + slot1Value are the minimum for a "complete" selection.
 */
export type TagCascadeSelection = {
  textbookId: string | null;
  slot1Value: string | null;
  slot2Value: string | null;
  slot3Value: string | null;
};

/**
 * Represents a cascade filter applied to /words/all and /words/admin.
 * A null at any level means "no filter at this level".
 */
export type TagFilter = {
  textbookId: string | null;
  slot1Value: string | null;
  slot2Value: string | null;
  slot3Value: string | null;
  lessonTagId: string | null;
};

/** One option in a cascade dropdown. "create" signals a new row to be created. */
export type CascadeDropdownOption =
  | { type: "existing"; id: string; label: string }
  | { type: "create"; label: string };

/** The map from word ID to its resolved lesson tags for the Lessons column. */
export type WordLessonTagsMap = Map<string, ResolvedLessonTag[]>;
