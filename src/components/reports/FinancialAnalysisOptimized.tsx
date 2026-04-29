'use client';

import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import { DollarSign, TrendingUp, Target, Wallet, CheckCircle, XCircle, Award } from 'lucide-react';
import { useComprehensiveFinancialAnalysis } from '../../hooks/useFinancialCalculations';
import { useI18nContext } from '../../contexts/I18nProvider';
import { totalRealizedPnL, realizedROI, tradeOutcomes } from '../../lib/realizedPnL';
import { useMemo } from 'react';

interface FinancialAnalysisProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

export default function FinancialAnalysis({ domains, transactions }: FinancialAnalysisProps) {
  const { t } = useI18nContext();

  const financialAnalysis = useComprehensiveFinancialAnalysis(domains, transactions);
  const { basic, advanced } = financialAnalysis;

  // Realized P&L / ROI 走共享 lib，跟 Hero / IA 黄线同源——Performance 的
  // 头部 KPI 不再用 basic.totalProfit（= totalRevenue − totalInvestment，把
  // 持有未卖的 cost 也算分母），那个口径跟 Realized P&L 数字会不一致。
  const realizedPnL = useMemo(() => totalRealizedPnL(domains, transactions), [domains, transactions]);
  const realizedRoi = useMemo(() => realizedROI(domains, transactions), [domains, transactions]);

  // Top Performers / best / worst 走 tradeOutcomes（每笔 sell 一行，profit
  // 用 sellNetUSD 已扣平台费 + 已处理分期 partial 折算）。之前用的
  // domainPerformance.profit 用的是 domain.sale_price（毛额），跟 Hero 的
  // Realized P&L (用 sellNetUSD 净额) 不一致——同一个域名两个不同 profit。
  // costBasisAtSale === 0 的免费域名 ROI 标记为 null，按 profit 排序时它们
  // 不会被错排到底（之前 ROI 兜底 0% 让免费暴利域名永远排末尾）。
  const trades = useMemo(() => tradeOutcomes(domains, transactions), [domains, transactions]);
  const topPerformers = useMemo(
    () => [...trades].sort((a, b) => b.profit - a.profit).slice(0, 10),
    [trades]
  );
  // best / worst：排除 null ROI（免费域名）以保留 ROI 比较的语义；
  // 全是 free 域名时 best/worst 不显示——属于罕见数据形态，免显示比误显示好。
  const tradesWithRoi = useMemo(
    () => trades.filter((t): t is typeof t & { roi: number } => t.roi !== null),
    [trades]
  );
  const bestPerformer = tradesWithRoi.length > 0
    ? tradesWithRoi.reduce((b, c) => (c.roi > b.roi ? c : b))
    : null;
  const worstPerformer = tradesWithRoi.length > 0
    ? tradesWithRoi.reduce((w, c) => (c.roi < w.roi ? c : w))
    : null;

  const pnlColor = (value: number) => (value >= 0 ? 'text-emerald-700' : 'text-rose-700');

  const perfIcon = (roi: number | null) => {
    // Free-domain trade (roi = null because cost basis is 0): treat as the
    // success icon — any positive profit on a free domain is infinite ROI.
    if (roi === null) return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    if (roi > 50) return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    if (roi > 0) return <Target className="h-5 w-5 text-amber-500" />;
    return <XCircle className="h-5 w-5 text-rose-500" />;
  };

  const formatUSD = (n: number) =>
    n < 0 ? `−$${Math.abs(n).toLocaleString()}` : `$${n.toLocaleString()}`;

  // days → 自适应：< 30 天显示天，< 365 显示月，>= 365 显示年（保留 1 位）。
  // 域名持有期常以"年"为单位，原先一律显示 "1247 days" 阅读体验差。
  const formatHoldingPeriod = (days: number): string => {
    if (days <= 0) return `0${t('analytics.daysUnit')}`;
    if (days < 30) return `${Math.round(days)}${t('analytics.daysUnit')}`;
    if (days < 365) return `${Math.round(days / 30)}${t('reports.monthsUnit')}`;
    return `${(days / 365).toFixed(1)}${t('reports.yearsUnit')}`;
  };

  const pnlPositive = realizedPnL > 0;
  const pnlNegative = realizedPnL < 0;
  const pnlPrefix = pnlPositive ? '+' : pnlNegative ? '−' : '';

  return (
    <div className="space-y-5">
      {/* KPI strip — gradient hero language matching the rest of Insights.
          The 4 metrics: Total Investment (lifetime cash spent on domains),
          Total Revenue (lifetime cash received from sales), Realized P&L
          (the canonical profit number, matches Hero), Realized ROI (% on
          completed trades). Old "totalProfit" = totalRevenue−totalInvestment
          was structurally biased against held inventory and disagreed with
          Hero's Realized P&L. */}
      <div className="relative overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-stone-50 via-white to-teal-50/30 shadow-sm">
        <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-gradient-to-br from-teal-100/30 to-transparent blur-3xl" />
        <div className="relative grid grid-cols-2 gap-5 p-5 sm:p-6 lg:grid-cols-4 lg:gap-6">
          <KpiTile
            icon={<DollarSign className="h-5 w-5" />}
            iconClass="bg-stone-100 text-stone-700"
            label={t('reports.totalInvestment')}
            value={formatUSD(basic.totalInvestment)}
          />
          <KpiTile
            icon={<TrendingUp className="h-5 w-5" />}
            iconClass="bg-emerald-50 text-emerald-700"
            label={t('reports.totalRevenue')}
            value={formatUSD(basic.totalRevenue)}
          />
          <KpiTile
            icon={<Wallet className="h-5 w-5" />}
            iconClass={
              pnlPositive
                ? 'bg-emerald-50 text-emerald-700'
                : pnlNegative
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-stone-100 text-stone-700'
            }
            label={t('analytics.realizedPnL')}
            value={`${pnlPrefix}$${Math.abs(realizedPnL).toLocaleString()}`}
            valueClass={pnlColor(realizedPnL)}
          />
          <KpiTile
            icon={<Target className="h-5 w-5" />}
            iconClass={
              realizedRoi >= 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
            }
            label={t('reports.roi')}
            value={`${realizedRoi >= 0 ? '+' : '−'}${Math.abs(realizedRoi).toFixed(1)}%`}
            valueClass={pnlColor(realizedRoi)}
          />
        </div>
      </div>

      {/* Portfolio snapshot — trimmed to 3 rows.
          Removed: activeDomains / soldDomains counts. Both already shown
          on the Hero composition donut + footer; duplicating them here
          turned this card into "5 rows where 2 are redundant w/ Hero".
          Kept: avg holding period (unique to this surface), best /
          worst performer (peeks the Top Performers list extremes). */}
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
            label={t('reports.bestPerforming')}
            value={
              bestPerformer && bestPerformer.domainName
                ? `${bestPerformer.domainName} (${bestPerformer.roi >= 0 ? '+' : ''}${bestPerformer.roi.toFixed(1)}%)`
                : '—'
            }
            valueClass={`font-medium truncate max-w-[220px] ${bestPerformer ? pnlColor(bestPerformer.roi) : 'text-stone-900'}`}
          />
          <SnapshotRow
            label={t('reports.worstPerforming')}
            value={
              worstPerformer && worstPerformer.domainName
                ? `${worstPerformer.domainName} (${worstPerformer.roi >= 0 ? '+' : ''}${worstPerformer.roi.toFixed(1)}%)`
                : '—'
            }
            valueClass={`font-medium truncate max-w-[220px] ${worstPerformer ? pnlColor(worstPerformer.roi) : 'text-stone-900'}`}
          />
        </div>
      </div>

      {/* Top performing domains —— 每笔 sell 一行，按 profit 排序 top 10。
          一个域名出售多次会出现多次（每个 trade 一行）。免费域名（cost
          basis 0）的 ROI 显示为 "∞"，避免兜底 0% 让暴利交易排到末尾。 */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Award className="h-4 w-4 text-amber-600" />
          <h3 className="text-base font-semibold text-stone-900">
            {t('reports.topPerformers')}
          </h3>
        </div>
        {topPerformers.length === 0 ? (
          <p className="text-sm text-stone-500">{t('reports.topPerformersEmpty')}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {topPerformers.map((item, idx) => {
              const Icon = perfIcon(item.roi);
              return (
                <li
                  key={`${item.domainId}-${idx}`}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {Icon}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">
                        {item.domainName ?? '—'}
                      </p>
                      <p className="text-xs text-stone-500">
                        {t('reports.roi')}:{' '}
                        {item.roi === null ? (
                          <span className="tabular-nums text-emerald-700">∞</span>
                        ) : (
                          <span className={`tabular-nums ${pnlColor(item.roi)}`}>
                            {item.roi >= 0 ? '+' : ''}
                            {item.roi.toFixed(1)}%
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold tabular-nums ${pnlColor(item.profit)}`}>
                    {formatUSD(item.profit)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function KpiTile({
  icon,
  iconClass,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
          {label}
        </p>
        <p className={`mt-1 text-xl font-bold tracking-tight tabular-nums ${valueClass ?? 'text-stone-900'}`}>
          {value}
        </p>
      </div>
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
