'use client';

import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import { DollarSign, TrendingUp, Target, Trophy, CheckCircle, XCircle } from 'lucide-react';
import { useComprehensiveFinancialAnalysis } from '../../hooks/useFinancialCalculations';
import { useI18nContext } from '../../contexts/I18nProvider';

interface FinancialAnalysisProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

export default function FinancialAnalysis({ domains, transactions }: FinancialAnalysisProps) {
  const { t } = useI18nContext();

  const financialAnalysis = useComprehensiveFinancialAnalysis(domains, transactions);
  const { basic, advanced, domainPerformance } = financialAnalysis;

  const recommendationKeys: Array<'negativeRoi' | 'lowWinRate' | 'longHolding' | 'performingWell'> = [];
  if (basic.roi < 0) recommendationKeys.push('negativeRoi');
  if (advanced.winRate < 50) recommendationKeys.push('lowWinRate');
  if (advanced.avgHoldingPeriod > 365) recommendationKeys.push('longHolding');
  if (recommendationKeys.length === 0) recommendationKeys.push('performingWell');

  const activeDomains = domains.filter((d) => d.status === 'active').length;
  const soldDomains = domains.filter((d) => d.status === 'sold').length;
  const topPerformers = [...domainPerformance]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);

  const pnlColor = (value: number) => (value >= 0 ? 'text-emerald-600' : 'text-red-600');

  const perfIcon = (roi: number) => {
    if (roi > 50) return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    if (roi > 0) return <Target className="h-5 w-5 text-amber-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const formatUSD = (n: number) =>
    n < 0 ? `-$${Math.abs(n).toLocaleString()}` : `$${n.toLocaleString()}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-stone-900">{t('reports.financialAnalysis')}</h2>
        <p className="text-sm text-stone-500 mt-1">{t('reports.advancedPortfolioAnalysis')}</p>
      </div>

      {/* Top KPIs -- 4 cells, aligned with the other Insights panels */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCell
            icon={<DollarSign className="h-5 w-5 text-stone-400" />}
            label={t('reports.totalInvestment')}
            value={formatUSD(basic.totalInvestment)}
          />
          <KpiCell
            icon={<TrendingUp className="h-5 w-5 text-stone-400" />}
            label={t('reports.totalRevenue')}
            value={formatUSD(basic.totalRevenue)}
          />
          <KpiCell
            icon={<Target className="h-5 w-5 text-stone-400" />}
            label={t('reports.roi')}
            value={`${basic.roi >= 0 ? '+' : ''}${basic.roi.toFixed(1)}%`}
            valueClass={pnlColor(basic.roi)}
          />
          <KpiCell
            icon={<Trophy className="h-5 w-5 text-stone-400" />}
            label={t('analytics.winRate')}
            value={`${advanced.winRate.toFixed(1)}%`}
            valueClass={
              advanced.winRate >= 50
                ? 'text-emerald-600'
                : advanced.winRate >= 30
                ? 'text-amber-600'
                : 'text-red-600'
            }
          />
        </div>
      </div>

      {/* Portfolio snapshot + Recommendations (two columns). Dedupes ROI/Win
          Rate that are already in the top KPIs -- this panel now carries
          only the fields the top row doesn't. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-stone-900 mb-4">
            {t('reports.portfolioSnapshot')}
          </h3>
          <div className="space-y-3">
            <SnapshotRow
              label={t('reports.averageHoldingPeriod')}
              value={`${Math.round(advanced.avgHoldingPeriod)}${t('analytics.daysUnit')}`}
            />
            <SnapshotRow
              label={t('reports.activeDomains')}
              value={String(activeDomains)}
            />
            <SnapshotRow
              label={t('reports.soldDomains')}
              value={String(soldDomains)}
            />
            <SnapshotRow
              label={t('reports.bestPerforming')}
              value={advanced.bestPerformingDomain || '—'}
              valueClass="font-medium text-stone-900 truncate max-w-[180px]"
            />
            <SnapshotRow
              label={t('reports.worstPerforming')}
              value={advanced.worstPerformingDomain || '—'}
              valueClass="font-medium text-stone-900 truncate max-w-[180px]"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-stone-900 mb-4">
            {t('reports.recommendations')}
          </h3>
          <div className="space-y-3">
            {recommendationKeys.map((key) => (
              <div key={key} className="flex items-start gap-3 p-3 bg-teal-50/60 border border-teal-100 rounded-xl">
                <div className="flex-shrink-0 w-1.5 h-1.5 bg-teal-600 rounded-full mt-2" />
                <p className="text-sm text-stone-700 leading-relaxed">{t(`reports.rec.${key}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top performing domains */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-stone-900 mb-4">
          {t('reports.topPerformers')}
        </h3>
        {topPerformers.length === 0 ? (
          <p className="text-sm text-stone-500">{t('reports.topPerformersEmpty')}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {topPerformers.map((item) => (
              <li
                key={item.domain.id}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {perfIcon(item.roi)}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">
                      {item.domain.domain_name}
                    </p>
                    <p className="text-xs text-stone-500">
                      {t('reports.roi')}:{' '}
                      <span className={pnlColor(item.roi)}>
                        {item.roi >= 0 ? '+' : ''}
                        {item.roi.toFixed(1)}%
                      </span>
                    </p>
                  </div>
                </div>
                <p className={`text-sm font-semibold ${pnlColor(item.profit)}`}>
                  {formatUSD(item.profit)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function KpiCell({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl bg-stone-50 border border-stone-100 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-stone-500">{label}</p>
        {icon}
      </div>
      <p className={`text-xl font-bold mt-1 ${valueClass ?? 'text-stone-900'}`}>{value}</p>
    </div>
  );
}

function SnapshotRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-stone-600">{label}</span>
      <span className={`text-sm ${valueClass ?? 'font-semibold text-stone-900'}`}>{value}</span>
    </div>
  );
}
