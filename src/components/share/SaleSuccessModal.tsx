'use client';

import { useState, useRef } from 'react';
import { X, Download, Share2, Twitter, Linkedin, Facebook, MessageCircle, CheckCircle, DollarSign, TrendingUp } from 'lucide-react';
import { DomainWithTags, TransactionWithRequiredFields } from '../../types/dashboard';
import { useI18nContext } from '../../contexts/I18nProvider';

interface Domain {
  id: string;
  domain_name: string;
  purchase_date: string;
  purchase_cost: number;
  renewal_cost: number;
  renewal_count: number;
  status: 'active' | 'for_sale' | 'sold' | 'expired';
}

interface Transaction {
  domain_id: string;
  type: 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' | 'marketing' | 'advertising';
  amount: number;
  currency: string;
  platform_fee?: number;
  net_amount?: number;
  date: string;
}

interface SaleSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: DomainWithTags;
  transaction: TransactionWithRequiredFields;
}

export default function SaleSuccessModal({ isOpen, onClose, domain, transaction }: SaleSuccessModalProps) {
  const { t } = useI18nContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageGenerated, setImageGenerated] = useState(false);

  const calculateProfit = () => {
    const totalHoldingCost = (domain.purchase_cost || 0) + (domain.renewal_count * (domain.renewal_cost || 0));
    const platformFee = transaction.platform_fee || 0;
    return (transaction.net_amount || transaction.amount) - totalHoldingCost - platformFee;
  };

  const calculateROI = () => {
    const totalHoldingCost = (domain.purchase_cost || 0) + (domain.renewal_count * (domain.renewal_cost || 0));
    const profit = calculateProfit();
    return totalHoldingCost > 0 ? (profit / totalHoldingCost) * 100 : 0;
  };

  const calculateHoldingPeriod = () => {
    const purchaseDate = new Date(domain.purchase_date || '');
    const saleDate = new Date(transaction.date);
    const diffTime = Math.abs(saleDate.getTime() - purchaseDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays}${t('common.days')}`;
    } else if (diffDays < 365) {
      return `${Math.floor(diffDays / 30)}${t('common.months')}`;
    } else {
      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);
      return months > 0 ? `${years}${t('common.years')}${months}${t('common.months')}` : `${years}${t('common.years')}`;
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

    // 绘制渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 0, 600);
    gradient.addColorStop(0, '#10b981'); // 绿色渐变
    gradient.addColorStop(1, '#059669');
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
    ctx.fillText('🎉 Domain Sale Success! 🎉', 400, 120);

    // 绘制域名信息
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#10b981';
    ctx.fillText(domain.domain_name, 400, 170);

    // 绘制统计数据
    const profit = calculateProfit();
    const roi = calculateROI();
    const holdingPeriod = calculateHoldingPeriod();
    const salePrice = transaction.net_amount || transaction.amount;
    
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#1f2937';
    ctx.fillText(`💰 Net Profit: $${profit.toLocaleString()}`, 400, 220);
    ctx.fillText(`📈 ROI: ${roi.toFixed(1)}%`, 400, 260);
    ctx.fillText(`⏰ Holding Period: ${holdingPeriod}`, 400, 300);
    ctx.fillText(`💵 Sale Price: $${salePrice.toLocaleString()}`, 400, 340);

    // 绘制品牌信息
    ctx.font = '18px Arial';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Powered by 66Do.com - Professional Domain Investment Platform', 400, 480);

    // 绘制装饰元素
    ctx.fillStyle = '#fbbf24';
    ctx.font = '48px Arial';
    ctx.fillText('💎', 100, 200);
    ctx.fillText('🚀', 700, 200);
    ctx.fillText('📈', 100, 400);
    ctx.fillText('🎯', 700, 400);

    // 绘制成功图标
    ctx.fillStyle = '#10b981';
    ctx.font = '64px Arial';
    ctx.fillText('✅', 400, 420);

    setIsGenerating(false);
    setImageGenerated(true);
  };

  const downloadImage = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = `66do-sale-success-${domain.domain_name}-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const shareToSocial = (platform: string) => {
    const imageData = canvasRef.current?.toDataURL();
    if (!imageData) return;

    const profit = calculateProfit();
    const roi = calculateROI();
    const text = `🎉 Just sold ${domain.domain_name} on 66Do platform! Net profit $${profit.toLocaleString()}, ROI ${roi.toFixed(1)}%! 🚀 #DomainInvestment #66Do #${domain.domain_name.replace('.', '')}`;
    
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
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {t('common.saleSuccess')}
              </h2>
              <p className="text-sm text-gray-500">
                {domain.domain_name} {t('common.domainSoldSuccessfully')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* 成功统计 */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto mb-2">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-600">
                  ${calculateProfit().toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">{t('common.netProfit')}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mx-auto mb-2">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {calculateROI().toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600">{t('common.returnOnInvestment')}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mx-auto mb-2">
                  <Share2 className="h-6 w-6 text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-purple-600">
                  {calculateHoldingPeriod()}
                </p>
                <p className="text-sm text-gray-600">{t('common.holdingPeriod')}</p>
              </div>
            </div>
          </div>

          {/* 分享图片预览 */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('common.shareImagePreview')}</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
              <canvas
                ref={canvasRef}
                className="max-w-full h-auto mx-auto block"
                style={{ maxHeight: '400px' }}
              />
            </div>
            <div className="flex justify-center mt-4">
              <button
                onClick={generateShareImage}
                disabled={isGenerating}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>{t('common.generating')}</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" />
                    <span>{t('common.generateShareImage')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 分享选项 */}
          {imageGenerated && (
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
          )}
        </div>
      </div>
    </div>
  );
}
