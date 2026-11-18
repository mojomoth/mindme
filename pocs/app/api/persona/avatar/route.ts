import { avatarRoute } from '@mindme/core/server';
import guideFace from '../../../../../assets/generated/guide-face-512.png';

export const dynamic = 'force-dynamic';
// gpt-image-2 편집은 30초 안팎 걸린다(실측은 docs/dev-v1/logs/gate1-persona.md). SDK 타임아웃 110s 보다 길게.
export const maxDuration = 120;
// 개발 화면이라 검증 실패 문구에 필드 이름을 그대로 보여 준다(api.md).
export const POST = avatarRoute({
  defaultAvatar: guideFace.src,
  invalid: 'age(1~120), kind(past|present|future), photo(JPG·PNG·WEBP data URL)를 확인해 주세요.',
});
