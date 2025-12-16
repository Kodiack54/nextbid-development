import type { NextConfig } from 'next';
import pkg from './package.json';

const nextConfig: NextConfig = {
  env: {
    BUILD_VERSION: pkg.version,
    BUILD_TIME: new Date().toISOString(),
  },
  // Allow connections from gateway
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;
