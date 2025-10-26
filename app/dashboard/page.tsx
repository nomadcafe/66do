'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '../../src/contexts/SupabaseAuthContext';
import { useI18nContext } from '../../src/contexts/I18nProvider';
import DomainList from '../../src/components/domain/DomainList';
import DomainForm from '../../src/components/domain/DomainForm';
import SmartDomainForm from '../../src/components/domain/SmartDomainForm';
import TransactionList from '../../src/components/transaction/TransactionList';
import TransactionForm from '../../src/components/transaction/TransactionForm';
import InvestmentAnalytics from '../../src/components/analytics/InvestmentAnalytics';
import UserPreferencesPanel from '../../src/components/settings/UserPreferencesPanel';
import DomainMarketplace from '../../src/components/marketplace/DomainMarketplace';
import DataImportExport from '../../src/components/data/DataImportExport';
import { LazyDomainExpiryAlert, LazyWrapper } from '../../src/components/LazyComponents';
import MobileNavigation from '../../src/components/layout/MobileNavigation';
import AutoDomainMonitor from '../../src/components/monitoring/AutoDomainMonitor';
// Mobile components for enhanced mobile experience
import TouchGestures from '../../src/components/mobile/TouchGestures';
import PullToRefresh from '../../src/components/mobile/PullToRefresh';
import { isMobile } from '../../src/lib/utils';
import FinancialReport from '../../src/components/reports/FinancialReport';
import FinancialAnalysis from '../../src/components/reports/FinancialAnalysisOptimized';
import ShareModal from '../../src/components/share/ShareModal';
import SaleSuccessModal from '../../src/components/share/SaleSuccessModal';
import { calculateAnnualRenewalCost, getRenewalOptimizationSuggestions } from '../../src/lib/renewalCalculations';
import { domainExpiryManager } from '../../src/lib/domainExpiryManager';
import { calculateFinancialMetrics } from '../../src/lib/financialMetrics';
import { calculateEnhancedFinancialMetrics, formatCurrency as formatCurrencyEnhanced } from '../../src/lib/enhancedFinancialMetrics';
import { domainCache } from '../../src/lib/cache';
import { auditLogger } from '../../src/lib/security';
import LoadingSpinner from '../../src/components/ui/LoadingSpinner';
import ErrorMessage from '../../src/components/ui/ErrorMessage';
import { 
  loadDomainsFromSupabase, 
  loadTransactionsFromSupabase,
  Domain,
  Transaction
} from '../../src/lib/supabaseService';
import {
  DomainWithTags,
  TransactionWithRequiredFields,
  ensureDomainWithTags,
  ensureTransactionWithRequiredFields
} from '../../src/types/dashboard';
import { 
  Globe, 
  Plus, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  BarChart3, 
  LogOut, 
  User, 
  FileText,
  AlertTriangle,
  Calendar,
  Award,
  Share2,
  PieChart,
  Activity,
  Bell,
  Settings,
  Eye,
  Search,
  RefreshCw,
  Zap,
  CheckCircle,
  List,
  Database,
  Target
} from 'lucide-react';

// Domain and Transaction types are now imported from supabaseService

interface DomainStats {
  totalDomains: number;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  roi: number;
  activeDomains: number;
  forSaleDomains: number;
  soldDomains: number;
  expiredDomains: number;
  avgPurchasePrice: number;
  avgSalePrice: number;
  bestPerformingDomain: string;
  worstPerformingDomain: string;
  // 新增续费成本统计
  totalRenewalCost: number;
  annualRenewalCost: number;
  totalHoldingCost: number;
  avgRenewalCost: number;
  renewalCycles: { [key: string]: number }; // 不同续费周期的域名数量
}



export default function DashboardPage() {
  const [domains, setDomains] = useState<DomainWithTags[]>([]);
  const [transactions, setTransactions] = useState<TransactionWithRequiredFields[]>([]);
  const [stats, setStats] = useState<DomainStats>({
    totalDomains: 0,
    totalCost: 0,
    totalRevenue: 0,
    totalProfit: 0,
    roi: 0,
    activeDomains: 0,
    forSaleDomains: 0,
    soldDomains: 0,
    expiredDomains: 0,
    avgPurchasePrice: 0,
    avgSalePrice: 0,
    bestPerformingDomain: '',
    worstPerformingDomain: '',
    // 新增续费成本统计
    totalRenewalCost: 0,
    annualRenewalCost: 0,
    totalHoldingCost: 0,
    avgRenewalCost: 0,
    renewalCycles: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'supabase' | 'cache'>('cache');
  const [activeTab, setActiveTab] = useState<'overview' | 'domains' | 'transactions' | 'analytics' | 'alerts' | 'marketplace' | 'settings' | 'data' | 'reports'>('overview');
  
  // 计算续费分析 - 使用缓存优化性能
  const renewalAnalysis = useMemo(() => {
    // 过滤和转换Supabase数据以匹配函数期望的类型
    const validDomains = domains
      .filter(domain => 
        domain.status === 'active' && 
        domain.renewal_cost !== null && 
        domain.purchase_date !== null
      )
      .map(domain => ({
        id: domain.id,
        domain_name: domain.domain_name,
        renewal_cost: domain.renewal_cost!,
        renewal_cycle: domain.renewal_cycle,
        renewal_count: domain.renewal_count,
        purchase_date: domain.purchase_date!,
        expiry_date: domain.expiry_date || undefined,
        status: domain.status
      }));
    
    return calculateAnnualRenewalCost(validDomains);
  }, [domains]);

  // 缓存财务指标计算 - 用于性能优化
  // const financialMetrics = useMemo(() => {
  //   return calculateFinancialMetrics(domains, transactions);
  // }, [domains, transactions]);

  // 缓存域名性能分析 - 用于性能优化
  // const domainPerformance = useMemo(() => {
  //   return domains.map(domain => ({
  //     ...domain,
  //     performance: calculateDomainPerformance(domain, transactions.filter(t => t.domain_id === domain.id))
  //   }));
  // }, [domains, transactions]);
  
  // 计算财务指标
  
  // 计算增强的财务指标
  const enhancedFinancialMetrics = useMemo(() => {
    // 过滤和转换Supabase数据以匹配函数期望的类型
    const validDomains = domains
      .filter(domain => 
        domain.status === 'active' && 
        domain.purchase_cost !== null && 
        domain.renewal_cost !== null &&
        domain.purchase_date !== null
      )
      .map(domain => ({
        id: domain.id,
        purchase_cost: domain.purchase_cost!,
        renewal_cost: domain.renewal_cost!,
        renewal_count: domain.renewal_count,
        status: domain.status,
        purchase_date: domain.purchase_date!
      }));
    
    const validTransactions = transactions
      .filter(transaction => transaction.amount !== null)
      .map(transaction => ({
        id: transaction.id,
        domain_id: transaction.domain_id,
        type: transaction.type,
        amount: transaction.amount!,
        platform_fee: transaction.platform_fee || undefined,
        net_amount: transaction.net_amount || undefined,
        date: transaction.date,
        category: transaction.category
      }));
    
    return calculateEnhancedFinancialMetrics(validDomains, validTransactions);
  }, [domains, transactions]);
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [showSmartDomainForm, setShowSmartDomainForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingDomain, setEditingDomain] = useState<DomainWithTags | undefined>();
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithRequiredFields | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSaleSuccessModal, setShowSaleSuccessModal] = useState(false);
  const [saleSuccessData, setSaleSuccessData] = useState<{domain: DomainWithTags, transaction: TransactionWithRequiredFields} | null>(null);
  const { user, session, loading: authLoading, refreshSession, signOut } = useSupabaseAuth();
  const { t, locale, setLocale } = useI18nContext();
  const router = useRouter();

  // Redirect if not authenticated (but wait for auth to load)
  useEffect(() => {
    if (!authLoading && !user) {
      console.log('No user found, redirecting to login');
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // 页面刷新时尝试恢复会话
  useEffect(() => {
    if (authLoading && !user && !session) {
      console.log('Page refreshed, attempting to restore session...');
      refreshSession();
    }
  }, [authLoading, user, session, refreshSession]);

  // Load data from Supabase database only
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const userId = user.id;
        
        // Try to get cached data first
        const cachedDomains = domainCache.getCachedDomains(userId);
        const cachedTransactions = domainCache.getCachedTransactions(userId);
        
        if (cachedDomains && cachedTransactions) {
          const typedDomains = cachedDomains.map(ensureDomainWithTags);
          const typedTransactions = cachedTransactions.map(ensureTransactionWithRequiredFields);
          setDomains(typedDomains);
          setTransactions(typedTransactions);
          setDataSource('cache');
          setLoading(false);
          return;
        }

        // Load from Supabase database
        console.log('Loading data from Supabase database...');
        
        const domainsResult = await loadDomainsFromSupabase(userId);
        const transactionsResult = await loadTransactionsFromSupabase(userId);
        
        if (domainsResult.success && transactionsResult.success) {
          const typedDomains = (domainsResult.data || []).map(ensureDomainWithTags);
          const typedTransactions = (transactionsResult.data || []).map(ensureTransactionWithRequiredFields);
          setDomains(typedDomains);
          setTransactions(typedTransactions);
          setDataSource('supabase');
          
          // Cache the data
          domainCache.cacheDomains(userId, domainsResult.data || []);
          domainCache.cacheTransactions(userId, transactionsResult.data || []);
          
          console.log('Data loaded from Supabase database successfully');
        } else {
          throw new Error('Failed to load data from Supabase database');
        }
        
      } catch (error) {
        console.error('Error loading data from Supabase:', error);
        setError(t('common.dataLoadFailed'));
        auditLogger.log(user?.id || 'default', 'data_load_failed', 'dashboard', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      } finally {
        setLoading(false);
        
        // Log successful data load
        const userId = user?.id || 'default';
        auditLogger.log(userId, 'data_loaded', 'dashboard', { 
          domainsCount: domains.length, 
          transactionsCount: transactions.length,
          dataSource: dataSource
        });
      }
    };

    loadData();
  }, [user?.id, dataSource, domains.length, transactions.length]);


  // Save data to Supabase database only
  const saveData = async (newDomains: DomainWithTags[], newTransactions: TransactionWithRequiredFields[]) => {
    if (!user?.id) return;
    
    try {
      console.log('Saving data to Supabase database...');
      
      // Save domains to Supabase
      for (const domain of newDomains) {
        if (domains.find(d => d.id === domain.id)) {
          // Update existing domain
          await fetch('/api/domains', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'updateDomain',
              userId: user.id,
              domain: {
                ...domain,
                registrar: domain.registrar || null,
                purchase_date: domain.purchase_date || null,
                purchase_cost: domain.purchase_cost || null,
                renewal_cost: domain.renewal_cost || null,
                next_renewal_date: domain.next_renewal_date || null,
                expiry_date: domain.expiry_date || null,
                estimated_value: domain.estimated_value || null,
                sale_date: domain.sale_date || null,
                sale_price: domain.sale_price || null,
                platform_fee: domain.platform_fee || null,
                tags: JSON.stringify(domain.tags)
              }
            })
          });
        } else {
          // Add new domain
          await fetch('/api/domains', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'addDomain',
              userId: user.id,
              domain: {
                domain_name: domain.domain_name,
                registrar: domain.registrar || null,
                purchase_date: domain.purchase_date || null,
                purchase_cost: domain.purchase_cost || null,
                renewal_cost: domain.renewal_cost || null,
                renewal_cycle: domain.renewal_cycle,
                renewal_count: domain.renewal_count,
                next_renewal_date: domain.next_renewal_date || null,
                expiry_date: domain.expiry_date || null,
                status: domain.status,
                estimated_value: domain.estimated_value || null,
                sale_date: domain.sale_date || null,
                sale_price: domain.sale_price || null,
                platform_fee: domain.platform_fee || null,
                tags: JSON.stringify(domain.tags)
              }
            })
          });
        }
      }
      
      // Save transactions to Supabase
      for (const transaction of newTransactions) {
        if (transactions.find(t => t.id === transaction.id)) {
          // Update existing transaction
          await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'updateTransaction',
              userId: user.id,
              transaction: {
                ...transaction,
                base_amount: transaction.base_amount || null,
                platform_fee: transaction.platform_fee || null,
                platform_fee_percentage: transaction.platform_fee_percentage || null,
                net_amount: transaction.net_amount || null,
                category: transaction.category || null,
                tax_deductible: transaction.tax_deductible || false,
                receipt_url: transaction.receipt_url || null,
                notes: transaction.notes || null
              }
            })
          });
        } else {
          // Add new transaction
          await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'addTransaction',
              userId: user.id,
              transaction: {
                domain_id: transaction.domain_id,
                type: transaction.type,
                amount: transaction.amount,
                currency: transaction.currency,
                exchange_rate: transaction.exchange_rate,
                base_amount: transaction.base_amount || null,
                platform_fee: transaction.platform_fee || null,
                platform_fee_percentage: transaction.platform_fee_percentage || null,
                net_amount: transaction.net_amount || null,
                category: transaction.category || null,
                tax_deductible: transaction.tax_deductible || false,
                receipt_url: transaction.receipt_url || null,
                notes: transaction.notes || null,
                date: transaction.date
              }
            })
          });
        }
      }
      
      // Update cache
      domainCache.cacheDomains(user.id, newDomains);
      domainCache.cacheTransactions(user.id, newTransactions);
      
      console.log('Data saved to Supabase database successfully');
    } catch (error) {
      console.error('Error saving data to Supabase:', error);
      setError(t('common.dataSaveFailed'));
    }
  };

  // Update stats when domains change
  useEffect(() => {
    // 使用新的财务指标计算
    // 过滤和转换Supabase数据以匹配函数期望的类型
    const validDomains = domains
      .filter(domain => 
        domain.status === 'active' && 
        domain.purchase_cost !== null && 
        domain.renewal_cost !== null &&
        domain.purchase_date !== null
      )
      .map(domain => ({
        id: domain.id,
        purchase_cost: domain.purchase_cost!,
        renewal_cost: domain.renewal_cost!,
        renewal_count: domain.renewal_count,
        status: domain.status,
        purchase_date: domain.purchase_date!
      }));
    
    const validTransactions = transactions
      .filter(transaction => transaction.amount !== null)
      .map(transaction => ({
        id: transaction.id,
        domain_id: transaction.domain_id,
        type: transaction.type,
        amount: transaction.amount!,
        platform_fee: transaction.platform_fee || undefined,
        net_amount: transaction.net_amount || undefined,
        date: transaction.date,
        category: transaction.category
      }));
    
    const financialMetrics = calculateFinancialMetrics(validDomains, validTransactions);
    
    const totalDomains = financialMetrics.totalDomains;
    const totalCost = financialMetrics.totalInvestment;
    const totalRevenue = financialMetrics.totalRevenue;
    const totalRenewalCost = financialMetrics.totalRenewalCost;
    const totalHoldingCost = financialMetrics.totalHoldingCost;
    const totalProfit = financialMetrics.totalProfit;
    const roi = financialMetrics.roi;
    
    // 计算年度续费成本（使用新的准确计算逻辑）
    // 过滤和转换Supabase数据以匹配函数期望的类型
    const validDomainsForRenewal = domains
      .filter(domain => 
        domain.status === 'active' && 
        domain.renewal_cost !== null && 
        domain.purchase_date !== null
      )
      .map(domain => ({
        id: domain.id,
        domain_name: domain.domain_name,
        renewal_cost: domain.renewal_cost!,
        renewal_cycle: domain.renewal_cycle,
        renewal_count: domain.renewal_count,
        purchase_date: domain.purchase_date!,
        expiry_date: domain.expiry_date || undefined,
        status: domain.status
      }));
    
    const renewalAnalysis = calculateAnnualRenewalCost(validDomainsForRenewal);
    const annualRenewalCost = renewalAnalysis.totalAnnualCost;
    
    // 统计不同续费周期的域名数量和成本
    const renewalCycles = renewalAnalysis.costByCycle;
    
    const activeDomains = financialMetrics.activeDomains;
    const forSaleDomains = domains.filter(d => d.status === 'for_sale').length;
    const soldDomains = financialMetrics.soldDomains;
    const expiredDomains = domains.filter(d => d.status === 'expired').length;
    
    const avgPurchasePrice = financialMetrics.avgPurchasePrice;
    const avgSalePrice = financialMetrics.avgSalePrice;
    const avgRenewalCost = activeDomains > 0 ? totalRenewalCost / activeDomains : 0;
    
    // Find best and worst performing domains
    const domainPerformance = domains.map(domain => {
      const domainTransactions = transactions.filter(t => t.domain_id === domain.id);
      const totalSpent = domainTransactions.filter(t => t.type === 'buy' || t.type === 'renew' || t.type === 'fee').reduce((sum, t) => sum + t.amount, 0);
      const totalEarned = domainTransactions.filter(t => t.type === 'sell').reduce((sum, t) => sum + t.amount, 0);
      const profit = totalEarned - totalSpent;
      const roi = totalSpent > 0 ? (profit / totalSpent) * 100 : 0;
      return { domain, profit, roi };
    });
    
    const bestPerforming = domainPerformance.reduce((best, current) => 
      current.profit > best.profit ? current : best, domainPerformance[0] || { domain: { domain_name: 'N/A' } });
    const worstPerforming = domainPerformance.reduce((worst, current) => 
      current.profit < worst.profit ? current : worst, domainPerformance[0] || { domain: { domain_name: 'N/A' } });

    setStats({
      totalDomains,
      totalCost,
      totalRevenue,
      totalProfit,
      roi,
      activeDomains,
      forSaleDomains,
      soldDomains,
      expiredDomains,
      avgPurchasePrice,
      avgSalePrice,
      bestPerformingDomain: bestPerforming.domain.domain_name,
      worstPerformingDomain: worstPerforming.domain.domain_name,
      // 新增续费成本统计
      totalRenewalCost,
      annualRenewalCost,
      totalHoldingCost,
      avgRenewalCost,
      renewalCycles
    });
  }, [domains, transactions]);

  // 计算即将到期的域名（30天内）
  const expiringDomains = useMemo(() => {
    return domains.filter(domain => {
      // 跳过已出售的域名
      if (domain.status === 'sold') return false;
      if (!domain.expiry_date) return false;
      
      const daysUntilExpiry = Math.ceil((new Date(domain.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
    }).map(domain => {
      const daysUntilExpiry = Math.ceil((new Date(domain.expiry_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return {
        ...domain,
        daysUntilExpiry,
        urgency: daysUntilExpiry <= 7 ? 'critical' : daysUntilExpiry <= 14 ? 'urgent' : 'normal'
      };
    }).sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [domains]);


  // Domain management functions
  const handleAddDomain = () => {
    setEditingDomain(undefined);
    setShowSmartDomainForm(true);
  };

  const handleEditDomain = (domain: DomainWithTags) => {
    setEditingDomain(domain);
    setShowDomainForm(true);
  };

  const handleDeleteDomain = (id: string) => {
    const updatedDomains = domains.filter(domain => domain.id !== id);
    setDomains(updatedDomains);
    
    // Also remove related transactions
    const updatedTransactions = transactions.filter(transaction => transaction.domain_id !== id);
    setTransactions(updatedTransactions);
    
    // Save data using unified function
    saveData(updatedDomains, updatedTransactions);
  };

  const handleSaveDomain = (domainData: Omit<DomainWithTags, 'id'>) => {
    let updatedDomains: DomainWithTags[];
    
    if (editingDomain) {
      // Update existing domain
      updatedDomains = domains.map(domain => 
        domain.id === editingDomain.id 
          ? { ...domainData, id: editingDomain.id, tags: domain.tags }
          : domain
      );
    } else {
      // Add new domain
      const newDomain: DomainWithTags = {
        ...domainData,
        id: Date.now().toString(),
        tags: []
      };
      updatedDomains = [...domains, newDomain];
    }
    
    setDomains(updatedDomains);
    saveData(updatedDomains, transactions);
    setShowDomainForm(false);
    setEditingDomain(undefined);
  };

  const handleViewDomain = (domain: DomainWithTags) => {
    // TODO: Implement domain details view
    console.log('View domain:', domain);
  };

  // Transaction management functions
  const handleAddTransaction = () => {
    setEditingTransaction(undefined);
    setShowTransactionForm(true);
  };

  const handleEditTransaction = (transaction: TransactionWithRequiredFields) => {
    setEditingTransaction(transaction);
    setShowTransactionForm(true);
  };

  const handleDeleteTransaction = (id: string) => {
    const updatedTransactions = transactions.filter(transaction => transaction.id !== id);
    setTransactions(updatedTransactions);
    saveData(domains, updatedTransactions);
  };

  // 处理域名续费
  const handleRenewDomain = (domainId: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) return;

    const renewalTransaction: TransactionWithRequiredFields = {
      id: Date.now().toString(),
      user_id: user?.id || '',
      domain_id: domainId,
      type: 'renew',
      amount: domain.renewal_cost || 0,
      currency: 'USD',
      exchange_rate: 1,
      base_amount: domain.renewal_cost || 0,
      platform_fee: null,
      platform_fee_percentage: null,
      net_amount: domain.renewal_cost || 0,
      category: domain.registrar,
      tax_deductible: false,
      receipt_url: null,
      notes: t('common.renewalNote').replace('{domain}', domain.domain_name).replace('{cycle}', domain.renewal_cycle.toString()),
      date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const newTransactions = [...transactions, renewalTransaction];
    setTransactions(newTransactions);
    saveData(domains, newTransactions);

    // 使用智能域名管理器处理续费
    // 转换Supabase Domain类型为domainExpiryManager期望的类型
    const domainForRenewal = {
      id: domain.id,
      domain_name: domain.domain_name,
      registrar: domain.registrar || '',
      purchase_date: domain.purchase_date || '',
      purchase_cost: domain.purchase_cost || 0,
      renewal_cost: domain.renewal_cost || 0,
      renewal_cycle: domain.renewal_cycle,
      renewal_count: domain.renewal_count,
      next_renewal_date: domain.next_renewal_date || undefined,
      expiry_date: domain.expiry_date || undefined,
      status: domain.status,
      estimated_value: domain.estimated_value,
      sale_date: domain.sale_date || undefined,
      sale_price: domain.sale_price || undefined,
      platform_fee: domain.platform_fee || undefined,
      net_profit: undefined, // Supabase Domain类型中没有此字段
      notes: undefined, // Supabase Domain类型中没有此字段
      created_at: domain.created_at,
      updated_at: domain.updated_at,
      user_id: domain.user_id,
      tags: domain.tags || []
    };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renewedDomain = domainExpiryManager.handleDomainRenewal(domainForRenewal as any);
    
    // 将renewedDomain转换回Supabase Domain类型
    const updatedDomain: Domain = {
      id: renewedDomain.id,
      user_id: domain.user_id,
      domain_name: renewedDomain.domain_name,
      registrar: renewedDomain.registrar,
      purchase_date: renewedDomain.purchase_date,
      purchase_cost: renewedDomain.purchase_cost,
      renewal_cost: renewedDomain.renewal_cost,
      renewal_cycle: renewedDomain.renewal_cycle,
      renewal_count: renewedDomain.renewal_count,
      next_renewal_date: renewedDomain.next_renewal_date || null,
      expiry_date: renewedDomain.expiry_date || null,
      status: renewedDomain.status,
      estimated_value: renewedDomain.estimated_value,
      sale_date: renewedDomain.sale_date || null,
      sale_price: renewedDomain.sale_price || null,
      platform_fee: renewedDomain.platform_fee || null,
      tags: Array.isArray(renewedDomain.tags) ? renewedDomain.tags.join(',') : renewedDomain.tags || null,
      created_at: renewedDomain.created_at || new Date().toISOString(),
      updated_at: renewedDomain.updated_at || new Date().toISOString()
    };
    
    const updatedDomains = domains.map(d => 
      d.id === domainId ? ensureDomainWithTags(updatedDomain) : d
    );
    setDomains(updatedDomains);
    saveData(updatedDomains, transactions);
  };


  const handleSaveTransaction = (transactionData: Omit<TransactionWithRequiredFields, 'id'>) => {
    if (editingTransaction) {
      // Update existing transaction
      const updatedTransactions = transactions.map(transaction => 
        transaction.id === editingTransaction.id 
          ? ensureTransactionWithRequiredFields({ ...transactionData, id: editingTransaction.id })
          : transaction
      );
      setTransactions(updatedTransactions);
      saveData(domains, updatedTransactions);
    } else {
      // Add new transaction
      const newTransaction: TransactionWithRequiredFields = ensureTransactionWithRequiredFields({
        ...transactionData,
        id: Date.now().toString()
      });
      const updatedTransactions = [...transactions, newTransaction];
      setTransactions(updatedTransactions);
      saveData(domains, updatedTransactions);
      
      // 自动更新域名状态
      updateDomainStatusFromTransaction(newTransaction);
    }
    setShowTransactionForm(false);
    setEditingTransaction(undefined);
  };

  // 根据交易自动更新域名状态
  const updateDomainStatusFromTransaction = (transaction: Transaction) => {
    if (transaction.type === 'sell' && transaction.domain_id) {
      const updatedDomains = domains.map(domain => {
        if (domain.id === transaction.domain_id) {
          return {
            ...domain,
            status: 'sold' as const,
            sale_date: transaction.date,
            sale_price: transaction.amount,
            platform_fee: transaction.platform_fee || 0
          };
        }
        return domain;
      });
      
      setDomains(updatedDomains);
      saveData(updatedDomains, transactions);
      
      // 显示成功消息
      console.log(t('common.domainStatusUpdated'));
    }
  };

  // 处理出售交易完成后的分享
  const handleSaleComplete = (transaction: Omit<TransactionWithRequiredFields, 'id'>, domain: DomainWithTags) => {
    // 创建完整的Transaction对象
    const fullTransaction: TransactionWithRequiredFields = {
      ...transaction,
      id: Date.now().toString()
    };
    setSaleSuccessData({ domain, transaction: fullTransaction });
    setShowSaleSuccessModal(true);
  };

  // Handle logout
  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  // Calculate share data for social media
  const calculateShareData = () => {
    const soldDomains = domains.filter(d => d.status === 'sold');
    const totalProfit = soldDomains.reduce((sum, domain) => {
      const totalHoldingCost = (domain.purchase_cost || 0) + (domain.renewal_count * (domain.renewal_cost || 0));
      const platformFee = domain.platform_fee || 0;
      return sum + (domain.sale_price || 0) - totalHoldingCost - platformFee;
    }, 0);
    
    const totalInvestment = domains.reduce((sum, domain) => {
      return sum + (domain.purchase_cost || 0) + (domain.renewal_count * (domain.renewal_cost || 0));
    }, 0);
    
    const roi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
    
    const bestDomain = soldDomains.reduce((best, domain) => {
      const domainProfit = (domain.sale_price || 0) - (domain.purchase_cost || 0) - (domain.renewal_count * (domain.renewal_cost || 0)) - (domain.platform_fee || 0);
      const bestProfit = (best.sale_price || 0) - (best.purchase_cost || 0) - (best.renewal_count * (best.renewal_cost || 0)) - (best.platform_fee || 0);
      return domainProfit > bestProfit ? domain : best;
    }, soldDomains[0] || { domain_name: 'N/A' });
    
    const investmentPeriod = domains.length > 0 ? 
      `${Math.ceil((new Date().getTime() - new Date(Math.min(...domains.filter(d => d.purchase_date).map(d => new Date(d.purchase_date!).getTime()))).getTime()) / (1000 * 60 * 60 * 24 * 30))}个月` : 
      '0个月';
    
    return {
      totalProfit,
      roi,
      bestDomain: bestDomain.domain_name,
      investmentPeriod,
      domainCount: domains.length,
      totalInvestment
    };
  };



  // Filter domains based on search and status
  const filteredDomains = domains.filter(domain => {
    const matchesSearch = domain.domain_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (domain.registrar || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || domain.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Sort domains
  const sortedDomains = [...filteredDomains].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.domain_name.localeCompare(b.domain_name);
      case 'date':
        return new Date(b.purchase_date || '').getTime() - new Date(a.purchase_date || '').getTime();
      case 'value':
        return (b.estimated_value || 0) - (a.estimated_value || 0);
      case 'cost':
        return (b.purchase_cost || 0) - (a.purchase_cost || 0);
      default:
        return 0;
    }
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={() => window.location.reload()} />;
  }

  // 显示认证加载状态
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.verifyingIdentity')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop Header - Clean & Modern */}
      <div className="hidden lg:block bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center py-8">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('platform.name')}</h1>
                <p className="text-sm text-gray-500 mt-1">{t('dashboard.title')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              {/* Language Selector */}
              <div className="relative">
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as 'en' | 'zh')}
                  className="appearance-none bg-gray-50 border-0 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200"
                >
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </div>
              
              {/* User Info */}
              <div className="flex items-center space-x-3 px-4 py-2 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700">{user?.email}</span>
              </div>
              
              {/* Action Buttons */}
              <button
                onClick={handleAddDomain}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 flex items-center space-x-2 font-medium transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Plus size={18} />
                <span>{t('dashboard.addInvestment')}</span>
              </button>
              
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700 flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all duration-200"
              >
                <LogOut size={18} />
                <span className="text-sm font-medium">{t('dashboard.signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header - Clean & Modern */}
      <div className="lg:hidden bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{t('platform.name')}</h1>
                <p className="text-xs text-gray-500">{t('dashboard.title')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddDomain}
                className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 shadow-sm transition-all duration-200"
              >
                <Plus size={18} />
              </button>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700 p-2.5 rounded-lg hover:bg-gray-50 transition-all duration-200"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Clean White Design */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        {/* Stats Cards - Modern Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{t('dashboard.totalInvestments')}</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalDomains}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Globe className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{t('dashboard.totalCost')}</p>
                <p className="text-3xl font-bold text-gray-900">${stats.totalCost.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{t('dashboard.totalRevenue')}</p>
                <p className="text-3xl font-bold text-gray-900">${stats.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">ROI</p>
                <p className="text-3xl font-bold text-gray-900">{stats.roi.toFixed(1)}%</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Auto Domain Monitor - Clean Section */}
        <div className="mb-12">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <AutoDomainMonitor 
              domains={domains}
              autoStart={true}
              showNotifications={true}
              onDomainExpiry={(expiryInfo) => {
                console.log('域名到期提醒:', expiryInfo);
              }}
              onBulkExpiry={(expiryInfos) => {
                console.log('批量域名到期提醒:', expiryInfos);
              }}
            />
          </div>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">{t('dashboard.totalDomains')}</p>
                <p className="text-3xl font-bold">{stats.totalDomains}</p>
                <p className="text-blue-200 text-xs mt-1">
                  {t('dashboard.active')}: {stats.activeDomains} | {t('dashboard.sold')}: {stats.forSaleDomains}
                </p>
          </div>
              <Globe className="h-8 w-8 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">{t('dashboard.totalInvestment')}</p>
                <p className="text-3xl font-bold">${stats.totalCost.toFixed(2)}</p>
                <p className="text-green-200 text-xs mt-1">
                  {t('dashboard.average')}: ${stats.avgPurchasePrice.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">{t('dashboard.totalRevenue')}</p>
                <p className="text-3xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
                <p className="text-purple-200 text-xs mt-1">
                  {t('dashboard.averageSalePrice')}: ${stats.avgSalePrice.toFixed(2)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm font-medium">{t('dashboard.renewalCost')}</p>
                <p className="text-3xl font-bold">${stats.totalRenewalCost.toFixed(2)}</p>
                <p className="text-yellow-200 text-xs mt-1">
                  {t('dashboard.annualCost')}: ${stats.annualRenewalCost.toFixed(2)}
                </p>
              </div>
              <RefreshCw className="h-8 w-8 text-yellow-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm font-medium">{t('dashboard.totalHoldingCost')}</p>
                <p className="text-3xl font-bold">${stats.totalHoldingCost.toFixed(2)}</p>
                <p className="text-indigo-200 text-xs mt-1">
                  {t('dashboard.purchaseRenewal')}
                </p>
              </div>
              <Database className="h-8 w-8 text-indigo-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">ROI</p>
                <p className="text-3xl font-bold">{stats.roi.toFixed(1)}%</p>
                <p className="text-orange-200 text-xs mt-1">
                  {t('common.profit')}: ${stats.totalProfit.toFixed(2)}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-200" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6 overflow-x-auto">
                <button 
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Activity className="h-4 w-4 inline mr-2" />
                {t('dashboard.overview')}
                </button>
              <button
                onClick={() => setActiveTab('domains')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'domains'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Globe className="h-4 w-4 inline mr-2" />
                {t('dashboard.domains')}
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'transactions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FileText className="h-4 w-4 inline mr-2" />
                {t('dashboard.transactions')}
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'analytics'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <PieChart className="h-4 w-4 inline mr-2" />
                {t('dashboard.analytics')}
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'alerts'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Bell className="h-4 w-4 inline mr-2" />
                {t('dashboard.alerts')}
                {expiringDomains.length > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {expiringDomains.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('marketplace')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'marketplace'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Globe className="h-4 w-4 inline mr-2" />
                {t('dashboard.marketplace')}
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Settings className="h-4 w-4 inline mr-2" />
                {t('dashboard.settings')}
              </button>
              <button
                onClick={() => setActiveTab('data')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'data'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Database className="h-4 w-4 inline mr-2" />
                {t('dashboard.data')}
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'reports'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BarChart3 className="h-4 w-4 inline mr-2" />
                {t('dashboard.reports')}
              </button>
            </nav>
              </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 分享按钮 */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowShareModal(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 flex items-center space-x-2 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Share2 className="h-5 w-5" />
                <span>{t('dashboard.shareResults')}</span>
              </button>
            </div>
            
            {/* 新增财务指标卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 p-6 rounded-lg shadow-lg text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-cyan-100 text-sm font-medium">{t('financial.totalSales')}</p>
                    <p className="text-3xl font-bold">{formatCurrencyEnhanced(enhancedFinancialMetrics.totalSales)}</p>
                    <p className="text-cyan-200 text-xs mt-1">
                      {t('financial.totalSalesDesc')}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-cyan-200" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg shadow-lg text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-100 text-sm font-medium">{t('financial.platformFees')}</p>
                    <p className="text-3xl font-bold">{formatCurrencyEnhanced(enhancedFinancialMetrics.totalPlatformFees)}</p>
                    <p className="text-red-200 text-xs mt-1">
                      {t('financial.platformFeesDesc')}
                    </p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-200" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-lg shadow-lg text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-100 text-sm font-medium">{t('financial.annualSales')}</p>
                    <p className="text-3xl font-bold">{formatCurrencyEnhanced(enhancedFinancialMetrics.annualSales)}</p>
                    <p className="text-emerald-200 text-xs mt-1">
                      {t('financial.annualSalesDesc')}
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-emerald-200" />
                </div>
              </div>

              <div className={`bg-gradient-to-br p-6 rounded-lg shadow-lg text-white ${enhancedFinancialMetrics.annualProfit >= 0 ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${enhancedFinancialMetrics.annualProfit >= 0 ? 'text-green-100' : 'text-red-100'}`}>{t('financial.annualProfit')}</p>
                    <p className="text-3xl font-bold">{formatCurrencyEnhanced(enhancedFinancialMetrics.annualProfit)}</p>
                    <p className={`text-xs mt-1 ${enhancedFinancialMetrics.annualProfit >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                      {t('financial.annualProfitDesc')}
                    </p>
                  </div>
                  <Target className={`h-8 w-8 ${enhancedFinancialMetrics.annualProfit >= 0 ? 'text-green-200' : 'text-red-200'}`} />
                </div>
              </div>
            </div>

            {/* 续费分析卡片 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('renewal.analysis')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                      <div>
                      <p className="text-sm font-medium text-blue-600">{t('renewal.thisYearCost')}</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {formatCurrencyEnhanced(renewalAnalysis.totalAnnualCost, 'USD')}
                      </p>
                      </div>
                    <Calendar className="h-8 w-8 text-blue-600" />
                    </div>
                    </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">{t('renewal.needRenewal')}</p>
                      <p className="text-2xl font-bold text-green-900">
                        {renewalAnalysis.domainsNeedingRenewal.length}
                      </p>
                    </div>
                    <Globe className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600">{t('renewal.noRenewal')}</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {renewalAnalysis.domainsNotNeedingRenewal.length}
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-purple-600" />
                  </div>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600">{t('renewal.averageCostPerDomain')}</p>
                      <p className="text-2xl font-bold text-orange-900">
                        {renewalAnalysis.domainsNeedingRenewal.length > 0 
                          ? formatCurrencyEnhanced(renewalAnalysis.totalAnnualCost / renewalAnalysis.domainsNeedingRenewal.length, 'USD')
                          : formatCurrencyEnhanced(0, 'USD')}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-orange-600" />
                  </div>
                </div>
              </div>
              
              {/* 续费周期分布 */}
              {Object.keys(renewalAnalysis.costByCycle).length > 0 && (
                <div className="mt-6">
                  <h4 className="text-md font-medium text-gray-900 mb-3">{t('renewal.cycleDistribution')}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(renewalAnalysis.costByCycle).map(([cycle, cost]) => (
                      <div key={cycle} className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">{cycle}</p>
                        <p className="text-lg font-semibold text-gray-900">{formatCurrencyEnhanced(cost, 'USD')}</p>
                  </div>
                ))}
                  </div>
              </div>
            )}
              
              {/* 续费优化建议 */}
              <div className="mt-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">{t('renewal.optimizationSuggestions')}</h4>
                <div className="space-y-2">
                  {getRenewalOptimizationSuggestions(renewalAnalysis).map((suggestion, index) => (
                    <div key={index} className="flex items-start space-x-2 p-3 bg-yellow-50 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-800">{suggestion}</p>
                    </div>
                  ))}
          </div>
        </div>
      </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{t('action.quickActions')}</h3>
                  <Zap className="h-5 w-5 text-yellow-500" />
                </div>
                <div className="space-y-3">
              <button
                  onClick={handleAddDomain}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('domain.add')}</span>
                  </button>
                  <button
                    onClick={handleAddTransaction}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center space-x-2"
                  >
                    <FileText className="h-4 w-4" />
                    <span>{t('transaction.add')}</span>
              </button>
            </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{t('dashboard.bestPerformance')}</h3>
                  <Award className="h-5 w-5 text-green-500" />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.bestPerformingDomain}</p>
                  <p className="text-sm text-gray-600 mt-1">{t('dashboard.bestInvestment')}</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{t('dashboard.needAttention')}</h3>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{expiringDomains.length}</p>
                  <p className="text-sm text-gray-600 mt-1">{t('dashboard.expiringSoon')}</p>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">{t('common.recentTransactions')}</h3>
              </div>
              <div className="p-6">
                {transactions.slice(0, 5).length > 0 ? (
            <div className="space-y-4">
                    {transactions.slice(0, 5).map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            transaction.type === 'buy' ? 'bg-blue-100' :
                            transaction.type === 'sell' ? 'bg-green-100' :
                            transaction.type === 'renew' ? 'bg-yellow-100' : 'bg-gray-100'
                          }`}>
                            {transaction.type === 'buy' ? <Plus className="h-4 w-4 text-blue-600" /> :
                             transaction.type === 'sell' ? <TrendingUp className="h-4 w-4 text-green-600" /> :
                             transaction.type === 'renew' ? <RefreshCw className="h-4 w-4 text-yellow-600" /> :
                             <FileText className="h-4 w-4 text-gray-600" />}
                          </div>
              <div>
                            <p className="font-medium text-gray-900">
                              {domains.find(d => d.id === transaction.domain_id)?.domain_name || 'Unknown Domain'}
                            </p>
                            <p className="text-sm text-gray-600">{transaction.type} - {transaction.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${
                            transaction.type === 'sell' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'sell' ? '+' : '-'}${transaction.amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>{t('common.noTransactions')}</p>
                    <button
                      onClick={handleAddTransaction}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                      {t('common.addFirstTransaction')}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Domain Expiry Alerts */}
            <LazyWrapper>
              <LazyDomainExpiryAlert 
                domains={domains} 
                onRenewDomain={handleRenewDomain}
              />
            </LazyWrapper>

          </div>
        )}

        {activeTab === 'domains' && (
          <div className="space-y-6">
            {/* Search and Filter */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                  type="text"
                      placeholder={t('common.searchDomains')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
                </div>
                <div className="flex gap-2">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">{t('common.allStatus')}</option>
                    <option value="active">{t('common.activeStatus')}</option>
                    <option value="for_sale">{t('common.forSaleStatus')}</option>
                    <option value="sold">{t('common.soldStatus')}</option>
                    <option value="expired">{t('common.expiredStatus')}</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="date">{t('common.sortByDate')}</option>
                    <option value="name">{t('common.sortByName')}</option>
                    <option value="value">{t('common.sortByValue')}</option>
                    <option value="cost">{t('common.sortByCost')}</option>
                  </select>
                  <button
                    onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    {viewMode === 'grid' ? <Eye className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </button>
                </div>
              </div>
            </div>

            <DomainList
              domains={sortedDomains}
              onEdit={handleEditDomain}
              onDelete={handleDeleteDomain}
              onView={handleViewDomain}
              onAdd={handleAddDomain}
                />
              </div>
        )}

        {activeTab === 'transactions' && (
          <TransactionList
            transactions={transactions}
            domains={domains}
            onEdit={handleEditTransaction}
            onDelete={handleDeleteTransaction}
            onAdd={handleAddTransaction}
          />
        )}

        {activeTab === 'analytics' && (
          <InvestmentAnalytics 
            domains={domains} 
            transactions={transactions} 
          />
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('common.expiringDomains')}</h3>
              {expiringDomains.length > 0 ? (
                <div className="space-y-4">
                  {expiringDomains.map((domain) => (
                    <div
                      key={domain.id}
                      className={`p-4 rounded-lg border-l-4 ${
                        domain.urgency === 'critical' 
                          ? 'border-red-500 bg-red-50' 
                          : domain.urgency === 'urgent' 
                          ? 'border-orange-500 bg-orange-50' 
                          : 'border-yellow-500 bg-yellow-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h4 className="text-lg font-medium text-gray-900">
                              {domain.domain_name}
                            </h4>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              domain.urgency === 'critical' 
                                ? 'bg-red-100 text-red-800' 
                                : domain.urgency === 'urgent' 
                                ? 'bg-orange-100 text-orange-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {domain.urgency === 'critical' ? t('common.critical') : 
                               domain.urgency === 'urgent' ? t('common.urgent') : t('common.normal')}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-gray-600">
                            <p>{t('common.daysUntilExpiry')}: {new Date(domain.expiry_date!).toLocaleDateString()}</p>
                            <p className="font-medium">
                              {domain.daysUntilExpiry === 0 
                                ? t('common.todayExpiry')
                                : domain.daysUntilExpiry < 0 
                                ? `${t('common.expiredDaysAgo')} ${Math.abs(domain.daysUntilExpiry)} ${t('common.daysLeft')}`
                                : `${t('common.daysLeftExpiry')} ${domain.daysUntilExpiry} ${t('common.daysLeftExpiryEnd')}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditDomain(domain)}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => {
                              // 这里可以添加续费逻辑
                              console.log('续费域名:', domain.domain_name);
                            }}
                            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            {t('common.renew')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>{t('common.noExpiringDomains')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'marketplace' && (
          <DomainMarketplace
            domains={[]} // TODO: 从市场数据API获取
            onLike={(id) => {
              console.log('Like domain:', id);
              auditLogger.log(user?.id || 'default', 'domain_liked', 'marketplace', { domainId: id });
            }}
            onWatch={(id) => {
              console.log('Watch domain:', id);
              auditLogger.log(user?.id || 'default', 'domain_watched', 'marketplace', { domainId: id });
            }}
            onContact={(id) => {
              console.log('Contact seller:', id);
              auditLogger.log(user?.id || 'default', 'seller_contacted', 'marketplace', { domainId: id });
            }}
            onQuickBuy={(id) => {
              console.log('Quick buy domain:', id);
              auditLogger.log(user?.id || 'default', 'quick_buy_initiated', 'marketplace', { domainId: id });
            }}
            onFilter={(filters) => console.log('Filter domains:', filters)}
            onSort={(sortBy) => console.log('Sort domains:', sortBy)}
          />
        )}

        {activeTab === 'settings' && (
          <UserPreferencesPanel />
        )}

        {activeTab === 'data' && (
          <DataImportExport
            onImport={(data: unknown) => {
              try {
                const importData = data as { domains?: Domain[]; transactions?: Transaction[] };
                let typedDomains = domains;
                let typedTransactions = transactions;
                
                if (importData.domains) {
                  typedDomains = importData.domains.map(ensureDomainWithTags);
                  setDomains(typedDomains);
                  domainCache.cacheDomains(user?.id || 'default', importData.domains);
                }
                if (importData.transactions) {
                  typedTransactions = importData.transactions.map(ensureTransactionWithRequiredFields);
                  setTransactions(typedTransactions);
                  domainCache.cacheTransactions(user?.id || 'default', importData.transactions);
                }
                // Save imported data to Supabase database
                saveData(typedDomains, typedTransactions);
                auditLogger.log(user?.id || 'default', 'data_imported', 'dashboard', { 
                  domainsCount: importData.domains?.length || 0,
                  transactionsCount: importData.transactions?.length || 0
                });
                console.log(t('common.dataImportedSuccessfully'));
              } catch (error) {
                console.error('Import failed:', error);
                setError(t('common.dataImportFailed'));
                auditLogger.log(user?.id || 'default', 'data_import_failed', 'dashboard', { error: (error as Error).message });
              }
            }}
            onExport={(format) => {
              try {
                const data = {
                  domains,
                  transactions,
                  exportDate: new Date().toISOString(),
                  version: '1.0'
                };
                
                if (format === 'json') {
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `66do-backup-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                } else if (format === 'csv') {
                  // TODO: Implement CSV export
                  console.log('CSV export not yet implemented');
                }
                
                auditLogger.log(user?.id || 'default', 'data_exported', 'dashboard', { format, dataSize: JSON.stringify(data).length });
                console.log(t('common.dataExportedSuccessfully'));
              } catch (error) {
                console.error('Export failed:', error);
                setError(t('common.dataExportFailed'));
                auditLogger.log(user?.id || 'default', 'data_export_failed', 'dashboard', { error: (error as Error).message });
              }
            }}
            onBackup={() => {
              try {
                const backup = {
                  domains,
                  transactions,
                  backupDate: new Date().toISOString(),
                  version: '1.0'
                };
                // Backup data to Supabase database (implement backup API if needed)
                console.log('Backup created:', backup);
                auditLogger.log(user?.id || 'default', 'data_backed_up', 'dashboard', { 
                  domainsCount: domains.length,
                  transactionsCount: transactions.length
                });
                console.log(t('common.dataBackedUpSuccessfully'));
              } catch (error) {
                console.error('Backup failed:', error);
                setError(t('common.dataBackupFailed'));
                auditLogger.log(user?.id || 'default', 'data_backup_failed', 'dashboard', { error: (error as Error).message });
              }
            }}
            onRestore={(backup: unknown) => {
              try {
                const restoreData = backup as { domains?: Domain[]; transactions?: Transaction[] };
                let typedDomains = domains;
                let typedTransactions = transactions;
                
                if (restoreData.domains) {
                  typedDomains = restoreData.domains.map(ensureDomainWithTags);
                  setDomains(typedDomains);
                  domainCache.cacheDomains(user?.id || 'default', restoreData.domains);
                }
                if (restoreData.transactions) {
                  typedTransactions = restoreData.transactions.map(ensureTransactionWithRequiredFields);
                  setTransactions(typedTransactions);
                  domainCache.cacheTransactions(user?.id || 'default', restoreData.transactions);
                }
                // Save restored data to Supabase database
                saveData(typedDomains, typedTransactions);
                auditLogger.log(user?.id || 'default', 'data_restored', 'dashboard', { 
                  domainsCount: restoreData.domains?.length || 0,
                  transactionsCount: restoreData.transactions?.length || 0
                });
                console.log(t('common.dataRestoredSuccessfully'));
              } catch (error) {
                console.error('Restore failed:', error);
                setError(t('common.dataRestoreFailed'));
                auditLogger.log(user?.id || 'default', 'data_restore_failed', 'dashboard', { error: (error as Error).message });
              }
            }}
          />
        )}
        
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* 报告类型选择器 */}
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('common.financialReports')}</h3>
                <div className="flex items-center space-x-4">
                  <select
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as 'grid' | 'list')}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="grid">{t('common.gridView')}</option>
                    <option value="list">{t('common.listView')}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 综合财务报告 */}
            <FinancialReport
              domains={domains}
              transactions={transactions}
            />

            {/* 投资分析 */}
            <FinancialAnalysis
              domains={domains}
              transactions={transactions}
            />
          </div>
        )}
        </div>

      {/* Domain Form Modal */}
      <DomainForm
        domain={editingDomain}
        isOpen={showDomainForm}
        onClose={() => {
          setShowDomainForm(false);
          setEditingDomain(undefined);
        }}
        onSave={handleSaveDomain}
      />

      {/* Smart Domain Form Modal */}
      <SmartDomainForm
        domain={editingDomain}
        isOpen={showSmartDomainForm}
        onClose={() => {
          setShowSmartDomainForm(false);
          setEditingDomain(undefined);
        }}
        onSave={handleSaveDomain}
      />

      {/* Transaction Form Modal */}
      <TransactionForm
        transaction={editingTransaction}
        domains={domains}
        isOpen={showTransactionForm}
        onClose={() => {
          setShowTransactionForm(false);
          setEditingTransaction(undefined);
        }}
        onSave={handleSaveTransaction}
        onSaleComplete={handleSaleComplete}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        shareData={calculateShareData()}
      />

      {/* Sale Success Modal */}
      {saleSuccessData && (
        <SaleSuccessModal
          isOpen={showSaleSuccessModal}
          onClose={() => {
            setShowSaleSuccessModal(false);
            setSaleSuccessData(null);
          }}
          domain={saleSuccessData.domain}
          transaction={saleSuccessData.transaction}
        />
      )}

      {/* Data Source Indicator */}
      {dataSource && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm">
          {t('common.dataSource')}: {dataSource === 'supabase' ? t('common.cloudDatabase') : t('common.cache')}
        </div>
      )}

      {/* Mobile Components */}
      {isMobile() && (
        <>
          <TouchGestures onSwipeLeft={() => setActiveTab('domains')} onSwipeRight={() => setActiveTab('overview')}>
            <div></div>
          </TouchGestures>
          <PullToRefresh onRefresh={async () => window.location.reload()}>
            <div></div>
          </PullToRefresh>
        </>
      )}

      {/* Mobile Navigation */}
      <MobileNavigation 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        expiringCount={expiringDomains.length}
      />
    </div>
  );
}
