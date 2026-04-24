'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { DomainWithTags } from '../../types/dashboard';
import type { TransactionWithRequiredFields } from '../../types/transaction';
import { useI18nContext } from '../../contexts/I18nProvider';
import { totalHoldingCostForDomain } from '../../lib/renewalCostBasis';

// `#example.co.uk` is not a valid hashtag. Take only the SLD so
// multi-dot TLDs still render cleanly.
function domainHashtag(name: string): string {
  const sld = name.split('.')[0] || name.replace(/\./g, '');
  return sld ? `#${sld}` : '';
}

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

  const calculateHoldingPeriod = () => {
    const purchaseDate = new Date(domain.purchase_date || '');
    const saleDate = domain.sale_date ? new Date(domain.sale_date) : new Date();
    const a = purchaseDate.getTime();
    const b = saleDate.getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b)) return '—';
    const diffDays = Math.ceil(Math.abs(b - a) / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      return `${diffDays}${t('common.days')}`;
    } else if (diffDays < 365) {
      return `${Math.floor(diffDays / 30)}${t('common.months')}`;
    } else {
      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);
      return months > 0 ? `${years}${t('common.year')}${months}${t('common.month')}` : `${years}${t('common.year')}`;
    }
  };

  const generateShareImage = async () => {
    if (!canvasRef.current) return;

    setIsGenerating(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Render at device-pixel-ratio so the downloaded PNG stays crisp on
    // retina screens and when re-uploaded at social-feed sizes.
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = 800 * dpr;
    canvas.height = 600 * dpr;
    canvas.style.width = '800px';
    canvas.style.height = '600px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // 绘制简洁背景 - 浅灰渐变
    const gradient = ctx.createLinearGradient(0, 0, 800, 600);
    gradient.addColorStop(0, '#f8fafc');
    gradient.addColorStop(0.5, '#f1f5f9');
    gradient.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 600);

    // 绘制主内容区域 - 白色卡片
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.roundRect(60, 60, 680, 480, 16);
    ctx.fill();
    ctx.stroke();

    // 添加微妙阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#ffffff';
    ctx.roundRect(60, 60, 680, 480, 16);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // 绘制简洁标题
    ctx.font = 'bold 48px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Domain Sold Successfully', 400, 140);

    // 绘制域名 - 突出显示
    ctx.font = 'bold 36px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#3b82f6';
    ctx.fillText(domain.domain_name, 400, 200);

    // 绘制成交价格 - 适中大小
    ctx.font = 'bold 44px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#059669';
    ctx.fillText(`$${domain.sale_price?.toLocaleString()}`, 400, 260);

    // 绘制状态标签 - 简洁设计
    ctx.fillStyle = '#059669';
    ctx.fillRect(350, 290, 100, 32);
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 1;
    ctx.strokeRect(350, 290, 100, 32);
    
    ctx.font = 'bold 16px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('SOLD', 400, 310);

    // 绘制统计数据 - 简洁展示
    const profit = calculateDomainProfit();
    const roi = calculateROI();
    
    // 净利润
    ctx.font = 'bold 24px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left';
    ctx.fillText('Net Profit', 100, 380);
    
    ctx.font = 'bold 32px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#059669';
    ctx.fillText(`$${profit.toLocaleString()}`, 100, 410);

    // ROI
    ctx.font = 'bold 24px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('ROI', 300, 380);
    
    ctx.font = 'bold 32px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#3b82f6';
    ctx.fillText(`${roi.toFixed(1)}%`, 300, 410);

    // 持有时间
    const holdingPeriod = calculateHoldingPeriod();
    ctx.font = 'bold 24px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Holding Period', 500, 380);
    
    ctx.font = 'bold 32px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#7c3aed';
    ctx.fillText(holdingPeriod, 500, 410);

    // 绘制品牌信息 - 简洁设计
    ctx.font = 'bold 20px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText('Powered by Domain.Financial', 400, 480);
    
    ctx.font = '14px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Track & Grow Your Domains', 400, 500);

    // 添加简洁装饰线条
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 320);
    ctx.lineTo(700, 320);
    ctx.stroke();

    // 添加微妙的装饰点
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(150, 150, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(650, 150, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(150, 450, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(650, 450, 3, 0, Math.PI * 2);
    ctx.fill();

    setIsGenerating(false);
  };

  const downloadImage = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = `domain-financial-domain-success-${domain.domain_name}-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const shareToX = () => {
    const profit = calculateDomainProfit();
    const roi = calculateROI();
    // Loss case drops the 🚀 and softens the claim of "success".
    const lede = profit >= 0
      ? `Successfully invested in ${domain.domain_name} on Domain Financial! Net profit $${profit.toLocaleString()}, ROI ${roi.toFixed(1)}%! 🚀`
      : `Closed out ${domain.domain_name} on Domain Financial. P&L $${profit.toLocaleString()}, ROI ${roi.toFixed(1)}%.`;
    const text = `${lede} #DomainInvestment #DomainFinancial ${domainHashtag(domain.domain_name)}`.trim();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=600,height=400,noopener,noreferrer');
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('common.domainInvestmentSuccess')}
    >
      <div
        className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {t('common.domainInvestmentSuccess')} - {domain.domain_name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

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

          {/* LinkedIn/Facebook removed -- their share endpoints only accept
              a URL to scrape, so they'd post the site homepage instead of
              this domain's card. Keep X (it carries text) and Download. */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">{t('common.shareToSocialMedia')}</h3>

            <button
              onClick={shareToX}
              className="w-full flex items-center justify-center gap-2 bg-stone-800 text-white px-4 py-3 rounded-xl hover:bg-stone-700 font-medium"
            >
              <span className="text-lg font-bold">𝕏</span>
              <span>X</span>
            </button>

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
        </div>
      </div>
    </div>
  );
}
