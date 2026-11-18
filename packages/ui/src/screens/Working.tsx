import { characters } from '../components/assets.ts';
import { Check } from '../components/icons.tsx';
import shared from './shared.module.css';
import styles from './Working.module.css';

export interface WorkingStep {
  label: string;
  state: 'done' | 'active' | 'todo';
}

export interface WorkingProps {
  title: string;
  /** 제목 아래 한 줄 (걸리는 시간 등) */
  hint?: string;
  steps: WorkingStep[];
  /** 있으면 실패 화면: 문구 + '다시 시도' */
  error?: string;
  onRetry?: () => void;
  /** 실패했을 때 돌아가기 */
  onCancel?: () => void;
  cancelLabel?: string;
}

/** 페르소나를 만드는 동안 보여 주는 진행 화면 (가이드 캐릭터 + 단계) */
export function Working({ title, hint, steps, error, onRetry, onCancel, cancelLabel = '돌아가기' }: WorkingProps) {
  return (
    <main className={`${shared.screen} ${styles.working}`} aria-busy={!error}>
      <section className={styles.middle}>
        <div className={`${styles.hero} ${error ? styles.still : ''}`} aria-hidden>
          <img src={characters.guide} alt="" width={180} height={180} draggable={false} />
          <span className={styles.shadow} />
        </div>
        <h1 className={styles.title}>{title}</h1>
        {(error || hint) && (
          <p className={error ? styles.error : styles.hint} role={error ? 'alert' : undefined}>
            {error ?? hint}
          </p>
        )}

        <ol className={styles.steps} aria-live="polite">
          {steps.map((s) => (
            <li key={s.label} className={styles[s.state]} aria-current={s.state === 'active' ? 'step' : undefined}>
              <span className={styles.mark} aria-hidden>
                {s.state === 'done' && <Check size={14} />}
              </span>
              {s.label}
              {s.state === 'done' && <span className={styles.sr}> (끝남)</span>}
            </li>
          ))}
        </ol>
      </section>

      {error && (
        <div className={shared.bottomBar}>
          <button type="button" className={shared.primary} onClick={onRetry}>
            다시 시도
          </button>
          {onCancel && (
            <button type="button" className={styles.cancel} onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
