import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// 로컬에서는 모노레포 루트 .env 하나에서 키를 읽는다 (서버 전용, NEXT_PUBLIC_ 금지).
// Vercel 에서는 프로젝트 환경 변수를 쓰므로 읽지 않는다. Next 가 apps/web 기준으로 이미 env 를 캐시해서 forceReload 가 필요하다.
const root = path.resolve(__dirname, '../..');
if (!process.env.VERCEL) loadEnvConfig(root, process.env.NODE_ENV !== 'production', { info: () => {}, error: console.error }, true);

const nextConfig: NextConfig = {
  transpilePackages: ['@mindme/core', '@mindme/ui'],
  outputFileTracingRoot: root,
  turbopack: { root },
  devIndicators: false,
  // 사진은 카메라·앨범 선택(<input accept="image/*">)으로만 받는다. 마이크·위치는 쓰지 않는다.
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' }] }];
  },
};

export default nextConfig;
