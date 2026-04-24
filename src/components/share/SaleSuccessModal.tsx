'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Share2, CheckCircle, DollarSign, TrendingUp } from 'lucide-react';
import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import { useI18nContext } from '../../contexts/I18nProvider';
import { calculateTotalInstallmentAmount } from '../../lib/platformFeeCalculator';
import { totalHoldingCostForDomain } from '../../lib/renewalCostBasis';
import {
  drawDomainSaleImage,
  downloadCanvas,
  holdingPeriodShort,
  holdingPeriodLocalized,
} from '../../lib/shareImage';
import { saleTweetText, shareToX } from '../../lib/shareText';
import { useMascotImage } from '../../hooks/useMascotImage';
import ModalShell from './ModalShell';

interface SaleSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: DomainWithTags;
  transaction: TransactionWithRequiredFields;
  transactions?: TransactionWithRequiredFields[];
}

export default function SaleSuccessModal({
  isOpen,
  onClose,
  domain,
  transaction,
  transactions = [],
}: SaleSuccessModalProps) {
  const { t } = useI18nContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mascots = useMascotImage();
  const [imageGenerated, setImageGenerated] = useState(false);

  // 出售总价（客户总付款）：分期且已取消/未付清时只算实际已收，否则分期用合同总额或一口价
  const getSalePriceUSD = (): number => {
    if (transaction.payment_plan === 'installment' && (transaction.downpayment_amount != null || transaction.installment_amount != null)) {
      const isPartialOrCancelled =
        transaction.installment_status === 'cancelled' ||
        (transaction.paid_periods ?? 0) < (transaction.installment_period ?? 1);
      if (isPartialOrCancelled) {
        const actualReceived =
          (transaction.downpayment_amount ?? 0) + (transaction.paid_periods ?? 0) * (transaction.installment_amount ?? 0);
        if (actualReceived >= 0) return actualReceived;
      }
      const total = calculateTotalInstallmentAmount(
        transaction.downpayment_amount ?? 0,
        transaction.installment_amount ?? 0,
        transaction.installment_period ?? 0,
        transaction.final_payment_amount ?? 0
      );
      if (total > 0) return total;
    }
    return transaction.base_amount ?? transaction.amount;
  };

  // 卖家净收入（已扣平台费）：分期按实收比例缩放平台费（每笔付款按合同比例扣，断约则少扣）
  const getSellerNetUSD = (): number => {
    const fullAmount = transaction.base_amount ?? transaction.amount;
    const isPartialOrCancelled =
      transaction.payment_plan === 'installment' &&
      (transaction.installment_status === 'cancelled' ||
        (transaction.paid_periods ?? 0) < (transaction.installment_period ?? 1));
    if (isPartialOrCancelled && fullAmount > 0) {
      const actualReceived =
        (transaction.downpayment_amount ?? 0) + (transaction.paid_periods ?? 0) * (transaction.installment_amount ?? 0);
      const ratio = actualReceived / fullAmount;
      const proportionalFee = (transaction.platform_fee ?? 0) * ratio;
      return actualReceived - proportionalFee;
    }
    return transaction.net_amount ?? (fullAmount - (transaction.platform_fee || 0));
  };

  const totalHoldingCost = totalHoldingCostForDomain(domain, transactions);
  const calculateProfit = (): number => getSellerNetUSD() - totalHoldingCost;
  const calculateROI = (): number =>
    totalHoldingCost > 0 ? (calculateProfit() / totalHoldingCost) * 100 : 0;

  const purchaseDate = new Date(domain.purchase_date || '');
  const saleDate = new Date(transaction.date);
  const holdingLocalized = holdingPeriodLocalized(purchaseDate, saleDate, {
    days: t('common.days'),
    months: t('common.months'),
    years: t('common.years'),
  });

  const drawShareImage = useCallback(() => {
    if (!canvasRef.current) return;
    const profit = calculateProfit();
    drawDomainSaleImage(canvasRef.current, {
      domainName: domain.domain_name,
      salePrice: getSalePriceUSD(),
      profit,
      roi: calculateROI(),
      holdingShort: holdingPeriodShort(purchaseDate, saleDate),
      holdingLocalized,
      isProfit: profit >= 0,
      mascotImage: profit >= 0 ? mascots.happy : mascots.sad,
    });
    setImageGenerated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getSalePriceUSD/calculateProfit/calculateROI are stable given domain+transaction
  }, [domain, transaction, holdingLocalized, mascots.happy, mascots.sad]);

  useEffect(() => {
    if (!isOpen || !domain || !transaction) return;
    const timer = setTimeout(() => drawShareImage(), 100);
    return () => clearTimeout(timer);
  }, [isOpen, domain, transaction, drawShareImage]);

  const onDownload = () => {
    if (!canvasRef.current) return;
    drawShareImage();
    downloadCanvas(
      canvasRef.current,
      `domain-financial-sale-success-${domain.domain_name}-${new Date().toISOString().split('T')[0]}.png`
    );
  };

  const onShareX = () => {
    shareToX(
      saleTweetText({
        domainName: domain.domain_name,
        profit: calculateProfit(),
        roi: calculateROI(),
      })
    );
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={t('common.saleSuccess')}
      headerLeading={
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {t('common.saleSuccess')}
            </h2>
            <p className="text-sm text-gray-500">
              {domain.domain_name} {t('common.domainSoldSuccessfully')}
            </p>
          </div>
        </div>
      }
      title={t('common.saleSuccess')}
    >
      <div className="p-6">
        {/* 成功统计 */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto mb-2">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-600">
                ${calculateProfit().toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">{t('common.netProfit')}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mx-auto mb-2">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {calculateROI().toFixed(1)}%
              </p>
              <p className="text-sm text-gray-600">{t('common.returnOnInvestment')}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mx-auto mb-2">
                <Share2 className="h-6 w-6 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-purple-600">
                {holdingLocalized}
              </p>
              <p className="text-sm text-gray-600">{t('common.holdingPeriod')}</p>
            </div>
          </div>
        </div>

        {/* 分享图片预览 */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('common.shareImagePreview')}</h3>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto mx-auto block"
              style={{ maxHeight: '400px' }}
            />
          </div>
          <div className="flex justify-center mt-4">
            <button
              type="button"
              onClick={drawShareImage}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 flex items-center space-x-2"
            >
              <Share2 className="h-4 w-4" />
              <span>{t('common.refreshImage')}</span>
            </button>
          </div>
        </div>

        {/* LinkedIn/Facebook sharers only accept a URL to scrape; they can't
            attach the canvas image and would post the site homepage. Only
            X carries our P&L numbers via its text intent. */}
        {imageGenerated && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">{t('common.shareToSocialMedia')}</h3>

            <button
              onClick={onShareX}
              className="w-full flex items-center justify-center gap-2 bg-stone-800 text-white px-4 py-3 rounded-xl hover:bg-stone-700 font-medium"
            >
              <span className="text-lg font-bold">𝕏</span>
              <span>X</span>
            </button>

            <div className="flex justify-center">
              <button
                onClick={onDownload}
                className="flex items-center space-x-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
              >
                <Download className="h-5 w-5" />
                <span>{t('common.downloadImage')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
