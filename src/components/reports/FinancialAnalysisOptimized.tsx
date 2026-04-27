'use client';

import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import { DollarSign, TrendingUp, Target, Wallet, CheckCircle, XCircle } from 'lucide-react';
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

  const activeDomains = domains.filter((d) => d.status === 'active').length;
  const soldDomains = domains.filter((d) => d.status === 'sold').length;

  // 已售域名的表现榜：原来排序的是全部 domains（含持有中），持有中域名 profit
  // 永远 ≤ 0（无收入抵成本），会把"未实现亏损"和"已实现盈利"混在一张榜里。
  const soldPerformance = domainPerformance.filter((p) => p.domain.status === 'sold');
  const topPerformers = [...soldPerformance]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);
  const bestPerformer = soldPerformance.length > 0
    ? soldPerformance.reduce((b, c) => (c.roi > b.roi ? c : b))
    : null;
  const worstPerformer = soldPerformance.length > 0
    ? soldPerformance.reduce((w, c) => (c.roi < w.roi ? c : w))
    : null;

  const pnlColor = (value: number) => (value >= 0 ? 'text-emerald-700' : 'text-red-600');

  const perfIcon = (roi: number) => {
    if (roi > 50) return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    if (roi > 0) return <Target className="h-5 w-5 text-amber-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const formatUSD = (n: number) =>
    n < 0 ? `-$${Math.abs(n).toLocaleString()}` : `$${n.toLocaleString()}`;

  // days → 自适应：< 30 天显示天，< 365 显示月，>= 365 显示年（保留 1 位）。
  // 域名持有期常以"年"为单位，原先一律显示 "1247 days" 阅读体验差。
  const formatHoldingPeriod = (days: number): string => {
    if (days <= 0) return `0${t('analytics.daysUnit')}`;
    if (days < 30) return `${Math.round(days)}${t('analytics.daysUnit')}`;
    if (days < 365) return `${Math.round(days / 30)}${t('reports.monthsUnit')}`;
    return `${(days / 365).toFixed(1)}${t('reports.yearsUnit')}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-900 mb-4">{t('reports.financialAnalysis')}</h2>
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
            icon={<Wallet className="h-5 w-5 text-stone-400" />}
            label={t('reports.totalProfit')}
            value={formatUSD(basic.totalProfit)}
            valueClass={pnlColor(basic.totalProfit)}
          />
          <KpiCell
            icon={<Target className="h-5 w-5 text-stone-400" />}
            label={t('reports.roi')}
            value={`${basic.roi >= 0 ? '+' : ''}${basic.roi.toFixed(1)}%`}
            valueClass={pnlColor(basic.roi)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-stone-900 mb-4">
          {t('reports.portfolioSnapshot')}
        </h3>
        <div className="space-y-3">
          <SnapshotRow
            label={t('reports.averageHoldingPeriod')}
            value={advanced.avgHoldingPeriod > 0 ? formatHoldingPeriod(advanced.avgHoldingPeriod) : '—'}
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
            value={
              bestPerformer
                ? `${bestPerformer.domain.domain_name} (${bestPerformer.roi >= 0 ? '+' : ''}${bestPerformer.roi.toFixed(1)}%)`
                : '—'
            }
            valueClass={`font-medium truncate max-w-[220px] ${bestPerformer ? pnlColor(bestPerformer.roi) : 'text-stone-900'}`}
          />
          <SnapshotRow
            label={t('reports.worstPerforming')}
            value={
              worstPerformer
                ? `${worstPerformer.domain.domain_name} (${worstPerformer.roi >= 0 ? '+' : ''}${worstPerformer.roi.toFixed(1)}%)`
                : '—'
            }
            valueClass={`font-medium truncate max-w-[220px] ${worstPerformer ? pnlColor(worstPerformer.roi) : 'text-stone-900'}`}
          />
        </div>
      </div>

      {/* Top performing domains —— 仅已售（持有中 profit ≤ 0 不该混进榜里）。 */}
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
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-stone-600 shrink-0">{label}</span>
      <span className={`text-sm text-right ${valueClass ?? 'font-semibold text-stone-900'}`}>{value}</span>
    </div>
  );
}
