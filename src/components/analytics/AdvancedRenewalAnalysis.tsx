'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Calendar, DollarSign, BarChart3 } from 'lucide-react';
import { DomainWithTags } from '../../types/dashboard';
import { RenewalCostService, AnnualRenewalCostAnalysis } from '../../lib/renewalCostService';

interface AdvancedRenewalAnalysisProps {
  domains: DomainWithTags[];
}

export default function AdvancedRenewalAnalysis({ domains }: AdvancedRenewalAnalysisProps) {
  const [analysis, setAnalysis] = useState<AnnualRenewalCostAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const loadAnalysis = async () => {
      setLoading(true);
      try {
        // 使用传入的domains数据而不是直接查询数据库
        const analysisData = await RenewalCostService.calculateAnnualRenewalCostAnalysisFromDomains(domains, selectedYear);
        setAnalysis(analysisData);
      } catch (error) {
        console.error('Error loading renewal analysis:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalysis();
  }, [selectedYear, domains]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <p className="text-gray-500">No renewal analysis data available</p>
      </div>
    );
  }

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const maxMonthlyCost = Math.max(...Object.values(analysis.cost_by_month));

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          Advanced Renewal Analysis - {selectedYear}
        </h3>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-3 py-1 border border-gray-300 rounded-md text-sm"
        >
          {Array.from({ length: 5 }, (_, i) => {
            const year = new Date().getFullYear() + i;
            return (
              <option key={year} value={year}>
                {year}
              </option>
            );
          })}
        </select>
      </div>

      {/* 成本概览 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-900">Estimated Cost</p>
              <p className="text-2xl font-bold text-blue-600">
                ${analysis.total_estimated_cost.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-900">Domains to Renew</p>
              <p className="text-2xl font-bold text-green-600">
                {analysis.domains_needing_renewal}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-purple-900">Accuracy</p>
              <p className="text-2xl font-bold text-purple-600">
                {analysis.cost_accuracy.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 月度成本分布 */}
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Monthly Cost Distribution</h4>
        <div className="grid grid-cols-12 gap-2">
          {months.map((month, index) => {
            const cost = analysis.cost_by_month[index.toString()] || 0;
            const height = maxMonthlyCost > 0 ? (cost / maxMonthlyCost) * 100 : 0;
            
            return (
              <div key={month} className="text-center">
                <div className="bg-gray-200 rounded-t-lg h-24 flex items-end">
                  <div
                    className="bg-blue-500 w-full rounded-t-lg transition-all duration-300"
                    style={{ height: `${height}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600 mt-1">{month}</p>
                <p className="text-xs font-medium text-gray-900">
                  ${cost.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 注册商成本分布 */}
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Cost by Registrar</h4>
        <div className="space-y-2">
          {Object.entries(analysis.cost_by_registrar)
            .sort(([,a], [,b]) => b - a)
            .map(([registrar, cost]) => {
              const percentage = analysis.total_estimated_cost > 0 
                ? (cost / analysis.total_estimated_cost) * 100 
                : 0;
              
              return (
                <div key={registrar} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{registrar}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-20 text-right">
                      ${cost.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* 成本趋势分析 */}
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Cost Trends</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <TrendingUp className="h-5 w-5 text-yellow-600 mr-2" />
              <span className="text-sm font-medium text-yellow-900">Average Cost Increase</span>
            </div>
            <p className="text-lg font-bold text-yellow-700">
              {analysis.cost_trends.average_cost_increase.toFixed(1)}%
            </p>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <TrendingDown className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-sm font-medium text-red-900">Most Expensive Domains</span>
            </div>
            <div className="space-y-1">
              {analysis.cost_trends.most_expensive_domains.slice(0, 3).map((domain, index) => (
                <p key={index} className="text-sm text-red-700 truncate">{domain}</p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 优化建议 */}
      {analysis.cost_trends.cost_optimization_opportunities.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-4">Optimization Opportunities</h4>
          <div className="bg-orange-50 rounded-lg p-4">
            <ul className="space-y-2">
              {analysis.cost_trends.cost_optimization_opportunities.map((opportunity, index) => (
                <li key={index} className="text-sm text-orange-800 flex items-start">
                  <span className="text-orange-600 mr-2">•</span>
                  {opportunity}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
