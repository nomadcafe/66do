// 加密的Supabase服务
import { supabase } from './supabase';
import { encryptedStorage } from './encryptedStorage';
import { Domain, DomainTransaction } from './supabaseService';

export class EncryptedDomainService {
  // 获取加密的域名列表
  static async getDomains(userId: string): Promise<Domain[]> {
    const { data, error } = await supabase
      .from('domains')
      .select('*')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching domains:', error);
      return [];
    }
    
    // 解密数据
    return encryptedStorage.decryptDomains(data || [], userId);
  }

  // 创建加密的域名
  static async createDomain(domain: any, userId: string): Promise<Domain | null> {
    try {
      // 加密域名数据
      const encryptedDomain = encryptedStorage.encryptDomain(domain, userId);
      
      const { data, error } = await supabase
        .from('domains')
        .insert(encryptedDomain)
        .select()
        .single();
      
      if (error) {
        console.error('Error creating domain:', error);
        return null;
      }
      
      // 解密返回的数据
      return encryptedStorage.decryptDomain(data, userId);
    } catch (error) {
      console.error('Error creating domain:', error);
      return null;
    }
  }

  // 更新加密的域名
  static async updateDomain(id: string, updates: any, userId: string): Promise<Domain | null> {
    try {
      // 加密更新数据
      const encryptedUpdates = encryptedStorage.encryptDomain(updates, userId);
      
      const { data, error } = await supabase
        .from('domains')
        .update(encryptedUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating domain:', error);
        return null;
      }
      
      // 解密返回的数据
      return encryptedStorage.decryptDomain(data, userId);
    } catch (error) {
      console.error('Error updating domain:', error);
      return null;
    }
  }

  // 删除域名
  static async deleteDomain(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('domains')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting domain:', error);
      return false;
    }
    
    return true;
  }
}

export class EncryptedTransactionService {
  // 获取加密的交易列表
  static async getTransactions(userId: string): Promise<DomainTransaction[]> {
    const { data, error } = await supabase
      .from('domain_transactions')
      .select(`
        *,
        domains!inner(owner_user_id)
      `)
      .eq('domains.owner_user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
    
    // 解密数据
    return encryptedStorage.decryptTransactions(data || [], userId);
  }

  // 创建加密的交易
  static async createTransaction(transaction: any, userId: string): Promise<DomainTransaction | null> {
    try {
      // 加密交易数据
      const encryptedTransaction = encryptedStorage.encryptTransaction(transaction, userId);
      
      const { data, error } = await supabase
        .from('domain_transactions')
        .insert(encryptedTransaction)
        .select()
        .single();
      
      if (error) {
        console.error('Error creating transaction:', error);
        return null;
      }
      
      // 解密返回的数据
      return encryptedStorage.decryptTransaction(data, userId);
    } catch (error) {
      console.error('Error creating transaction:', error);
      return null;
    }
  }

  // 更新加密的交易
  static async updateTransaction(id: string, updates: any, userId: string): Promise<DomainTransaction | null> {
    try {
      // 加密更新数据
      const encryptedUpdates = encryptedStorage.encryptTransaction(updates, userId);
      
      const { data, error } = await supabase
        .from('domain_transactions')
        .update(encryptedUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating transaction:', error);
        return null;
      }
      
      // 解密返回的数据
      return encryptedStorage.decryptTransaction(data, userId);
    } catch (error) {
      console.error('Error updating transaction:', error);
      return null;
    }
  }

  // 删除交易
  static async deleteTransaction(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('domain_transactions')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting transaction:', error);
      return false;
    }
    
    return true;
  }
}

// 用户密钥管理
export class UserKeyService {
  // 为用户生成或获取加密密钥
  static async getUserEncryptionKey(userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('users')
      .select('encryption_key')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching user encryption key:', error);
      return null;
    }
    
    return data?.encryption_key || null;
  }

  // 为用户设置加密密钥
  static async setUserEncryptionKey(userId: string, key: string): Promise<boolean> {
    const { error } = await supabase
      .from('users')
      .update({ encryption_key: key })
      .eq('id', userId);
    
    if (error) {
      console.error('Error setting user encryption key:', error);
      return false;
    }
    
    return true;
  }

  // 生成并保存用户加密密钥
  static async generateUserEncryptionKey(userId: string): Promise<string | null> {
    const { generateSecureKey } = await import('./security');
    const key = generateSecureKey();
    
    const success = await this.setUserEncryptionKey(userId, key);
    return success ? key : null;
  }
}
