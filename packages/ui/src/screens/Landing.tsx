import { characters } from '../components/assets.ts';
import { HeartBubble } from '../components/icons.tsx';
import { Wordmark } from '../components/Wordmark.tsx';
import shared from './shared.module.css';
import styles from './Landing.module.css';

export interface LandingProps {
  /** 하단 안내 문구. 자동 이동 타이머는 화면을 쓰는 쪽이 건다. */
  notice?: string;
  /** 화면을 누르면 바로 넘어가기 */
  onSkip?: () => void;
}

/** 01 랜딩 */
export function Landing({ notice = '3초 후 페르소나 만들기로 이동해요', onSkip }: LandingProps) {
  return (
    <main className={`${shared.screen} ${styles.landing}`} onClick={onSkip}>
      <header className={styles.logo}>
        <img src={characters.guideMark} alt="" width={40} height={40} />
        <Wordmark height={30} className={styles.wordmark} />
      </header>

      <section className={styles.middle}>
        <div className={styles.hero} aria-hidden>
          <img className={styles.mascot} src={characters.guide} alt="" draggable={false} />
          <HeartBubble size={72} className={styles.heart} />
          <span className={styles.shadow} />
        </div>
        <h1 className={styles.title}>다시 만나는, 그때의 나</h1>
        <p className={styles.sub}>
          기억 속 나와 나누는
          <br />
          조금 특별한 대화
        </p>
      </section>

      <footer className={styles.bottom} role="status">
        <span className={styles.dots} aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <p className={styles.notice}>{notice}</p>
      </footer>
    </main>
  );
}
