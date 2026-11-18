// 얇은 래퍼. 본문은 @mindme/core/server analyzeRoute.
import { analyzeRoute } from '@mindme/core/server';

export const dynamic = 'force-dynamic';
// 4만 자 이하는 한 번에 분석(20~35초). 더 길면 구간 요약이 붙어 60초를 넘길 수 있다.
export const maxDuration = 60;
export const POST = analyzeRoute({ invalid: '기록 내용을 읽지 못했어요. 파일이나 이야기를 다시 확인해 주세요.' });
