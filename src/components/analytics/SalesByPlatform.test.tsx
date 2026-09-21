/**
 * Sales by Platform 面板的渲染守卫。
 *
 * 算术在 salesByPlatform.test.ts 里守；这里只钉「屏幕上出现的东西」：
 * 合计行、Unknown 行的弱化与提示、费率除不了时不写成 0.0%。
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../../contexts/I18nProvider';
import SalesByPlatform from './SalesByPlatform';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

const domain = (id: string, cost: number) =>
  ({
    id, domain_name: `${id}.com`, registrar: 'NC',
    purchase_cost: cost, renewal_cost: 0, renewal_count: 0, baseline_renewal_as_of: null,
    purchase_date: '2025-01-01', expiry_date: '2027-01-01', status: 'sold',
    estimated_value: 0, tags: [],
  }) as unknown as DomainWithTags;

const buy = (id: string, amount: number) =>
  ({ id: `b-${id}`, domain_id: id, type: 'buy', amount, currency: 'USD', date: '2025-01-01' }) as unknown as TransactionWithRequiredFields;

const sell = (id: string, gross: number, net: number, over: Record<string, unknown> = {}) =>
  ({
    id: `s-${id}`, domain_id: id, type: 'sell', amount: gross, net_amount: net,
    platform_fee: gross - net, currency: 'USD', date: '2026-05-01',
    payment_plan: 'lump_sum', ...over,
  }) as unknown as TransactionWithRequiredFields;

const show = (
  d: DomainWithTags[],
  t: TransactionWithRequiredFields[],
  onBackfillPlatform?: () => void
) =>
  render(
    <I18nProvider>
      <SalesByPlatform domains={d} transactions={t} onBackfillPlatform={onBackfillPlatform} />
    </I18nProvider>
  );

describe('SalesByPlatform', () => {
  it('没有成交时给空状态，不渲染表格', () => {
    show([domain('d1', 100)], [buy('d1', 100)]);
    expect(screen.getByText(/No completed sales yet/i)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('每个平台一行，带有效费率', () => {
    const d = [domain('d1', 1000), domain('d2', 500)];
    const txs = [
      buy('d1', 1000), sell('d1', 10000, 8500, { platform: 'Afternic' }),
      buy('d2', 500), sell('d2', 2000, 1800, { platform: 'Sedo' }),
    ];
    const { container } = show(d, txs);
    const table = container.querySelector('table')!;
    expect(within(table).getByText('Afternic')).toBeTruthy();
    expect(within(table).getByText('Sedo')).toBeTruthy();
    expect(within(table).getByText('15.0%')).toBeTruthy();
    expect(within(table).getByText('10.0%')).toBeTruthy();
  });

  it('合计行出现在 tfoot，金额是各行之和', () => {
    const d = [domain('d1', 100), domain('d2', 100)];
    const txs = [
      buy('d1', 100), sell('d1', 1000, 900, { platform: 'Dan' }),
      buy('d2', 100), sell('d2', 3000, 2700, { platform: 'Sedo' }),
    ];
    const { container } = show(d, txs);
    const foot = container.querySelector('tfoot')!;
    expect(within(foot).getByText('Total')).toBeTruthy();
    expect(within(foot).getByText('$4,000.00')).toBeTruthy();  // gross
    expect(within(foot).getByText('$3,600.00')).toBeTruthy();  // net
    expect(within(foot).getByText('10.0%')).toBeTruthy();      // 有效费率
  });

  it('没记平台的成交：单独一行 + 提示有几笔', () => {
    const d = [domain('d1', 100), domain('d2', 100)];
    const txs = [
      buy('d1', 100), sell('d1', 500, 450),                        // 无平台
      buy('d2', 100), sell('d2', 3000, 2700, { platform: 'Dan' }),
    ];
    const { container } = show(d, txs);
    const table = container.querySelector('table')!;
    expect(within(table).getByText('Not recorded')).toBeTruthy();
    // 提示里要写清是"没录"，并带上笔数
    expect(screen.getByText(/1 sale\(s\) have no platform recorded/i)).toBeTruthy();
  });

  it('全部都记了平台时不显示补录提示', () => {
    const d = [domain('d1', 100)];
    const txs = [buy('d1', 100), sell('d1', 3000, 2700, { platform: 'Dan' })];
    show(d, txs);
    expect(screen.queryByText(/have no platform recorded/i)).toBeNull();
  });

  it('成交额为 0 时费率显示「—」，不是 0.0%', () => {
    const d = [domain('d1', 100)];
    const txs = [buy('d1', 100), sell('d1', 0, 0, { platform: 'Dan' })];
    const { container } = show(d, txs);
    const row = container.querySelector('tbody tr') as HTMLElement;
    expect(within(row).queryByText('0.0%')).toBeNull();
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('platform 为空但有 platform_fee_type 时，照样归到具体平台', () => {
    const d = [domain('d1', 100)];
    const txs = [
      buy('d1', 100),
      sell('d1', 5000, 4250, { platform_fee_type: 'afternic_installment' }),
    ];
    const { container } = show(d, txs);
    const table = container.querySelector('table')!;
    expect(within(table).getByText('Afternic')).toBeTruthy();
    expect(within(table).queryByText('Not recorded')).toBeNull();
  });
});

/**
 * 「未记录」那行的补录入口。
 *
 * platform 这一列是后加的（add_transaction_platform_column.sql），老交易全是
 * NULL，所以刚打开这张表大概率是一大坨钱堆在「未记录」里。在上百笔交易里手动
 * 翻出缺平台的那几笔不现实，所以提示里带个按钮，跳到已经筛好的交易列表。
 *
 * 补录本身走既有的交易编辑表单——分析面板保持只读，不在这里开写入口。
 */
describe('补录入口', () => {
  const withUnknown = (): [DomainWithTags[], TransactionWithRequiredFields[]] => [
    [domain('d1', 100), domain('d2', 100)],
    [
      buy('d1', 100), sell('d1', 500, 450),                        // 无平台
      buy('d2', 100), sell('d2', 3000, 2700, { platform: 'Dan' }),
    ],
  ];

  it('有未记录的成交时显示按钮，点击触发回调', () => {
    const onBackfill = vi.fn();
    const [d, t] = withUnknown();
    show(d, t, onBackfill);
    const btn = screen.getByRole('button', { name: /fill them in/i });
    fireEvent.click(btn);
    expect(onBackfill).toHaveBeenCalledTimes(1);
  });

  it('没传回调时只显示说明，不显示按钮', () => {
    const [d, t] = withUnknown();
    show(d, t);
    expect(screen.queryByRole('button', { name: /fill them in/i })).toBeNull();
    // 说明文字照常在
    expect(screen.getByText(/have no platform recorded/i)).toBeTruthy();
  });

  it('全部都记了平台时，按钮和提示都不出现', () => {
    const onBackfill = vi.fn();
    show([domain('d1', 100)], [buy('d1', 100), sell('d1', 3000, 2700, { platform: 'Dan' })], onBackfill);
    expect(screen.queryByRole('button', { name: /fill them in/i })).toBeNull();
    expect(screen.queryByText(/have no platform recorded/i)).toBeNull();
  });
});
