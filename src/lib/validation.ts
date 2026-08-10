// 数据验证工具函数

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// 常量定义
/** 日期字段允许相对「今天」的最远未来年数（与最长续费/登记周期一致） */
const MAX_DATE_YEARS_IN_FUTURE = 10;

function isDateBeyondAllowedFuture(date: Date, reference: Date = new Date()): boolean {
  const max = new Date(reference.getTime());
  max.setFullYear(max.getFullYear() + MAX_DATE_YEARS_IN_FUTURE);
  return date > max;
}

const MAX_DOMAIN_NAME_LENGTH = 255;
const MAX_REGISTRAR_LENGTH = 100;
const MAX_TAG_LENGTH = 50;
const MAX_TAGS_COUNT = 20;
const MAX_PURCHASE_COST = 10000000; // $10M
const MAX_RENEWAL_COST = 1000000; // $1M
const MAX_ESTIMATED_VALUE = 100000000; // $100M
const MAX_RENEWAL_CYCLE = 10; // 10 years
const MAX_RENEWAL_COUNT = 100; // 100 renewals

/**
 * 「该域名已在组合里」的报错键。不是 validateDomain 发出的——重名只有数据库
 * 的唯一索引能可靠判定，由路由层在捕获 23505 后放进 409 响应的 details 里。
 */
export const DUPLICATE_DOMAIN_MESSAGE_KEY = 'validation.domain.duplicate';

// 验证域名数据（errors 使用 i18n 键，由前端 t() 或 translateValidationMessages 展示）
export function validateDomain(domain: unknown): ValidationResult {
  const errors: string[] = [];

  if (!domain || typeof domain !== 'object' || domain === null) {
    errors.push('validation.domain.invalidFormat');
    return { valid: false, errors };
  }

  const domainObj = domain as Record<string, unknown>;

  // 域名名称验证
  if (!domainObj.domain_name || typeof domainObj.domain_name !== 'string') {
    errors.push('validation.domain.nameRequired');
  } else {
    const domainName = domainObj.domain_name as string;
    if (domainName.trim().length === 0) {
      errors.push('validation.domain.nameEmpty');
    } else if (domainName.length > MAX_DOMAIN_NAME_LENGTH) {
      errors.push('validation.domain.nameTooLong');
    } else if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domainName)) {
      errors.push('validation.domain.nameInvalidFormat');
    }
  }

  // 注册商验证
  if (domainObj.registrar !== null && domainObj.registrar !== undefined) {
    if (typeof domainObj.registrar !== 'string') {
      errors.push('validation.domain.registrarMustBeString');
    } else if ((domainObj.registrar as string).length > MAX_REGISTRAR_LENGTH) {
      errors.push('validation.domain.registrarTooLong');
    }
  }

  // 购买日期验证
  if (domainObj.purchase_date !== null && domainObj.purchase_date !== undefined) {
    if (typeof domainObj.purchase_date !== 'string') {
      errors.push('validation.domain.purchaseDateInvalid');
    } else {
      const date = new Date(domainObj.purchase_date as string);
      if (isNaN(date.getTime())) {
        errors.push('validation.domain.purchaseDateInvalid');
      } else if (isDateBeyondAllowedFuture(date)) {
        errors.push('validation.domain.purchaseDateBeyondMaxFuture');
      }
    }
  }

  // 购买成本验证
  if (domainObj.purchase_cost !== null && domainObj.purchase_cost !== undefined) {
    const cost = Number(domainObj.purchase_cost);
    if (isNaN(cost) || !isFinite(cost)) {
      errors.push('validation.domain.purchaseCostInvalidNumber');
    } else if (cost < 0) {
      errors.push('validation.domain.purchaseCostNonNegative');
    } else if (cost > MAX_PURCHASE_COST) {
      errors.push('validation.domain.purchaseCostExceedsMax');
    }
  }

  // 续费成本验证
  if (domainObj.renewal_cost !== null && domainObj.renewal_cost !== undefined) {
    const cost = Number(domainObj.renewal_cost);
    if (isNaN(cost) || !isFinite(cost)) {
      errors.push('validation.domain.renewalCostInvalidNumber');
    } else if (cost < 0) {
      errors.push('validation.domain.renewalCostNonNegative');
    } else if (cost > MAX_RENEWAL_COST) {
      errors.push('validation.domain.renewalCostExceedsMax');
    }
  }

  // 续费周期验证
  if (domainObj.renewal_cycle !== null && domainObj.renewal_cycle !== undefined) {
    const cycle = Number(domainObj.renewal_cycle);
    if (isNaN(cycle) || !isFinite(cycle) || !Number.isInteger(cycle)) {
      errors.push('validation.domain.renewalCycleMustBeInteger');
    } else if (cycle < 1) {
      errors.push('validation.domain.renewalCyclePositive');
    } else if (cycle > MAX_RENEWAL_CYCLE) {
      errors.push('validation.domain.renewalCycleExceedsMax');
    }
  }

  // 续费次数验证
  if (domainObj.renewal_count !== null && domainObj.renewal_count !== undefined) {
    const count = Number(domainObj.renewal_count);
    if (isNaN(count) || !isFinite(count) || !Number.isInteger(count)) {
      errors.push('validation.domain.renewalCountMustBeInteger');
    } else if (count < 0) {
      errors.push('validation.domain.renewalCountNonNegative');
    } else if (count > MAX_RENEWAL_COUNT) {
      errors.push('validation.domain.renewalCountExceedsMax');
    }
  }

  // 到期日期验证
  if (domainObj.expiry_date !== null && domainObj.expiry_date !== undefined) {
    if (typeof domainObj.expiry_date !== 'string') {
      errors.push('validation.domain.expiryDateInvalid');
    } else {
      const date = new Date(domainObj.expiry_date as string);
      if (isNaN(date.getTime())) {
        errors.push('validation.domain.expiryDateInvalid');
      } else if (isDateBeyondAllowedFuture(date)) {
        // ICANN 单次注册上限就是 10 年，到期日不可能超过今天 +10 年。
        // 不设上限时用户能填 9999 年，图表 X 轴和续费提醒都会被拉爆。
        errors.push('validation.domain.expiryDateBeyondMaxFuture');
      }
    }
  }

  // 注册日期（可选）：域名在 registrar 那边的原始注册日，跟 purchase_date
  // 不同（aftermarket 买入时差几年都正常）。只检查格式合法 + 不在未来；
  // 不限制最远过去（域名可以是 1990 年代的）。
  if (domainObj.registration_date !== null && domainObj.registration_date !== undefined && domainObj.registration_date !== '') {
    if (typeof domainObj.registration_date !== 'string') {
      errors.push('validation.domain.registrationDateInvalid');
    } else {
      const d = new Date(domainObj.registration_date as string);
      if (isNaN(d.getTime())) {
        errors.push('validation.domain.registrationDateInvalid');
      } else if (d.getTime() > new Date().getTime() + 24 * 60 * 60 * 1000) {
        errors.push('validation.domain.registrationDateInFuture');
      }
    }
  }

  // 续费成本基线日（可选）
  if (domainObj.baseline_renewal_as_of !== null && domainObj.baseline_renewal_as_of !== undefined && domainObj.baseline_renewal_as_of !== '') {
    if (typeof domainObj.baseline_renewal_as_of !== 'string') {
      errors.push('validation.domain.baselineRenewalAsOfInvalid');
    } else {
      const d = new Date(domainObj.baseline_renewal_as_of as string);
      if (isNaN(d.getTime())) {
        errors.push('validation.domain.baselineRenewalAsOfInvalid');
      }
    }
  }

  // 状态验证
  if (!domainObj.status || typeof domainObj.status !== 'string') {
    errors.push('validation.domain.statusRequired');
  } else if (!['active', 'for_sale', 'sold', 'expired'].includes(domainObj.status as string)) {
    errors.push('validation.domain.statusInvalid');
  }

  // 估值验证
  if (domainObj.estimated_value !== null && domainObj.estimated_value !== undefined) {
    const value = Number(domainObj.estimated_value);
    if (isNaN(value) || !isFinite(value)) {
      errors.push('validation.domain.estimatedValueInvalidNumber');
    } else if (value < 0) {
      errors.push('validation.domain.estimatedValueNonNegative');
    } else if (value > MAX_ESTIMATED_VALUE) {
      errors.push('validation.domain.estimatedValueExceedsMax');
    }
  }

  // 跨字段日期合理性：到期日不应早于购入日；售出日不应早于购入日
  if (
    typeof domainObj.purchase_date === 'string' &&
    typeof domainObj.expiry_date === 'string' &&
    domainObj.purchase_date &&
    domainObj.expiry_date
  ) {
    const purchase = new Date(domainObj.purchase_date as string);
    const expiry = new Date(domainObj.expiry_date as string);
    if (!isNaN(purchase.getTime()) && !isNaN(expiry.getTime()) && expiry < purchase) {
      errors.push('validation.domain.expiryBeforePurchase');
    }
  }
  if (
    typeof domainObj.purchase_date === 'string' &&
    typeof domainObj.sale_date === 'string' &&
    domainObj.purchase_date &&
    domainObj.sale_date
  ) {
    const purchase = new Date(domainObj.purchase_date as string);
    const sale = new Date(domainObj.sale_date as string);
    if (!isNaN(purchase.getTime()) && !isNaN(sale.getTime()) && sale < purchase) {
      errors.push('validation.domain.saleBeforePurchase');
    }
  }

  // 标签验证
  if (domainObj.tags !== null && domainObj.tags !== undefined) {
    if (Array.isArray(domainObj.tags)) {
      if (domainObj.tags.length > MAX_TAGS_COUNT) {
        errors.push('validation.domain.tagsTooMany');
      }
      domainObj.tags.forEach((tag, index) => {
        // 竖线后是位置参数，译文里的 {0} 会被替换成第几个标签
        if (typeof tag !== 'string') {
          errors.push(`validation.domain.tagMustBeString|${index + 1}`);
        } else if (tag.length > MAX_TAG_LENGTH) {
          errors.push(`validation.domain.tagTooLong|${index + 1}`);
        }
      });
    } else if (typeof domainObj.tags === 'string') {
      // 如果是JSON字符串，尝试解析
      try {
        const parsedTags = JSON.parse(domainObj.tags);
        if (Array.isArray(parsedTags) && parsedTags.length > MAX_TAGS_COUNT) {
          errors.push('validation.domain.tagsTooMany');
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
const VALID_CURRENCIES = ['USD'];

/**
 * 将校验结果中的 i18n 键（validation.*）转为当前语言文案；非键字符串原样返回。
 * 支持 `key|arg0|arg1` 形式的位置参数——译文里的 {0}/{1} 会被依次替换
 * （目前只有标签序号用到，其余上限值直接写死在译文里，与 transaction 一致）。
 */
export function translateValidationMessages(
  errors: string[],
  t: (key: string) => string
): string[] {
  return errors.map((e) => {
    // 批量创建的报错带 `#3: ` 前缀标明是第几条；先摘掉再翻译，翻完原样补回
    const itemMatch = /^(#\d+: )(.*)$/.exec(e);
    const itemPrefix = itemMatch ? itemMatch[1] : '';
    const raw = itemMatch ? itemMatch[2] : e;

    if (!raw.startsWith('validation.')) return e;

    const [key, ...params] = raw.split('|');
    const translated = t(key);
    if (translated === key) return e;

    return itemPrefix + params.reduce((text, param, i) => text.split(`{${i}}`).join(param), translated);
  });
}

// 验证交易数据（errors 使用 i18n 键，由前端 t() 或 translateValidationMessages 展示）
export function validateTransaction(transaction: unknown): ValidationResult {
  const errors: string[] = [];

  if (!transaction || typeof transaction !== 'object' || transaction === null) {
    errors.push('validation.transaction.invalidFormat');
    return { valid: false, errors };
  }

  const transactionObj = transaction as Record<string, unknown>;

  // 域名ID验证
  if (!transactionObj.domain_id || typeof transactionObj.domain_id !== 'string') {
    errors.push('validation.transaction.domainIdRequired');
  } else if ((transactionObj.domain_id as string).trim().length === 0) {
    errors.push('validation.transaction.domainIdEmpty');
  }

  // 交易类型验证
  if (!transactionObj.type || typeof transactionObj.type !== 'string') {
    errors.push('validation.transaction.typeRequired');
  } else if (!['buy', 'renew', 'sell', 'transfer', 'fee', 'marketing', 'advertising'].includes(transactionObj.type as string)) {
    errors.push('validation.transaction.typeInvalid');
  }

  // 金额验证
  if (transactionObj.amount === null || transactionObj.amount === undefined) {
    errors.push('validation.transaction.amountRequired');
  } else {
    const amount = Number(transactionObj.amount);
    if (isNaN(amount) || !isFinite(amount)) {
      errors.push('validation.transaction.amountInvalidNumber');
    } else if (amount <= 0) {
      errors.push('validation.transaction.amountMustBePositive');
    } else if (amount > MAX_TRANSACTION_AMOUNT) {
      errors.push('validation.transaction.amountExceedsMax');
    }
  }

  // 货币验证
  if (!transactionObj.currency || typeof transactionObj.currency !== 'string') {
    errors.push('validation.transaction.currencyRequired');
  } else {
    const currency = (transactionObj.currency as string).toUpperCase();
    if (!VALID_CURRENCIES.includes(currency)) {
      errors.push('validation.transaction.currencyInvalid');
    }
  }

  // 交易日期验证
  if (!transactionObj.date || typeof transactionObj.date !== 'string') {
    errors.push('validation.transaction.dateRequired');
  } else {
    const date = new Date(transactionObj.date as string);
    if (isNaN(date.getTime())) {
      errors.push('validation.transaction.dateInvalid');
    } else if (isDateBeyondAllowedFuture(date)) {
      errors.push('validation.transaction.dateBeyondMaxFuture');
    }
  }

  // 平台手续费百分比验证
  if (transactionObj.platform_fee_percentage !== null && transactionObj.platform_fee_percentage !== undefined) {
    const percentage = Number(transactionObj.platform_fee_percentage);
    if (isNaN(percentage) || !isFinite(percentage)) {
      errors.push('validation.transaction.platformFeePercentageInvalid');
    } else if (percentage < 0 || percentage > 100) {
      errors.push('validation.transaction.platformFeePercentageRange');
    }
  }

  // 平台手续费验证
  if (transactionObj.platform_fee !== null && transactionObj.platform_fee !== undefined) {
    const fee = Number(transactionObj.platform_fee);
    if (isNaN(fee) || !isFinite(fee)) {
      errors.push('validation.transaction.platformFeeInvalid');
    } else if (fee < 0) {
      errors.push('validation.transaction.platformFeeNonNegative');
    } else if (fee > MAX_TRANSACTION_AMOUNT) {
      errors.push('validation.transaction.platformFeeExceedsMax');
    }
  }

  // 净金额验证
  if (transactionObj.net_amount !== null && transactionObj.net_amount !== undefined) {
    const netAmount = Number(transactionObj.net_amount);
    if (isNaN(netAmount) || !isFinite(netAmount)) {
      errors.push('validation.transaction.netAmountInvalid');
    } else if (netAmount < 0) {
      errors.push('validation.transaction.netAmountNonNegative');
    }
  }

  // 备注验证
  if (transactionObj.notes !== null && transactionObj.notes !== undefined) {
    if (typeof transactionObj.notes !== 'string') {
      errors.push('validation.transaction.notesMustBeString');
    } else if (transactionObj.notes.length > MAX_NOTES_LENGTH) {
      errors.push('validation.transaction.notesTooLong');
    }
  }

  // 分类验证
  if (transactionObj.category !== null && transactionObj.category !== undefined) {
    if (typeof transactionObj.category !== 'string') {
      errors.push('validation.transaction.categoryMustBeString');
    } else if (transactionObj.category.length > MAX_CATEGORY_LENGTH) {
      errors.push('validation.transaction.categoryTooLong');
    }
  }

  // 收据URL验证
  if (transactionObj.receipt_url !== null && transactionObj.receipt_url !== undefined) {
    if (typeof transactionObj.receipt_url !== 'string') {
      errors.push('validation.transaction.receiptUrlMustBeString');
    } else if (transactionObj.receipt_url.length > MAX_RECEIPT_URL_LENGTH) {
      errors.push('validation.transaction.receiptUrlTooLong');
    } else if (transactionObj.receipt_url.trim().length > 0) {
      try {
        const parsed = new URL(transactionObj.receipt_url);
        // Reject javascript:, data:, file:, vbscript: etc. -- only safe to
        // render as an <a href> if the scheme can't execute script.
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          errors.push('validation.transaction.receiptUrlInvalidFormat');
        }
      } catch {
        errors.push('validation.transaction.receiptUrlInvalidFormat');
      }
    }
  }

  if (transactionObj.type === 'renew') {
    if (
      transactionObj.renewal_period_years !== null &&
      transactionObj.renewal_period_years !== undefined
    ) {
      const y = Number(transactionObj.renewal_period_years);
      if (!Number.isInteger(y) || y < 1 || y > 10) {
        errors.push('validation.transaction.renewalPeriodYearsRange');
      }
    }
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

  let baselineRenewalAsOf: string | null = null;
  if (typeof domainObj.baseline_renewal_as_of === 'string' && domainObj.baseline_renewal_as_of.trim()) {
    baselineRenewalAsOf = domainObj.baseline_renewal_as_of.trim().slice(0, 10);
  }

  let registrationDate: string | null = null;
  if (typeof domainObj.registration_date === 'string' && domainObj.registration_date.trim()) {
    registrationDate = domainObj.registration_date.trim().slice(0, 10);
  }

  let expiryDate: string | null = null;
  if (typeof domainObj.expiry_date === 'string' && domainObj.expiry_date.trim()) {
    expiryDate = domainObj.expiry_date.trim().slice(0, 10);
  }

  let nextRenewalDate: string | null = null;
  if (typeof domainObj.next_renewal_date === 'string' && domainObj.next_renewal_date.trim()) {
    nextRenewalDate = domainObj.next_renewal_date.trim().slice(0, 10);
  }

  return {
    ...domainObj,
    domain_name: domainName,
    registrar,
    purchase_date: domainObj.purchase_date || null,
    expiry_date: expiryDate,
    next_renewal_date: nextRenewalDate,
    purchase_cost: purchaseCost,
    renewal_cost: renewalCost,
    renewal_cycle: renewalCycle,
    renewal_count: renewalCount,
    baseline_renewal_as_of: baselineRenewalAsOf,
    registration_date: registrationDate,
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

  // 仅支持 USD
  const currency = 'USD';

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
        const parsed = new URL(url);
        // http/https only -- blocks javascript:/data:/file:/vbscript: etc.
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          receiptUrl = url;
        }
      } catch {
        receiptUrl = null;
      }
    }
  }

  let renewalPeriodYears: number | null = null;
  if (transactionObj.type === 'renew' && transactionObj.renewal_period_years != null) {
    const y = Math.floor(Number(transactionObj.renewal_period_years));
    if (Number.isInteger(y) && y >= 1 && y <= 10) renewalPeriodYears = y;
  }

  return {
    ...transactionObj,
    amount,
    currency,
    platform_fee: platformFee,
    platform_fee_percentage: platformFeePercentage,
    net_amount: netAmount,
    notes,
    category,
    tax_deductible: Boolean(transactionObj.tax_deductible),
    receipt_url: receiptUrl,
    renewal_period_years: renewalPeriodYears
  };
}
