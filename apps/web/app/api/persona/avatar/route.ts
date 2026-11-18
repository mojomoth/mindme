// 얇은 래퍼. 본문은 @mindme/core/server avatarRoute.
// 웹 앱은 사진이 없으면 이 API 를 부르지 않고 기본 캐릭터를 그 자리에서 그린다(해시 경로를 저장하지 않도록).
import { avatarRoute, rateLimit } from '@mindme/core/server';
import guideFace from '../../../../../../assets/generated/guide-face-512.png';

export const dynamic = 'force-dynamic';
// gpt-image-2 편집은 30초 안팎 걸린다. SDK 타임아웃 110초보다 길게.
export const maxDuration = 120;
// 이미지 생성이 가장 비싸다. IP 당 10분에 15회
export const POST = rateLimit('avatar', 15, 600_000, avatarRoute({ defaultAvatar: guideFace.src }));
