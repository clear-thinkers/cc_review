/**
 * Quiz Results Feature Strings - TYPE DEFINITIONS ONLY
 *
 * The actual strings are maintained in ../words.strings.ts
 * This file provides type definitions for type-safe access.
 */

// Import the actual strings to derive types
export type ResultsLocaleStrings = {
  locale?: string;  // "en" | "zh" - use string type to avoid union compatibility issues
  pageTitle: string;
  noSessions: string;
  goToReviewPage: string;
  summary: {
    totalSessions: string;
    fullyCorrectPercent: string;
    failedPercent: string;
    partiallyCorrectPercent: string;
    totalCharactersTested: string;
    totalDuration: string;
    totalCoinsEarned: string;
  };
  table: {
    headers: {
      date: string;
      fullyCorrectPercent: string;
      failedPercent: string;
      partiallyCorrectPercent: string;
      duration: string;
      testedCount: string;
      testedCharacters: string;
      failedCount: string;
      failedCharacters: string;
      coinsEarned: string;
    };
    noCharacters: string;
  };
  clearHistory: {
    button: string;
    title: string;
    message: string;
    confirmButton: string;
    cancelButton: string;
  };
  emptyState: {
    heading: string;
    message: string;
    action: string;
  };
};
