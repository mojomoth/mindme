// Route Handler 공통: 본문 읽기 → JSON → zod 검증, 공통 에러 응답(api.md '에러 응답').
// 비밀은 없지만 Route Handler 전용이라 @mindme/core/server 로만 내보낸다.
import type { z } from 'zod';
import { zodErrorMessage } from '../errors.ts';

export const fail = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status });

export type Handler = (req: Request) => Promise<Response>;

const TOO_LARGE = '보낸 내용이 너무 길어요. 조금 줄여서 다시 보내 주세요.';

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
  // 다른 사이트가 방문자 브라우저로 AI 비용을 쓰게 하는 요청(text/plain simple POST 등)을 막는다. 브라우저만 이 헤더를 붙이므로 curl·테스트는 그대로다.
  if (req.headers.get('sec-fetch-site') === 'cross-site') return { error: fail(403, 'forbidden', '다른 사이트에서 보낸 요청은 받을 수 없어요.') };
  const tooLarge = () => ({ error: fail(413, 'payload_too_large', opts.tooLarge ?? TOO_LARGE) });
  // UTF-16 한 글자는 UTF-8 로 최대 3바이트. 이보다 크면 읽지 않고 거른다.
  if (Number(req.headers.get('content-length') ?? 0) > opts.maxBody * 3) return tooLarge();
  const raw = await req.text();
  if (raw.length > opts.maxBody) return tooLarge();

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { error: fail(400, 'invalid_request', '보낸 내용을 읽지 못했어요. 다시 시도해 주세요.') };
  }
  if (opts.prepare) body = opts.prepare(body && typeof body === 'object' ? (body as Record<string, unknown>) : {});

  const parsed = schema.safeParse(body);
  if (parsed.success) return { data: parsed.data };
  // 본문 상한 안이어도 text 가 글자 수 상한을 넘으면 413 (api.md)
  const issue = parsed.error.issues[0];
  if (issue?.code === 'too_big' && issue.origin === 'string' && issue.path[0] === 'text') return tooLarge();
  return { error: fail(400, 'invalid_request', opts.invalid ?? zodErrorMessage(parsed.error)) };
}

/** 키 미설정. 사용자에게는 사유를 숨기고, 서버 로그에만 남긴다(키 값은 싣지 않는다). */
export function noKey(tag: string): Response {
  console.error(`[${tag}] OPENAI_API_KEY 가 설정되지 않았어요.`);
  return fail(503, 'provider_unavailable', '지금은 대화를 준비할 수 없어요. 잠시 후 다시 시도해 주세요.');
}

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

// ── 남용 방지: IP 기준 고정 창 속도 제한 ─────────────────────────
// 메모리는 서버 인스턴스마다 따로라 인스턴스가 여럿이면 한도도 그만큼 늘어난다. 공개 배포용 최소 보호다.
// IP 는 x-forwarded-for 첫 값(Vercel 이 채운다). 같은 공유기·학교망 사용자는 한도를 나눠 쓴다.

const hits = new Map<string, { count: number; reset: number }>();
const MAX_KEYS = 10_000;

const clientIp = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim() || 'unknown';

/** windowMs 동안 IP 당 limit 번까지 handler 를 부른다. 넘으면 429 rate_limited + Retry-After(초). */
export function rateLimit(name: string, limit: number, windowMs: number, handler: Handler): Handler {
  return async (req) => {
    const now = Date.now();
    if (hits.size >= MAX_KEYS) {
      for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
      if (hits.size >= MAX_KEYS) hits.clear();
    }
    const key = `${name}:${clientIp(req)}`;
    let h = hits.get(key);
    if (!h || h.reset <= now) hits.set(key, (h = { count: 0, reset: now + windowMs }));
    if (++h.count <= limit) return handler(req);

    const wait = Math.ceil((h.reset - now) / 1000);
    const when = wait < 60 ? '잠시' : `${Math.ceil(wait / 60)}분쯤`;
    const res = fail(429, 'rate_limited', `짧은 시간에 요청이 많았어요. ${when} 뒤에 다시 시도해 주세요.`);
    res.headers.set('Retry-After', String(wait));
    return res;
  };
}
