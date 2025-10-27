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

    // 绘制深色炫酷背景
    const gradient = ctx.createRadialGradient(400, 300, 0, 400, 300, 400);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f3460');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 600);

    // 添加星空效果
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 800;
      const y = Math.random() * 600;
      const size = Math.random() * 2 + 0.5;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 绘制主内容区域 - 深色卡片
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3;
    ctx.roundRect(50, 50, 700, 500, 20);
    ctx.fill();
    ctx.stroke();

    // 绘制霓虹灯效果标题
    ctx.font = 'bold 42px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ffff';
    ctx.strokeStyle = '#0080ff';
    ctx.lineWidth = 4;
    ctx.strokeText('DOMAIN INVESTMENT SUCCESS', 400, 100);
    ctx.fillText('DOMAIN INVESTMENT SUCCESS', 400, 100);

    // 绘制域名信息 - 霓虹效果
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#ff00ff';
    ctx.strokeStyle = '#ff0080';
    ctx.lineWidth = 3;
    ctx.strokeText(domain.domain_name, 400, 150);
    ctx.fillText(domain.domain_name, 400, 150);

    // 绘制统计数据
    const profit = calculateDomainProfit();
    const roi = calculateROI();
    const holdingPeriod = calculateHoldingPeriod();
    
    // 绘制数据区域背景
    ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.roundRect(80, 200, 640, 250, 15);
    ctx.fill();

    // 净利润 - 最突出
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#00ff00';
    ctx.strokeStyle = '#008000';
    ctx.lineWidth = 2;
    ctx.strokeText(`Net Profit: $${profit.toLocaleString()}`, 400, 240);
    ctx.fillText(`Net Profit: $${profit.toLocaleString()}`, 400, 240);
    
    // ROI
    ctx.fillStyle = '#ffff00';
    ctx.strokeStyle = '#808000';
    ctx.strokeText(`ROI: ${roi.toFixed(1)}%`, 400, 280);
    ctx.fillText(`ROI: ${roi.toFixed(1)}%`, 400, 280);
    
    // 持有时间
    ctx.fillStyle = '#ff8000';
    ctx.strokeStyle = '#804000';
    ctx.strokeText(`Holding Period: ${holdingPeriod}`, 400, 320);
    ctx.fillText(`Holding Period: ${holdingPeriod}`, 400, 320);
    
    // 售价
    ctx.fillStyle = '#ff0080';
    ctx.strokeStyle = '#800040';
    ctx.strokeText(`Sale Price: $${domain.sale_price?.toLocaleString()}`, 400, 360);
    ctx.fillText(`Sale Price: $${domain.sale_price?.toLocaleString()}`, 400, 360);

    // 绘制卡通人物 - 使用简单的几何图形
    // 主要的炫耀人物 - 在右侧
    const centerX = 600;
    const centerY = 300;
    
    // 头部
    ctx.fillStyle = '#ffdbac';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY - 20, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // 眼睛
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(centerX - 10, centerY - 25, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX + 10, centerY - 25, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // 嘴巴 - 笑容
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY - 15, 15, 0, Math.PI);
    ctx.stroke();
    
    // 身体
    ctx.fillStyle = '#4a90e2';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.fillRect(centerX - 25, centerY + 10, 50, 60);
    ctx.strokeRect(centerX - 25, centerY + 10, 50, 60);
    
    // 手臂 - 举起来庆祝
    ctx.strokeStyle = '#ffdbac';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(centerX - 25, centerY + 20);
    ctx.lineTo(centerX - 45, centerY - 10);
    ctx.moveTo(centerX + 25, centerY + 20);
    ctx.lineTo(centerX + 45, centerY - 10);
    ctx.stroke();
    
    // 腿
    ctx.strokeStyle = '#ffdbac';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(centerX - 10, centerY + 70);
    ctx.lineTo(centerX - 15, centerY + 100);
    ctx.moveTo(centerX + 10, centerY + 70);
    ctx.lineTo(centerX + 15, centerY + 100);
    ctx.stroke();

    // 绘制装饰元素 - 不遮挡主要内容
    // 左上角装饰
    ctx.fillStyle = '#ffd700';
    ctx.font = '40px Arial';
    ctx.fillText('💎', 100, 100);
    
    // 右上角装饰
    ctx.fillText('🚀', 700, 100);
    
    // 左下角装饰
    ctx.fillText('🏆', 100, 500);
    
    // 右下角装饰
    ctx.fillText('🎯', 700, 500);

    // 绘制成功标志 - 在底部
    ctx.font = '60px Arial';
    ctx.fillStyle = '#00ff00';
    ctx.strokeStyle = '#008000';
    ctx.lineWidth = 3;
    ctx.strokeText('SUCCESS!', 400, 500);
    ctx.fillText('SUCCESS!', 400, 500);

    // 绘制品牌信息
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeText('Powered by 66Do.com', 400, 540);
    ctx.fillText('Powered by 66Do.com', 400, 540);

    // 添加一些装饰线条
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 80);
    ctx.lineTo(200, 80);
    ctx.moveTo(600, 80);
    ctx.lineTo(700, 80);
    ctx.moveTo(100, 520);
    ctx.lineTo(200, 520);
    ctx.moveTo(600, 520);
    ctx.lineTo(700, 520);
    ctx.stroke();

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
