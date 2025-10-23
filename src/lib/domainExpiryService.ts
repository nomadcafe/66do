/**
 * 统一的域名到期管理服务
 * 整合WHOIS查询、到期监控和提醒功能
 */

import { Domain } from '../types/domain';
import { whoisService, WhoisData } from './whoisService';

export interface DomainExpiryInfo {
  domain: Domain;
  daysUntilExpiry: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  whoisData?: WhoisData;
  isWhoisVerified: boolean;
  lastChecked: Date;
}

export interface ExpiryMonitoringConfig {
  criticalDays: number;    // 7天
  highDays: number;       // 30天
  mediumDays: number;      // 60天
  lowDays: number;         // 90天
  autoCheckInterval: number; // 检查间隔（小时）
  enableWhoisSync: boolean;  // 是否启用WHOIS同步
}

export class DomainExpiryService {
  private static instance: DomainExpiryService;
  private config: ExpiryMonitoringConfig;
  private monitoringDomains: Set<string> = new Set();
  private expiryInfoCache: Map<string, DomainExpiryInfo> = new Map();
  private lastCheckTime: Date | null = null;

  constructor() {
    this.config = {
      criticalDays: 7,
      highDays: 30,
      mediumDays: 60,
      lowDays: 90,
      autoCheckInterval: 24, // 24小时检查一次
      enableWhoisSync: true
    };
  }

  static getInstance(): DomainExpiryService {
    if (!DomainExpiryService.instance) {
      DomainExpiryService.instance = new DomainExpiryService();
    }
    return DomainExpiryService.instance;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ExpiryMonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 分析域名到期情况
   */
  async analyzeDomainExpiry(domains: Domain[]): Promise<DomainExpiryInfo[]> {
    const results: DomainExpiryInfo[] = [];
    const now = new Date();

    for (const domain of domains) {
      // 跳过已出售或过期的域名
      if (domain.status === 'sold' || domain.status === 'expired') {
        continue;
      }

      let expiryDate: Date | null = null;
      let whoisData: WhoisData | undefined;
      let isWhoisVerified = false;

      // 优先使用WHOIS数据
      if (this.config.enableWhoisSync) {
        try {
          const whoisResult = await whoisService.queryWhois(domain.domain_name);
          if ('expiryDate' in whoisResult) {
            whoisData = whoisResult;
            expiryDate = new Date(whoisResult.expiryDate);
            isWhoisVerified = true;
          }
        } catch (error) {
          console.warn(`WHOIS查询失败: ${domain.domain_name}`, error);
        }
      }

      // 如果WHOIS查询失败，使用手动输入的到期日期
      if (!expiryDate && domain.expiry_date) {
        expiryDate = new Date(domain.expiry_date);
      }

      // 如果都没有，跳过
      if (!expiryDate) {
        continue;
      }

      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // 只处理即将到期的域名
      if (daysUntilExpiry <= this.config.lowDays && daysUntilExpiry >= 0) {
        const priority = this.getPriority(daysUntilExpiry);
        const message = this.generateMessage(domain.domain_name, daysUntilExpiry, priority);

        const expiryInfo: DomainExpiryInfo = {
          domain,
          daysUntilExpiry,
          priority,
          message,
          whoisData,
          isWhoisVerified,
          lastChecked: now
        };

        results.push(expiryInfo);
        this.expiryInfoCache.set(domain.id, expiryInfo);
      }
    }

    this.lastCheckTime = now;
    return results;
  }

  /**
   * 批量同步WHOIS数据
   */
  async syncWhoisData(domains: Domain[]): Promise<{ updated: number; errors: number }> {
    let updated = 0;
    let errors = 0;

    const domainNames = domains
      .filter(d => d.status === 'active' || d.status === 'for_sale')
      .map(d => d.domain_name);

    const whoisResults = await whoisService.batchQueryWhois(domainNames);

    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      const result = whoisResults[i];

      if ('expiryDate' in result) {
        // 更新域名的到期日期
        domain.expiry_date = result.expiryDate;
        domain.registrar = result.registrar;
        updated++;
      } else {
        errors++;
        console.warn(`WHOIS同步失败: ${domain.domain_name}`, result.error);
      }
    }

    return { updated, errors };
  }

  /**
   * 获取优先级
   */
  private getPriority(daysUntilExpiry: number): 'critical' | 'high' | 'medium' | 'low' {
    if (daysUntilExpiry <= this.config.criticalDays) return 'critical';
    if (daysUntilExpiry <= this.config.highDays) return 'high';
    if (daysUntilExpiry <= this.config.mediumDays) return 'medium';
    return 'low';
  }

  /**
   * 生成提醒消息
   */
  private generateMessage(domainName: string, daysUntilExpiry: number, _priority: string): string {
    // const priorityText = {
    //   critical: '紧急',
    //   high: '重要',
    //   medium: '注意',
    //   low: '提醒'
    // }[priority];

    if (daysUntilExpiry === 0) {
      return `域名 ${domainName} 今天到期！`;
    } else if (daysUntilExpiry === 1) {
      return `域名 ${domainName} 明天到期！`;
    } else {
      return `域名 ${domainName} 还有 ${daysUntilExpiry} 天到期`;
    }
  }

  /**
   * 获取即将到期的域名
   */
  getExpiringDomains(domains: Domain[]): DomainExpiryInfo[] {
    return Array.from(this.expiryInfoCache.values())
      .filter(info => {
        const domain = domains.find(d => d.id === info.domain.id);
        return domain && (domain.status === 'active' || domain.status === 'for_sale');
      })
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  /**
   * 获取统计信息
   */
  getExpiryStats(domains: Domain[]): {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    whoisVerified: number;
  } {
    const expiringDomains = this.getExpiringDomains(domains);
    
    return {
      total: expiringDomains.length,
      critical: expiringDomains.filter(d => d.priority === 'critical').length,
      high: expiringDomains.filter(d => d.priority === 'high').length,
      medium: expiringDomains.filter(d => d.priority === 'medium').length,
      low: expiringDomains.filter(d => d.priority === 'low').length,
      whoisVerified: expiringDomains.filter(d => d.isWhoisVerified).length
    };
  }

  /**
   * 清理过期缓存
   */
  cleanExpiredCache(): void {
    const now = new Date();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7天

    for (const [domainId, info] of this.expiryInfoCache.entries()) {
      if (now.getTime() - info.lastChecked.getTime() > maxAge) {
        this.expiryInfoCache.delete(domainId);
      }
    }
  }

  /**
   * 获取服务状态
   */
  getServiceStatus(): {
    lastCheckTime: Date | null;
    cacheSize: number;
    config: ExpiryMonitoringConfig;
  } {
    return {
      lastCheckTime: this.lastCheckTime,
      cacheSize: this.expiryInfoCache.size,
      config: this.config
    };
  }
}

export const domainExpiryService = DomainExpiryService.getInstance();
