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
  };
}

/**
 * 计算平台费用
 */
export function calculatePlatformFee(config: PlatformFeeConfig): PlatformFeeResult {
  const { type, installmentPeriod, sellerAmount, customFeeRate, escrowFee, domainHoldingFee } = config;

  switch (type) {
    case 'standard':
      return calculateStandardFee(sellerAmount, customFeeRate || 0.15);

    case 'afternic_installment':
      return calculateAfternicInstallmentFee(sellerAmount, installmentPeriod);

    case 'atom_installment':
      return calculateAtomInstallmentFee(sellerAmount, installmentPeriod);

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
 * Afternic分期费用计算
 * 2–12 months: No service fee
 * 13–24 months: 10% service fee
 * 25–36 months: 20% service fee
 * 37–60 months: 30% service fee
 * 
 * 注意：费用率基于实际已付期数，不是总期数
 */
function calculateAfternicInstallmentFee(sellerAmount: number, installmentPeriod: number): PlatformFeeResult {
  let feeRate: number;

  if (installmentPeriod <= 12) {
    feeRate = 0; // No service fee
  } else if (installmentPeriod <= 24) {
    feeRate = 0.10; // 10% service fee
  } else if (installmentPeriod <= 36) {
    feeRate = 0.20; // 20% service fee
  } else if (installmentPeriod <= 60) {
    feeRate = 0.30; // 30% service fee
  } else {
    feeRate = 0.30; // 超过60期按30%计算
  }

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
 * Atom分期费用计算
 * 12期: 10% surcharge
 * 24期: 15% surcharge
 * 36期: 20% surcharge
 * 48期: 25% surcharge
 * 卖家获得65%的surcharge，平台获得35%
 * 
 * 注意：surcharge率基于实际已付期数，不是总期数
 */
function calculateAtomInstallmentFee(sellerAmount: number, installmentPeriod: number): PlatformFeeResult {
  let surchargeRate: number;

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

/**
 * Spaceship分期费用计算（统一5%）
 */
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
 * 根据分期金额和期数计算客户总付款
 */
export function calculateCustomerTotalFromInstallment(
  installmentAmount: number,
  installmentPeriod: number,
  platformFeeType: string,
  customFeeRate?: number,
  escrowFee?: number,
  domainHoldingFee?: number
): PlatformFeeResult {
  const sellerAmount = installmentAmount * installmentPeriod;
  
  return calculatePlatformFee({
    type: platformFeeType as 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment',
    installmentPeriod,
    sellerAmount,
    customFeeRate,
    escrowFee,
    domainHoldingFee,
  });
}

/**
 * 根据已付期数计算实际收到的金额和平台费用
 */
export function calculatePaidAmountFromInstallment(
  installmentAmount: number,
  paidPeriods: number,
  platformFeeType: string,
  customFeeRate?: number,
  escrowFee?: number,
  domainHoldingFee?: number
): PlatformFeeResult {
  const sellerAmount = installmentAmount * paidPeriods;
  
  return calculatePlatformFee({
    type: platformFeeType as 'standard' | 'afternic_installment' | 'atom_installment' | 'spaceship_installment' | 'escrow_installment',
    installmentPeriod: paidPeriods, // 使用已付期数计算费用
    sellerAmount,
    customFeeRate,
    escrowFee,
    domainHoldingFee,
  });
}
