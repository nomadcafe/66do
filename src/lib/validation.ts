// 数据验证工具函数

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// 常量定义
const MAX_DOMAIN_NAME_LENGTH = 255;
const MAX_REGISTRAR_LENGTH = 100;
const MAX_TAG_LENGTH = 50;
const MAX_TAGS_COUNT = 20;
const MAX_PURCHASE_COST = 10000000; // $10M
const MAX_RENEWAL_COST = 1000000; // $1M
const MAX_ESTIMATED_VALUE = 100000000; // $100M
const MAX_RENEWAL_CYCLE = 10; // 10 years
const MAX_RENEWAL_COUNT = 100; // 100 renewals

// 验证域名数据
export function validateDomain(domain: unknown): ValidationResult {
  const errors: string[] = [];

  if (!domain || typeof domain !== 'object' || domain === null) {
    errors.push('域名数据格式不正确');
    return { valid: false, errors };
  }

  const domainObj = domain as Record<string, unknown>;

  // 域名名称验证
  if (!domainObj.domain_name || typeof domainObj.domain_name !== 'string') {
    errors.push('域名名称是必需的');
  } else {
    const domainName = domainObj.domain_name as string;
    if (domainName.trim().length === 0) {
      errors.push('域名名称不能为空');
    } else if (domainName.length > MAX_DOMAIN_NAME_LENGTH) {
      errors.push(`域名名称长度不能超过${MAX_DOMAIN_NAME_LENGTH}个字符`);
    } else if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domainName)) {
      errors.push('域名格式不正确');
    }
  }

  // 注册商验证
  if (domainObj.registrar !== null && domainObj.registrar !== undefined) {
    if (typeof domainObj.registrar !== 'string') {
      errors.push('注册商格式不正确');
    } else if ((domainObj.registrar as string).length > MAX_REGISTRAR_LENGTH) {
      errors.push(`注册商名称长度不能超过${MAX_REGISTRAR_LENGTH}个字符`);
    }
  }

  // 购买日期验证
  if (domainObj.purchase_date !== null && domainObj.purchase_date !== undefined) {
    if (typeof domainObj.purchase_date !== 'string') {
      errors.push('购买日期格式不正确');
    } else {
      const date = new Date(domainObj.purchase_date as string);
      if (isNaN(date.getTime())) {
        errors.push('购买日期格式不正确');
      } else {
        const now = new Date();
        const maxDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 未来1年
        if (date > maxDate) {
          errors.push('购买日期不能是未来1年之后的日期');
        }
      }
    }
  }

  // 购买成本验证
  if (domainObj.purchase_cost !== null && domainObj.purchase_cost !== undefined) {
    const cost = Number(domainObj.purchase_cost);
    if (isNaN(cost) || !isFinite(cost)) {
      errors.push('购买成本必须是有效数字');
    } else if (cost < 0) {
      errors.push('购买成本必须是非负数');
    } else if (cost > MAX_PURCHASE_COST) {
      errors.push(`购买成本不能超过$${MAX_PURCHASE_COST.toLocaleString()}`);
    }
  }

  // 续费成本验证
  if (domainObj.renewal_cost !== null && domainObj.renewal_cost !== undefined) {
    const cost = Number(domainObj.renewal_cost);
    if (isNaN(cost) || !isFinite(cost)) {
      errors.push('续费成本必须是有效数字');
    } else if (cost < 0) {
      errors.push('续费成本必须是非负数');
    } else if (cost > MAX_RENEWAL_COST) {
      errors.push(`续费成本不能超过$${MAX_RENEWAL_COST.toLocaleString()}`);
    }
  }

  // 续费周期验证
  if (domainObj.renewal_cycle !== null && domainObj.renewal_cycle !== undefined) {
    const cycle = Number(domainObj.renewal_cycle);
    if (isNaN(cycle) || !isFinite(cycle) || !Number.isInteger(cycle)) {
      errors.push('续费周期必须是整数');
    } else if (cycle < 1) {
      errors.push('续费周期必须大于0');
    } else if (cycle > MAX_RENEWAL_CYCLE) {
      errors.push(`续费周期不能超过${MAX_RENEWAL_CYCLE}年`);
    }
  }

  // 续费次数验证
  if (domainObj.renewal_count !== null && domainObj.renewal_count !== undefined) {
    const count = Number(domainObj.renewal_count);
    if (isNaN(count) || !isFinite(count) || !Number.isInteger(count)) {
      errors.push('续费次数必须是整数');
    } else if (count < 0) {
      errors.push('续费次数必须是非负整数');
    } else if (count > MAX_RENEWAL_COUNT) {
      errors.push(`续费次数不能超过${MAX_RENEWAL_COUNT}次`);
    }
  }

  // 到期日期验证
  if (domainObj.expiry_date !== null && domainObj.expiry_date !== undefined) {
    if (typeof domainObj.expiry_date !== 'string') {
      errors.push('到期日期格式不正确');
    } else {
      const date = new Date(domainObj.expiry_date as string);
      if (isNaN(date.getTime())) {
        errors.push('到期日期格式不正确');
      }
    }
  }

  // 状态验证
  if (!domainObj.status || typeof domainObj.status !== 'string') {
    errors.push('域名状态是必需的');
  } else if (!['active', 'for_sale', 'sold', 'expired'].includes(domainObj.status as string)) {
    errors.push('域名状态不正确');
  }

  // 估值验证
  if (domainObj.estimated_value !== null && domainObj.estimated_value !== undefined) {
    const value = Number(domainObj.estimated_value);
    if (isNaN(value) || !isFinite(value)) {
      errors.push('估值必须是有效数字');
    } else if (value < 0) {
      errors.push('估值必须是非负数');
    } else if (value > MAX_ESTIMATED_VALUE) {
      errors.push(`估值不能超过$${MAX_ESTIMATED_VALUE.toLocaleString()}`);
    }
  }

  // 标签验证
  if (domainObj.tags !== null && domainObj.tags !== undefined) {
    if (Array.isArray(domainObj.tags)) {
      if (domainObj.tags.length > MAX_TAGS_COUNT) {
        errors.push(`标签数量不能超过${MAX_TAGS_COUNT}个`);
      }
      domainObj.tags.forEach((tag, index) => {
        if (typeof tag !== 'string') {
          errors.push(`标签${index + 1}必须是字符串`);
        } else if (tag.length > MAX_TAG_LENGTH) {
          errors.push(`标签${index + 1}长度不能超过${MAX_TAG_LENGTH}个字符`);
        }
      });
    } else if (typeof domainObj.tags === 'string') {
      // 如果是JSON字符串，尝试解析
      try {
        const parsedTags = JSON.parse(domainObj.tags);
        if (Array.isArray(parsedTags) && parsedTags.length > MAX_TAGS_COUNT) {
          errors.push(`标签数量不能超过${MAX_TAGS_COUNT}个`);
        }
      } catch {
        // 如果不是JSON，忽略
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// 交易验证常量
const MAX_TRANSACTION_AMOUNT = 100000000; // $100M
const MAX_NOTES_LENGTH = 1000;
const MAX_CATEGORY_LENGTH = 100;
const MAX_RECEIPT_URL_LENGTH = 500;
const VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'CNY', 'JPY', 'AUD', 'CAD', 'CHF', 'HKD', 'SGD'];
const MAX_EXCHANGE_RATE = 1000;
const MIN_EXCHANGE_RATE = 0.0001;

// 验证交易数据
export function validateTransaction(transaction: unknown): ValidationResult {
  const errors: string[] = [];

  if (!transaction || typeof transaction !== 'object' || transaction === null) {
    errors.push('交易数据格式不正确');
    return { valid: false, errors };
  }

  const transactionObj = transaction as Record<string, unknown>;

  // 域名ID验证
  if (!transactionObj.domain_id || typeof transactionObj.domain_id !== 'string') {
    errors.push('域名ID是必需的');
  } else if ((transactionObj.domain_id as string).trim().length === 0) {
    errors.push('域名ID不能为空');
  }

  // 交易类型验证
  if (!transactionObj.type || typeof transactionObj.type !== 'string') {
    errors.push('交易类型是必需的');
  } else if (!['buy', 'renew', 'sell', 'transfer', 'fee', 'marketing', 'advertising'].includes(transactionObj.type as string)) {
    errors.push('交易类型不正确');
  }

  // 金额验证
  if (transactionObj.amount === null || transactionObj.amount === undefined) {
    errors.push('交易金额是必需的');
  } else {
    const amount = Number(transactionObj.amount);
    if (isNaN(amount) || !isFinite(amount)) {
      errors.push('交易金额必须是有效数字');
    } else if (amount <= 0) {
      errors.push('交易金额必须是正数');
    } else if (amount > MAX_TRANSACTION_AMOUNT) {
      errors.push(`交易金额不能超过$${MAX_TRANSACTION_AMOUNT.toLocaleString()}`);
    }
  }

  // 货币验证
  if (!transactionObj.currency || typeof transactionObj.currency !== 'string') {
    errors.push('货币类型是必需的');
  } else {
    const currency = (transactionObj.currency as string).toUpperCase();
    if (!VALID_CURRENCIES.includes(currency)) {
      errors.push(`货币类型必须是以下之一: ${VALID_CURRENCIES.join(', ')}`);
    }
  }

  // 交易日期验证
  if (!transactionObj.date || typeof transactionObj.date !== 'string') {
    errors.push('交易日期是必需的');
  } else {
    const date = new Date(transactionObj.date as string);
    if (isNaN(date.getTime())) {
      errors.push('交易日期格式不正确');
    } else {
      const now = new Date();
      const maxDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 未来1年
      if (date > maxDate) {
        errors.push('交易日期不能是未来1年之后的日期');
      }
    }
  }

  // 汇率验证
  if (transactionObj.exchange_rate !== null && transactionObj.exchange_rate !== undefined) {
    const rate = Number(transactionObj.exchange_rate);
    if (isNaN(rate) || !isFinite(rate)) {
      errors.push('汇率必须是有效数字');
    } else if (rate < MIN_EXCHANGE_RATE || rate > MAX_EXCHANGE_RATE) {
      errors.push(`汇率必须在${MIN_EXCHANGE_RATE}和${MAX_EXCHANGE_RATE}之间`);
    }
  }

  // 平台手续费百分比验证
  if (transactionObj.platform_fee_percentage !== null && transactionObj.platform_fee_percentage !== undefined) {
    const percentage = Number(transactionObj.platform_fee_percentage);
    if (isNaN(percentage) || !isFinite(percentage)) {
      errors.push('平台手续费百分比必须是有效数字');
    } else if (percentage < 0 || percentage > 100) {
      errors.push('平台手续费百分比必须在0-100之间');
    }
  }

  // 平台手续费验证
  if (transactionObj.platform_fee !== null && transactionObj.platform_fee !== undefined) {
    const fee = Number(transactionObj.platform_fee);
    if (isNaN(fee) || !isFinite(fee)) {
      errors.push('平台手续费必须是有效数字');
    } else if (fee < 0) {
      errors.push('平台手续费必须是非负数');
    } else if (fee > MAX_TRANSACTION_AMOUNT) {
      errors.push(`平台手续费不能超过$${MAX_TRANSACTION_AMOUNT.toLocaleString()}`);
    }
  }

  // 净金额验证
  if (transactionObj.net_amount !== null && transactionObj.net_amount !== undefined) {
    const netAmount = Number(transactionObj.net_amount);
    if (isNaN(netAmount) || !isFinite(netAmount)) {
      errors.push('净金额必须是有效数字');
    } else if (netAmount < 0) {
      errors.push('净金额必须是非负数');
    }
  }

  // 备注验证
  if (transactionObj.notes !== null && transactionObj.notes !== undefined) {
    if (typeof transactionObj.notes !== 'string') {
      errors.push('备注必须是字符串');
    } else if (transactionObj.notes.length > MAX_NOTES_LENGTH) {
      errors.push(`备注长度不能超过${MAX_NOTES_LENGTH}个字符`);
    }
  }

  // 分类验证
  if (transactionObj.category !== null && transactionObj.category !== undefined) {
    if (typeof transactionObj.category !== 'string') {
      errors.push('分类必须是字符串');
    } else if (transactionObj.category.length > MAX_CATEGORY_LENGTH) {
      errors.push(`分类长度不能超过${MAX_CATEGORY_LENGTH}个字符`);
    }
  }

  // 收据URL验证
  if (transactionObj.receipt_url !== null && transactionObj.receipt_url !== undefined) {
    if (typeof transactionObj.receipt_url !== 'string') {
      errors.push('收据URL必须是字符串');
    } else if (transactionObj.receipt_url.length > MAX_RECEIPT_URL_LENGTH) {
      errors.push(`收据URL长度不能超过${MAX_RECEIPT_URL_LENGTH}个字符`);
    } else if (transactionObj.receipt_url.trim().length > 0) {
      // 验证URL格式
      try {
        new URL(transactionObj.receipt_url);
      } catch {
        errors.push('收据URL格式不正确');
      }
    }
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

  // 处理域名名称
  let domainName = '';
  if (typeof domainObj.domain_name === 'string') {
    domainName = domainObj.domain_name.trim().toLowerCase();
    if (domainName.length > MAX_DOMAIN_NAME_LENGTH) {
      domainName = domainName.substring(0, MAX_DOMAIN_NAME_LENGTH);
    }
  }

  // 处理注册商
  let registrar: string | null = null;
  if (typeof domainObj.registrar === 'string') {
    registrar = domainObj.registrar.trim();
    if (registrar.length > MAX_REGISTRAR_LENGTH) {
      registrar = registrar.substring(0, MAX_REGISTRAR_LENGTH);
    }
    if (registrar.length === 0) {
      registrar = null;
    }
  }

  // 处理数值字段，确保在合理范围内
  const purchaseCost = domainObj.purchase_cost !== null && domainObj.purchase_cost !== undefined 
    ? Math.max(0, Math.min(MAX_PURCHASE_COST, Number(domainObj.purchase_cost) || 0)) 
    : null;
  const renewalCost = domainObj.renewal_cost !== null && domainObj.renewal_cost !== undefined 
    ? Math.max(0, Math.min(MAX_RENEWAL_COST, Number(domainObj.renewal_cost) || 0)) 
    : null;
  const renewalCycle = Math.max(1, Math.min(MAX_RENEWAL_CYCLE, Math.floor(Number(domainObj.renewal_cycle) || 1)));
  const renewalCount = Math.max(0, Math.min(MAX_RENEWAL_COUNT, Math.floor(Number(domainObj.renewal_count) || 0)));
  const estimatedValue = domainObj.estimated_value !== null && domainObj.estimated_value !== undefined 
    ? Math.max(0, Math.min(MAX_ESTIMATED_VALUE, Number(domainObj.estimated_value) || 0)) 
    : null;

  // 处理标签
  let tags: string[] = [];
  if (Array.isArray(domainObj.tags)) {
    tags = domainObj.tags
      .map((tag: unknown) => String(tag).trim())
      .filter((tag: string) => tag.length > 0 && tag.length <= MAX_TAG_LENGTH)
      .slice(0, MAX_TAGS_COUNT);
  } else if (typeof domainObj.tags === 'string') {
    try {
      const parsedTags = JSON.parse(domainObj.tags);
      if (Array.isArray(parsedTags)) {
        tags = parsedTags
          .map((tag: unknown) => String(tag).trim())
          .filter((tag: string) => tag.length > 0 && tag.length <= MAX_TAG_LENGTH)
          .slice(0, MAX_TAGS_COUNT);
      }
    } catch {
      // 如果不是JSON，忽略
    }
  }

  return {
    ...domainObj,
    domain_name: domainName,
    registrar,
    purchase_date: domainObj.purchase_date || null,
    purchase_cost: purchaseCost,
    renewal_cost: renewalCost,
    renewal_cycle: renewalCycle,
    renewal_count: renewalCount,
    estimated_value: estimatedValue,
    tags
  };
}

export function sanitizeTransactionData(transaction: unknown): Record<string, unknown> {
  if (!transaction || typeof transaction !== 'object' || transaction === null) {
    return {};
  }

  const transactionObj = transaction as Record<string, unknown>;

  // 处理金额，确保在合理范围内
  const amount = Math.max(0, Math.min(MAX_TRANSACTION_AMOUNT, Number(transactionObj.amount) || 0));
  
  // 处理货币
  let currency = 'USD';
  if (typeof transactionObj.currency === 'string') {
    const upperCurrency = transactionObj.currency.toUpperCase();
    currency = VALID_CURRENCIES.includes(upperCurrency) ? upperCurrency : 'USD';
  }

  // 处理汇率
  const exchangeRate = transactionObj.exchange_rate !== null && transactionObj.exchange_rate !== undefined
    ? Math.max(MIN_EXCHANGE_RATE, Math.min(MAX_EXCHANGE_RATE, Number(transactionObj.exchange_rate) || 1))
    : 1;

  // 处理其他金额字段
  const baseAmount = transactionObj.base_amount !== null && transactionObj.base_amount !== undefined
    ? Math.max(0, Math.min(MAX_TRANSACTION_AMOUNT, Number(transactionObj.base_amount) || 0))
    : null;
  const platformFee = transactionObj.platform_fee !== null && transactionObj.platform_fee !== undefined
    ? Math.max(0, Math.min(MAX_TRANSACTION_AMOUNT, Number(transactionObj.platform_fee) || 0))
    : null;
  const platformFeePercentage = transactionObj.platform_fee_percentage !== null && transactionObj.platform_fee_percentage !== undefined
    ? Math.max(0, Math.min(100, Number(transactionObj.platform_fee_percentage) || 0))
    : null;
  const netAmount = transactionObj.net_amount !== null && transactionObj.net_amount !== undefined
    ? Math.max(0, Math.min(MAX_TRANSACTION_AMOUNT, Number(transactionObj.net_amount) || 0))
    : null;

  // 处理文本字段，限制长度
  const notes = typeof transactionObj.notes === 'string' 
    ? transactionObj.notes.trim().substring(0, MAX_NOTES_LENGTH) 
    : '';
  const category = typeof transactionObj.category === 'string' 
    ? transactionObj.category.trim().substring(0, MAX_CATEGORY_LENGTH) 
    : '';
  
  // 处理收据URL
  let receiptUrl: string | null = null;
  if (typeof transactionObj.receipt_url === 'string') {
    const url = transactionObj.receipt_url.trim();
    if (url.length > 0 && url.length <= MAX_RECEIPT_URL_LENGTH) {
      try {
        new URL(url); // 验证URL格式
        receiptUrl = url;
      } catch {
        // URL格式无效，设为null
        receiptUrl = null;
      }
    }
  }

  return {
    ...transactionObj,
    amount,
    currency,
    exchange_rate: exchangeRate,
    base_amount: baseAmount,
    platform_fee: platformFee,
    platform_fee_percentage: platformFeePercentage,
    net_amount: netAmount,
    notes,
    category,
    tax_deductible: Boolean(transactionObj.tax_deductible),
    receipt_url: receiptUrl
  };
}
