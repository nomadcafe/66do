'use client';

import { useMemo } from 'react';
import { Store, Info } from 'lucide-react';
import { formatCurrency } from '../../lib/financialCalculations';
import { salesByPlatform } from '../../lib/salesByPlatform';
import { useI18nContext } from '../../contexts/I18nProvider';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

interface SalesByPlatformProps {
  domains: DomainWithTags[];
  /** transactionsForMetrics —— 分期必须是已折算口径，见 salesByPlatform 的注释 */
  transactions: TransactionWithRequiredFields[];
}

/**
 * Sales by Platform —— 按 marketplace 看成交表现。
 *
 * 各家名义费率差得很远，但名义费率不是你实际付出的：分期按已收比例摊、
 * 一口价按成交价扣、阶梯佣金还随金额跳档。这张表给的是事后算出来的**有效
 * 费率**（平台费 ÷ 成交额），以及每个平台最终落进口袋的实收和已实现盈亏。
 *
 * 只看卖出侧。注册商维度的成本分析已经在 Renewals 子 tab 和持仓分布里了。
 *
 * 表格而不是图：六列都是精确金额，读者要的是逐个比对，不是看形状。
 * 一张柱图反而会把"Afternic 15% vs Sedo 10%"这种两三个百分点的差压扁。
 *
 * 移动端堆叠成卡片，桌面端整表——跟 YearlyCashflowTable 同一套响应式策略，
 * 六列表格在手机上横向滚动是没法用的。
 */
export default function SalesByPlatform({ domains, transactions }: SalesByPlatformProps) {
  const { t } = useI18nContext();

  const { rows, totals, unknownCount } = useMemo(
    () => salesByPlatform(domains, transactions),
    [domains, transactions]
  );

  const money = (n: number) => formatCurrency(n, 'USD');
  const signedMoney = (n: number) =>
    `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatCurrency(Math.abs(n), 'USD')}`;
  const pnlClass = (n: number) =>
    n > 0 ? 'text-emerald-700' : n < 0 ? 'text-rose-700' : 'text-stone-700';
  // 费率为 null = 成交额是 0，比值除不了。不兜底成 0.0%——那会被读成"不收费"。
  const rate = (r: number | null) => (r === null ? '—' : `${r.toFixed(1)}%`);
  const nameOf = (platform: string, isUnknown: boolean) =>
    isUnknown ? t('analytics.salesByPlatform.unknown') : platform;

  const header = (
    <div className="surface-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
          <Store className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-stone-900">
            {t('analytics.salesByPlatform.title')}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone-500">
            {t('analytics.salesByPlatform.desc')}
          </p>
        </div>
      </div>
    </div>
  );

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <div className="surface-card p-12 text-center">
          <p className="text-sm text-stone-500">{t('analytics.salesByPlatform.noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      {/* 没有平台信息的成交：不藏着，直接说清楚有多少笔、怎么补。
          platform 这一列是后加的，老交易全是 NULL —— 用户看到一个很大的
          Unknown 行时，得知道那是"没录"而不是"某个叫 Unknown 的平台"。 */}
      {unknownCount > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {t('analytics.salesByPlatform.unknownHint').replace('{count}', String(unknownCount))}
          </p>
        </div>
      )}

      {/* 移动端：一个平台一张卡 */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div key={row.platform || 'unknown'} className="surface-card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={`text-base font-semibold ${row.isUnknown ? 'text-stone-400' : 'text-stone-900'}`}
              >
                {nameOf(row.platform, row.isUnknown)}
              </span>
              <span className="text-xs text-stone-500 tabular-nums">
                {t('analytics.salesByPlatform.salesCount').replace('{count}', String(row.salesCount))}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat label={t('analytics.salesByPlatform.grossSales')} value={money(row.grossSales)} />
              <Stat
                label={t('analytics.salesByPlatform.netProceeds')}
                value={money(row.netProceeds)}
                valueClass="text-emerald-700"
              />
              <Stat
                label={t('analytics.salesByPlatform.platformFees')}
                value={row.platformFees > 0 ? `−${money(row.platformFees)}` : '—'}
              />
              <Stat
                label={t('analytics.salesByPlatform.feeRate')}
                value={rate(row.feeRatePercent)}
              />
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-stone-100 pt-3 text-xs">
              <span className="text-stone-500">{t('analytics.realizedPnL')}</span>
              <span className={`font-semibold tabular-nums ${pnlClass(row.realizedPnL)}`}>
                {signedMoney(row.realizedPnL)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 桌面端：整表 */}
      <div className="hidden overflow-hidden md:block surface-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/60 text-[10px] uppercase tracking-[0.14em] text-stone-500">
                <th className="px-5 py-3 font-semibold">{t('analytics.salesByPlatform.platform')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('analytics.salesByPlatform.sales')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('analytics.salesByPlatform.grossSales')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('analytics.salesByPlatform.platformFees')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('analytics.salesByPlatform.feeRate')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('analytics.salesByPlatform.netProceeds')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('analytics.realizedPnL')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.platform || 'unknown'} className="hover:bg-stone-50/60">
                  <td
                    className={`px-5 py-3 font-medium ${row.isUnknown ? 'text-stone-400' : 'text-stone-900'}`}
                  >
                    {nameOf(row.platform, row.isUnknown)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-stone-700">{row.salesCount}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-stone-700">{money(row.grossSales)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-stone-700">
                    {row.platformFees > 0 ? `−${money(row.platformFees)}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-stone-700">
                    {rate(row.feeRatePercent)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums text-emerald-700">
                    {money(row.netProceeds)}
                  </td>
                  <td className={`px-5 py-3 text-right font-semibold tabular-nums ${pnlClass(row.realizedPnL)}`}>
                    {signedMoney(row.realizedPnL)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-200 bg-stone-50/60 font-semibold">
                <td className="px-5 py-3 text-stone-900">{t('analytics.salesByPlatform.total')}</td>
                <td className="px-5 py-3 text-right tabular-nums text-stone-700">{totals.salesCount}</td>
                <td className="px-5 py-3 text-right tabular-nums text-stone-700">{money(totals.grossSales)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-stone-700">
                  {totals.platformFees > 0 ? `−${money(totals.platformFees)}` : '—'}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-stone-700">
                  {rate(totals.feeRatePercent)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-emerald-700">
                  {money(totals.netProceeds)}
                </td>
                <td className={`px-5 py-3 text-right tabular-nums ${pnlClass(totals.realizedPnL)}`}>
                  {signedMoney(totals.realizedPnL)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass = 'text-stone-900',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
