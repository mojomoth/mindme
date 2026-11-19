import type { ReactNode } from 'react';
import { Avatar } from '../components/Avatar.tsx';
import { characters } from '../components/assets.ts';
import { Burst, ChatDots, Check, ChevronRight, Plus } from '../components/icons.tsx';
import shared from './shared.module.css';
import styles from './PersonaList.module.css';
import type { PersonaListItem } from './types.ts';

export interface PersonaListProps {
  personas: PersonaListItem[];
  onSelect?: (id: string) => void;
  onCreate?: () => void;
  /** 오른쪽 위 말풍선 버튼. 없으면 버튼을 숨긴다. */
  onChats?: () => void;
  /** 상단 '페르소나가 준비됐어요' 알림 */
  showReady?: boolean;
  /** 모달 같은 겹침 요소 */
  children?: ReactNode;
}

/** 03 나의 페르소나 (메신저 친구 목록) */
export function PersonaList({ personas, onSelect, onCreate, onChats, showReady = true, children }: PersonaListProps) {
  return (
    <main className={shared.screen}>
      <nav className={shared.nav}>
        <h1 className={shared.navTitle}>나의 페르소나</h1>
        {onChats && (
          <button type="button" className={`${shared.iconBtn} ${shared.navRight} ${styles.chats}`} onClick={onChats} aria-label="최근 대화 열기">
            <ChatDots size={31} />
          </button>
        )}
      </nav>

      {showReady && (
        <p className={styles.ready} role="status">
          <span className={styles.readyIcon}>
            <Check />
          </span>
          페르소나가 준비됐어요
        </p>
      )}

      <section className={styles.hero}>
        <h2 className={styles.title}>
          어떤 나와
          <br />
          이야기할까요?
        </h2>
        <p className={styles.sub}>만나고 싶은 페르소나를 선택해 주세요</p>
        <span className={styles.heroArt} aria-hidden>
          <i className={styles.heroShadow} />
          <img src={characters.guide} alt="" draggable={false} />
          <Burst size={36} className={styles.burst} />
        </span>
      </section>

      <h3 className={styles.count}>페르소나 {personas.length}</h3>
      <ul className={styles.list}>
        {personas.map((p) => (
          <li key={p.id}>
            <button type="button" className={styles.row} onClick={() => onSelect?.(p.id)}>
              <Avatar src={p.avatarSrc} size={78} bg={p.avatarBg} />
              <span className={styles.text}>
                <strong>{p.name}</strong>
                <span>{p.description}</span>
                {p.isNew && <em>새로운 페르소나</em>}
              </span>
              <ChevronRight size={20} className={styles.chevron} />
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.peek}>
        <img src={characters.guidePeek} alt="" width={92} height={64} draggable={false} />
        <p>다른 순간의 나도 만나보세요</p>
      </div>

      <div className={shared.bottomBar}>
        <button type="button" className={shared.primary} onClick={onCreate}>
          <Plus size={24} />
          페르소나 생성
        </button>
      </div>
      {children}
    </main>
  );
}
