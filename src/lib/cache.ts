// 数据缓存系统
interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

export class DataCache {
  private cache: Map<string, CacheItem<unknown>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    hitRate: 0
  };
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5分钟默认TTL

  // 设置缓存
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const now = Date.now();
    const expiry = now + ttl;
    
    this.cache.set(key, {
      data,
      timestamp: now,
      expiry
    });
    
    this.updateStats();
  }

  // 获取缓存
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      this.updateStats();
      return null;
    }

    const now = Date.now();
    if (now > item.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateStats();
      return null;
    }

    this.stats.hits++;
    this.updateStats();
    return item.data as T;
  }

  // 检查缓存是否存在且未过期
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    const now = Date.now();
    if (now > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  // 删除缓存
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  // 清空所有缓存
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      hitRate: 0
    };
  }

  // 清理过期缓存
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    this.updateStats();
    return cleaned;
  }

  // 更新统计信息
  private updateStats(): void {
    this.stats.size = this.cache.size;
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  // 获取统计信息
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // 获取缓存大小
  getSize(): number {
    return this.cache.size;
  }

  // 批量设置缓存
  setMultiple<T>(items: Array<{ key: string; data: T; ttl?: number }>): void {
    items.forEach(({ key, data, ttl }) => {
      this.set(key, data, ttl);
    });
  }

  // 批量获取缓存
  getMultiple<T>(keys: string[]): Map<string, T | null> {
    const results = new Map<string, T | null>();
    
    keys.forEach(key => {
      results.set(key, this.get<T>(key));
    });
    
    return results;
  }
}

// 域名数据缓存
export class DomainCache extends DataCache {
  // 缓存域名列表
  cacheDomains(userId: string, domains: unknown[], ttl?: number): void {
    this.set(`domains_${userId}`, domains, ttl);
  }

  // 获取缓存的域名列表
  getCachedDomains(userId: string): unknown[] | null {
    return this.get(`domains_${userId}`);
  }

  // 缓存域名详情
  cacheDomain(domainId: string, domain: unknown, ttl?: number): void {
    this.set(`domain_${domainId}`, domain, ttl);
  }

  // 获取缓存的域名详情
  getCachedDomain(domainId: string): unknown | null {
    return this.get(`domain_${domainId}`);
  }

  // 缓存交易记录
  cacheTransactions(userId: string, transactions: unknown[], ttl?: number): void {
    this.set(`transactions_${userId}`, transactions, ttl);
  }

  // 获取缓存的交易记录
  getCachedTransactions(userId: string): unknown[] | null {
    return this.get(`transactions_${userId}`);
  }

  // 缓存统计数据
  cacheStats(userId: string, stats: unknown, ttl?: number): void {
    this.set(`stats_${userId}`, stats, ttl);
  }

  // 获取缓存的统计数据
  getCachedStats(userId: string): unknown | null {
    return this.get(`stats_${userId}`);
  }

  // 缓存市场价值
  cacheMarketValue(domain: string, value: unknown, ttl?: number): void {
    this.set(`market_${domain}`, value, ttl);
  }

  // 获取缓存的市场价值
  getCachedMarketValue(domain: string): unknown | null {
    return this.get(`market_${domain}`);
  }

  // 清理用户相关缓存
  clearUserCache(userId: string): void {
    const keys = [
      `domains_${userId}`,
      `transactions_${userId}`,
      `stats_${userId}`
    ];
    
    keys.forEach(key => this.delete(key));
  }
}

// 导出单例实例
export const domainCache = new DomainCache();

// 自动清理过期缓存（每5分钟）
setInterval(() => {
  const cleaned = domainCache.cleanup();
  if (cleaned > 0) {
    console.log(`Cleaned ${cleaned} expired cache items`);
  }
}, 5 * 60 * 1000);
