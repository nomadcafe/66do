'use client';

import { useState, useRef } from 'react';
import { Download } from 'lucide-react';
import { DomainWithTags } from '../../types/dashboard';
import type { TransactionWithRequiredFields } from '../../types/transaction';
import { useI18nContext } from '../../contexts/I18nProvider';
import {
  drawDomainSaleImage,
  downloadCanvas,
  holdingPeriodShort,
  holdingPeriodLocalized,
} from '../../lib/shareImage';
import { investedTweetText, shareToX } from '../../lib/shareText';
import { useMascotImage } from '../../hooks/useMascotImage';
import ModalShell from './ModalShell';
import { latestSaleOutcome } from '../../lib/domainSaleOutcome';
import { parseLocalCalendarDate } from '../../lib/localCalendarDate';

interface DomainShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: DomainWithTags;
  transactions?: TransactionWithRequiredFields[];
  /** 分期按实际已收折算后的交易副本（transactionsForMetrics）。**只**用于
   *  分享卡片上的利润 / ROI —— 那张图是要发出去给别人看的，按合同全额算会
   *  把还没收到的钱也写成利润。列表本身的其它计算仍走原始 transactions。
   *  与 TransactionList 的同名 prop 是同一套约定。 */
  metricsTransactions?: TransactionWithRequiredFields[];

}

export default function DomainShareModal({ isOpen, onClose, domain, transactions = [], metricsTransactions }: DomainShareModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { t } = useI18nContext();
  const mascots = useMascotImage();

  // 与 Insights 的 Top Performers 同一口径；以前这里是一份基于
  // domain.sale_price 的私有实现（ShareModal 里还有一份同样的拷贝）。
  // 分期出售按「实际已收」算，而不是合同全额——这张图是要发出去的。
  const outcomeTxs = metricsTransactions ?? transactions;
  const outcome = latestSaleOutcome(domain, outcomeTxs);
  const calculateDomainProfit = () => outcome?.profit ?? 0;
  // null（没有成交 / 成本基准为 0）一路传到底：卡片画 ∞，推文省掉 ROI 整句。
  const calculateROI = (): number | null => outcome?.roi ?? null;

  const purchaseDate = new Date(domain.purchase_date || '');
  // 成交价和成交日也走同一笔成交记录。以前 salePrice 读 domain.sale_price、
  // 利润读交易，同一张卡上两个口径——sale_price 没回写时会印出「成交价 $0，
  // 利润 $4,000」。sale_date 缺失时原本退回"今天"，持有天数跟着算错。
  const saleDate = outcome?.saleDate
    ? (parseLocalCalendarDate(outcome.saleDate) ?? new Date())
    : domain.sale_date
      ? new Date(domain.sale_date)
      : new Date();

  const generateShareImage = async () => {
    if (!canvasRef.current) return;
    setIsGenerating(true);
    const profit = calculateDomainProfit();
    drawDomainSaleImage(canvasRef.current, {
      domainName: domain.domain_name,
      salePrice: outcome?.sellGross ?? domain.sale_price ?? 0,
      profit,
      roi: calculateROI(),
      holdingShort: holdingPeriodShort(purchaseDate, saleDate),
      holdingLocalized: holdingPeriodLocalized(purchaseDate, saleDate, {
        days: t('common.days'),
        months: t('common.months'),
        years: t('common.years'),
      }),
      isProfit: profit >= 0,
      mascotImage: profit >= 0 ? mascots.happy : mascots.sad,
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
          <h3 className="text-lg font-medium text-stone-900 mb-4">{t('common.imagePreview')}</h3>
          <div className="border-2 border-dashed border-stone-300 rounded-lg p-4 bg-stone-50">
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
          <h3 className="text-lg font-medium text-stone-900">{t('common.shareToSocialMedia')}</h3>

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
              className="flex items-center space-x-2 bg-stone-600 text-white px-6 py-3 rounded-lg hover:bg-stone-700"
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
