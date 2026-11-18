import { analyzeRoute } from '@mindme/core/server';

export const dynamic = 'force-dynamic';
// 300,000자 입력은 구간 요약(최대 약 10회, 동시 4) + 최종 분석까지 2~3분 걸릴 수 있다.
export const maxDuration = 300;
export const POST = analyzeRoute();
