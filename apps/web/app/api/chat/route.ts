// 얇은 래퍼. 본문은 @mindme/core/server chatRoute (text/plain 스트림).
import { chatRoute } from '@mindme/core/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const POST = chatRoute({ invalid: '대화 내용을 보내지 못했어요. 페르소나를 다시 열어 주세요.' });
