'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Calendar, DollarSign, BarChart3, AlertTriangle } from 'lucide-react';
import { DomainWithTags } from '../../types/dashboard';
import { RenewalCostService, AnnualRenewalCostAnalysis } from '../../lib/renewalCostService';
import { formatCurrency } from '../../lib/financialCalculations';
import { useI18nContext } from '../../contexts/I18nProvider';

interface AdvancedRenewalAnalysisProps {
  domains: DomainWithTags[];
}

const MONTH_KEYS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export default function AdvancedRenewalAnalysis({ domains }: AdvancedRenewalAnalysisProps) {
  const { t } = useI18nContext();
  const [analysis, setAnalysis] = useState<AnnualRenewalCostAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const loadAnalysis = async () => {
      setLoading(true);
      try {
        const analysisData = await RenewalCostService.calculateAnnualRenewalCostAnalysisFromDomains(
          domains,
          selectedYear
        );
        setAnalysis(analysisData);
      } catch (error) {
        console.error('Error loading renewal analysis:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalysis();
  }, [selectedYear, domains]);

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

  const costByMonth = analysis.cost_by_month ?? {};
  const maxMonthlyCost = Math.max(0, ...Object.values(costByMonth));

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-stone-600" />
          {t('renewal.advancedTitle')} – {selectedYear}
        </h3>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          className="px-3 py-2 border border-stone-200 rounded-xl text-sm text-stone-900 bg-white focus:ring-2 focus:ring-stone-400 focus:border-stone-400"
        >
          {Array.from({ length: 5 }, (_, i) => {
            const year = new Date().getFullYear() + i;
            return (
              <option key={year} value={year}>
                {year}
              </option>
            );
          })}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-stone-600" />
            <div>
              <p className="text-sm font-medium text-stone-600">{t('renewal.estimatedCost')}</p>
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
              <p className="text-2xl font-bold text-stone-900">{analysis.cost_accuracy.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="text-md font-semibold text-stone-900 mb-4">{t('renewal.monthlyDistribution')}</h4>
        <div className="grid grid-cols-12 gap-2">
          {MONTH_KEYS.map((month, index) => {
            const cost = costByMonth[index.toString()] ?? 0;
            const height = maxMonthlyCost > 0 ? (cost / maxMonthlyCost) * 100 : 0;
            return (
              <div key={month} className="text-center">
                <div className="bg-stone-100 rounded-t-lg h-24 flex items-end">
                  <div
                    className="bg-stone-500 w-full rounded-t-lg transition-all duration-300"
                    style={{ height: `${height}%` }}
                  />
                </div>
                <p className="text-xs text-stone-500 mt-1">{month}</p>
                <p className="text-xs font-medium text-stone-700">{formatCurrency(cost, 'USD')}</p>
              </div>
            );
          })}
        </div>
      </div>

      {Object.keys(analysis.cost_by_registrar).length > 0 && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-stone-900 mb-4">{t('renewal.costByRegistrar')}</h4>
          <div className="space-y-2">
            {Object.entries(analysis.cost_by_registrar)
              .sort(([, a], [, b]) => b - a)
              .map(([registrar, cost]) => {
                const percentage =
                  analysis.total_estimated_cost > 0
                    ? (cost / analysis.total_estimated_cost) * 100
                    : 0;
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
                <li key={`${index}-${opportunity.slice(0, 30)}`} className="text-sm text-amber-900 flex items-start gap-2">
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
