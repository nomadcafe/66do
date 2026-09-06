// 单域名 ROI（TransactionList 用）+ 百分比格式化工具。
// 组合层面的财务指标走 coreCalculations.ts。

import { sellGrossUSD, sellNetUSD } from './coreCalculations';
import {
  totalRenewalCostForHolding,
  transferCostForDomain,
  acquisitionCostForDomain,
} from './renewalCostBasis';
import { isDomainLost } from './domainLossStatus';
import { txsForDomain } from './txIndex';

interface DomainROI {
  domainId: string;
  domainName: string;
  totalInvestment: number;      // 总投资（购买+续费）
  totalSales: number;          // 总销售额
  netRevenue: number;          // 净收入（扣除手续费）
  grossProfit: number;          // 毛利润（净收入-投资成本）
  roi: number;                 // ROI百分比
  holdingPeriod: number;        // 持有天数
  status: string;
  saleDate?: string;
}

// 计算单个域名的ROI
export function calculateDomainROI(
  domain: {
    id: string;
    domain_name: string;
    purchase_cost: number | null;
    renewal_cost: number | null;
    renewal_count: number;
    baseline_renewal_as_of?: string | null;
    purchase_date: string | null;
    status: string;
    expiry_date?: string | null;
  },
  transactions: Array<{
    domain_id: string;
    type: string;
    amount: number;
    platform_fee?: number | null;
    net_amount?: number | null;
    date: string;
  }>
): DomainROI {
  
  // 成本函数直接吃完整数组：它们内部走 txIndex 的 WeakMap 索引（以数组本身
  // 为键）按 domain_id 取桶。在这里先 filter 一遍会产生新数组，每调一次就让
  // 索引重建一次——列表里每行调一次，等于 O(行数 × 交易数 × 4 个索引)。
  const purchaseCost = acquisitionCostForDomain(
    { id: domain.id, purchase_cost: domain.purchase_cost },
    transactions
  );
  const renewalCost = totalRenewalCostForHolding(
    {
      id: domain.id,
      renewal_count: domain.renewal_count,
      renewal_cost: domain.renewal_cost,
      baseline_renewal_as_of: domain.baseline_renewal_as_of ?? null
    },
    transactions
  );
  const transferCost = transferCostForDomain(domain.id, transactions);
  const totalInvestment = purchaseCost + renewalCost + transferCost;

  // 销售收入
  const salesTransactions = txsForDomain(transactions, domain.id).filter(t => t.type === 'sell');
  const totalSales = salesTransactions.reduce((sum, t) => sum + sellGrossUSD(t), 0);
  const netRevenue = salesTransactions.reduce((sum, t) => sum + sellNetUSD(t), 0);
  
  // 检查域名是否构成损失（手动 expired 或过期超过宽限期未续，口径见 domainLossStatus）
  const isExpired = isDomainLost(domain);
  
  // 利润和ROI
  let grossProfit: number;
  let roi: number;
  
  if (isExpired) {
    // 过期域名：100%损失
    grossProfit = -totalInvestment;
    roi = -100;
  } else {
    // 正常计算
    grossProfit = netRevenue - totalInvestment;
    roi = totalInvestment > 0 ? (grossProfit / totalInvestment) * 100 : 0;
  }
  
  // 持有期
  const purchaseDate = new Date(domain.purchase_date || '');
  const currentDate = new Date();
  const holdingPeriod = Math.floor((currentDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // 销售日期
  const saleDate = salesTransactions.length > 0 ? salesTransactions[0].date : undefined;
  
  return {
    domainId: domain.id,
    domainName: domain.domain_name,
    totalInvestment,
    totalSales,
    netRevenue,
    grossProfit,
    roi,
    holdingPeriod,
    status: domain.status,
    saleDate
  };
}

// 格式化百分比
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}
