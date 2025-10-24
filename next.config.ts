import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages with Functions support
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  
  // Output directory for Cloudflare Pages
  distDir: 'dist',
  
  // Static export for Cloudflare Pages
  output: 'export',
  
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
        maxSize: 200000, // 200KB per chunk
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
            maxSize: 200000,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
            maxSize: 200000,
          },
          common: {
            name: 'common',
            minChunks: 2,
            priority: -5,
            reuseExistingChunk: true,
            maxSize: 200000,
          },
        },
      };
    }
    
    // Exclude large packages from server bundle
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'sharp': 'commonjs sharp',
        'canvas': 'commonjs canvas',
        'recharts': 'commonjs recharts',
        'lucide-react': 'commonjs lucide-react',
        'crypto-js': 'commonjs crypto-js',
        'date-fns': 'commonjs date-fns',
      });
      
      // Optimize server bundle - more aggressive splitting
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          maxSize: 50000, // 50KB per chunk
          minSize: 10000, // 10KB minimum
          cacheGroups: {
            server: {
              test: /[\\/]node_modules[\\/]/,
              name: 'server-vendor',
              chunks: 'all',
              maxSize: 50000,
              minSize: 10000,
            },
            serverCommon: {
              name: 'server-common',
              chunks: 'all',
              maxSize: 50000,
              minSize: 10000,
            },
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
