'use client';

import { useEffect, useState } from 'react';
import { Calendar, Copy, RefreshCw, Check, ExternalLink } from 'lucide-react';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';
import { useI18nContext } from '../../contexts/I18nProvider';
import { logger } from '../../lib/logger';

/**
 * Settings panel card that surfaces the user's iCal subscription URL
 * for the renewal calendar. The user pastes this into Google Calendar /
 * Apple Calendar / outlook.com once and gets system-native reminders
 * for every domain — independent of whether this app is open or even
 * online when the date approaches.
 *
 * Token is fetched lazily from /api/ical (GETs the existing one or
 * generates one server-side if missing). Regenerate POSTs the same
 * route, which invalidates any previously shared link.
 */
export default function IcalSubscriptionCard() {
  const { session } = useSupabaseAuth();
  const { t, locale } = useI18nContext();

  const [token, setToken] = useState<string | null>(null);
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null);
  const [lastUsedIp, setLastUsedIp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copiedKind, setCopiedKind] = useState<null | 'http' | 'webcal'>(null);
  const [error, setError] = useState<string | null>(null);

  // Lazy-load the token on mount. We don't preload at app start because
  // most users won't open Settings → calendar; defer the round-trip.
  useEffect(() => {
    if (!session?.access_token) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/ical', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setToken(data.token ?? null);
          setLastUsedAt(data.lastUsedAt ?? null);
          setLastUsedIp(data.lastUsedIp ?? null);
        }
      } catch (e) {
        logger.error('Failed to load iCal token', e);
        if (!cancelled) setError(t('settings.icalLoadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session?.access_token, t]);

  const httpUrl = typeof window !== 'undefined' && token
    ? `${window.location.origin}/api/ical/${token}`
    : null;
  const webcalUrl = typeof window !== 'undefined' && token
    ? `webcal://${window.location.host}/api/ical/${token}`
    : null;

  const copy = async (url: string, kind: 'http' | 'webcal') => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKind(kind);
      window.setTimeout(() => setCopiedKind(null), 1500);
    } catch (e) {
      logger.error('Clipboard copy failed', e);
      setError(t('settings.icalCopyFailed'));
    }
  };

  const regenerate = async () => {
    if (!session?.access_token) return;
    if (!window.confirm(t('settings.icalRegenerateConfirm'))) return;
    try {
      setRegenerating(true);
      const res = await fetch('/api/ical', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setToken(data.token);
      setLastUsedAt(data.lastUsedAt ?? null);
      setLastUsedIp(data.lastUsedIp ?? null);
      setError(null);
    } catch (e) {
      logger.error('iCal regenerate failed', e);
      setError(t('settings.icalRegenerateFailed'));
    } finally {
      setRegenerating(false);
    }
  };

  const formattedLastUsed = lastUsedAt
    ? new Date(lastUsedAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-teal-50 rounded-xl text-teal-600 shrink-0">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-stone-900">
            {t('settings.icalTitle')}
          </h3>
          <p className="text-sm text-stone-600 mt-1">
            {t('settings.icalSubtitle')}
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-stone-500">{t('common.loading')}</p>
      )}

      {!loading && webcalUrl && httpUrl && (
        <div className="space-y-3">
          {/* webcal:// — clicking it on macOS / iOS opens Calendar.app to subscribe. */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">
              {t('settings.icalSubscribeUrl')}
            </label>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-700 break-all">
                {webcalUrl}
              </code>
              <button
                type="button"
                onClick={() => copy(webcalUrl, 'webcal')}
                className="px-3 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 inline-flex items-center gap-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                aria-label={t('settings.icalCopy')}
              >
                {copiedKind === 'webcal'
                  ? <Check className="h-4 w-4 text-emerald-600" />
                  : <Copy className="h-4 w-4" />}
              </button>
              <a
                href={webcalUrl}
                className="px-3 rounded-lg bg-teal-600 text-white hover:bg-teal-700 inline-flex items-center gap-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <ExternalLink className="h-4 w-4" />
                {t('settings.icalSubscribe')}
              </a>
            </div>
          </div>

          {/* https:// fallback for Google Calendar / outlook.com — they don't support webcal://. */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">
              {t('settings.icalHttpUrl')}
            </label>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-700 break-all">
                {httpUrl}
              </code>
              <button
                type="button"
                onClick={() => copy(httpUrl, 'http')}
                className="px-3 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 inline-flex items-center gap-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                aria-label={t('settings.icalCopy')}
              >
                {copiedKind === 'http'
                  ? <Check className="h-4 w-4 text-emerald-600" />
                  : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-stone-500 mt-1.5">
              {t('settings.icalHttpHint')}
            </p>
          </div>

          <div className="pt-2 border-t border-stone-100 space-y-1">
            {formattedLastUsed ? (
              <p className="text-xs text-stone-600">
                <span className="font-medium text-stone-700">{t('settings.icalLastUsedLabel')}：</span>
                {formattedLastUsed}
                {lastUsedIp ? (
                  <>
                    {' '}
                    {t('settings.icalLastUsedFrom')}{' '}
                    <code className="px-1 py-0.5 bg-stone-100 rounded text-[11px] text-stone-700">{lastUsedIp}</code>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="text-xs text-stone-500">{t('settings.icalLastUsedNever')}</p>
            )}
            {formattedLastUsed && (
              <p className="text-[11px] text-stone-500">{t('settings.icalLastUsedHint')}</p>
            )}
          </div>

          <div className="pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={regenerate}
              disabled={regenerating}
              className="text-sm text-stone-600 hover:text-red-600 inline-flex items-center gap-1.5 font-medium disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
            >
              <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
              {t('settings.icalRegenerate')}
            </button>
            <p className="text-xs text-stone-500 mt-1">
              {t('settings.icalRegenerateHint')}
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
