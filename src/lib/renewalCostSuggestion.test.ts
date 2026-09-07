import { describe, it, expect } from 'vitest';
import type { TransactionWithRequiredFields } from '../types/transaction';

/**
 * TransactionForm 续费建议金额的口径守卫。
 *
 * 复刻组件里的推导（组件是 UI 状态，这里锁住算法）：先把每笔历史续费按
 * renewal_period_years 归一到「每年」，取平均，再乘回当前这笔要续的年数。
 *
 * 回归：原来直接对 t.amount 取平均。一笔 3 年 $36 和一笔 1 年 $12 是同一个价，
 * 裸平均给出 $24——而这个建议是个点一下就写进 amount 的按钮，旁边就是「续费
 * 年数」选择器。同一个归一化问题在 renewalCostService 的「最贵域名」榜也修过。
 */
function suggestRenewalCost(
  txs: TransactionWithRequiredFields[],
  domainId: string,
  domainCycle: number,
  yearsToRenew: number,
  editingId?: string
): number | null {
  const domCycle = Math.max(1, Math.floor(domainCycle) || 1);
  const history = txs
    .filter((t) => t.type === 'renew' && t.domain_id === domainId && (!editingId || t.id !== editingId))
    .map((t) => {
      const years = Math.max(1, Math.floor(t.renewal_period_years ?? domCycle) || domCycle);
      return (Number(t.amount) || 0) / years;
    });
  if (history.length === 0) return null;
  const avgPerYear = history.reduce((s, v) => s + v, 0) / history.length;
  return avgPerYear * Math.max(1, Math.floor(yearsToRenew) || 1);
}

function renew(
  id: string,
  amount: number,
  years?: number,
  domainId = 'd1'
): TransactionWithRequiredFields {
  return {
    id,
    domain_id: domainId,
    type: 'renew',
    amount,
    currency: 'USD',
    date: '2025-01-10',
    ...(years === undefined ? {} : { renewal_period_years: years }),
    created_at: '',
    updated_at: '',
  } as TransactionWithRequiredFields;
}

describe('续费建议金额', () => {
  it('多年期续费按年归一，不再被读成涨价', () => {
    // $36/3年 与 $12/1年 都是 $12/年
    const txs = [renew('t1', 36, 3), renew('t2', 12, 1)];
    expect(suggestRenewalCost(txs, 'd1', 1, 1)).toBeCloseTo(12, 9); // 曾经是 24
  });

  it('建议值随当前选择的续费年数缩放', () => {
    const txs = [renew('t1', 12, 1)];
    expect(suggestRenewalCost(txs, 'd1', 1, 1)).toBeCloseTo(12, 9);
    expect(suggestRenewalCost(txs, 'd1', 1, 3)).toBeCloseTo(36, 9);
  });

  it('年数缺失时退回域名的续费周期', () => {
    // 与 expandRenewalEvents 的兜底一致：$30 记在一个 2 年周期的域名上 = $15/年
    const txs = [renew('t1', 30, undefined)];
    expect(suggestRenewalCost(txs, 'd1', 2, 1)).toBeCloseTo(15, 9);
  });

  it('年数为 0 / 负数时按 1 年兜底，不会产生 Infinity', () => {
    const txs = [renew('t1', 20, 0), renew('t2', 20, -3)];
    const got = suggestRenewalCost(txs, 'd1', 1, 1);
    expect(Number.isFinite(got!)).toBe(true);
    expect(got).toBeCloseTo(20, 9);
  });

  it('编辑模式排除正在编辑的那笔，不让它喂给自己', () => {
    const txs = [renew('t1', 12, 1), renew('t2', 99, 1)];
    expect(suggestRenewalCost(txs, 'd1', 1, 1, 't2')).toBeCloseTo(12, 9);
  });

  it('只看该域名自己的续费记录', () => {
    const txs = [renew('t1', 12, 1, 'd1'), renew('t2', 500, 1, 'd2')];
    expect(suggestRenewalCost(txs, 'd1', 1, 1)).toBeCloseTo(12, 9);
  });

  it('没有历史时返回 null，不显示建议', () => {
    expect(suggestRenewalCost([], 'd1', 1, 1)).toBeNull();
  });
});
