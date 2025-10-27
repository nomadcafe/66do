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
import { useI18nContext } from '../../contexts/I18nProvider';

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
  const { t } = useI18nContext();
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
        throw new Error(t('data.excelNotSupported'));
      } else {
        throw new Error(t('data.unsupportedFormat'));
      }

      // 验证数据格式
      const validation = validateImportData(data);
      if (!validation.valid) {
        setImportResult({
          success: false,
          message: t('data.invalidFormat'),
          importedCount: 0,
          errors: validation.errors
        });
        return;
      }

      // 执行导入
      await onImport(data);
      
      setImportResult({
        success: true,
        message: t('data.importSuccess'),
        importedCount: data.domains?.length || data.length || 0,
        errors: []
      });

    } catch (error) {
      setImportResult({
        success: false,
        message: error instanceof Error ? error.message : t('data.importFailed'),
        importedCount: 0,
        errors: [error instanceof Error ? error.message : t('data.unknownError')]
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
      errors.push(t('data.mustContainDomains'));
      return { valid: false, errors };
    }

    const requiredFields = ['domain_name', 'purchase_date', 'purchase_cost'];
    const domains = (data as {domains: unknown[]}).domains;
    
    domains.forEach((domain: unknown, index: number) => {
      if (typeof domain !== 'object' || domain === null) {
        errors.push(t('data.rowFormatError').replace('{row}', (index + 1).toString()));
        return;
      }
      
      const domainObj = domain as Record<string, unknown>;
      requiredFields.forEach(field => {
        if (!domainObj[field]) {
          errors.push(t('data.missingRequiredField').replace('{row}', (index + 1).toString()).replace('{field}', field));
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
    { id: 'import', label: t('data.import'), icon: Upload },
    { id: 'export', label: t('data.export'), icon: Download },
    { id: 'backup', label: t('data.backup'), icon: Database }
  ];

  const renderImportTab = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">{t('data.importInstructions')}</h4>
            <p className="text-sm text-blue-700 mt-1">
              {t('data.importDescription')}
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
            <h3 className="text-lg font-medium text-gray-900">{t('data.selectFile')}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {t('data.fileDescription')}
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
            <span>{isProcessing ? t('data.processing') : t('data.selectFile')}</span>
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
                  {t('data.importSuccessCount').replace('{count}', importResult.importedCount.toString())}
                </p>
              )}
              {importResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-red-700 font-medium">{t('data.errorDetails')}:</p>
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
            <h3 className="text-lg font-medium text-gray-900">{t('data.jsonFormat')}</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            {t('data.jsonDescription')}
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
            <span>{t('data.exportJson')}</span>
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <File className="h-6 w-6 text-green-600" />
            <h3 className="text-lg font-medium text-gray-900">{t('data.csvFormat')}</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            {t('data.csvDescription')}
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
            <span>{t('data.exportCsv')}</span>
          </button>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-yellow-900">{t('data.notes')}</h4>
            <ul className="text-sm text-yellow-700 mt-1 list-disc list-inside">
              <li>{t('data.exportNote1')}</li>
              <li>{t('data.exportNote2')}</li>
              <li>{t('data.exportNote3')}</li>
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
            <h3 className="text-lg font-medium text-gray-900">{t('data.createBackup')}</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            {t('data.createBackupDescription')}
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
            <span>{t('data.createBackup')}</span>
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Settings className="h-6 w-6 text-orange-600" />
            <h3 className="text-lg font-medium text-gray-900">{t('data.restoreBackup')}</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            {t('data.restoreBackupDescription')}
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
            <h4 className="text-sm font-medium text-red-900">{t('data.importantWarning')}</h4>
            <p className="text-sm text-red-700 mt-1">
              {t('data.restoreWarning')}
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
          <h3 className="text-lg font-medium text-gray-900">{t('data.restoreBackup')}</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {t('data.restoreBackupDescription')}
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
        <h3 className="text-lg font-semibold text-gray-900">{t('data.dataManagement')}</h3>
        <p className="text-sm text-gray-600 mt-1">{t('data.dataManagementDescription')}</p>
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
