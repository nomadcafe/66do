'use client';

import React, { useState } from 'react';
import { 
  Bell, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  DollarSign, 
  Calendar, 
  TrendingUp,
  Search,
  Trash2,
  Archive
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'renewal' | 'sale' | 'price';
  title: string;
  message: string;
  domainName?: string;
  amount?: number;
  date: string;
  read: boolean;
  archived: boolean;
  priority: 'low' | 'medium' | 'high';
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationSystemProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onFilter: (filter: string) => void;
  onSearch: (query: string) => void;
}

export default function AdvancedNotificationSystem({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onArchive,
  onFilter,
  onSearch
}: NotificationSystemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('date');

  const unreadCount = notifications.filter(n => !n.read && !n.archived).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'renewal':
        return <Calendar className="h-5 w-5 text-orange-500" />;
      case 'sale':
        return <DollarSign className="h-5 w-5 text-green-500" />;
      case 'price':
        return <TrendingUp className="h-5 w-5 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };


  const filteredNotifications = notifications
    .filter(notification => {
      if (filterType !== 'all' && notification.type !== filterType) return false;
      if (searchQuery && !notification.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !notification.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'date':
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch(query);
  };

  const handleFilter = (filter: string) => {
    setFilterType(filter);
    onFilter(filter);
  };

  return (
    <div className="relative">
      {/* 通知按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 通知面板 */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-96 bg-white rounded-lg shadow-lg border z-50">
          {/* 头部 */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">通知中心</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 搜索和筛选 */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索通知..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={filterType}
                  onChange={(e) => handleFilter(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">所有类型</option>
                  <option value="renewal">续费提醒</option>
                  <option value="sale">出售机会</option>
                  <option value="price">价格提醒</option>
                  <option value="warning">警告</option>
                  <option value="success">成功</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="date">按时间</option>
                  <option value="priority">按优先级</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {filteredNotifications.length} 条通知
                </span>
                <button
                  onClick={onMarkAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>全部标记为已读</span>
                </button>
              </div>
            </div>
          </div>

          {/* 通知列表 */}
          <div className="max-h-96 overflow-y-auto">
            {filteredNotifications.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      notification.read ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {notification.title}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {notification.message}
                            </p>
                            {notification.domainName && (
                              <p className="text-xs text-blue-600 mt-1">
                                域名: {notification.domainName}
                              </p>
                            )}
                            {notification.amount && (
                              <p className="text-xs text-green-600 mt-1">
                                金额: ${notification.amount.toFixed(2)}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(notification.date).toLocaleString()}
                            </p>
                          </div>
                          
                          <div className="flex items-center space-x-1 ml-2">
                            {!notification.read && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            )}
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => onMarkAsRead(notification.id)}
                                className="text-gray-400 hover:text-gray-600"
                                title="标记为已读"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => onArchive(notification.id)}
                                className="text-gray-400 hover:text-gray-600"
                                title="归档"
                              >
                                <Archive className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => onDelete(notification.id)}
                                className="text-gray-400 hover:text-red-600"
                                title="删除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>暂无通知</p>
              </div>
            )}
          </div>

          {/* 底部操作 */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                未读: {unreadCount} 条
              </div>
              <div className="flex items-center space-x-2">
                <button className="text-sm text-gray-600 hover:text-gray-800">
                  设置
                </button>
                <button className="text-sm text-gray-600 hover:text-gray-800">
                  清空已读
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
