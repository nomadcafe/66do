'use client';

import React, { useMemo } from 'react';
import { calculateExpiredDomainLoss } from '../../lib/financialCalculations';
import { useI18nContext } from '../../contexts/I18nProvider';
import { TrendingDown, Hash, Scale, AlertTriangle, CheckCircle } from 'lucide-react';
import type { TransactionWithRequiredFields } from '../../types/transaction';

interface ExpiredDomainLossAnalysisProps {
  domains: Array<{
    id: string;
    domain_name: string;
    purchase_cost?: number | null;
    renewal_cost?: number | null;
    renewal_count: number;
    baseline_renewal_as_of?: string | null;
    status: string;
    expiry_date?: string | null;
    purchase_date?: string | null;
  }>;
  transactions?: TransactionWithRequiredFields[];
}

const STATUS_I18N_KEY: Record<string, string> = {
  active: 'common.active',
  for_sale: 'common.forSale',
  sold: 'common.sold',
  expired: 'common.expired',
};

export default function ExpiredDomainLossAnalysis({ domains, transactions = [] }: ExpiredDomainLossAnalysisProps) {
  const { t, locale } = useI18nContext();

  const lossAnalysis = useMemo(
    () => calculateExpiredDomainLoss(domains, transactions),
    [domains, transactions]
  );

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
        style: 'currency',
        currency: 'USD',
      }),
    [locale]
  );
  const formatCurrency = (amount: number) => currencyFormatter.format(amount);

  const statusLabel = (status: string) => {
    const key = STATUS_I18N_KEY[status];
    return key ? t(key) : status;
  };

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US'),
    [locale]
  );

  // thisYearLoss feeds the headline tile; averageLossPerDomain is now
  // always cumulative (no swap to "this year average" when current year
  // has data — fixed semantic so the label doesn't lie). thisYearCount
  // was used by the old swapping logic and is no longer needed.
  const { thisYearLoss, averageLossPerDomain } = useMemo(() => {
    const currentYear = new Date().getFullYear().toString();
    const tyLoss = lossAnalysis.annualLoss[currentYear] || 0;
    const avg =
      lossAnalysis.expiredDomains.length > 0
        ? lossAnalysis.totalLoss / lossAnalysis.expiredDomains.length
        : 0;
    return { thisYearLoss: tyLoss, averageLossPerDomain: avg };
  }, [lossAnalysis]);

  const statusCounts = useMemo(
    () =>
      domains.reduce((acc, domain) => {
        acc[domain.status] = (acc[domain.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    [domains]
  );

  if (lossAnalysis.expiredDomains.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-900">
                {t('analytics.expiredDomainLoss')}
              </h3>
              <p className="text-sm text-stone-600">{t('analytics.expiredDomainLossDesc')}</p>
            </div>
          </div>
        </div>

        <div className="text-center py-8">
          <div className="inline-flex rounded-2xl bg-emerald-50 p-4 mb-4">
            <CheckCircle className="h-14 w-14 text-emerald-500" aria-hidden />
          </div>
          <h4 className="text-xl font-semibold text-stone-900 mb-2">{t('analytics.noExpiredDomains')}</h4>
          <p className="text-stone-600 mb-6">{t('analytics.noExpiredDomainsDesc')}</p>

          <div className="bg-stone-50 rounded-xl p-4 max-w-md mx-auto border border-stone-100">
            <h5 className="text-sm font-medium text-stone-700 mb-3">{t('analytics.domainStatusStats')}</h5>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex justify-between">
                  <span className="text-stone-600">{statusLabel(status)}:</span>
                  <span className="font-medium text-stone-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasThisYearLoss = thisYearLoss > 0;

  return (
    <div className="space-y-5">
      {/* Header card — title + definition. Separate from KPI strip so the
          definition reads as preamble, not as a tile of its own. */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-stone-900">{t('analytics.expiredDomainLoss')}</h3>
            <p className="text-sm text-stone-600">{t('analytics.expiredDomainLossDesc')}</p>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-stone-50 border border-stone-100 px-3 py-2 text-xs leading-relaxed text-stone-500">
          {t('analytics.expiredLossDefinition')}
        </p>
      </div>

      {/* KPI strip — same gradient-hero language as the Insights tab top.
          Three fixed-semantic tiles: this-year loss / total expired count /
          cumulative avg per domain. Colored icon tiles signal severity:
          rose for loss, amber for count, stone for the neutral average. */}
      <div className="relative overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-stone-50 via-white to-rose-50/30 shadow-sm">
        <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-gradient-to-br from-rose-100/30 to-transparent blur-3xl" />
        <div className="relative grid grid-cols-1 gap-5 p-5 sm:p-6 md:grid-cols-3 md:gap-6">
          {/* Tile 1: This-year loss. When 0, render an em dash + hint so a
              prominent "$0.00" doesn't get misread as the headline number. */}
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              hasThisYearLoss ? 'bg-rose-100 text-rose-700' : 'bg-stone-100 text-stone-500'
            }`}>
              <TrendingDown className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                {t('analytics.thisYearTotalLoss')}
              </p>
              {hasThisYearLoss ? (
                <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-rose-700">
                  −{formatCurrency(thisYearLoss)}
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-stone-300">—</p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {t('analytics.cumulativeAverageHint')}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Tile 2: total expired count */}
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Hash className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                {t('analytics.expiredDomainsCount')}
              </p>
              <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-stone-900">
                {lossAnalysis.expiredDomains.length}
              </p>
            </div>
          </div>

          {/* Tile 3: cumulative average per domain — fixed semantic, no
              this-year/all-time context swap. The previous version flipped
              the metric meaning depending on data, which made the label
              misleading. Now always cumulative; if 0 expirations the
              previous 0-render branch already returned the empty state. */}
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
              <Scale className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                {t('analytics.averageLossPerDomain')}
              </p>
              <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-stone-900">
                {formatCurrency(averageLossPerDomain)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {lossAnalysis.lossByYear.length > 0 && (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
          <h4 className="text-base font-semibold text-stone-900 mb-4">{t('analytics.annualLossTrend')}</h4>
          <ul className="space-y-2">
            {lossAnalysis.lossByYear.map((yearData) => (
              <li
                key={yearData.year}
                className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/60 p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" aria-hidden />
                  <span className="font-medium text-stone-900 tabular-nums">
                    {yearData.year === 'unknown' ? t('analytics.lossYearUnknown') : yearData.year}
                  </span>
                  <span className="text-sm text-stone-500">
                    ({yearData.domainCount} {t('analytics.domains')})
                  </span>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-rose-700">
                  −{formatCurrency(yearData.loss)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
        <h4 className="text-base font-semibold text-stone-900 mb-4">{t('analytics.expiredDomainsDetails')}</h4>
        <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {lossAnalysis.expiredDomains.map((domain) => (
            <li
              key={domain.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/60 p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" aria-hidden />
                <span className="font-medium text-stone-900 truncate">{domain.domain_name}</span>
                <span className="text-sm text-stone-500 shrink-0 tabular-nums">
                  {domain.expiryDate
                    ? dateFormatter.format(new Date(domain.expiryDate))
                    : t('analytics.expiryDateMissing')}
                </span>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-rose-700">
                −{formatCurrency(domain.totalInvestment)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
