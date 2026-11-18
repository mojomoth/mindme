import type { CSSProperties } from 'react';
import { characters } from '../components/assets.ts';
import { Close, Sparkle } from '../components/icons.tsx';
import shared from './shared.module.css';
import styles from './PersonaModal.module.css';

export interface PersonaModalProps {
  situation: string;
  onSituationChange: (value: string) => void;
  age: number;
  onAgeChange: (age: number) => void;
  minAge?: number;
  maxAge?: number;
  onClose?: () => void;
  onSubmit?: () => void;
  submitDisabled?: boolean;
}

/** 04 새 페르소나 모달. 03 목록 위에 겹쳐 쓴다(PersonaList 의 children). */
export function PersonaModal({
  situation,
  onSituationChange,
  age,
  onAgeChange,
  minAge = 5,
  maxAge = 80,
  onClose,
  onSubmit,
  submitDisabled,
}: PersonaModalProps) {
  const pct = ((age - minAge) / (maxAge - minAge)) * 100;
  return (
    <div className={styles.scrim} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <form
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-title"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.();
        }}
      >
        <Sparkle size={38} className={styles.sparkle} />
        <button type="button" className={`${shared.iconBtn} ${styles.close}`} onClick={onClose} aria-label="닫기">
          <Close size={26} />
        </button>
        <img className={styles.peek} src={characters.guidePeekOpen} alt="" width={100} height={73} draggable={false} />
        <h2 id="pm-title" className={styles.title}>
          새로운 페르소나
        </h2>
        <p className={styles.sub}>만나고 싶은 순간을 알려주세요</p>

        <label className={styles.label} htmlFor="pm-situation">
          상황 설명
        </label>
        <textarea
          id="pm-situation"
          className={styles.textarea}
          value={situation}
          maxLength={2000}
          onChange={(e) => onSituationChange(e.target.value)}
          placeholder="언제의 나를 만나고 싶나요?"
        />

        <div className={styles.ageHead}>
          <label className={styles.label} htmlFor="pm-age">
            그때의 나이
          </label>
          <output className={styles.agePill} htmlFor="pm-age">
            {age}살
          </output>
        </div>
        <input
          id="pm-age"
          className={styles.range}
          type="range"
          min={minAge}
          max={maxAge}
          step={1}
          value={age}
          onChange={(e) => onAgeChange(Number(e.target.value))}
          style={{ '--pct': `${pct}%` } as CSSProperties}
        />
        <div className={styles.ends} aria-hidden>
          <span>{minAge}살</span>
          <span>{maxAge}살</span>
        </div>

        <button type="submit" className={`${shared.primary} ${styles.submit}`} disabled={submitDisabled}>
          생성하기
        </button>
      </form>
    </div>
  );
}
