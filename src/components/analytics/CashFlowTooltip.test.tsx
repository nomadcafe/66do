/**
 * 净现金流 tooltip 的内容守卫。
 *
 * 这张图以前只能告诉你「这个月净流出 $1,200」，答不出「买了域名还是续费」。
 * 三类流出的数一直都在 timeSeriesData 里，只是没往下传。
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CashFlowTooltip } from './InvestmentAnalytics';

const t = (k: string) => k.split('.').pop() as string;
const monthLabel = (k: string) => k;

function row(over: Partial<Record<string, number>> = {}) {
  return {
    date: '2026-08',
    investment: 0,
    renewalCost: 0,
    revenue: 0,
    grossSales: 0,
    realizedPnL: 0,
    monthlyCashFlow: 0,
    purchase: 0,
    otherOutflow: 0,
    ...over,
  };
}

const renderTip = (data: ReturnType<typeof row>) =>
  render(
    <CashFlowTooltip
      active
      payload={[{ payload: data as never }]}
      t={t}
      monthLabel={monthLabel}
    />
  );

describe('CashFlowTooltip', () => {
  it('breaks a negative month down into its three outflows', () => {
    renderTip(row({ purchase: 1200, renewalCost: 36, otherOutflow: 40, monthlyCashFlow: -1276 }));
    expect(screen.getByText('cashFlowPurchase')).toBeTruthy();
    expect(screen.getByText('−$1,200.00')).toBeTruthy();
    expect(screen.getByText('renewalCost')).toBeTruthy();
    expect(screen.getByText('−$36.00')).toBeTruthy();
    expect(screen.getByText('cashFlowOtherOutflow')).toBeTruthy();
    expect(screen.getByText('−$1,276.00')).toBeTruthy();
  });

  it('shows inflow with a + sign and the net in green', () => {
    renderTip(row({ revenue: 4500, purchase: 0, monthlyCashFlow: 4500 }));
    // 只有入账的月份，明细行和合计行是同一个数——出现两次是对的
    expect(screen.getAllByText('+$4,500.00')).toHaveLength(2);
    const net = screen.getByText('monthlyCashFlow').parentElement!;
    expect(net.querySelector('.text-emerald-700')).toBeTruthy();
  });

  it('omits rows that are zero rather than printing a wall of $0.00', () => {
    renderTip(row({ revenue: 4500, monthlyCashFlow: 4500 }));
    expect(screen.queryByText('cashFlowPurchase')).toBeNull();
    expect(screen.queryByText('renewalCost')).toBeNull();
    expect(screen.queryByText('cashFlowOtherOutflow')).toBeNull();
  });

  it('says so when nothing moved, instead of showing an empty box', () => {
    renderTip(row());
    expect(screen.getByText('cashFlowNoMovement')).toBeTruthy();
    expect(screen.queryByText('monthlyCashFlow')).toBeNull();
  });

  it('renders nothing when Recharts has not activated it', () => {
    const { container } = render(
      <CashFlowTooltip active={false} payload={[]} t={t} monthLabel={monthLabel} />
    );
    expect(container.firstChild).toBeNull();
  });
});
