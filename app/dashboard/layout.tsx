import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** 避免整页 304 / 强缓存导致客户端壳过旧；数据仍以 Supabase 为准 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
