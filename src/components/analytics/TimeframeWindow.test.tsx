/**
 * Investment Analytics 时间窗口的口径守卫。
 *
 * 两件事：
 *
 * 1. ALL 档的月份格数。以前是 `if (monthsDiff > 12) monthsToShow = monthsDiff + 1`，
 *    monthsDiff 正好等于 12（数据横跨 13 个月）时条件不成立、停在 12 格，最后
 *    一格落在上个月——当月从图上整个消失，而 KPI 的 inWindow 只卡 <= now、把
 *    当月算了进去，同一屏四块数字口径劈叉。
 *
 * 2. Realized P&L 扣的是域名**整段持有期**的成本，Investment 只数窗口内的支出。
 *    窗口外买、窗口内卖的域名因此会显示成"投入几乎为 0、却只赚了一部分"。
 *    算法不动（P&L 跟 Insights 顶部 lifetime hero KPI 同源），但缺口必须在
 *    Investment tile 下面显式写出来。
 */
import React from 'react';
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { I18nProvider } from '../../contexts/I18nProvider';
import InvestmentAnalytics, { chartMonthKeys } from './InvestmentAnalytics';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
  HTMLElement.prototype.getBoundingClientRect = function () {
    return {
      width: 800, height: 400, top: 0, left: 0,
      bottom: 400, right: 800, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect;
  };
});

afterEach(() => {
  vi.useRealTimers();
});

/** 固定"今天"，否则窗口边界随真实日期漂移，断言没法写死。 */
const TODAY = new Date(2026, 8, 19); // 2026-09-19

function freezeToday() {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
}

function renderAt(
  domains: DomainWithTags[],
  transactions: TransactionWithRequiredFields[]
) {
  return render(
    <I18nProvider>
      <InvestmentAnalytics domains={domains} transactions={transactions} />
    </I18nProvider>
  );
}

describe('chartMonthKeys', () => {
  const at = (y: number, m: number) => new Date(y, m - 1, 1);

  it('N 个月窗口 = 往前数 N 格、含当月', () => {
    expect(chartMonthKeys(TODAY, 6, null)).toEqual([
      '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
    ]);
    const twoYears = chartMonthKeys(TODAY, 24, null);
    expect(twoYears).toHaveLength(24);
    expect(twoYears[0]).toBe('2024-10');
    expect(twoYears[twoYears.length - 1]).toBe('2026-09');

    const threeYears = chartMonthKeys(TODAY, 36, null);
    expect(threeYears).toHaveLength(36);
    expect(threeYears[0]).toBe('2023-10');
  });

  it('ALL 档：数据横跨 13 个月时当月不再被吞掉', () => {
    // monthsDiff 正好 = 12 —— 旧代码 `if (monthsDiff > 12)` 掉进去的那个缺口，
    // 结果停在 12 格、最后一格落在 2026-08。
    const keys = chartMonthKeys(TODAY, null, at(2025, 9));
    expect(keys).toHaveLength(13);
    expect(keys[0]).toBe('2025-09');
    expect(keys[keys.length - 1]).toBe('2026-09');
  });

  it('ALL 档：11 / 13 两侧也都画到当月', () => {
    for (const monthsDiff of [0, 5, 11, 12, 13, 24]) {
      const earliest = new Date(TODAY.getFullYear(), TODAY.getMonth() - monthsDiff, 1);
      const keys = chartMonthKeys(TODAY, null, earliest);
      expect(keys[keys.length - 1]).toBe('2026-09');
      expect(keys).toHaveLength(monthsDiff + 1);
    }
  });

  it('ALL 档：数据不足 12 个月时只画到最早那个月，不往前补空格', () => {
    // monthsToShow 虽然按 max(12, …) 取到 12，但循环被 date > now 截断，
    // 起点又晚于当月前 11 格，所以实际只有 3 格。
    const keys = chartMonthKeys(TODAY, null, at(2026, 7));
    expect(keys).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  it('完全没有数据时回落到"一年前的当月 → 当月"', () => {
    const keys = chartMonthKeys(TODAY, null, null);
    expect(keys[0]).toBe('2025-09');
    expect(keys[keys.length - 1]).toBe('2026-09');
    expect(keys).toHaveLength(13);
  });
});

describe('窗口之前的投入', () => {
  // 2023-03 花 $5,000 买入，2026-05 以毛额 $20,000 卖出（平台费 $2,000）。
  // 选 2Y（2024-10 起）时那 $5,000 落在窗口之外。
  const domains = [
    {
      id: 'd1', domain_name: 'old.com', registrar: 'NC',
      purchase_date: '2023-03-10', purchase_cost: 5000, renewal_cost: 12,
      renewal_cycle: 1, renewal_count: 0, expiry_date: '2027-03-10',
      status: 'sold', estimated_value: 0, tags: [],
    },
  ] as unknown as DomainWithTags[];

  const transactions = [
    { id: 't1', domain_id: 'd1', type: 'buy', amount: 5000, currency: 'USD', date: '2023-03-10' },
    {
      id: 't2', domain_id: 'd1', type: 'sell', amount: 20000, net_amount: 18000,
      platform_fee: 2000, currency: 'USD', date: '2026-05-04', payment_plan: 'lump_sum',
    },
  ] as unknown as TransactionWithRequiredFields[];

  /** Investment tile 整块（label + 数值 + 小字）。 */
  function investmentTile(container: HTMLElement): HTMLElement {
    const label = within(container).getByText('Investment');
    return label.closest('div.min-w-0') as HTMLElement;
  }

  it('2Y 档把落在窗口之前的本金摊在 Investment 下面', async () => {
    freezeToday();
    const { container } = renderAt(domains, transactions);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    // fireEvent 走不了 fake timers 里的 React 调度，直接改值 + 派发 change
    select.value = '2Y';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    const tile = investmentTile(container);
    expect(tile.textContent).toContain('+$5,000');
    expect(tile.textContent).toContain('spent before this window');
  });

  it('ALL 档没有"之前"，不显示那行小字', () => {
    freezeToday();
    const { container } = renderAt(domains, transactions);
    // 默认就是 ALL
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('ALL');
    const tile = investmentTile(container);
    expect(tile.textContent).not.toContain('spent before this window');
  });
});
