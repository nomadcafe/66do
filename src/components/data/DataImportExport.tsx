'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  Download,
  FileText,
  Database,
  CheckCircle,
  AlertTriangle,
  X,
  ArrowUp,
  Settings,
  RefreshCw
} from 'lucide-react';
import * as Papa from 'papaparse';
import { useI18nContext } from '../../contexts/I18nProvider';
import { MAX_FILE_SIZE, MAX_CSV_IMPORT_ROWS, ALLOWED_FILE_TYPES, ALLOWED_EXTENSIONS } from '../../lib/constants';
import { detectFormat, mapRows, type MappedDomain } from '../../lib/csvFormats';

interface ImportExportProps {
  onImport: (data: unknown) => void;
  onExport: (format: string) => void;
  onRestore: (backup: unknown) => void;
  /** 已有域名 name 列表（小写）。用来在预览时统计「N 新增 / M 更新」。
   *  上层把整个 domains 数组的 name 抽出来传进来即可；不传时预览只显示总数。 */
  existingDomainNames?: string[];
}

interface ImportResult {
  success: boolean;
  message: string;
  importedCount: number;
  errors: string[];
}

interface CsvPreview {
  formatId: string;
  formatDisplayName: string;
  rows: MappedDomain[];
  newCount: number;
  updateCount: number;
  /** Rows the parser produced but that failed the basic shape check
   *  (missing domain_name). Surfaced as a warning so the user knows the
   *  preview count and the file's row count won't match. */
  skippedCount: number;
  /** True when the CSV had more rows than MAX_CSV_IMPORT_ROWS and was
   *  truncated to that ceiling. */
  truncated: boolean;
}

export default function DataImportExport({
  onImport,
  onExport,
  onRestore,
  existingDomainNames
}: ImportExportProps) {
  const { t } = useI18nContext();
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'restore'>('import');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 已有 name 集合，用于预览阶段判断"新增 vs 更新"——预览前 lower-case 一次，
  // 行数大时避免每行 toLowerCase。
  const existingNameSet = useMemo(
    () => new Set((existingDomainNames ?? []).map((n) => n.toLowerCase())),
    [existingDomainNames]
  );

  const interpolate = (template: string, vars: Record<string, string | number>): string => {
    let out = template;
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(`{${k}}`, String(v));
    }
    return out;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportResult(null);
    setCsvPreview(null);

    try {
      // 验证文件大小
      if (file.size > MAX_FILE_SIZE) {
        setImportResult({
          success: false,
          message: t('data.fileTooLarge') || `文件大小不能超过${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`,
          importedCount: 0,
          errors: [`文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB，最大允许: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`]
        });
        setIsProcessing(false);
        return;
      }

      // 验证文件类型
      const fileExtension = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
      const isValidExtension = fileExtension && ALLOWED_EXTENSIONS.includes(fileExtension as '.csv' | '.json');
      const isValidMimeType = file.type === '' || (ALLOWED_FILE_TYPES as readonly string[]).includes(file.type);

      if (!isValidExtension && !isValidMimeType) {
        setImportResult({
          success: false,
          message: t('data.invalidFileType') || '不支持的文件类型',
          importedCount: 0,
          errors: [`支持的文件类型: ${ALLOWED_EXTENSIONS.join(', ')}`]
        });
        setIsProcessing(false);
        return;
      }

      const text = await file.text();

      if (file.name.endsWith('.json')) {
        // JSON 路径：保持旧行为——data 里必须有 domains 数组，原样下发。
        // 这是「自家备份恢复」的兼容形态，不走识别 / 预览。
        const data = JSON.parse(text);
        const validation = validateJsonImportData(data);
        if (!validation.valid) {
          setImportResult({
            success: false,
            message: t('data.invalidFormat'),
            importedCount: 0,
            errors: validation.errors,
          });
          return;
        }
        await onImport(data);
        setImportResult({
          success: true,
          message: t('data.importSuccess'),
          importedCount: (data as { domains?: unknown[] }).domains?.length ?? 0,
          errors: [],
        });
        return;
      }

      if (file.name.endsWith('.csv')) {
        // CSV 路径：解析 → 识别 → 映射 → 进预览。预览确认后才真正 onImport。
        const parsed = parseCsvRaw(text);
        if (parsed.errors.length > 0) {
          throw new Error(`CSV parsing errors: ${parsed.errors.join('; ')}`);
        }

        // 截断到上限。10MB 大小限是字节级，但单元格简短的 CSV 也能塞下
        // 几十万行 → 浏览器解析 / 渲染都会卡。MAX_CSV_IMPORT_ROWS 是更
        // 直接的"组合规模"边界。
        const truncated = parsed.rows.length > MAX_CSV_IMPORT_ROWS;
        const rowsToMap = truncated ? parsed.rows.slice(0, MAX_CSV_IMPORT_ROWS) : parsed.rows;

        const detection = detectFormat(parsed.headers);
        if (!detection) {
          setImportResult({
            success: false,
            message: t('data.unknownFormat'),
            importedCount: 0,
            errors: parsed.headers.length ? [`Headers: ${parsed.headers.join(', ')}`] : [],
          });
          return;
        }

        const mapped = mapRows(rowsToMap, detection.format);
        // mapRows 返回所有产出行，包括 domain_name 缺失/为空的。这里二次
        // 过滤：缺 domain_name 的视作"行结构异常"，单独计数显示给用户，
        // 不让它们悄悄进 onImport（后端 validateDomain 也会拒，但用户在
        // 客户端就该看到）。
        const usableRows = mapped.filter((r) => r.domain_name && r.domain_name.trim().length > 0);
        const skippedCount = mapped.length - usableRows.length;

        if (usableRows.length === 0) {
          setImportResult({
            success: false,
            message: t('data.noRowsMapped'),
            importedCount: 0,
            errors: skippedCount > 0 ? [`${skippedCount} rows skipped (missing domain_name)`] : [],
          });
          return;
        }

        let newCount = 0;
        let updateCount = 0;
        for (const row of usableRows) {
          if (existingNameSet.has(row.domain_name)) updateCount++;
          else newCount++;
        }

        setCsvPreview({
          formatId: detection.format.id,
          formatDisplayName: detection.format.displayName,
          rows: usableRows,
          newCount,
          updateCount,
          skippedCount,
          truncated,
        });
        return;
      }

      throw new Error(t('data.unsupportedFormat'));
    } catch (error) {
      setImportResult({
        success: false,
        message: error instanceof Error ? error.message : t('data.importFailed'),
        importedCount: 0,
        errors: [error instanceof Error ? error.message : t('data.unknownError')]
      });
    } finally {
      setIsProcessing(false);
      // 复用同一 file input 时重置 value，否则相同文件二次选不会触发 change
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmCsvImport = async () => {
    if (!csvPreview) return;
    setIsProcessing(true);
    try {
      await onImport({ domains: csvPreview.rows });
      setImportResult({
        success: true,
        message: t('data.importSuccess'),
        importedCount: csvPreview.rows.length,
        errors: [],
      });
      setCsvPreview(null);
    } catch (error) {
      setImportResult({
        success: false,
        message: error instanceof Error ? error.message : t('data.importFailed'),
        importedCount: 0,
        errors: [error instanceof Error ? error.message : t('data.unknownError')],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelCsvImport = () => {
    setCsvPreview(null);
    setImportResult(null);
  };

  const parseCsvRaw = (csvText: string): { headers: string[]; rows: Record<string, string>[]; errors: string[] } => {
    const result = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim(),
      escapeChar: '"',
      newline: '\n',
    });
    const errors = result.errors.map((err) => `Row ${err.row ?? 'unknown'}: ${err.message ?? 'Unknown error'}`);
    const headers = result.meta.fields ?? [];
    return { headers, rows: result.data, errors };
  };

  const validateJsonImportData = (data: unknown) => {
    const errors: string[] = [];
    if (!data || typeof data !== 'object' || !('domains' in data) || !Array.isArray((data as { domains: unknown[] }).domains)) {
      errors.push(t('data.mustContainDomains'));
      return { valid: false, errors };
    }
    const domains = (data as { domains: unknown[] }).domains;
    domains.forEach((domain: unknown, index: number) => {
      if (typeof domain !== 'object' || domain === null) {
        errors.push(t('data.rowFormatError').replace('{row}', (index + 1).toString()));
        return;
      }
      const obj = domain as Record<string, unknown>;
      if (!obj.domain_name || typeof obj.domain_name !== 'string') {
        errors.push(t('data.missingRequiredField').replace('{row}', (index + 1).toString()).replace('{field}', 'domain_name'));
      }
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

  const tabs = [
    { id: 'import', label: t('data.import'), icon: Upload },
    { id: 'export', label: t('data.export'), icon: Download },
    { id: 'restore', label: t('data.restoreBackup'), icon: Database }
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

      {csvPreview && (
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
          <h4 className="text-sm font-semibold text-blue-900 mb-3">
            {t('data.importPreviewTitle')}
          </h4>
          <ul className="text-sm text-blue-900 space-y-1 mb-3">
            <li>{interpolate(t('data.detectedFormat'), { format: csvPreview.formatDisplayName })}</li>
            <li>{interpolate(t('data.detectedRows'), { count: csvPreview.rows.length })}</li>
            <li className="font-medium">
              {interpolate(t('data.previewSummary'), {
                newCount: csvPreview.newCount,
                updateCount: csvPreview.updateCount,
              })}
            </li>
          </ul>
          {csvPreview.skippedCount > 0 && (
            <p className="text-xs text-amber-700 mb-3">
              {interpolate(t('data.skippedRowsWarning'), { count: csvPreview.skippedCount })}
            </p>
          )}
          {csvPreview.truncated && (
            <p className="text-xs text-amber-700 mb-3">
              {interpolate(t('data.truncatedRowsWarning'), { max: MAX_CSV_IMPORT_ROWS })}
            </p>
          )}
          {csvPreview.updateCount > 0 && (
            <p className="text-xs text-blue-700 mb-3">{t('data.fieldsKeptOnExisting')}</p>
          )}
          {/* Registrar adapter 不再自动填 purchase_date（registration date ≠
              purchase date，米市买入尤其差很多）。给新增行时提示用户导入后
              手动补 cost / date。Generic 格式跳过——那是用户自家 CSV，
              purchase_date 由用户显式控制。 */}
          {csvPreview.newCount > 0 && csvPreview.formatId !== 'generic' && (
            <p className="text-xs text-blue-700 mb-3">{t('data.purchaseDateNotFilled')}</p>
          )}
          <div className="flex space-x-2">
            <button
              onClick={confirmCsvImport}
              disabled={isProcessing}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {isProcessing ? t('data.processing') : t('data.confirmImport')}
            </button>
            <button
              onClick={cancelCsvImport}
              disabled={isProcessing}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium"
            >
              {t('data.cancelImport')}
            </button>
          </div>
        </div>
      )}

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
            if (!file) return;
            // Mirror the import-tab size cap. Without this, a hostile or
            // accidentally huge .json would read into memory and JSON.parse
            // before the UI got a chance to reject it.
            if (file.size > MAX_FILE_SIZE) {
              setImportResult({
                success: false,
                message: t('data.fileTooLarge') || `文件大小不能超过${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`,
                importedCount: 0,
                errors: [`文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB，最大允许: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`],
              });
              e.target.value = '';
              return;
            }
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
          }}
          className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
        />
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
                  onClick={() => setActiveTab(tab.id as 'import' | 'export' | 'restore')}
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
          {activeTab === 'restore' && renderRestoreTab()}
        </div>
      </div>
    </div>
  );
}
