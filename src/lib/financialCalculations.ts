// 单域名 ROI / 货币格式化 / 过期损失。组合层面的财务指标
// （ROI、年化、夏普、波动率、年化收益率等）一律走 coreCalculations.ts。

import { totalRenewalCostForHolding } from './renewalCostBasis';

/**
 * 计算单个域名的 ROI（Domain Portfolio 表格/卡片使用）
 * 公式：ROI = (净收入 - 总持有成本) / 总持有成本 × 100
 * - 总持有成本 = 购买成本(purchase_cost) + 续费次数(renewal_count) × 单次续费(renewal_cost)
 * - 已出售：净收入 = 售价(sale_price) - 平台手续费(platform_fee)
 * - 过期：视为 -100%
 * - 持有中且有预估价值：净收入用 estimated_value 代入
 */
export function calculateDomainROI(
  domain: {
    id?: string;
    purchase_cost?: number | null;
    renewal_cost?: number | null;
    renewal_count: number;
    baseline_renewal_as_of?: string | null;
    status: string;
    sale_price?: number | null;
    platform_fee?: number | null;
    estimated_value?: number | null;
    expiry_date?: string | null;
  },
  transactions?: Array<{ domain_id: string; type: string; date: string; amount: number }>
): number {
  const purchaseCost = domain.purchase_cost || 0;
  const renewalCost =
    domain.id && transactions
      ? totalRenewalCostForHolding(
          {
            id: domain.id,
            renewal_count: domain.renewal_count,
            renewal_cost: domain.renewal_cost,
            baseline_renewal_as_of: domain.baseline_renewal_as_of ?? null
          },
          transactions
        )
      : domain.renewal_count * (domain.renewal_cost || 0);
  const totalHoldingCost = purchaseCost + renewalCost;

  if (totalHoldingCost === 0) return 0;

  // 已出售：净收入 = 售价 - 平台费（售价为空或 0 时按 0 收入，即 -100%）
  if (domain.status === 'sold') {
    const netRevenue = (domain.sale_price ?? 0) - (domain.platform_fee || 0);
    return ((netRevenue - totalHoldingCost) / totalHoldingCost) * 100;
  }

  if (domain.status === 'expired') return -100;

  if (domain.expiry_date) {
    const now = new Date();
    const expiryDate = new Date(domain.expiry_date);
    if (!isNaN(expiryDate.getTime()) && expiryDate < now) return -100;
  }

  if (domain.estimated_value != null && domain.estimated_value > 0) {
    return ((domain.estimated_value - totalHoldingCost) / totalHoldingCost) * 100;
  }

  return 0;
}

// 格式化货币
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency
  }).format(amount);
}

/**
 * 过期域名损失口径（与续费持有成本一致）：
 * - 损失金额 = 购买成本 + renewal_count × renewal_cost（已发生续费成本）
 * - 视为全额冲销：未扣减任何售出/回款；若曾部分出售需在交易层单独体现
 * - 无 expiry_date 但 status=expired 时，仍计入列表；年度归桶优先用 purchase_date 年，否则归入 unknown
 */
export interface ExpiredDomainLoss {
  totalLoss: number;
  annualLoss: { [year: string]: number };
  expiredDomains: Array<{
    id: string;
    domain_name: string;
    totalInvestment: number;
    /** 到期日；null 表示未填 expiry_date */
    expiryDate: string | null;
    /** 用于年度汇总：到期年，或购买年，或 unknown */
    lossYear: string;
  }>;
  lossByYear: Array<{
    year: string;
    loss: number;
    domainCount: number;
  }>;
}

// 计算过期域名损失
export function calculateExpiredDomainLoss(
  domains: Array<{
    id: string;
    domain_name: string;
    purchase_cost?: number | null;
    renewal_cost?: number | null;
    renewal_count: number;
    baseline_renewal_as_of?: string | null;
    status: string;
    expiry_date?: string | null;
    purchase_date?: string | null;
  }>,
  transactions?: Array<{ domain_id: string; type: string; date: string; amount: number }>
): ExpiredDomainLoss {
  const expiredDomains: ExpiredDomainLoss['expiredDomains'] = [];
  const annualLoss: { [year: string]: number } = {};
  let totalLoss = 0;

  domains.forEach(domain => {
    // 损失只算用户明确标 expired 的域名（= 主动放弃续费）。
    // 仅 expiry_date < now 但状态仍是 active/for_sale 的，是"逾期催办"信号，
    // 属于到期监控范畴，不在损失分析里归账，避免与 dashboard 的 next-expiry 提示重复。
    if (domain.status !== 'expired') return;

    const expiryDateStr: string | null = domain.expiry_date ?? null;
    const expiryDate: Date | null = domain.expiry_date ? new Date(domain.expiry_date) : null;

    const purchaseCost = domain.purchase_cost || 0;
    const renewalCost = transactions
      ? totalRenewalCostForHolding(
          {
            id: domain.id,
            renewal_count: domain.renewal_count,
            renewal_cost: domain.renewal_cost,
            baseline_renewal_as_of: domain.baseline_renewal_as_of ?? null
          },
          transactions
        )
      : (domain.renewal_count ?? 0) * (domain.renewal_cost || 0);
    const totalInvestment = purchaseCost + renewalCost;

    if (totalInvestment <= 0) return;

    let lossYear: string;
    if (expiryDate) {
      lossYear = expiryDate.getFullYear().toString();
    } else if (domain.purchase_date) {
      lossYear = new Date(domain.purchase_date).getFullYear().toString();
    } else {
      lossYear = 'unknown';
    }

    expiredDomains.push({
      id: domain.id,
      domain_name: domain.domain_name,
      totalInvestment,
      expiryDate: expiryDateStr,
      lossYear
    });

    annualLoss[lossYear] = (annualLoss[lossYear] || 0) + totalInvestment;
    totalLoss += totalInvestment;
  });

  // 按年份排序
  const lossByYear = Object.entries(annualLoss)
    .map(([year, loss]) => ({
      year,
      loss,
      domainCount: expiredDomains.filter((d) => d.lossYear === year).length
    }))
    .sort((a, b) => {
      if (a.year === 'unknown') return 1;
      if (b.year === 'unknown') return -1;
      return parseInt(a.year, 10) - parseInt(b.year, 10);
    });

  return {
    totalLoss,
    annualLoss,
    expiredDomains,
    lossByYear
  };
}
