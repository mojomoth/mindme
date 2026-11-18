// 화면에서 쓰는 인라인 SVG 아이콘. 색은 currentColor 를 따른다.
type P = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const ChevronLeft = ({ size = 28, className }: P) => (
  <svg viewBox="0 0 24 24" strokeWidth={2} className={className} {...base(size)}>
    <path d="M15 4.5 7.5 12l7.5 7.5" />
  </svg>
);

export const ChevronRight = ({ size = 22, className }: P) => (
  <svg viewBox="0 0 24 24" strokeWidth={2.2} className={className} {...base(size)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const Close = ({ size = 26, className }: P) => (
  <svg viewBox="0 0 24 24" strokeWidth={1.8} className={className} {...base(size)}>
    <path d="M5 5l14 14M19 5 5 19" />
  </svg>
);

export const Check = ({ size = 14, className }: P) => (
  <svg viewBox="0 0 24 24" strokeWidth={3.4} className={className} {...base(size)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const Plus = ({ size = 22, className }: P) => (
  <svg viewBox="0 0 24 24" strokeWidth={2.6} className={className} {...base(size)}>
    <path d="M12 4v16M4 12h16" />
  </svg>
);

export const ArrowUp = ({ size = 24, className }: P) => (
  <svg viewBox="0 0 24 24" strokeWidth={2.6} className={className} {...base(size)}>
    <path d="M12 20V4.5M5.5 11 12 4.5l6.5 6.5" />
  </svg>
);

/** 말줄임표가 든 말풍선 (03 헤더 오른쪽) */
export const ChatDots = ({ size = 30, className }: P) => (
  <svg viewBox="0 0 32 32" strokeWidth={2.4} className={className} {...base(size)}>
    <path d="M16 4.5c7 0 12.5 4.6 12.5 10.5S23 25.5 16 25.5c-1.3 0-2.6-.2-3.8-.5L6 28l1.4-5.2C5 20.9 3.5 18.1 3.5 15 3.5 9.1 9 4.5 16 4.5Z" />
    <circle cx="10.5" cy="15" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="16" cy="15" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="21.5" cy="15" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

/** 접힌 모서리 문서 + 주황 플러스 (02 TXT 업로드) */
export const FilePlus = ({ size = 40, className }: P) => (
  <svg viewBox="0 0 36 42" width={size} height={(size * 42) / 36} fill="none" className={className} aria-hidden>
    <path
      d="M7 2.5h16l10.5 10.5v22.5a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-29a4 4 0 0 1 4-4Z"
      stroke="#5b636c"
      strokeWidth="2.6"
      strokeLinejoin="round"
    />
    <path d="M23 2.5v7.5a3 3 0 0 0 3 3h7.5" stroke="#5b636c" strokeWidth="2.6" strokeLinejoin="round" />
    <path d="M18 18.5v11M12.5 24h11" stroke="var(--mm-primary)" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

export const ImageIcon = ({ size = 24, className }: P) => (
  <svg viewBox="0 0 24 24" strokeWidth={1.9} className={className} {...base(size)}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="15.5" cy="9" r="1.6" />
    <path d="m3.5 17 5-5 4 4 2.5-2.5 5 5" />
  </svg>
);

/** 주황 반짝이 두 개 (04 모달 왼쪽 위) */
export const Sparkle = ({ size = 30, className }: P) => (
  <svg viewBox="0 0 30 30" width={size} height={size} fill="var(--mm-primary)" className={className} aria-hidden>
    <path d="M11 9c.7 4.3 2.7 6.3 7 7-4.3.7-6.3 2.7-7 7-.7-4.3-2.7-6.3-7-7 4.3-.7 6.3-2.7 7-7Z" />
    <path d="M22 3c.4 2.4 1.6 3.6 4 4-2.4.4-3.6 1.6-4 4-.4-2.4-1.6-3.6-4-4 2.4-.4 3.6-1.6 4-4Z" />
  </svg>
);

/** 캐릭터 옆 주황 강조선 세 줄 (03 상단) */
export const Burst = ({ size = 24, className }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#ff8a3d" strokeWidth={2.6} strokeLinecap="round" className={className} aria-hidden>
    <path d="M18 2.5 16.5 8M11 5.5l3 4.5M5 12.5l6 1" />
  </svg>
);

/** 흰 말풍선 안의 주황 하트 (01 랜딩) */
export const HeartBubble = ({ size = 68, className }: P) => (
  <svg viewBox="0 0 68 72" width={size} height={(size * 72) / 68} className={className} aria-hidden>
    <defs>
      <radialGradient id="mm-hb" cx="40%" cy="35%" r="70%">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#eef3f7" />
      </radialGradient>
    </defs>
    <path
      d="M34 2c17.7 0 32 13.4 32 30S51.7 62 34 62c-4 0-7.9-.7-11.4-2C18.5 64.5 11 70 4.5 70.5 8.5 66 10.6 61.4 10.8 55.4 5.3 50 2 41.4 2 32 2 15.4 16.3 2 34 2Z"
      fill="url(#mm-hb)"
    />
    <path
      d="M34 45.5c-.6 0-1.2-.2-1.7-.6C26 39.9 21 35.6 21 29.6c0-4.3 3.3-7.6 7.3-7.6 2.3 0 4.3 1 5.7 2.8 1.4-1.8 3.4-2.8 5.7-2.8 4 0 7.3 3.3 7.3 7.6 0 6-5 10.3-11.3 15.3-.5.4-1.1.6-1.7.6Z"
      fill="#ff5b2a"
    />
  </svg>
);
