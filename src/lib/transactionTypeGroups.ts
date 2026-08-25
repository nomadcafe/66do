/**
 * 交易类型的分组口径，全站唯一来源。
 *
 * 起因：同一个「支出」概念此前在三个地方各写了一套 filter——年度现金流表是
 * buy+fee+transfer+marketing+advertising，月度净现金流是 buy+renew+fee，投资
 * 趋势图是 buy+renew。三张图对同一批数据给出三个不同的支出总额，谁也说不清
 * 哪个是对的。这里按语义定义分组，调用点按名字挑，不再各自写 filter。
 */

import type { Transaction } from '../types/transaction';

export type TransactionType = Transaction['type'];

/**
 * 构成域名持有成本的类型：买入、续费、转移。
 * 与 renewalCostBasis 的口径一致（Total Investment / ROI 的分母就是这三样）。
 */
export const HOLDING_COST_TYPES: readonly TransactionType[] = ['buy', 'renew', 'transfer'];

/**
 * 运营支出：跟域名本身的取得/保有无关，但确实花了钱。
 * 不进持有成本，只进现金流。
 */
export const OPERATING_EXPENSE_TYPES: readonly TransactionType[] = [
  'fee',
  'marketing',
  'advertising',
];

/** 所有代表现金流出的类型 = 持有成本 + 运营支出。sell 是流入，不在此列。 */
export const CASH_OUTFLOW_TYPES: readonly TransactionType[] = [
  ...HOLDING_COST_TYPES,
  ...OPERATING_EXPENSE_TYPES,
];

/**
 * 不含 renew 的流出类型。
 *
 * 凡是同时从 expandRenewalEvents 取续费事件的聚合都要用这个：续费在那条事件流
 * 里已经算过一遍（而且事件流还合并了域名档案上的存量续费），再按交易类型加一次
 * 就是双算。
 */
export const NON_RENEW_OUTFLOW_TYPES: readonly TransactionType[] = CASH_OUTFLOW_TYPES.filter(
  (t) => t !== 'renew'
);

export function isCashOutflowType(type: string): boolean {
  return (CASH_OUTFLOW_TYPES as readonly string[]).includes(type);
}

export function isHoldingCostType(type: string): boolean {
  return (HOLDING_COST_TYPES as readonly string[]).includes(type);
}
