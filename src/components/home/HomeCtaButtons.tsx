'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';

interface HomeCtaButtonsProps {
  getStartedLabel: string;
  getStartedAria: string;
  startFreeLabel: string;
  startFreeAria: string;
  className: string;
  variant: 'hero' | 'cta';
}

export default function HomeCtaButtons({
  getStartedLabel,
  getStartedAria,
  startFreeLabel,
  startFreeAria,
  className,
  variant,
}: HomeCtaButtonsProps) {
  const { user } = useSupabaseAuth();
  const href = user ? '/dashboard' : '/login';
  const label = variant === 'hero' ? getStartedLabel : startFreeLabel;
  const aria = variant === 'hero' ? getStartedAria : startFreeAria;

  return (
    <Link
      href={href}
      prefetch
      aria-label={aria}
      className={className}
    >
      {label}
      <ArrowRight className="h-5 w-5" />
    </Link>
  );
}
