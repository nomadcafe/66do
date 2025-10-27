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
  annualCost: AnnualRenewalCost,
  domains?: Array<{
    id: string;
    domain_name: string;
    renewal_cost: number | null;
    renewal_cycle: number;
    estimated_value?: number | null;
    purchase_cost?: number | null;
    status: string;
  }>
): string[] {
  const suggestions: string[] = [];
  
  // 检查续费成本分布
  const totalCost = annualCost.totalAnnualCost;
  const domainsCount = annualCost.domainsNeedingRenewal.length;
  
  if (domainsCount === 0) {
    suggestions.push('🎯 今年没有域名需要续费，这是投资新域名的好时机！建议关注高价值域名机会。');
    return suggestions;
  }
  
  // 计算平均域名价值（如果有数据）
  let avgDomainValue = 0;
  let highValueDomainsCount = 0;
  if (domains) {
    const validDomains = domains.filter(d => d.estimated_value && d.estimated_value > 0);
    if (validDomains.length > 0) {
      avgDomainValue = validDomains.reduce((sum, d) => sum + (d.estimated_value || 0), 0) / validDomains.length;
      highValueDomainsCount = validDomains.filter(d => (d.estimated_value || 0) > avgDomainValue * 2).length;
    }
  }
  
  // 智能月度分布分析
  const monthlyCosts = Object.values(annualCost.monthlyDistribution);
  const maxMonthlyCost = Math.max(...monthlyCosts);
  const avgMonthlyCost = totalCost / 12;
  const costConcentrationRatio = maxMonthlyCost / avgMonthlyCost;
  
  if (costConcentrationRatio > 2.5) {
    const peakMonth = Object.entries(annualCost.monthlyDistribution)
      .find(([_, cost]) => cost === maxMonthlyCost)?.[0];
    const monthName = peakMonth ? new Date(2024, parseInt(peakMonth), 1).toLocaleDateString('zh-CN', { month: 'long' }) : '某月';
    suggestions.push(`⚠️ 续费成本在${monthName}过于集中（${costConcentrationRatio.toFixed(1)}倍于平均值），建议提前续费或调整域名到期时间分散风险。`);
  } else if (costConcentrationRatio < 1.2) {
    suggestions.push('✅ 续费时间分布很均匀，这有助于现金流管理！');
  }
  
  // 智能续费周期分析
  const cycleEntries = Object.entries(annualCost.costByCycle);
  if (cycleEntries.length > 1) {
    const sortedCycles = cycleEntries.sort((a, b) => b[1] - a[1]);
    const dominantCycle = sortedCycles[0];
    const dominantPercentage = (dominantCycle[1] / totalCost) * 100;
    
    if (dominantPercentage > 70) {
      suggestions.push(`📊 您的域名主要集中在${dominantCycle[0]}续费周期，占总成本的${dominantPercentage.toFixed(1)}%。考虑是否适合您的投资策略。`);
    } else if (dominantPercentage < 40) {
      suggestions.push(`🔄 续费周期分布较为分散，这提供了很好的灵活性，但可能增加管理复杂度。`);
    }
  }
  
  // 基于价值的智能建议
  if (domains && avgDomainValue > 0) {
    const renewalToValueRatio = totalCost / (avgDomainValue * domainsCount);
    if (renewalToValueRatio > 0.1) {
      suggestions.push(`💰 续费成本占域名平均价值的${(renewalToValueRatio * 100).toFixed(1)}%，建议评估低价值域名的续费必要性。`);
    } else if (renewalToValueRatio < 0.02) {
      suggestions.push(`💎 续费成本相对域名价值很低，这些域名值得长期持有！`);
    }
  }
  
  // 成本优化建议（更智能的阈值）
  // const avgCostPerDomain = totalCost / domainsCount;
  if (totalCost > 50000) {
    suggestions.push(`💳 年度续费成本较高（$${totalCost.toLocaleString()}），建议联系注册商洽谈批量续费折扣，通常可获得5-15%优惠。`);
  } else if (totalCost > 10000) {
    suggestions.push(`💡 续费成本适中，考虑批量续费以获得更好价格，或评估是否所有域名都值得续费。`);
  }
  
  // 基于域名数量的管理建议
  if (domainsCount > 100) {
    suggestions.push(`🔧 管理${domainsCount}个域名的续费确实需要系统化方法，建议使用域名管理工具或建立续费提醒系统。`);
  } else if (domainsCount > 20) {
    suggestions.push(`📅 建议设置续费提醒，避免域名意外过期造成损失。`);
  }
  
  // 基于高价值域名的特殊建议
  if (highValueDomainsCount > 0) {
    suggestions.push(`⭐ 您有${highValueDomainsCount}个高价值域名需要续费，建议优先处理并考虑提前续费保护。`);
  }
  
  // 如果没有其他建议，提供一般性建议
  if (suggestions.length === 0) {
    suggestions.push('📈 您的域名续费策略看起来不错！继续保持定期审查和优化。');
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
