// 얇은 래퍼. 본문은 @mindme/core/server personaRoute.
import { personaRoute, rateLimit } from '@mindme/core/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
// IP 당 10분에 30회 (처음 만들 때 최대 3명 + 추가·재시도)
export const POST = rateLimit('persona', 30, 600_000, personaRoute({ invalid: '페르소나를 만들 정보가 올바르지 않아요. 나이와 내용을 확인해 주세요.' }));
