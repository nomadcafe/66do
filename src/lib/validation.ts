// 数据验证工具函数

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// 验证域名数据
export function validateDomain(domain: unknown): ValidationResult {
  const errors: string[] = [];

  if (!domain || typeof domain !== 'object' || domain === null) {
    errors.push('域名数据格式不正确');
    return { valid: false, errors };
  }

  const domainObj = domain as Record<string, unknown>;

  if (!domainObj.domain_name || typeof domainObj.domain_name !== 'string') {
    errors.push('域名名称是必需的');
  } else if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domainObj.domain_name)) {
    errors.push('域名格式不正确');
  }

  if (!domainObj.purchase_date || typeof domainObj.purchase_date !== 'string') {
    errors.push('购买日期是必需的');
  } else if (isNaN(Date.parse(domainObj.purchase_date as string))) {
    errors.push('购买日期格式不正确');
  }

  if (typeof domainObj.purchase_cost !== 'number' || (domainObj.purchase_cost as number) < 0) {
    errors.push('购买成本必须是非负数');
  }

  if (typeof domainObj.renewal_cost !== 'number' || (domainObj.renewal_cost as number) < 0) {
    errors.push('续费成本必须是非负数');
  }

  if (typeof domainObj.renewal_cycle !== 'number' || (domainObj.renewal_cycle as number) < 1) {
    errors.push('续费周期必须是大于0的整数');
  }

  if (typeof domainObj.renewal_count !== 'number' || (domainObj.renewal_count as number) < 0) {
    errors.push('续费次数必须是非负整数');
  }

  if (domainObj.expiry_date && isNaN(Date.parse(domainObj.expiry_date as string))) {
    errors.push('到期日期格式不正确');
  }

  if (!['active', 'for_sale', 'sold', 'expired'].includes(domainObj.status as string)) {
    errors.push('域名状态不正确');
  }

  if (typeof domainObj.estimated_value !== 'number' || (domainObj.estimated_value as number) < 0) {
    errors.push('估值必须是非负数');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// 验证交易数据
export function validateTransaction(transaction: unknown): ValidationResult {
  const errors: string[] = [];

  if (!transaction || typeof transaction !== 'object' || transaction === null) {
    errors.push('交易数据格式不正确');
    return { valid: false, errors };
  }

  const transactionObj = transaction as Record<string, unknown>;

  if (!transactionObj.domain_id || typeof transactionObj.domain_id !== 'string') {
    errors.push('域名ID是必需的');
  }

  if (!['buy', 'renew', 'sell', 'transfer', 'fee', 'marketing', 'advertising'].includes(transactionObj.type as string)) {
    errors.push('交易类型不正确');
  }

  if (typeof transactionObj.amount !== 'number' || (transactionObj.amount as number) <= 0) {
    errors.push('交易金额必须是正数');
  }

  if (!transactionObj.currency || typeof transactionObj.currency !== 'string') {
    errors.push('货币类型是必需的');
  }

  if (!transactionObj.date || typeof transactionObj.date !== 'string') {
    errors.push('交易日期是必需的');
  } else if (isNaN(Date.parse(transactionObj.date as string))) {
    errors.push('交易日期格式不正确');
  }

  if (transactionObj.platform_fee_percentage && ((transactionObj.platform_fee_percentage as number) < 0 || (transactionObj.platform_fee_percentage as number) > 100)) {
    errors.push('平台手续费百分比必须在0-100之间');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// 验证域名名称格式
export function isValidDomainName(domainName: string): boolean {
  const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return domainRegex.test(domainName);
}

// 验证金额格式
export function isValidAmount(amount: number): boolean {
  return typeof amount === 'number' && amount >= 0 && !isNaN(amount) && isFinite(amount);
}

// 验证日期格式
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

// 验证邮箱格式
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 验证密码强度
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('密码至少需要8个字符');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('密码必须包含至少一个大写字母');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('密码必须包含至少一个小写字母');
  }

  if (!/\d/.test(password)) {
    errors.push('密码必须包含至少一个数字');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('密码必须包含至少一个特殊字符');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// 清理和标准化数据
export function sanitizeDomainData(domain: unknown): Record<string, unknown> {
  if (!domain || typeof domain !== 'object' || domain === null) {
    return {};
  }

  const domainObj = domain as Record<string, unknown>;

  return {
    ...domainObj,
    domain_name: typeof domainObj.domain_name === 'string' ? domainObj.domain_name.trim().toLowerCase() : '',
    registrar: typeof domainObj.registrar === 'string' ? domainObj.registrar.trim() : '',
    purchase_date: domainObj.purchase_date,
    purchase_cost: Math.max(0, Number(domainObj.purchase_cost) || 0),
    renewal_cost: Math.max(0, Number(domainObj.renewal_cost) || 0),
    renewal_cycle: Math.max(1, Number(domainObj.renewal_cycle) || 1),
    renewal_count: Math.max(0, Number(domainObj.renewal_count) || 0),
    estimated_value: Math.max(0, Number(domainObj.estimated_value) || 0),
    tags: Array.isArray(domainObj.tags) ? domainObj.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean) : []
  };
}

export function sanitizeTransactionData(transaction: unknown): Record<string, unknown> {
  if (!transaction || typeof transaction !== 'object' || transaction === null) {
    return {};
  }

  const transactionObj = transaction as Record<string, unknown>;

  return {
    ...transactionObj,
    amount: Math.max(0, Number(transactionObj.amount) || 0),
    currency: typeof transactionObj.currency === 'string' ? transactionObj.currency.toUpperCase() : 'USD',
    exchange_rate: Math.max(0, Number(transactionObj.exchange_rate) || 1),
    base_amount: Math.max(0, Number(transactionObj.base_amount) || 0),
    platform_fee: Math.max(0, Number(transactionObj.platform_fee) || 0),
    platform_fee_percentage: Math.max(0, Math.min(100, Number(transactionObj.platform_fee_percentage) || 0)),
    net_amount: Math.max(0, Number(transactionObj.net_amount) || 0),
    notes: typeof transactionObj.notes === 'string' ? transactionObj.notes.trim() : '',
    category: typeof transactionObj.category === 'string' ? transactionObj.category.trim() : '',
    tax_deductible: Boolean(transactionObj.tax_deductible),
    receipt_url: typeof transactionObj.receipt_url === 'string' ? transactionObj.receipt_url.trim() : ''
  };
}
