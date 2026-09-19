/**
 * 年度支出面板的渲染守卫。算术在 annualExpenses.test.ts 里守（含跟
 * computeMonthlyOutflow 的逐项对拍）；这里只钉屏幕上出现的东西。
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { I18nProvider } from '../../contexts/I18nProvider';
import AnnualExpenses from './AnnualExpenses';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

const dom = (over: Record<string, unknown> = {}) =>
  ({
    id: 'd1', domain_name: 'x.com', registrar: 'NC',
    purchase_date: '2025-03-01', purchase_cost: 0,
    renewal_cost: 12, renewal_cycle: 1, renewal_count: 0,
    baseline_renewal_as_of: null, expiry_date: '2027-03-01',
    status: 'active', estimated_value: 0, tags: [], ...over,
  }) as unknown as DomainWithTags;

const tx = (over: Record<string, unknown>) =>
  ({
    id: `t${Math.random()}`, domain_id: 'd1', type: 'fee', amount: 10,
    currency: 'USD', date: '2025-06-01', ...over,
  }) as unknown as TransactionWithRequiredFields;

const show = (d: DomainWithTags[], t: TransactionWithRequiredFields[]) =>
  render(
    <I18nProvider>
      <AnnualExpenses domains={d} transactions={t} />
    </I18nProvider>
  );

describe('AnnualExpenses', () => {
  it('没有支出时给空状态，不渲染表格', () => {
    const { container } = show([dom()], []);
    expect(screen.getByText(/No expenses recorded yet/i)).toBeTruthy();
    expect(container.querySelector('table')).toBeNull();
  });

  it('一年一行，科目落在正确的列', () => {
    const { container } = show([dom()], [
      tx({ type: 'buy', amount: 500, date: '2025-02-01' }),
      tx({ type: 'marketing', amount: 30, date: '2026-01-01' }),
    ]);
    const rows = Array.from(container.querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(2);
    // 列序：年份 | 购入 | 续费 | 转移 | 手续费 | 营销 | 广告 | 合计 | 凭证
    const cells = (tr: Element) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent);
    // 末列是凭证覆盖：buy / marketing 都算支出交易，各 1 笔、都没挂凭证 → 0/1
    expect(cells(rows[0])).toEqual(
      ['2025', '$500.00', '—', '—', '—', '—', '—', '$500.00', '0/1']
    );
    expect(cells(rows[1])).toEqual(
      ['2026', '—', '—', '—', '—', '$30.00', '—', '$30.00', '0/1']
    );
  });

  it('合计行在 tfoot，等于各年之和', () => {
    const { container } = show([dom()], [
      tx({ type: 'buy', amount: 500, date: '2025-02-01' }),
      tx({ type: 'fee', amount: 100, date: '2026-01-01' }),
    ]);
    const foot = container.querySelector('tfoot')!;
    expect(within(foot).getByText('$600.00')).toBeTruthy();
  });

  it('凭证覆盖写出来，缺口用琥珀色标出', () => {
    const { container } = show([dom()], [
      tx({ type: 'fee', amount: 10, date: '2025-06-01', receipt_url: 'https://e.com/a.pdf' }),
      tx({ type: 'fee', amount: 20, date: '2025-07-01' }),
    ]);
    // 顶部横幅和移动端卡片各写一遍（两套响应式布局都在 DOM 里，靠 CSS 隐藏）
    expect(
      screen.getAllByText(/1 of 2 expense transactions have a receipt link/i).length
    ).toBeGreaterThan(0);
    const body = container.querySelector('tbody')!;
    const receiptCell = within(body).getByText('1/2');
    expect(receiptCell.className).toContain('amber');
  });

  it('凭证齐全时不标琥珀色', () => {
    const { container } = show([dom()], [
      tx({ type: 'fee', amount: 10, date: '2025-06-01', receipt_url: 'https://e.com/a.pdf' }),
    ]);
    const cell = within(container.querySelector('tbody')!).getByText('1/1');
    expect(cell.className).not.toContain('amber');
  });

  it('金额全部来自档案时，说明为什么没有凭证', () => {
    // purchase_cost 兜底没有交易行，挂不上凭证——不解释用户会以为自己漏填了
    show([dom({ purchase_cost: 100 })], []);
    expect(screen.getByText(/no transaction row, so no receipt/i)).toBeTruthy();
  });

  it('没有金额的科目显示「—」而不是 $0.00', () => {
    const { container } = show([dom()], [tx({ type: 'buy', amount: 500, date: '2025-02-01' })]);
    const row = container.querySelector('tbody tr') as HTMLElement;
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(row).queryByText('$0.00')).toBeNull();
  });
});
