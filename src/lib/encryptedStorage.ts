// 加密存储服务
import { encryptData, decryptData, generateSecureKey } from './security';

// 用户密钥管理
class UserKeyManager {
  private static instance: UserKeyManager;
  private userKeys: Map<string, string> = new Map();

  static getInstance(): UserKeyManager {
    if (!UserKeyManager.instance) {
      UserKeyManager.instance = new UserKeyManager();
    }
    return UserKeyManager.instance;
  }

  // 获取或生成用户密钥
  getUserKey(userId: string): string {
    if (!this.userKeys.has(userId)) {
      // 在实际应用中，这里应该从安全的密钥存储中获取
      // 或者基于用户密码派生密钥
      const key = generateSecureKey();
      this.userKeys.set(userId, key);
    }
    return this.userKeys.get(userId)!;
  }

  // 清除用户密钥（登出时）
  clearUserKey(userId: string): void {
    this.userKeys.delete(userId);
  }
}

// 加密存储服务
export class EncryptedStorageService {
  private keyManager = UserKeyManager.getInstance();

  // 加密域名数据
  encryptDomain(domain: Record<string, unknown>, userId: string): Record<string, unknown> {
    const key = this.keyManager.getUserKey(userId);
    
    // 需要加密的敏感字段
    const sensitiveFields = [
      'domain_name',
      'registrar',
      'purchase_date',
      'expiry_date',
      'sale_date',
      'notes'
    ];

    const encryptedDomain = { ...domain };
    
    sensitiveFields.forEach(field => {
      if (encryptedDomain[field] && encryptedDomain[field] !== null) {
        try {
          encryptedDomain[`${field}_encrypted`] = encryptData(encryptedDomain[field], key);
          // 可以选择是否保留原始字段（用于搜索）
          // delete encryptedDomain[field];
        } catch (error) {
          console.error(`Failed to encrypt field ${field}:`, error);
        }
      }
    });

    return encryptedDomain;
  }

  // 解密域名数据
  decryptDomain(encryptedDomain: Record<string, unknown>, userId: string): Record<string, unknown> {
    const key = this.keyManager.getUserKey(userId);
    
    const sensitiveFields = [
      'domain_name',
      'registrar', 
      'purchase_date',
      'expiry_date',
      'sale_date',
      'notes'
    ];

    const decryptedDomain = { ...encryptedDomain };
    
    sensitiveFields.forEach(field => {
      const encryptedField = `${field}_encrypted`;
      if (encryptedDomain[encryptedField]) {
        try {
          const encryptedValue = encryptedDomain[encryptedField];
          if (typeof encryptedValue === 'string') {
            decryptedDomain[field] = decryptData(encryptedValue, key);
            // 删除加密字段
            delete decryptedDomain[encryptedField];
          }
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error);
          // 如果解密失败，尝试使用原始字段
          decryptedDomain[field] = encryptedDomain[field];
        }
      }
    });

    return decryptedDomain;
  }

  // 加密交易数据
  encryptTransaction(transaction: Record<string, unknown>, userId: string): Record<string, unknown> {
    const key = this.keyManager.getUserKey(userId);
    
    const sensitiveFields = [
      'notes',
      'receipt_url',
      'category'
    ];

    const encryptedTransaction = { ...transaction };
    
    sensitiveFields.forEach(field => {
      if (encryptedTransaction[field] && encryptedTransaction[field] !== null) {
        try {
          encryptedTransaction[`${field}_encrypted`] = encryptData(encryptedTransaction[field], key);
        } catch (error) {
          console.error(`Failed to encrypt field ${field}:`, error);
        }
      }
    });

    return encryptedTransaction;
  }

  // 解密交易数据
  decryptTransaction(encryptedTransaction: Record<string, unknown>, userId: string): Record<string, unknown> {
    const key = this.keyManager.getUserKey(userId);
    
    const sensitiveFields = [
      'notes',
      'receipt_url', 
      'category'
    ];

    const decryptedTransaction = { ...encryptedTransaction };
    
    sensitiveFields.forEach(field => {
      const encryptedField = `${field}_encrypted`;
      if (encryptedTransaction[encryptedField]) {
        try {
          const encryptedValue = encryptedTransaction[encryptedField];
          if (typeof encryptedValue === 'string') {
            decryptedTransaction[field] = decryptData(encryptedValue, key);
            delete decryptedTransaction[encryptedField];
          }
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error);
          decryptedTransaction[field] = encryptedTransaction[field];
        }
      }
    });

    return decryptedTransaction;
  }

  // 批量加密域名列表
  encryptDomains(domains: Record<string, unknown>[], userId: string): Record<string, unknown>[] {
    return domains.map(domain => this.encryptDomain(domain, userId));
  }

  // 批量解密域名列表
  decryptDomains(encryptedDomains: Record<string, unknown>[], userId: string): Record<string, unknown>[] {
    return encryptedDomains.map(domain => this.decryptDomain(domain, userId));
  }

  // 批量加密交易列表
  encryptTransactions(transactions: Record<string, unknown>[], userId: string): Record<string, unknown>[] {
    return transactions.map(transaction => this.encryptTransaction(transaction, userId));
  }

  // 批量解密交易列表
  decryptTransactions(encryptedTransactions: Record<string, unknown>[], userId: string): Record<string, unknown>[] {
    return encryptedTransactions.map(transaction => this.decryptTransaction(transaction, userId));
  }

  // 清除用户数据（登出时）
  clearUserData(userId: string): void {
    this.keyManager.clearUserKey(userId);
  }
}

// 导出单例实例
export const encryptedStorage = new EncryptedStorageService();
