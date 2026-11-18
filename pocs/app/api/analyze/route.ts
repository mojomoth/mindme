import { AnalyzeInputError, AnalyzeRequestSchema, analyzeRecords } from '@mindme/core';
import { fail, generateObject, hasKey, noKey, parseRequest, upstreamFail } from '@mindme/core/server';

export const dynamic = 'force-dynamic';
// 300,000자 입력은 구간 요약(최대 약 10회, 동시 4) + 최종 분석까지 2~3분 걸릴 수 있다.
export const maxDuration = 300;

// text 상한 300,000자(UTF-16 길이) + JSON 이스케이프 여유
const MAX_BODY = 700_000;

export async function POST(req: Request) {
  const { data, error } = await parseRequest(req, AnalyzeRequestSchema, {
    maxBody: MAX_BODY,
    tooLarge: '입력이 너무 깁니다. 30만 자 이하로 줄여 주세요.',
  });
  if (error) return error;
  if (!hasKey('openai')) return noKey();

  try {
    return Response.json(await analyzeRecords(data, generateObject));
  } catch (err) {
    if (err instanceof AnalyzeInputError) return fail(400, 'invalid_request', err.message);
    return upstreamFail('api/analyze', err, '기록을 분석하지 못했어요. 잠시 뒤 다시 시도해 주세요.', 'AI 사용 한도에 걸렸어요. 잠시 뒤 다시 시도해 주세요.');
  }
}
