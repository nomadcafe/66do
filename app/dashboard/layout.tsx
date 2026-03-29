import type { ReactNode } from 'react';

/** 避免整页 304 / 强缓存导致客户端壳过旧；数据仍以 Supabase 为准 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
