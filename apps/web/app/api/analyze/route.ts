// 얇은 래퍼. 본문은 @mindme/core/server analyzeRoute.
import { analyzeRoute, rateLimit } from '@mindme/core/server';

export const dynamic = 'force-dynamic';
// Vercel fluid compute 의 Hobby 최대(=Pro 기본) 300초. 30만 자도 구간 요약을 모두 동시에 보내
// 최악 약 250초 안에 끝난다(core analyze.ts, logs/gate3-server.md).
export const maxDuration = 300;
// IP 당 10분에 10회 (한 번 만들 때 1~2회 호출)
export const POST = rateLimit('analyze', 10, 600_000, analyzeRoute({ invalid: '기록 내용을 읽지 못했어요. 파일이나 이야기를 다시 확인해 주세요.' }));
