import { createClient } from '@supabase/supabase-js';
import type { Database } from './supabase';

/**
 * Creates a Supabase client using the service-role key, bypassing RLS.
 *
 * Used only by routes that have to read user-scoped data without a
 * user JWT — currently just /api/ical/[token], where the request
 * comes anonymously from the user's calendar app and is authorised
 * solely by the opaque token in the URL.
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
