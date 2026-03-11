import type { ReactNode } from "react";

/**
 * Shell & Navigation Types
 * Shared across all feature pages for routing and layout
 */

export type NavPage = "add" | "all" | "review" | "admin" | "results" | "prompts" | "debug" | "adminQueue" | "adminTextbooks";
export type WordsSectionPage = NavPage | "flashcard" | "fillTest";

export type NavItem = {
  href: string;
  label: string;
  page: NavPage;
};
