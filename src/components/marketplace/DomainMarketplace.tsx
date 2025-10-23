'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { 
  Search, 
  Globe, 
  Eye,
  Heart,
  MessageCircle,
  Share,
  Clock,
  Star,
  Users,
  Zap
} from 'lucide-react';

interface MarketplaceDomain {
  id: string;
  domainName: string;
  price: number;
  currency: string;
  category: string;
  description: string;
  seller: {
    id: string;
    name: string;
    avatar?: string;
    rating: number;
    salesCount: number;
  };
  images: string[];
  tags: string[];
  listedDate: string;
  views: number;
  likes: number;
  isLiked: boolean;
  isWatching: boolean;
  status: 'available' | 'pending' | 'sold';
  negotiable: boolean;
  quickBuy: boolean;
  featured: boolean;
}

interface DomainMarketplaceProps {
  domains: MarketplaceDomain[];
  onLike: (id: string) => void;
  onWatch: (id: string) => void;
  onContact: (id: string) => void;
  onQuickBuy: (id: string) => void;
  onFilter: (filters: Record<string, unknown>) => void;
  onSort: (sortBy: string) => void;
}

export default function DomainMarketplace({
  domains,
  onLike,
  onWatch,
  onContact,
  onQuickBuy,
  onSort
}: DomainMarketplaceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState({
    category: 'all',
    priceRange: { min: 0, max: 1000000 },
    negotiable: false,
    quickBuy: false,
    featured: false
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredDomains = domains
    .filter(domain => {
      if (searchQuery && !domain.domainName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filters.category !== 'all' && domain.category !== filters.category) {
        return false;
      }
      if (domain.price < filters.priceRange.min || domain.price > filters.priceRange.max) {
        return false;
      }
      if (filters.negotiable && !domain.negotiable) {
        return false;
      }
      if (filters.quickBuy && !domain.quickBuy) {
        return false;
      }
      if (filters.featured && !domain.featured) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'date':
          comparison = new Date(a.listedDate).getTime() - new Date(b.listedDate).getTime();
          break;
        case 'views':
          comparison = a.views - b.views;
          break;
        case 'likes':
          comparison = a.likes - b.likes;
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleSort = (newSortBy: string) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
    onSort(`${newSortBy}_${sortOrder}`);
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(price);
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'tech': 'bg-blue-100 text-blue-800',
      'business': 'bg-green-100 text-green-800',
      'finance': 'bg-yellow-100 text-yellow-800',
      'health': 'bg-red-100 text-red-800',
      'education': 'bg-purple-100 text-purple-800',
      'entertainment': 'bg-pink-100 text-pink-800',
      'other': 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  const renderDomainCard = (domain: MarketplaceDomain) => (
    <div key={domain.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
      {/* 域名头部 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <Globe className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">{domain.domainName}</h3>
              {domain.featured && (
                <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full flex items-center">
                  <Star className="h-3 w-3 mr-1" />
                  精选
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-2">{domain.description}</p>
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span className="flex items-center">
                <Eye className="h-3 w-3 mr-1" />
                {domain.views} 次浏览
              </span>
              <span className="flex items-center">
                <Heart className="h-3 w-3 mr-1" />
                {domain.likes} 喜欢
              </span>
              <span className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {new Date(domain.listedDate).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onLike(domain.id)}
              className={`p-2 rounded-lg transition-colors ${
                domain.isLiked 
                  ? 'bg-red-100 text-red-600' 
                  : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600'
              }`}
            >
              <Heart className="h-4 w-4" />
            </button>
            <button
              onClick={() => onWatch(domain.id)}
              className={`p-2 rounded-lg transition-colors ${
                domain.isWatching 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600'
              }`}
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 价格和标签 */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatPrice(domain.price, domain.currency)}
            </p>
            {domain.negotiable && (
              <p className="text-sm text-blue-600">可议价</p>
            )}
          </div>
          <div className="text-right">
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(domain.category)}`}>
              {domain.category}
            </span>
          </div>
        </div>

        {/* 标签 */}
        <div className="flex flex-wrap gap-1 mb-4">
          {domain.tags.map((tag, index) => (
            <span key={index} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
              {tag}
            </span>
          ))}
        </div>

        {/* 卖家信息 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              {domain.seller.avatar ? (
                <Image 
                  src={domain.seller.avatar} 
                  alt={domain.seller.name}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <Users className="h-4 w-4 text-gray-600" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{domain.seller.name}</p>
              <div className="flex items-center space-x-2">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`h-3 w-3 ${
                        i < Math.floor(domain.seller.rating) 
                          ? 'text-yellow-400' 
                          : 'text-gray-300'
                      }`} 
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-500">
                  {domain.seller.rating} ({domain.seller.salesCount} 笔交易)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onContact(domain.id)}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
          >
            <MessageCircle className="h-4 w-4" />
            <span>联系卖家</span>
          </button>
          
          {domain.quickBuy && (
            <button
              onClick={() => onQuickBuy(domain.id)}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center space-x-2"
            >
              <Zap className="h-4 w-4" />
              <span>立即购买</span>
            </button>
          )}
          
          <button className="p-2 text-gray-600 hover:text-gray-800">
            <Share className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 搜索和筛选 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* 搜索 */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索域名..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 筛选器 */}
          <div className="flex flex-wrap gap-2">
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">所有分类</option>
              <option value="tech">科技</option>
              <option value="business">商业</option>
              <option value="finance">金融</option>
              <option value="health">健康</option>
              <option value="education">教育</option>
              <option value="entertainment">娱乐</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => handleSort(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">按时间</option>
              <option value="price">按价格</option>
              <option value="views">按浏览</option>
              <option value="likes">按喜欢</option>
            </select>

            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {viewMode === 'grid' ? '列表视图' : '网格视图'}
            </button>
          </div>
        </div>

        {/* 高级筛选 */}
        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.negotiable}
              onChange={(e) => setFilters(prev => ({ ...prev, negotiable: e.target.checked }))}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">可议价</span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.quickBuy}
              onChange={(e) => setFilters(prev => ({ ...prev, quickBuy: e.target.checked }))}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">快速购买</span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.featured}
              onChange={(e) => setFilters(prev => ({ ...prev, featured: e.target.checked }))}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">精选域名</span>
          </label>
        </div>
      </div>

      {/* 域名列表 */}
      <div className={`grid gap-6 ${
        viewMode === 'grid' 
          ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
          : 'grid-cols-1'
      }`}>
        {filteredDomains.map(renderDomainCard)}
      </div>

      {/* 空状态 */}
      {filteredDomains.length === 0 && (
        <div className="text-center py-12">
          <Globe className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">未找到匹配的域名</h3>
          <p className="text-gray-600">尝试调整搜索条件或筛选器</p>
        </div>
      )}
    </div>
  );
}
