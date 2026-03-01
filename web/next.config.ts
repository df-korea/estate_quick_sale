import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  compress: true,
  serverExternalPackages: ['pg'],
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
  env: {
    KAKAO_JAVASCRIPT_KEY: process.env.KAKAO_JAVASCRIPT_KEY || '',
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const rootDir = path.resolve(process.cwd(), '..');
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...config.resolve.alias,
        '@api': path.resolve(rootDir, 'api'),
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
    ];
  },
};

export default nextConfig;
