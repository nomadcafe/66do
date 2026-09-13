/**
 * 表格分页在「数据刷新」和「筛选变化」下该有的不同反应。
 *
 * 原来是 useEffect(() => setPage(1), [domains])：domains 只要换一个数组身份
 * 就回到第 1 页。而行内改价走的正是 handleQuickUpdateDomain → domains.map(...)
 * → 全新数组——也就是说在第 2 页改一个成本，表格立刻跳回第 1 页，而这个表格
 * 的行内编辑 + Tab 逐行填数恰恰是为「CSV 导入后顺着列填成本」设计的。
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../../contexts/I18nProvider';
import DomainTable from './DomainTable';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/dashboard',
}));

const makeDomains = (n: number, costOverride?: Record<string, number>) =>
  Array.from({ length: n }, (_, i) => ({
    id: `d${i}`,
    domain_name: `site${String(i).padStart(3, '0')}.com`,
    registrar: 'Namecheap',
    purchase_date: '2025-01-10',
    purchase_cost: costOverride?.[`d${i}`] ?? 100,
    renewal_cost: 12,
    renewal_cycle: 1,
    renewal_count: 0,
    expiry_date: '2027-01-10',
    status: 'active',
    estimated_value: 0,
    tags: [],
  })) as unknown as DomainWithTags[];

const renderTable = (domains: DomainWithTags[]) =>
  render(
    <I18nProvider>
      <DomainTable domains={domains} onEdit={vi.fn()} onDelete={vi.fn()} onView={vi.fn()} />
    </I18nProvider>
  );

const goToPage2 = () => {
  fireEvent.click(screen.getByRole('button', { name: '2' }));
};

describe('DomainTable 分页', () => {
  it('行内改价（同一批域名，只有数值变了）不把用户踢回第 1 页', () => {
    const { rerender } = renderTable(makeDomains(40));
    goToPage2();
    expect(screen.getByText('site024.com')).toBeTruthy();

    // 模拟 handleQuickUpdateDomain：全新数组，同一批 id，其中一个成本变了
    rerender(
      <I18nProvider>
        <DomainTable
          domains={makeDomains(40, { d24: 999 })}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onView={vi.fn()}
        />
      </I18nProvider>
    );
    expect(screen.getByText('site024.com')).toBeTruthy();
    expect(screen.queryByText('site000.com')).toBeNull();
  });

  it('域名集合本身变了（筛选 / 增删）仍然回到第 1 页', () => {
    const { rerender } = renderTable(makeDomains(40));
    goToPage2();
    expect(screen.getByText('site024.com')).toBeTruthy();

    rerender(
      <I18nProvider>
        <DomainTable
          domains={makeDomains(40).slice(0, 30)}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onView={vi.fn()}
        />
      </I18nProvider>
    );
    expect(screen.getByText('site000.com')).toBeTruthy();
  });

  it('并列的行有确定的先后，不随重排变化', () => {
    // 40 个域名同为 active，按状态排时全部并列
    const domains = makeDomains(40);
    const { container, rerender } = renderTable(domains);
    const statusHeader = screen.getAllByRole('button').find((b) =>
      /status/i.test(b.textContent ?? '')
    )!;
    fireEvent.click(statusHeader);
    const firstPass = Array.from(container.querySelectorAll('tbody tr')).map(
      (r) => r.querySelector('td')?.textContent
    );
    // 同一批数据重新排一次，顺序必须一样
    rerender(
      <I18nProvider>
        <DomainTable domains={[...domains]} onEdit={vi.fn()} onDelete={vi.fn()} onView={vi.fn()} />
      </I18nProvider>
    );
    fireEvent.click(statusHeader);
    fireEvent.click(statusHeader);
    const secondPass = Array.from(container.querySelectorAll('tbody tr')).map(
      (r) => r.querySelector('td')?.textContent
    );
    expect(secondPass).toEqual(firstPass);
  });
});

describe('DomainTable 展开行的金额', () => {
  const one = makeDomains(1);
  const rawSell = {
    id: 'tx1', domain_id: 'd0', type: 'sell', amount: 50000, net_amount: 50000,
    platform_fee: 0, currency: 'USD', date: '2026-03-01', payment_plan: 'installment',
  } as unknown as TransactionWithRequiredFields;
  const adjustedSell = { ...rawSell, amount: 10000, net_amount: 10000 } as TransactionWithRequiredFields;
  const freeTransfer = {
    id: 'tx2', domain_id: 'd0', type: 'transfer', amount: 0, net_amount: 0,
    platform_fee: 0, currency: 'USD', date: '2026-04-01', payment_plan: 'lump_sum',
  } as unknown as TransactionWithRequiredFields;

  // 表头那个 th 也带 expandHistory 的 aria-label，只点按钮
  const expand = () =>
    fireEvent.click(
      screen.getAllByRole('button').find((b) => /expand/i.test(b.getAttribute('aria-label') ?? ''))!
    );

  it('分期出售显示已收额，并带出合同「标价」', () => {
    render(
      <I18nProvider>
        <DomainTable
          domains={one}
          transactions={[rawSell]}
          metricsTransactions={[adjustedSell]}
          onEdit={vi.fn()} onDelete={vi.fn()} onView={vi.fn()}
        />
      </I18nProvider>
    );
    expand();
    expect(screen.getByText('+$10,000.00')).toBeTruthy();
    expect(screen.queryByText('+$50,000.00')).toBeNull();
    expect(screen.getByText(/50,000/)).toBeTruthy(); // 「标价」小字
  });

  it('免费 transfer 不写成「−$0.00」', () => {
    render(
      <I18nProvider>
        <DomainTable
          domains={one}
          transactions={[freeTransfer]}
          onEdit={vi.fn()} onDelete={vi.fn()} onView={vi.fn()}
        />
      </I18nProvider>
    );
    expand();
    expect(screen.getByText('$0.00')).toBeTruthy();
    expect(screen.queryByText('-$0.00')).toBeNull();
    expect(screen.queryByText(String.fromCharCode(8722) + '$0.00')).toBeNull();
  });
});

describe('DomainTable ROI 列', () => {
  const withRoi = (over: Record<string, unknown>) =>
    [{ ...makeDomains(1)[0], ...over }] as unknown as DomainWithTags[];

  // 列顺序：展开 / 域名 / 状态 / 成本 / 估值 / 到期 / ROI / 标签 / 操作
  const roiCell = (container: HTMLElement) =>
    container.querySelectorAll('tbody tr')[0].querySelectorAll('td')[6];

  const renderWith = (domains: DomainWithTags[], txs: TransactionWithRequiredFields[] = []) =>
    render(
      <I18nProvider>
        <DomainTable domains={domains} transactions={txs} onEdit={vi.fn()} onDelete={vi.fn()} onView={vi.fn()} />
      </I18nProvider>
    );

  it('持有中没填估值时显示「—」，而不是绿色的 +0.0%', () => {
    const { container } = renderWith(withRoi({ estimated_value: 0, status: 'active' }));
    const cell = roiCell(container);
    expect(cell.textContent).toContain(String.fromCharCode(8212));
    expect(cell.textContent).not.toContain('0.0%');
    expect(cell.querySelector('.text-emerald-600')).toBeNull();
  });

  it('填了估值时标成浮动收益（带 ~ 前缀）', () => {
    const { container } = renderWith(
      withRoi({ estimated_value: 4000, purchase_cost: 1000, status: 'active' })
    );
    const cell = roiCell(container);
    expect(cell.textContent).toContain('~');
    expect(cell.textContent).toContain('300.0%');
  });

  it('已成交的 ROI 不带 ~，是实打实的', () => {
    const txs = [{
      id: 't1', domain_id: 'd0', type: 'sell', amount: 5000, net_amount: 5000,
      platform_fee: 0, currency: 'USD', date: '2026-04-01',
    }] as unknown as TransactionWithRequiredFields[];
    const { container } = renderWith(
      withRoi({ status: 'sold', purchase_cost: 1000, estimated_value: 0 }),
      txs
    );
    const cell = roiCell(container);
    expect(cell.textContent).not.toContain('~');
    expect(cell.textContent).toContain('400.0%');
  });
});
