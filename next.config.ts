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
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || '66Do',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3078',
  },
  
  // Headers for security
  async headers() {
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
