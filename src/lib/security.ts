// 安全工具函数
import CryptoJS from 'crypto-js';

// 数据加密
export function encryptData(data: unknown, key: string): string {
  try {
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('数据加密失败');
  }
}

// 数据解密
export function decryptData(encryptedData: string, key: string): unknown {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
    const data = decrypted.toString(CryptoJS.enc.Utf8);
    return JSON.parse(data);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('数据解密失败');
  }
}

// 生成安全密钥
export function generateSecureKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// 数据脱敏
export function maskSensitiveData(data: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const masked = { ...data };
  
  fields.forEach(field => {
    if (masked[field]) {
      const value = String(masked[field]);
      if (value.length > 4) {
        masked[field] = value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
      } else {
        masked[field] = '*'.repeat(value.length);
      }
    }
  });
  
  return masked;
}

// 输入验证和清理
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // 移除HTML标签
    .replace(/['"]/g, '') // 移除引号
    .replace(/[;]/g, '') // 移除分号
    .substring(0, 1000); // 限制长度
}

// SQL注入防护
export function escapeSQL(input: string): string {
  return input
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
}

// XSS防护
export function escapeHTML(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

// 访问控制
export class AccessControl {
  private permissions: Map<string, string[]> = new Map();

  // 设置用户权限
  setUserPermissions(userId: string, permissions: string[]): void {
    this.permissions.set(userId, permissions);
  }

  // 检查权限
  hasPermission(userId: string, permission: string): boolean {
    const userPermissions = this.permissions.get(userId) || [];
    return userPermissions.includes(permission) || userPermissions.includes('admin');
  }

  // 检查资源访问权限
  canAccessResource(_userId: string, _resourceId: string, _action: string): boolean {
    // 检查是否是资源所有者
    if (this.isResourceOwner(_userId, _resourceId)) {
      return true;
    }

    // 检查管理员权限
    if (this.hasPermission(_userId, 'admin')) {
      return true;
    }

    // 检查特定权限
    return this.hasPermission(_userId, `${_action}_${_resourceId}`);
  }

  // 检查资源所有权
  private isResourceOwner(_userId: string, _resourceId: string): boolean {
    // 这里应该查询数据库检查资源所有权
    // 暂时返回true，实际应用中需要数据库查询
    return true;
  }
}

// 审计日志
export class AuditLogger {
  private logs: Array<{
    timestamp: string;
    userId: string;
    action: string;
    resource: string;
    details: Record<string, unknown>;
    ip?: string;
  }> = [];

  // 记录操作
  log(userId: string, action: string, resource: string, details: Record<string, unknown> = {}): void {
    const log = {
      timestamp: new Date().toISOString(),
      userId,
      action,
      resource,
      details,
      ip: this.getClientIP()
    };

    this.logs.push(log);
    
    // 限制日志数量
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-500);
    }

    // 发送到服务器（实际应用中）
    this.sendToServer(log);
  }

  // 获取客户端IP
  private getClientIP(): string {
    // 实际应用中应该从请求头获取真实IP
    return '127.0.0.1';
  }

  // 发送到服务器
  private sendToServer(log: Record<string, unknown>): void {
    // 实际应用中应该发送到日志服务器
    console.log('Audit log:', log);
  }

  // 获取用户操作历史
  getUserHistory(userId: string, limit: number = 50): Array<Record<string, unknown>> {
    return this.logs
      .filter(log => log.userId === userId)
      .slice(-limit)
      .reverse();
  }

  // 获取所有日志
  getAllLogs(limit: number = 100): Array<Record<string, unknown>> {
    return this.logs.slice(-limit).reverse();
  }
}

// 导出单例实例
export const accessControl = new AccessControl();
export const auditLogger = new AuditLogger();

// 安全中间件
export function securityMiddleware(req: Record<string, unknown>, res: Record<string, unknown>, next: () => void) {
  // 设置安全头
  if (typeof res.setHeader === 'function') {
    const resObj = res as { setHeader: (key: string, value: string) => void };
    resObj.setHeader('X-Content-Type-Options', 'nosniff');
    resObj.setHeader('X-Frame-Options', 'DENY');
    resObj.setHeader('X-XSS-Protection', '1; mode=block');
    resObj.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // 记录请求
  const reqObj = req as Record<string, unknown>;
  const user = reqObj.user as Record<string, unknown> | undefined;
  auditLogger.log(
    user?.id as string || 'anonymous',
    'request',
    reqObj.path as string,
    {
      method: reqObj.method as string,
      userAgent: (reqObj.get as ((key: string) => string) | undefined)?.('User-Agent') || '',
      ip: reqObj.ip as string
    }
  );
  
  next();
}
