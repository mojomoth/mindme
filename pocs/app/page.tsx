import Link from 'next/link';
import styles from './pocs/pocs.module.css';

export default function Home() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>mindme</h1>
      <p className={styles.lead}>기술 검증용 화면은 PoC 목록에 모여 있어요.</p>
      <Link className={styles.button} href="/pocs">
        PoC 목록으로 이동
      </Link>
    </main>
  );
}
