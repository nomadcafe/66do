'use client';

import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import { TrendingUp, DollarSign, Globe } from 'lucide-react';

interface DomainPerformanceData {
  name: string;
  purchasePrice: number;
  currentValue: number;
  profit: number;
  roi: number;
  daysHeld: number;
}

interface ChartData {
  month: string;
  domains: number;
  cost: number;
  revenue: number;
  profit: number;
}

interface DomainPerformanceChartProps {
  performanceData: DomainPerformanceData[];
  chartData: ChartData[];
  type: 'line' | 'bar' | 'pie' | 'area';
}


export default function DomainPerformanceChart({ 
  performanceData, 
  chartData, 
  type 
}: DomainPerformanceChartProps) {
  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  `$${Number(value).toFixed(2)}`, 
                  name === 'cost' ? '成本' : name === 'revenue' ? '收益' : '利润'
                ]}
              />
              <Line 
                type="monotone" 
                dataKey="cost" 
                stroke="#EF4444" 
                strokeWidth={2}
                name="成本"
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#10B981" 
                strokeWidth={2}
                name="收益"
              />
              <Line 
                type="monotone" 
                dataKey="profit" 
                stroke="#3B82F6" 
                strokeWidth={2}
                name="利润"
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  `$${Number(value).toFixed(2)}`, 
                  name === 'cost' ? '成本' : name === 'revenue' ? '收益' : '利润'
                ]}
              />
              <Bar dataKey="cost" fill="#EF4444" name="成本" />
              <Bar dataKey="revenue" fill="#10B981" name="收益" />
              <Bar dataKey="profit" fill="#3B82F6" name="利润" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  `$${Number(value).toFixed(2)}`, 
                  name === 'cost' ? '成本' : name === 'revenue' ? '收益' : '利润'
                ]}
              />
              <Area 
                type="monotone" 
                dataKey="cost" 
                stackId="1" 
                stroke="#EF4444" 
                fill="#EF4444" 
                fillOpacity={0.6}
                name="成本"
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stackId="2" 
                stroke="#10B981" 
                fill="#10B981" 
                fillOpacity={0.6}
                name="收益"
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        const pieData = [
          { name: '活跃域名', value: performanceData.filter(d => d.currentValue > 0).length, color: '#10B981' },
          { name: '已售域名', value: performanceData.filter(d => d.profit > 0).length, color: '#3B82F6' },
          { name: '亏损域名', value: performanceData.filter(d => d.profit < 0).length, color: '#EF4444' },
        ];
        
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(Number(percent) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">域名表现分析</h3>
        <div className="flex items-center space-x-2">
          <Globe className="h-5 w-5 text-blue-600" />
          <span className="text-sm text-gray-600">
            {performanceData.length} 个域名
          </span>
        </div>
      </div>
      
      {performanceData.length > 0 ? (
        <div className="space-y-4">
          {renderChart()}
          
          {/* 表现统计 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-800">最佳表现</span>
              </div>
              <p className="text-2xl font-bold text-green-900 mt-1">
                {Math.max(...performanceData.map(d => d.roi)).toFixed(1)}%
              </p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">总利润</span>
              </div>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                ${performanceData.reduce((sum, d) => sum + d.profit, 0).toFixed(2)}
              </p>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Globe className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">平均持有</span>
              </div>
              <p className="text-2xl font-bold text-purple-900 mt-1">
                {Math.round(performanceData.reduce((sum, d) => sum + d.daysHeld, 0) / performanceData.length)} 天
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Globe className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>暂无域名数据</p>
        </div>
      )}
    </div>
  );
}
