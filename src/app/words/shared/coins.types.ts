/**
 * Coin Rewards System — Type Definitions
 *
 * Types for wallet, coins, and reward-related data.
 *
 * Last updated: 2026-03-06
 */

/**
 * User wallet record.
 *
 * Persisted in Supabase `wallets` table, keyed by `user_id`.
 * One wallet per user (not per family).
 */
export type Wallet = {
  userId: string; // Primary key — maps to wallets.user_id
  totalCoins: number; // Cumulative coins earned across all sessions
  lastUpdatedAt: number; // Unix timestamp (milliseconds) of last update
  version: number; // Schema version; currently 1
};
