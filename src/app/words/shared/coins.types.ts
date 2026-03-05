/**
 * Coin Rewards System — Type Definitions
 *
 * Types for wallet, coins, and reward-related data.
 *
 * Last updated: 2026-03-04
 */

/**
 * User wallet record.
 *
 * Persisted in `wallets` IndexedDB table.
 * Singleton pattern: only one wallet record per app instance (id="wallet").
 */
export type Wallet = {
  id: string; // Fixed: "wallet" (singleton)
  totalCoins: number; // Cumulative coins earned across all sessions
  lastUpdatedAt: number; // Unix timestamp (milliseconds) of last update
  version: number; // Schema version; currently 1
};
