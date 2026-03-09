/**
 * AI Prompts Feature Types
 * Types for the admin-configurable LLM prompt template page.
 * Last updated: 2026-03-09
 */

export type PromptType = "full" | "phrase" | "example" | "phrase_details" | "meaning_details";

/** All configurable prompt types in display order. */
export const PROMPT_TYPES: PromptType[] = [
  "full",
  "phrase",
  "example",
  "phrase_details",
  "meaning_details",
];

/** Maximum number of user-owned slots per prompt type per family. */
export const MAX_USER_OWNED_SLOTS = 5;

/** Maximum characters for a slot name. */
export const MAX_SLOT_NAME_LENGTH = 50;

/** Number of characters to show in the slot card preview. */
export const PREVIEW_LENGTH = 120;

/**
 * Character limits for the user-editable instructions body (format suffix is hardcoded and not counted).
 */
export const PROMPT_CHAR_LIMITS: Record<PromptType, { min: number; max: number }> = {
  full: { min: 30, max: 700 },
  phrase: { min: 30, max: 600 },
  example: { min: 30, max: 500 },
  phrase_details: { min: 30, max: 600 },
  meaning_details: { min: 20, max: 400 },
};

/** Validation errors for the inline edit form. */
export type PromptSlotValidationErrors = {
  name?: string;
  body?: string;
};

/** The edit target in the inline form: 'new' = creating, or slot id = updating. */
export type EditTarget = "new" | string;
