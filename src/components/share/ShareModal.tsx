'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X, Download, Linkedin, Facebook } from 'lucide-react';
import { useI18nContext } from '../../contexts/I18nProvider';
import { DomainWithTags } from '../../types/dashboard';

interface ShareData {
  totalProfit: number;
  roi: number;
  bestDomain: string;
  investmentPeriod: string;
  domainCount: number;
  totalInvestment: number;
  soldDomains?: DomainWithTags[];
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareData: ShareData;
}

function domainProfit(domain: DomainWithTags): number {
  if (!domain.sale_price) return 0;
  const totalHoldingCost = (domain.purchase_cost || 0) + (domain.renewal_count || 0) * (domain.renewal_cost || 0);
  const platformFee = domain.platform_fee || 0;
  return domain.sale_price - totalHoldingCost - platformFee;
}

function domainROI(domain: DomainWithTags): number {
  const totalHoldingCost = (domain.purchase_cost || 0) + (domain.renewal_count || 0) * (domain.renewal_cost || 0);
  const profit = domainProfit(domain);
  return totalHoldingCost > 0 ? (profit / totalHoldingCost) * 100 : 0;
}

function domainHoldingPeriod(domain: DomainWithTags, t: (key: string) => string): string {
  const purchaseDate = new Date(domain.purchase_date || '');
  const saleDate = domain.sale_date ? new Date(domain.sale_date) : new Date();
  const diffDays = Math.ceil(Math.abs(saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 30) return `${diffDays}${t('common.days')}`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}${t('common.months')}`;
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  return months > 0 ? `${years}${t('common.year')}${months}${t('common.month')}` : `${years}${t('common.year')}`;
}

const CELEBRATION_IMAGE_URL = '/domainfin.png';

export default function ShareModal({ isOpen, onClose, shareData }: ShareModalProps) {
  const { t } = useI18nContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const celebrationImageRef = useRef<HTMLImageElement | null>(null);
  const [celebrationImageReady, setCelebrationImageReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareMode, setShareMode] = useState<'portfolio' | 'single'>('portfolio');
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');

  const soldDomains = useMemo(() => shareData.soldDomains ?? [], [shareData.soldDomains]);
  const selectedDomain = selectedDomainId ? soldDomains.find((d) => d.id === selectedDomainId) ?? null : null;

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

  const drawPortfolioCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 800;
    canvas.height = 600;
    // Dark blue background (reference: domainfinancial.png)
    const gradient = ctx.createLinearGradient(0, 0, 0, 600);
    gradient.addColorStop(0, '#1e3a5f');
    gradient.addColorStop(0.5, '#0f2744');
    gradient.addColorStop(1, '#0a1929');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 600);
    const profit = Number.isFinite(shareData.totalProfit) ? shareData.totalProfit : 0;
    const roiVal = Number.isFinite(shareData.roi) ? shareData.roi : 0;
    const investment = Number.isFinite(shareData.totalInvestment) ? shareData.totalInvestment : 0;
    const bestName = shareData.bestDomain && shareData.bestDomain !== '—' ? shareData.bestDomain : '—';
    const bestTrunc = bestName.length > 32 ? `${bestName.slice(0, 29)}...` : bestName;
    // Title
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 38px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('share.canvasTitle'), 400, 100);
    // Total profit - prominent green
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Inter, Arial, sans-serif';
    ctx.fillText(t('share.totalProfit'), 400, 180);
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 48px Inter, Arial, sans-serif';
    ctx.fillText(`$${profit.toLocaleString()}`, 400, 240);
    // ROI - same green
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 36px Inter, Arial, sans-serif';
    ctx.fillText(`ROI: ${roiVal.toFixed(1)}%`, 400, 300);
    // Best domain
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '20px Inter, Arial, sans-serif';
    ctx.fillText(`${t('share.bestDomain')}: ${bestTrunc}`, 400, 350);
    // Total investment & period on one line
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '18px Inter, Arial, sans-serif';
    ctx.fillText(`${t('share.totalInvestment')}: $${investment.toLocaleString()}  ·  ${t('share.investmentPeriod')}: ${shareData.investmentPeriod}`, 400, 400);
    // Powered by
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '16px Inter, Arial, sans-serif';
    ctx.fillText('powered by', 400, 520);
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 20px Inter, Arial, sans-serif';
    ctx.fillText('Domain.financial', 400, 550);
  }, [shareData, t]);

  const drawDomainSaleCanvas = useCallback(
    (domain: DomainWithTags) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = 800;
      canvas.height = 600;
      const img = celebrationImageRef.current;
      const useCelebrationImage = img && img.complete && img.naturalWidth > 0;

      if (useCelebrationImage) {
        ctx.drawImage(img, 0, 0, 800, 600);
        const roi = domainROI(domain);
        const holdingPeriod = domainHoldingPeriod(domain, t);
        ctx.textAlign = 'center';
        // 显示屏上 "Domain Sold" 下方：域名、ROI、持有时间
        ctx.font = 'bold 34px Inter, Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(domain.domain_name, 400, 218);
        ctx.font = 'bold 38px Inter, Arial, sans-serif';
        ctx.fillStyle = '#22c55e';
        ctx.fillText(`ROI: ${roi.toFixed(1)}%`, 400, 278);
        ctx.font = 'bold 28px Inter, Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillText(holdingPeriod, 400, 328);
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
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = '#ffffff';
        if (typeof ctx.roundRect === 'function') ctx.roundRect(60, 60, 680, 480, 16);
        else ctx.rect(60, 60, 680, 480);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        const profit = domainProfit(domain);
        const roi = domainROI(domain);
        const holdingPeriod = domainHoldingPeriod(domain, t);
        ctx.font = 'bold 48px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1e293b';
        ctx.fillText('Domain Sold Successfully', 400, 140);
        ctx.font = 'bold 36px Inter, Arial, sans-serif';
        ctx.fillStyle = '#3b82f6';
        ctx.fillText(domain.domain_name, 400, 200);
        ctx.font = 'bold 44px Inter, Arial, sans-serif';
        ctx.fillStyle = '#059669';
        ctx.fillText(`$${(domain.sale_price ?? 0).toLocaleString()}`, 400, 260);
        ctx.fillStyle = '#059669';
        ctx.fillRect(350, 290, 100, 32);
        ctx.strokeStyle = '#047857';
        ctx.lineWidth = 1;
        ctx.strokeRect(350, 290, 100, 32);
        ctx.font = 'bold 16px Inter, Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('SOLD', 400, 310);
        ctx.font = 'bold 24px Inter, Arial, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'left';
        ctx.fillText('Net Profit', 100, 380);
        ctx.font = 'bold 32px Inter, Arial, sans-serif';
        ctx.fillStyle = '#059669';
        ctx.fillText(`$${profit.toLocaleString()}`, 100, 410);
        ctx.font = 'bold 24px Inter, Arial, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('ROI', 300, 380);
        ctx.font = 'bold 32px Inter, Arial, sans-serif';
        ctx.fillStyle = '#3b82f6';
        ctx.fillText(`${roi.toFixed(1)}%`, 300, 410);
        ctx.font = 'bold 24px Inter, Arial, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('Holding Period', 500, 380);
        ctx.font = 'bold 32px Inter, Arial, sans-serif';
        ctx.fillStyle = '#7c3aed';
        ctx.fillText(holdingPeriod, 500, 410);
        ctx.font = 'bold 20px Inter, Arial, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText('Powered by Domain.Financial', 400, 480);
        ctx.font = '14px Inter, Arial, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Track & Grow Your Domains', 400, 500);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(100, 320);
        ctx.lineTo(700, 320);
        ctx.stroke();
      }
    },
    [t]
  );

  const drawCanvas = useCallback(() => {
    if (shareMode === 'single' && selectedDomain) {
      drawDomainSaleCanvas(selectedDomain);
    } else {
      drawPortfolioCanvas();
    }
  }, [shareMode, selectedDomain, drawPortfolioCanvas, drawDomainSaleCanvas]);

  const generateShareImage = () => {
    if (!canvasRef.current) return;
    setIsGenerating(true);
    drawCanvas();
    setIsGenerating(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (shareMode === 'single' && soldDomains.length > 0 && !selectedDomainId) {
      setSelectedDomainId(soldDomains[0].id);
    }
    const timer = setTimeout(() => drawCanvas(), 100);
    return () => clearTimeout(timer);
  }, [isOpen, shareData, shareMode, selectedDomainId, soldDomains, drawCanvas, celebrationImageReady]);

  useEffect(() => {
    if (isOpen) {
      setShareMode('portfolio');
      setSelectedDomainId('');
    }
  }, [isOpen]);

  const downloadImage = () => {
    if (!canvasRef.current) return;
    drawCanvas();
    const link = document.createElement('a');
    const base = shareMode === 'single' && selectedDomain
      ? `domain-financial-domain-success-${selectedDomain.domain_name}`
      : 'domain-financial-investment-results';
    link.download = `${base}-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const shareToSocial = (platform: string) => {
    if (canvasRef.current) drawCanvas();
    const imageData = canvasRef.current?.toDataURL();
    if (!imageData) return;
    let text: string;
    if (shareMode === 'single' && selectedDomain) {
      const profit = domainProfit(selectedDomain);
      const roi = domainROI(selectedDomain);
      text = `Successfully invested in ${selectedDomain.domain_name} on Domain Financial! Net profit $${profit.toLocaleString()}, ROI ${roi.toFixed(1)}%! 🚀 #DomainInvestment #DomainFinancial #${selectedDomain.domain_name.replace('.', '')}`;
    } else {
      const profit = Number.isFinite(shareData.totalProfit) ? shareData.totalProfit : 0;
      const roiVal = Number.isFinite(shareData.roi) ? shareData.roi : 0;
      text = `My domain investment results on Domain Financial: Total profit $${profit.toLocaleString()}, ROI ${roiVal.toFixed(1)}%! 🚀 #DomainInvestment #DomainFinancial`;
    }
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
  const canSelectSingle = soldDomains.length > 0;

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

          {hasData && canSelectSingle && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-stone-700 mb-2">{t('share.selectDomain')}</h3>
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="shareMode"
                    checked={shareMode === 'portfolio'}
                    onChange={() => setShareMode('portfolio')}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-stone-700">{t('share.shareModePortfolio')}</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="shareMode"
                    checked={shareMode === 'single'}
                    onChange={() => {
                      setShareMode('single');
                      if (soldDomains.length > 0 && !selectedDomainId) setSelectedDomainId(soldDomains[0].id);
                    }}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-stone-700">{t('share.shareModeSingle')}</span>
                </label>
                {shareMode === 'single' && (
                  <select
                    value={selectedDomainId}
                    onChange={(e) => setSelectedDomainId(e.target.value)}
                    className="ml-2 px-3 py-2 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    aria-label={t('share.selectDomain')}
                  >
                    {soldDomains.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.domain_name} {d.sale_price != null ? `($${d.sale_price.toLocaleString()})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
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
