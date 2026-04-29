'use client';

import { useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { calculateYearlyRenewalVsProfit } from '../../lib/coreCalculations';
import { useI18nContext } from '../../contexts/I18nProvider';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

interface YearlyCashflowTableProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

/**
 * Annual cash-flow view — by calendar year, shows renewal spend / other
 * outflow / sale net / net cashflow / two ratio columns / direction pill.
 *
 * Lives on the Performance sub-tab (P&L-by-year view, not renewal-cost view).
 *
 * Numbers come from calculateYearlyRenewalVsProfit which runs through
 * expandRenewalEvents (refactored in earlier commits), so totals match the
 * chart's purple Renewal cost line and the renewal Outlook list.
 *
 * Naming: column 8 was originally "Year result" with pill copy
 * "Net profit / Net loss / Break-even" — but the underlying number is
 * cash flow direction, not P&L. A year of net outflow because the user
 * bought $10 of inventory and didn't sell anything is not "Net loss" —
 * the inventory still has value. Pill renamed to "Net inflow / Net outflow
 * / Break-even" + column header to "Direction" so the label matches the
 * actual semantic.
 *
 * Mobile: stacked cards (md:hidden) since horizontal table scroll on a
 * 8-column min-w-[720px] table is unusable on phones.
 * Desktop (md+): full table.
 */
export default function YearlyCashflowTable({
  domains,
  transactions,
}: YearlyCashflowTableProps) {
  const { t } = useI18nContext();

  const rows = useMemo(
    () => calculateYearlyRenewalVsProfit(transactions, domains),
    [transactions, domains]
  );

  const directionTone = (cf: number) => {
    if (cf > 0) return {
      pillClass: 'bg-emerald-100 text-emerald-700',
      labelKey: 'analytics.yearlyRenewalProfit.statusProfit' as const,
      Icon: TrendingUp,
    };
    if (cf < 0) return {
      pillClass: 'bg-rose-100 text-rose-700',
      labelKey: 'analytics.yearlyRenewalProfit.statusLoss' as const,
      Icon: TrendingDown,
    };
    return {
      pillClass: 'bg-stone-100 text-stone-700',
      labelKey: 'analytics.yearlyRenewalProfit.statusFlat' as const,
      Icon: Minus,
    };
  };

  return (
    <div className="space-y-5">
      {/* Header card — gradient hero language matching the rest of the
          Insights tab. The icon tile + caption pattern from KPI strips. */}
      <div className="relative overflow-hidden rounded-3xl border border-stone-200/60 bg-gradient-to-br from-stone-50 via-white to-teal-50/30 shadow-sm">
        <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-gradient-to-br from-teal-100/30 to-transparent blur-3xl" />
        <div className="relative flex items-start gap-3 p-5 sm:p-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
            <Wallet className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-stone-900">
              {t('analytics.yearlyRenewalProfit.title')}
            </h3>
            <p className="mt-1 text-sm text-stone-500 leading-relaxed">
              {t('analytics.yearlyRenewalProfit.desc')}
            </p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-stone-500">
            {t('analytics.yearlyRenewalProfit.noData')}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile — stacked cards. Each card is one year. Avoids the
              720px-min table width that forced horizontal scroll on phones. */}
          <div className="space-y-3 md:hidden">
            {rows.map((row) => {
              const dir = directionTone(row.netCashflow);
              const cfPrefix = row.netCashflow > 0 ? '+' : row.netCashflow < 0 ? '−' : '';
              return (
                <div
                  key={row.year}
                  className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-lg font-semibold text-stone-900 tabular-nums">{row.year}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${dir.pillClass}`}>
                      <dir.Icon className="h-3 w-3" />
                      {t(dir.labelKey)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Stat
                      label={t('analytics.yearlyRenewalProfit.netCashflow')}
                      value={`${cfPrefix}$${Math.abs(row.netCashflow).toLocaleString()}`}
                      valueClass={
                        row.netCashflow > 0
                          ? 'text-emerald-700'
                          : row.netCashflow < 0
                            ? 'text-rose-700'
                            : 'text-stone-700'
                      }
                    />
                    <Stat
                      label={t('analytics.yearlyRenewalProfit.saleNet')}
                      value={row.saleNet > 0 ? `+$${row.saleNet.toLocaleString()}` : '—'}
                      valueClass="text-emerald-700"
                    />
                    <Stat
                      label={t('analytics.yearlyRenewalProfit.renewal')}
                      value={row.renewalSpend > 0 ? `−$${row.renewalSpend.toLocaleString()}` : '—'}
                    />
                    <Stat
                      label={t('analytics.yearlyRenewalProfit.otherOutflow')}
                      value={row.otherOutflow > 0 ? `−$${row.otherOutflow.toLocaleString()}` : '—'}
                    />
                  </div>

                  {(row.renewalToSalePercent != null || row.renewalSpend + row.otherOutflow > 0) && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-100 pt-3 text-xs text-stone-500">
                      {row.renewalToSalePercent != null && (
                        <span>
                          {t('analytics.yearlyRenewalProfit.renewalVsSale')}:{' '}
                          <span className="font-medium tabular-nums text-stone-700">
                            {row.renewalToSalePercent.toFixed(1)}%
                          </span>
                        </span>
                      )}
                      {row.renewalSpend + row.otherOutflow > 0 && (
                        <span>
                          {t('analytics.yearlyRenewalProfit.renewalOfOutflows')}:{' '}
                          <span className="font-medium tabular-nums text-stone-700">
                            {row.renewalShareOfOutflowsPercent.toFixed(1)}%
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop — full 8-column table. */}
          <div className="hidden md:block rounded-2xl border border-stone-200/80 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/60 text-stone-500 text-[10px] uppercase tracking-[0.14em]">
                    <th className="px-5 py-3 font-semibold">{t('analytics.yearlyRenewalProfit.year')}</th>
                    <th className="px-5 py-3 font-semibold text-right">{t('analytics.yearlyRenewalProfit.renewal')}</th>
                    <th className="px-5 py-3 font-semibold text-right">{t('analytics.yearlyRenewalProfit.otherOutflow')}</th>
                    <th className="px-5 py-3 font-semibold text-right">{t('analytics.yearlyRenewalProfit.saleNet')}</th>
                    <th className="px-5 py-3 font-semibold text-right">{t('analytics.yearlyRenewalProfit.netCashflow')}</th>
                    <th className="px-5 py-3 font-semibold text-right">{t('analytics.yearlyRenewalProfit.renewalVsSale')}</th>
                    <th className="px-5 py-3 font-semibold text-right">{t('analytics.yearlyRenewalProfit.renewalOfOutflows')}</th>
                    <th className="px-5 py-3 font-semibold text-center">
                      {t('analytics.yearlyRenewalProfit.resultColumn')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const dir = directionTone(row.netCashflow);
                    const cfPrefix = row.netCashflow > 0 ? '+' : row.netCashflow < 0 ? '−' : '';
                    return (
                      <tr key={row.year} className="border-b border-stone-100 last:border-b-0 hover:bg-stone-50/50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-stone-900 tabular-nums">{row.year}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-stone-700">
                          {row.renewalSpend > 0 ? `−$${row.renewalSpend.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-stone-700">
                          {row.otherOutflow > 0 ? `−$${row.otherOutflow.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-emerald-700">
                          {row.saleNet > 0 ? `+$${row.saleNet.toLocaleString()}` : '—'}
                        </td>
                        <td
                          className={`px-5 py-3 text-right font-semibold tabular-nums ${
                            row.netCashflow > 0
                              ? 'text-emerald-700'
                              : row.netCashflow < 0
                                ? 'text-rose-700'
                                : 'text-stone-700'
                          }`}
                        >
                          {cfPrefix}${Math.abs(row.netCashflow).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-stone-700">
                          {row.renewalToSalePercent != null
                            ? `${row.renewalToSalePercent.toFixed(1)}%`
                            : t('analytics.yearlyRenewalProfit.notApplicable')}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-stone-700">
                          {row.renewalSpend + row.otherOutflow > 0
                            ? `${row.renewalShareOfOutflowsPercent.toFixed(1)}%`
                            : t('analytics.yearlyRenewalProfit.notApplicable')}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${dir.pillClass}`}
                          >
                            <dir.Icon className="h-3 w-3" />
                            {t(dir.labelKey)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${valueClass ?? 'text-stone-700'}`}>
        {value}
      </p>
    </div>
  );
}
