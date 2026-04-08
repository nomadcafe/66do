/** 计算出售毛/净额所需字段（兼容报表内联 Transaction 类型） */
export type SellProceedsFields = {
  amount?: number | null;
  base_amount?: number | null;
  net_amount?: number | null;
  platform_fee?: number | null;
};

/** 出售毛额（与 Total Sales 一致）：优先 base_amount，否则 amount */
export function sellGrossUSD(t: SellProceedsFields): number {
  if (t.base_amount != null && t.base_amount !== undefined) {
    const v = Number(t.base_amount);
    if (Number.isFinite(v)) return v;
  }
  const a = Number(t.amount);
  return Number.isFinite(a) ? a : 0;
}

/** 出售净额（扣平台费后，与 Total Revenue / 净利润口径一致） */
export function sellNetUSD(t: SellProceedsFields): number {
  if (t.net_amount != null && t.net_amount !== undefined) {
    const n = Number(t.net_amount);
    if (Number.isFinite(n)) return n;
  }
  return sellGrossUSD(t) - (Number(t.platform_fee) || 0);
}
