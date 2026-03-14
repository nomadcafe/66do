'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Download, Share2, Linkedin, Facebook, CheckCircle, DollarSign, TrendingUp } from 'lucide-react';
import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import { useI18nContext } from '../../contexts/I18nProvider';
import { calculateTotalInstallmentAmount } from '../../lib/platformFeeCalculator';

const CELEBRATION_IMAGE_URL = '/domainfinancial.png';

// interface Domain {
//   id: string;
//   domain_name: string;
//   purchase_date: string;
//   purchase_cost: number;
//   renewal_cost: number;
//   renewal_count: number;
//   status: 'active' | 'for_sale' | 'sold' | 'expired';
// }

// interface Transaction {
//   domain_id: string;
//   type: 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' | 'marketing' | 'advertising';
//   amount: number;
//   currency: string;
//   platform_fee?: number;
//   net_amount?: number;
//   date: string;
// }

interface SaleSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: DomainWithTags;
  transaction: TransactionWithRequiredFields;
}

function holdingPeriodShort(purchaseDate: Date, saleDate: Date): string {
  const diffDays = Math.ceil(Math.abs(saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 30) return `${diffDays}d`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}m`;
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  return months > 0 ? `${years}y ${months}m` : `${years}y`;
}

export default function SaleSuccessModal({ isOpen, onClose, domain, transaction }: SaleSuccessModalProps) {
  const { t } = useI18nContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const celebrationImageRef = useRef<HTMLImageElement | null>(null);
  const [celebrationImageReady, setCelebrationImageReady] = useState(false);
  const [imageGenerated, setImageGenerated] = useState(false);

  useEffect(() => {
    if (celebrationImageRef.current) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      celebrationImageRef.current = img;
      setCelebrationImageReady(true);
    };
    img.onerror = () => {
      celebrationImageRef.current = null;
    };
    img.src = CELEBRATION_IMAGE_URL;
  }, []);

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

  // 卖家净收入（已扣平台费）：分期已取消/未付清时按实际已收比例算净收入
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

  const totalHoldingCost = (domain.purchase_cost || 0) + ((domain.renewal_count ?? 0) * (domain.renewal_cost || 0));

  const calculateProfit = (): number => {
    return getSellerNetUSD() - totalHoldingCost;
  };

  const calculateROI = (): number => {
    return totalHoldingCost > 0 ? (calculateProfit() / totalHoldingCost) * 100 : 0;
  };

  const calculateHoldingPeriod = () => {
    const purchaseDate = new Date(domain.purchase_date || '');
    const saleDate = new Date(transaction.date);
    const diffTime = Math.abs(saleDate.getTime() - purchaseDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays}${t('common.days')}`;
    } else if (diffDays < 365) {
      return `${Math.floor(diffDays / 30)}${t('common.months')}`;
    } else {
      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);
      return months > 0 ? `${years}${t('common.years')}${months}${t('common.months')}` : `${years}${t('common.years')}`;
    }
  };

  // Same style as ShareModal → Single domain sale: domainfinancial.png + overlay (name, sale price, ROI, HT)
  const drawShareImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 800;
    canvas.height = 600;

    const salePrice = getSalePriceUSD();
    const roi = calculateROI();
    const purchaseDate = new Date(domain.purchase_date || '');
    const saleDate = new Date(transaction.date);
    const holdingPeriodStr = holdingPeriodShort(purchaseDate, saleDate);

    const img = celebrationImageRef.current;
    const useCelebrationImage = img && img.complete && img.naturalWidth > 0;

    if (useCelebrationImage) {
      ctx.drawImage(img, 0, 0, 800, 600);
      ctx.textAlign = 'left';
      const screenLeftX = 120;
      const lineGap = 54;
      let y = 168;
      ctx.font = 'bold 34px Inter, Arial, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(domain.domain_name, screenLeftX, y);
      y += lineGap;
      ctx.font = 'bold 36px Inter, Arial, sans-serif';
      ctx.fillStyle = '#22c55e';
      ctx.fillText(`$${salePrice.toLocaleString()}`, screenLeftX, y);
      y += lineGap;
      ctx.font = 'bold 38px Inter, Arial, sans-serif';
      ctx.fillText(`ROI: ${roi.toFixed(1)}%`, screenLeftX, y);
      y += lineGap;
      ctx.font = 'bold 28px Inter, Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillText(`HT: ${holdingPeriodStr}`, screenLeftX, y);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 800, 600);
      gradient.addColorStop(0, '#f8fafc');
      gradient.addColorStop(0.5, '#f1f5f9');
      gradient.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      if (typeof ctx.roundRect === 'function') ctx.roundRect(60, 60, 680, 480, 16);
      else ctx.rect(60, 60, 680, 480);
      ctx.fill();
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      const profit = calculateProfit();
      ctx.font = 'bold 48px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1e293b';
      ctx.fillText('Domain Sold Successfully', 400, 140);
      ctx.font = 'bold 36px Inter, Arial, sans-serif';
      ctx.fillStyle = '#3b82f6';
      ctx.fillText(domain.domain_name, 400, 200);
      ctx.font = 'bold 44px Inter, Arial, sans-serif';
      ctx.fillStyle = '#059669';
      ctx.fillText(`$${salePrice.toLocaleString()}`, 400, 260);
      ctx.font = 'bold 24px Inter, Arial, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'left';
      ctx.fillText('Net Profit', 100, 380);
      ctx.font = 'bold 32px Inter, Arial, sans-serif';
      ctx.fillStyle = '#059669';
      ctx.fillText(`$${profit.toLocaleString()}`, 100, 410);
      ctx.fillText('ROI', 300, 380);
      ctx.font = 'bold 32px Inter, Arial, sans-serif';
      ctx.fillStyle = '#3b82f6';
      ctx.fillText(`${roi.toFixed(1)}%`, 300, 410);
      ctx.fillText('Holding Period', 500, 380);
      ctx.font = 'bold 32px Inter, Arial, sans-serif';
      ctx.fillStyle = '#7c3aed';
      ctx.fillText(holdingPeriodStr, 500, 410);
      ctx.font = 'bold 20px Inter, Arial, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText('Powered by Domain.Financial', 400, 480);
    }
    setImageGenerated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getSalePriceUSD, calculateROI, calculateProfit are stable given domain/transaction
  }, [domain, transaction]);

  useEffect(() => {
    if (!isOpen || !domain || !transaction) return;
    const timer = setTimeout(() => drawShareImage(), 100);
    return () => clearTimeout(timer);
  }, [isOpen, domain, transaction, celebrationImageReady, drawShareImage]);

  const downloadImage = () => {
    if (!canvasRef.current) return;
    drawShareImage();
    const link = document.createElement('a');
    link.download = `domain-financial-sale-success-${domain.domain_name}-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const shareToSocial = (platform: string) => {
    drawShareImage();
    const imageData = canvasRef.current?.toDataURL();
    if (!imageData) return;

    const profit = calculateProfit();
    const roi = calculateROI();
    const text = `🎉 Just sold ${domain.domain_name} on Domain Financial! Net profit $${profit.toLocaleString()}, ROI ${roi.toFixed(1)}%! 🚀 #DomainInvestment #DomainFinancial #${domain.domain_name.replace('.', '')}`;
    
    let url = '';
    switch (platform) {
      case 'x':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://www.domain.financial')}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://www.domain.financial')}`;
        break;
    }
    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
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
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

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
                  {calculateHoldingPeriod()}
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
                onClick={() => drawShareImage()}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 flex items-center space-x-2"
              >
                <Share2 className="h-4 w-4" />
                <span>{t('common.refreshImage')}</span>
              </button>
            </div>
          </div>

          {/* 分享选项：与 Share Investment Results 单域名样式一致，自动生成后即可分享 */}
          {imageGenerated && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">{t('common.shareToSocialMedia')}</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => shareToSocial('x')}
                  className="flex items-center justify-center gap-2 bg-stone-800 text-white px-4 py-3 rounded-xl hover:bg-stone-700 font-medium"
                >
                  <span className="text-lg font-bold">𝕏</span>
                  <span>X</span>
                </button>
                <button
                  onClick={() => shareToSocial('linkedin')}
                  className="flex items-center justify-center gap-2 bg-stone-700 text-white px-4 py-3 rounded-xl hover:bg-stone-600"
                >
                  <Linkedin className="h-5 w-5" />
                  <span>LinkedIn</span>
                </button>
                <button
                  onClick={() => shareToSocial('facebook')}
                  className="flex items-center justify-center gap-2 bg-stone-600 text-white px-4 py-3 rounded-xl hover:bg-stone-500"
                >
                  <Facebook className="h-5 w-5" />
                  <span>Facebook</span>
                </button>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={downloadImage}
                  className="flex items-center space-x-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
                >
                  <Download className="h-5 w-5" />
                  <span>{t('common.downloadImage')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
