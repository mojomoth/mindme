import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@mindme/ui/tokens.css';

export const metadata: Metadata = {
  title: 'Mindme PoC',
  description: '과거·현재·미래의 나와 나누는 대화 — 기술 검증',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f0f6fa',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
