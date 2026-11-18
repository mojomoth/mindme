'use client';

// localStorage(타임라인)를 첫 렌더에서 바로 읽으려고 ssr: false 로 불러온다.
import dynamic from 'next/dynamic';

export default dynamic(() => import('./Analysis.tsx'), { ssr: false });
