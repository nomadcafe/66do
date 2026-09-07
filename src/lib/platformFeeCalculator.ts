/**
 * 平台费用计算器
 * 支持不同平台的分期费用规则
 */

export type AtomCommissionTier = 'standard' | 'plus' | 'premium' | 'byol' | 'custom';
export type EscrowLeaseType = 'lease_with_purchase' | 'lease_only';

export interface PlatformFeeConfig {
  type: 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment';
  installmentPeriod: number;
  sellerAmount: number; // 卖家收到的金额
  customFeeRate?: number; // 自定义费率（用于standard类型）
  escrowFee?: number; // Escrow 标准交易费 + 可选的一次性事件费（手填，用于 escrow_installment）
  domainHoldingFee?: number; // 域名持有费（手填覆盖；不填则按 escrowLeaseType + amount + period 自动算）
  escrowLeaseType?: EscrowLeaseType; // 'lease_with_purchase' = LWP / 'lease_only' = LO
  // 用户输入的费用率
  userInputFeeRate?: number; // 用户输入的分期费用率（用于afternic等）
  userInputSurchargeRate?: number; // 用户输入的surcharge率（用于atom）
  // Afternic Installment 专用：标准佣金率受这两个 flag 影响（15% / 20% / 25% / 30%）
  afternicNsPointed?: boolean; // 域名 NS 是否指向 Afternic（默认 true → 15% 起算；false → 25%）
  afternicPremiumAddon?: boolean; // 是否开启 Premium add-on（+5%）
  // Atom Installment 专用：决定卖家 base commission 的档位
  atomCommissionTier?: AtomCommissionTier;
  atomNoCoin?: boolean; // 仅在 Premium 且 listPrice ≤ $4,998 时把 30% 顶到 35%
  atomCustomCommissionRate?: number; // tier='custom' 时使用；其它 tier 也可作为覆盖
  /**
   * sellerAmount 传的是标价而不是卖家净收入。
   * 表单路径必须为 true：表单上的 amount 一直是标价，分期金额是它的拆分，
   * 再按 net/(1−佣金率) 反推一次就会把标价放大一圈。
   */
  amountIsListPrice?: boolean;
}

export interface PlatformFeeResult {
  customerTotalAmount: number; // 客户总付款金额
  platformFee: number; // 平台费用
  platformFeeRate: number; // 平台费用率
  sellerNetAmount: number; // 卖家净收入
  breakdown: {
    baseAmount: number; // 基础金额
    feeAmount: number; // 费用金额
    surchargeAmount?: number; // 附加费用（Atom专用）
    // Afternic新字段
    serviceFee?: number; // 客户服务费
    commission?: number; // 卖家佣金
    commissionRate?: number; // 有效佣金率
    commissionDiscount?: number; // 佣金折扣
    serviceFeeRate?: number; // 服务费率
    // Atom 专用细分
    surchargeRate?: number; // 期数对应的 surcharge 率
    sellerSurchargeShare?: number; // 卖家从 surcharge 拿到的金额（65% 部分）
    atomBaseCommission?: number; // 卖家 base 佣金金额
    atomBaseCommissionRate?: number; // 卖家 base 佣金率
    atomCommissionTier?: AtomCommissionTier;
    // Escrow 专用细分
    escrowHoldingFee?: number; // 域名持有费总额（自动或手填）
    escrowMonthlyHoldingFee?: number; // 每月持有费
    escrowTransactionFee?: number; // Escrow 标准交易费（含可选一次性事件费）
    escrowLeaseType?: EscrowLeaseType;
  };
}

/**
 * 卖家到目前为止实际收到的金额。
 *
 * 关键是别把「尾款那一期」当成普通期：表单里 installmentAmount 只覆盖
 * regularPeriods = 期数 − (有尾款 ? 1 : 0) 期，最后一期走 finalPayment。
 * 直接 `installmentAmount × paidPeriods` 在有尾款时会多算一期、少算尾款，
 * 和 calculateTotalInstallmentAmount 给出的总额对不上。
 */
function sellerReceivedByPeriod(
  downpayment: number,
  installmentAmount: number,
  paidPeriods: number,
  totalPeriods: number,
  finalPayment: number
): number {
  const regularPeriods = totalPeriods - (finalPayment > 0 ? 1 : 0);
  const regularPaid = Math.max(0, Math.min(paidPeriods, regularPeriods));
  const finalPaid = finalPayment > 0 && paidPeriods >= totalPeriods ? finalPayment : 0;
  return downpayment + installmentAmount * regularPaid + finalPaid;
}

/**
 * 计算平台费用
 */
export function calculatePlatformFee(config: PlatformFeeConfig): PlatformFeeResult {
  const {
    type,
    installmentPeriod,
    sellerAmount,
    customFeeRate,
    escrowFee,
    domainHoldingFee,
    userInputFeeRate,
    userInputSurchargeRate,
    afternicNsPointed,
    afternicPremiumAddon,
    atomCommissionTier,
    atomNoCoin,
    atomCustomCommissionRate,
    escrowLeaseType,
    amountIsListPrice,
  } = config;

  switch (type) {
    case 'standard':
      return calculateStandardFee(sellerAmount, customFeeRate || 0.15);

    case 'afternic_installment':
      return calculateAfternicInstallmentFee(
        sellerAmount,
        installmentPeriod,
        userInputFeeRate,
        afternicNsPointed,
        afternicPremiumAddon,
        amountIsListPrice
      );

    case 'atom_installment':
      return calculateAtomInstallmentFee(
        sellerAmount,
        installmentPeriod,
        userInputSurchargeRate,
        atomCommissionTier,
        atomNoCoin,
        atomCustomCommissionRate,
      );

    case 'spaceship_installment':
      // sellerAmount 到这里其实是分期总额（调用方按 installmentAmount × period 传入），
      // 与 calculateCustomerTotalFromInstallment 的 total-sale 路径同口径。
      // 旧实现在这里用 sellerAmount / (1 − 5%) 反推，与那条路径给出不同答案。
      // customFeeRate 必须往下传：交易自带的费率优先于当前默认值，否则
      // 这条分支会把按旧费率成交的交易按新默认值重算（同一个问题在
      // feeRateForTotalSaleInstallmentPath 里也有过，见那里的注释）。
      return calculateInstallmentFeeFromTotalSale(
        sellerAmount,
        feeRateForTotalSaleInstallmentPath('spaceship_installment', customFeeRate)
      );

    case 'escrow_installment':
      return calculateEscrowInstallmentFee(
        sellerAmount,
        installmentPeriod,
        escrowFee,
        domainHoldingFee,
        escrowLeaseType,
      );

    default:
      throw new Error(`Unsupported platform fee type: ${type}`);
  }
}

/**
 * 标准费用计算（15%）
 */
function calculateStandardFee(sellerAmount: number, feeRate: number): PlatformFeeResult {
  const customerTotalAmount = sellerAmount / (1 - feeRate);
  const platformFee = customerTotalAmount - sellerAmount;
  const platformFeeRate = platformFee / customerTotalAmount;

  return {
    customerTotalAmount,
    platformFee,
    platformFeeRate,
    sellerNetAmount: sellerAmount,
    breakdown: {
      baseAmount: customerTotalAmount,
      feeAmount: platformFee,
    }
  };
}

/** 卖家佣金折扣（按期数）：0-12 月 0%、13-24 月 5%、25-36 月 10%、37-60 月 15% */
export function getAfternicCommissionDiscount(installmentPeriod: number): number {
  if (installmentPeriod <= 12) return 0;
  if (installmentPeriod <= 24) return 0.05;
  if (installmentPeriod <= 36) return 0.10;
  return 0.15;
}

/** 卖家标准佣金：基础 15%（NS 指向 Afternic）或 25%（未指向），可选 Premium add-on +5% */
export function getAfternicStandardCommissionRate(
  afternicNsPointed?: boolean,
  afternicPremiumAddon?: boolean
): number {
  const nsPointed = afternicNsPointed ?? true;
  const premiumAddon = afternicPremiumAddon ?? false;
  return (nsPointed ? 0.15 : 0.25) + (premiumAddon ? 0.05 : 0);
}

/** 有效佣金率 = max(0, 标准佣金率 − 折扣) */
export function getAfternicEffectiveCommissionRate(
  installmentPeriod: number,
  afternicNsPointed?: boolean,
  afternicPremiumAddon?: boolean
): number {
  return Math.max(
    0,
    getAfternicStandardCommissionRate(afternicNsPointed, afternicPremiumAddon)
      - getAfternicCommissionDiscount(installmentPeriod)
  );
}

/**
 * Afternic分期费用计算
 * - 客户服务费（LTO 服务费）：2-12 月 0%、13-24 月 10%、25-36 月 20%、37-60 月 30%
 * - 卖家标准佣金：基础 15%（NS 指向 Afternic）或 25%（未指向），可选 Premium add-on +5%
 *   → 标准佣金落在 15% / 20% / 25% / 30% 之一
 * - 卖家佣金折扣（按期数）：0-12 月 0%、13-24 月 5%、25-36 月 10%、37-60 月 15%
 * - 有效佣金率 = max(0, 标准佣金率 − 折扣)
 */
function calculateAfternicInstallmentFee(
  sellerAmount: number,
  installmentPeriod: number,
  userInputFeeRate?: number,
  afternicNsPointed?: boolean,
  afternicPremiumAddon?: boolean,
  /** true = sellerAmount 传的其实是标价（listPrice），不要再往上反推 */
  amountIsListPrice?: boolean
): PlatformFeeResult {
  // Buyer service fee (added to list price): 2–12 months 0%, 13–24 10%, 25–36 20%, 37–60 30%
  // Only use userInputFeeRate when explicitly set; default 0 from form means "use tier" (so 37–60 gets 30%)
  let serviceFeeRate: number;
  const useTierForServiceFee =
    userInputFeeRate === undefined ||
    userInputFeeRate === null ||
    (installmentPeriod > 12 && userInputFeeRate === 0);
  if (!useTierForServiceFee) {
    serviceFeeRate = userInputFeeRate!;
  } else {
    if (installmentPeriod <= 12) {
      serviceFeeRate = 0; // 2–12 months: no service fee
    } else if (installmentPeriod <= 24) {
      serviceFeeRate = 0.10; // 13–24 months: 10%
    } else if (installmentPeriod <= 36) {
      serviceFeeRate = 0.20; // 25–36 months: 20%
    } else if (installmentPeriod <= 60) {
      serviceFeeRate = 0.30; // 37–60 months: 30%
    } else {
      serviceFeeRate = 0.30;
    }
  }

  const commissionDiscount = getAfternicCommissionDiscount(installmentPeriod);
  const effectiveCommissionRate = getAfternicEffectiveCommissionRate(
    installmentPeriod,
    afternicNsPointed,
    afternicPremiumAddon
  );

  // 两种入参口径：
  //   amountIsListPrice = true  → sellerAmount 就是标价，直接用（表单路径：
  //     表单上的 amount 一直是标价，分期金额是它的拆分，不该再被反推一次）
  //   否则 → sellerAmount 是卖家净收入，按 net/(1−佣金率) 反推标价（旧调用口径）
  // 两条路在数学上互逆：净额入参反推出的 listPrice，其 listPrice − commission
  // 正好等于入参本身，所以旧调用方的结果逐位不变。
  const listPrice =
    amountIsListPrice || effectiveCommissionRate === 0
      ? sellerAmount
      : sellerAmount / (1 - effectiveCommissionRate);

  // 客户总付款 = 标价 + 服务费（服务费是买家在标价之外额外付的）
  const serviceFee = listPrice * serviceFeeRate;
  const customerTotalAmount = listPrice + serviceFee;

  // 平台总收益 = 服务费 + 佣金
  const commission = listPrice * effectiveCommissionRate;
  const platformFee = serviceFee + commission;
  const platformFeeRate = platformFee / customerTotalAmount;

  return {
    customerTotalAmount,
    platformFee,
    platformFeeRate,
    sellerNetAmount: listPrice - commission,
    breakdown: {
      baseAmount: listPrice,
      feeAmount: platformFee,
      serviceFee: serviceFee,
      commission: commission,
      commissionRate: effectiveCommissionRate,
      commissionDiscount: commissionDiscount,
      serviceFeeRate: serviceFeeRate,
    }
  };
}

/** Atom 分期 surcharge：12 月 10% / 24 月 15% / 36 月 20% / 48 月 25%；< 12 月没有；> 48 月按 25%。 */
export function getAtomSurchargeRate(installmentPeriod: number): number {
  if (installmentPeriod < 12) return 0;
  if (installmentPeriod <= 12) return 0.10;
  if (installmentPeriod <= 24) return 0.15;
  if (installmentPeriod <= 36) return 0.20;
  return 0.25;
}

/** 卖家从 surcharge 拿到的份额；剩下 35% 归 Atom。 */
export const ATOM_SURCHARGE_SELLER_SHARE = 0.65;

/**
 * Atom 卖家 base commission（按 listing tier 决定）。
 * - standard: 7.5%
 * - plus:     15%
 * - premium:  按售价阶梯（≤4998: 30% / ≤49999: 25% / ≤74999: 20% / ≥75000: 15%；
 *             noCoin 仅把 ≤4998 这档顶到 35%）
 * - byol:     按售价阶梯，含 ≤4999 档的 min $25
 * - custom:   使用 customRate（默认 0）
 *
 * 返回的是「金额」（USD），不是 rate；BYOL 的 min $25 规则会让 effective rate 大于阶梯值。
 */
export function getAtomBaseCommissionAmount(
  listPrice: number,
  tier: AtomCommissionTier = 'standard',
  options?: { noCoin?: boolean; customRate?: number }
): number {
  if (listPrice <= 0) return 0;
  const customRate = options?.customRate;

  if (tier === 'custom') {
    return listPrice * (customRate ?? 0);
  }
  if (tier === 'standard') return listPrice * 0.075;
  if (tier === 'plus') return listPrice * 0.15;
  if (tier === 'premium') {
    if (listPrice <= 4998) return listPrice * (options?.noCoin ? 0.35 : 0.30);
    if (listPrice <= 49999) return listPrice * 0.25;
    if (listPrice <= 74999) return listPrice * 0.20;
    return listPrice * 0.15;
  }
  // byol：1.35–4.5%，但 ≤$4,999 这档佣金不低于 $25
  if (tier === 'byol') {
    let rate: number;
    if (listPrice < 50000) rate = 0.045;
    else if (listPrice < 200000) rate = 0.0375;
    else if (listPrice < 500000) rate = 0.029;
    else if (listPrice < 1000000) rate = 0.0225;
    else if (listPrice < 3000000) rate = 0.019;
    else if (listPrice < 10000000) rate = 0.0175;
    else rate = 0.0135;
    const raw = listPrice * rate;
    return listPrice < 5000 ? Math.max(25, raw) : raw;
  }
  return 0;
}

/**
 * Atom分期费用计算
 *
 * 入参 sellerAmount 在此处的语义是「listPrice / baseAmount」（与表单 amount 对齐），不再反推。
 * - Buyer 总付 = listPrice + surchargeAmount
 * - Seller 净 = (listPrice − base commission) + surcharge × 65%
 * - Platform = base commission + surcharge × 35%
 *
 * surchargeRate：默认按期数推（< 12 月 0%、12 月 10%、24 月 15%、36 月 20%、≥ 48 月 25%）；
 * 用户输入的 userInputSurchargeRate 会覆盖默认值，但表单留空回传 0 时（以及 < 12 月场景）
 * 仍按期数自动推 — 与 Afternic 同款约定，避免 12+ 月场景被误判成 0% 没收 surcharge。
 *
 * baseCommission：由 atomCommissionTier 决定（standard/plus/premium/byol/custom），见
 * getAtomBaseCommissionAmount。tier 缺省为 standard，向后兼容旧记录（旧代码默认 0% base，
 * 升级后会从 7.5% 起算 — 这是修正行为，不是回归）。
 */
function calculateAtomInstallmentFee(
  sellerAmount: number,
  installmentPeriod: number,
  userInputSurchargeRate?: number,
  atomCommissionTier?: AtomCommissionTier,
  atomNoCoin?: boolean,
  atomCustomCommissionRate?: number,
): PlatformFeeResult {
  const listPrice = sellerAmount;
  // 表单的 user_input_surcharge_rate 默认 0 表示"留空 = 按期数自动"。
  // 只有当 12+ 月仍传 0 时回退到 tier；显式传非 0 值 / < 12 月场景按字面值用。
  const useTierForSurcharge =
    userInputSurchargeRate === undefined ||
    userInputSurchargeRate === null ||
    (installmentPeriod >= 12 && userInputSurchargeRate === 0);
  const surchargeRate = useTierForSurcharge
    ? getAtomSurchargeRate(installmentPeriod)
    : userInputSurchargeRate!;

  const surchargeAmount = listPrice * surchargeRate;
  const sellerSurchargeShare = surchargeAmount * ATOM_SURCHARGE_SELLER_SHARE;
  const platformSurchargeShare = surchargeAmount - sellerSurchargeShare;

  const tier: AtomCommissionTier = atomCommissionTier ?? 'standard';
  const baseCommission = getAtomBaseCommissionAmount(listPrice, tier, {
    noCoin: atomNoCoin,
    customRate: atomCustomCommissionRate,
  });
  const baseCommissionRate = listPrice > 0 ? baseCommission / listPrice : 0;

  const customerTotalAmount = listPrice + surchargeAmount;
  const sellerNetAmount = listPrice - baseCommission + sellerSurchargeShare;
  const platformFee = baseCommission + platformSurchargeShare;
  const platformFeeRate = customerTotalAmount > 0 ? platformFee / customerTotalAmount : 0;

  return {
    customerTotalAmount,
    platformFee,
    platformFeeRate,
    sellerNetAmount,
    breakdown: {
      baseAmount: listPrice,
      feeAmount: platformFee,
      surchargeAmount,
      surchargeRate,
      sellerSurchargeShare,
      atomBaseCommission: baseCommission,
      atomBaseCommissionRate: baseCommissionRate,
      atomCommissionTier: tier,
    }
  };
}

/** Standard 分期与 Spaceship 同款算法时的默认平台费率（对分期总额） */
export const STANDARD_INSTALLMENT_TOTAL_SALE_FEE_RATE = 0.1;

/**
 * Spaceship 分期的**默认**费率，2026-09 起为 10%（此前为 5%）。
 *
 * 强调"默认"：费率是有生效日期的商业条款，不是恒定常量。每笔交易可以在
 * platform_fee_percentage 上带自己的费率，那个值优先——按旧费率成交的交易
 * 因此不会被后来的调价追溯重算。这里的常量只对"没有显式记录费率"的交易生效。
 *
 * 为什么必须这样：平台费 = 总售价 × 费率 × 已付比例，费率作用在整笔交易上。
 * 如果只把这个常量从 0.05 改成 0.10，所有历史 Spaceship 分期（含已经收完的、
 * 和正在收款中的那笔已收部分）都会被重新定价——2026-09 之前成交的交易凭空
 * 多出一倍平台费。
 */
export const SPACESHIP_INSTALLMENT_DEFAULT_FEE_RATE = 0.1;

/**
 * 分期总额口径的平台费：客户总付 = 分期总额；平台费 = 总额 × 费率；卖家净得 = 总额 − 平台费
 */
function calculateInstallmentFeeFromTotalSale(
  totalSaleAmount: number,
  feeRateDecimal: number
): PlatformFeeResult {
  if (totalSaleAmount <= 0) {
    return {
      customerTotalAmount: 0,
      platformFee: 0,
      platformFeeRate: feeRateDecimal,
      sellerNetAmount: 0,
      breakdown: { baseAmount: 0, feeAmount: 0 }
    };
  }
  const platformFee = totalSaleAmount * feeRateDecimal;
  const sellerNetAmount = totalSaleAmount - platformFee;
  const platformFeeRate = platformFee / totalSaleAmount;
  return {
    customerTotalAmount: totalSaleAmount,
    platformFee,
    platformFeeRate,
    sellerNetAmount,
    breakdown: {
      baseAmount: totalSaleAmount,
      feeAmount: platformFee
    }
  };
}

/**
 * 分期总额口径下该用哪个费率。
 *
 * 优先级：交易自带的费率（platform_fee_percentage，经调用方换算成小数传进来）
 * > 该平台的当前默认费率。Spaceship 原本在这里直接 `return 0.05` 短路，把
 * 调用方传进来的 customFeeRate 丢掉了——结果是费率只能全局改，一改就追溯
 * 重算所有历史交易。现在与 standard 分支同样先看 customFeeRate。
 */
function feeRateForTotalSaleInstallmentPath(
  platformFeeType: string,
  customFeeRate?: number
): number {
  const explicit =
    customFeeRate != null && customFeeRate > 0 && customFeeRate <= 1 ? customFeeRate : null;
  if (explicit !== null) return explicit;
  if (platformFeeType === 'spaceship_installment') return SPACESHIP_INSTALLMENT_DEFAULT_FEE_RATE;
  return STANDARD_INSTALLMENT_TOTAL_SALE_FEE_RATE;
}

/**
 * Escrow.com 域名持有费的「每月」金额。
 * - Lease with Purchase: max($100, listPrice × 0.0001)
 * - Lease Only:          max($200, listPrice × 0.0002)
 * 即 0.01% / 0.02% 的字面解读（一万分之一 / 一万分之二），minimum 在小金额域名上常占主导。
 */
export function getEscrowMonthlyHoldingFee(listPrice: number, leaseType: EscrowLeaseType): number {
  if (listPrice <= 0) return 0;
  if (leaseType === 'lease_only') return Math.max(200, listPrice * 0.0002);
  return Math.max(100, listPrice * 0.0001);
}

/** 持有期总金额 = 每月 × 月数。 */
export function getEscrowHoldingFee(listPrice: number, months: number, leaseType: EscrowLeaseType): number {
  if (months <= 0) return 0;
  return getEscrowMonthlyHoldingFee(listPrice, leaseType) * months;
}

/**
 * Escrow.com 分期费用计算
 *
 * sellerAmount 在此处的语义是 listPrice / Subtotal（与表单 amount 对齐）。
 * - Holding Fee：未传入 domainHoldingFee 时按 escrowLeaseType + listPrice + period 自动算；
 *   传入 domainHoldingFee 时尊重手填值。
 * - Escrow Transaction Fee：完全手填（escrowFee 入参）；含 schedule change ($250) /
 *   DNS admin ($85) 这类一次性费用时由用户合并加入。
 * - 现金流默认按"buyer 付一切、seller 拿全额"建模（与现实最常见情形对齐，与原算法一致）；
 *   实际谁付/对半付由用户自行解读，不在这层硬编码。
 */
function calculateEscrowInstallmentFee(
  sellerAmount: number,
  installmentPeriod: number,
  escrowFee?: number,
  domainHoldingFee?: number,
  escrowLeaseType?: EscrowLeaseType,
): PlatformFeeResult {
  const listPrice = sellerAmount;
  const transactionFee = escrowFee ?? 0;
  const leaseType: EscrowLeaseType = escrowLeaseType ?? 'lease_with_purchase';
  const monthlyHolding = getEscrowMonthlyHoldingFee(listPrice, leaseType);
  // `!= null` 而不是 `> 0`：0 是「这笔没有托管费」这个明确意图，不是「没填」。
  // 以前用 > 0 判断，填 0 会静默回退到自动估算，等于用户根本关不掉它。
  const holdingFee =
    domainHoldingFee != null
      ? domainHoldingFee
      : getEscrowHoldingFee(listPrice, installmentPeriod, leaseType);

  const totalFees = holdingFee + transactionFee;
  const customerTotalAmount = listPrice + totalFees;
  const platformFeeRate = customerTotalAmount > 0 ? totalFees / customerTotalAmount : 0;

  return {
    customerTotalAmount,
    platformFee: totalFees,
    platformFeeRate,
    sellerNetAmount: listPrice,
    breakdown: {
      baseAmount: listPrice,
      feeAmount: totalFees,
      escrowHoldingFee: holdingFee,
      escrowMonthlyHoldingFee: monthlyHolding,
      escrowTransactionFee: transactionFee,
      escrowLeaseType: leaseType,
    }
  };
}

/**
 * 与 TransactionForm Installment Summary 一致的分期总额（客户/出售总金额）
 */
export function calculateTotalInstallmentAmount(
  downpayment: number,
  installmentAmount: number,
  installmentPeriod: number,
  finalPaymentAmount: number
): number {
  const regularPeriods = installmentPeriod - (finalPaymentAmount > 0 ? 1 : 0);
  return downpayment + installmentAmount * regularPeriods + finalPaymentAmount;
}

/**
 * 根据分期金额和期数计算客户总付款 / 平台费
 * Spaceship：分期总额 × 5%。Standard 分期：同算法，默认分期总额 × 10%（customFeeRate 可覆盖，0–1）
 */
export function calculateCustomerTotalFromInstallment(
  installmentAmount: number,
  installmentPeriod: number,
  platformFeeType: string,
  customFeeRate?: number,
  escrowFee?: number,
  domainHoldingFee?: number,
  userInputFeeRate?: number,
  userInputSurchargeRate?: number,
  options?: {
    downpaymentAmount?: number;
    finalPaymentAmount?: number;
    afternicNsPointed?: boolean;
    afternicPremiumAddon?: boolean;
    grossAmount?: number; // form 上的 amount = listPrice；Atom / Escrow 算法以此为基。
    atomCommissionTier?: AtomCommissionTier;
    atomNoCoin?: boolean;
    atomCustomCommissionRate?: number;
    escrowLeaseType?: EscrowLeaseType;
  }
): PlatformFeeResult {
  const downpayment = options?.downpaymentAmount ?? 0;
  const finalPayment = options?.finalPaymentAmount ?? 0;

  const useTotalSalePath =
    (platformFeeType === 'spaceship_installment' || platformFeeType === 'standard') &&
    (downpayment > 0 || installmentAmount > 0);

  if (useTotalSalePath) {
    const totalSaleAmount = calculateTotalInstallmentAmount(
      downpayment,
      installmentAmount,
      installmentPeriod,
      finalPayment
    );
    if (totalSaleAmount > 0) {
      const rate = feeRateForTotalSaleInstallmentPath(platformFeeType, customFeeRate);
      return calculateInstallmentFeeFromTotalSale(totalSaleAmount, rate);
    }
  }

  // Afternic / Atom / Escrow：算法以 listPrice 为基，优先用 form 的 grossAmount；
  // 否则回退到 down + installment×period + final（旧调用兼容）。
  //
  // Afternic 是后加进来的：表单的 installment_amount 现在是 amount（标价）的
  // 纯拆分，`down + inst×n + final` 因此等于标价而不是卖家净收入。仍按净额口径
  // 喂给 calculateAfternicInstallmentFee 会让它再反推一次，标价被放大 1/(1−佣金率)。
  const usesGrossAmount =
    platformFeeType === 'afternic_installment' ||
    platformFeeType === 'atom_installment' ||
    platformFeeType === 'escrow_installment';
  const grossProvided = !!(options?.grossAmount && options.grossAmount > 0);
  // 非 gross 路径（Afternic 及回退分支）的 sellerAmount 是「卖家净收入总额」。
  // 曾经写成 installmentAmount * installmentPeriod —— 首付和尾款不在里面，而
  // 表单恰恰是先把它们从总额里扣掉再摊到每期的（TransactionForm 的
  // remainingAmount = sellerProceeds − downpayment − finalPayment）。结果是
  // 首付整笔从费用计算里消失：标价 $10,000 / 首付 $2,000 的 Afternic 分期，
  // 客户总付显示 $8,555 而不是 $11,000，卖家净显示 $7,000 而不是 $9,000。
  // 走 calculateTotalInstallmentAmount，与 Spaceship / Standard 路径同一套拆分。
  const sellerAmount =
    usesGrossAmount && grossProvided
      ? (options!.grossAmount as number)
      : calculateTotalInstallmentAmount(
          downpayment,
          installmentAmount,
          installmentPeriod,
          finalPayment
        );

  return calculatePlatformFee({
    type: platformFeeType as 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment',
    installmentPeriod,
    sellerAmount,
    customFeeRate,
    escrowFee,
    domainHoldingFee,
    userInputFeeRate,
    userInputSurchargeRate,
    afternicNsPointed: options?.afternicNsPointed,
    afternicPremiumAddon: options?.afternicPremiumAddon,
    atomCommissionTier: options?.atomCommissionTier,
    atomNoCoin: options?.atomNoCoin,
    atomCustomCommissionRate: options?.atomCustomCommissionRate,
    escrowLeaseType: options?.escrowLeaseType,
    // 只有真的拿到了表单的标价才声明「入参是标价」；回退分支传的是
    // down + inst×n + final，那条路仍是旧的净额口径。
    amountIsListPrice: usesGrossAmount && grossProvided,
  });
}

/** installmentFeeFromFormValues 的入参：表单上与费用相关的全部字段 */
export interface InstallmentFeeFormValues {
  /** 出售毛额（表单 amount，= listPrice） */
  amount: number;
  /** 表单的平台费百分比（0–100）。> 0 时覆盖该平台的默认费率。 */
  platformFeePercentage: number;
  installment_amount: number;
  installment_period: number;
  platform_fee_type: string;
  downpayment_amount: number;
  final_payment_amount: number;
  user_input_fee_rate: number;
  user_input_surcharge_rate: number;
  afternic_ns_pointed: boolean;
  afternic_premium_addon: boolean;
  atom_commission_tier: AtomCommissionTier;
  atom_no_coin: boolean;
  atom_custom_commission_rate: number;
  escrow_lease_type: EscrowLeaseType;
  /** null = 未记录（自动估算）；数字含 0 = 明确值 */
  escrow_holding_fee: number | null;
  escrow_transaction_fee: number;
}

/**
 * 从表单字段算出这笔分期的平台费。
 *
 * 存在的意义是「只有一处地方知道怎么拼这些参数」：这套参数原本在
 * InstallmentConfig 的 JSX 里内联拼装，而 TransactionForm 需要同一个结果去写
 * platform_fee —— 两边各拼一次迟早会漂。算不出来时返回 null（没有分期金额）。
 */
export function installmentFeeFromFormValues(
  v: InstallmentFeeFormValues
): PlatformFeeResult | null {
  if (!(v.installment_amount > 0)) return null;
  const feeRateOverride =
    v.platformFeePercentage > 0 ? v.platformFeePercentage / 100 : undefined;
  try {
    return calculateCustomerTotalFromInstallment(
      v.installment_amount,
      v.installment_period,
      v.platform_fee_type || 'standard',
      feeRateOverride,
      v.escrow_transaction_fee,
      v.escrow_holding_fee ?? undefined,
      v.user_input_fee_rate,
      v.user_input_surcharge_rate,
      {
        downpaymentAmount: v.downpayment_amount,
        finalPaymentAmount: v.final_payment_amount,
        afternicNsPointed: v.afternic_ns_pointed,
        afternicPremiumAddon: v.afternic_premium_addon,
        grossAmount: v.amount,
        atomCommissionTier: v.atom_commission_tier,
        atomNoCoin: v.atom_no_coin,
        atomCustomCommissionRate: v.atom_custom_commission_rate,
        escrowLeaseType: v.escrow_lease_type,
      }
    );
  } catch {
    return null;
  }
}

/**
 * 该笔交易应记的 platform_fee —— **卖家侧**的扣减，不含买家服务费 / surcharge。
 *
 * 口径由 schema 决定：performSave 存的是 net_amount = amount − platform_fee，
 * 而 amount 是标价。所以 platform_fee 必须正好等于 amount − 卖家净收入，
 * 这样 net_amount 才等于卖家真正到手的钱。直接把 result.platformFee 存进去是
 * 错的——它含 Afternic 的买家服务费 / Atom 的 surcharge，那部分是买家额外付的，
 * 从来不是卖家的钱，扣进 net_amount 会把卖家收入算低一大截。
 *
 * Atom 的 surcharge 分成可能让卖家净收入超过标价，这时返回 0（schema 里
 * net_amount 不能大于 amount）。
 */
export function sellerSidePlatformFee(
  amount: number,
  result: PlatformFeeResult | null
): number | null {
  if (!result) return null;
  if (!(amount > 0)) return null;
  const fee = amount - result.sellerNetAmount;
  if (!Number.isFinite(fee)) return null;
  return Math.max(0, fee);
}

/**
 * 根据已付期数计算实际收到的金额和平台费用
 * Spaceship / Standard 分期：与分期总额算法一致；已付部分按「已收/分期总额」比例分摊平台费
 */
export function calculatePaidAmountFromInstallment(
  installmentAmount: number,
  paidPeriods: number,
  totalPeriods: number,
  platformFeeType: string,
  customFeeRate?: number,
  escrowFee?: number,
  domainHoldingFee?: number,
  userInputFeeRate?: number,
  userInputSurchargeRate?: number,
  options?: {
    downpaymentAmount?: number;
    finalPaymentAmount?: number;
    afternicNsPointed?: boolean;
    afternicPremiumAddon?: boolean;
    grossAmount?: number;
    atomCommissionTier?: AtomCommissionTier;
    atomNoCoin?: boolean;
    atomCustomCommissionRate?: number;
    escrowLeaseType?: EscrowLeaseType;
  }
): PlatformFeeResult {
  const downpayment = options?.downpaymentAmount ?? 0;
  const finalPayment = options?.finalPaymentAmount ?? 0;

  if (platformFeeType === 'spaceship_installment' || platformFeeType === 'standard') {
    const totalSaleAmount = calculateTotalInstallmentAmount(
      downpayment,
      installmentAmount,
      totalPeriods,
      finalPayment
    );
    const nominalRate = feeRateForTotalSaleInstallmentPath(platformFeeType, customFeeRate);
    if (totalSaleAmount <= 0) {
      return {
        customerTotalAmount: 0,
        platformFee: 0,
        platformFeeRate: nominalRate,
        sellerNetAmount: 0,
        breakdown: { baseAmount: 0, feeAmount: 0 }
      };
    }
    const totalResult = calculateInstallmentFeeFromTotalSale(totalSaleAmount, nominalRate);
    // 已付给卖家的金额。走 sellerReceivedByPeriod 而不是 installmentAmount ×
    // paidPeriods：有尾款时最后一期的金额是 finalPayment，不是 installmentAmount，
    // 否则全部付清时算出来的总额和 calculateTotalInstallmentAmount 对不上。
    const sellerReceivedSoFar = sellerReceivedByPeriod(
      downpayment,
      installmentAmount,
      paidPeriods,
      totalPeriods,
      finalPayment
    );
    const paidRatio = Math.min(1, sellerReceivedSoFar / totalSaleAmount);
    const platformFeePaid = totalResult.platformFee * paidRatio;
    // 客户已付现金 = 首付 + 已付期数对应的分期额（用户要求 Customer Paid 含首付）
    const customerPaidTotal = sellerReceivedSoFar;
    const sellerNetSoFar = sellerReceivedSoFar - platformFeePaid;

    return {
      customerTotalAmount: customerPaidTotal,
      platformFee: platformFeePaid,
      platformFeeRate: totalResult.platformFeeRate,
      sellerNetAmount: sellerNetSoFar,
      breakdown: {
        baseAmount: sellerReceivedSoFar,
        feeAmount: platformFeePaid
      }
    };
  }

  const usesGrossAmount =
    platformFeeType === 'atom_installment' || platformFeeType === 'escrow_installment';
  // 同 calculateCustomerTotalFromInstallment：首付/尾款必须计入卖家总额
  const totalSellerAmount =
    usesGrossAmount && options?.grossAmount && options.grossAmount > 0
      ? options.grossAmount
      : calculateTotalInstallmentAmount(
          downpayment,
          installmentAmount,
          totalPeriods,
          finalPayment
        );
  const totalResult = calculatePlatformFee({
    type: platformFeeType as 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment',
    installmentPeriod: totalPeriods,
    sellerAmount: totalSellerAmount,
    customFeeRate,
    escrowFee,
    domainHoldingFee,
    userInputFeeRate,
    userInputSurchargeRate,
    afternicNsPointed: options?.afternicNsPointed,
    afternicPremiumAddon: options?.afternicPremiumAddon,
    atomCommissionTier: options?.atomCommissionTier,
    atomNoCoin: options?.atomNoCoin,
    atomCustomCommissionRate: options?.atomCustomCommissionRate,
    escrowLeaseType: options?.escrowLeaseType,
  });

  // 进度比例：gross 路径（Atom / Escrow）按期数；非 gross 路径按「卖家实收 /
  // 卖家总额」——有首付时这两者不是一回事，按期数会把首付那部分算漏。
  // 没有首付也没有尾款时两者恒等（instAmt×paid / instAmt×total = paid/total），
  // 所以这不是行为变更，是把已有公式推广到带首付/尾款的情形。
  const sellerReceivedSoFar = sellerReceivedByPeriod(
    downpayment,
    installmentAmount,
    paidPeriods,
    totalPeriods,
    finalPayment
  );
  const paidRatio = usesGrossAmount
    ? paidPeriods / totalPeriods
    : totalSellerAmount > 0
      ? Math.min(1, sellerReceivedSoFar / totalSellerAmount)
      : 0;
  const customerTotalAmount = totalResult.customerTotalAmount * paidRatio;
  const platformFee = totalResult.platformFee * paidRatio;
  const platformFeeRate = totalResult.platformFeeRate;
  // Atom / Escrow 已用 listPrice 计算总 sellerNet；按已付期数比例缩放，与 customer/platform 同口径。
  const sellerNetAmount = usesGrossAmount
    ? totalResult.sellerNetAmount * paidRatio
    : sellerReceivedSoFar;

  return {
    customerTotalAmount,
    platformFee,
    platformFeeRate,
    sellerNetAmount,
    breakdown: {
      baseAmount: totalResult.breakdown.baseAmount * paidRatio,
      feeAmount: platformFee,
      surchargeAmount: totalResult.breakdown.surchargeAmount ? totalResult.breakdown.surchargeAmount * paidRatio : undefined,
      serviceFee: totalResult.breakdown.serviceFee ? totalResult.breakdown.serviceFee * paidRatio : undefined,
      commission: totalResult.breakdown.commission ? totalResult.breakdown.commission * paidRatio : undefined,
      commissionRate: totalResult.breakdown.commissionRate,
      commissionDiscount: totalResult.breakdown.commissionDiscount,
      serviceFeeRate: totalResult.breakdown.serviceFeeRate,
      surchargeRate: totalResult.breakdown.surchargeRate,
      sellerSurchargeShare:
        totalResult.breakdown.sellerSurchargeShare !== undefined
          ? totalResult.breakdown.sellerSurchargeShare * paidRatio
          : undefined,
      atomBaseCommission:
        totalResult.breakdown.atomBaseCommission !== undefined
          ? totalResult.breakdown.atomBaseCommission * paidRatio
          : undefined,
      atomBaseCommissionRate: totalResult.breakdown.atomBaseCommissionRate,
      atomCommissionTier: totalResult.breakdown.atomCommissionTier,
      escrowHoldingFee:
        totalResult.breakdown.escrowHoldingFee !== undefined
          ? totalResult.breakdown.escrowHoldingFee * paidRatio
          : undefined,
      escrowMonthlyHoldingFee: totalResult.breakdown.escrowMonthlyHoldingFee,
      escrowTransactionFee:
        totalResult.breakdown.escrowTransactionFee !== undefined
          ? totalResult.breakdown.escrowTransactionFee * paidRatio
          : undefined,
      escrowLeaseType: totalResult.breakdown.escrowLeaseType,
    }
  };
}
