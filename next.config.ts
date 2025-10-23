import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages with Functions support
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  
  // Output directory for Cloudflare Pages
  distDir: 'dist',
  
  // Optimize for production
  compress: true,
  
  // Optimize bundle size for Cloudflare Pages
  // experimental: {
  //   optimizeCss: true, // Requires critters package
  // },
  
  // Webpack optimization
  webpack: (config: any, { isServer }: any) => {
    if (!isServer) {
      // Optimize client bundle
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
  
  // External packages for server components
  serverExternalPackages: ['@supabase/supabase-js'],
  
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
