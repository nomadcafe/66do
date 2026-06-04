import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel optimized configuration
  trailingSlash: false,
  images: {
    unoptimized: false, // Enable Vercel image optimization
  },
  
  // Remove distDir for Vercel (uses .next by default)
  // distDir: 'dist', // Not needed for Vercel
  
  // Optimize for production
  compress: true,

  // External packages for server components (minimal set to avoid conflicts)
  serverExternalPackages: [
    '@supabase/supabase-js',
    'sharp',
    'canvas'
  ],
  
  // Environment variables
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Domain Financial',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3078',
  },
  
  // Headers for security
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production'
    
    const noStoreDocument = 'private, no-store, no-cache, must-revalidate, max-age=0';

    return [
      {
        source: '/',
        headers: [{ key: 'Cache-Control', value: noStoreDocument }],
      },
      {
        source: '/dashboard',
        headers: [{ key: 'Cache-Control', value: noStoreDocument }],
      },
      {
        source: '/dashboard/:path*',
        headers: [{ key: 'Cache-Control', value: noStoreDocument }],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // Device-capability opt-outs only. The Topics API equivalent
            // ('browsing-topics') is dropped intentionally: Firefox and Safari
            // don't implement it and log a console warning for each request,
            // and the privacy gain for a domain-tracking app is negligible.
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'microphone=()',
              'geolocation=()',
              'payment=()',
              'usb=()',
              'magnetometer=()',
              'gyroscope=()',
              'accelerometer=()',
            ].join(', '),
          },
          // HSTS - 仅在HTTPS环境下启用
          ...(isProduction ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          }] : []),
          // Content-Security-Policy is now emitted by middleware.ts so that
          // every HTML response carries a per-request nonce -- see the nonce
          // recipe in the Next.js CSP docs. Setting it here too would race
          // with the per-request header.
        ],
      },
    ];
  },
  
  // Redirects
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/en',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
