import { createClient } from '@supabase/supabase-js';
import type { Database } from './supabase';

/**
 * Creates a Supabase client using the service-role key, bypassing RLS.
 *
 * Used only by code paths that need to write to a table with no INSERT
 * policy — currently just src/lib/securityEvents.ts, which appends rows
 * to public.auth_events (append-only by design; no RLS write policy
 * exists). The user_id written is always sourced from a verified JWT.
 *
 * Throws if SUPABASE_SERVICE_ROLE_KEY isn't set so misconfiguration
 * surfaces as a clear 5xx rather than mysterious empty results.
 */
export function createServiceRoleSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
