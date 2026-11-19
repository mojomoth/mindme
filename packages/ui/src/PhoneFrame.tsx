import type { ReactNode } from 'react';
import mockup from './assets/mockup-iphone.png';
import styles from './PhoneFrame.module.css';

/**
 * 데스크톱: 아이폰 목업 중앙 + 목업의 투명 화면 영역에 앱 표시(프레임이 위에 겹침).
 * 모바일(<=600px): 목업 없이 전체 화면 + safe-area.
 * 앱은 --mm-safe-top / --mm-safe-bottom 으로 상단·하단 여백을 잡는다.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.stage}>
      <div className={styles.device}>
        <div className={styles.scaler}>
          <div className={styles.screen}>
            <StatusBar />
            <div className={styles.content}>{children}</div>
            <div className={styles.homeIndicator} aria-hidden />
          </div>
          {/* 모바일(CSS 와 같은 600px 이하)에서는 목업을 내려받지 않는다 */}
          <picture>
            <source media="(max-width: 600px)" srcSet="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" />
            <img className={styles.frame} src={mockup.src} width={851} height={1848} alt="" draggable={false} />
          </picture>
        </div>
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className={styles.statusBar} aria-hidden>
      <span>9:41</span>
      <span className={styles.statusIcons}>
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
          <path d="M8 2.6c2.3 0 4.4.9 6 2.4l1.1-1.2A10.3 10.3 0 0 0 8 1 10.3 10.3 0 0 0 .9 3.8L2 5c1.6-1.5 3.7-2.4 6-2.4Zm0 3.3c1.4 0 2.7.5 3.7 1.4l1.1-1.2A7 7 0 0 0 8 4.3a7 7 0 0 0-4.8 1.8l1.1 1.2c1-.9 2.3-1.4 3.7-1.4Zm0 3.3c.6 0 1.1.2 1.5.5L8 11.4 6.5 9.7c.4-.3.9-.5 1.5-.5Z" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="currentColor" opacity="0.4" />
          <rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor" />
          <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity="0.4" />
        </svg>
      </span>
    </div>
  );
}
