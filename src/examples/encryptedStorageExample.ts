// 加密存储使用示例
import { EncryptedDomainService, EncryptedTransactionService, UserKeyService } from '../lib/encryptedSupabaseService';
import { encryptedStorage } from '../lib/encryptedStorage';

// 示例：如何在dashboard中使用加密存储
export class EncryptedDashboardExample {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  // 初始化用户加密密钥
  async initializeEncryption(): Promise<void> {
    try {
      // 检查是否已有加密密钥
      let encryptionKey = await UserKeyService.getUserEncryptionKey(this.userId);
      
      if (!encryptionKey) {
        // 如果没有密钥，生成一个新的
        encryptionKey = await UserKeyService.generateUserEncryptionKey(this.userId);
        console.log('Generated new encryption key for user');
      }
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
    }
  }

  // 获取加密的域名列表
  async getDomains() {
    try {
      const domains = await EncryptedDomainService.getDomains(this.userId);
      console.log('Retrieved encrypted domains:', domains);
      return domains;
    } catch (error) {
      console.error('Failed to get domains:', error);
      return [];
    }
  }

  // 创建加密的域名
  async createDomain(domainData: any) {
    try {
      const newDomain = await EncryptedDomainService.createDomain(domainData, this.userId);
      console.log('Created encrypted domain:', newDomain);
      return newDomain;
    } catch (error) {
      console.error('Failed to create domain:', error);
      return null;
    }
  }

  // 获取加密的交易列表
  async getTransactions() {
    try {
      const transactions = await EncryptedTransactionService.getTransactions(this.userId);
      console.log('Retrieved encrypted transactions:', transactions);
      return transactions;
    } catch (error) {
      console.error('Failed to get transactions:', error);
      return [];
    }
  }

  // 创建加密的交易
  async createTransaction(transactionData: any) {
    try {
      const newTransaction = await EncryptedTransactionService.createTransaction(transactionData, this.userId);
      console.log('Created encrypted transaction:', newTransaction);
      return newTransaction;
    } catch (error) {
      console.error('Failed to create transaction:', error);
      return null;
    }
  }

  // 用户登出时清理
  logout() {
    encryptedStorage.clearUserData(this.userId);
    console.log('Cleared user encryption data');
  }
}

// 使用示例
export async function exampleUsage() {
  const userId = 'user-123';
  const dashboard = new EncryptedDashboardExample(userId);

  // 1. 初始化加密
  await dashboard.initializeEncryption();

  // 2. 获取数据（自动解密）
  const domains = await dashboard.getDomains();
  const transactions = await dashboard.getTransactions();

  // 3. 创建数据（自动加密）
  const newDomain = await dashboard.createDomain({
    domain_name: 'example.com',
    registrar: 'GoDaddy',
    purchase_cost: 100,
    // ... 其他字段
  });

  // 4. 登出时清理
  dashboard.logout();
}
