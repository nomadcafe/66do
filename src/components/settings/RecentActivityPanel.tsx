'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  LogIn,
  Download,
  Mail,
  UserMinus,
  Link2Off,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useI18nContext } from '../../contexts/I18nProvider';

interface AuthEvent {
  id: string;
  event_type: string;
  ua_summary: string | null;
  region: string | null;
  created_at: string;
}

interface Props {
  accessToken: string | null;
}

const EVENT_LIMIT = 20;

export default function RecentActivityPanel({ accessToken }: Props) {
  const { t, locale } = useI18nContext();
  const [events, setEvents] = useState<AuthEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/events?limit=${EVENT_LIMIT}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        setError(t('settings.security.loadFailed'));
        setLoading(false);
        return;
      }
      const json = (await res.json()) as { events?: AuthEvent[] };
      setEvents(json.events ?? []);
    } catch {
      setError(t('settings.security.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, t]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const formatTime = useMemo(
    () => (iso: string) => {
      const d = new Date(iso);
      const now = Date.now();
      const diffMs = now - d.getTime();
      const diffMin = Math.round(diffMs / 60_000);
      // Relative for the very recent stuff so the user can spot a sign-in
      // they just made vs an unfamiliar one. Absolute for anything older
      // than an hour — relative loses precision past that.
      if (diffMin < 1) return t('settings.security.justNow');
      if (diffMin < 60) {
        return t('settings.security.minutesAgo').replace('{n}', String(diffMin));
      }
      const diffHours = Math.round(diffMs / 3_600_000);
      if (diffHours < 24) {
        return t('settings.security.hoursAgo').replace('{n}', String(diffHours));
      }
      return d.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
    [locale, t]
  );

  return (
    <div className="space-y-5">
      {/* Intro card — frames what this panel is and is not. Uses teal so
          it pairs with the privacy page's "protections in place" card. */}
      <div className="rounded-2xl border border-teal-200/70 bg-teal-50/60 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-teal-900">
              {t('settings.security.introTitle')}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-teal-900/85">
              {t('settings.security.introBody')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900">
          {t('settings.security.recentActivityTitle')}
        </h3>
        <button
          type="button"
          onClick={fetchEvents}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {t('settings.security.refresh')}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && events === null && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-stone-200 bg-white"
            />
          ))}
        </div>
      )}

      {!loading && events !== null && events.length === 0 && (
        <p className="rounded-xl border border-stone-200 bg-white p-5 text-center text-sm text-stone-500">
          {t('settings.security.empty')}
        </p>
      )}

      {events !== null && events.length > 0 && (
        <ul className="space-y-2">
          {events.map((ev) => {
            const meta = describeEvent(ev.event_type, t);
            return (
              <li
                key={ev.id}
                className="flex items-start gap-3 rounded-xl border border-stone-200/80 bg-white p-3 sm:p-3.5"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.iconClass}`}
                >
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-900">{meta.label}</p>
                  <p className="mt-0.5 truncate text-xs text-stone-500">
                    {[ev.ua_summary, ev.region].filter(Boolean).join(' · ') ||
                      t('settings.security.unknownDetails')}
                  </p>
                </div>
                <time
                  dateTime={ev.created_at}
                  className="shrink-0 text-xs text-stone-500 tabular-nums"
                  title={new Date(ev.created_at).toLocaleString(
                    locale === 'zh' ? 'zh-CN' : 'en-US'
                  )}
                >
                  {formatTime(ev.created_at)}
                </time>
              </li>
            );
          })}
        </ul>
      )}

      <p className="pt-2 text-[11px] leading-relaxed text-stone-400">
        {t('settings.security.privacyNote')}
      </p>
    </div>
  );
}

function describeEvent(
  eventType: string,
  t: (k: string) => string
): { label: string; icon: React.ReactNode; iconClass: string } {
  switch (eventType) {
    case 'sign_in':
      return {
        label: t('settings.security.eventSignIn'),
        icon: <LogIn className="h-4 w-4" />,
        iconClass: 'bg-teal-50 text-teal-700',
      };
    case 'data_export':
      return {
        label: t('settings.security.eventDataExport'),
        icon: <Download className="h-4 w-4" />,
        iconClass: 'bg-amber-50 text-amber-700',
      };
    case 'email_change':
      return {
        label: t('settings.security.eventEmailChange'),
        icon: <Mail className="h-4 w-4" />,
        iconClass: 'bg-rose-50 text-rose-700',
      };
    case 'account_delete':
      return {
        label: t('settings.security.eventAccountDelete'),
        icon: <UserMinus className="h-4 w-4" />,
        iconClass: 'bg-rose-50 text-rose-700',
      };
    case 'oauth_unbind':
      return {
        label: t('settings.security.eventOauthUnbind'),
        icon: <Link2Off className="h-4 w-4" />,
        iconClass: 'bg-rose-50 text-rose-700',
      };
    default:
      return {
        label: eventType,
        icon: <ShieldCheck className="h-4 w-4" />,
        iconClass: 'bg-stone-100 text-stone-700',
      };
  }
}
