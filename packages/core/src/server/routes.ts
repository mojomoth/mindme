// Route Handler 본문. 앱(pocs·apps/web)의 route.ts 는 `export const POST = xxxRoute({...})` 와 maxDuration 리터럴만 둔다.
// 흐름: 본문 검증(parseRequest) → 키 확인 → core 호출 → 입력 오류 400 / AI 오류 502(429 는 503).
import { analyzeRecords, AnalyzeInputError } from '../analysis/analyze.ts';
import { generateAvatar, generatePersona, PersonaInputError } from '../persona/server.ts';
import { PersonaGenerateRequestSchema } from '../persona/persona.ts';
import { chatResponse } from '../chat/server.ts';
import { AnalyzeRequestSchema, AvatarRequestSchema, ChatRequestSchema } from '../schemas.ts';
import { hasKey } from './env.ts';
import { dataUrlToFile, fail, noKey, parseRequest, upstreamFail, type Handler } from './http.ts';
import { generateObject } from './llm.ts';

type RouteOpts = {
  /** 검증 실패(400) 고정 문구. 없으면 zod 이슈를 한국어로 바꾼 문구 */
  invalid?: string;
  /** 검증 전에 본문을 손본다 */
  prepare?: (body: Record<string, unknown>) => unknown;
};

const RATE_LIMITED = 'AI 사용 한도에 걸렸어요. 잠시 뒤 다시 시도해 주세요.';

// text 상한 300,000자(UTF-16 길이) + JSON 이스케이프 여유.
// meta.llm(AI 원시 출력)은 includeLlm 을 준 개발 화면(pocs)에만 싣는다.
export const analyzeRoute = ({ includeLlm, ...o }: RouteOpts & { includeLlm?: boolean } = {}): Handler => async (req) => {
  const { data, error } = await parseRequest(req, AnalyzeRequestSchema, {
    maxBody: 700_000,
    tooLarge: '입력이 너무 길어요. 30만 자 이하로 줄여 주세요.',
    ...o,
  });
  if (error) return error;
  if (!hasKey('openai')) return noKey('api/analyze');
  try {
    const res = await analyzeRecords(data, generateObject);
    if (!includeLlm) delete res.meta.llm;
    return Response.json(res);
  } catch (err) {
    if (err instanceof AnalyzeInputError) return fail(400, 'invalid_request', err.message);
    return upstreamFail('api/analyze', err, '기록을 분석하지 못했어요. 잠시 뒤 다시 시도해 주세요.', RATE_LIMITED);
  }
};

// 사건 100개 x (요약·맥락 각 1000자) 를 넉넉히 넘는다
export const personaRoute = (o: RouteOpts = {}): Handler => async (req) => {
  const { data, error } = await parseRequest(req, PersonaGenerateRequestSchema, { maxBody: 1_000_000, ...o });
  if (error) return error;
  if (!hasKey('openai')) return noKey('api/persona');
  try {
    return Response.json({ persona: await generatePersona(data) });
  } catch (err) {
    if (err instanceof PersonaInputError) return fail(400, 'invalid_request', err.message);
    return upstreamFail('api/persona', err, '페르소나를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }
};

// AvatarRequestSchema 의 photo 상한(5.6M 자)에 JSON 껍데기 여유를 더한 값.
const AVATAR_MAX_BODY = 5_700_000;
const AVATAR_TOO_LARGE = '사진이 너무 커요. 더 작은 사진으로 해 주세요.';

/** JSON { age, kind, photo?: data URL }. 사진은 메모리에서만 쓰고 저장하지 않는다. 사진이 없으면 AI 없이 defaultAvatar. */
export const avatarRoute = (o: RouteOpts & { defaultAvatar: string }): Handler => async (req) => {
  // base64 본문은 ASCII 라 바이트 수 = 글자 수. 본문을 읽기 전에 헤더로 먼저 거른다.
  if (Number(req.headers.get('content-length') ?? 0) > AVATAR_MAX_BODY) return fail(413, 'payload_too_large', AVATAR_TOO_LARGE);
  const { data, error } = await parseRequest(req, AvatarRequestSchema, {
    maxBody: AVATAR_MAX_BODY,
    tooLarge: AVATAR_TOO_LARGE,
    invalid: o.invalid ?? '사진 형식을 확인해 주세요. JPG·PNG·WEBP 사진만 쓸 수 있어요.',
    prepare: o.prepare,
  });
  if (error) return error;
  const { age, kind, photo } = data;

  if (!photo) return Response.json({ avatar: o.defaultAvatar, source: 'default' });
  if (!hasKey('openai')) return noKey('api/persona/avatar');

  const started = Date.now();
  try {
    const avatar = await generateAvatar(dataUrlToFile(photo), age, kind);
    return Response.json({ avatar, source: 'generated' }, { headers: { 'Server-Timing': `gen;dur=${Date.now() - started}` } });
  } catch (err) {
    return upstreamFail('api/persona/avatar', err, '아바타를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }
};

// 100개 x 4000자 = 한글 기준 약 1.2MB 미만이라 충분하다. 응답은 text/plain 스트림.
export const chatRoute = (o: RouteOpts = {}): Handler => async (req) => {
  const { data, error } = await parseRequest(req, ChatRequestSchema, { maxBody: 1_000_000, ...o });
  if (error) return error;
  if (!hasKey('openai')) return noKey('api/chat');
  return chatResponse(data);
};
