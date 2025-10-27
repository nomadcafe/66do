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

    // 绘制炫酷的渐变背景 - 彩虹色
    const gradient = ctx.createLinearGradient(0, 0, 800, 600);
    gradient.addColorStop(0, '#ff6b6b');
    gradient.addColorStop(0.2, '#4ecdc4');
    gradient.addColorStop(0.4, '#45b7d1');
    gradient.addColorStop(0.6, '#96ceb4');
    gradient.addColorStop(0.8, '#feca57');
    gradient.addColorStop(1, '#ff9ff3');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 600);

    // 添加动态粒子效果背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 800;
      const y = Math.random() * 600;
      const size = Math.random() * 4 + 1;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 绘制主内容区域 - 玻璃拟态效果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.roundRect(40, 40, 720, 520, 30);
    ctx.fill();
    ctx.stroke();

    // 绘制炫耀的标题 - 更大更炫酷
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.strokeText('🚀 DOMAIN INVESTMENT LEGEND! 🚀', 400, 100);
    ctx.fillText('🚀 DOMAIN INVESTMENT LEGEND! 🚀', 400, 100);

    // 绘制域名信息 - 更突出
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeText(domain.domain_name, 400, 160);
    ctx.fillText(domain.domain_name, 400, 160);

    // 绘制统计数据 - 更炫酷的样式
    const profit = calculateDomainProfit();
    const roi = calculateROI();
    const holdingPeriod = calculateHoldingPeriod();
    
    // 绘制数据卡片背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.roundRect(50, 200, 700, 200, 15);
    ctx.fill();

    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    
    // 净利润 - 最突出
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#00ff00';
    ctx.strokeText(`💰 MASSIVE PROFIT: $${profit.toLocaleString()} 💰`, 400, 240);
    ctx.fillText(`💰 MASSIVE PROFIT: $${profit.toLocaleString()} 💰`, 400, 240);
    
    // ROI - 炫酷颜色
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#00ffff';
    ctx.strokeText(`📈 INSANE ROI: ${roi.toFixed(1)}% 📈`, 400, 280);
    ctx.fillText(`📈 INSANE ROI: ${roi.toFixed(1)}% 📈`, 400, 280);
    
    // 持有时间
    ctx.fillStyle = '#ffff00';
    ctx.strokeText(`⏰ HOLDING TIME: ${holdingPeriod} ⏰`, 400, 320);
    ctx.fillText(`⏰ HOLDING TIME: ${holdingPeriod} ⏰`, 400, 320);
    
    // 售价
    ctx.fillStyle = '#ff69b4';
    ctx.strokeText(`💵 SALE PRICE: $${domain.sale_price?.toLocaleString()} 💵`, 400, 360);
    ctx.fillText(`💵 SALE PRICE: $${domain.sale_price?.toLocaleString()} 💵`, 400, 360);

    // 绘制炫耀的卡通人物和装饰
    ctx.font = '80px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    
    // 左上角 - 炫耀的胜利者
    ctx.fillText('🏆', 80, 120);
    ctx.strokeText('🏆', 80, 120);
    
    // 右上角 - 火箭
    ctx.fillText('🚀', 720, 120);
    ctx.strokeText('🚀', 720, 120);
    
    // 左下角 - 钻石
    ctx.fillText('💎', 80, 500);
    ctx.strokeText('💎', 80, 500);
    
    // 右下角 - 目标
    ctx.fillText('🎯', 720, 500);
    ctx.strokeText('🎯', 720, 500);

    // 中间炫耀的卡通人物
    ctx.font = '100px Arial';
    ctx.fillStyle = '#ff6b6b';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    
    // 主要的炫耀人物 - 在域名下方
    ctx.fillText('😎', 400, 200);
    ctx.strokeText('😎', 400, 200);
    
    // 两侧的庆祝人物
    ctx.font = '60px Arial';
    ctx.fillStyle = '#4ecdc4';
    ctx.fillText('🎉', 200, 450);
    ctx.strokeText('🎉', 200, 450);
    
    ctx.fillStyle = '#feca57';
    ctx.fillText('🎊', 600, 450);
    ctx.strokeText('🎊', 600, 450);

    // 绘制炫酷的边框装饰
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, 760, 560);
    
    // 内层装饰
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, 740, 540);

    // 绘制品牌信息 - 更炫酷
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeText('🔥 POWERED BY 66DO.COM - THE DOMAIN INVESTMENT KING! 🔥', 400, 480);
    ctx.fillText('🔥 POWERED BY 66DO.COM - THE DOMAIN INVESTMENT KING! 🔥', 400, 480);

    // 添加一些炫酷的线条装饰
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(100, 50);
    ctx.lineTo(300, 50);
    ctx.moveTo(500, 50);
    ctx.lineTo(700, 50);
    ctx.moveTo(100, 550);
    ctx.lineTo(300, 550);
    ctx.moveTo(500, 550);
    ctx.lineTo(700, 550);
    ctx.stroke();

    // 添加成功标志 - 更夸张
    ctx.font = '120px Arial';
    ctx.fillStyle = '#00ff00';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    ctx.fillText('✅', 400, 420);
    ctx.strokeText('✅', 400, 420);

    // 添加一些闪烁的星星效果
    ctx.fillStyle = '#fff';
    ctx.font = '30px Arial';
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 800;
      const y = Math.random() * 600;
      ctx.fillText('✨', x, y);
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
