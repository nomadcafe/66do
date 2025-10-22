'use client';

import { useEffect, useRef } from 'react';

interface TurnstileProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
  className?: string;
}

export default function Turnstile({
  siteKey,
  onVerify,
  onError,
  onExpire,
  theme = 'auto',
  size = 'normal',
  className = ''
}: TurnstileProps) {
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Load Turnstile script
    const loadTurnstile = () => {
      if (window.turnstile) {
        renderWidget();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.onload = renderWidget;
      script.onerror = () => {
        console.error('Failed to load Turnstile script');
        onError?.('Failed to load verification service');
      };
      document.head.appendChild(script);
    };

    const renderWidget = () => {
      if (!window.turnstile || !turnstileRef.current) return;

      try {
        const widgetId = window.turnstile.render(turnstileRef.current, {
          sitekey: siteKey,
          theme: theme,
          size: size,
          callback: (token: string) => {
            onVerify(token);
          },
          'error-callback': (error: string) => {
            console.error('Turnstile error:', error);
            onError?.(error);
          },
          'expired-callback': () => {
            onExpire?.();
          }
        } as Record<string, unknown>);
        widgetIdRef.current = widgetId;
      } catch (error) {
        console.error('Turnstile render error:', error);
        onError?.('Failed to initialize verification');
      }
    };

    loadTurnstile();

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [siteKey, onVerify, onError, onExpire, theme, size]);

  // const reset = () => {
  //   if (widgetIdRef.current && window.turnstile) {
  //     window.turnstile.reset(widgetIdRef.current);
  //   }
  // };

  return (
    <div className={`turnstile-container ${className}`}>
      <div ref={turnstileRef} className="turnstile-widget" />
    </div>
  );
}

// Extend Window interface for Turnstile
declare global {
  interface Window {
    turnstile: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}
