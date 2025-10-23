'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import DomainList from '../../src/components/domain/DomainList';
import DomainForm from '../../src/components/domain/DomainForm';
import TransactionList from '../../src/components/transaction/TransactionList';
import TransactionForm from '../../src/components/transaction/TransactionForm';
import { Globe, Plus, DollarSign, TrendingUp, BarChart3, LogOut, User, FileText } from 'lucide-react';

interface Domain {
  id: string;
  domain_name: string;
  registrar: string;
  purchase_date: string;
  purchase_cost: number;
  renewal_cost: number;
  next_renewal_date?: string;
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
}

export default function DashboardPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<DomainStats>({
    totalDomains: 0,
    totalCost: 0,
    totalRevenue: 0,
    totalProfit: 0,
    roi: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'domains' | 'transactions'>('domains');
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | undefined>();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>();
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
    const totalRevenue = 0; // Will be calculated from transactions
    const totalProfit = totalRevenue - totalCost;
    const roi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    setStats({
      totalDomains,
      totalCost,
      totalRevenue,
      totalProfit,
      roi
    });
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

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('domains')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'domains'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Globe className="h-4 w-4 inline mr-2" />
                Domains
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'transactions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FileText className="h-4 w-4 inline mr-2" />
                Transactions
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'domains' && (
          <DomainList
            domains={domains}
            onEdit={handleEditDomain}
            onDelete={handleDeleteDomain}
            onView={handleViewDomain}
            onAdd={handleAddDomain}
          />
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
