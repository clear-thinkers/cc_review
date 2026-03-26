/**
 * UI compatibility re-export for wallet types.
 *
 * Wallet is owned by the lib/service layer. Keep this file so existing UI
 * imports do not break while callers migrate.
 */
export type { Wallet } from "@/lib/wallet.types";
