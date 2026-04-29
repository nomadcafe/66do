'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { TrendingUp, Award, Target, Clock } from 'lucide-react';
import {
  LazyFinancialAnalysis,
  LazyInvestmentAnalytics,
  LazyAdvancedRenewalAnalysis,
  LazyExpiredDomainLossAnalysis,
  LazyYearlyCashflowTable,
  LazyWrapper,
} from '../LazyComponents';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import { totalRealizedPnL, insightsKPISummary } from '../../lib/realizedPnL';

interface InsightsTabProps {
  domains: DomainWithTags[];
  transactionsForMetrics: TransactionWithRequiredFields[];
  t: (key: string) => string;
  formatCurrency: (n: number, currency?: string) => string;
}

type InsightsSubTab = 'performance' | 'renewals' | 'loss';
const VALID_SUB_TABS: readonly InsightsSubTab[] = ['performance', 'renewals', 'loss'] as const;

/**
 * Insights tab — completely restructured from the old "5 deep panels stacked
 * vertically" layout into:
 *
 *   [ KPI strip — 4 trade-performance metrics in a gradient hero strip ]
 *   [ Sub-tab nav — Performance / Renewals / Loss (segmented control)  ]
 *   [ Tab-scoped content                                                ]
 *
 * The KPI strip provides anchoring context that survives no matter which
 * sub-tab is active (you can scan "Realized P&L $X · Win rate Y%" while
 * looking at any deep panel below). The sub-tabs replace the old infinite
 * scroll, so the user reaches Loss analysis in 1 click instead of 5 scroll
 * pages.
 *
 * Sub-tab state lives in `?ins=` (separate from the outer `?tab=insights`).
 */
export default function InsightsTab({
  domains,
  transactionsForMetrics,
  t,
  formatCurrency,
}: InsightsTabProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawIns = searchParams.get('ins');
  const subTabFromUrl: InsightsSubTab =
    (VALID_SUB_TABS as readonly string[]).includes(rawIns ?? '')
      ? (rawIns as InsightsSubTab)
      : 'performance';

  // 跟主 tab 同样的 perf 模式（参见 9c44603）：activeSubTab 走 React state，
  // 点击秒响应；URL sync fire-and-forget。visited Set 让访问过的子 tab 保
  // 持挂载（hidden 隐藏），第二次切回不重新挂 lazy 组件 + 不重跑重型 useMemo。
  const [activeSubTab, setActiveSubTabState] = useState<InsightsSubTab>(subTabFromUrl);
  const [visited, setVisited] = useState<Set<InsightsSubTab>>(() => new Set([subTabFromUrl]));

  // 浏览器前进/后退或外部链接 → URL 变 → state 同步过去
  useEffect(() => {
    if (subTabFromUrl !== activeSubTab) {
      setActiveSubTabState(subTabFromUrl);
      setVisited((prev) => (prev.has(subTabFromUrl) ? prev : new Set([...prev, subTabFromUrl])));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTabFromUrl]);

  const setSubTab = useCallback((next: InsightsSubTab) => {
    setActiveSubTabState(next);
    setVisited((prev) => (prev.has(next) ? prev : new Set([...prev, next])));
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'performance') params.delete('ins');
    else params.set('ins', next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  // ── KPI computations ────────────────────────────────────────────────
  const realizedPnL = useMemo(
    () => totalRealizedPnL(domains, transactionsForMetrics),
    [domains, transactionsForMetrics]
  );
  const kpis = useMemo(
    () => insightsKPISummary(domains, transactionsForMetrics),
    [domains, transactionsForMetrics]
  );

  const formatHolding = (days: number) => {
    if (days < 60) return `${days} ${t('insights.kpiDays')}`;
    const months = Math.round(days / 30);
    return `${months} ${t('insights.kpiMonths')}`;
  };

  const pnlPositive = realizedPnL > 0;
  const pnlNegative = realizedPnL < 0;
  const pnlSign = pnlPositive ? '+' : pnlNegative ? '−' : '';
  const pnlColor = pnlPositive
    ? 'text-emerald-600'
    : pnlNegative
      ? 'text-rose-600'
      : 'text-stone-900';

  // ── Sub-tab pill class ──────────────────────────────────────────────
  const pillClass = (tab: InsightsSubTab) =>
    `rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
      activeSubTab === tab
        ? 'bg-white text-stone-900 shadow-sm'
        : 'text-stone-500 hover:text-stone-900'
    }`;

  return (
    <div className="space-y-6">
      {/* ────── KPI strip — gradient hero, 4 trade-performance metrics ────── */}
      <div className="relative overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-stone-50 via-white to-teal-50/40 shadow-sm">
        <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-gradient-to-br from-teal-100/40 to-transparent blur-3xl" />
        <div className="relative grid grid-cols-2 gap-4 p-5 sm:p-6 lg:grid-cols-4 lg:gap-6">
          {/* Realized P&L */}
          <div className="flex items-start gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                pnlPositive
                  ? 'bg-emerald-50 text-emerald-700'
                  : pnlNegative
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-stone-100 text-stone-700'
              }`}
            >
              <TrendingUp className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                {t('insights.kpiRealizedPnL')}
              </p>
              <p className={`mt-1 text-xl font-bold tracking-tight tabular-nums ${pnlColor}`}>
                {pnlSign}
                {formatCurrency(Math.abs(realizedPnL), 'USD')}
              </p>
            </div>
          </div>

          {/* Best Sale */}
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Award className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                {t('insights.kpiBestSale')}
              </p>
              {kpis.bestSale ? (
                <>
                  <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-stone-900">
                    +{formatCurrency(kpis.bestSale.amount, 'USD')}
                  </p>
                  {kpis.bestSale.domainName && (
                    <p className="mt-0.5 truncate text-xs text-stone-500" title={kpis.bestSale.domainName}>
                      {kpis.bestSale.domainName}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-xl font-bold tracking-tight text-stone-300">—</p>
              )}
            </div>
          </div>

          {/* Win Rate */}
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Target className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                {t('insights.kpiWinRate')}
              </p>
              {kpis.winRate ? (
                <>
                  <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-stone-900">
                    {kpis.winRate.percent.toFixed(0)}%
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500 tabular-nums">
                    {t('insights.kpiWinRateBreakdown')
                      .replace('{wins}', String(kpis.winRate.wins))
                      .replace('{total}', String(kpis.winRate.total))}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xl font-bold tracking-tight text-stone-300">—</p>
              )}
            </div>
          </div>

          {/* Avg Holding Period */}
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <Clock className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                {t('insights.kpiAvgHolding')}
              </p>
              {kpis.avgHoldingDays !== null ? (
                <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-stone-900">
                  {formatHolding(kpis.avgHoldingDays)}
                </p>
              ) : (
                <p className="mt-1 text-xl font-bold tracking-tight text-stone-300">—</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ────── Sub-tab nav (segmented control) ────── */}
      <div className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-100/80 p-1">
        <button
          type="button"
          onClick={() => setSubTab('performance')}
          aria-pressed={activeSubTab === 'performance'}
          className={pillClass('performance')}
        >
          {t('insights.subTabPerformance')}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('renewals')}
          aria-pressed={activeSubTab === 'renewals'}
          className={pillClass('renewals')}
        >
          {t('insights.subTabRenewals')}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('loss')}
          aria-pressed={activeSubTab === 'loss'}
          className={pillClass('loss')}
        >
          {t('insights.subTabLoss')}
        </button>
      </div>

      {/* ────── Tab content — visited sub-tabs stay mounted (hidden when
          inactive) so subsequent switches are instant CSS toggle instead
          of full remount + lazy reload + heavy useMemo recompute. ────── */}
      {visited.has('performance') && (
        <div className="space-y-6" hidden={activeSubTab !== 'performance'}>
          <LazyWrapper>
            <LazyFinancialAnalysis domains={domains} transactions={transactionsForMetrics} />
          </LazyWrapper>
          <LazyWrapper>
            <LazyInvestmentAnalytics domains={domains} transactions={transactionsForMetrics} />
          </LazyWrapper>
          <LazyWrapper>
            <LazyYearlyCashflowTable domains={domains} transactions={transactionsForMetrics} />
          </LazyWrapper>
        </div>
      )}

      {visited.has('renewals') && (
        <div className="space-y-6" hidden={activeSubTab !== 'renewals'}>
          <LazyWrapper>
            <LazyAdvancedRenewalAnalysis domains={domains} transactions={transactionsForMetrics} />
          </LazyWrapper>
        </div>
      )}

      {visited.has('loss') && (
        <div className="space-y-6" hidden={activeSubTab !== 'loss'}>
          <LazyWrapper>
            <LazyExpiredDomainLossAnalysis
              domains={domains}
              transactions={transactionsForMetrics}
            />
          </LazyWrapper>
        </div>
      )}
    </div>
  );
}
