/**
 * ?txnoplatform=1 —— 只看「没记平台的出售」。
 *
 * Sales by Platform 按 marketplace 拆成交，而 platform 这一列是后加的
 * （add_transaction_platform_column.sql），老交易全是 NULL，于是一大坨钱堆在
 * 「未记录」行里。在上百笔交易里手动翻出缺平台的那几笔不现实，所以那块的提示
 * 带个按钮把用户送到这个已筛好的列表；补录本身走既有的交易编辑表单。
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../../contexts/I18nProvider';
import TransactionList from './TransactionList';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

let params = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/dashboard',
}));

beforeEach(() => {
  params = new URLSearchParams();
});

const domains = [
  { id: 'd1', domain_name: 'alpha.com', status: 'sold', purchase_date: '2025-01-01',
    purchase_cost: 100, renewal_cost: 12, renewal_cycle: 1, renewal_count: 0,
    expiry_date: '2027-01-01', estimated_value: 0, tags: [] },
  { id: 'd2', domain_name: 'beta.com', status: 'sold', purchase_date: '2025-01-01',
    purchase_cost: 100, renewal_cost: 12, renewal_cycle: 1, renewal_count: 0,
    expiry_date: '2027-01-01', estimated_value: 0, tags: [] },
  { id: 'd3', domain_name: 'gamma.com', status: 'active', purchase_date: '2025-01-01',
    purchase_cost: 100, renewal_cost: 12, renewal_cycle: 1, renewal_count: 0,
    expiry_date: '2027-01-01', estimated_value: 0, tags: [] },
] as unknown as DomainWithTags[];

const transactions = [
  // 缺平台的出售 —— 该留下
  { id: 't1', domain_id: 'd1', type: 'sell', amount: 5000, net_amount: 4500,
    platform_fee: 500, currency: 'USD', date: '2026-05-01', payment_plan: 'lump_sum' },
  // 记了平台的出售 —— 该滤掉
  { id: 't2', domain_id: 'd2', type: 'sell', amount: 3000, net_amount: 2700,
    platform_fee: 300, currency: 'USD', date: '2026-06-01', payment_plan: 'lump_sum',
    platform: 'Dan' },
  // 缺平台的买入 —— 该滤掉（买入的 platform 是注册商，不是 marketplace）
  { id: 't3', domain_id: 'd3', type: 'buy', amount: 100, currency: 'USD', date: '2025-01-01' },
] as unknown as TransactionWithRequiredFields[];

const renderList = () =>
  render(
    <I18nProvider>
      <TransactionList
        transactions={transactions}
        domains={domains}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAdd={vi.fn()}
      />
    </I18nProvider>
  );

describe('缺平台筛选', () => {
  it('不带参数时三笔都在', () => {
    renderList();
    expect(screen.getAllByText(/alpha\.com/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/beta\.com/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/gamma\.com/).length).toBeGreaterThan(0);
  });

  it('txnoplatform=1 只留缺平台的出售', () => {
    params = new URLSearchParams('txnoplatform=1');
    renderList();
    expect(screen.getAllByText(/alpha\.com/).length).toBeGreaterThan(0);
    // 记了平台的出售滤掉
    expect(screen.queryByText(/beta\.com/)).toBeNull();
    // 买入滤掉——它的 platform 是注册商，混进来补录会把两个概念搅在一起
    expect(screen.queryByText(/gamma\.com/)).toBeNull();
  });

  it('筛选生效时给出横幅解释，并提供清除', () => {
    params = new URLSearchParams('txnoplatform=1');
    renderList();
    expect(screen.getByText(/only sales with no platform recorded/i)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /clear/i }).length).toBeGreaterThan(0);
  });

  it('全部都记了平台时列表为空，且给的是"没找到"而不是"还没有交易"', () => {
    params = new URLSearchParams('txnoplatform=1');
    render(
      <I18nProvider>
        <TransactionList
          transactions={[transactions[1]]}
          domains={domains}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onAdd={vi.fn()}
        />
      </I18nProvider>
    );
    // 有交易、只是筛不出来 —— 文案得是"没找到"，不能是"还没有交易，快去添加"
    expect(screen.getByText(/no transactions found/i)).toBeTruthy();
  });
});
