'use client';

import { useState, useRef, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
  className?: string;
}

export default function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  className = ''
}: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState(0);
  const [canPull, setCanPull] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (container.scrollTop === 0) {
        setCanPull(true);
        setStartY(e.touches[0].clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!canPull) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - startY;

      if (distance > 0) {
        e.preventDefault();
        setPullDistance(Math.min(distance, threshold * 1.5));
        setIsPulling(distance > threshold);
      }
    };

    const handleTouchEnd = async () => {
      if (!canPull) return;

      if (isPulling && !isRefreshing) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      }

      setPullDistance(0);
      setIsPulling(false);
      setCanPull(false);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [canPull, startY, isPulling, isRefreshing, onRefresh, threshold]);

  const refreshIconRotation = isRefreshing ? 360 : (pullDistance / threshold) * 180;
  const refreshIconOpacity = Math.min(pullDistance / threshold, 1);

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      style={{ 
        transform: `translateY(${Math.min(pullDistance * 0.5, threshold * 0.5)}px)`,
        transition: isRefreshing ? 'transform 0.3s ease' : 'none'
      }}
    >
      {/* Pull to refresh indicator */}
      <div 
        className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full flex flex-col items-center justify-center bg-white rounded-b-2xl shadow-lg transition-all duration-200"
        style={{
          height: `${Math.min(pullDistance, threshold)}px`,
          opacity: refreshIconOpacity
        }}
      >
        <RefreshCw 
          size={24}
          className={`text-blue-600 transition-transform duration-200 ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          style={{ transform: `rotate(${refreshIconRotation}deg)` }}
        />
        <span className="text-xs text-gray-600 mt-1">
          {isRefreshing ? t('mobile.pullToRefresh') : t('mobile.pullToRefresh')}
        </span>
      </div>

      {children}
    </div>
  );
}
