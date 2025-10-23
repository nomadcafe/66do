'use client';

import { useEffect, useRef, useState } from 'react';

interface TouchGesturesProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  swipeThreshold?: number;
  longPressDelay?: number;
  className?: string;
}

export default function TouchGestures({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onTap,
  onDoubleTap,
  onLongPress,
  swipeThreshold = 50,
  longPressDelay = 500,
  className = ''
}: TouchGesturesProps) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number; time: number } | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const touchData = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    setTouchStart(touchData);
    setTouchEnd(null);

    // 开始长按计时器
    if (onLongPress) {
      const timer = setTimeout(() => {
        onLongPress();
      }, longPressDelay);
      setLongPressTimer(timer);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchEnd({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    });

    // 如果移动了，取消长按
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    if (!touchStart || !touchEnd) {
      // 处理点击
      if (onTap) {
        setTapCount(prev => prev + 1);
        
        if (tapCount === 0) {
          tapTimeoutRef.current = setTimeout(() => {
            onTap();
            setTapCount(0);
          }, 300);
        } else if (tapCount === 1) {
          if (tapTimeoutRef.current) {
            clearTimeout(tapTimeoutRef.current);
          }
          if (onDoubleTap) {
            onDoubleTap();
          }
          setTapCount(0);
        }
      }
      return;
    }

    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;
    const deltaTime = touchEnd.time - touchStart.time;

    // 检查是否是快速滑动
    if (deltaTime < 300) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // 水平滑动
        if (Math.abs(deltaX) > swipeThreshold) {
          if (deltaX > 0 && onSwipeRight) {
            onSwipeRight();
          } else if (deltaX < 0 && onSwipeLeft) {
            onSwipeLeft();
          }
        }
      } else {
        // 垂直滑动
        if (Math.abs(deltaY) > swipeThreshold) {
          if (deltaY > 0 && onSwipeDown) {
            onSwipeDown();
          } else if (deltaY < 0 && onSwipeUp) {
            onSwipeUp();
          }
        }
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, [longPressTimer]);

  return (
    <div
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  );
}
