'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';

// 数据缓存接口
interface DataCache<T> {
  data: T[];
  timestamp: number;
  version: number;
}

// 缓存管理器
class CacheManager {
  private cache = new Map<string, DataCache<unknown>>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  set<T>(key: string, data: T[], version: number = 1): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      version
    });
  }

  get<T>(key: string): T[] | null {
    const cached = this.cache.get(key) as DataCache<T> | undefined;
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.CACHE_DURATION;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const cacheManager = new CacheManager();

// 优化的数据管理Hook
export function useOptimizedData() {
  const [domains, setDomains] = useState<DomainWithTags[]>([]);
  const [transactions, setTransactions] = useState<TransactionWithRequiredFields[]>([]);
  const [isLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  
  // 使用ref来避免不必要的重新渲染
  const dataVersionRef = useRef(1);

  // 记忆化的财务指标计算
  const financialMetrics = useMemo(() => {
    if (domains.length === 0 && transactions.length === 0) {
      return {
        totalInvestment: 0,
        totalRevenue: 0,
        totalProfit: 0,
        roi: 0,
        activeDomains: 0,
        soldDomains: 0,
        expiredDomains: 0
      };
    }

    const activeDomains = domains.filter(d => d.status === 'active').length;
    const soldDomains = domains.filter(d => d.status === 'sold').length;
    const expiredDomains = domains.filter(d => d.status === 'expired').length;
    
    const totalInvestment = domains.reduce((sum, domain) => {
      return sum + (domain.purchase_cost || 0) + (domain.renewal_count * (domain.renewal_cost || 0));
    }, 0);

    const totalRevenue = transactions
      .filter(t => t.type === 'sell')
      .reduce((sum, t) => sum + (t.net_amount || t.amount), 0);

    const totalProfit = totalRevenue - totalInvestment;
    const roi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

    return {
      totalInvestment,
      totalRevenue,
      totalProfit,
      roi,
      activeDomains,
      soldDomains,
      expiredDomains
    };
  }, [domains, transactions]);

  // 记忆化的域名统计
  const domainStats = useMemo(() => {
    const stats = {
      byRegistrar: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byYear: {} as Record<string, number>,
      avgPurchasePrice: 0,
      avgSalePrice: 0
    };

    domains.forEach(domain => {
      // 按注册商统计
      const registrar = domain.registrar || 'Unknown';
      stats.byRegistrar[registrar] = (stats.byRegistrar[registrar] || 0) + 1;

      // 按状态统计
      stats.byStatus[domain.status] = (stats.byStatus[domain.status] || 0) + 1;

      // 按年份统计
      if (domain.purchase_date) {
        const year = new Date(domain.purchase_date).getFullYear().toString();
        stats.byYear[year] = (stats.byYear[year] || 0) + 1;
      }
    });

    // 计算平均价格
    const purchasePrices = domains.map(d => d.purchase_cost || 0).filter(p => p > 0);
    const salePrices = domains.map(d => d.sale_price || 0).filter(p => p > 0);

    stats.avgPurchasePrice = purchasePrices.length > 0 
      ? purchasePrices.reduce((sum, price) => sum + price, 0) / purchasePrices.length 
      : 0;

    stats.avgSalePrice = salePrices.length > 0 
      ? salePrices.reduce((sum, price) => sum + price, 0) / salePrices.length 
      : 0;

    return stats;
  }, [domains]);

  // 记忆化的交易统计
  const transactionStats = useMemo(() => {
    const stats = {
      byType: {} as Record<string, number>,
      byMonth: {} as Record<string, number>,
      totalAmount: 0,
      avgAmount: 0
    };

    transactions.forEach(transaction => {
      // 按类型统计
      stats.byType[transaction.type] = (stats.byType[transaction.type] || 0) + 1;

      // 按月份统计
      if (transaction.date) {
        const month = new Date(transaction.date).toISOString().slice(0, 7);
        stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;
      }

      stats.totalAmount += transaction.amount || 0;
    });

    stats.avgAmount = transactions.length > 0 ? stats.totalAmount / transactions.length : 0;

    return stats;
  }, [transactions]);

  // 优化的数据更新函数
  const updateDomains = useCallback((newDomains: DomainWithTags[]) => {
    setDomains(newDomains);
    dataVersionRef.current += 1;
    cacheManager.set('domains', newDomains, dataVersionRef.current);
    setLastUpdate(Date.now());
  }, []);

  const updateTransactions = useCallback((newTransactions: TransactionWithRequiredFields[]) => {
    setTransactions(newTransactions);
    dataVersionRef.current += 1;
    cacheManager.set('transactions', newTransactions, dataVersionRef.current);
    setLastUpdate(Date.now());
  }, []);

  // 批量更新数据
  const updateData = useCallback((
    newDomains: DomainWithTags[], 
    newTransactions: TransactionWithRequiredFields[]
  ) => {
    setDomains(newDomains);
    setTransactions(newTransactions);
    dataVersionRef.current += 1;
    cacheManager.set('domains', newDomains, dataVersionRef.current);
    cacheManager.set('transactions', newTransactions, dataVersionRef.current);
    setLastUpdate(Date.now());
  }, []);

  // 从缓存加载数据
  const loadFromCache = useCallback(() => {
    const cachedDomains = cacheManager.get<DomainWithTags>('domains');
    const cachedTransactions = cacheManager.get<TransactionWithRequiredFields>('transactions');

    if (cachedDomains) {
      setDomains(cachedDomains);
    }
    if (cachedTransactions) {
      setTransactions(cachedTransactions);
    }

    return { domains: cachedDomains, transactions: cachedTransactions };
  }, []);

  // 清除缓存
  const clearCache = useCallback(() => {
    cacheManager.clear();
  }, []);

  // 无效化特定缓存
  const invalidateCache = useCallback((key: 'domains' | 'transactions') => {
    cacheManager.invalidate(key);
  }, []);

  return {
    // 数据
    domains,
    transactions,
    isLoading,
    lastUpdate,
    
    // 计算属性
    financialMetrics,
    domainStats,
    transactionStats,
    
    // 更新函数
    updateDomains,
    updateTransactions,
    updateData,
    
    // 缓存管理
    loadFromCache,
    clearCache,
    invalidateCache
  };
}

// 防抖Hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// 节流Hook
export function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastExecuted = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    if (now - lastExecuted.current >= delay) {
      setThrottledValue(value);
      lastExecuted.current = now;
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(value);
        lastExecuted.current = Date.now();
      }, delay - (now - lastExecuted.current));

      return () => clearTimeout(timer);
    }
  }, [value, delay]);

  return throttledValue;
}
