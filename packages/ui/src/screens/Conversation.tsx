'use client';

import { useEffect, useRef } from 'react';
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
  /** 헤더 아바타·이름을 누르면 (프로필 보기) */
  onProfile?: () => void;
  /** 답변을 기다리는 동안 보내기 막기 */
  sendDisabled?: boolean;
  /** 답변 실패 안내. onRetry 가 있으면 '다시 받기' 버튼 */
  error?: string;
  onRetry?: () => void;
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
  onProfile,
  sendDisabled,
  error,
  onRetry,
}: ConversationProps) {
  const canSend = draft.trim().length > 0 && !sendDisabled;
  const end = useRef<HTMLDivElement>(null);
  const last = messages.at(-1);

  // 새 말풍선·입력 중 표시·스트리밍으로 길어지는 답변이 입력창 뒤에 가리지 않게 맨 아래로 내린다.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, last?.text, typing, error]);

  const face = <Avatar src={persona.avatarSrc} size={52} bg={persona.avatarBg} zoom={1.3} />;

  return (
    <main className={shared.screen}>
      <header className={styles.header} data-statusbar-under>
        <button type="button" className={shared.iconBtn} onClick={onBack} aria-label="뒤로">
          <ChevronLeft size={28} />
        </button>
        {onProfile ? (
          <button type="button" className={styles.profile} onClick={onProfile} aria-label="프로필 보기">
            {face}
          </button>
        ) : (
          face
        )}
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

        {error && (
          <p className={styles.error} role="alert">
            {error}
            {onRetry && (
              <button type="button" onClick={onRetry}>
                다시 받기
              </button>
            )}
          </p>
        )}
      </section>

      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) onSend?.();
        }}
      >
        <textarea
          className={styles.input}
          rows={1}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter 보내기, Shift+Enter 줄바꿈. 한글 조합 중 Enter 는 글자 확정이라 무시한다.
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            if (canSend) onSend?.();
          }}
          placeholder="메시지를 입력하세요"
          aria-label="메시지"
          enterKeyHint="send"
          maxLength={4000}
        />
        <button type="submit" className={styles.send} aria-label="보내기" disabled={!canSend}>
          <ArrowUp size={26} />
        </button>
      </form>
      <div ref={end} aria-hidden />
    </main>
  );
}
