'use client';

import { DomainWithTags } from '../types/dashboard';

export interface DomainExpiryInfo {
  domain: DomainWithTags;
  daysUntilExpiry: number;
  urgency: 'critical' | 'urgent' | 'warning' | 'normal';
  isExpired: boolean;
  isExpiringSoon: boolean;
}

export interface MonitoringSettings {
  criticalDays: number;
  urgentDays: number;
  warningDays: number;
  enablePushAlerts: boolean;
  alertFrequency: 'daily' | 'weekly' | 'monthly';
}

export class DomainMonitor {
  private settings: MonitoringSettings;
  private lastCheckTime: Date | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(settings: Partial<MonitoringSettings> = {}) {
    this.settings = {
      criticalDays: 7,
      urgentDays: 14,
      warningDays: 30,
      enablePushAlerts: true,
      alertFrequency: 'daily',
      ...settings
    };
  }

  // 检查域名到期状态
  checkDomainExpiry(domains: DomainWithTags[]): DomainExpiryInfo[] {
    const now = new Date();
    const results: DomainExpiryInfo[] = [];

    domains.forEach(domain => {
      // 跳过已出售或过期的域名
      if (domain.status === 'sold' || domain.status === 'expired') {
        return;
      }

      // 如果没有到期日期，跳过
      if (!domain.expiry_date) {
        return;
      }

      const expiryDate = new Date(domain.expiry_date);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      const isExpired = daysUntilExpiry < 0;
      const isExpiringSoon = daysUntilExpiry <= this.settings.warningDays && daysUntilExpiry >= 0;

      let urgency: 'critical' | 'urgent' | 'warning' | 'normal' = 'normal';
      
      if (isExpired) {
        urgency = 'critical';
      } else if (daysUntilExpiry <= this.settings.criticalDays) {
        urgency = 'critical';
      } else if (daysUntilExpiry <= this.settings.urgentDays) {
        urgency = 'urgent';
      } else if (daysUntilExpiry <= this.settings.warningDays) {
        urgency = 'warning';
      }

      results.push({
        domain,
        daysUntilExpiry,
        urgency,
        isExpired,
        isExpiringSoon
      });
    });

    this.lastCheckTime = now;
    return results.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  // 获取需要提醒的域名
  getExpiringDomains(domains: DomainWithTags[]): DomainExpiryInfo[] {
    return this.checkDomainExpiry(domains).filter(info => 
      info.isExpiringSoon || info.isExpired
    );
  }

  // 获取紧急域名（7天内到期）
  getCriticalDomains(domains: DomainWithTags[]): DomainExpiryInfo[] {
    return this.checkDomainExpiry(domains).filter(info => 
      info.urgency === 'critical'
    );
  }

  // 获取过期域名
  getExpiredDomains(domains: DomainWithTags[]): DomainExpiryInfo[] {
    return this.checkDomainExpiry(domains).filter(info => 
      info.isExpired
    );
  }

  // 启动自动监控
  startMonitoring(domains: DomainWithTags[], onAlert: (alerts: DomainExpiryInfo[]) => void) {
    if (this.checkInterval) {
      this.stopMonitoring();
    }

    // 立即检查一次
    const alerts = this.getExpiringDomains(domains);
    if (alerts.length > 0) {
      onAlert(alerts);
    }

    // 设置定时检查
    const checkFrequency = this.getCheckFrequency();
    this.checkInterval = setInterval(() => {
      const newAlerts = this.getExpiringDomains(domains);
      if (newAlerts.length > 0) {
        onAlert(newAlerts);
      }
    }, checkFrequency);
  }

  // 停止监控
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // 获取检查频率
  private getCheckFrequency(): number {
    switch (this.settings.alertFrequency) {
      case 'daily':
        return 24 * 60 * 60 * 1000; // 24小时
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 7天
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000; // 30天
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  // 更新设置
  updateSettings(newSettings: Partial<MonitoringSettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }

  // 获取设置
  getSettings(): MonitoringSettings {
    return { ...this.settings };
  }

  // 获取最后检查时间
  getLastCheckTime(): Date | null {
    return this.lastCheckTime;
  }

  // Note: alert message formatting is locale-aware and lives in the React component
  // (AutoDomainMonitor.tsx) — the lib only deals with data, not display strings.
}

// 导出单例实例
export const domainMonitor = new DomainMonitor();
