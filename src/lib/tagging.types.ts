/**
 * Tagging Feature Types
 *
 * Types for the 4-level cascade tag system:
 * Textbook → Grade → Unit → Lesson
 *
 * Owned by the lib/service layer because these types map directly to
 * database rows read and written by supabase-service.ts.
 */

// ─── Database row shapes (camelCase) ────────────────────────────────────────

export type Textbook = {
  id: string;
  name: string;
  isShared: boolean;
  familyId: string | null;
  createdBy: string | null;
  createdAt: number;
};

export type LessonTag = {
  id: string;
  textbookId: string;
  grade: string;
  unit: string;
  lesson: string;
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
  grade: string;
  unit: string;
  lesson: string;
};

// ─── Cascade dropdown state (used in AddSection and filter bars) ─────────────

/**
 * Represents the user's active selection in the optional tag section.
 * All 4 levels must be non-null for the selection to be "complete".
 */
export type TagCascadeSelection = {
  textbookId: string | null;
  grade: string | null;
  unit: string | null;
  lesson: string | null;
};

/**
 * Represents a cascade filter applied to /words/all and /words/admin.
 * A null at any level means "no filter at this level".
 */
export type TagFilter = {
  textbookId: string | null;
  grade: string | null;
  unit: string | null;
  lessonTagId: string | null;
};

/** One option in a cascade dropdown. "create" signals a new row to be created. */
export type CascadeDropdownOption =
  | { type: "existing"; id: string; label: string }
  | { type: "create"; label: string };

/** The map from word ID to its resolved lesson tags for the Lessons column. */
export type WordLessonTagsMap = Map<string, ResolvedLessonTag[]>;
