import { PhoneFrame } from '@mindme/ui';
import styles from './screens.module.css';

export default function ScreensPoc() {
  return (
    <PhoneFrame>
      <main className={styles.placeholder}>
        <strong>화면 준비 중</strong>
        <p>랜딩 · 페르소나 만들기 · 목록 · 모달 · 대화
          <br />
          다섯 화면이 이 자리에 들어와요.
        </p>
      </main>
    </PhoneFrame>
  );
}
