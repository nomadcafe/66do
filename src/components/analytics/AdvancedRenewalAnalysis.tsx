'use client';

import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Calendar, DollarSign, BarChart3, AlertTriangle } from 'lucide-react';
import { DomainWithTags } from '../../types/dashboard';
import { RenewalCostService, AnnualRenewalCostAnalysis, RenewalYearSummary } from '../../lib/renewalCostService';
import { formatCurrency } from '../../lib/financialCalculations';
import { useI18nContext } from '../../contexts/I18nProvider';

interface AdvancedRenewalAnalysisProps {
  domains: DomainWithTags[];
}

const PAST_YEARS = 2;
const FUTURE_YEARS = 3;

export default function AdvancedRenewalAnalysis({ domains }: AdvancedRenewalAnalysisProps) {
  const { t } = useI18nContext();
  const [analysis, setAnalysis] = useState<AnnualRenewalCostAnalysis | null>(null);
  const [yearSummaries, setYearSummaries] = useState<RenewalYearSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const loadAnalysis = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const { analysis: data, yearSummaries: summaries } =
          await RenewalCostService.getAdvancedRenewalPanelData(domains, selectedYear, {
            pastYears: PAST_YEARS,
            futureYears: FUTURE_YEARS,
          });
        setAnalysis(data);
        setYearSummaries(summaries);
      } catch (error) {
        console.error('Error loading renewal analysis:', error);
        // 之前失败会静默走 "!analysis" 分支，被当成"暂无续费数据"，用户
        // 以为自己没数据。换成显式的 loadError 状态再区分。
        setLoadError(true);
        setAnalysis(null);
        setYearSummaries([]);
      } finally {
        setLoading(false);
      }
    };

    loadAnalysis();
  }, [selectedYear, domains]);

  const yearOptions = useMemo(() => {
    if (yearSummaries.length > 0) return yearSummaries.map((s) => s.year);
    const y = new Date().getFullYear();
    return Array.from({ length: PAST_YEARS + FUTURE_YEARS + 1 }, (_, i) => y - PAST_YEARS + i);
  }, [yearSummaries]);

  const maxEstimated = useMemo(
    () => Math.max(1, ...yearSummaries.map((s) => s.total_estimated_cost)),
    [yearSummaries]
  );

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-stone-200 rounded w-1/4 mb-4" />
          <div className="space-y-3">
            <div className="h-3 bg-stone-200 rounded" />
            <div className="h-3 bg-stone-200 rounded w-5/6" />
            <div className="h-3 bg-stone-200 rounded w-4/6" />
          </div>
        </div>
        <p className="text-sm text-stone-500 mt-4">{t('renewal.loadingAnalysis')}</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-xl">
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
          </div>
          <div>
            <h3 className="text-base font-semibold text-stone-900">{t('renewal.advancedTitle')}</h3>
            <p className="text-sm text-stone-600 mt-1">{t('renewal.loadFailed')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6">
        <p className="text-stone-500">{t('renewal.noRenewalData')}</p>
      </div>
    );
  }

  const hasData =
    analysis.domains_needing_renewal > 0 ||
    analysis.total_estimated_cost > 0 ||
    Object.keys(analysis.cost_by_registrar).length > 0;

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

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-stone-600" />
            {t('renewal.advancedTitle')}
          </h3>
          <p className="text-sm text-stone-500 mt-1">{outlookHint}</p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-1">
          <label className="text-xs font-medium text-stone-500">{t('renewal.outlookSelectedYear')}</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="px-3 py-2 border border-stone-200 rounded-xl text-sm text-stone-900 bg-white focus:ring-2 focus:ring-stone-400 focus:border-stone-400 min-w-[7rem]"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-stone-600" />
            <div>
              <p className="text-sm font-medium text-stone-600">
                {t('renewal.estimatedCost')} ({selectedYear})
              </p>
              <p className="text-2xl font-bold text-stone-900">
                {formatCurrency(analysis.total_estimated_cost, 'USD')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-teal-50/80 rounded-xl p-4 border border-teal-100/80">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-teal-600" />
            <div>
              <p className="text-sm font-medium text-teal-700">{t('renewal.domainsToRenew')}</p>
              <p className="text-2xl font-bold text-teal-900">{analysis.domains_needing_renewal}</p>
            </div>
          </div>
        </div>

        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-stone-600" />
            <div>
              <p className="text-sm font-medium text-stone-600">{t('renewal.accuracy')}</p>
              {/* `cost_accuracy` 的原公式 `(1 - |est-act|/act) * 100` 在
                  实际值极小但预估偏高时会输出 -300% 之类的负数。UI 层夹到
                  [0, 100]，当年没有实际续费记录时直接显示"暂无记录"。 */}
              <p className="text-2xl font-bold text-stone-900">
                {analysis.total_actual_cost > 0
                  ? `${Math.max(0, Math.min(100, analysis.cost_accuracy)).toFixed(1)}%`
                  : t('renewal.accuracyNoData')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {yearSummaries.length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-stone-900 mb-1">{t('renewal.annualOutlook')}</h4>
          <p className="text-sm text-stone-500 mb-4">{t('renewal.annualOutlookDesc')}</p>

          <div className="hidden md:grid md:grid-cols-12 gap-2 text-xs font-medium text-stone-500 uppercase tracking-wide px-3 pb-2 border-b border-stone-100">
            <div className="col-span-2">{t('renewal.outlookYear')}</div>
            <div className="col-span-5">{t('renewal.outlookEstimated')}</div>
            <div className="col-span-2 text-right">{t('renewal.outlookActual')}</div>
            <div className="col-span-3 text-right">{t('renewal.outlookDomains')}</div>
          </div>

          <ul className="space-y-2">
            {yearSummaries.map((row) => {
              const isSelected = row.year === selectedYear;
              const barPct = (row.total_estimated_cost / maxEstimated) * 100;
              return (
                <li
                  key={row.year}
                  className={`rounded-xl border px-3 py-3 transition ${
                    isSelected
                      ? 'border-teal-200 bg-teal-50/50 ring-1 ring-teal-100'
                      : 'border-stone-100 bg-stone-50/40'
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 md:items-center gap-3">
                    <div className="md:col-span-2 flex items-center gap-2 flex-wrap">
                      <span className="text-base font-semibold text-stone-900">{row.year}</span>
                      {isSelected && (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-md">
                          {t('renewal.outlookSelectedYear')}
                        </span>
                      )}
                    </div>
                    <div className="md:col-span-5 min-w-0">
                      <div className="h-2.5 bg-stone-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isSelected ? 'bg-teal-600' : 'bg-stone-500'}`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <p className="text-sm font-medium text-stone-800 mt-1.5 md:hidden">
                        {formatCurrency(row.total_estimated_cost, 'USD')}
                      </p>
                      <p className="hidden md:block text-sm font-medium text-stone-800 mt-1.5">
                        {formatCurrency(row.total_estimated_cost, 'USD')}
                      </p>
                    </div>
                    <div className="md:col-span-2 text-sm font-medium text-stone-700 text-right">
                      <span className="md:hidden text-stone-500 mr-1">{t('renewal.outlookActual')}: </span>
                      {formatCurrency(row.total_actual_cost, 'USD')}
                    </div>
                    <div className="md:col-span-3 text-sm text-stone-600 text-right">
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

      {Object.keys(analysis.cost_by_registrar).length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-stone-900 mb-4">{t('renewal.costByRegistrar')}</h4>
          <div className="space-y-2">
            {Object.entries(analysis.cost_by_registrar)
              .sort(([, a], [, b]) => b - a)
              .map(([registrar, cost]) => {
                const percentage =
                  analysis.total_estimated_cost > 0 ? (cost / analysis.total_estimated_cost) * 100 : 0;
                return (
                  <div key={registrar} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-stone-700 truncate">{registrar}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-24 bg-stone-200 rounded-full h-2">
                        <div
                          className="bg-stone-500 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-stone-900 w-20 text-right">
                        {formatCurrency(cost, 'USD')}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h4 className="text-md font-semibold text-stone-900 mb-4">{t('renewal.costTrends')}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-amber-50/80 rounded-xl p-4 border border-amber-100/80">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-900">{t('renewal.averageCostIncrease')}</span>
            </div>
            <p className="text-lg font-bold text-amber-800">
              {analysis.cost_trends.average_cost_increase.toFixed(1)}%
            </p>
          </div>

          <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-5 w-5 text-stone-600" />
              <span className="text-sm font-medium text-stone-800">{t('renewal.mostExpensiveDomains')}</span>
            </div>
            <div className="space-y-1">
              {analysis.cost_trends.most_expensive_domains.slice(0, 3).map((name) => (
                <p key={name} className="text-sm text-stone-700 truncate" title={name}>
                  {name}
                </p>
              ))}
              {analysis.cost_trends.most_expensive_domains.length === 0 && (
                <p className="text-sm text-stone-500">—</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {analysis.cost_trends.cost_optimization_opportunities.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-stone-900 mb-4">{t('renewal.optimizationOpportunities')}</h4>
          <div className="bg-amber-50/80 rounded-xl p-4 border border-amber-100/80">
            <ul className="space-y-2">
              {analysis.cost_trends.cost_optimization_opportunities.map((opportunity, index) => (
                <li
                  key={`${index}-${opportunity.slice(0, 30)}`}
                  className="text-sm text-amber-900 flex items-start gap-2"
                >
                  <span className="text-amber-600 shrink-0">•</span>
                  <span>{opportunity}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
