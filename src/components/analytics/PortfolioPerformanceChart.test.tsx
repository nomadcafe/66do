/**
 * Portfolio Performance 的口径守卫。
 *
 * 这张图原先是三条「每月流量」+ 一条「累计存量」共用一个 Y 轴：累计线只涨
 * 不跌、没有上限，轴的上限被它拉高之后，月度那三条被压在底部几个百分点里，
 * 数据越多越不可读。四条统一成累计之后才同量级、可比。
 *
 * 用渲染出来的 SVG 路径断言，而不是断言内部状态——要守的就是「画出来的线
 * 不往下掉」这件事本身。
 */
import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../../contexts/I18nProvider';
import InvestmentAnalytics from './InvestmentAnalytics';
import type { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';

beforeAll(() => {
  // Recharts 的 ResponsiveContainer 靠 ResizeObserver / getBoundingClientRect
  // 拿宽高；jsdom 两样都没有，不铺这层的话整张图渲染成空。
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

const domains = [
  {
    id: 'd1', domain_name: 'example.com', registrar: 'NC',
    purchase_date: '2026-04-05', purchase_cost: 1200, renewal_cost: 12,
    renewal_cycle: 1, renewal_count: 0, expiry_date: '2027-04-05',
    status: 'sold', estimated_value: 0, tags: [],
  },
] as unknown as DomainWithTags[];

const transactions = [
  { id: 't1', domain_id: 'd1', type: 'buy', amount: 1200, currency: 'USD', date: '2026-04-05' },
  {
    id: 't2', domain_id: 'd1', type: 'sell', amount: 9000, net_amount: 8100,
    platform_fee: 900, currency: 'USD', date: '2026-07-02', payment_plan: 'lump_sum',
  },
] as unknown as TransactionWithRequiredFields[];

function renderChart() {
  return render(
    <I18nProvider>
      <InvestmentAnalytics domains={domains} transactions={transactions} />
    </I18nProvider>
  );
}

/** 从 path 的 d 里取出全部 y 坐标。SVG 的 y 向下增长，所以数值变大 = y 变小。 */
function pathYs(el: Element | undefined): number[] {
  const d = el?.getAttribute('d') ?? '';
  return [...d.matchAll(/(-?[\d.]+)\s*,\s*(-?[\d.]+)/g)].map((m) => Number(m[2]));
}

describe('Portfolio Performance', () => {
  it('每条线都标成累计，而不是月度', () => {
    renderChart();
    expect(screen.getAllByText('Cumulative investment').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cumulative sales').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Cumulative renewals (part of investment)').length
    ).toBeGreaterThan(0);
  });

  it('出售线在成交后保持在高位，而不是尖峰后落回 0', () => {
    const { container } = renderChart();
    const ys = pathYs(container.querySelectorAll('.recharts-area-curve')[1]);
    expect(ys.length).toBeGreaterThan(2);
    // 非递增的 y = 非递减的值：累计线永远不往下走
    ys.forEach((y, i) => {
      if (i > 0) expect(y).toBeLessThanOrEqual(ys[i - 1] + 0.001);
    });
    // 而且确实涨过——否则上面的断言对一条平线也成立
    expect(ys[0] - ys[ys.length - 1]).toBeGreaterThan(1);
  });

  it('投入线同样只涨不跌', () => {
    const { container } = renderChart();
    const ys = pathYs(container.querySelectorAll('.recharts-area-curve')[0]);
    expect(ys.length).toBeGreaterThan(2);
    ys.forEach((y, i) => {
      if (i > 0) expect(y).toBeLessThanOrEqual(ys[i - 1] + 0.001);
    });
  });

  it('四条序列用的是通过 CVD 校验的那组色值', () => {
    const { container } = renderChart();
    const areaStrokes = Array.from(container.querySelectorAll('.recharts-area-curve')).map((e) =>
      e.getAttribute('stroke')
    );
    const lineStrokes = Array.from(container.querySelectorAll('.recharts-line-curve')).map((e) =>
      e.getAttribute('stroke')
    );
    // 旧的 #6366f1 / #a855f7 这一对在正常色觉下 ΔE 只有 11.3，低于 15 的下限
    expect([...areaStrokes, ...lineStrokes]).toEqual([
      '#2a78d6',
      '#1baf7a',
      '#4a3aa7',
      '#eda100',
    ]);
  });
});
