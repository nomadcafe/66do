'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useI18nContext } from '../../contexts/I18nProvider';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';

interface Props {
  accessToken: string | null;
  email: string | null;
}

export default function AccountDangerZonePanel({ accessToken, email }: Props) {
  const { t } = useI18nContext();
  const { signOut } = useSupabaseAuth();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Type-the-email-to-confirm guard. Case-insensitive trim match — we
  // don't want a stray capital "G" in Gmail to be the thing standing
  // between the user and an action they explicitly opted into.
  const normalizedEmail = email?.trim().toLowerCase() ?? '';
  const matches = typed.trim().toLowerCase() === normalizedEmail && normalizedEmail.length > 0;
  const canSubmit = matches && !!accessToken && !submitting;

  const handleDelete = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const reason = res.status === 429 ? 'rate' : 'fail';
        setError(reason === 'rate' ? t('settings.security.deleteAccountRateLimited') : t('settings.security.deleteAccountFailed'));
        setSubmitting(false);
        return;
      }
      // Account is gone server-side. Drop the local session and bounce
      // home — leaving the user on /dashboard with an invalid JWT would
      // just throw RLS errors at them.
      await signOut();
      window.location.replace('/');
    } catch {
      setError(t('settings.security.deleteAccountFailed'));
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-rose-200/70 bg-rose-50/60 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-rose-900">
            {t('settings.security.dangerZoneTitle')}
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-rose-900/85">
            {t('settings.security.dangerZoneBody')}
          </p>

          {!confirming && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
            >
              {t('settings.security.deleteAccountAction')}
            </button>
          )}

          {confirming && (
            <div className="mt-4 space-y-3 rounded-xl border border-rose-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-rose-900">
                {t('settings.security.deleteAccountConfirmTitle')}
              </h4>
              <p className="text-[13px] leading-relaxed text-stone-700">
                {t('settings.security.deleteAccountConfirmBody').replace(
                  '{email}',
                  email ?? ''
                )}
              </p>
              <label className="block">
                <span className="block text-xs font-medium text-stone-600">
                  {t('settings.security.deleteAccountConfirmInputLabel')}
                </span>
                <input
                  type="email"
                  autoComplete="off"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={submitting}
                  className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40 disabled:opacity-60"
                />
              </label>
              {error && (
                <p className="text-xs text-rose-700">{error}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {submitting
                    ? t('settings.security.deleteAccountDeleting')
                    : t('settings.security.deleteAccountConfirmButton')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    setTyped('');
                    setError(null);
                  }}
                  disabled={submitting}
                  className="inline-flex items-center rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-1"
                >
                  {t('settings.security.deleteAccountCancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
