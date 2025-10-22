'use client';

import { useEffect, useRef, useState } from 'react';

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
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    let script: HTMLScriptElement | null = null;
    let widgetId: string | null = null;

    const loadTurnstile = () => {
      // Check if script already exists
      const existingScript = document.querySelector('script[src*="turnstile"]');
      if (existingScript) {
        if (window.turnstile) {
          renderWidget();
        } else {
          existingScript.addEventListener('load', renderWidget);
        }
        return;
      }

      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.onload = () => {
        setIsLoaded(true);
        renderWidget();
      };
      script.onerror = () => {
        console.error('Failed to load Turnstile script');
        onError?.('Failed to load verification service');
      };
      document.head.appendChild(script);
    };

    const renderWidget = () => {
      if (!window.turnstile || !turnstileRef.current || isRendered) return;

      try {
        widgetId = window.turnstile.render(turnstileRef.current, {
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
        setIsRendered(true);
      } catch (error) {
        console.error('Turnstile render error:', error);
        onError?.('Failed to initialize verification');
      }
    };

    loadTurnstile();

    return () => {
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch (error) {
          console.error('Error removing Turnstile widget:', error);
        }
      }
    };
  }, [siteKey, onVerify, onError, onExpire, theme, size, isRendered]);

  return (
    <div className={`turnstile-container ${className}`}>
      <div ref={turnstileRef} className="turnstile-widget" />
      {!isLoaded && (
        <div className="flex items-center justify-center p-4 border border-gray-300 rounded-md bg-gray-50">
          <div className="text-sm text-gray-500">加载验证码中...</div>
        </div>
      )}
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
