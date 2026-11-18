'use client';

import dynamic from 'next/dynamic';

// localStorage(분석 타임라인·저장된 페르소나)를 첫 렌더에서 바로 읽으려고 ssr: false 로 불러온다.
const PersonaPoc = dynamic(() => import('./PersonaPoc.tsx'), { ssr: false });

export default function Page() {
  return <PersonaPoc />;
}
