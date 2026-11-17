import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// 키는 모노레포 루트 .env 하나에서 관리한다 (서버 전용, NEXT_PUBLIC_ 금지).
// Next 가 pocs/ 기준으로 이미 env 를 로드·캐시했으므로 forceReload(4번째 인자)가 필요하다.
const root = path.resolve(__dirname, '..');
loadEnvConfig(root, process.env.NODE_ENV !== 'production', { info: () => {}, error: console.error }, true);

const nextConfig: NextConfig = {
  transpilePackages: ['@mindme/core', '@mindme/ui'],
  outputFileTracingRoot: root,
  turbopack: { root },
  devIndicators: false,
};

export default nextConfig;
