'use client';

import {
  LazyFinancialAnalysis,
  LazyInvestmentAnalytics,
  LazyAdvancedRenewalAnalysis,
  LazyExpiredDomainLossAnalysis,
  LazyWrapper,
} from '../LazyComponents';
import {
  formatRenewalCycleDistributionLabel,
} from '../../lib/renewalCalculations';
import type { AnnualRenewalCost } from '../../lib/renewalCalculations';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

interface InsightsTabProps {
  domains: DomainWithTags[];
  /** 与项目数据源约定一致：所有指标/图表都用 transactionsForMetrics（去重后的版本） */
  transactionsForMetrics: TransactionWithRequiredFields[];
  renewalAnalysis: AnnualRenewalCost;
  locale: 'zh' | 'en';
  t: (key: string) => string;
  formatCurrency: (n: number, currency?: string) => string;
}

/**
 * Insights tab on the dashboard. Stack of lazy-loaded analytical
 * components plus a static Renewal Overview card.
 *
 * Card order is intentional:
 *   1) Financial Analysis  — overview (KPIs + Snapshot + recommendations)
 *   2) Investment Analytics — drill-down charts / distributions / trends
 *   3) Renewal Overview     — light counts (need / no-need + cycle dist)
 *   4) Advanced Renewal     — annual forecast (deep)
 *   5) Expired Domain Loss  — failure cases at the bottom
 *
 * Earlier the order put the light renewal block first and split the two
 * renewal sections with Investment Analytics in between, which broke
 * both "overview → detail" and "keep related sections adjacent". Don't
 * reorder these without rereading that comment.
 */
export default function InsightsTab({
  domains,
  transactionsForMetrics,
  renewalAnalysis,
  locale,
  t,
  formatCurrency,
}: InsightsTabProps) {
  return (
    <div className="space-y-6">
      <LazyWrapper>
        <LazyFinancialAnalysis
          domains={domains}
          transactions={transactionsForMetrics}
        />
      </LazyWrapper>

      <LazyWrapper>
        <LazyInvestmentAnalytics
          domains={domains}
          transactions={transactionsForMetrics}
        />
      </LazyWrapper>

      {/* Renewal Overview — light KPIs only.
          Intentionally NO "this year estimated cost" / "average per domain":
            - The first conflicts with Advanced Renewal Analysis's
              regression-based estimate (different methodology, same label).
            - The second's denominator only counts domains that need renewal,
              so the label "average per domain" misleads. */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-stone-900 mb-4">{t('renewal.analysis')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
            <p className="text-xs font-medium text-stone-500">{t('renewal.needRenewal')}</p>
            <p className="text-xl font-bold text-teal-700 mt-1">
              {renewalAnalysis.domainsNeedingRenewal.length}
            </p>
          </div>
          <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
            <p className="text-xs font-medium text-stone-500">{t('renewal.noRenewal')}</p>
            <p className="text-xl font-bold text-stone-900 mt-1">
              {renewalAnalysis.domainsNotNeedingRenewal.length}
            </p>
          </div>
        </div>
        {Object.keys(renewalAnalysis.costByCycle).length > 0 && (
          <div className="mt-5 pt-4 border-t border-stone-100">
            <h4 className="text-sm font-medium text-stone-700 mb-3">
              {t('renewal.cycleDistribution')}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(renewalAnalysis.costByCycle).map(([cycle, cost]) => (
                <div key={cycle} className="bg-stone-50 rounded-lg p-3">
                  <p className="text-xs text-stone-500">
                    {formatRenewalCycleDistributionLabel(cycle, locale, t)}
                  </p>
                  <p className="text-base font-semibold text-stone-900">
                    {formatCurrency(cost, 'USD')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <LazyWrapper>
        <LazyAdvancedRenewalAnalysis
          domains={domains}
          transactions={transactionsForMetrics}
        />
      </LazyWrapper>

      <LazyWrapper>
        <LazyExpiredDomainLossAnalysis
          domains={domains}
          transactions={transactionsForMetrics}
        />
      </LazyWrapper>
    </div>
  );
}
