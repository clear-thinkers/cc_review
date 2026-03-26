/**
 * Wallet domain types.
 *
 * Owned by the lib/service layer because wallet records are persisted and
 * returned by service-layer APIs.
 */
export type Wallet = {
  userId: string; // Primary key - maps to wallets.user_id
  totalCoins: number; // Cumulative coins earned across all sessions
  lastUpdatedAt: number; // Unix timestamp (milliseconds) of last update
  version: number; // Schema version; currently 1
};
