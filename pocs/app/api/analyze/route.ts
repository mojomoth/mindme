import { analyzeRoute } from '@mindme/core/server';

export const dynamic = 'force-dynamic';
// 300,000자 입력은 구간 요약(약 10회, 모두 동시) + 최종 분석. apps/web 과 같은 300초.
export const maxDuration = 300;
// 개발 화면이 'AI 원시 응답'을 보여 주므로 meta.llm 을 싣는다.
export const POST = analyzeRoute({ includeLlm: true });
