/**
 * 平台费用计算器
 * 支持不同平台的分期费用规则
 */

export interface PlatformFeeConfig {
  type: 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment';
  installmentPeriod: number;
  sellerAmount: number; // 卖家收到的金额
  customFeeRate?: number; // 自定义费率（用于standard类型）
  escrowFee?: number; // Escrow费用（用于escrow_installment类型）
  domainHoldingFee?: number; // 域名持有费（用于escrow_installment类型）
  // 用户输入的费用率
  userInputFeeRate?: number; // 用户输入的分期费用率（用于afternic等）
  userInputSurchargeRate?: number; // 用户输入的surcharge率（用于atom）
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
  };
}

/**
 * 计算平台费用
 */
export function calculatePlatformFee(config: PlatformFeeConfig): PlatformFeeResult {
  const { type, installmentPeriod, sellerAmount, customFeeRate, escrowFee, domainHoldingFee, userInputFeeRate, userInputSurchargeRate } = config;

  switch (type) {
    case 'standard':
      return calculateStandardFee(sellerAmount, customFeeRate || 0.15);

    case 'afternic_installment':
      return calculateAfternicInstallmentFee(sellerAmount, installmentPeriod, userInputFeeRate);

    case 'atom_installment':
      return calculateAtomInstallmentFee(sellerAmount, installmentPeriod, userInputSurchargeRate);

    case 'spaceship_installment':
      return calculateSpaceshipInstallmentFee(sellerAmount);

    case 'escrow_installment':
      return calculateEscrowInstallmentFee(sellerAmount, escrowFee || 0, domainHoldingFee || 0);

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

/**
 * Afternic分期费用计算（新版本）
 * 基于Afternic的实际业务模式：
 * 1. 客户服务费（LTO服务费）：2-12月无费用，13-24月10%，25-36月20%，37-60月30%
 * 2. 卖家佣金折扣：2-12月无折扣，13-24月5%折扣，25-36月10%折扣，37-60月15%折扣
 * 3. 三部分结构：标价、服务费、佣金
 */
function calculateAfternicInstallmentFee(sellerAmount: number, installmentPeriod: number, userInputFeeRate?: number): PlatformFeeResult {
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

  // 计算卖家佣金折扣
  let commissionDiscount: number;
  if (installmentPeriod <= 12) {
    commissionDiscount = 0; // no commission discount
  } else if (installmentPeriod <= 24) {
    commissionDiscount = 0.05; // 5% discount
  } else if (installmentPeriod <= 36) {
    commissionDiscount = 0.10; // 10% discount
  } else if (installmentPeriod <= 60) {
    commissionDiscount = 0.15; // 15% discount
  } else {
    commissionDiscount = 0.15; // 超过60期按15%折扣计算
  }

  // 假设标准佣金率为15%（Afternic标准）
  const standardCommissionRate = 0.15;
  const effectiveCommissionRate = Math.max(0, standardCommissionRate - commissionDiscount);

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

/**
 * Atom分期费用计算
 * 如果用户输入了surcharge率，使用用户输入的值
 * 否则根据期数自动计算：
 * 12期: 10% surcharge
 * 24期: 15% surcharge
 * 36期: 20% surcharge
 * 48期: 25% surcharge
 * 卖家获得65%的surcharge，平台获得35%
 */
function calculateAtomInstallmentFee(sellerAmount: number, installmentPeriod: number, userInputSurchargeRate?: number): PlatformFeeResult {
  let surchargeRate: number;

  if (userInputSurchargeRate !== undefined) {
    // 使用用户输入的surcharge率
    surchargeRate = userInputSurchargeRate;
  } else {
    // 根据期数自动计算surcharge率
    if (installmentPeriod <= 12) {
      surchargeRate = 0.10;
    } else if (installmentPeriod <= 24) {
      surchargeRate = 0.15;
    } else if (installmentPeriod <= 36) {
      surchargeRate = 0.20;
    } else if (installmentPeriod <= 48) {
      surchargeRate = 0.25;
    } else {
      surchargeRate = 0.25; // 超过48期按25%计算
    }
  }

  // 反推基础金额（不包含surcharge）
  const baseAmount = sellerAmount / (1 + surchargeRate * 0.65); // 卖家获得65%的surcharge
  const surchargeAmount = baseAmount * surchargeRate;
  const customerTotalAmount = baseAmount + surchargeAmount;
  const platformFee = surchargeAmount * 0.35; // 平台获得35%的surcharge
  const platformFeeRate = platformFee / customerTotalAmount;

  return {
    customerTotalAmount,
    platformFee,
    platformFeeRate,
    sellerNetAmount: sellerAmount,
    breakdown: {
      baseAmount,
      feeAmount: platformFee,
      surchargeAmount,
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
 * Escrow分期费用计算
 * 域名持有费 + Escrow费用
 */
function calculateEscrowInstallmentFee(
  sellerAmount: number, 
  escrowFee: number, 
  domainHoldingFee: number
): PlatformFeeResult {
  const totalFees = escrowFee + domainHoldingFee;
  const customerTotalAmount = sellerAmount + totalFees;
  const platformFeeRate = totalFees / customerTotalAmount;

  return {
    customerTotalAmount,
    platformFee: totalFees,
    platformFeeRate,
    sellerNetAmount: sellerAmount,
    breakdown: {
      baseAmount: sellerAmount,
      feeAmount: totalFees,
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
  options?: { downpaymentAmount?: number; finalPaymentAmount?: number }
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

  const sellerAmount = installmentAmount * installmentPeriod;
  return calculatePlatformFee({
    type: platformFeeType as 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment',
    installmentPeriod,
    sellerAmount,
    customFeeRate,
    escrowFee,
    domainHoldingFee,
    userInputFeeRate,
    userInputSurchargeRate
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
  options?: { downpaymentAmount?: number; finalPaymentAmount?: number }
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

  const totalSellerAmount = installmentAmount * totalPeriods;
  const totalResult = calculatePlatformFee({
    type: platformFeeType as 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment',
    installmentPeriod: totalPeriods,
    sellerAmount: totalSellerAmount,
    customFeeRate,
    escrowFee,
    domainHoldingFee,
    userInputFeeRate,
    userInputSurchargeRate
  });

  const paidRatio = paidPeriods / totalPeriods;
  const sellerAmount = installmentAmount * paidPeriods;
  const customerTotalAmount = totalResult.customerTotalAmount * paidRatio;
  const platformFee = totalResult.platformFee * paidRatio;
  const platformFeeRate = totalResult.platformFeeRate;

  return {
    customerTotalAmount,
    platformFee,
    platformFeeRate,
    sellerNetAmount: sellerAmount,
    breakdown: {
      baseAmount: totalResult.breakdown.baseAmount * paidRatio,
      feeAmount: platformFee,
      surchargeAmount: totalResult.breakdown.surchargeAmount ? totalResult.breakdown.surchargeAmount * paidRatio : undefined,
      serviceFee: totalResult.breakdown.serviceFee ? totalResult.breakdown.serviceFee * paidRatio : undefined,
      commission: totalResult.breakdown.commission ? totalResult.breakdown.commission * paidRatio : undefined,
      commissionRate: totalResult.breakdown.commissionRate,
      commissionDiscount: totalResult.breakdown.commissionDiscount,
      serviceFeeRate: totalResult.breakdown.serviceFeeRate,
    }
  };
}
