'use client';

import { useMemo } from 'react';
import { calculateYearlyRenewalVsProfit } from '../../lib/coreCalculations';
import { useI18nContext } from '../../contexts/I18nProvider';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

interface YearlyCashflowTableProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

/**
 * Annual cash-flow table — renewal spend / other outflow / sale net /
 * net cashflow / renewal-to-sale ratio / renewal share of outflows /
 * year result, by calendar year.
 *
 * Lives on the Performance sub-tab because it's a P&L-by-year view,
 * not a renewal-cost view. Was previously embedded at the bottom of
 * AdvancedRenewalAnalysis where it didn't belong.
 *
 * Numbers come from calculateYearlyRenewalVsProfit which now goes
 * through expandRenewalEvents (refactored in earlier commits), so
 * the totals match the chart's purple Renewal cost line and the
 * Outlook list above.
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

  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-stone-900">
        {t('analytics.yearlyRenewalProfit.title')}
      </h3>
      <p className="mt-1 text-sm text-stone-500">{t('analytics.yearlyRenewalProfit.desc')}</p>

      {rows.length === 0 ? (
        <p className="text-center py-8 text-stone-500">
          {t('analytics.yearlyRenewalProfit.noData')}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[720px]">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 text-xs uppercase tracking-wider">
                  <th className="py-2.5 pr-3 font-medium">{t('analytics.yearlyRenewalProfit.year')}</th>
                  <th className="py-2.5 pr-3 font-medium text-right">{t('analytics.yearlyRenewalProfit.renewal')}</th>
                  <th className="py-2.5 pr-3 font-medium text-right">{t('analytics.yearlyRenewalProfit.otherOutflow')}</th>
                  <th className="py-2.5 pr-3 font-medium text-right">{t('analytics.yearlyRenewalProfit.saleNet')}</th>
                  <th className="py-2.5 pr-3 font-medium text-right">{t('analytics.yearlyRenewalProfit.netCashflow')}</th>
                  <th className="py-2.5 pr-3 font-medium text-right">{t('analytics.yearlyRenewalProfit.renewalVsSale')}</th>
                  <th className="py-2.5 pr-3 font-medium text-right">{t('analytics.yearlyRenewalProfit.renewalOfOutflows')}</th>
                  <th className="py-2.5 font-medium text-center">
                    {t('analytics.yearlyRenewalProfit.resultColumn')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.year} className="border-b border-stone-100 hover:bg-stone-50/60 transition-colors">
                    <td className="py-2.5 pr-3 font-medium text-stone-900 tabular-nums">{row.year}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-stone-700">
                      {row.renewalSpend > 0 ? `−$${row.renewalSpend.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-stone-700">
                      {row.otherOutflow > 0 ? `−$${row.otherOutflow.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-700">
                      {row.saleNet > 0 ? `+$${row.saleNet.toLocaleString()}` : '—'}
                    </td>
                    <td
                      className={`py-2.5 pr-3 text-right font-semibold tabular-nums ${
                        row.netCashflow > 0
                          ? 'text-emerald-700'
                          : row.netCashflow < 0
                            ? 'text-rose-700'
                            : 'text-stone-700'
                      }`}
                    >
                      {row.netCashflow > 0 ? '+' : row.netCashflow < 0 ? '−' : ''}
                      ${Math.abs(row.netCashflow).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-stone-700">
                      {row.renewalToSalePercent != null
                        ? `${row.renewalToSalePercent.toFixed(1)}%`
                        : t('analytics.yearlyRenewalProfit.notApplicable')}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-stone-700">
                      {row.renewalSpend + row.otherOutflow > 0
                        ? `${row.renewalShareOfOutflowsPercent.toFixed(1)}%`
                        : t('analytics.yearlyRenewalProfit.notApplicable')}
                    </td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.netCashflow > 0
                            ? 'bg-emerald-100 text-emerald-700'
                            : row.netCashflow < 0
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {row.netCashflow > 0
                          ? t('analytics.yearlyRenewalProfit.statusProfit')
                          : row.netCashflow < 0
                            ? t('analytics.yearlyRenewalProfit.statusLoss')
                            : t('analytics.yearlyRenewalProfit.statusFlat')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
