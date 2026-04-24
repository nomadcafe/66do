'use client';

import { useState, useRef } from 'react';
import { Download } from 'lucide-react';
import { DomainWithTags } from '../../types/dashboard';
import type { TransactionWithRequiredFields } from '../../types/transaction';
import { useI18nContext } from '../../contexts/I18nProvider';
import { totalHoldingCostForDomain } from '../../lib/renewalCostBasis';
import {
  drawDomainSaleImage,
  downloadCanvas,
  holdingPeriodShort,
  holdingPeriodLocalized,
} from '../../lib/shareImage';
import { investedTweetText, shareToX } from '../../lib/shareText';
import { useCelebrationImage } from '../../hooks/useCelebrationImage';
import ModalShell from './ModalShell';

interface DomainShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: DomainWithTags;
  transactions?: TransactionWithRequiredFields[];
}

export default function DomainShareModal({ isOpen, onClose, domain, transactions = [] }: DomainShareModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { t } = useI18nContext();
  const celebrationImage = useCelebrationImage();

  const calculateDomainProfit = () => {
    if (!domain.sale_price) return 0;
    const totalHoldingCost = totalHoldingCostForDomain(domain, transactions);
    const platformFee = domain.platform_fee || 0;
    return domain.sale_price - totalHoldingCost - platformFee;
  };

  const calculateROI = () => {
    const totalHoldingCost = totalHoldingCostForDomain(domain, transactions);
    const profit = calculateDomainProfit();
    return totalHoldingCost > 0 ? (profit / totalHoldingCost) * 100 : 0;
  };

  const purchaseDate = new Date(domain.purchase_date || '');
  const saleDate = domain.sale_date ? new Date(domain.sale_date) : new Date();

  const generateShareImage = async () => {
    if (!canvasRef.current) return;
    setIsGenerating(true);
    const profit = calculateDomainProfit();
    // Profitable sales now reuse the same celebration PNG that SaleSuccessModal
    // and ShareModal use, so all three entry points render the same winning
    // card. Losses fall through to the gradient card via isProfit=false.
    drawDomainSaleImage(canvasRef.current, {
      domainName: domain.domain_name,
      salePrice: domain.sale_price ?? 0,
      profit,
      roi: calculateROI(),
      holdingShort: holdingPeriodShort(purchaseDate, saleDate),
      holdingLocalized: holdingPeriodLocalized(purchaseDate, saleDate, {
        days: t('common.days'),
        months: t('common.months'),
        years: t('common.years'),
      }),
      isProfit: profit >= 0,
      celebrationImage,
    });
    setIsGenerating(false);
  };

  const onDownload = () => {
    if (!canvasRef.current) return;
    downloadCanvas(
      canvasRef.current,
      `domain-financial-domain-success-${domain.domain_name}-${new Date().toISOString().split('T')[0]}.png`
    );
  };

  const onShareX = () => {
    shareToX(
      investedTweetText({
        domainName: domain.domain_name,
        profit: calculateDomainProfit(),
        roi: calculateROI(),
      })
    );
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('common.domainInvestmentSuccess')} - ${domain.domain_name}`}
      ariaLabel={t('common.domainInvestmentSuccess')}
    >
      <div className="p-6">
        {/* 预览区域 */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('common.imagePreview')}</h3>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto mx-auto block"
              style={{ maxHeight: '400px' }}
            />
          </div>
          <button
            onClick={generateShareImage}
            disabled={isGenerating}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isGenerating ? t('common.generating') : t('common.generateShareImage')}
          </button>
        </div>

        {/* LinkedIn/Facebook sharers can't attach the canvas image; removed. */}
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
      </div>
    </ModalShell>
  );
}
