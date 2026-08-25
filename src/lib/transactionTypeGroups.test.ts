import { describe, it, expect } from 'vitest';
import {
  HOLDING_COST_TYPES,
  OPERATING_EXPENSE_TYPES,
  CASH_OUTFLOW_TYPES,
  NON_RENEW_OUTFLOW_TYPES,
  isCashOutflowType,
  isHoldingCostType,
} from './transactionTypeGroups';

describe('transactionTypeGroups', () => {
  it('持有成本 + 运营支出 = 全部流出，且互不重叠', () => {
    expect(CASH_OUTFLOW_TYPES).toEqual([...HOLDING_COST_TYPES, ...OPERATING_EXPENSE_TYPES]);
    const overlap = HOLDING_COST_TYPES.filter((t) => OPERATING_EXPENSE_TYPES.includes(t));
    expect(overlap).toEqual([]);
  });

  it('sell 永远不是流出', () => {
    expect(isCashOutflowType('sell')).toBe(false);
    expect(isHoldingCostType('sell')).toBe(false);
  });

  it('流出口径覆盖 sell 之外的所有交易类型', () => {
    const allTypes = ['buy', 'sell', 'renew', 'transfer', 'fee', 'marketing', 'advertising'];
    const outflows = allTypes.filter(isCashOutflowType).sort();
    expect(outflows).toEqual([...CASH_OUTFLOW_TYPES].sort());
    expect(outflows).toHaveLength(allTypes.length - 1);
  });

  it('NON_RENEW_OUTFLOW_TYPES 只少了 renew', () => {
    expect(NON_RENEW_OUTFLOW_TYPES).not.toContain('renew');
    expect(NON_RENEW_OUTFLOW_TYPES).toHaveLength(CASH_OUTFLOW_TYPES.length - 1);
  });

  it('transfer 既是持有成本也是现金流出（与 renewalCostBasis 口径一致）', () => {
    expect(isHoldingCostType('transfer')).toBe(true);
    expect(isCashOutflowType('transfer')).toBe(true);
  });
});
