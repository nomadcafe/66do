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
        afternicPremiumAddon
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
      return calculateSpaceshipInstallmentFee(sellerAmount);

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
  afternicPremiumAddon?: boolean
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

  // 重新设计计算逻辑
  // 当佣金为0时，卖家净收入 = 标价
  // 当佣金不为0时，卖家净收入 = 标价 * (1 - 佣金率)
  let listPrice: number;
  if (effectiveCommissionRate === 0) {
    // 佣金为0时，卖家净收入 = 标价
    listPrice = sellerAmount;
  } else {
    // 佣金不为0时，从卖家净收入反推标价
    listPrice = sellerAmount / (1 - effectiveCommissionRate);
  }
  
  // 客户总付款 = 标价 + 服务费
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
    sellerNetAmount: sellerAmount,
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
 * 用户输入的 userInputSurchargeRate 会覆盖默认值。
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
  const surchargeRate =
    userInputSurchargeRate !== undefined && userInputSurchargeRate !== null
      ? userInputSurchargeRate
      : getAtomSurchargeRate(installmentPeriod);

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
 * 分期总额口径的平台费：客户总付 = 分期总额；平台费 = 总额 × 费率；卖家净得 = 总额 − 平台费
 * Spaceship 用 5%；Standard 分期用本算法，默认 10%（可通过 customFeeRate 覆盖）
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

function feeRateForTotalSaleInstallmentPath(
  platformFeeType: string,
  customFeeRate?: number
): number {
  if (platformFeeType === 'spaceship_installment') return 0.05;
  if (platformFeeType === 'standard') {
    if (customFeeRate != null && customFeeRate > 0 && customFeeRate <= 1) {
      return customFeeRate;
    }
    return STANDARD_INSTALLMENT_TOTAL_SALE_FEE_RATE;
  }
  return 0.05;
}

/**
 * Spaceship 分期：平台费 = 分期总额 × 5%
 */
function calculateSpaceshipInstallmentFeeFromTotalSale(totalSaleAmount: number): PlatformFeeResult {
  return calculateInstallmentFeeFromTotalSale(totalSaleAmount, 0.05);
}

/** @deprecated 旧逻辑用 sellerAmount 反推会错；Spaceship 应使用 calculateSpaceshipInstallmentFeeFromTotalSale */
function calculateSpaceshipInstallmentFee(sellerAmount: number): PlatformFeeResult {
  return calculateStandardFee(sellerAmount, 0.05);
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
  const holdingFee =
    domainHoldingFee != null && domainHoldingFee > 0
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

  // Atom / Escrow：算法以 listPrice 为基，优先用 form 的 grossAmount；否则回退到 installment*period（旧调用兼容）。
  const usesGrossAmount =
    platformFeeType === 'atom_installment' || platformFeeType === 'escrow_installment';
  const sellerAmount =
    usesGrossAmount && options?.grossAmount && options.grossAmount > 0
      ? options.grossAmount
      : installmentAmount * installmentPeriod;

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
  });
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
    // 已付给卖家的分期部分（不含首付时仅期数×每期；若首付算已付，则 seller 已收 = 首付 + 期数×每期）
    const sellerReceivedSoFar = downpayment + installmentAmount * paidPeriods;
    const paidRatio = Math.min(1, sellerReceivedSoFar / totalSaleAmount);
    const platformFeePaid = totalResult.platformFee * paidRatio;
    // 客户已付现金 = 首付 + 已付期数对应的分期额（用户要求 Customer Paid 含首付）
    const customerPaidTotal = downpayment + installmentAmount * paidPeriods;
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
  const totalSellerAmount =
    usesGrossAmount && options?.grossAmount && options.grossAmount > 0
      ? options.grossAmount
      : installmentAmount * totalPeriods;
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

  const paidRatio = paidPeriods / totalPeriods;
  const customerTotalAmount = totalResult.customerTotalAmount * paidRatio;
  const platformFee = totalResult.platformFee * paidRatio;
  const platformFeeRate = totalResult.platformFeeRate;
  // Atom / Escrow 已用 listPrice 计算总 sellerNet；按已付期数比例缩放，与 customer/platform 同口径。
  // 其它走旧路径（sellerAmount = sellerNet）仍按 installment*paidPeriods 表达卖家已收。
  const sellerNetAmount = usesGrossAmount
    ? totalResult.sellerNetAmount * paidRatio
    : installmentAmount * paidPeriods;

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
