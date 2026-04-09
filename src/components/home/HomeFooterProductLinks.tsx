'use client';

import Link from 'next/link';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';

interface HomeFooterProductLinksProps {
  investmentManagement: string;
  dataAnalytics: string;
  performanceTracking: string;
}

export default function HomeFooterProductLinks({
  investmentManagement,
  dataAnalytics,
  performanceTracking,
}: HomeFooterProductLinksProps) {
  const { user } = useSupabaseAuth();
  const href = user ? '/dashboard' : '/login?redirect=/dashboard';

  return (
    <ul className="mt-4 space-y-2 text-sm">
      <li>
        <Link href={href} prefetch className="transition hover:text-white">
          {investmentManagement}
        </Link>
      </li>
      <li>
        <Link href={href} prefetch className="transition hover:text-white">
          {dataAnalytics}
        </Link>
      </li>
      <li>
        <Link href={href} prefetch className="transition hover:text-white">
          {performanceTracking}
        </Link>
      </li>
    </ul>
  );
}
