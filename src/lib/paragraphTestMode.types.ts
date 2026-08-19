/**
 * Paragraph test mode domain types owned by the lib/service layer.
 *
 * Maps directly to the `paragraph_test_modes` table: a named, reusable
 * selection of which of a paragraph's already-eligible spans should become
 * fill-test blanks. Purely a saved template -- creates nothing runnable on
 * its own (no review_test_sessions row). Mirrors the placement of
 * `Paragraph` in `src/lib/paragraph.types.ts`.
 */

export type ParagraphTestMode = {
  id: string;
  paragraphId: string;
  name: string;
  spanIds: string[];
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
};
