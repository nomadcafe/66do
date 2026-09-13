import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { I18nProvider } from '../../contexts/I18nProvider';
import FinancialAnalysis from './FinancialAnalysisOptimized';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

function domain(id: string, cost: number): DomainWithTags {
  return {
    id, domain_name: `${id}.com`, registrar: 'NC',
    purchase_date: '2025-01-10', purchase_cost: cost, renewal_cost: 0,
    renewal_cycle: 1, renewal_count: 0, expiry_date: '2027-01-10',
    status: 'sold', estimated_value: 0, tags: [],
  } as unknown as DomainWithTags;
}
function sell(id: string, domainId: string, amount: number, date = '2026-05-01') {
  return {
    id, domain_id: domainId, type: 'sell', amount, net_amount: amount,
    platform_fee: 0, currency: 'USD', date, payment_plan: 'lump_sum',
  } as unknown as TransactionWithRequiredFields;
}

function setup(domains: DomainWithTags[], txs: TransactionWithRequiredFields[]) {
  const { container } = render(
    <I18nProvider>
      <FinancialAnalysis domains={domains} transactions={txs} />
    </I18nProvider>
  );
  const list = container.querySelector('ul')!;
  return { container, list };
}

describe('Top Performing Domains', () => {
  it('不把亏损的那笔列进 top 列表（它已经在下面的 worst sale 里了）', () => {
    const domains = [domain('win', 100), domain('ok', 100), domain('bad', 1000)];
    const txs = [
      sell('t1', 'win', 5100),
      sell('t2', 'ok', 1100),
      sell('t3', 'bad', 200), // −$800
    ];
    const { list } = setup(domains, txs);
    const names = within(list).getAllByText(/\.com$/).map((e) => e.textContent);
    expect(names).toContain('win.com');
    expect(names).toContain('ok.com');
    expect(names).not.toContain('bad.com');
    // worst sale footer 仍然点名它
    expect(screen.getAllByText('bad.com').length).toBe(1);
  });

  it('同一域名卖两次时两行能区分开', () => {
    const domains = [domain('twice', 100)];
    const txs = [sell('t1', 'twice', 900, '2026-03-01'), sell('t2', 'twice', 600, '2026-09-01')];
    const { list } = setup(domains, txs);
    expect(within(list).getAllByText('twice.com')).toHaveLength(2);
    // 日期按 locale 渲染，用同一个变换算期望值，别把格式写死
    const label = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US');
    expect(within(list).getByText(label('2026-03-01'))).toBeTruthy();
    expect(within(list).getByText(label('2026-09-01'))).toBeTruthy();
  });

  it('全部亏损时列表为空，但 worst sale 仍然点名', () => {
    const domains = [domain('a', 1000), domain('b', 1000)];
    const txs = [sell('t1', 'a', 400), sell('t2', 'b', 100)];
    const { container } = setup(domains, txs);
    expect(container.querySelector('ul')).toBeNull();
    expect(screen.getByText('No profitable sales yet — see the worst sale below.')).toBeTruthy();
    expect(screen.getByText('b.com')).toBeTruthy(); // −$900，亏得最狠
  });

  it('免费域名按 profit 排在该在的位置，ROI 显示 ∞ 而不是 0%', () => {
    const domains = [domain('free', 0), domain('paid', 100)];
    const txs = [sell('t1', 'free', 3000), sell('t2', 'paid', 900)];
    const { list } = setup(domains, txs);
    const names = within(list).getAllByText(/\.com$/).map((e) => e.textContent);
    expect(names[0]).toBe('free.com'); // 曾经因为 ROI 兜底 0% 被排到末尾
    expect(within(list).getByText('∞')).toBeTruthy();
  });
});
