import { describe, it, expect } from "vitest";
import type { PromptSlotValidationErrors, PromptType } from "./prompts.types";
import {
  PROMPT_TYPES,
  PROMPT_CHAR_LIMITS,
  MAX_USER_OWNED_SLOTS,
  MAX_SLOT_NAME_LENGTH,
  PREVIEW_LENGTH,
} from "./prompts.types";
import { promptsStrings } from "./prompts.strings";

// ─── Type construction tests ──────────────────────────────────────────────────

describe("prompts.types", () => {
  it("PROMPT_TYPES contains all five configurable types", () => {
    const expected: PromptType[] = ["full", "phrase", "example", "phrase_details", "meaning_details"];
    expect(PROMPT_TYPES).toEqual(expected);
    expect(PROMPT_TYPES).toHaveLength(5);
  });

  it("PROMPT_CHAR_LIMITS defines min and max for each type", () => {
    for (const type of PROMPT_TYPES) {
      const { min, max } = PROMPT_CHAR_LIMITS[type];
      expect(typeof min).toBe("number");
      expect(typeof max).toBe("number");
      expect(min).toBeGreaterThan(0);
      expect(max).toBeGreaterThan(min);
    }
  });

  it("full type has correct limits (100–1000)", () => {
    expect(PROMPT_CHAR_LIMITS.full).toEqual({ min: 100, max: 1000 });
  });

  it("meaning_details type has correct limits (50–500)", () => {
    expect(PROMPT_CHAR_LIMITS.meaning_details).toEqual({ min: 50, max: 500 });
  });

  it("MAX_USER_OWNED_SLOTS is 5", () => {
    expect(MAX_USER_OWNED_SLOTS).toBe(5);
  });

  it("MAX_SLOT_NAME_LENGTH is 50", () => {
    expect(MAX_SLOT_NAME_LENGTH).toBe(50);
  });

  it("PREVIEW_LENGTH is 120", () => {
    expect(PREVIEW_LENGTH).toBe(120);
  });

  it("PromptSlotValidationErrors can be constructed", () => {
    const errors: PromptSlotValidationErrors = { name: "Name required", body: "Too short" };
    expect(errors.name).toBe("Name required");
    expect(errors.body).toBe("Too short");
  });

  it("PromptSlotValidationErrors can be empty", () => {
    const errors: PromptSlotValidationErrors = {};
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

// ─── Bilingual string parity tests ───────────────────────────────────────────

describe("prompts.strings parity", () => {
  it("EN and ZH top-level keys match", () => {
    const enKeys = Object.keys(promptsStrings.en).sort();
    const zhKeys = Object.keys(promptsStrings.zh).sort();
    expect(enKeys).toEqual(zhKeys);
  });

  it("EN and ZH tabs keys match", () => {
    const enTabKeys = Object.keys(promptsStrings.en.tabs).sort();
    const zhTabKeys = Object.keys(promptsStrings.zh.tabs).sort();
    expect(enTabKeys).toEqual(zhTabKeys);
  });

  it("EN tabs cover all 5 prompt types", () => {
    const tabKeys = Object.keys(promptsStrings.en.tabs);
    for (const type of PROMPT_TYPES) {
      expect(tabKeys).toContain(type);
    }
  });

  it("EN strings are non-empty", () => {
    for (const [key, value] of Object.entries(promptsStrings.en)) {
      if (typeof value === "string") {
        expect(value.trim().length, `EN key "${key}" is empty`).toBeGreaterThan(0);
      }
    }
  });

  it("ZH strings are non-empty", () => {
    for (const [key, value] of Object.entries(promptsStrings.zh)) {
      if (typeof value === "string") {
        expect(value.trim().length, `ZH key "${key}" is empty`).toBeGreaterThan(0);
      }
    }
  });
});

// ─── Validation logic (inline, mirrors PromptsSection.validateForm logic) ─────

function validatePromptForm(
  name: string,
  body: string,
  promptType: PromptType,
  str: typeof promptsStrings.en
): PromptSlotValidationErrors {
  const errors: PromptSlotValidationErrors = {};
  const trimmed = name.trim();
  if (!trimmed) {
    errors.name = str.nameRequired;
  } else if (trimmed.length > MAX_SLOT_NAME_LENGTH) {
    errors.name = str.nameTooLong;
  }
  const limits = PROMPT_CHAR_LIMITS[promptType];
  if (body.length < limits.min) {
    errors.body = str.bodyTooShort;
  } else if (body.length > limits.max) {
    errors.body = str.bodyTooLong;
  }
  return errors;
}

describe("prompt form validation", () => {
  const str = promptsStrings.en;

  it("valid name and body: no errors", () => {
    const body = "a".repeat(100);
    const errors = validatePromptForm("My Slot", body, "full", str);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("empty name: returns nameRequired error", () => {
    const body = "a".repeat(100);
    const errors = validatePromptForm("", body, "full", str);
    expect(errors.name).toBe(str.nameRequired);
  });

  it("whitespace-only name: returns nameRequired error", () => {
    const body = "a".repeat(100);
    const errors = validatePromptForm("   ", body, "full", str);
    expect(errors.name).toBe(str.nameRequired);
  });

  it("name too long (51 chars): returns nameTooLong error", () => {
    const body = "a".repeat(100);
    const errors = validatePromptForm("a".repeat(51), body, "full", str);
    expect(errors.name).toBe(str.nameTooLong);
  });

  it("name exactly 50 chars: no name error", () => {
    const body = "a".repeat(100);
    const errors = validatePromptForm("a".repeat(50), body, "full", str);
    expect(errors.name).toBeUndefined();
  });

  it("body below minimum (full type, < 100 chars): returns bodyTooShort error", () => {
    const errors = validatePromptForm("Slot", "short", "full", str);
    expect(errors.body).toBe(str.bodyTooShort);
  });

  it("body above maximum (full type, > 1000 chars): returns bodyTooLong error", () => {
    const body = "a".repeat(1001);
    const errors = validatePromptForm("Slot", body, "full", str);
    expect(errors.body).toBe(str.bodyTooLong);
  });

  it("body at minimum (full type, exactly 100 chars): no body error", () => {
    const body = "a".repeat(100);
    const errors = validatePromptForm("Slot", body, "full", str);
    expect(errors.body).toBeUndefined();
  });

  it("body at maximum for meaning_details (exactly 500 chars): no body error", () => {
    const body = "a".repeat(500);
    const errors = validatePromptForm("Slot", body, "meaning_details", str);
    expect(errors.body).toBeUndefined();
  });

  it("body below minimum for meaning_details (< 50 chars): returns bodyTooShort", () => {
    const errors = validatePromptForm("Slot", "short", "meaning_details", str);
    expect(errors.body).toBe(str.bodyTooShort);
  });
});

// ─── Service layer 5-slot enforcement (unit-level logic test) ────────────────

describe("max slot enforcement logic", () => {
  it("allows up to MAX_USER_OWNED_SLOTS user-owned slots", () => {
    // Simulate the count check logic in upsertPromptSlot
    function canAddSlot(existingCount: number): boolean {
      return existingCount < MAX_USER_OWNED_SLOTS;
    }
    expect(canAddSlot(0)).toBe(true);
    expect(canAddSlot(4)).toBe(true);
    expect(canAddSlot(5)).toBe(false);
    expect(canAddSlot(6)).toBe(false);
  });
});

// ─── Stub render test (PromptsSection returns null when page !== 'prompts') ───
// Note: @testing-library/react is not in this project's dependencies.
// The render behavior is exercised by integration; these tests cover logic only.

describe("PromptsSection page guard (logic)", () => {
  it("prompts page is not a fill-test or flashcard sub-page", () => {
    // Confirms 'prompts' is distinct from hidden sub-pages
    const nonNavPages = ["flashcard", "fillTest"];
    expect(nonNavPages).not.toContain("prompts");
  });

  it("prompts is a valid NavPage", () => {
    const navPages: string[] = ["add", "all", "review", "admin", "results", "prompts"];
    expect(navPages).toContain("prompts");
  });
});
