'use client';

import { useMemo } from 'react';
import { Receipt, Info } from 'lucide-react';
import { formatCurrency } from '../../lib/financialCalculations';
import { annualExpenses, EXPENSE_CATEGORIES, type ExpenseCategory } from '../../lib/annualExpenses';
import { useI18nContext } from '../../contexts/I18nProvider';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

interface AnnualExpensesProps {
  domains: DomainWithTags[];
  transactions: TransactionWithRequiredFields[];
}

const CATEGORY_LABEL_KEY: Record<ExpenseCategory, string> = {
  purchase: 'analytics.annualExpenses.purchase',
  renewal: 'analytics.annualExpenses.renewal',
  transfer: 'analytics.annualExpenses.transfer',
  fee: 'analytics.annualExpenses.fee',
  marketing: 'analytics.annualExpenses.marketing',
  advertising: 'analytics.annualExpenses.advertising',
};

/**
 * Annual Expenses —— 按自然年、按科目拆开的支出。
 *
 * 回答报税季那句话：「这一年花了多少、分别是什么、凭证在哪」。
 *
 * 跟它上面的 YearlyCashflowTable 的分工：那张表回答**现金流方向**（这一年净
 * 流入还是净流出），把购入 / 转移 / 平台费 / 营销 / 广告 全揉进一列
 * otherOutflow。拿去给会计不够用，对方要按科目看——这张表就是那一列的展开。
 *
 * 口径跟月度净现金流图同源（见 annualExpenses 的注释），有测试逐项对拍。
 *
 * 不做"可抵税"标记。抵扣与否取决于辖区和资本化/费用化处理，应用无从校验，
 * 条款里也明写着不提供税务建议。这里只如实报「花了多少、什么名目」，
 * 抵不抵是会计的事。
 */
export default function AnnualExpenses({ domains, transactions }: AnnualExpensesProps) {
  const { t } = useI18nContext();

  const { rows, totals, grandTransactionCount, grandWithReceiptCount } = useMemo(
    () => annualExpenses(domains, transactions),
    [domains, transactions]
  );

  const money = (n: number) => formatCurrency(n, 'USD');
  const cell = (n: number) => (n > 0 ? money(n) : '—');

  const header = (
    <div className="surface-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
          <Receipt className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-stone-900">
            {t('analytics.annualExpenses.title')}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-stone-500">
            {t('analytics.annualExpenses.desc')}
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
          <p className="text-sm text-stone-500">{t('analytics.annualExpenses.noData')}</p>
        </div>
      </div>
    );
  }

  const anyArchiveDerived = rows.some((r) => r.hasArchiveDerived);

  return (
    <div className="space-y-4">
      {header}

      {/* 凭证覆盖。报税时「凭证在哪」就看这行：缺口一眼可见。
          档案来源的金额（purchase_cost 兜底、档案续费）没有交易行，也就没有
          凭证可挂——不解释清楚的话，用户会以为是自己漏填了。 */}
      <div className="flex items-start gap-2 rounded-xl border border-stone-200/80 bg-stone-50 px-4 py-3 text-sm text-stone-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
        <p>
          {t('analytics.annualExpenses.receiptCoverage')
            .replace('{withReceipt}', String(grandWithReceiptCount))
            .replace('{total}', String(grandTransactionCount))}
          {anyArchiveDerived && ` ${t('analytics.annualExpenses.archiveNote')}`}
        </p>
      </div>

      {/* 移动端：一年一张卡。七列表格在手机上横向滚动没法用。 */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div key={row.year} className="surface-card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-lg font-semibold tabular-nums text-stone-900">{row.year}</span>
              <span className="text-lg font-bold tabular-nums text-stone-900">
                {money(row.total)}
              </span>
            </div>
            <dl className="mt-4 space-y-1.5">
              {EXPENSE_CATEGORIES.filter((c) => row.byCategory[c] > 0).map((c) => (
                <div key={c} className="flex items-baseline justify-between gap-4 text-xs">
                  <dt className="text-stone-500">{t(CATEGORY_LABEL_KEY[c])}</dt>
                  <dd className="tabular-nums text-stone-700">{money(row.byCategory[c])}</dd>
                </div>
              ))}
            </dl>
            {row.transactionCount > 0 && (
              <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-500 tabular-nums">
                {t('analytics.annualExpenses.receiptCoverage')
                  .replace('{withReceipt}', String(row.withReceiptCount))
                  .replace('{total}', String(row.transactionCount))}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* 桌面端：整表 */}
      <div className="hidden overflow-hidden md:block surface-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/60 text-[10px] uppercase tracking-[0.14em] text-stone-500">
                <th className="px-5 py-3 font-semibold">{t('analytics.annualExpenses.year')}</th>
                {EXPENSE_CATEGORIES.map((c) => (
                  <th key={c} className="px-5 py-3 text-right font-semibold">
                    {t(CATEGORY_LABEL_KEY[c])}
                  </th>
                ))}
                <th className="px-5 py-3 text-right font-semibold">
                  {t('analytics.annualExpenses.total')}
                </th>
                <th className="px-5 py-3 text-right font-semibold">
                  {t('analytics.annualExpenses.receipts')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.year} className="hover:bg-stone-50/60">
                  <td className="px-5 py-3 font-medium tabular-nums text-stone-900">{row.year}</td>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <td key={c} className="px-5 py-3 text-right tabular-nums text-stone-700">
                      {cell(row.byCategory[c])}
                    </td>
                  ))}
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-stone-900">
                    {money(row.total)}
                  </td>
                  <td
                    className={`px-5 py-3 text-right tabular-nums ${
                      row.transactionCount > 0 && row.withReceiptCount < row.transactionCount
                        ? 'text-amber-700'
                        : 'text-stone-500'
                    }`}
                  >
                    {row.transactionCount > 0
                      ? `${row.withReceiptCount}/${row.transactionCount}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-200 bg-stone-50/60 font-semibold">
                <td className="px-5 py-3 text-stone-900">{t('analytics.annualExpenses.total')}</td>
                {EXPENSE_CATEGORIES.map((c) => (
                  <td key={c} className="px-5 py-3 text-right tabular-nums text-stone-700">
                    {cell(totals.byCategory[c])}
                  </td>
                ))}
                <td className="px-5 py-3 text-right tabular-nums text-stone-900">
                  {money(totals.total)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-stone-500">
                  {grandTransactionCount > 0
                    ? `${grandWithReceiptCount}/${grandTransactionCount}`
                    : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
