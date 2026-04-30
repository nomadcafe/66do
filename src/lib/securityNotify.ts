/**
 * Client-side helpers for recording security-sensitive auth events.
 * These wrap the /api/auth/notify-* endpoints with fire-and-forget fetch
 * calls — we never await the result, so a slow or failing audit pipeline
 * cannot delay the user's redirect or block their data export.
 *
 * The endpoints record into the auth_events table; the user reviews
 * their history in the dashboard's Settings → Security panel.
 *
 * Errors are swallowed and logged to console only — never user-visible.
 */

import type { Session } from '@supabase/supabase-js';

const NOTIFY_SIGNIN_PATH = '/api/auth/notify-signin';
const NOTIFY_SENSITIVE_PATH = '/api/auth/notify-sensitive';

export type ClientSensitiveOp = 'data_export' | 'email_change' | 'account_delete' | 'oauth_unbind';

/**
 * Record a sign-in event for the active session. Safe to call on every
 * successful auth callback — every sign-in is recorded so the user's
 * activity log shows complete history.
 *
 * Pass the access token explicitly rather than reading from supabase
 * client because the auth callback flow has already stored it in memory
 * and we want to avoid a second getSession round-trip just to grab it.
 */
export function fireSignInNotification(session: Session | null): void {
  if (!session?.access_token) return;
  // keepalive lets the request survive the immediate router.replace()
  // that follows in the callback flow — without it, Chromium may cancel
  // the in-flight POST when the page navigates away.
  fetch(NOTIFY_SIGNIN_PATH, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    keepalive: true,
  }).catch((err) => {
    // Logged only — never user-visible.
    console.warn('Sign-in notification failed:', err);
  });
}

/**
 * Record a sensitive-operation event. Same fire-and-forget contract.
 */
export function fireSensitiveOpNotification(
  session: Session | null,
  event: ClientSensitiveOp
): void {
  if (!session?.access_token) return;
  fetch(NOTIFY_SENSITIVE_PATH, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch((err) => {
    console.warn('Sensitive-op notification failed:', err);
  });
}
