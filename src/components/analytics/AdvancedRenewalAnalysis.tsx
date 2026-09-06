'use client';

import { useId, useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  Trophy,
} from 'lucide-react';
import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import { computeAdvancedRenewalPanelData } from '../../lib/renewalCostService';
import { formatCurrency } from '../../lib/financialCalculations';
import { UNKNOWN_REGISTRAR } from '../../lib/upcomingRenewals';
import { useI18nContext } from '../../contexts/I18nProvider';

interface AdvancedRenewalAnalysisProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

const PAST_YEARS = 2;
const FUTURE_YEARS = 3;

export default function AdvancedRenewalAnalysis({ domains, transactions }: AdvancedRenewalAnalysisProps) {
  const { t } = useI18nContext();
  // label/select 之前没有任何关联，读屏软件读不出这个下拉是干什么的
  const yearSelectId = useId();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // 数据派生：纯内存计算，切年份瞬秒，不再有 loading 态。
  // anchorYear 锚死在今年：年份下拉是一个固定窗口，不随选择整体平移。
  const { analysis, yearSummaries, coverage } = useMemo(
    () =>
      computeAdvancedRenewalPanelData(domains, transactions, selectedYear, {
        pastYears: PAST_YEARS,
        futureYears: FUTURE_YEARS,
        anchorYear: currentYear,
      }),
    [domains, transactions, selectedYear, currentYear]
  );

  const yearOptions = useMemo(() => {
    if (yearSummaries.length > 0) return yearSummaries.map((s) => s.year);
    return Array.from({ length: PAST_YEARS + FUTURE_YEARS + 1 }, (_, i) => currentYear - PAST_YEARS + i);
  }, [yearSummaries, currentYear]);

  const maxEstimated = useMemo(
    () => Math.max(1, ...yearSummaries.map((s) => s.total_estimated_cost)),
    [yearSummaries]
  );

  // 面板是否值得渲染，看的是**整个窗口**有没有续费信号，而不是选中年份——
  // 后者会让「选到一个空年份」把年份选择器本身也一起干掉，而子 tab 是 hidden
  // 保持挂载的，selectedYear 不会重置，用户除了刷新页面没有任何出路。
  // coverage.excluded > 0 也算有内容：有活跃域名只是资料没填全，这时候要给的是
  // 「N 个域名缺续费价」的提示，而不是一句无从下手的「暂无续费数据」。
  const hasAnyYearData = yearSummaries.some(
    (s) => s.total_estimated_cost > 0 || s.total_actual_cost > 0 || s.domains_needing_renewal > 0
  );
  const hasData = hasAnyYearData || coverage.excluded > 0;

  // 选中年份本身没有任何事件——面板照常渲染，只是用一句说明替掉 KPI 条。
  const selectedYearEmpty =
    analysis.total_estimated_cost === 0 &&
    analysis.total_actual_cost === 0 &&
    analysis.domains_needing_renewal === 0;

  if (!hasData) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-emerald-100 rounded-xl">
            <BarChart3 className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-stone-900">{t('renewal.advancedTitle')}</h3>
            <p className="text-sm text-stone-600">{t('renewal.noRenewalDataDesc')}</p>
          </div>
        </div>
        <div className="text-center py-8">
          <div className="inline-flex rounded-2xl bg-stone-50 p-4 border border-stone-100">
            <AlertTriangle className="h-12 w-12 text-stone-400" aria-hidden />
          </div>
          <p className="text-stone-600 mt-4">{t('renewal.noRenewalData')}</p>
        </div>
      </div>
    );
  }

  const outlookHint = t('renewal.outlookPastFuture')
    .replace('{past}', String(PAST_YEARS))
    .replace('{future}', String(FUTURE_YEARS));

  // Year temporal classifier — drives the outlook row color so past/current/
  // future read distinct at a glance: past=stone (history), current=amber
  // (in-progress), future=teal (planned). Selected gets a darker variant.
  const yearClass = (year: number): 'past' | 'current' | 'future' =>
    year < currentYear ? 'past' : year > currentYear ? 'future' : 'current';

  // 历史年的「预估」其实就是实际（服务层里 projected = 0，estimated ≡ actual）。
  const isPastYear = selectedYear < currentYear;

  const avgCostChange = analysis.cost_trends.average_cost_change;
  const hasTrendSample = analysis.cost_trends.trend_sample_size > 0;

  return (
    <div className="space-y-5">
      {/* Header card — title + year selector */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-stone-900">{t('renewal.advancedTitle')}</h3>
              <p className="mt-0.5 text-sm text-stone-500">{outlookHint}</p>
            </div>
          </div>
          <div className="flex flex-col gap-1 sm:items-end">
            <label
              htmlFor={yearSelectId}
              className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500"
            >
              {t('renewal.outlookSelectedYear')}
            </label>
            <select
              id={yearSelectId}
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 min-w-[7rem]"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Forecast coverage — year-independent, so it sits right under the header.
          Domains without a renewal cost or an expiry date produce no projected
          events at all, so they're silently absent from every number below.
          Saying so beats letting the user trust an estimate that's short. */}
      {coverage.excluded > 0 && (
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-900">
                {t('renewal.coverageWarning')
                  .replace('{count}', String(coverage.excluded))
                  .replace('{total}', String(coverage.total_active))}
              </p>
              <p className="mt-1 text-sm text-amber-800/90">
                {[
                  coverage.missing_cost > 0 &&
                    t('renewal.coverageMissingCost').replace('{count}', String(coverage.missing_cost)),
                  coverage.missing_expiry > 0 &&
                    t('renewal.coverageMissingExpiry').replace(
                      '{count}',
                      String(coverage.missing_expiry)
                    ),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="mt-1 text-xs text-amber-700/80">{t('renewal.coverageHint')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Selected year has no events at all — keep the whole panel (and the year
          selector) mounted and just say so, instead of collapsing to the global
          empty state the user can't navigate out of. */}
      {selectedYearEmpty ? (
        <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-6 text-center">
          <p className="text-sm text-stone-600">
            {t('renewal.noRenewalInYear').replace('{year}', String(selectedYear))}
          </p>
        </div>
      ) : (
        /* KPI strip — same gradient hero language as the rest of Insights.
           过去年的续费已经是既成事实（estimated ≡ actual），所以标签整组切换成
           过去时，也不再摆「待发生」——那一栏对历史年恒为 0，只会让人以为是数据缺失。 */
        <div className="relative overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-stone-50 via-white to-teal-50/40 shadow-sm">
          <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-gradient-to-br from-teal-100/30 to-transparent blur-3xl" />
          <div className="relative grid grid-cols-1 gap-5 p-5 sm:p-6 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
                <DollarSign className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  {isPastYear ? t('renewal.renewalSpend') : t('renewal.estimatedCost')} ({selectedYear})
                </p>
                <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-stone-900">
                  {formatCurrency(analysis.total_estimated_cost, 'USD')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <Calendar className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  {isPastYear ? t('renewal.domainsRenewed') : t('renewal.domainsToRenew')}
                </p>
                <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-stone-900">
                  {analysis.domains_needing_renewal}
                </p>
              </div>
            </div>

            {/* 已发生 / 待发生。服务层原本算了个 cost_accuracy 却没有任何消费方，
                「今年的续费预算已经走掉多少」这个最实用的数用户根本看不到。 */}
            {!isPastYear && (
              <>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                      {t('renewal.alreadySpent')}
                    </p>
                    <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-stone-900">
                      {formatCurrency(analysis.total_actual_cost, 'USD')}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500 tabular-nums">
                      {t('renewal.spentRatio').replace(
                        '{percent}',
                        (analysis.spent_ratio * 100).toFixed(0)
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
                    <Hourglass className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                      {t('renewal.remainingCost')}
                    </p>
                    <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-stone-900">
                      {formatCurrency(analysis.remaining_estimated_cost, 'USD')}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Annual outlook — temporal-coded list rows (past=stone / current=amber / future=teal) */}
      {yearSummaries.length > 0 && (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
          <h4 className="text-base font-semibold text-stone-900">{t('renewal.annualOutlook')}</h4>
          <p className="mt-1 text-sm text-stone-500">{t('renewal.annualOutlookDesc')}</p>

          <div className="hidden md:grid md:grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 px-3 pt-5 pb-2 border-b border-stone-100">
            <div className="col-span-2">{t('renewal.outlookYear')}</div>
            <div className="col-span-5">{t('renewal.outlookEstimated')}</div>
            <div className="col-span-2 text-right">{t('renewal.outlookActual')}</div>
            <div className="col-span-3 text-right">{t('renewal.outlookDomains')}</div>
          </div>

          <ul className="mt-3 space-y-2">
            {yearSummaries.map((row) => {
              const isSelected = row.year === selectedYear;
              const tc = yearClass(row.year);
              const barPct = (row.total_estimated_cost / maxEstimated) * 100;

              const rowClass = isSelected
                ? tc === 'current'
                  ? 'border-amber-200 bg-amber-50/60 ring-1 ring-amber-100'
                  : tc === 'future'
                    ? 'border-teal-200 bg-teal-50/60 ring-1 ring-teal-100'
                    : 'border-stone-200 bg-stone-50 ring-1 ring-stone-200/70'
                : tc === 'current'
                  ? 'border-amber-100/80 bg-amber-50/30'
                  : tc === 'future'
                    ? 'border-teal-100/80 bg-teal-50/30'
                    : 'border-stone-100 bg-stone-50/40';

              const barFillClass = isSelected
                ? tc === 'current'
                  ? 'bg-amber-500'
                  : tc === 'future'
                    ? 'bg-teal-600'
                    : 'bg-stone-700'
                : tc === 'current'
                  ? 'bg-amber-400'
                  : tc === 'future'
                    ? 'bg-teal-500'
                    : 'bg-stone-400';

              return (
                <li
                  key={row.year}
                  className={`rounded-xl border px-3 py-3 transition ${rowClass}`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 md:items-center gap-3">
                    <div className="md:col-span-2 flex items-center gap-2 flex-wrap">
                      <span className="text-base font-semibold text-stone-900 tabular-nums">{row.year}</span>
                      {isSelected && (
                        <span className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded ${
                          tc === 'current'
                            ? 'text-amber-700 bg-amber-100/80'
                            : tc === 'future'
                              ? 'text-teal-700 bg-teal-100/80'
                              : 'text-stone-700 bg-stone-200/80'
                        }`}>
                          {t('renewal.outlookSelectedYear')}
                        </span>
                      )}
                    </div>
                    <div className="md:col-span-5 min-w-0">
                      <div className="h-2.5 bg-stone-200/70 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barFillClass}`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-stone-800 tabular-nums">
                        {formatCurrency(row.total_estimated_cost, 'USD')}
                      </p>
                    </div>
                    <div className="md:col-span-2 text-sm font-medium text-stone-700 text-right tabular-nums">
                      <span className="md:hidden text-stone-500 mr-1">{t('renewal.outlookActual')}: </span>
                      {formatCurrency(row.total_actual_cost, 'USD')}
                    </div>
                    <div className="md:col-span-3 text-sm text-stone-600 text-right tabular-nums">
                      <span className="md:hidden text-stone-500 mr-1">{t('renewal.outlookDomains')}: </span>
                      {row.domains_needing_renewal}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Cost by registrar — bars use teal-600, more readable than gray */}
      {Object.keys(analysis.cost_by_registrar).length > 0 && (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
          <h4 className="text-base font-semibold text-stone-900 mb-4">{t('renewal.costByRegistrar')}</h4>
          <ul className="space-y-2.5">
            {Object.entries(analysis.cost_by_registrar)
              .sort(([, a], [, b]) => b - a)
              .map(([registrar, cost]) => {
                const percentage =
                  analysis.total_estimated_cost > 0 ? (cost / analysis.total_estimated_cost) * 100 : 0;
                return (
                  <li key={registrar} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-stone-700 truncate flex-1">
                      {registrar === UNKNOWN_REGISTRAR ? t('renewal.unknownRegistrar') : registrar}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-28 sm:w-36 bg-stone-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-teal-600 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-stone-900 w-20 text-right tabular-nums">
                        {formatCurrency(cost, 'USD')}
                      </span>
                    </div>
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {/* Cost trends — kept as a single panel with two side-by-side cards.
          Note: cost_trends is computed from explicit renew transactions only
          (archive renewals have no per-event price), so users who only fill
          renewal_count + renewal_cost without logging individual renew
          transactions will see all stats render as 0 or empty. That's a
          known data-availability constraint, not a bug here. */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
        <h4 className="text-base font-semibold text-stone-900 mb-4">{t('renewal.costTrends')}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 平均成本变动。样本 = 有 ≥2 笔逐笔续费记录的域名；只靠
              renewal_count + renewal_cost 记账的用户没有价格序列，这里必然无样本，
              所以显示「—」而不是一个看着像真读数的 0.0%。 */}
          <div
            className={`rounded-xl border p-4 ${
              hasTrendSample && avgCostChange > 0
                ? 'border-amber-100/80 bg-amber-50/60'
                : 'border-stone-100 bg-stone-50/60'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {hasTrendSample && avgCostChange < 0 ? (
                <TrendingDown className="h-4 w-4 text-emerald-700" />
              ) : (
                <TrendingUp
                  className={`h-4 w-4 ${
                    hasTrendSample && avgCostChange > 0 ? 'text-amber-700' : 'text-stone-500'
                  }`}
                />
              )}
              <span
                className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                  hasTrendSample && avgCostChange > 0 ? 'text-amber-700/80' : 'text-stone-500'
                }`}
              >
                {t('renewal.averageCostChange')}
              </span>
            </div>
            {!hasTrendSample ? (
              <>
                <p className="text-xl font-bold text-stone-400">—</p>
                <p className="mt-0.5 text-xs text-stone-500">{t('renewal.trendNoSample')}</p>
              </>
            ) : (
              <>
                <p
                  className={`text-xl font-bold tabular-nums ${
                    avgCostChange > 0
                      ? 'text-amber-800'
                      : avgCostChange < 0
                        ? 'text-emerald-800'
                        : 'text-stone-800'
                  }`}
                >
                  {avgCostChange > 0 ? '+' : ''}
                  {avgCostChange.toFixed(1)}%
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {t('renewal.trendSampleSize').replace(
                    '{count}',
                    String(analysis.cost_trends.trend_sample_size)
                  )}
                </p>
              </>
            )}
          </div>

          {/* 最贵域名：金额一律按「每年」口径，多年期续费不会被读成天价 */}
          <div className="rounded-xl border border-stone-100 bg-stone-50/60 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-4 w-4 text-stone-600" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                {t('renewal.mostExpensiveDomains')}
              </span>
            </div>
            {analysis.cost_trends.most_expensive_domains.length === 0 ? (
              <p className="mt-1 text-sm text-stone-400">—</p>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {analysis.cost_trends.most_expensive_domains.slice(0, 3).map((d) => (
                  <li key={d.name} className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-stone-800 truncate" title={d.name}>
                      {d.name}
                    </span>
                    <span className="text-sm text-stone-600 shrink-0 tabular-nums">
                      {t('renewal.perYear').replace(
                        '{amount}',
                        formatCurrency(d.cost_per_year, 'USD')
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Optimization opportunities — only renders if any */}
      {analysis.cost_trends.cost_optimization_opportunities.length > 0 && (
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/40 p-6">
          <h4 className="text-base font-semibold text-amber-900 mb-3">
            {t('renewal.optimizationOpportunities')}
          </h4>
          <ul className="space-y-2">
            {analysis.cost_trends.cost_optimization_opportunities.map((opportunity, index) => (
              <li
                key={`${index}-${opportunity.name}`}
                className="text-sm text-amber-900 flex items-start gap-2"
              >
                <span className="text-amber-600 shrink-0 mt-0.5">•</span>
                <span>
                  {t('renewal.opportunityItem')
                    .replace('{name}', opportunity.name)
                    .replace('{percent}', opportunity.variance.toFixed(1))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
