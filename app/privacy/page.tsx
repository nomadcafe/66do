'use client';

import { useI18nContext } from '../../src/contexts/I18nProvider';
import { useEffect, useState } from 'react';

export default function PrivacyPage() {
  const { t } = useI18nContext();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow-lg rounded-lg p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded mb-8"></div>
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            {t('privacy.title')}
          </h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-6">
              {t('privacy.lastUpdated')}: {new Date().toLocaleDateString()}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {t('privacy.introduction.title')}
              </h2>
              <p className="text-gray-700 mb-4">
                {t('privacy.introduction.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {t('privacy.dataCollection.title')}
              </h2>
              <p className="text-gray-700 mb-4">
                {t('privacy.dataCollection.content')}
              </p>
              
              <h3 className="text-xl font-medium text-gray-900 mb-3">
                {t('privacy.dataCollection.personalData.title')}
              </h3>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li>{t('privacy.dataCollection.personalData.email')}</li>
                <li>{t('privacy.dataCollection.personalData.domainInfo')}</li>
                <li>{t('privacy.dataCollection.personalData.financialData')}</li>
                <li>{t('privacy.dataCollection.personalData.transactionData')}</li>
                <li>{t('privacy.dataCollection.personalData.analyticsData')}</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-900 mb-3">
                {t('privacy.dataCollection.sensitiveData.title')}
              </h3>
              <p className="text-gray-700 mb-4">
                {t('privacy.dataCollection.sensitiveData.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {t('privacy.dataSecurity.title')}
              </h2>
              <p className="text-gray-700 mb-4">
                {t('privacy.dataSecurity.content')}
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-medium text-blue-900 mb-2">
                  {t('privacy.dataSecurity.encryption.title')}
                </h3>
                <ul className="list-disc list-inside text-blue-800 space-y-1">
                  <li>{t('privacy.dataSecurity.encryption.aes')}</li>
                  <li>{t('privacy.dataSecurity.encryption.https')}</li>
                  <li>{t('privacy.dataSecurity.encryption.rls')}</li>
                  <li>{t('privacy.dataSecurity.encryption.userKeys')}</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {t('privacy.dataUsage.title')}
              </h2>
              <p className="text-gray-700 mb-4">
                {t('privacy.dataUsage.content')}
              </p>
              
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>{t('privacy.dataUsage.portfolioManagement')}</li>
                <li>{t('privacy.dataUsage.financialAnalysis')}</li>
                <li>{t('privacy.dataUsage.renewalTracking')}</li>
                <li>{t('privacy.dataUsage.performanceMetrics')}</li>
                <li>{t('privacy.dataUsage.userExperience')}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {t('privacy.dataSharing.title')}
              </h2>
              <p className="text-gray-700 mb-4">
                {t('privacy.dataSharing.content')}
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-medium text-red-900 mb-2">
                  {t('privacy.dataSharing.never.title')}
                </h3>
                <ul className="list-disc list-inside text-red-800 space-y-1">
                  <li>{t('privacy.dataSharing.never.sell')}</li>
                  <li>{t('privacy.dataSharing.never.rent')}</li>
                  <li>{t('privacy.dataSharing.never.share')}</li>
                  <li>{t('privacy.dataSharing.never.marketing')}</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {t('privacy.userRights.title')}
              </h2>
              <p className="text-gray-700 mb-4">
                {t('privacy.userRights.content')}
              </p>
              
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>{t('privacy.userRights.access')}</li>
                <li>{t('privacy.userRights.rectification')}</li>
                <li>{t('privacy.userRights.erasure')}</li>
                <li>{t('privacy.userRights.portability')}</li>
                <li>{t('privacy.userRights.restriction')}</li>
                <li>{t('privacy.userRights.objection')}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {t('privacy.dataRetention.title')}
              </h2>
              <p className="text-gray-700 mb-4">
                {t('privacy.dataRetention.content')}
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-yellow-900 mb-2">
                  {t('privacy.dataRetention.periods.title')}
                </h3>
                <ul className="list-disc list-inside text-yellow-800 space-y-1">
                  <li>{t('privacy.dataRetention.periods.account')}</li>
                  <li>{t('privacy.dataRetention.periods.domainData')}</li>
                  <li>{t('privacy.dataRetention.periods.transactionData')}</li>
                  <li>{t('privacy.dataRetention.periods.analytics')}</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {t('privacy.cookies.title')}
              </h2>
              <p className="text-gray-700 mb-4">
                {t('privacy.cookies.content')}
              </p>
              
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>{t('privacy.cookies.essential')}</li>
                <li>{t('privacy.cookies.analytics')}</li>
                <li>{t('privacy.cookies.preferences')}</li>
                <li>{t('privacy.cookies.security')}</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {t('privacy.thirdParty.title')}
              </h2>
              <p className="text-gray-700 mb-4">
                {t('privacy.thirdParty.content')}
              </p>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('privacy.thirdParty.services.title')}
                </h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li><strong>Supabase:</strong> {t('privacy.thirdParty.services.supabase')}</li>
                  <li><strong>Vercel:</strong> {t('privacy.thirdParty.services.vercel')}</li>
                  <li><strong>Resend:</strong> {t('privacy.thirdParty.services.resend')}</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {t('privacy.changes.title')}
              </h2>
              <p className="text-gray-700 mb-4">
                {t('privacy.changes.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {t('privacy.contact.title')}
              </h2>
              <p className="text-gray-700 mb-4">
                {t('privacy.contact.content')}
              </p>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800">
                  <strong>{t('privacy.contact.email')}:</strong> hello@66do.com
                </p>
                <p className="text-green-800 mt-2">
                  <strong>{t('privacy.contact.response')}</strong>
                </p>
              </div>
            </section>

            <div className="border-t border-gray-200 pt-6 mt-8">
              <p className="text-sm text-gray-500">
                {t('privacy.footer')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
