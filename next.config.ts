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
  
  // Optimize bundle size for Cloudflare Pages
  // experimental: {
  //   optimizeCss: true, // Requires critters package
  // },
  
  // Vercel optimized webpack configuration
  webpack: (config: any, { isServer }: any) => {
    // Vercel handles optimization automatically, minimal custom config
    if (!isServer) {
      // Basic client optimization
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
          },
        },
      };
    }
    
    return config;
  },
  
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
    
    return [
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
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // HSTS - 仅在HTTPS环境下启用
          ...(isProduction ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          }] : []),
          // CSP - 内容安全策略
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://*.supabase.in",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  
  // Redirects
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
