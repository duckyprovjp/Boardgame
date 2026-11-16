import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@boardgame/shared'],
};

export default nextConfig;
