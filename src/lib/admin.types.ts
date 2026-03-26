/**
 * Admin domain types owned by the lib/service layer.
 *
 * Only types read or written by supabase-service.ts live here.
 * UI-only admin types (AdminTableRow, AdminPendingPhrase, etc.) remain
 * in src/app/words/admin/admin.types.ts.
 */

export type HiddenAdminTarget = {
  character: string;
  pronunciation: string;
  key: string;
};
