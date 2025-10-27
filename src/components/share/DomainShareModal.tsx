'use client';

import { useState, useRef } from 'react';
import { X, Download, Twitter, Linkedin, Facebook, MessageCircle } from 'lucide-react';
import { DomainWithTags } from '../../types/dashboard';
import { useI18nContext } from '../../contexts/I18nProvider';

interface DomainShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: DomainWithTags;
}

export default function DomainShareModal({ isOpen, onClose, domain }: DomainShareModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { t } = useI18nContext();

  const calculateDomainProfit = () => {
    if (!domain.sale_price) return 0;
    
    const totalHoldingCost = (domain.purchase_cost || 0) + (domain.renewal_count * (domain.renewal_cost || 0));
    const platformFee = domain.platform_fee || 0;
    return domain.sale_price - totalHoldingCost - platformFee;
  };

  const calculateROI = () => {
    const totalHoldingCost = (domain.purchase_cost || 0) + (domain.renewal_count * (domain.renewal_cost || 0));
    const profit = calculateDomainProfit();
    return totalHoldingCost > 0 ? (profit / totalHoldingCost) * 100 : 0;
  };

  const calculateHoldingPeriod = () => {
    const purchaseDate = new Date(domain.purchase_date || '');
    const saleDate = domain.sale_date ? new Date(domain.sale_date) : new Date();
    const diffTime = Math.abs(saleDate.getTime() - purchaseDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
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

    // 设置画布尺寸
    canvas.width = 800;
    canvas.height = 600;

    // 绘制白色背景 - 参考it.ai风格
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 600);

    // 添加微妙的渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 800, 600);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.5, '#fafafa');
    gradient.addColorStop(1, '#f5f5f5');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 600);

    // 添加微妙的网格线效果
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 800; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 600);
      ctx.stroke();
    }
    for (let i = 0; i <= 600; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(800, i);
      ctx.stroke();
    }

    // 绘制主内容区域 - 白色卡片
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ctx.roundRect(60, 60, 680, 480, 12);
    ctx.fill();
    ctx.stroke();

    // 添加微妙的阴影效果
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#ffffff';
    ctx.roundRect(60, 60, 680, 480, 12);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // 绘制居中大标题 - it.ai风格
    ctx.font = 'bold 56px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText('Domain Sold', 400, 180);

    // 绘制域名 - 突出显示
    ctx.font = 'bold 42px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#2563eb';
    ctx.fillText(domain.domain_name, 400, 240);

    // 绘制成交价格 - 大号显示
    ctx.font = 'bold 48px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#059669';
    ctx.fillText(`$${domain.sale_price?.toLocaleString()}`, 400, 300);

    // 绘制状态标签
    ctx.font = 'bold 18px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillStyle = '#059669';
    ctx.fillRect(350, 320, 100, 32);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('SOLD', 400, 340);

    // 绘制左下角信息区域
    const profit = calculateDomainProfit();
    const roi = calculateROI();
    
    // 左下角背景
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    ctx.roundRect(80, 420, 280, 100, 8);
    ctx.fill();
    ctx.stroke();

    // 净利润
    ctx.font = 'bold 20px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left';
    ctx.fillText('Net Profit', 100, 450);
    
    ctx.font = 'bold 28px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#059669';
    ctx.fillText(`$${profit.toLocaleString()}`, 100, 480);

    // ROI
    ctx.font = 'bold 20px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('ROI', 200, 450);
    
    ctx.font = 'bold 28px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#2563eb';
    ctx.fillText(`${roi.toFixed(1)}%`, 200, 480);

    // 绘制右下角Logo区域
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    ctx.roundRect(440, 420, 280, 100, 8);
    ctx.fill();
    ctx.stroke();

    // 66Do Logo
    ctx.font = 'bold 24px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'right';
    ctx.fillText('66Do', 700, 450);
    
    ctx.font = '14px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Domain Investment Platform', 700, 470);
    
    ctx.font = '12px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('66do.com', 700, 485);

    // 添加一些极简装饰元素
    // 顶部装饰线
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(200, 120);
    ctx.lineTo(600, 120);
    ctx.stroke();

    // 底部装饰线
    ctx.strokeStyle = 'rgba(5, 150, 105, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(200, 480);
    ctx.lineTo(600, 480);
    ctx.stroke();

    // 添加一些微妙的几何装饰
    ctx.fillStyle = 'rgba(37, 99, 235, 0.1)';
    ctx.beginPath();
    ctx.arc(150, 150, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(5, 150, 105, 0.1)';
    ctx.beginPath();
    ctx.arc(650, 150, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(37, 99, 235, 0.1)';
    ctx.beginPath();
    ctx.arc(150, 450, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(5, 150, 105, 0.1)';
    ctx.beginPath();
    ctx.arc(650, 450, 4, 0, Math.PI * 2);
    ctx.fill();

    // 添加微妙的文字装饰
    ctx.font = '12px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.textAlign = 'center';
    ctx.fillText('Investment Success', 400, 360);

    setIsGenerating(false);
  };

  const downloadImage = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = `66do-domain-success-${domain.domain_name}-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const shareToSocial = (platform: string) => {
    const imageData = canvasRef.current?.toDataURL();
    if (!imageData) return;

    const profit = calculateDomainProfit();
    const roi = calculateROI();
    const text = `Successfully invested in ${domain.domain_name} on 66Do platform! Net profit $${profit.toLocaleString()}, ROI ${roi.toFixed(1)}%! 🚀 #DomainInvestment #66Do #${domain.domain_name.replace('.', '')}`;
    
    let url = '';
    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://66do.com')}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://66do.com')}`;
        break;
      case 'wechat':
        // 微信分享需要特殊处理
        navigator.clipboard.writeText(text);
        alert(t('common.copiedToClipboard'));
        return;
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
          <h2 className="text-xl font-semibold text-gray-900">
            {t('share.domainInvestmentSuccess')} - {domain.domain_name}
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
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('share.imagePreview')}</h3>
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
              {isGenerating ? t('share.generating') : t('share.generateImage')}
            </button>
          </div>

          {/* 分享选项 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">{t('share.shareToSocialMedia')}</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => shareToSocial('twitter')}
                className="flex items-center justify-center space-x-2 bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600"
              >
                <Twitter className="h-5 w-5" />
                <span>Twitter</span>
              </button>
              
              <button
                onClick={() => shareToSocial('linkedin')}
                className="flex items-center justify-center space-x-2 bg-blue-700 text-white px-4 py-3 rounded-lg hover:bg-blue-800"
              >
                <Linkedin className="h-5 w-5" />
                <span>LinkedIn</span>
              </button>
              
              <button
                onClick={() => shareToSocial('facebook')}
                className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700"
              >
                <Facebook className="h-5 w-5" />
                <span>Facebook</span>
              </button>
              
              <button
                onClick={() => shareToSocial('wechat')}
                className="flex items-center justify-center space-x-2 bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600"
              >
                <MessageCircle className="h-5 w-5" />
                <span>{t('share.wechat')}</span>
              </button>
            </div>

            <div className="flex justify-center">
              <button
                onClick={downloadImage}
                className="flex items-center space-x-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
              >
                <Download className="h-5 w-5" />
                <span>{t('share.downloadImage')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
