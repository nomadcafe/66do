'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, AlertTriangle, CircleHelp } from 'lucide-react';
import { DomainWithTags } from '../../types/dashboard';
import {
  computeUpcomingRenewals,
  UNKNOWN_REGISTRAR,
  type UpcomingBucketKey,
  type UpcomingRenewalRow,
} from '../../lib/upcomingRenewals';
import { formatCurrency } from '../../lib/financialCalculations';
import { localCalendarDateISO } from '../../lib/localCalendarDate';
import { useI18nContext } from '../../contexts/I18nProvider';

interface UpcomingRenewalsProps {
  domains: DomainWithTags[];
}

/** 折叠阈值：清单再长也先只铺这么多行，其余点开看 */
const COLLAPSED_ROWS = 8;

const BUCKET_ORDER: readonly UpcomingBucketKey[] = ['overdue', 'd30', 'd60', 'd90'] as const;

const BUCKET_LABEL_KEY: Record<UpcomingBucketKey, string> = {
  overdue: 'renewal.bucketOverdue',
  d30: 'renewal.bucket30',
  d60: 'renewal.bucket60',
  d90: 'renewal.bucket90',
};

// 紧迫度配色：过期=红，30 天=琥珀，其余=石灰。和年度面板的
// past/current/future 语义不同，这里表达的是「多急」。
const BUCKET_TONE: Record<UpcomingBucketKey, { tile: string; label: string; value: string }> = {
  overdue: {
    tile: 'border-red-200/80 bg-red-50/60',
    label: 'text-red-700/80',
    value: 'text-red-800',
  },
  d30: {
    tile: 'border-amber-200/80 bg-amber-50/60',
    label: 'text-amber-700/80',
    value: 'text-amber-800',
  },
  d60: {
    tile: 'border-stone-200/80 bg-stone-50/70',
    label: 'text-stone-500',
    value: 'text-stone-800',
  },
  d90: {
    tile: 'border-stone-200/80 bg-stone-50/70',
    label: 'text-stone-500',
    value: 'text-stone-800',
  },
};

export default function UpcomingRenewals({ domains }: UpcomingRenewalsProps) {
  const { t } = useI18nContext();
  const [expanded, setExpanded] = useState(false);

  const summary = useMemo(() => computeUpcomingRenewals(domains), [domains]);

  const registrarLabel = (registrar: string) =>
    registrar === UNKNOWN_REGISTRAR ? t('renewal.unknownRegistrar') : registrar;

  // 「还有 N 天 / 已过期 N 天 / 今天」—— 天数本身比日期更能说明紧迫度
  const dueLabel = (row: UpcomingRenewalRow) => {
    if (row.days_until < 0) {
      return t('renewal.overdueByDays').replace('{days}', String(-row.days_until));
    }
    if (row.days_until === 0) return t('renewal.dueToday');
    return t('renewal.dueInDays').replace('{days}', String(row.days_until));
  };

  const visibleRows = expanded ? summary.rows : summary.rows.slice(0, COLLAPSED_ROWS);
  const hiddenCount = summary.rows.length - visibleRows.length;

  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-stone-900">{t('renewal.upcomingTitle')}</h3>
          <p className="mt-0.5 text-sm text-stone-500">
            {t('renewal.upcomingDesc').replace('{days}', String(summary.horizon_days))}
          </p>
        </div>
      </div>

      {/* Bucket tiles — overdue 只在真有逾期时占位，平时不该有一块常驻红色 */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {BUCKET_ORDER.filter((key) => key !== 'overdue' || summary.buckets.overdue.count > 0).map(
          (key) => {
            const tone = BUCKET_TONE[key];
            const b = summary.buckets[key];
            return (
              <div key={key} className={`rounded-xl border p-4 ${tone.tile}`}>
                <p
                  className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${tone.label}`}
                >
                  {t(BUCKET_LABEL_KEY[key])}
                </p>
                <p className={`mt-1 text-lg font-bold tabular-nums ${tone.value}`}>
                  {formatCurrency(b.cost, 'USD')}
                </p>
                <p className="mt-0.5 text-xs text-stone-500 tabular-nums">
                  {t('renewal.bucketDomainCount').replace('{count}', String(b.count))}
                </p>
              </div>
            );
          }
        )}
      </div>

      {summary.rows.length === 0 ? (
        <p className="mt-5 rounded-xl border border-stone-100 bg-stone-50/60 p-6 text-center text-sm text-stone-600">
          {t('renewal.upcomingNone').replace('{days}', String(summary.horizon_days))}
        </p>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  <th className="py-2 pr-3 text-left font-semibold">{t('renewal.colDomain')}</th>
                  <th className="py-2 px-3 text-left font-semibold">{t('renewal.colRegistrar')}</th>
                  <th className="py-2 px-3 text-left font-semibold">{t('renewal.colDueDate')}</th>
                  <th className="py-2 pl-3 text-right font-semibold">{t('renewal.colCost')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr
                    key={row.domain_id}
                    className={`border-b border-stone-50 last:border-0 ${
                      row.bucket === 'overdue' ? 'bg-red-50/40' : ''
                    }`}
                  >
                    <td className="py-2.5 pr-3">
                      <span
                        className="font-medium text-stone-900 break-all"
                        title={row.domain_name}
                      >
                        {row.domain_name || '—'}
                      </span>
                      {/* 兜底推算出来的到期日置信度低，标出来别让人当成注册商给的确切日期 */}
                      {row.expiry_source === 'estimated' && (
                        <span className="ml-1.5 inline-flex items-center rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                          {t('renewal.expiryEstimated')}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-stone-600">{registrarLabel(row.registrar)}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-stone-800 tabular-nums">
                        {localCalendarDateISO(row.due_date)}
                      </span>
                      <span
                        className={`ml-2 text-xs tabular-nums ${
                          row.days_until < 0
                            ? 'font-medium text-red-700'
                            : row.days_until <= 30
                              ? 'font-medium text-amber-700'
                              : 'text-stone-500'
                        }`}
                      >
                        {dueLabel(row)}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums">
                      {row.cost_known ? (
                        <span className="font-medium text-stone-900">
                          {formatCurrency(row.cost, 'USD')}
                        </span>
                      ) : (
                        <span className="text-stone-400" title={t('renewal.costUnknownHint')}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-3 text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline"
            >
              {t('renewal.showAllRows').replace('{count}', String(hiddenCount))}
            </button>
          )}
          {expanded && summary.rows.length > COLLAPSED_ROWS && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="mt-3 text-sm font-medium text-stone-600 hover:text-stone-800 hover:underline"
            >
              {t('renewal.showFewerRows')}
            </button>
          )}
        </>
      )}

      {/* 数据缺口：合计偏低 / 完全排不进清单，各说各的 */}
      {(summary.unknown_cost_count > 0 || summary.unknown_expiry_count > 0) && (
        <div className="mt-4 space-y-1.5 border-t border-stone-100 pt-4">
          {summary.unknown_cost_count > 0 && (
            <p className="flex items-start gap-2 text-xs text-stone-500">
              <CircleHelp className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
              <span>
                {t('renewal.upcomingUnknownCost').replace(
                  '{count}',
                  String(summary.unknown_cost_count)
                )}
              </span>
            </p>
          )}
          {summary.unknown_expiry_count > 0 && (
            <p className="flex items-start gap-2 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
              <span>
                {t('renewal.upcomingUnknownExpiry').replace(
                  '{count}',
                  String(summary.unknown_expiry_count)
                )}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
