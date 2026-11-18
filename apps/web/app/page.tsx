'use client';

import { Landing, PhoneFrame } from '@mindme/ui';
import dynamic from 'next/dynamic';

// 저장된 페르소나(localStorage)를 첫 렌더에서 바로 읽으려고 ssr: false 로 불러온다. 그동안은 같은 랜딩을 보여 준다.
const MindmeApp = dynamic(() => import('./MindmeApp.tsx'), {
  ssr: false,
  loading: () => (
    <PhoneFrame>
      <Landing />
    </PhoneFrame>
  ),
});

export default function Page() {
  return <MindmeApp />;
}
