'use client';

import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Download, 
  FileText, 
  Database, 
  CheckCircle, 
  AlertTriangle, 
  X,
  File,
  ArrowUp,
  Settings,
  RefreshCw
} from 'lucide-react';

interface ImportExportProps {
  onImport: (data: unknown) => void;
  onExport: (format: string) => void;
  onBackup: () => void;
  onRestore: (backup: unknown) => void;
}

interface ImportResult {
  success: boolean;
  message: string;
  importedCount: number;
  errors: string[];
}

export default function DataImportExport({
  onImport,
  onExport,
  onBackup,
  onRestore
}: ImportExportProps) {
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'backup' | 'restore'>('import');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportResult(null);

    try {
      const text = await file.text();
      let data;

      // 根据文件类型解析数据
      if (file.name.endsWith('.json')) {
        data = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        data = parseCSV(text);
      } else if (file.name.endsWith('.xlsx')) {
        // 这里需要添加 xlsx 解析库
        throw new Error('Excel 文件暂不支持，请转换为 CSV 格式');
      } else {
        throw new Error('不支持的文件格式');
      }

      // 验证数据格式
      const validation = validateImportData(data);
      if (!validation.valid) {
        setImportResult({
          success: false,
          message: '数据格式不正确',
          importedCount: 0,
          errors: validation.errors
        });
        return;
      }

      // 执行导入
      await onImport(data);
      
      setImportResult({
        success: true,
        message: '数据导入成功',
        importedCount: data.domains?.length || data.length || 0,
        errors: []
      });

    } catch (error) {
      setImportResult({
        success: false,
        message: error instanceof Error ? error.message : '导入失败',
        importedCount: 0,
        errors: [error instanceof Error ? error.message : '未知错误']
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const parseCSV = (csvText: string) => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        data.push(row);
      }
    }

    return { domains: data };
  };

  const validateImportData = (data: unknown) => {
    const errors: string[] = [];

    if (!data || typeof data !== 'object' || !('domains' in data) || !Array.isArray((data as {domains: unknown[]}).domains)) {
      errors.push('数据必须包含 domains 数组');
      return { valid: false, errors };
    }

    const requiredFields = ['domain_name', 'purchase_date', 'purchase_cost'];
    const domains = (data as {domains: unknown[]}).domains;
    
    domains.forEach((domain: unknown, index: number) => {
      if (typeof domain !== 'object' || domain === null) {
        errors.push(`第 ${index + 1} 行数据格式错误`);
        return;
      }
      
      const domainObj = domain as Record<string, unknown>;
      requiredFields.forEach(field => {
        if (!domainObj[field]) {
          errors.push(`第 ${index + 1} 行缺少必需字段: ${field}`);
        }
      });
    });

    return { valid: errors.length === 0, errors };
  };

  const handleExport = async (format: string) => {
    setIsProcessing(true);
    try {
      await onExport(format);
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBackup = async () => {
    setIsProcessing(true);
    try {
      await onBackup();
    } catch (error) {
      console.error('备份失败:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const tabs = [
    { id: 'import', label: '数据导入', icon: Upload },
    { id: 'export', label: '数据导出', icon: Download },
    { id: 'backup', label: '备份恢复', icon: Database }
  ];

  const renderImportTab = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">导入说明</h4>
            <p className="text-sm text-blue-700 mt-1">
              支持 JSON 和 CSV 格式。请确保数据包含域名、购买日期、购买价格等必需字段。
            </p>
          </div>
        </div>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
            <FileText className="h-6 w-6 text-gray-600" />
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900">选择文件</h3>
            <p className="text-sm text-gray-600 mt-1">
              支持 JSON 和 CSV 格式，最大 10MB
            </p>
          </div>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2 mx-auto"
          >
            {isProcessing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
            <span>{isProcessing ? '处理中...' : '选择文件'}</span>
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`border rounded-lg p-4 ${
          importResult.success 
            ? 'border-green-200 bg-green-50' 
            : 'border-red-200 bg-red-50'
        }`}>
          <div className="flex items-start space-x-3">
            {importResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <X className="h-5 w-5 text-red-600 mt-0.5" />
            )}
            <div className="flex-1">
              <h4 className={`text-sm font-medium ${
                importResult.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {importResult.message}
              </h4>
              {importResult.success && (
                <p className="text-sm text-green-700 mt-1">
                  成功导入 {importResult.importedCount} 条记录
                </p>
              )}
              {importResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-red-700 font-medium">错误详情:</p>
                  <ul className="text-sm text-red-600 mt-1 list-disc list-inside">
                    {importResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderExportTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <FileText className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900">JSON 格式</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            导出为 JSON 格式，包含完整的域名和交易数据，适合备份和迁移。
          </p>
          <button
            onClick={() => handleExport('json')}
            disabled={isProcessing}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {isProcessing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>导出 JSON</span>
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <File className="h-6 w-6 text-green-600" />
            <h3 className="text-lg font-medium text-gray-900">CSV 格式</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            导出为 CSV 格式，适合在 Excel 或其他表格软件中查看和编辑。
          </p>
          <button
            onClick={() => handleExport('csv')}
            disabled={isProcessing}
            className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {isProcessing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>导出 CSV</span>
          </button>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-yellow-900">注意事项</h4>
            <ul className="text-sm text-yellow-700 mt-1 list-disc list-inside">
              <li>导出的数据包含所有域名和交易记录</li>
              <li>敏感信息如密码不会包含在导出文件中</li>
              <li>建议定期备份数据以防丢失</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBackupTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Database className="h-6 w-6 text-purple-600" />
            <h3 className="text-lg font-medium text-gray-900">创建备份</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            创建完整的数据备份，包含所有域名、交易记录和用户设置。
          </p>
          <button
            onClick={handleBackup}
            disabled={isProcessing}
            className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {isProcessing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
            <span>创建备份</span>
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Settings className="h-6 w-6 text-orange-600" />
            <h3 className="text-lg font-medium text-gray-900">恢复备份</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            从备份文件恢复数据，将覆盖当前所有数据。
          </p>
          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const backup = JSON.parse(event.target?.result as string) as unknown;
                    onRestore(backup);
                  } catch (error) {
                    console.error('恢复备份失败:', error);
                  }
                };
                reader.readAsText(file);
              }
            }}
            className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
          />
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-red-900">重要警告</h4>
            <p className="text-sm text-red-700 mt-1">
              恢复备份将完全替换当前数据，此操作不可撤销。请确保在恢复前已创建当前数据的备份。
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRestoreTab = () => (
    <div className="space-y-6">
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Settings className="h-6 w-6 text-orange-600" />
          <h3 className="text-lg font-medium text-gray-900">恢复备份</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          从备份文件恢复数据，将覆盖当前所有数据。
        </p>
        <input
          type="file"
          accept=".json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (event) => {
                try {
                  const backup = JSON.parse(event.target?.result as string) as unknown;
                  onRestore(backup);
                } catch (error) {
                  console.error('恢复备份失败:', error);
                }
              };
              reader.readAsText(file);
            }
          }}
          className="w-full p-2 border border-gray-300 rounded-lg"
        />
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">数据管理</h3>
        <p className="text-sm text-gray-600 mt-1">导入、导出和备份您的域名投资数据</p>
      </div>

      <div className="flex">
        {/* 侧边栏 */}
        <div className="w-64 border-r border-gray-200">
          <nav className="p-4 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'import' | 'export' | 'backup' | 'restore')}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 p-6">
          {activeTab === 'import' && renderImportTab()}
          {activeTab === 'export' && renderExportTab()}
          {activeTab === 'backup' && renderBackupTab()}
          {activeTab === 'restore' && renderRestoreTab()}
        </div>
      </div>
    </div>
  );
}
