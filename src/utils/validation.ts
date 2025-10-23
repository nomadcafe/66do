// 数据验证工具函数

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// 域名验证
export const validateDomain = (domain: {
  domain_name: string;
  purchase_cost: number;
  renewal_cost: number;
  renewal_cycle: number;
  expiry_date: string;
  estimated_value: number;
}): ValidationResult => {
  const errors: ValidationError[] = [];

  // 域名名称验证
  if (!domain.domain_name || domain.domain_name.trim() === '') {
    errors.push({ field: 'domain_name', message: '域名名称不能为空' });
  } else {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(domain.domain_name)) {
      errors.push({ field: 'domain_name', message: '域名格式不正确' });
    }
  }

  // 购买成本验证
  if (domain.purchase_cost < 0) {
    errors.push({ field: 'purchase_cost', message: '购买成本不能为负数' });
  }
  if (domain.purchase_cost > 1000000) {
    errors.push({ field: 'purchase_cost', message: '购买成本不能超过 $1,000,000' });
  }

  // 续费成本验证
  if (domain.renewal_cost < 0) {
    errors.push({ field: 'renewal_cost', message: '续费成本不能为负数' });
  }
  if (domain.renewal_cost > 100000) {
    errors.push({ field: 'renewal_cost', message: '续费成本不能超过 $100,000' });
  }

  // 续费周期验证
  if (domain.renewal_cycle < 1 || domain.renewal_cycle > 10) {
    errors.push({ field: 'renewal_cycle', message: '续费周期必须在 1-10 年之间' });
  }

  // 到期日期验证
  if (!domain.expiry_date) {
    errors.push({ field: 'expiry_date', message: '到期日期不能为空' });
  } else {
    const expiryDate = new Date(domain.expiry_date);
    const today = new Date();
    if (expiryDate <= today) {
      errors.push({ field: 'expiry_date', message: '到期日期必须是未来日期' });
    }
  }

  // 估值验证
  if (domain.estimated_value < 0) {
    errors.push({ field: 'estimated_value', message: '估值不能为负数' });
  }
  if (domain.estimated_value > 10000000) {
    errors.push({ field: 'estimated_value', message: '估值不能超过 $10,000,000' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// 交易记录验证
export const validateTransaction = (transaction: {
  type: string;
  amount: number;
  date: string;
  domain_id: string;
}): ValidationResult => {
  const errors: ValidationError[] = [];

  // 交易类型验证
  const validTypes = ['buy', 'renew', 'sell', 'transfer', 'fee'];
  if (!validTypes.includes(transaction.type)) {
    errors.push({ field: 'type', message: '交易类型无效' });
  }

  // 金额验证
  if (transaction.amount < 0) {
    errors.push({ field: 'amount', message: '交易金额不能为负数' });
  }
  if (transaction.amount > 10000000) {
    errors.push({ field: 'amount', message: '交易金额不能超过 $10,000,000' });
  }

  // 日期验证
  if (!transaction.date) {
    errors.push({ field: 'date', message: '交易日期不能为空' });
  } else {
    const transactionDate = new Date(transaction.date);
    const today = new Date();
    if (transactionDate > today) {
      errors.push({ field: 'date', message: '交易日期不能是未来日期' });
    }
  }

  // 域名ID验证
  if (!transaction.domain_id || transaction.domain_id.trim() === '') {
    errors.push({ field: 'domain_id', message: '域名ID不能为空' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// 用户输入验证
export const validateUserInput = (input: string, type: 'email' | 'domain' | 'name'): ValidationResult => {
  const errors: ValidationError[] = [];

  if (!input || input.trim() === '') {
    errors.push({ field: 'input', message: '输入不能为空' });
    return { isValid: false, errors };
  }

  switch (type) {
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input)) {
        errors.push({ field: 'input', message: '邮箱格式不正确' });
      }
      break;
    case 'domain':
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!domainRegex.test(input)) {
        errors.push({ field: 'input', message: '域名格式不正确' });
      }
      break;
    case 'name':
      if (input.length < 2) {
        errors.push({ field: 'input', message: '名称至少需要2个字符' });
      }
      if (input.length > 100) {
        errors.push({ field: 'input', message: '名称不能超过100个字符' });
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// 数据清理函数
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // 移除潜在的HTML标签
    .replace(/['"]/g, '') // 移除引号
    .substring(0, 1000); // 限制长度
};

// 格式化错误消息
export const formatValidationErrors = (errors: ValidationError[]): string => {
  return errors.map(error => `${error.field}: ${error.message}`).join('\n');
};
