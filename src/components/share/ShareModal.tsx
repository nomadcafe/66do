'use client';

import { useState, useRef } from 'react';
import { X, Download, Twitter, Linkedin, Facebook, MessageCircle } from 'lucide-react';
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

  const generateShareImage = async () => {
    if (!canvasRef.current) return;
    
    setIsGenerating(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布尺寸
    canvas.width = 800;
    canvas.height = 600;

    // 绘制渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 0, 600);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 600);

    // 绘制白色内容区域
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.roundRect(50, 50, 700, 500, 20);
    ctx.fill();

    // 设置字体
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 My Domain Investment Results 🎉', 400, 120);

    // 绘制统计数据
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`💰 Total Profit: $${shareData.totalProfit.toLocaleString()}`, 400, 180);
    ctx.fillText(`📈 ROI: ${shareData.roi.toFixed(1)}%`, 400, 220);
    ctx.fillText(`🏆 Best Domain: ${shareData.bestDomain}`, 400, 260);
    ctx.fillText(`📊 Domains: ${shareData.domainCount}`, 400, 300);
    ctx.fillText(`⏰ Investment Period: ${shareData.investmentPeriod}`, 400, 340);

    // 绘制品牌信息
    ctx.font = '18px Arial';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Powered by Domain Financial', 400, 480);

    // 绘制装饰元素
    ctx.fillStyle = '#fbbf24';
    ctx.font = '48px Arial';
    ctx.fillText('💎', 100, 200);
    ctx.fillText('🚀', 700, 200);
    ctx.fillText('📈', 100, 400);
    ctx.fillText('🎯', 700, 400);

    setIsGenerating(false);
  };

  const downloadImage = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = `domain-financial-investment-results-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const shareToSocial = (platform: string) => {
    const imageData = canvasRef.current?.toDataURL();
    if (!imageData) return;

    const text = `My domain investment results on Domain Financial: Total profit $${shareData.totalProfit.toLocaleString()}, ROI ${shareData.roi.toFixed(1)}%! 🚀 #DomainInvestment #DomainFinancial`;
    
    let url = '';
    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://www.domain.financial')}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://www.domain.financial')}`;
        break;
      case 'wechat':
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
            {t('dashboard.shareResults')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('common.shareImagePreview')}</h3>
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

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">{t('common.shareToSocialMedia')}</h3>

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
                <span>{t('common.wechat')}</span>
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
        </div>
      </div>
    </div>
  );
}
