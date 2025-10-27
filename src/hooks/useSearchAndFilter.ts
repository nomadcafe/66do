'use client';

import { useState, useMemo, useCallback } from 'react';
import { DomainWithTags, TransactionWithRequiredFields } from '../types/dashboard';

// 搜索和过滤配置
interface SearchConfig {
  searchFields: string[];
  caseSensitive?: boolean;
  exactMatch?: boolean;
}

interface FilterConfig {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte' | 'between';
  value: string | number | boolean | Date;
  secondValue?: string | number | boolean | Date; // 用于between操作
}

// 高级搜索Hook
export function useAdvancedSearch<T>(
  data: T[],
  searchConfig: SearchConfig = { searchFields: [] }
) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    field: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  // 搜索函数
  const searchItem = useCallback((item: T, term: string): boolean => {
    if (!term.trim()) return true;

    const searchValue = searchConfig.caseSensitive ? term : term.toLowerCase();

    return searchConfig.searchFields.some(field => {
      const fieldValue = getNestedValue(item, field);
      if (fieldValue == null) return false;

      const itemValue = searchConfig.caseSensitive 
        ? String(fieldValue) 
        : String(fieldValue).toLowerCase();

      if (searchConfig.exactMatch) {
        return itemValue === searchValue;
      }
      return itemValue.includes(searchValue);
    });
  }, [searchConfig]);

  // 过滤函数
  const filterItem = useCallback((item: T, filter: FilterConfig): boolean => {
    const fieldValue = getNestedValue(item, filter.field);
    if (fieldValue == null) return false;

    switch (filter.operator) {
      case 'equals':
        return fieldValue === filter.value;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(filter.value).toLowerCase());
      case 'startsWith':
        return String(fieldValue).toLowerCase().startsWith(String(filter.value).toLowerCase());
      case 'endsWith':
        return String(fieldValue).toLowerCase().endsWith(String(filter.value).toLowerCase());
      case 'gt':
        return Number(fieldValue) > Number(filter.value);
      case 'lt':
        return Number(fieldValue) < Number(filter.value);
      case 'gte':
        return Number(fieldValue) >= Number(filter.value);
      case 'lte':
        return Number(fieldValue) <= Number(filter.value);
      case 'between':
        return Number(fieldValue) >= Number(filter.value) && 
               Number(fieldValue) <= Number(filter.secondValue);
      default:
        return true;
    }
  }, []);

  // 排序函数
  const sortItems = useCallback((items: T[]): T[] => {
    if (!sortConfig) return items;

    return [...items].sort((a, b) => {
      const aValue = getNestedValue(a, sortConfig.field);
      const bValue = getNestedValue(b, sortConfig.field);

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === 'asc' ? -1 : 1;
      if (bValue == null) return sortConfig.direction === 'asc' ? 1 : -1;

      const comparison = compareValues(aValue, bValue);
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [sortConfig]);

  // 处理后的数据
  const processedData = useMemo(() => {
    let result = data;

    // 应用搜索
    if (searchTerm.trim()) {
      result = result.filter(item => searchItem(item, searchTerm));
    }

    // 应用过滤
    filters.forEach(filter => {
      result = result.filter(item => filterItem(item, filter));
    });

    // 应用排序
    result = sortItems(result);

    return result;
  }, [data, searchTerm, filters, searchItem, filterItem, sortItems]);

  // 添加过滤器
  const addFilter = useCallback((filter: FilterConfig) => {
    setFilters(prev => [...prev, filter]);
  }, []);

  // 移除过滤器
  const removeFilter = useCallback((index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 更新过滤器
  const updateFilter = useCallback((index: number, filter: FilterConfig) => {
    setFilters(prev => prev.map((f, i) => i === index ? filter : f));
  }, []);

  // 清除所有过滤器
  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  // 设置排序
  const setSorting = useCallback((field: string, direction: 'asc' | 'desc') => {
    setSortConfig({ field, direction });
  }, []);

  // 清除排序
  const clearSorting = useCallback(() => {
    setSortConfig(null);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    filters,
    addFilter,
    removeFilter,
    updateFilter,
    clearFilters,
    sortConfig,
    setSorting,
    clearSorting,
    processedData,
    totalCount: data.length,
    filteredCount: processedData.length
  };
}

// 域名搜索Hook
export function useDomainSearch(domains: DomainWithTags[]) {
  const searchConfig: SearchConfig = {
    searchFields: ['domain_name', 'registrar', 'status', 'tags'],
    caseSensitive: false,
    exactMatch: false
  };

  return useAdvancedSearch(domains, searchConfig);
}

// 交易搜索Hook
export function useTransactionSearch(transactions: TransactionWithRequiredFields[]) {
  const searchConfig: SearchConfig = {
    searchFields: ['type', 'notes', 'platform', 'category'],
    caseSensitive: false,
    exactMatch: false
  };

  return useAdvancedSearch(transactions, searchConfig);
}

// 快速过滤器Hook
export function useQuickFilters<T>(data: T[]) {
  const [quickFilters, setQuickFilters] = useState<Record<string, string | number | boolean | Date>>({});

  const filteredData = useMemo(() => {
    return data.filter(item => {
      return Object.entries(quickFilters).every(([field, value]) => {
        if (value == null || value === '') return true;
        const itemValue = getNestedValue(item, field);
        return itemValue === value;
      });
    });
  }, [data, quickFilters]);

  const setQuickFilter = useCallback((field: string, value: string | number | boolean | Date) => {
    setQuickFilters(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const clearQuickFilter = useCallback((field: string) => {
    setQuickFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[field];
      return newFilters;
    });
  }, []);

  const clearAllQuickFilters = useCallback(() => {
    setQuickFilters({});
  }, []);

  return {
    quickFilters,
    setQuickFilter,
    clearQuickFilter,
    clearAllQuickFilters,
    filteredData
  };
}

// 工具函数
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((current, key) => {
    return (current as Record<string, unknown>)?.[key];
  }, obj);
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b);
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }
  return String(a).localeCompare(String(b));
}

// 搜索建议Hook
export function useSearchSuggestions<T>(
  data: T[],
  searchFields: string[],
  maxSuggestions: number = 10
) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const generateSuggestions = useCallback((term: string) => {
    if (!term.trim() || term.length < 2) {
      setSuggestions([]);
      return;
    }

    const termLower = term.toLowerCase();
    const suggestionSet = new Set<string>();

    data.forEach(item => {
      searchFields.forEach(field => {
        const value = getNestedValue(item, field);
        if (value && typeof value === 'string') {
          const words = value.toLowerCase().split(/\s+/);
          words.forEach(word => {
            if (word.includes(termLower) && word !== termLower) {
              suggestionSet.add(word);
            }
          });
        }
      });
    });

    const suggestionsArray = Array.from(suggestionSet)
      .filter(s => s.length > term.length)
      .slice(0, maxSuggestions);

    setSuggestions(suggestionsArray);
  }, [data, searchFields, maxSuggestions]);

  return {
    suggestions,
    generateSuggestions
  };
}
