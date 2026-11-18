import { Avatar } from '../components/Avatar.tsx';
import { ArrowUp, ChevronLeft } from '../components/icons.tsx';
import shared from './shared.module.css';
import styles from './Conversation.module.css';
import type { ChatBubbleItem } from './types.ts';

export interface ConversationProps {
  persona: { name: string; avatarSrc: string; avatarBg?: string };
  status?: string;
  dateLabel?: string;
  /** 날짜 아래 안내 ('15살의 나와 대화를 시작했어요') */
  startCaption?: string;
  messages: ChatBubbleItem[];
  /** 상대가 입력 중 */
  typing?: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend?: () => void;
  onBack?: () => void;
  onExit?: () => void;
}

/** 05 대화 */
export function Conversation({
  persona,
  status = '그때의 나와 대화 중',
  dateLabel = '오늘',
  startCaption,
  messages,
  typing,
  draft,
  onDraftChange,
  onSend,
  onBack,
  onExit,
}: ConversationProps) {
  const canSend = draft.trim().length > 0;
  return (
    <main className={shared.screen}>
      <header className={styles.header}>
        <button type="button" className={shared.iconBtn} onClick={onBack} aria-label="뒤로">
          <ChevronLeft size={28} />
        </button>
        <Avatar src={persona.avatarSrc} size={52} bg={persona.avatarBg} zoom={1.3} />
        <div className={styles.who}>
          <h1>{persona.name}</h1>
          <p>{status}</p>
        </div>
        <button type="button" className={styles.exit} onClick={onExit}>
          나가기
        </button>
      </header>

      <section className={styles.log} aria-live="polite">
        <p className={styles.date}>
          <span>{dateLabel}</span>
        </p>
        {startCaption && <p className={styles.caption}>{startCaption}</p>}

        {messages.map((m) =>
          m.from === 'persona' ? (
            <div key={m.id} className={styles.in}>
              <Avatar src={persona.avatarSrc} size={42} bg={persona.avatarBg} zoom={1.3} />
              <div>
                <p className={styles.bubbleIn}>{m.text}</p>
                <time className={styles.time}>{m.time}</time>
              </div>
            </div>
          ) : (
            <div key={m.id} className={styles.out}>
              <p className={styles.bubbleOut}>{m.text}</p>
              <time className={styles.time}>{m.time}</time>
            </div>
          ),
        )}

        {typing && (
          <div className={styles.in}>
            <Avatar src={persona.avatarSrc} size={42} bg={persona.avatarBg} zoom={1.3} />
            <p className={`${styles.bubbleIn} ${styles.typing}`} aria-label="입력 중">
              <i />
              <i />
              <i />
            </p>
          </div>
        )}
      </section>

      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) onSend?.();
        }}
      >
        <input
          className={styles.input}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="메시지를 입력하세요"
          aria-label="메시지"
          enterKeyHint="send"
          maxLength={4000}
        />
        <button type="submit" className={styles.send} aria-label="보내기" disabled={!canSend}>
          <ArrowUp size={26} />
        </button>
      </form>
    </main>
  );
}
