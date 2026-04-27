'use client';

import { formatCurrencyAmount } from '../../lib/exchangeRates';
import {
  calculateCustomerTotalFromInstallment,
  calculatePaidAmountFromInstallment,
  calculateTotalInstallmentAmount
} from '../../lib/platformFeeCalculator';
import { useI18nContext } from '../../contexts/I18nProvider';

export type InstallmentConfigValues = {
  payment_plan: 'lump_sum' | 'installment';
  installment_period: number;
  downpayment_amount: number;
  installment_amount: number;
  final_payment_amount: number;
  platform_fee_type:
    | 'standard'
    | 'afternic_installment'
    | 'atom_installment'
    | 'spaceship_installment'
    | 'escrow_installment';
  paid_periods: number;
  installment_status: 'active' | 'completed' | 'cancelled' | 'paused';
  installment_first_payment_date: string;
  user_input_fee_rate: number;
  user_input_surcharge_rate: number;
  afternic_ns_pointed: boolean;
  afternic_premium_addon: boolean;
  atom_commission_tier: 'standard' | 'plus' | 'premium' | 'byol' | 'custom';
  atom_no_coin: boolean;
  atom_custom_commission_rate: number;
  escrow_lease_type: 'lease_with_purchase' | 'lease_only';
  escrow_transaction_fee: number;
};

interface InstallmentConfigProps {
  values: InstallmentConfigValues;
  amount: number;
  currency: string;
  platformFeePercentage: number;
  onChange: (patch: Partial<InstallmentConfigValues>) => void;
}

export default function InstallmentConfig({
  values,
  amount,
  currency,
  platformFeePercentage,
  onChange
}: InstallmentConfigProps) {
  const { t } = useI18nContext();

  return (
    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
      <h3 className="text-lg font-medium text-blue-900 mb-4">
        {t('transaction.installmentConfig')}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-blue-800 mb-2">
            {t('transaction.paymentPlan')}
          </label>
          <select
            value={values.payment_plan}
            onChange={(e) => onChange({ payment_plan: e.target.value as InstallmentConfigValues['payment_plan'] })}
            className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="lump_sum">{t('transaction.lumpSum')}</option>
            <option value="installment">{t('transaction.installment')}</option>
          </select>
        </div>

        {values.payment_plan === 'installment' && (
          <>
            <div>
              <label htmlFor="transaction-form-installment-period" className="block text-sm font-medium text-blue-800 mb-2">
                {t('transaction.installmentPeriod')}
              </label>
              <input
                id="transaction-form-installment-period"
                type="number"
                min="1"
                max="60"
                value={values.installment_period === 0 ? '' : values.installment_period}
                onChange={(e) => onChange({ installment_period: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="12"
              />
            </div>

            <div>
              <label htmlFor="transaction-form-downpayment" className="block text-sm font-medium text-blue-800 mb-2">
                {t('transaction.downpaymentAmount')}
              </label>
              <input
                id="transaction-form-downpayment"
                type="number"
                step="0.01"
                min="0"
                value={values.downpayment_amount === 0 ? '' : values.downpayment_amount}
                onChange={(e) => onChange({ downpayment_amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label htmlFor="transaction-form-installment-amount" className="block text-sm font-medium text-blue-800 mb-2">
                {t('transaction.installmentAmount')}
              </label>
              <input
                id="transaction-form-installment-amount"
                type="number"
                step="0.01"
                min="0"
                value={values.installment_amount === 0 ? '' : values.installment_amount}
                onChange={(e) => onChange({ installment_amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label htmlFor="transaction-form-final-payment" className="block text-sm font-medium text-blue-800 mb-2">
                {t('transaction.finalPaymentAmount')}
              </label>
              <input
                id="transaction-form-final-payment"
                type="number"
                step="0.01"
                min="0"
                value={values.final_payment_amount === 0 ? '' : values.final_payment_amount}
                onChange={(e) => onChange({ final_payment_amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label htmlFor="transaction-form-platform-fee-type" className="block text-sm font-medium text-blue-800 mb-2">
                {t('transaction.platformFeeType')}
              </label>
              <select
                id="transaction-form-platform-fee-type"
                value={values.platform_fee_type}
                onChange={(e) => onChange({ platform_fee_type: e.target.value as InstallmentConfigValues['platform_fee_type'] })}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="standard">{t('transaction.standardFee')}</option>
                <option value="afternic_installment">{t('transaction.afternicInstallment')}</option>
                <option value="atom_installment">{t('transaction.atomInstallment')}</option>
                <option value="spaceship_installment">{t('transaction.spaceshipInstallment')}</option>
                <option value="escrow_installment">{t('transaction.escrowInstallment')}</option>
              </select>
            </div>

            <div>
              <label htmlFor="transaction-form-paid-periods" className="block text-sm font-medium text-blue-800 mb-2">
                {t('transaction.paidPeriods')}
              </label>
              <input
                id="transaction-form-paid-periods"
                type="number"
                min="0"
                max={values.installment_period}
                value={values.paid_periods === 0 ? '' : values.paid_periods}
                onChange={(e) => onChange({ paid_periods: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>

            <div>
              <label htmlFor="transaction-form-installment-status" className="block text-sm font-medium text-blue-800 mb-2">
                {t('transaction.installmentStatus')}
              </label>
              <select
                id="transaction-form-installment-status"
                value={values.installment_status}
                onChange={(e) => onChange({ installment_status: e.target.value as InstallmentConfigValues['installment_status'] })}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">{t('transaction.active')}</option>
                <option value="completed">{t('transaction.completed')}</option>
                <option value="cancelled">{t('transaction.cancelled')}</option>
                <option value="paused">{t('transaction.paused')}</option>
              </select>
            </div>

            {/* 首期付款日：可选。填了用作 expandSellToCashReceipts 的基准（"按月分摊已付款"），没填则回退到 t.date + 1 月。 */}
            <div className="md:col-span-2">
              <label htmlFor="transaction-form-installment-first-date" className="block text-sm font-medium text-blue-800 mb-2">
                {t('transaction.installmentFirstPaymentDate')}
              </label>
              <input
                id="transaction-form-installment-first-date"
                type="date"
                value={values.installment_first_payment_date}
                onChange={(e) => onChange({ installment_first_payment_date: e.target.value })}
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-blue-600 mt-1">
                {t('transaction.installmentFirstPaymentDateHint')}
              </p>
            </div>

            {/* 用户输入费用率：留空 = 按期数阶梯，填数 = 覆盖 */}
            {values.platform_fee_type === 'afternic_installment' && (
              <div>
                <label htmlFor="transaction-form-user-fee-rate" className="block text-sm font-medium text-blue-800 mb-2">
                  {t('transaction.userInputFeeRate')}
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    id="transaction-form-user-fee-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={values.user_input_fee_rate === 0 ? '' : values.user_input_fee_rate}
                    onChange={(e) => {
                      const raw = e.target.value;
                      onChange({ user_input_fee_rate: raw === '' ? 0 : parseFloat(raw) || 0 });
                    }}
                    className="flex-1 px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('transaction.userInputFeeRatePlaceholder')}
                  />
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  {t('transaction.userInputFeeRateDesc')}
                </p>
              </div>
            )}

            {/* Afternic 标准佣金两个开关：决定 15% / 20% / 25% / 30% 中的哪一档 */}
            {values.platform_fee_type === 'afternic_installment' && (
              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="flex items-start gap-2 text-sm text-blue-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={values.afternic_ns_pointed}
                    onChange={(e) => onChange({ afternic_ns_pointed: e.target.checked })}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">{t('transaction.afternicNsPointed')}</span>
                    <span className="block text-xs text-blue-600">{t('transaction.afternicNsPointedHint')}</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-blue-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={values.afternic_premium_addon}
                    onChange={(e) => onChange({ afternic_premium_addon: e.target.checked })}
                    className="mt-0.5"
                  />
                  <span className="font-medium">{t('transaction.afternicPremiumAddon')}</span>
                </label>
              </div>
            )}

            {values.platform_fee_type === 'atom_installment' && (
              <>
                <div>
                  <label htmlFor="transaction-form-atom-tier" className="block text-sm font-medium text-blue-800 mb-2">
                    {t('transaction.atomCommissionTier')}
                  </label>
                  <select
                    id="transaction-form-atom-tier"
                    value={values.atom_commission_tier}
                    onChange={(e) => onChange({ atom_commission_tier: e.target.value as InstallmentConfigValues['atom_commission_tier'] })}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="standard">{t('transaction.atomTierStandard')}</option>
                    <option value="plus">{t('transaction.atomTierPlus')}</option>
                    <option value="premium">{t('transaction.atomTierPremium')}</option>
                    <option value="byol">{t('transaction.atomTierByol')}</option>
                    <option value="custom">{t('transaction.atomTierCustom')}</option>
                  </select>
                </div>

                {values.atom_commission_tier === 'premium' && (
                  <div className="md:col-span-2">
                    <label className="flex items-start gap-2 text-sm text-blue-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={values.atom_no_coin}
                        onChange={(e) => onChange({ atom_no_coin: e.target.checked })}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-medium">{t('transaction.atomNoCoin')}</span>
                        <span className="block text-xs text-blue-600">{t('transaction.atomNoCoinHint')}</span>
                      </span>
                    </label>
                  </div>
                )}

                {values.atom_commission_tier === 'custom' && (
                  <div>
                    <label htmlFor="transaction-form-atom-custom-rate" className="block text-sm font-medium text-blue-800 mb-2">
                      {t('transaction.atomCustomCommissionRate')}
                    </label>
                    <input
                      id="transaction-form-atom-custom-rate"
                      type="number"
                      step="0.0001"
                      min="0"
                      max="1"
                      value={values.atom_custom_commission_rate === 0 ? '' : values.atom_custom_commission_rate}
                      onChange={(e) => onChange({ atom_custom_commission_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.075"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="transaction-form-surcharge-rate" className="block text-sm font-medium text-blue-800 mb-2">
                    {t('transaction.userInputSurchargeRate')}
                  </label>
                  <input
                    id="transaction-form-surcharge-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={values.user_input_surcharge_rate === 0 ? '' : values.user_input_surcharge_rate}
                    onChange={(e) => onChange({ user_input_surcharge_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.20"
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    {t('transaction.userInputSurchargeRateDesc')}
                  </p>
                </div>
              </>
            )}

            {values.platform_fee_type === 'escrow_installment' && (
              <>
                <div>
                  <label htmlFor="transaction-form-escrow-lease-type" className="block text-sm font-medium text-blue-800 mb-2">
                    {t('transaction.escrowLeaseType')}
                  </label>
                  <select
                    id="transaction-form-escrow-lease-type"
                    value={values.escrow_lease_type}
                    onChange={(e) => onChange({ escrow_lease_type: e.target.value as InstallmentConfigValues['escrow_lease_type'] })}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="lease_with_purchase">{t('transaction.escrowLeaseLwp')}</option>
                    <option value="lease_only">{t('transaction.escrowLeaseLo')}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="transaction-form-escrow-transaction-fee" className="block text-sm font-medium text-blue-800 mb-2">
                    {t('transaction.escrowTransactionFee')}
                  </label>
                  <input
                    id="transaction-form-escrow-transaction-fee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={values.escrow_transaction_fee === 0 ? '' : values.escrow_transaction_fee}
                    onChange={(e) => onChange({ escrow_transaction_fee: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    {t('transaction.escrowTransactionFeeHint')}
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {values.payment_plan === 'installment' && (
        <div className="mt-4 p-3 bg-blue-100 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">{t('transaction.installmentSummary')}</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p>{t('transaction.totalAmount')}: {formatCurrencyAmount(amount, currency)}</p>
            <p>{t('transaction.downpayment')}: {formatCurrencyAmount(values.downpayment_amount, currency)}</p>
            <p>{t('transaction.installmentPeriods')}: {values.installment_period}</p>
            <p>{t('transaction.regularInstallment')}: {formatCurrencyAmount(values.installment_amount, currency)}</p>
            {values.final_payment_amount > 0 && (
              <p>{t('transaction.finalPayment')}: {formatCurrencyAmount(values.final_payment_amount, currency)}</p>
            )}
            <p className="font-medium">
              {t('transaction.totalInstallment')}: {formatCurrencyAmount(
                values.downpayment_amount +
                  values.installment_amount * (values.installment_period - (values.final_payment_amount > 0 ? 1 : 0)) +
                  values.final_payment_amount,
                currency
              )}
            </p>

            {values.installment_amount > 0 && (
              <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <h5 className="text-sm font-medium text-yellow-900 mb-2">{t('transaction.platformFeeCalculation')}</h5>
                {(() => {
                  try {
                    const installmentFeeRateOverride =
                      platformFeePercentage > 0 ? platformFeePercentage / 100 : undefined;
                    const result = calculateCustomerTotalFromInstallment(
                      values.installment_amount,
                      values.installment_period,
                      values.platform_fee_type || 'standard',
                      installmentFeeRateOverride,
                      values.escrow_transaction_fee,
                      undefined,
                      values.user_input_fee_rate,
                      values.user_input_surcharge_rate,
                      {
                        downpaymentAmount: values.downpayment_amount,
                        finalPaymentAmount: values.final_payment_amount,
                        afternicNsPointed: values.afternic_ns_pointed,
                        afternicPremiumAddon: values.afternic_premium_addon,
                        grossAmount: amount,
                        atomCommissionTier: values.atom_commission_tier,
                        atomNoCoin: values.atom_no_coin,
                        atomCustomCommissionRate: values.atom_custom_commission_rate,
                        escrowLeaseType: values.escrow_lease_type,
                      }
                    );

                    return (
                      <div className="text-sm text-yellow-800 space-y-1">
                        <p><strong>{t('transaction.customerTotalAmount')}:</strong> {formatCurrencyAmount(result.customerTotalAmount, currency)}</p>
                        <p><strong>{t('transaction.platformFee')}:</strong> {formatCurrencyAmount(result.platformFee, currency)} ({(result.platformFeeRate * 100).toFixed(1)}%)</p>
                        <p><strong>{t('transaction.sellerNetAmount')}:</strong> {formatCurrencyAmount(result.sellerNetAmount, currency)}</p>

                        {values.platform_fee_type === 'atom_installment' && result.breakdown.surchargeAmount !== undefined && (
                          <div className="mt-2 text-xs text-yellow-700">
                            <p><strong>{t('transaction.listPrice')}:</strong> {formatCurrencyAmount(result.breakdown.baseAmount, currency)}</p>
                            <p><strong>{t('transaction.atomBaseCommission')}:</strong> {formatCurrencyAmount(result.breakdown.atomBaseCommission ?? 0, currency)} ({((result.breakdown.atomBaseCommissionRate ?? 0) * 100).toFixed(2)}%)</p>
                            <p><strong>{t('transaction.surchargeAmount')}:</strong> {formatCurrencyAmount(result.breakdown.surchargeAmount, currency)} ({((result.breakdown.surchargeRate ?? 0) * 100).toFixed(1)}%)</p>
                            <p><strong>{t('transaction.sellerSurchargeShare')}:</strong> {formatCurrencyAmount(result.breakdown.sellerSurchargeShare ?? 0, currency)} (65%)</p>
                          </div>
                        )}

                        {values.platform_fee_type === 'escrow_installment' && result.breakdown.escrowHoldingFee !== undefined && (
                          <div className="mt-2 text-xs text-yellow-700">
                            <p><strong>{t('transaction.listPrice')}:</strong> {formatCurrencyAmount(result.breakdown.baseAmount, currency)}</p>
                            <p><strong>{t('transaction.escrowHoldingFee')}:</strong> {formatCurrencyAmount(result.breakdown.escrowHoldingFee, currency)} ({formatCurrencyAmount(result.breakdown.escrowMonthlyHoldingFee ?? 0, currency)}/mo × {values.installment_period})</p>
                            <p><strong>{t('transaction.escrowTransactionFee')}:</strong> {formatCurrencyAmount(result.breakdown.escrowTransactionFee ?? 0, currency)}</p>
                          </div>
                        )}

                        {values.platform_fee_type === 'afternic_installment' && result.breakdown.serviceFee !== undefined && (
                          <div className="mt-2 text-xs text-yellow-700">
                            <p><strong>{t('transaction.listPrice')}:</strong> {formatCurrencyAmount(result.breakdown.baseAmount, currency)}</p>
                            <p><strong>{t('transaction.serviceFee')}:</strong> {formatCurrencyAmount(result.breakdown.serviceFee, currency)} ({(result.breakdown.serviceFeeRate! * 100).toFixed(1)}%)</p>
                            <p><strong>{t('transaction.commission')}:</strong> {formatCurrencyAmount(result.breakdown.commission!, currency)} ({(result.breakdown.commissionRate! * 100).toFixed(1)}%)</p>
                            <p><strong>{t('transaction.commissionDiscount')}:</strong> {(result.breakdown.commissionDiscount! * 100).toFixed(1)}%</p>
                          </div>
                        )}
                      </div>
                    );
                  } catch (error) {
                    return (
                      <p className="text-sm text-yellow-700">
                        {t('transaction.calculationError')}: {error instanceof Error ? error.message : 'Unknown error'}
                      </p>
                    );
                  }
                })()}
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-blue-200">
              <p className="text-blue-700">
                {t('transaction.paidPeriods')}: {values.paid_periods} / {values.installment_period}
              </p>
              <p className="text-blue-700">
                {t('transaction.installmentStatus')}: {t(`transaction.${values.installment_status}`)}
              </p>
              <p className="text-blue-700">
                {t('transaction.platformFeeType')}: {t(`transaction.${values.platform_fee_type}`)}
              </p>

              {values.paid_periods > 0 && values.installment_amount > 0 && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <h5 className="text-sm font-medium text-green-900 mb-2">{t('transaction.paidAmountCalculation')}</h5>
                  {(() => {
                    try {
                      const installmentFeeRateOverride =
                        platformFeePercentage > 0 ? platformFeePercentage / 100 : undefined;
                      const result = calculatePaidAmountFromInstallment(
                        values.installment_amount,
                        values.paid_periods,
                        values.installment_period,
                        values.platform_fee_type || 'standard',
                        installmentFeeRateOverride,
                        values.escrow_transaction_fee,
                        undefined,
                        values.user_input_fee_rate,
                        values.user_input_surcharge_rate,
                        {
                          downpaymentAmount: values.downpayment_amount,
                          finalPaymentAmount: values.final_payment_amount,
                          afternicNsPointed: values.afternic_ns_pointed,
                          afternicPremiumAddon: values.afternic_premium_addon,
                          grossAmount: amount,
                          atomCommissionTier: values.atom_commission_tier,
                          atomNoCoin: values.atom_no_coin,
                          atomCustomCommissionRate: values.atom_custom_commission_rate,
                          escrowLeaseType: values.escrow_lease_type,
                        }
                      );

                      return (
                        <div className="text-sm text-green-800 space-y-1">
                          <p><strong>{t('transaction.actualPaidAmount')}:</strong> {formatCurrencyAmount(result.sellerNetAmount, currency)}</p>
                          <p><strong>{t('transaction.customerPaidTotal')}:</strong> {formatCurrencyAmount(result.customerTotalAmount, currency)}</p>
                          <p><strong>{t('transaction.platformFeePaid')}:</strong> {formatCurrencyAmount(result.platformFee, currency)} ({(result.platformFeeRate * 100).toFixed(1)}%)</p>

                          {values.platform_fee_type === 'atom_installment' && result.breakdown.surchargeAmount !== undefined && (
                            <div className="mt-2 text-xs text-green-700">
                              <p><strong>{t('transaction.listPrice')}:</strong> {formatCurrencyAmount(result.breakdown.baseAmount, currency)}</p>
                              <p><strong>{t('transaction.atomBaseCommission')}:</strong> {formatCurrencyAmount(result.breakdown.atomBaseCommission ?? 0, currency)} ({((result.breakdown.atomBaseCommissionRate ?? 0) * 100).toFixed(2)}%)</p>
                              <p><strong>{t('transaction.surchargeAmount')}:</strong> {formatCurrencyAmount(result.breakdown.surchargeAmount, currency)} ({((result.breakdown.surchargeRate ?? 0) * 100).toFixed(1)}%)</p>
                              <p><strong>{t('transaction.sellerSurchargeShare')}:</strong> {formatCurrencyAmount(result.breakdown.sellerSurchargeShare ?? 0, currency)} (65%)</p>
                            </div>
                          )}

                          {values.platform_fee_type === 'escrow_installment' && result.breakdown.escrowHoldingFee !== undefined && (
                            <div className="mt-2 text-xs text-green-700">
                              <p><strong>{t('transaction.listPrice')}:</strong> {formatCurrencyAmount(result.breakdown.baseAmount, currency)}</p>
                              <p><strong>{t('transaction.escrowHoldingFee')}:</strong> {formatCurrencyAmount(result.breakdown.escrowHoldingFee, currency)}</p>
                              <p><strong>{t('transaction.escrowTransactionFee')}:</strong> {formatCurrencyAmount(result.breakdown.escrowTransactionFee ?? 0, currency)}</p>
                            </div>
                          )}

                          {values.platform_fee_type === 'afternic_installment' && result.breakdown.serviceFee !== undefined && (
                            <div className="mt-2 text-xs text-green-700">
                              <p><strong>{t('transaction.listPrice')}:</strong> {formatCurrencyAmount(result.breakdown.baseAmount, currency)}</p>
                              <p><strong>{t('transaction.serviceFee')}:</strong> {formatCurrencyAmount(result.breakdown.serviceFee, currency)} ({(result.breakdown.serviceFeeRate! * 100).toFixed(1)}%)</p>
                              <p><strong>{t('transaction.commission')}:</strong> {formatCurrencyAmount(result.breakdown.commission!, currency)} ({(result.breakdown.commissionRate! * 100).toFixed(1)}%)</p>
                              <p><strong>{t('transaction.commissionDiscount')}:</strong> {(result.breakdown.commissionDiscount! * 100).toFixed(1)}%</p>
                            </div>
                          )}
                        </div>
                      );
                    } catch (error) {
                      return (
                        <p className="text-sm text-green-700">
                          {t('transaction.calculationError')}: {error instanceof Error ? error.message : 'Unknown error'}
                        </p>
                      );
                    }
                  })()}
                </div>
              )}

              {/* 进度条：按「已收金额 / 分期总额」，与 Installment Summary 一致 */}
              {(() => {
                const totalAmount = calculateTotalInstallmentAmount(
                  values.downpayment_amount,
                  values.installment_amount,
                  values.installment_period,
                  values.final_payment_amount
                );
                const receivedSoFar =
                  values.downpayment_amount + values.paid_periods * values.installment_amount;
                const pct =
                  totalAmount > 0
                    ? Math.min(100, Math.round((receivedSoFar / totalAmount) * 100))
                    : values.installment_period > 0
                      ? Math.round((values.paid_periods / values.installment_period) * 100)
                      : 0;
                return (
                  <div className="mt-2">
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      {pct}% {t('transaction.completed')} ({formatCurrencyAmount(receivedSoFar, currency)} / {formatCurrencyAmount(totalAmount, currency)})
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
