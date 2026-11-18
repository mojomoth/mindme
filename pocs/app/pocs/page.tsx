import Link from 'next/link';
import styles from './pocs.module.css';

const POCS = [
  { href: '/pocs/analysis', title: '기록 분석', desc: '카카오톡 TXT·일기·프롬프트에서 사건 타임라인 추출' },
  { href: '/pocs/persona', title: '페르소나 생성', desc: '과거·현재·미래의 나 — 성격·말투·기억·감정 설정' },
  { href: '/pocs/chat', title: '대화', desc: '페르소나와 스트리밍 대화' },
  { href: '/pocs/screens', title: '화면', desc: '5개 화면 프론트엔드 (목업 셸)' },
] as const;

export default function PocIndex() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>PoC 목록</h1>
      <ul className={styles.list}>
        {POCS.map((poc) => (
          <li key={poc.href}>
            <Link className={styles.item} href={poc.href}>
              <Item {...poc} />
            </Link>
          </li>
        ))}
      </ul>
      <p className={styles.foot}>
        상태 확인: <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}

function Item({ href, title, desc }: (typeof POCS)[number]) {
  return (
    <>
      <span className={styles.itemHead}>
        <strong>{title}</strong>
        <span className={styles.badgeOn}>열기</span>
      </span>
      <span className={styles.desc}>{desc}</span>
      <code className={styles.path}>{href}</code>
    </>
  );
}
