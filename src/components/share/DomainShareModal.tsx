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

    // 绘制高能成交背景 - 电光炫彩
    const gradient = ctx.createLinearGradient(0, 0, 800, 600);
    gradient.addColorStop(0, '#0a0a0a');
    gradient.addColorStop(0.2, '#1a0033');
    gradient.addColorStop(0.4, '#330066');
    gradient.addColorStop(0.6, '#6600cc');
    gradient.addColorStop(0.8, '#9900ff');
    gradient.addColorStop(1, '#ff00ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 600);

    // 添加爆裂纹理效果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 800;
      const y = Math.random() * 600;
      const size = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 添加电光线条效果
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 800, Math.random() * 600);
      ctx.lineTo(Math.random() * 800, Math.random() * 600);
      ctx.stroke();
    }

    // 绘制主标题 - 超大号震撼效果
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff0000';
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 6;
    ctx.strokeText('🔥 JUST SOLD! 🔥', 400, 80);
    ctx.fillText('🔥 JUST SOLD! 🔥', 400, 80);

    // 绘制域名 - 电光效果
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#00ffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeText(domain.domain_name, 400, 140);
    ctx.fillText(domain.domain_name, 400, 140);

    // 绘制成交标签
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#ffff00';
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.strokeText('⚡ DOMAIN DEAL ⚡', 400, 180);
    ctx.fillText('⚡ DOMAIN DEAL ⚡', 400, 180);

    // 绘制统计数据 - 高能展示
    const profit = calculateDomainProfit();
    const roi = calculateROI();
    const holdingPeriod = calculateHoldingPeriod();
    
    // 绘制数据卡片 - 电光边框
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 4;
    ctx.roundRect(50, 220, 700, 200, 20);
    ctx.fill();
    ctx.stroke();

    // 净利润 - 最震撼
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = '#00ff00';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeText(`💰 PROFIT: $${profit.toLocaleString()} 💰`, 400, 270);
    ctx.fillText(`💰 PROFIT: $${profit.toLocaleString()} 💰`, 400, 270);
    
    // ROI - 电光效果
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#ff00ff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeText(`📈 ROI: ${roi.toFixed(1)}% 📈`, 400, 310);
    ctx.fillText(`📈 ROI: ${roi.toFixed(1)}% 📈`, 400, 310);
    
    // 售价 - 高亮显示
    ctx.fillStyle = '#ffff00';
    ctx.strokeStyle = '#ff0000';
    ctx.strokeText(`💵 SOLD FOR: $${domain.sale_price?.toLocaleString()} 💵`, 400, 350);
    ctx.fillText(`💵 SOLD FOR: $${domain.sale_price?.toLocaleString()} 💵`, 400, 350);

    // 绘制Web3/Crypto元素
    ctx.font = '60px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    
    // 左上角 - 钻石
    ctx.fillText('💎', 100, 100);
    ctx.strokeText('💎', 100, 100);
    
    // 右上角 - 火箭
    ctx.fillText('🚀', 700, 100);
    ctx.strokeText('🚀', 700, 100);
    
    // 左下角 - 奖杯
    ctx.fillText('🏆', 100, 500);
    ctx.strokeText('🏆', 100, 500);
    
    // 右下角 - 目标
    ctx.fillText('🎯', 700, 500);
    ctx.strokeText('🎯', 700, 500);

    // 绘制AI/Web3元素
    ctx.font = '40px Arial';
    ctx.fillStyle = '#00ffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    
    // AI元素
    ctx.fillText('🤖', 150, 300);
    ctx.strokeText('🤖', 150, 300);
    
    // Web3元素
    ctx.fillText('🌐', 650, 300);
    ctx.strokeText('🌐', 650, 300);
    
    // Crypto元素
    ctx.fillText('₿', 150, 400);
    ctx.strokeText('₿', 150, 400);
    
    // 区块链元素
    ctx.fillText('⛓️', 650, 400);
    ctx.strokeText('⛓️', 650, 400);

    // 绘制飘带效果
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 100);
    ctx.quadraticCurveTo(200, 50, 400, 100);
    ctx.quadraticCurveTo(600, 150, 800, 100);
    ctx.stroke();
    
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 500);
    ctx.quadraticCurveTo(200, 550, 400, 500);
    ctx.quadraticCurveTo(600, 450, 800, 500);
    ctx.stroke();

    // 绘制成功标志 - 超大震撼
    ctx.font = 'bold 80px Arial';
    ctx.fillStyle = '#00ff00';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.strokeText('✅ SOLD! ✅', 400, 480);
    ctx.fillText('✅ SOLD! ✅', 400, 480);

    // 绘制品牌信息 - 电光效果
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeText('🔥 POWERED BY 66DO.COM 🔥', 400, 530);
    ctx.fillText('🔥 POWERED BY 66DO.COM 🔥', 400, 530);

    // 添加闪光效果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '30px Arial';
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * 800;
      const y = Math.random() * 600;
      ctx.fillText('✨', x, y);
    }

    // 添加爆炸效果
    ctx.fillStyle = '#ff0000';
    ctx.font = '40px Arial';
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * 800;
      const y = Math.random() * 600;
      ctx.fillText('💥', x, y);
    }

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
