'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar.tsx';
import { Close } from '../components/icons.tsx';
import { useEscape } from '../components/useEscape.ts';
import shared from './shared.module.css';
import styles from './ProfileSheet.module.css';

export interface ProfileValues {
  name: string;
  traits: string[];
  speechStyle: string;
  memories: string[];
  emotions: string[];
}

export interface ProfileSheetProps {
  initial: ProfileValues;
  avatarSrc: string;
  avatarBg?: string;
  /** 이름 아래 한 줄 ('15살 · 과거의 나') */
  caption?: string;
  onSave: (values: ProfileValues) => void;
  onDelete: () => void;
  onClose: () => void;
  /** 저장 실패 등 */
  error?: string;
}

const split = (s: string, sep: RegExp) => s.split(sep).map((x) => x.trim()).filter(Boolean);

/** 페르소나 수정·확정 시트 (05 대화 위에 겹쳐 쓴다). 입력 중인 값은 시트가 들고 있다가 저장할 때 넘긴다. */
export function ProfileSheet({ initial, avatarSrc, avatarBg, caption, onSave, onDelete, onClose, error }: ProfileSheetProps) {
  const [name, setName] = useState(initial.name);
  const [traits, setTraits] = useState(initial.traits.join(', '));
  const [speech, setSpeech] = useState(initial.speechStyle);
  const [memories, setMemories] = useState(initial.memories.join('\n'));
  const [emotions, setEmotions] = useState(initial.emotions.join(', '));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sheet = useRef<HTMLFormElement>(null);
  useEscape(onClose);
  useEffect(() => sheet.current?.focus({ preventScroll: true }), []);

  return (
    <div className={styles.scrim} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        ref={sheet}
        tabIndex={-1}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ps-title"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            name: name.trim(),
            traits: split(traits, /[,\n]/),
            speechStyle: speech.trim(),
            memories: split(memories, /\n/),
            emotions: split(emotions, /[,\n]/),
          });
        }}
      >
        <span className={styles.handle} aria-hidden />
        <button type="button" className={`${shared.iconBtn} ${styles.close}`} onClick={onClose} aria-label="닫기">
          <Close size={24} />
        </button>

        <div className={styles.head}>
          <span className={styles.face}>
            <Avatar src={avatarSrc} size={112} bg={avatarBg} zoom={1.3} />
          </span>
          <h2 id="ps-title" className={styles.title}>
            {name.trim() || initial.name}
          </h2>
          {caption && <p className={styles.caption}>{caption}</p>}
        </div>

        <section className={styles.group}>
          <label className={styles.label} htmlFor="ps-name">
            이름
          </label>
          <input id="ps-name" className={styles.input} value={name} maxLength={40} required onChange={(e) => setName(e.target.value)} />
        </section>

        <section className={styles.group} aria-label="성격과 말투">
          <label className={styles.label} htmlFor="ps-traits">
            성격 <small>쉼표로 나눠 적어요</small>
          </label>
          <input id="ps-traits" className={styles.input} value={traits} onChange={(e) => setTraits(e.target.value)} />
          <label className={styles.label} htmlFor="ps-speech">
            말투
          </label>
          <textarea id="ps-speech" className={styles.input} rows={3} maxLength={500} value={speech} onChange={(e) => setSpeech(e.target.value)} />
        </section>

        <section className={styles.group} aria-label="기억과 감정">
          <label className={styles.label} htmlFor="ps-memories">
            기억 <small>한 줄에 하나씩</small>
          </label>
          <textarea id="ps-memories" className={styles.input} rows={4} value={memories} onChange={(e) => setMemories(e.target.value)} />
          <label className={styles.label} htmlFor="ps-emotions">
            감정 <small>쉼표로 나눠 적어요</small>
          </label>
          <input id="ps-emotions" className={styles.input} value={emotions} onChange={(e) => setEmotions(e.target.value)} />
        </section>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.delete}
            onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
            aria-live="polite"
          >
            {confirmDelete ? '정말 지울까요?' : '삭제'}
          </button>
          <button type="submit" className={shared.primary}>
            저장
          </button>
        </div>
      </form>
    </div>
  );
}
