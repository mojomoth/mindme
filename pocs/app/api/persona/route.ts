import { PersonaGenerateRequestSchema } from '@mindme/core';
import { fail, generatePersona, hasKey, noKey, parseRequest, PersonaInputError, upstreamFail } from '@mindme/core/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BODY = 1_000_000; // 사건 100개 x (요약·맥락 각 1000자) 를 넉넉히 넘는다

export async function POST(req: Request) {
  const { data, error } = await parseRequest(req, PersonaGenerateRequestSchema, { maxBody: MAX_BODY });
  if (error) return error;
  if (!hasKey('openai')) return noKey();

  try {
    return Response.json({ persona: await generatePersona(data) });
  } catch (err) {
    if (err instanceof PersonaInputError) return fail(400, 'invalid_request', err.message);
    return upstreamFail('api/persona', err, '페르소나를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }
}
