// 续费成本计算工具函数
export interface RenewalInfo {
  domainId: string;
  domainName: string;
  renewalCost: number;
  renewalCycle: number;
  nextRenewalDate: string;
  yearsUntilRenewal: number;
  needsRenewalThisYear: boolean;
  lastRenewalDate?: string;
}

export interface AnnualRenewalCost {
  totalAnnualCost: number;
  domainsNeedingRenewal: RenewalInfo[];
  domainsNotNeedingRenewal: RenewalInfo[];
  costByCycle: { [cycle: string]: number };
  monthlyDistribution: { [month: string]: number };
}

// 计算今年需要续费的域名
export function calculateAnnualRenewalCost(
  domains: Array<{
    id: string;
    domain_name: string;
    renewal_cost: number;
    renewal_cycle: number;
    renewal_count: number;
    purchase_date: string;
    expiry_date?: string; // 改为可选字段
    status: string;
  }>,
  targetYear: number = new Date().getFullYear()
): AnnualRenewalCost {
  
  const domainsNeedingRenewal: RenewalInfo[] = [];
  const domainsNotNeedingRenewal: RenewalInfo[] = [];
  const costByCycle: { [cycle: string]: number } = {};
  const monthlyDistribution: { [month: string]: number } = {};
  
  // 初始化月度分布
  for (let month = 0; month < 12; month++) {
    monthlyDistribution[month.toString()] = 0;
  }
  
  domains.forEach(domain => {
    if (domain.status !== 'active') return;
    
    // 如果没有到期日期，跳过续费计算
    if (!domain.expiry_date) return;
    
    const purchaseDate = new Date(domain.purchase_date);
    const expiryDate = new Date(domain.expiry_date);
    
    // 计算域名在目标年份的续费状态
    const renewalInfo = calculateDomainRenewalStatus(
      domain,
      targetYear,
      purchaseDate,
      expiryDate
    );
    
    if (renewalInfo.needsRenewalThisYear) {
      domainsNeedingRenewal.push(renewalInfo);
      
      // 按续费周期统计成本
      const cycleKey = `${renewalInfo.renewalCycle}年`;
      costByCycle[cycleKey] = (costByCycle[cycleKey] || 0) + renewalInfo.renewalCost;
      
      // 按月份分布（假设在到期月份续费）
      const renewalMonth = new Date(renewalInfo.nextRenewalDate).getMonth();
      monthlyDistribution[renewalMonth.toString()] += renewalInfo.renewalCost;
    } else {
      domainsNotNeedingRenewal.push(renewalInfo);
    }
  });
  
  const totalAnnualCost = domainsNeedingRenewal.reduce(
    (sum, domain) => sum + domain.renewalCost, 
    0
  );
  
  return {
    totalAnnualCost,
    domainsNeedingRenewal,
    domainsNotNeedingRenewal,
    costByCycle,
    monthlyDistribution
  };
}

// 计算单个域名的续费状态
function calculateDomainRenewalStatus(
  domain: {
    id: string;
    domain_name: string;
    renewal_cost: number;
    renewal_cycle: number;
    renewal_count: number;
    purchase_date: string;
    expiry_date?: string; // 改为可选字段
  },
  targetYear: number,
  purchaseDate: Date,
  expiryDate: Date
): RenewalInfo {
  
  // 计算域名在目标年份的到期日期
  const domainExpiryInTargetYear = new Date(expiryDate);
  const targetYearEnd = new Date(targetYear, 11, 31);
  
  // 如果域名在目标年份之前就到期了，需要续费
  const needsRenewal = domainExpiryInTargetYear <= targetYearEnd;
  
  // 计算下次续费日期
  let nextRenewalDate: Date;
  if (needsRenewal) {
    // 如果今年需要续费，下次续费日期就是到期日期
    nextRenewalDate = new Date(domainExpiryInTargetYear);
  } else {
    // 如果今年不需要续费，计算下次续费日期
    nextRenewalDate = calculateNextRenewalDate(
      purchaseDate,
      domain.renewal_cycle,
      domain.renewal_count
    );
  }
  
  // 计算距离下次续费的年数
  const yearsUntilRenewal = calculateYearsUntilRenewal(
    new Date(),
    nextRenewalDate
  );
  
  return {
    domainId: domain.id,
    domainName: domain.domain_name,
    renewalCost: domain.renewal_cost,
    renewalCycle: domain.renewal_cycle,
    nextRenewalDate: nextRenewalDate.toISOString().split('T')[0],
    yearsUntilRenewal,
    needsRenewalThisYear: needsRenewal,
    lastRenewalDate: domain.renewal_count > 0 ? 
      calculateLastRenewalDate(purchaseDate, domain.renewal_cycle, domain.renewal_count) : 
      undefined
  };
}

// 计算下次续费日期
function calculateNextRenewalDate(
  purchaseDate: Date,
  renewalCycle: number,
  renewalCount: number
): Date {
  // 计算域名已经续费的总年数
  const totalYearsRenewed = renewalCount * renewalCycle;
  
  // 计算下次续费日期
  const nextRenewalDate = new Date(purchaseDate);
  nextRenewalDate.setFullYear(
    nextRenewalDate.getFullYear() + totalYearsRenewed + renewalCycle
  );
  
  return nextRenewalDate;
}

// 计算上次续费日期
function calculateLastRenewalDate(
  purchaseDate: Date,
  renewalCycle: number,
  renewalCount: number
): string {
  if (renewalCount === 0) return purchaseDate.toISOString().split('T')[0];
  
  const lastRenewalDate = new Date(purchaseDate);
  lastRenewalDate.setFullYear(
    lastRenewalDate.getFullYear() + (renewalCount * renewalCycle)
  );
  
  return lastRenewalDate.toISOString().split('T')[0];
}

// 计算距离下次续费的年数
function calculateYearsUntilRenewal(
  currentDate: Date,
  nextRenewalDate: Date
): number {
  const timeDiff = nextRenewalDate.getTime() - currentDate.getTime();
  const yearsDiff = timeDiff / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(0, yearsDiff);
}

// 计算多年续费成本预测
export function calculateMultiYearRenewalCost(
  domains: Array<{
    id: string;
    domain_name: string;
    renewal_cost: number;
    renewal_cycle: number;
    renewal_count: number;
    purchase_date: string;
    expiry_date: string;
    status: string;
  }>,
  years: number = 5
): { [year: string]: AnnualRenewalCost } {
  const result: { [year: string]: AnnualRenewalCost } = {};
  const currentYear = new Date().getFullYear();
  
  for (let year = currentYear; year < currentYear + years; year++) {
    result[year.toString()] = calculateAnnualRenewalCost(domains, year);
  }
  
  return result;
}

// 计算续费成本优化建议
export function getRenewalOptimizationSuggestions(
  annualCost: AnnualRenewalCost
): string[] {
  const suggestions: string[] = [];
  
  // 检查续费成本分布
  const totalCost = annualCost.totalAnnualCost;
  const domainsCount = annualCost.domainsNeedingRenewal.length;
  
  if (domainsCount === 0) {
    suggestions.push('今年没有域名需要续费，可以专注于新域名投资');
    return suggestions;
  }
  
  // 检查月度分布是否均匀
  const monthlyCosts = Object.values(annualCost.monthlyDistribution);
  const maxMonthlyCost = Math.max(...monthlyCosts);
  const avgMonthlyCost = totalCost / 12;
  
  if (maxMonthlyCost > avgMonthlyCost * 2) {
    suggestions.push('续费成本在某些月份过于集中，考虑分散续费时间');
  }
  
  // 检查续费周期分布
  const cycleEntries = Object.entries(annualCost.costByCycle);
  if (cycleEntries.length > 1) {
    const dominantCycle = cycleEntries.reduce((a, b) => a[1] > b[1] ? a : b);
    suggestions.push(`主要续费周期是${dominantCycle[0]}，占总成本的${((dominantCycle[1] / totalCost) * 100).toFixed(1)}%`);
  }
  
  // 成本优化建议
  if (totalCost > 10000) {
    suggestions.push('续费成本较高，考虑批量续费折扣或更换注册商');
  }
  
  if (annualCost.domainsNeedingRenewal.length > 50) {
    suggestions.push('需要续费的域名较多，建议使用批量续费工具');
  }
  
  return suggestions;
}

// 格式化续费信息显示
export function formatRenewalInfo(renewalInfo: RenewalInfo, currency: string = 'USD'): string {
  const nextRenewalDate = new Date(renewalInfo.nextRenewalDate);
  const formattedDate = nextRenewalDate.toLocaleDateString('zh-CN');
  
  // 格式化货币
  const formattedCost = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(renewalInfo.renewalCost);
  
  if (renewalInfo.needsRenewalThisYear) {
    return `${renewalInfo.domainName} - 今年需要续费 (${formattedDate}) - ${formattedCost}`;
  } else {
    return `${renewalInfo.domainName} - ${renewalInfo.yearsUntilRenewal.toFixed(1)}年后续费 (${formattedDate}) - ${formattedCost}`;
  }
}
