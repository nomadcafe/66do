'use client';

import { Settings, DollarSign } from 'lucide-react';
import { useI18nContext } from '../../contexts/I18nProvider';

interface CurrencySettingsProps {
  baseCurrency: string;
  onBaseCurrencyChange?: (currency: string) => void;
}

const BASE_CURRENCY = 'USD';

export default function CurrencySettings({ baseCurrency = BASE_CURRENCY }: CurrencySettingsProps) {
  const { t } = useI18nContext();

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg">
      <Settings className="h-4 w-4 text-gray-500" />
      <span className="font-medium text-gray-700">{t('dashboard.currencySettings')}</span>
      <span className="text-sm text-gray-600 flex items-center gap-1">
        <DollarSign className="h-4 w-4" />
        {baseCurrency}
      </span>
    </div>
  );
}
