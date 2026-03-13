'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Download, Linkedin, Facebook } from 'lucide-react';
import { useI18nContext } from '../../contexts/I18nProvider';

interface ShareData {
  totalProfit: number;
  roi: number;
  bestDomain: string;
  investmentPeriod: string;
  domainCount: number;
  totalInvestment: number;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareData: ShareData;
}

export default function ShareModal({ isOpen, onClose, shareData }: ShareModalProps) {
  const { t } = useI18nContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const drawCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 600;

    const gradient = ctx.createLinearGradient(0, 0, 0, 600);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 600);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(50, 50, 700, 500, 20);
    } else {
      ctx.rect(50, 50, 700, 500);
    }
    ctx.fill();

    const profit = Number.isFinite(shareData.totalProfit) ? shareData.totalProfit : 0;
    const roiVal = Number.isFinite(shareData.roi) ? shareData.roi : 0;
    const investment = Number.isFinite(shareData.totalInvestment) ? shareData.totalInvestment : 0;
    const bestName = shareData.bestDomain && shareData.bestDomain !== '—' ? shareData.bestDomain : '—';
    const bestTrunc = bestName.length > 36 ? `${bestName.slice(0, 33)}...` : bestName;

    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`🎉 ${t('share.canvasTitle')} 🎉`, 400, 120);

    ctx.font = 'bold 24px Arial';
    ctx.fillText(`💰 ${t('share.totalProfit')}: $${profit.toLocaleString()}`, 400, 180);
    ctx.fillText(`📈 ${t('share.roi')}: ${roiVal.toFixed(1)}%`, 400, 220);
    ctx.fillText(`🏆 ${t('share.bestDomain')}: ${bestTrunc}`, 400, 260);
    ctx.fillText(`📊 ${t('share.domains')}: ${shareData.domainCount}`, 400, 300);
    ctx.fillText(`⏰ ${t('share.investmentPeriod')}: ${shareData.investmentPeriod}`, 400, 340);
    ctx.fillText(`💵 ${t('share.totalInvestment')}: $${investment.toLocaleString()}`, 400, 380);

    ctx.font = '18px Arial';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(t('share.tagline'), 400, 480);

    ctx.fillStyle = '#fbbf24';
    ctx.font = '48px Arial';
    ctx.fillText('💎', 100, 200);
    ctx.fillText('🚀', 700, 200);
    ctx.fillText('📈', 100, 400);
    ctx.fillText('🎯', 700, 400);
  }, [shareData, t]);

  const generateShareImage = () => {
    if (!canvasRef.current) return;
    setIsGenerating(true);
    drawCanvas();
    setIsGenerating(false);
  };

  // 打开弹窗时自动生成一次预览，避免空白画布
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => drawCanvas(), 100);
    return () => clearTimeout(timer);
  }, [isOpen, shareData, drawCanvas]);

  const downloadImage = () => {
    if (!canvasRef.current) return;
    drawCanvas();
    const link = document.createElement('a');
    link.download = `domain-financial-investment-results-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const shareToSocial = (platform: string) => {
    if (canvasRef.current) drawCanvas();
    const imageData = canvasRef.current?.toDataURL();
    if (!imageData) return;

    const profit = Number.isFinite(shareData.totalProfit) ? shareData.totalProfit : 0;
    const roiVal = Number.isFinite(shareData.roi) ? shareData.roi : 0;
    const text = `My domain investment results on Domain Financial: Total profit $${profit.toLocaleString()}, ROI ${roiVal.toFixed(1)}%! 🚀 #DomainInvestment #DomainFinancial`;

    switch (platform) {
      case 'x':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'width=600,height=400');
        break;
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://www.domain.financial')}`, '_blank', 'width=600,height=400');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://www.domain.financial')}`, '_blank', 'width=600,height=400');
        break;
    }
  };

  if (!isOpen) return null;

  const hasData = shareData.domainCount > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-stone-200/80 shadow-xl">
        <div className="sticky top-0 bg-white border-b border-stone-200/80 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-semibold text-stone-900">
            {t('dashboard.shareResults')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100"
            aria-label={t('common.close')}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {!hasData && (
            <p className="text-sm text-stone-500 mb-4 p-3 bg-stone-50 rounded-xl border border-stone-200/80">
              {t('share.emptyHint')}
            </p>
          )}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-stone-900 mb-4">{t('common.shareImagePreview')}</h3>
            <div className="border-2 border-dashed border-stone-200 rounded-xl p-4 bg-stone-50/80">
              <canvas
                ref={canvasRef}
                className="max-w-full h-auto mx-auto block"
                style={{ maxHeight: '400px' }}
              />
            </div>
            <button
              onClick={generateShareImage}
              disabled={isGenerating}
              className="mt-4 bg-teal-600 text-white px-4 py-2.5 rounded-xl hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
            >
              {isGenerating ? t('common.generating') : t('common.generateShareImage')}
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-stone-900">{t('common.shareToSocialMedia')}</h3>
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
                className="flex items-center gap-2 bg-stone-600 text-white px-6 py-3 rounded-xl hover:bg-stone-700"
              >
                <Download className="h-5 w-5" />
                <span>{t('common.downloadImage')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
