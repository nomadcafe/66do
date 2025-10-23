'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import DomainList from '../../src/components/domain/DomainList';
import DomainForm from '../../src/components/domain/DomainForm';
import TransactionList from '../../src/components/transaction/TransactionList';
import TransactionForm from '../../src/components/transaction/TransactionForm';
import DomainPerformanceChart from '../../src/components/charts/DomainPerformanceChart';
import UserPreferencesPanel from '../../src/components/settings/UserPreferencesPanel';
import DomainMarketplace from '../../src/components/marketplace/DomainMarketplace';
import DataImportExport from '../../src/components/data/DataImportExport';
import { 
  Globe, 
  Plus, 
  DollarSign, 
  TrendingUp, 
  BarChart3, 
  LogOut, 
  User, 
  FileText,
  AlertTriangle,
  Calendar,
  Award,
  PieChart,
  Activity,
  Bell,
  Settings,
  Eye,
  Search,
  RefreshCw,
  Zap,
  CheckCircle,
  XCircle,
  Info,
  List,
  Database
} from 'lucide-react';

interface Domain {
  id: string;
  domain_name: string;
  registrar: string;
  purchase_date: string;
  purchase_cost: number;
  renewal_cost: number;
  next_renewal_date?: string;
  expiry_date: string;
  status: 'active' | 'for_sale' | 'sold' | 'expired';
  estimated_value: number;
  tags: string[];
}

interface Transaction {
  id: string;
  domain_id: string;
  type: 'buy' | 'renew' | 'sell' | 'transfer' | 'fee';
  amount: number;
  currency: string;
  date: string;
  notes: string;
  platform?: string;
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
}

interface Alert {
  id: string;
  type: 'renewal' | 'expiry' | 'price_drop' | 'sale_opportunity' | 'sale';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
  domain_name?: string;
  date?: string;
}

interface ChartData {
  month: string;
  domains: number;
  cost: number;
  revenue: number;
  profit: number;
}

interface PerformanceData {
  domain_name: string;
  purchase_price: number;
  current_value: number;
  profit_loss: number;
  roi_percentage: number;
  days_held: number;
}

export default function DashboardPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
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
    worstPerformingDomain: ''
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'domains' | 'transactions' | 'analytics' | 'alerts' | 'marketplace' | 'settings' | 'data'>('overview');
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | undefined>();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // Load data from localStorage
  useEffect(() => {
    const loadData = () => {
      try {
        const savedDomains = localStorage.getItem('66do_domains');
        if (savedDomains) {
          const parsedDomains = JSON.parse(savedDomains);
          if (Array.isArray(parsedDomains)) {
            setDomains(parsedDomains);
          }
        }

        const savedTransactions = localStorage.getItem('66do_transactions');
        if (savedTransactions) {
          const parsedTransactions = JSON.parse(savedTransactions);
          if (Array.isArray(parsedTransactions)) {
            setTransactions(parsedTransactions);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Update stats when domains change
  useEffect(() => {
    const totalDomains = domains.length;
    const totalCost = domains.reduce((sum, domain) => sum + domain.purchase_cost, 0);
    const totalRevenue = transactions.filter(t => t.type === 'sell').reduce((sum, t) => sum + t.amount, 0);
    const totalProfit = totalRevenue - totalCost;
    const roi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    
    const activeDomains = domains.filter(d => d.status === 'active').length;
    const forSaleDomains = domains.filter(d => d.status === 'for_sale').length;
    const soldDomains = domains.filter(d => d.status === 'sold').length;
    const expiredDomains = domains.filter(d => d.status === 'expired').length;
    
    const avgPurchasePrice = totalDomains > 0 ? totalCost / totalDomains : 0;
    const avgSalePrice = soldDomains > 0 ? totalRevenue / soldDomains : 0;
    
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
      worstPerformingDomain: worstPerforming.domain.domain_name
    });
  }, [domains, transactions]);

  // Generate alerts function
  const generateAlerts = useCallback(() => {
    const newAlerts: Alert[] = [];
    
    // 域名续费提醒
    domains.forEach(domain => {
      const daysUntilExpiry = Math.ceil((new Date(domain.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
        newAlerts.push({
          id: `renewal-${domain.id}`,
          type: 'renewal',
          title: '域名即将到期',
          message: `${domain.domain_name} 将在 ${daysUntilExpiry} 天后到期`,
          timestamp: new Date().toISOString(),
          read: false,
          priority: daysUntilExpiry <= 7 ? 'high' : 'medium'
        });
      }
    });
    
    // 交易提醒
    transactions.forEach(transaction => {
      if (transaction.type === 'sell' && transaction.amount > 1000) {
        const domain = domains.find(d => d.id === transaction.domain_id);
        if (domain) {
          newAlerts.push({
            id: `sale-${transaction.id}`,
            type: 'sale',
            title: '域名售出',
            message: `恭喜！${domain.domain_name} 以 $${transaction.amount} 售出`,
            timestamp: transaction.date,
            read: false,
            priority: 'high'
          });
        }
      }
    });
    
    setAlerts(newAlerts);
  }, [domains, transactions]);

  // Generate chart data function
  const generateChartData = useCallback(() => {
    const monthlyData: ChartData[] = [];
    const currentDate = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const month = date.toLocaleDateString('zh-CN', { month: 'short' });
      
      const monthDomains = domains.filter(domain => {
        const domainDate = new Date(domain.purchase_date);
        return domainDate.getMonth() === date.getMonth() && domainDate.getFullYear() === date.getFullYear();
      });
      
      const monthTransactions = transactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return transactionDate.getMonth() === date.getMonth() && transactionDate.getFullYear() === date.getFullYear();
      });
      
      const cost = monthDomains.reduce((sum, domain) => sum + domain.purchase_cost, 0);
      const revenue = monthTransactions.filter(t => t.type === 'sell').reduce((sum, t) => sum + t.amount, 0);
      
      monthlyData.push({
        month,
        domains: monthDomains.length,
        cost,
        revenue,
        profit: revenue - cost
      });
    }
    
    setChartData(monthlyData);
  }, [domains, transactions]);

  // Generate performance data function
  const generatePerformanceData = useCallback(() => {
    const performance: PerformanceData[] = domains.map(domain => {
      const purchaseDate = new Date(domain.purchase_date);
      const daysHeld = Math.ceil((Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // 模拟当前价值（实际应用中应该从API获取）
      const currentValue = domain.purchase_cost * (1 + Math.random() * 0.5 - 0.25);
      const profitLoss = currentValue - domain.purchase_cost;
      const roiPercentage = (profitLoss / domain.purchase_cost) * 100;
      
      return {
        domain_name: domain.domain_name,
        purchase_price: domain.purchase_cost,
        current_value: currentValue,
        profit_loss: profitLoss,
        roi_percentage: roiPercentage,
        days_held: daysHeld
      };
    });
    
    setPerformanceData(performance);
  }, [domains]);

  // Generate alerts, chart data, and performance data when data changes
  useEffect(() => {
    generateAlerts();
    generateChartData();
    generatePerformanceData();
  }, [generateAlerts, generateChartData, generatePerformanceData]);

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
    }
    setShowTransactionForm(false);
    setEditingTransaction(undefined);
  };

  // Handle logout
  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };


  // Mark alert as read
  const markAlertAsRead = (alertId: string) => {
    setAlerts(alerts.map(alert => 
      alert.id === alertId ? { ...alert, read: true } : alert
    ));
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
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
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'zh')}
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Globe className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{t('dashboard.totalInvestments')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalDomains}</p>
              </div>
            </div>
          </div>

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
                概览
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
                域名管理
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
                交易记录
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
                数据分析
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
                提醒通知
                {alerts.filter(a => !a.read).length > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {alerts.filter(a => !a.read).length}
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
                域名市场
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
                设置
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
                数据管理
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">快速操作</h3>
                  <Zap className="h-5 w-5 text-yellow-500" />
                </div>
                <div className="space-y-3">
                  <button
                    onClick={handleAddDomain}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>添加域名</span>
                  </button>
                  <button
                    onClick={handleAddTransaction}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center space-x-2"
                  >
                    <FileText className="h-4 w-4" />
                    <span>记录交易</span>
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
                  <p className="text-2xl font-bold text-red-600">{alerts.filter(a => !a.read).length}</p>
                  <p className="text-sm text-gray-600 mt-1">未读提醒</p>
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
          <div className="space-y-6">
            {/* 图表选择器 */}
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">数据分析</h3>
                <div className="flex items-center space-x-2">
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

            {/* 高级图表组件 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DomainPerformanceChart
                performanceData={performanceData.map(p => ({
                  name: p.domain_name,
                  purchasePrice: p.purchase_price,
                  currentValue: p.current_value,
                  profit: p.profit_loss,
                  roi: p.roi_percentage,
                  daysHeld: p.days_held
                }))}
                chartData={chartData}
                type="line"
              />
              <DomainPerformanceChart
                performanceData={performanceData.map(p => ({
                  name: p.domain_name,
                  purchasePrice: p.purchase_price,
                  currentValue: p.current_value,
                  profit: p.profit_loss,
                  roi: p.roi_percentage,
                  daysHeld: p.days_held
                }))}
                chartData={chartData}
                type="bar"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DomainPerformanceChart
                performanceData={performanceData.map(p => ({
                  name: p.domain_name,
                  purchasePrice: p.purchase_price,
                  currentValue: p.current_value,
                  profit: p.profit_loss,
                  roi: p.roi_percentage,
                  daysHeld: p.days_held
                }))}
                chartData={chartData}
                type="area"
              />
              <DomainPerformanceChart
                performanceData={performanceData.map(p => ({
                  name: p.domain_name,
                  purchasePrice: p.purchase_price,
                  currentValue: p.current_value,
                  profit: p.profit_loss,
                  roi: p.roi_percentage,
                  daysHeld: p.days_held
                }))}
                chartData={chartData}
                type="pie"
              />
            </div>

            {/* 详细表现分析 */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">域名表现排名</h3>
              <div className="space-y-4">
                {performanceData.slice(0, 10).map((domain, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{domain.domain_name}</p>
                        <p className="text-sm text-gray-600">持有 {domain.days_held} 天</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${domain.roi_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {domain.roi_percentage >= 0 ? '+' : ''}{domain.roi_percentage.toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-600">
                        {domain.profit_loss >= 0 ? '+' : ''}${domain.profit_loss.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">提醒通知</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      共 {alerts.length} 条提醒
                    </span>
                    <button
                      onClick={() => setAlerts(alerts.map(a => ({ ...a, read: true })))}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      全部标记为已读
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {alerts.length > 0 ? (
                  <div className="space-y-4">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 rounded-lg border-l-4 ${
                          alert.priority === 'high' ? 'border-red-500 bg-red-50' :
                          alert.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                          'border-blue-500 bg-blue-50'
                        } ${alert.read ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              alert.type === 'renewal' ? 'bg-orange-100' :
                              alert.type === 'expiry' ? 'bg-red-100' :
                              alert.type === 'sale_opportunity' ? 'bg-green-100' : 'bg-blue-100'
                            }`}>
                              {alert.type === 'renewal' ? <Calendar className="h-4 w-4 text-orange-600" /> :
                               alert.type === 'expiry' ? <AlertTriangle className="h-4 w-4 text-red-600" /> :
                               alert.type === 'sale_opportunity' ? <TrendingUp className="h-4 w-4 text-green-600" /> :
                               <Info className="h-4 w-4 text-blue-600" />}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{alert.domain_name}</p>
                              <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                              <p className="text-xs text-gray-500 mt-1">{new Date(alert.timestamp).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {!alert.read && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            )}
                            <button
                              onClick={() => markAlertAsRead(alert.id)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {alert.read ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>暂无提醒通知</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'marketplace' && (
          <DomainMarketplace
            domains={[]} // 这里应该从API获取市场数据
            onLike={(id) => console.log('Like domain:', id)}
            onWatch={(id) => console.log('Watch domain:', id)}
            onContact={(id) => console.log('Contact seller:', id)}
            onQuickBuy={(id) => console.log('Quick buy domain:', id)}
            onFilter={(filters) => console.log('Filter domains:', filters)}
            onSort={(sortBy) => console.log('Sort domains:', sortBy)}
          />
        )}

        {activeTab === 'settings' && (
          <UserPreferencesPanel />
        )}

        {activeTab === 'data' && (
          <DataImportExport
            onImport={(data) => console.log('Import data:', data)}
            onExport={(format) => console.log('Export data:', format)}
            onBackup={() => console.log('Backup data')}
            onRestore={(backup) => console.log('Restore data:', backup)}
          />
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
      />
    </div>
  );
}
