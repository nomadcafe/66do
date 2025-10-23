'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../src/contexts/AuthContext';
import { useI18nContext } from '../../src/contexts/I18nProvider';
import DomainList from '../../src/components/domain/DomainList';
import DomainForm from '../../src/components/domain/DomainForm';
import TransactionList from '../../src/components/transaction/TransactionList';
import TransactionForm from '../../src/components/transaction/TransactionForm';
import InvestmentAnalytics from '../../src/components/analytics/InvestmentAnalytics';
import UserPreferencesPanel from '../../src/components/settings/UserPreferencesPanel';
import DomainMarketplace from '../../src/components/marketplace/DomainMarketplace';
import DataImportExport from '../../src/components/data/DataImportExport';
import { LazyDomainExpiryAlert, LazyDomainValueTracker, LazyWrapper } from '../../src/components/LazyComponents';
import MobileNavigation from '../../src/components/layout/MobileNavigation';
import ResponsiveGrid from '../../src/components/layout/ResponsiveGrid';
import MobileCard from '../../src/components/ui/MobileCard';
import AutoDomainMonitor from '../../src/components/monitoring/AutoDomainMonitor';
// Mobile components imported but not used yet
// import TouchGestures from '../../src/components/mobile/TouchGestures';
// import PullToRefresh from '../../src/components/mobile/PullToRefresh';
// import { isMobile, getDeviceType } from '../../src/lib/utils';
import FinancialReport from '../../src/components/reports/FinancialReport';
import FinancialAnalysis from '../../src/components/reports/FinancialAnalysisOptimized';
import ShareModal from '../../src/components/share/ShareModal';
import SaleSuccessModal from '../../src/components/share/SaleSuccessModal';
import { calculateAnnualRenewalCost, getRenewalOptimizationSuggestions } from '../../src/lib/renewalCalculations';
import { calculateFinancialMetrics } from '../../src/lib/financialMetrics';
import { calculateEnhancedFinancialMetrics, formatCurrency as formatCurrencyEnhanced } from '../../src/lib/enhancedFinancialMetrics';
import { domainCache } from '../../src/lib/cache';
import { auditLogger } from '../../src/lib/security';
import LoadingSpinner from '../../src/components/ui/LoadingSpinner';
import ErrorMessage from '../../src/components/ui/ErrorMessage';
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

interface Domain {
  id: string;
  domain_name: string;
  registrar: string;
  purchase_date: string;
  purchase_cost: number;
  renewal_cost: number;
  renewal_cycle: number; // 续费周期（年数）：1, 2, 3等
  renewal_count: number; // 已续费次数
  next_renewal_date?: string;
  expiry_date?: string; // 改为可选字段
  status: 'active' | 'for_sale' | 'sold' | 'expired';
  estimated_value: number;
  sale_date?: string; // 出售日期
  sale_price?: number; // 出售价格
  platform_fee?: number; // 平台手续费
  tags: string[];
}

interface Transaction {
  id: string;
  domain_id: string;
  type: 'buy' | 'renew' | 'sell' | 'transfer' | 'fee' | 'marketing' | 'advertising';
  amount: number;
  currency: string;
  exchange_rate?: number; // 汇率
  base_amount?: number; // 基础货币金额
  platform_fee?: number; // 平台手续费
  platform_fee_percentage?: number; // 手续费百分比
  net_amount?: number; // 净收入
  date: string;
  notes: string;
  platform?: string;
  category?: string; // 交易分类
  tax_deductible?: boolean; // 是否可抵税
  receipt_url?: string; // 收据链接
}

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
  const [domains, setDomains] = useState<Domain[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
  const [activeTab, setActiveTab] = useState<'overview' | 'domains' | 'transactions' | 'analytics' | 'alerts' | 'marketplace' | 'settings' | 'data' | 'reports'>('overview');
  
  // 计算续费分析
  const renewalAnalysis = useMemo(() => {
    return calculateAnnualRenewalCost(domains);
  }, [domains]);
  
  // 计算财务指标
  
  // 计算增强的财务指标
  const enhancedFinancialMetrics = useMemo(() => {
    return calculateEnhancedFinancialMetrics(domains, transactions);
  }, [domains, transactions]);
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | undefined>();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSaleSuccessModal, setShowSaleSuccessModal] = useState(false);
  const [saleSuccessData, setSaleSuccessData] = useState<{domain: Domain, transaction: Transaction} | null>(null);
  const { user, signOut } = useAuth();
  const { t, locale, setLocale } = useI18nContext();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // Load data from localStorage with caching and error handling
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Try to get cached data first
        const userId = user?.id || 'default';
        const cachedDomains = domainCache.getCachedDomains(userId);
        const cachedTransactions = domainCache.getCachedTransactions(userId);
        
        if (cachedDomains && cachedTransactions) {
          setDomains(cachedDomains as Domain[]);
          setTransactions(cachedTransactions as Transaction[]);
          setLoading(false);
          return;
        }

        // Load from localStorage
        const savedDomains = localStorage.getItem('66do_domains');
        if (savedDomains) {
          const parsedDomains = JSON.parse(savedDomains);
          if (Array.isArray(parsedDomains)) {
            setDomains(parsedDomains);
            domainCache.cacheDomains(userId, parsedDomains);
          }
        }

        const savedTransactions = localStorage.getItem('66do_transactions');
        if (savedTransactions) {
          const parsedTransactions = JSON.parse(savedTransactions);
          if (Array.isArray(parsedTransactions)) {
            setTransactions(parsedTransactions);
            domainCache.cacheTransactions(userId, parsedTransactions);
          }
        }
        
        // Log successful data load
        auditLogger.log(userId, 'data_loaded', 'dashboard', { 
          domainsCount: domains.length, 
          transactionsCount: transactions.length 
        });
        
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load data. Please refresh the page.');
        auditLogger.log(user?.id || 'default', 'data_load_failed', 'dashboard', { error: (error as Error).message });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, domains.length, transactions.length]);

  // Update stats when domains change
  useEffect(() => {
    // 使用新的财务指标计算
    const financialMetrics = calculateFinancialMetrics(domains, transactions);
    
    const totalDomains = financialMetrics.totalDomains;
    const totalCost = financialMetrics.totalInvestment;
    const totalRevenue = financialMetrics.totalRevenue;
    const totalRenewalCost = financialMetrics.totalRenewalCost;
    const totalHoldingCost = financialMetrics.totalHoldingCost;
    const totalProfit = financialMetrics.totalProfit;
    const roi = financialMetrics.roi;
    
    // 计算年度续费成本（使用新的准确计算逻辑）
    const renewalAnalysis = calculateAnnualRenewalCost(domains);
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
    setShowDomainForm(true);
  };

  const handleEditDomain = (domain: Domain) => {
    setEditingDomain(domain);
    setShowDomainForm(true);
  };

  const handleDeleteDomain = (id: string) => {
    const updatedDomains = domains.filter(domain => domain.id !== id);
    setDomains(updatedDomains);
    localStorage.setItem('66do_domains', JSON.stringify(updatedDomains));
    
    // Also remove related transactions
    const updatedTransactions = transactions.filter(transaction => transaction.domain_id !== id);
    setTransactions(updatedTransactions);
    localStorage.setItem('66do_transactions', JSON.stringify(updatedTransactions));
  };

  const handleSaveDomain = (domainData: Omit<Domain, 'id'>) => {
    if (editingDomain) {
      // Update existing domain
      const updatedDomains = domains.map(domain => 
        domain.id === editingDomain.id 
          ? { ...domainData, id: editingDomain.id }
          : domain
      );
      setDomains(updatedDomains);
      localStorage.setItem('66do_domains', JSON.stringify(updatedDomains));
    } else {
      // Add new domain
      const newDomain: Domain = {
        ...domainData,
        id: Date.now().toString()
      };
      const updatedDomains = [...domains, newDomain];
      setDomains(updatedDomains);
      localStorage.setItem('66do_domains', JSON.stringify(updatedDomains));
    }
    setShowDomainForm(false);
    setEditingDomain(undefined);
  };

  const handleViewDomain = (domain: Domain) => {
    // TODO: Implement domain details view
    console.log('View domain:', domain);
  };

  // Transaction management functions
  const handleAddTransaction = () => {
    setEditingTransaction(undefined);
    setShowTransactionForm(true);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowTransactionForm(true);
  };

  const handleDeleteTransaction = (id: string) => {
    const updatedTransactions = transactions.filter(transaction => transaction.id !== id);
    setTransactions(updatedTransactions);
    localStorage.setItem('66do_transactions', JSON.stringify(updatedTransactions));
  };

  // 处理域名续费
  const handleRenewDomain = (domainId: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) return;

    const renewalTransaction: Transaction = {
      id: Date.now().toString(),
      domain_id: domainId,
      type: 'renew',
      amount: domain.renewal_cost,
      currency: 'USD',
      date: new Date().toISOString().split('T')[0],
      notes: `域名 ${domain.domain_name} 续费 ${domain.renewal_cycle} 年`,
      platform: domain.registrar
    };

    const newTransactions = [...transactions, renewalTransaction];
    setTransactions(newTransactions);
    localStorage.setItem('66do_transactions', JSON.stringify(newTransactions));

    // 更新域名到期日期
    if (!domain.expiry_date) return; // 如果没有到期日期，跳过更新
    
    const newExpiryDate = new Date(domain.expiry_date);
    newExpiryDate.setFullYear(newExpiryDate.getFullYear() + domain.renewal_cycle);
    
    const updatedDomains = domains.map(d => 
      d.id === domainId 
        ? { ...d, expiry_date: newExpiryDate.toISOString().split('T')[0] }
        : d
    );
    setDomains(updatedDomains);
    localStorage.setItem('66do_domains', JSON.stringify(updatedDomains));
  };

  // 处理域名价值更新
  const handleUpdateDomainValue = (domainId: string, newValue: number) => {
    const updatedDomains = domains.map(d => 
      d.id === domainId 
        ? { ...d, estimated_value: newValue }
        : d
    );
    setDomains(updatedDomains);
    localStorage.setItem('66do_domains', JSON.stringify(updatedDomains));
  };

  const handleSaveTransaction = (transactionData: Omit<Transaction, 'id'>) => {
    if (editingTransaction) {
      // Update existing transaction
      const updatedTransactions = transactions.map(transaction => 
        transaction.id === editingTransaction.id 
          ? { ...transactionData, id: editingTransaction.id }
          : transaction
      );
      setTransactions(updatedTransactions);
      localStorage.setItem('66do_transactions', JSON.stringify(updatedTransactions));
    } else {
      // Add new transaction
      const newTransaction: Transaction = {
        ...transactionData,
        id: Date.now().toString()
      };
      const updatedTransactions = [...transactions, newTransaction];
      setTransactions(updatedTransactions);
      localStorage.setItem('66do_transactions', JSON.stringify(updatedTransactions));
      
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
      localStorage.setItem('66do_domains', JSON.stringify(updatedDomains));
      
      // 显示成功消息
      console.log(`域名状态已自动更新为"已出售"`);
    }
  };

  // 处理出售交易完成后的分享
  const handleSaleComplete = (transaction: Omit<Transaction, 'id'>, domain: Domain) => {
    // 创建完整的Transaction对象
    const fullTransaction: Transaction = {
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
      const totalHoldingCost = domain.purchase_cost + (domain.renewal_count * domain.renewal_cost);
      const platformFee = domain.platform_fee || 0;
      return sum + (domain.sale_price || 0) - totalHoldingCost - platformFee;
    }, 0);
    
    const totalInvestment = domains.reduce((sum, domain) => {
      return sum + domain.purchase_cost + (domain.renewal_count * domain.renewal_cost);
    }, 0);
    
    const roi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
    
    const bestDomain = soldDomains.reduce((best, domain) => {
      const domainProfit = (domain.sale_price || 0) - domain.purchase_cost - (domain.renewal_count * domain.renewal_cost) - (domain.platform_fee || 0);
      const bestProfit = (best.sale_price || 0) - best.purchase_cost - (best.renewal_count * best.renewal_cost) - (best.platform_fee || 0);
      return domainProfit > bestProfit ? domain : best;
    }, soldDomains[0] || { domain_name: 'N/A' });
    
    const investmentPeriod = domains.length > 0 ? 
      `${Math.ceil((new Date().getTime() - new Date(Math.min(...domains.map(d => new Date(d.purchase_date).getTime()))).getTime()) / (1000 * 60 * 60 * 24 * 30))}个月` : 
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
                         domain.registrar.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || domain.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Sort domains
  const sortedDomains = [...filteredDomains].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.domain_name.localeCompare(b.domain_name);
      case 'date':
        return new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime();
      case 'value':
        return b.estimated_value - a.estimated_value;
      case 'cost':
        return b.purchase_cost - a.purchase_cost;
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Header */}
      <div className="hidden lg:block bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('platform.name')}</h1>
              <p className="mt-2 text-gray-600">{t('dashboard.title')}</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Language Selector */}
              <div className="relative">
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as 'en' | 'zh')}
                  className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <User size={20} />
                <span>{user?.email}</span>
              </div>
              <button
                onClick={handleAddDomain}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Plus size={20} />
                <span>{t('dashboard.addInvestment')}</span>
              </button>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-800 flex items-center space-x-2"
              >
                <LogOut size={20} />
                <span>{t('dashboard.signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{t('platform.name')}</h1>
                <p className="text-xs text-gray-600">{t('dashboard.title')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddDomain}
                className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"
              >
                <Plus size={18} />
              </button>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-800 p-2"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <ResponsiveGrid 
          cols={{ default: 1, sm: 2, lg: 4 }} 
          gap="lg" 
          className="mb-8"
        >
          <MobileCard>
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Globe className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{t('dashboard.totalInvestments')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalDomains}</p>
              </div>
            </div>
          </MobileCard>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{t('dashboard.totalCost')}</p>
                <p className="text-2xl font-bold text-gray-900">${stats.totalCost.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{t('dashboard.totalRevenue')}</p>
                <p className="text-2xl font-bold text-gray-900">${stats.totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">ROI</p>
                <p className="text-2xl font-bold text-gray-900">{stats.roi.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </ResponsiveGrid>

        {/* Auto Domain Monitor */}
        <div className="mb-8">
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

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">总域名数</p>
                <p className="text-3xl font-bold">{stats.totalDomains}</p>
                <p className="text-blue-200 text-xs mt-1">
                  活跃: {stats.activeDomains} | 出售: {stats.forSaleDomains}
                </p>
          </div>
              <Globe className="h-8 w-8 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">总投资</p>
                <p className="text-3xl font-bold">${stats.totalCost.toFixed(2)}</p>
                <p className="text-green-200 text-xs mt-1">
                  平均: ${stats.avgPurchasePrice.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">总收益</p>
                <p className="text-3xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
                <p className="text-purple-200 text-xs mt-1">
                  平均售价: ${stats.avgSalePrice.toFixed(2)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm font-medium">续费成本</p>
                <p className="text-3xl font-bold">${stats.totalRenewalCost.toFixed(2)}</p>
                <p className="text-yellow-200 text-xs mt-1">
                  年度成本: ${stats.annualRenewalCost.toFixed(2)}
                </p>
              </div>
              <RefreshCw className="h-8 w-8 text-yellow-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm font-medium">总持有成本</p>
                <p className="text-3xl font-bold">${stats.totalHoldingCost.toFixed(2)}</p>
                <p className="text-indigo-200 text-xs mt-1">
                  购买 + 续费
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
                  利润: ${stats.totalProfit.toFixed(2)}
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
                <span>分享投资成果</span>
              </button>
            </div>
            
            {/* 新增财务指标卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 p-6 rounded-lg shadow-lg text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-cyan-100 text-sm font-medium">总销售额</p>
                    <p className="text-3xl font-bold">{formatCurrencyEnhanced(enhancedFinancialMetrics.totalSales)}</p>
                    <p className="text-cyan-200 text-xs mt-1">
                      未扣除任何费用
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-cyan-200" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg shadow-lg text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-100 text-sm font-medium">平台手续费</p>
                    <p className="text-3xl font-bold">{formatCurrencyEnhanced(enhancedFinancialMetrics.totalPlatformFees)}</p>
                    <p className="text-red-200 text-xs mt-1">
                      总手续费
                    </p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-200" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-lg shadow-lg text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-100 text-sm font-medium">年度销售额</p>
                    <p className="text-3xl font-bold">{formatCurrencyEnhanced(enhancedFinancialMetrics.annualSales)}</p>
                    <p className="text-emerald-200 text-xs mt-1">
                      今年销售额
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-emerald-200" />
                </div>
              </div>

              <div className={`bg-gradient-to-br p-6 rounded-lg shadow-lg text-white ${enhancedFinancialMetrics.annualProfit >= 0 ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${enhancedFinancialMetrics.annualProfit >= 0 ? 'text-green-100' : 'text-red-100'}`}>年度净利润</p>
                    <p className="text-3xl font-bold">{formatCurrencyEnhanced(enhancedFinancialMetrics.annualProfit)}</p>
                    <p className={`text-xs mt-1 ${enhancedFinancialMetrics.annualProfit >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                      扣除所有成本后
                    </p>
                  </div>
                  <Target className={`h-8 w-8 ${enhancedFinancialMetrics.annualProfit >= 0 ? 'text-green-200' : 'text-red-200'}`} />
                </div>
              </div>
            </div>

            {/* 续费分析卡片 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">年度续费分析</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                      <div>
                      <p className="text-sm font-medium text-blue-600">今年续费成本</p>
                      <p className="text-2xl font-bold text-blue-900">
                        ¥{renewalAnalysis.totalAnnualCost.toLocaleString()}
                      </p>
                      </div>
                    <Calendar className="h-8 w-8 text-blue-600" />
                    </div>
                    </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">需要续费域名</p>
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
                      <p className="text-sm font-medium text-purple-600">无需续费域名</p>
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
                      <p className="text-sm font-medium text-orange-600">平均成本/域名</p>
                      <p className="text-2xl font-bold text-orange-900">
                        ¥{renewalAnalysis.domainsNeedingRenewal.length > 0 
                          ? (renewalAnalysis.totalAnnualCost / renewalAnalysis.domainsNeedingRenewal.length).toFixed(0)
                          : '0'}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-orange-600" />
                  </div>
                </div>
              </div>
              
              {/* 续费周期分布 */}
              {Object.keys(renewalAnalysis.costByCycle).length > 0 && (
                <div className="mt-6">
                  <h4 className="text-md font-medium text-gray-900 mb-3">续费周期分布</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(renewalAnalysis.costByCycle).map(([cycle, cost]) => (
                      <div key={cycle} className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">{cycle}</p>
                        <p className="text-lg font-semibold text-gray-900">¥{cost.toLocaleString()}</p>
                  </div>
                ))}
                  </div>
              </div>
            )}
              
              {/* 续费优化建议 */}
              <div className="mt-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">续费优化建议</h4>
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
                  <h3 className="text-lg font-semibold text-gray-900">最佳表现</h3>
                  <Award className="h-5 w-5 text-green-500" />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.bestPerformingDomain}</p>
                  <p className="text-sm text-gray-600 mt-1">最佳投资域名</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">需要关注</h3>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{expiringDomains.length}</p>
                  <p className="text-sm text-gray-600 mt-1">即将到期</p>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">最近交易</h3>
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
                    <p>暂无交易记录</p>
                    <button
                      onClick={handleAddTransaction}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                      添加第一笔交易
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

            {/* Domain Value Tracker */}
            <LazyWrapper>
              <LazyDomainValueTracker 
                domains={domains} 
                onUpdateValue={handleUpdateDomainValue}
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
                      placeholder="搜索域名..."
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
                    <option value="all">所有状态</option>
                    <option value="active">活跃</option>
                    <option value="for_sale">出售中</option>
                    <option value="sold">已售出</option>
                    <option value="expired">已过期</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="date">按日期</option>
                    <option value="name">按名称</option>
                    <option value="value">按价值</option>
                    <option value="cost">按成本</option>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">即将到期的域名</h3>
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
                              {domain.urgency === 'critical' ? '紧急' : 
                               domain.urgency === 'urgent' ? '紧急' : '正常'}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-gray-600">
                            <p>到期日期: {new Date(domain.expiry_date!).toLocaleDateString()}</p>
                            <p className="font-medium">
                              {domain.daysUntilExpiry === 0 
                                ? '今天到期' 
                                : domain.daysUntilExpiry < 0 
                                ? `已过期 ${Math.abs(domain.daysUntilExpiry)} 天`
                                : `还有 ${domain.daysUntilExpiry} 天到期`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditDomain(domain)}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => {
                              // 这里可以添加续费逻辑
                              console.log('续费域名:', domain.domain_name);
                            }}
                            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            续费
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>暂无即将到期的域名</p>
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
                if (importData.domains) {
                  setDomains(importData.domains);
                  localStorage.setItem('66do_domains', JSON.stringify(importData.domains));
                  domainCache.cacheDomains(user?.id || 'default', importData.domains);
                }
                if (importData.transactions) {
                  setTransactions(importData.transactions);
                  localStorage.setItem('66do_transactions', JSON.stringify(importData.transactions));
                  domainCache.cacheTransactions(user?.id || 'default', importData.transactions);
                }
                auditLogger.log(user?.id || 'default', 'data_imported', 'dashboard', { 
                  domainsCount: importData.domains?.length || 0,
                  transactionsCount: importData.transactions?.length || 0
                });
                console.log('Data imported successfully');
              } catch (error) {
                console.error('Import failed:', error);
                setError('Failed to import data');
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
                console.log('Data exported successfully');
              } catch (error) {
                console.error('Export failed:', error);
                setError('Failed to export data');
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
                localStorage.setItem('66do_backup', JSON.stringify(backup));
                auditLogger.log(user?.id || 'default', 'data_backed_up', 'dashboard', { 
                  domainsCount: domains.length,
                  transactionsCount: transactions.length
                });
                console.log('Data backed up successfully');
              } catch (error) {
                console.error('Backup failed:', error);
                setError('Failed to backup data');
                auditLogger.log(user?.id || 'default', 'data_backup_failed', 'dashboard', { error: (error as Error).message });
              }
            }}
            onRestore={(backup: unknown) => {
              try {
                const restoreData = backup as { domains?: Domain[]; transactions?: Transaction[] };
                if (restoreData.domains) {
                  setDomains(restoreData.domains);
                  localStorage.setItem('66do_domains', JSON.stringify(restoreData.domains));
                  domainCache.cacheDomains(user?.id || 'default', restoreData.domains);
                }
                if (restoreData.transactions) {
                  setTransactions(restoreData.transactions);
                  localStorage.setItem('66do_transactions', JSON.stringify(restoreData.transactions));
                  domainCache.cacheTransactions(user?.id || 'default', restoreData.transactions);
                }
                auditLogger.log(user?.id || 'default', 'data_restored', 'dashboard', { 
                  domainsCount: restoreData.domains?.length || 0,
                  transactionsCount: restoreData.transactions?.length || 0
                });
                console.log('Data restored successfully');
              } catch (error) {
                console.error('Restore failed:', error);
                setError('Failed to restore data');
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
                <h3 className="text-lg font-semibold text-gray-900">财务报告</h3>
                <div className="flex items-center space-x-4">
                  <select
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as 'grid' | 'list')}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="grid">网格视图</option>
                    <option value="list">列表视图</option>
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

      {/* Mobile Navigation */}
      <MobileNavigation 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        expiringCount={expiringDomains.length}
      />
    </div>
  );
}
