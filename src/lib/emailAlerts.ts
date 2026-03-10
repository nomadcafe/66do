'use client';

import { DomainExpiryInfo } from './domainMonitoring';

export interface EmailAlertSettings {
  enabled: boolean;
  criticalDays: number;
  urgentDays: number;
  warningDays: number;
  recipientEmail: string;
  frequency: 'immediate' | 'daily' | 'weekly';
  includeExpired: boolean;
  includeUpcoming: boolean;
}

export class EmailAlertService {
  private settings: EmailAlertSettings;

  constructor(settings: Partial<EmailAlertSettings> = {}) {
    this.settings = {
      enabled: true,
      criticalDays: 7,
      urgentDays: 14,
      warningDays: 30,
      recipientEmail: '',
      frequency: 'daily',
      includeExpired: true,
      includeUpcoming: true,
      ...settings
    };
  }

  // 检查是否需要发送邮件提醒
  shouldSendAlert(expiryInfo: DomainExpiryInfo): boolean {
    if (!this.settings.enabled || !this.settings.recipientEmail) {
      return false;
    }

    const { daysUntilExpiry, isExpired, urgency } = expiryInfo;

    // 检查是否包含过期域名
    if (isExpired && !this.settings.includeExpired) {
      return false;
    }

    // 检查是否包含即将到期的域名
    if (!isExpired && !this.settings.includeUpcoming) {
      return false;
    }

    // 根据紧急程度判断
    switch (urgency) {
      case 'critical':
        return daysUntilExpiry <= this.settings.criticalDays;
      case 'urgent':
        return daysUntilExpiry <= this.settings.urgentDays;
      case 'warning':
        return daysUntilExpiry <= this.settings.warningDays;
      default:
        return false;
    }
  }

  // 生成邮件内容
  generateEmailContent(expiryInfos: DomainExpiryInfo[]): { subject: string; html: string; text: string } {
    const criticalCount = expiryInfos.filter(info => info.urgency === 'critical').length;
    const urgentCount = expiryInfos.filter(info => info.urgency === 'urgent').length;
    const warningCount = expiryInfos.filter(info => info.urgency === 'warning').length;
    const expiredCount = expiryInfos.filter(info => info.isExpired).length;

    const subject = this.generateSubject(criticalCount, urgentCount, warningCount, expiredCount);
    const html = this.generateHtmlContent(expiryInfos);
    const text = this.generateTextContent(expiryInfos);

    return { subject, html, text };
  }

  // 生成邮件主题
  private generateSubject(critical: number, urgent: number, warning: number, expired: number): string {
    if (expired > 0) {
      return `🚨 紧急：${expired} 个域名已过期 - Domain Financial 提醒`;
    } else if (critical > 0) {
      return `🔥 紧急：${critical} 个域名即将到期 - Domain Financial 提醒`;
    } else if (urgent > 0) {
      return `⚠️ 重要：${urgent} 个域名需要关注 - Domain Financial 提醒`;
    } else if (warning > 0) {
      return `📢 提醒：${warning} 个域名即将到期 - Domain Financial 提醒`;
    } else {
      return `Domain Financial 域名到期提醒`;
    }
  }

  // 生成HTML邮件内容
  private generateHtmlContent(expiryInfos: DomainExpiryInfo[]): string {
    const now = new Date().toLocaleDateString('zh-CN');
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Domain Financial 域名到期提醒</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
          .domain-item { background: white; margin: 10px 0; padding: 15px; border-radius: 6px; border-left: 4px solid; }
          .critical { border-left-color: #dc3545; }
          .urgent { border-left-color: #fd7e14; }
          .warning { border-left-color: #ffc107; }
          .expired { border-left-color: #6c757d; }
          .domain-name { font-weight: bold; font-size: 16px; }
          .days-left { font-size: 14px; margin: 5px 0; }
          .urgency { font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Domain Financial 域名到期提醒</h1>
            <p>检查时间：${now}</p>
          </div>
          <div class="content">
    `;

    // 按紧急程度分组
    const expired = expiryInfos.filter(info => info.isExpired);
    const critical = expiryInfos.filter(info => info.urgency === 'critical' && !info.isExpired);
    const urgent = expiryInfos.filter(info => info.urgency === 'urgent');
    const warning = expiryInfos.filter(info => info.urgency === 'warning');

    // 已过期域名
    if (expired.length > 0) {
      html += `<h2 style="color: #dc3545;">🚨 已过期域名 (${expired.length})</h2>`;
      expired.forEach(info => {
        html += this.generateDomainItem(info, 'expired');
      });
    }

    // 紧急域名
    if (critical.length > 0) {
      html += `<h2 style="color: #dc3545;">🔥 紧急 (${critical.length})</h2>`;
      critical.forEach(info => {
        html += this.generateDomainItem(info, 'critical');
      });
    }

    // 重要域名
    if (urgent.length > 0) {
      html += `<h2 style="color: #fd7e14;">⚠️ 重要 (${urgent.length})</h2>`;
      urgent.forEach(info => {
        html += this.generateDomainItem(info, 'urgent');
      });
    }

    // 提醒域名
    if (warning.length > 0) {
      html += `<h2 style="color: #ffc107;">📢 提醒 (${warning.length})</h2>`;
      warning.forEach(info => {
        html += this.generateDomainItem(info, 'warning');
      });
    }

    html += `
          </div>
          <div class="footer">
            <p>此邮件由 Domain Financial 域名投资管理系统自动发送</p>
            <p>如需修改提醒设置，请登录系统进行配置</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  // 生成域名项目HTML
  private generateDomainItem(info: DomainExpiryInfo, urgencyClass: string): string {
    const { domain, daysUntilExpiry, isExpired } = info;
    
    let statusText = '';
    let statusColor = '';
    
    if (isExpired) {
      statusText = '已过期';
      statusColor = '#dc3545';
    } else if (daysUntilExpiry === 0) {
      statusText = '今天到期';
      statusColor = '#dc3545';
    } else if (daysUntilExpiry === 1) {
      statusText = '明天到期';
      statusColor = '#dc3545';
    } else {
      statusText = `${daysUntilExpiry} 天后到期`;
      statusColor = daysUntilExpiry <= 7 ? '#dc3545' : daysUntilExpiry <= 14 ? '#fd7e14' : '#ffc107';
    }

    return `
      <div class="domain-item ${urgencyClass}">
        <div class="domain-name">${domain.domain_name}</div>
        <div class="days-left" style="color: ${statusColor};">
          <span class="urgency">${statusText}</span>
        </div>
        <div style="font-size: 12px; color: #666;">
          注册商：${domain.registrar} | 续费费用：$${domain.renewal_cost}
        </div>
      </div>
    `;
  }

  // 生成纯文本邮件内容
  private generateTextContent(expiryInfos: DomainExpiryInfo[]): string {
    const now = new Date().toLocaleDateString('zh-CN');
    
    let text = `Domain Financial 域名到期提醒\n`;
    text += `检查时间：${now}\n\n`;

    // 按紧急程度分组
    const expired = expiryInfos.filter(info => info.isExpired);
    const critical = expiryInfos.filter(info => info.urgency === 'critical' && !info.isExpired);
    const urgent = expiryInfos.filter(info => info.urgency === 'urgent');
    const warning = expiryInfos.filter(info => info.urgency === 'warning');

    if (expired.length > 0) {
      text += `🚨 已过期域名 (${expired.length}):\n`;
      expired.forEach(info => {
        text += `- ${info.domain.domain_name} (已过期)\n`;
      });
      text += '\n';
    }

    if (critical.length > 0) {
      text += `🔥 紧急 (${critical.length}):\n`;
      critical.forEach(info => {
        text += `- ${info.domain.domain_name} (${info.daysUntilExpiry} 天后到期)\n`;
      });
      text += '\n';
    }

    if (urgent.length > 0) {
      text += `⚠️ 重要 (${urgent.length}):\n`;
      urgent.forEach(info => {
        text += `- ${info.domain.domain_name} (${info.daysUntilExpiry} 天后到期)\n`;
      });
      text += '\n';
    }

    if (warning.length > 0) {
      text += `📢 提醒 (${warning.length}):\n`;
      warning.forEach(info => {
        text += `- ${info.domain.domain_name} (${info.daysUntilExpiry} 天后到期)\n`;
      });
      text += '\n';
    }

    text += `\n此邮件由 Domain Financial 域名投资管理系统自动发送\n`;
    text += `如需修改提醒设置，请登录系统进行配置`;

    return text;
  }

  // 发送邮件提醒（需要集成邮件服务）
  async sendEmailAlert(expiryInfos: DomainExpiryInfo[]): Promise<boolean> {
    if (!this.shouldSendAlert(expiryInfos[0])) {
      return false;
    }

    try {
      const { subject, html, text } = this.generateEmailContent(expiryInfos);
      
      // 这里需要集成实际的邮件服务（如 SendGrid, Resend 等）
      // 目前只是模拟发送
      console.log('发送邮件提醒:', {
        to: this.settings.recipientEmail,
        subject,
        html,
        text
      });

      // 实际实现中，这里应该调用邮件服务API
      // await emailService.send({
      //   to: this.settings.recipientEmail,
      //   subject,
      //   html,
      //   text
      // });

      return true;
    } catch (error) {
      console.error('发送邮件提醒失败:', error);
      return false;
    }
  }

  // 更新设置
  updateSettings(newSettings: Partial<EmailAlertSettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }

  // 获取设置
  getSettings(): EmailAlertSettings {
    return { ...this.settings };
  }
}

// 导出单例实例
export const emailAlertService = new EmailAlertService();
