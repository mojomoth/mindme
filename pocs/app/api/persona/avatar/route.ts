import { AvatarRequestSchema } from '@mindme/core';
import { dataUrlToFile, fail, generateAvatar, hasKey, noKey, parseRequest, upstreamFail } from '@mindme/core/server';
import guideFace from '../../../../../assets/generated/guide-face-512.png';

export const dynamic = 'force-dynamic';
// gpt-image-2 편집은 30초 안팎 걸린다(실측은 docs/dev-v1/logs/gate1-persona.md). SDK 타임아웃 110s 보다 길게.
export const maxDuration = 120;

// AvatarRequestSchema 의 photo 상한(5.6M 자)에 JSON 껍데기 여유를 더한 값. Vercel 요청 본문 4.5MB 제한보다 작게 쓰려면
// 클라이언트가 긴 변 1024px JPEG 로 줄여서 보낸다(보통 300KB 안팎).
const MAX_BODY = 5_700_000;
const TOO_LARGE = '사진이 너무 커요. 더 작은 사진으로 해 주세요.';

// JSON { age, kind, photo?: data URL } (api.md). 사진은 메모리에서만 쓰고 저장하지 않는다.
export async function POST(req: Request) {
  // base64 본문은 ASCII 라 바이트 수 = 글자 수. 본문을 읽기 전에 헤더로 먼저 거른다.
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return fail(413, 'payload_too_large', TOO_LARGE);
  const { data, error } = await parseRequest(req, AvatarRequestSchema, {
    maxBody: MAX_BODY,
    tooLarge: TOO_LARGE,
    invalid: 'age(1~120), kind(past|present|future), photo(JPG·PNG·WEBP data URL)를 확인해 주세요.',
  });
  if (error) return error;
  const { age, kind, photo } = data;

  // 사진이 없으면 AI 를 부르지 않고 기본 캐릭터를 돌려준다.
  if (!photo) return Response.json({ avatar: guideFace.src, source: 'default' });
  if (!hasKey('openai')) return noKey();

  const started = Date.now();
  try {
    const avatar = await generateAvatar(dataUrlToFile(photo), age, kind);
    return Response.json({ avatar, source: 'generated' }, { headers: { 'Server-Timing': `gen;dur=${Date.now() - started}` } });
  } catch (err) {
    return upstreamFail('api/persona/avatar', err, '아바타를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }
}
