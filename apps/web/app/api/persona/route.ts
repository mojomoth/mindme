// 얇은 래퍼. 본문은 @mindme/core/server personaRoute.
import { personaRoute } from '@mindme/core/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const POST = personaRoute({ invalid: '페르소나를 만들 정보가 올바르지 않아요. 나이와 내용을 확인해 주세요.' });
