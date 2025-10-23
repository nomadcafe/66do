/**
 * WHOIS 查询服务
 * 用于获取域名的真实到期时间
 */

export interface WhoisData {
  domain: string;
  registrar: string;
  creationDate: string;
  expiryDate: string;
  lastUpdated: string;
  nameServers: string[];
  status: string[];
  rawData: string;
}

export interface WhoisError {
  domain: string;
  error: string;
  code: string;
}

export class WhoisService {
  private static instance: WhoisService;
  private cache: Map<string, { data: WhoisData; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时缓存

  static getInstance(): WhoisService {
    if (!WhoisService.instance) {
      WhoisService.instance = new WhoisService();
    }
    return WhoisService.instance;
  }

  /**
   * 查询域名WHOIS信息
   * 注意：由于CORS限制，这里使用模拟数据
   * 实际应用中需要后端API支持
   */
  async queryWhois(domain: string): Promise<WhoisData | WhoisError> {
    // 检查缓存
    const cached = this.cache.get(domain);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // 模拟WHOIS查询 - 实际应用中应该调用后端API
      const mockData = await this.simulateWhoisQuery(domain);
      
      // 缓存结果
      this.cache.set(domain, {
        data: mockData,
        timestamp: Date.now()
      });

      return mockData;
    } catch (error) {
      return {
        domain,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'WHOIS_ERROR'
      };
    }
  }

  /**
   * 批量查询多个域名
   */
  async batchQueryWhois(domains: string[]): Promise<(WhoisData | WhoisError)[]> {
    const results = await Promise.allSettled(
      domains.map(domain => this.queryWhois(domain))
    );

    return results.map(result => 
      result.status === 'fulfilled' ? result.value : {
        domain: 'unknown',
        error: result.reason?.message || 'Query failed',
        code: 'BATCH_ERROR'
      }
    );
  }

  /**
   * 模拟WHOIS查询
   * 实际应用中应该调用真实的WHOIS API
   */
  private async simulateWhoisQuery(domain: string): Promise<WhoisData> {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    // 生成模拟的到期时间（1-10年后）
    const yearsFromNow = 1 + Math.random() * 9;
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + yearsFromNow);

    // 生成创建时间（1-20年前）
    const yearsAgo = 1 + Math.random() * 19;
    const creationDate = new Date();
    creationDate.setFullYear(creationDate.getFullYear() - yearsAgo);

    return {
      domain,
      registrar: this.getRandomRegistrar(),
      creationDate: creationDate.toISOString().split('T')[0],
      expiryDate: expiryDate.toISOString().split('T')[0],
      lastUpdated: new Date().toISOString().split('T')[0],
      nameServers: [
        'ns1.example.com',
        'ns2.example.com'
      ],
      status: ['clientTransferProhibited', 'clientUpdateProhibited'],
      rawData: `Domain: ${domain}\nRegistrar: ${this.getRandomRegistrar()}\nExpiry: ${expiryDate.toISOString().split('T')[0]}`
    };
  }

  private getRandomRegistrar(): string {
    const registrars = [
      'GoDaddy.com, LLC',
      'Namecheap, Inc.',
      'Google LLC',
      'Cloudflare, Inc.',
      'Name.com, Inc.',
      'Network Solutions, LLC',
      'Tucows Domains Inc.',
      '1&1 IONOS SE'
    ];
    return registrars[Math.floor(Math.random() * registrars.length)];
  }

  /**
   * 清理过期缓存
   */
  cleanExpiredCache(): void {
    const now = Date.now();
    for (const [domain, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_DURATION) {
        this.cache.delete(domain);
      }
    }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; domains: string[] } {
    return {
      size: this.cache.size,
      domains: Array.from(this.cache.keys())
    };
  }
}

export const whoisService = WhoisService.getInstance();
