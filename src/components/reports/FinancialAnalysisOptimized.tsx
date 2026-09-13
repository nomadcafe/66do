'use client';

import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import { DollarSign, TrendingUp, Target, CheckCircle, Award, Receipt, PiggyBank, TrendingDown } from 'lucide-react';
import { calculateBasicFinancialMetrics } from '../../lib/coreCalculations';
import { useI18nContext } from '../../contexts/I18nProvider';
import { parseLocalCalendarDate } from '../../lib/localCalendarDate';
import { formatCurrency } from '../../lib/financialCalculations';
import { realizedROIFromTrades, tradeOutcomes } from '../../lib/realizedPnL';
import { useMemo } from 'react';

interface FinancialAnalysisProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

export default function FinancialAnalysis({ domains, transactions }: FinancialAnalysisProps) {
  const { t, locale } = useI18nContext();

  // basic 提供 lifetime 累计：totalInvestment / totalRevenue / totalProfit /
  // totalGrossSales。Realized P&L / Avg holding 已经在 Insights KPI strip
  // 上方独占（顶部跨 sub-tab 都看得见），这里不再重复。
  const basic = useMemo(
    () => calculateBasicFinancialMetrics(domains, transactions),
    [domains, transactions]
  );
  // Top Performers + Worst sale + Realized ROI 走同一份 tradeOutcomes（每笔
  // sell 一行，profit 用 sellNetUSD 已扣平台费 + 已处理分期 partial 折算）。
  // costBasisAtSale === 0 的免费域名 ROI 标记为 null，按 profit 排序时它们
  // 不会被错排到底（之前 ROI 兜底 0% 让免费暴利域名永远排末尾）。
  const trades = useMemo(() => tradeOutcomes(domains, transactions), [domains, transactions]);
  // 由 trades 归约而不是 realizedROI(domains, transactions)：后者会把同一个
  // 循环（含每笔的 holdingCostAsOf）再跑一遍，且两个数字有各自漂移的余地。
  const realizedRoi = useMemo(() => realizedROIFromTrades(trades), [trades]);
  // 只收盈利的成交。以前是对全部 trades 排序后取前 10，于是成交笔数 ≤ 10 时
  // 亏损的那些必然也进列表——一张标题写着「Top Performing」的卡片里列着一笔
  // −$800、配一个红叉图标，而同一笔又出现在下面的 worst sale 行里，同一个数
  // 在同一张卡上出现两次。全亏时列表为空，交给 topPerformersEmpty 文案。
  const topPerformers = useMemo(
    () => trades.filter((tr) => tr.profit > 0).sort((a, b) => b.profit - a.profit).slice(0, 10),
    [trades]
  );
  // worst sale：亏损交易里 profit 最小的那笔。全部都盈利时不显示——给"赚最少
  // 的"那笔打上 worst 标签是误导。免费域名（roi=null）必然 profit>0，天然不会
  // 进这个列表。
  const worstSale = useMemo(() => {
    const losingTrades = trades.filter((tr) => tr.profit < 0);
    if (losingTrades.length === 0) return null;
    return losingTrades.reduce((w, c) => (c.profit < w.profit ? c : w));
  }, [trades]);

  const pnlColor = (value: number) => (value >= 0 ? 'text-emerald-700' : 'text-rose-700');

  // 列表只剩盈利成交，所以 roi 要么是 null（免费域名，cost basis 0，任何正
  // 收益都是无穷大 ROI），要么 > 0——不再有「亏损」这一档。图标是装饰：
  // 同一行右边就写着 ROI 百分比，含义由文字承担，所以对读屏隐藏，免得重复播报。
  const perfIcon = (roi: number | null) =>
    roi === null || roi > 50 ? (
      <CheckCircle className="h-5 w-5 text-emerald-500" aria-hidden />
    ) : (
      <Target className="h-5 w-5 text-amber-500" aria-hidden />
    );

  // 列表是「每笔成交一行」，同一个域名卖过两次就会出现两行。不写日期的话
  // 两行长得一模一样，看着像渲染重复了。
  const saleDateLabel = (iso: string) => {
    const d = parseLocalCalendarDate(iso);
    return d ? d.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US') : iso;
  };

  // 走 formatCurrency 而不是裸 toLocaleString：后者默认最多 3 位小数、且不补
  // 零，$1,234.5 和 $12,345.679 都会原样渲染——分期到账金额是
  // down × (1 − feeRate)，必然带长小数。Renewals 板块用的就是 formatCurrency，
  // 两边格式必须一致，否则切个 sub-tab 同一类数字的小数位就变了。
  const formatUSD = (n: number) =>
    n < 0 ? `−${formatCurrency(Math.abs(n), 'USD')}` : formatCurrency(n, 'USD');

  return (
    <div className="space-y-5">
      {/* KPI strip — 5 lifetime metrics:
            Total Investment | Total Revenue | Net Profit | Realized ROI | Platform Fees
          Realized P&L 不在这里：Insights KPI strip 顶部已经独占（跨 sub-tab
          可见，无论用户在 Performance / Renewals / Loss 哪个 sub-tab 都能扫
          到），重复展示反而让用户不确定哪个权威。Net Profit (= totalRevenue
          − totalInvestment) 是 lifetime 全口径 P&L：包含持有未卖库存的成本
          + 过期域名的沉没成本，这跟 Realized P&L (only sold domains) 是不
          同视角，所以保留。 */}
      <div className="relative overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-stone-50 via-white to-teal-50/30 shadow-sm">
        <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-gradient-to-br from-teal-100/30 to-transparent blur-3xl" />
        <div className="relative grid grid-cols-2 gap-5 p-5 sm:p-6 md:grid-cols-3 md:gap-6">
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
            icon={<PiggyBank className="h-5 w-5" />}
            iconClass={
              basic.totalProfit > 0
                ? 'bg-emerald-50 text-emerald-700'
                : basic.totalProfit < 0
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-stone-100 text-stone-700'
            }
            label={t('analytics.netProfit')}
            value={formatUSD(basic.totalProfit)}
            valueClass={pnlColor(basic.totalProfit)}
          />
          <KpiTile
            icon={<Target className="h-5 w-5" />}
            iconClass={
              realizedRoi >= 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
            }
            label={t('reports.realizedRoi')}
            value={`${realizedRoi >= 0 ? '+' : '−'}${Math.abs(realizedRoi).toFixed(1)}%`}
            valueClass={pnlColor(realizedRoi)}
          />
          <KpiTile
            icon={<Receipt className="h-5 w-5" />}
            iconClass="bg-stone-100 text-stone-700"
            label={t('financial.platformFees')}
            value={formatUSD(Math.max(0, basic.totalGrossSales - basic.totalRevenue))}
          />
        </div>
      </div>

      {/* Top performing domains —— 盈利成交里按 profit 排序取前 10，每笔 sell
          一行。一个域名出售多次会出现多次（每个 trade 一行），所以行上带成交
          日期区分。免费域名（cost basis 0）的 ROI 显示为 "∞"，避免兜底 0% 让
          暴利交易排到末尾。
          Worst sale (profit < 0 里最低的那笔) 作为 footer 行展示——两份列表
          互斥（top 只收 profit > 0），同一笔不会既在上面又在下面。 */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Award className="h-4 w-4 text-amber-600" />
          <h3 className="text-base font-semibold text-stone-900">
            {t('reports.topPerformers')}
          </h3>
        </div>
        {topPerformers.length === 0 ? (
          // 两种空法要分开说：一笔都没卖过，和卖过但没有一笔是赚的。
          // 列表只收 profit > 0 之后，后一种才成为可能。
          <p className="text-sm text-stone-500">
            {t(trades.length === 0 ? 'reports.topPerformersEmpty' : 'reports.topPerformersNoProfit')}
          </p>
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
                        <span className="mx-1.5 text-stone-300">·</span>
                        <span className="tabular-nums">{saleDateLabel(item.saleDate)}</span>
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
        {worstSale && (
          <div className="mt-3 pt-3 border-t border-stone-200">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <TrendingDown className="h-5 w-5 text-rose-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                    {t('reports.worstSale')}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-stone-900 truncate">
                    {worstSale.domainName ?? '—'}
                    {worstSale.roi !== null && (
                      <span className="ml-2 text-xs font-normal text-rose-600 tabular-nums">
                        ROI {worstSale.roi >= 0 ? '+' : ''}{worstSale.roi.toFixed(1)}%
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <p className="text-sm font-semibold tabular-nums text-rose-700 shrink-0">
                {formatUSD(worstSale.profit)}
              </p>
            </div>
          </div>
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

