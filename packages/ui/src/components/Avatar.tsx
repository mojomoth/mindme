import styles from './Avatar.module.css';

/** 원형 아바타. 배경색은 캐릭터마다 다르다(드래프트 기준 파랑·노랑·복숭아). */
export function Avatar({ src, size, bg = 'var(--mm-avatar-blue)', zoom = 1.08 }: { src: string; size: number; bg?: string; zoom?: number }) {
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, background: bg, '--zoom': zoom } as React.CSSProperties}
    >
      <img src={src} alt="" draggable={false} />
    </span>
  );
}
