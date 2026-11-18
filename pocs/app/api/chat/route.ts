import { ChatRequestSchema, SAMPLE_PERSONA } from '@mindme/core';
import { chatResponse, hasKey, noKey, parseRequest } from '@mindme/core/server';

export const dynamic = 'force-dynamic';

const MAX_BODY = 1_000_000; // 100개 x 4000자 = 한글 기준 약 1.2MB 미만이라 충분하다

export async function POST(req: Request) {
  const { data, error } = await parseRequest(req, ChatRequestSchema, {
    maxBody: MAX_BODY,
    invalid: 'message',
    // persona 가 없으면 내장 샘플(15살의 홍길동)로 대화한다.
    prepare: (body) => ({ ...body, persona: body.persona ?? SAMPLE_PERSONA }),
  });
  if (error) return error;
  if (!hasKey('openai')) return noKey();
  return chatResponse(data);
}
