import { Avatar } from '../components/Avatar.tsx';
import { characters } from '../components/assets.ts';
import { ChevronLeft, FilePlus, ImageIcon } from '../components/icons.tsx';
import shared from './shared.module.css';
import styles from './PersonaCreate.module.css';

export interface PersonaCreateProps {
  story: string;
  onStoryChange: (value: string) => void;
  storyMax?: number;
  /** 올린 TXT 파일 이름. 없으면 업로드 안내를 보여 준다. */
  fileName?: string;
  onPickFile?: () => void;
  /** 올린 얼굴 사진. 없으면 기본 캐릭터 */
  photoSrc?: string;
  onPickPhoto?: () => void;
  onBack?: () => void;
  onSubmit?: () => void;
  submitDisabled?: boolean;
}

/** 02 페르소나 만들기 */
export function PersonaCreate({
  story,
  onStoryChange,
  storyMax = 2000,
  fileName,
  onPickFile,
  photoSrc,
  onPickPhoto,
  onBack,
  onSubmit,
  submitDisabled,
}: PersonaCreateProps) {
  return (
    <main className={shared.screen}>
      <nav className={shared.nav}>
        <button type="button" className={`${shared.iconBtn} ${shared.navLeft}`} onClick={onBack} aria-label="뒤로">
          <ChevronLeft />
        </button>
        <h1 className={shared.navTitle}>페르소나 만들기</h1>
      </nav>

      <div className={styles.greet}>
        <img src={characters.guide} alt="" width={120} height={120} draggable={false} />
        <p className={styles.bubble}>안녕! 너의 이야기를 들려줘.</p>
      </div>

      <h2 className={styles.heading}>어떤 나를 만나볼까요?</h2>
      <p className={styles.helper}>기억과 이야기를 바탕으로 시작해요</p>

      <form
        className={styles.panel}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.();
        }}
        id="persona-create"
      >
        <span className={styles.label} id="pc-file">
          기억 파일
        </span>
        <button type="button" className={styles.upload} onClick={onPickFile} aria-labelledby="pc-file pc-file-title">
          <FilePlus size={40} />
          <strong id="pc-file-title">{fileName ?? 'TXT 파일 업로드'}</strong>
          <span>{fileName ? '다른 파일로 바꾸려면 눌러 주세요' : '.txt 파일을 올려주세요'}</span>
        </button>

        <label className={styles.label} htmlFor="pc-story">
          나의 이야기
        </label>
        <div className={styles.field}>
          <textarea
            id="pc-story"
            value={story}
            maxLength={storyMax}
            onChange={(e) => onStoryChange(e.target.value)}
            placeholder={'그때의 성격, 좋아했던 것,\n기억에 남는 순간을 적어주세요.'}
          />
          <span className={styles.count} aria-live="polite">
            {story.length.toLocaleString('ko-KR')} / {storyMax.toLocaleString('ko-KR')}
          </span>
        </div>

        <section className={styles.photo} aria-labelledby="pc-photo">
          <strong id="pc-photo" className={styles.photoTitle}>
            내 얼굴 사진
          </strong>
          <span className={styles.photoHelp}>사진이 없으면 기본 캐릭터로 시작해요</span>
          <div className={styles.photoRow}>
            <Avatar src={photoSrc ?? characters.guideAvatar} size={74} bg="radial-gradient(circle at 40% 35%, #ffffff, #e6eef6)" />
            <button type="button" className={styles.outline} onClick={onPickPhoto}>
              <ImageIcon size={22} />
              사진 업로드
            </button>
          </div>
        </section>
      </form>

      <div className={shared.bottomBar}>
        <button type="submit" form="persona-create" className={shared.primary} disabled={submitDisabled}>
          페르소나 생성하기
        </button>
      </div>
    </main>
  );
}
