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
import type { DomainWithTags } from '../../types/dashboard';

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
