// Route Handler 공통: 본문 읽기 → JSON → zod 검증, 공통 에러 응답(api.md '에러 응답').
// 비밀은 없지만 Route Handler 전용이라 @mindme/core/server 로만 내보낸다.
import type { z } from 'zod';
import { zodErrorMessage } from '../errors.ts';

export const fail = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status });

type ParseOpts = {
  /** 본문 상한(UTF-16 길이). 넘으면 413 */
  maxBody: number;
  /** 413 문구 */
  tooLarge?: string;
  /** 검증 실패(400) 고정 문구. 없으면 첫 번째 zod 이슈를 한국어로 바꾼 문구(errors.ts) */
  invalid?: string;
  /** 검증 전에 본문을 손본다 (예: 빠진 값 기본값 채우기) */
  prepare?: (body: Record<string, unknown>) => unknown;
};

/** 성공하면 { data }, 실패하면 그대로 돌려줄 { error: Response }. */
export async function parseRequest<S extends z.ZodType>(
  req: Request,
  schema: S,
  opts: ParseOpts,
): Promise<{ data: z.infer<S>; error?: undefined } | { data?: undefined; error: Response }> {
  const raw = await req.text();
  if (raw.length > opts.maxBody) return { error: fail(413, 'payload_too_large', opts.tooLarge ?? '요청 본문이 너무 큽니다.') };

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { error: fail(400, 'invalid_request', 'JSON 형식이 아닙니다.') };
  }
  if (opts.prepare) body = opts.prepare(body && typeof body === 'object' ? (body as Record<string, unknown>) : {});

  const parsed = schema.safeParse(body);
  if (parsed.success) return { data: parsed.data };
  return { error: fail(400, 'invalid_request', opts.invalid ?? zodErrorMessage(parsed.error)) };
}

export const noKey = () => fail(503, 'provider_unavailable', 'AI 공급자 키가 설정되지 않았습니다.');

/**
 * AI 호출 실패 → 502 upstream_error. 로그에는 키가 가려진 메시지만 남긴다(llm.ts 가 가림).
 * rateLimited 를 주면 HTTP 429 는 그 문구로 503 provider_unavailable.
 */
export function upstreamFail(tag: string, err: unknown, message: string, rateLimited?: string): Response {
  const text = err instanceof Error ? err.message : String(err);
  console.error(`[${tag}]`, text);
  if (rateLimited && text.includes('(HTTP 429)')) return fail(503, 'provider_unavailable', rateLimited);
  return fail(502, 'upstream_error', message);
}

/** 'data:image/png;base64,…' → File. 형식은 AvatarRequestSchema 가 이미 검증했다. */
export function dataUrlToFile(dataUrl: string, name = 'photo'): File {
  const [, type, b64] = /^data:(image\/\w+);base64,(.*)$/.exec(dataUrl)!;
  return new File([Buffer.from(b64!, 'base64')], `${name}.${type!.slice(6)}`, { type });
}
