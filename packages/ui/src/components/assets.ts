// 캐릭터 이미지 (원본: assets/generated, 웹용 리사이즈본을 packages/ui/assets 에 둠)
import guide from '../../assets/guide-512.png';
import guideFace from '../../assets/guide-face-256.png';
import guideMark from '../../assets/guide-mark-128.png';
import guideAvatar from '../../assets/guide-avatar-256.png';
import guidePeek from '../../assets/guide-peek-512.png';
import guidePeekOpen from '../../assets/guide-peek-open-512.png';
import avatarTeen from '../../assets/avatar-teen-256.png';
import avatarYoung from '../../assets/avatar-young-256.png';

export const characters = {
  guide: guide.src,
  guideFace: guideFace.src,
  /** 로고 옆 얼굴 마크 (팔다리 없음) */
  guideMark: guideMark.src,
  /** 원형 아바타용으로 가깝게 자른 마스코트 */
  guideAvatar: guideAvatar.src,
  guidePeek: guidePeek.src,
  /** 눈을 뜬 빼꼼 (04 모달) */
  guidePeekOpen: guidePeekOpen.src,
  avatarTeen: avatarTeen.src,
  avatarYoung: avatarYoung.src,
} as const;
