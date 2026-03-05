/**
 * Supabase Client Initialization
 * 
 * This file initializes the Supabase client for browser use.
 * The client respects Row Level Security (RLS) policies automatically
 * when called from the browser (anon key) or with a user session token.
 * 
 * For server-side admin operations, use the service role client (in API routes only).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local'
  );
}

/**
 * Browser-side Supabase client
 * - Uses anon key (scoped by RLS policies)
 * - Automatically passes session JWT if user is logged in
 * - All database operations respect RLS policies
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Store session in localStorage (default)
    persistSession: true,
    // Auto-refresh token when close to expiry
    autoRefreshToken: true,
  },
});

/**
 * Server-side Supabase client (use in API routes only)
 * - Uses service role key (bypasses RLS)
 * - Only for admin operations (creating families, platform admin tasks)
 * - NEVER expose this client to the browser
 */
export function getServerSupabaseClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. ' +
      'This should only be used in server-side API routes.'
    );
  }

  return createClient(supabaseUrl!, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
