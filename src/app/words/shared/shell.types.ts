/**
 * Shell & Navigation Types
 * Shared across all feature pages for routing and layout
 */

export type NavPage =
  | "home"
  | "add"
  | "addParagraph"
  | "all"
  | "review"
  | "shop"
  | "shopKitchen"
  | "shopAdmin"
  | "admin"
  | "results"
  | "prompts"
  | "debug";
export type WordsSectionPage = NavPage | "flashcard" | "fillTest";

export type NavItem = {
  href: string;
  label: string;
  page: NavPage;
};
