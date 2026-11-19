# Gate 3 r2 — web-ui 수정 (라운드 1): VISUAL-03

- 일시: 2026-11-19, 대상: `http://localhost:3100`(apps/web dev), 작업 트리(커밋 전)
- 항목: VISUAL-03 — 03 목록 외형이 원본 드래프트와 6/10(직전 Critic `gate3r2-critic-behavior-r1.md` 3절, 세 번 모두 나온 차이 4가지)
- 결과: **PASS**. Sonnet 비교 390x844 3회 9·9·9(중앙값 9, 기준 7). 360x740 9, 1440x900(목업) 9.
- AI 호출: 0회. `/api/*` 는 Playwright 가짜 응답으로 바꿨다(직전 Critic draftlike 스크립트와 같은 데이터).

## 1. 재현

드래프트(`docs/screens/drafts/03-persona-list.png`, 852px → 390 환산)와 수정 전 캡처를 같은 방법으로 쟀다(`fix-visual-03-geometry.txt`, 단위 CSS px).

| 차이 | 드래프트 | 수정 전 | 원인 |
|---|---|---|---|
| (1) '새로운 페르소나' | 맨 위 카드 하나 | 3장 모두 | `MindmeApp.tsx` `isNew: newIds.includes(p.id)`. 첫 생성은 만든 3개 id 를 모두 `newIds` 에 넣는다 |
| (2) 카드 높이·간격 | 96 / 88 / 91, 간격 10~11 | 88 / 88 / 88, 간격 10 | 위아래 여백 6px에 줄 높이 26·24. 세 줄 카드도 88px 에 눌려 들어간다 |
| (3) 아바타 배경 | 파랑·노랑·복숭아 | 모두 파랑 | `AVATAR_BG[p.kind]`. 과거 페르소나는 모두 파랑이다 |
| (4) 히어로 마스코트 | 높이 129, 왼팔이 부제 끝에서 떨어져 있음 | 높이 149, 왼팔이 부제 끝(239px)에 닿음 | 205px 이미지가 드래프트보다 15% 크고 왼쪽 위로 치우쳤다 |

## 2. 수정

- (1) `apps/web/lib/data.ts` `isNewest(personas, newIds, id)`: 방금 만든 것(`newIds`) 가운데 목록 맨 앞, 곧 가장 최근에 만든 하나에만 표시한다. 목록은 새로 만든 것이 앞에 온다(`savePersonas([...made, ...personas])`). 페르소나에 만든 시각 필드가 없어서 이 순서를 기준으로 삼았다. 맨 앞 카드를 열면 표시가 다음 카드로 옮겨 가지 않는다. '페르소나가 준비됐어요' 알림 조건(`newIds.length > 0`)은 그대로다.
- (3) `data.ts` `avatarBgAt(index, count)`: 색 3개를 만든 순서(목록 뒤에서부터 센 위치)대로 돌려 쓴다. 새 페르소나를 앞에 붙여도 기존 페르소나 색은 바뀌지 않는다. 처음 만든 3개는 위에서부터 파랑·노랑·복숭아(드래프트 순서)다. 목록·05 대화·프로필 시트가 같은 `avatarOf` 를 써서 한 페르소나의 색이 화면마다 같다. 이전 `AVATAR_BG`(종류별 색)는 지웠다.
  - 색은 `tokens.css` `:root` 에 토큰 3개(`--mm-avatar-blue/yellow/peach`, 기존 hex 값 그대로)를 더해 쓴다. `Avatar` 기본값도 같은 토큰으로 바꿨다. `@font-face` 블록은 건드리지 않았다.
  - 한계: 중간 페르소나를 지우면 그보다 나중에 만든 페르소나의 색이 한 칸씩 밀린다.
- (2) `PersonaList.module.css`: 위아래 여백을 행에서 글 묶음(`.text` padding 15px)으로 옮기고, 줄 높이를 제목 24·미리보기 22·표시 20으로 줄였다. `min-height` 는 90px, 간격은 11px 이다. 아바타는 78px(드래프트 79)로 키웠다. 그 결과 두 줄 카드는 90px, 표시가 있는 세 줄 카드는 96px 다.
- (4) 히어로 이미지는 205 → 178px 로 줄이고(`top -5px`, `right -6px`), 그림자도 같은 비율로 줄였다. 반짝이(`Burst`)는 26 → 36 으로 키워 드래프트 위치(캐릭터 왼쪽 위)에 맞췄다. 360px 구간은 150px 로 맞춰 부제와 띄웠다.

수정 뒤 실측(390, `fix-visual-03-after-measure.json`·`-geometry.txt`):

| 값 | 드래프트 | 수정 후 |
|---|---|---|
| 카드 높이 | 96.1 / 88.4 / 90.6 | 96 / 90 / 90 |
| 카드 간격 | 9.6 / 11.4 | 11 / 11 |
| 첫 카드 글줄 중심(카드 위에서) | 26 / 49 / 70 | 26 / 49 / 71 |
| 아바타 배경 | (220,236,254) (254,241,192) (253,225,210) | (220,234,248) (254,241,197) (254,223,210) |
| 마스코트 위·아래(제목 표시줄 아래 기준) | 83.7 / 212.4 | 84 / 213 |
| 반짝이 x | 223~244 | 224~247 |
| '새로운 페르소나' | 1장 | 1장(360·390·1440 모두) |

## 3. 검증

### 외형 비교 (`claude -p --model sonnet --allowedTools Read`, 직전 Critic 의 p03 문구 그대로)

| 캡처 | 점수 | 파일 |
|---|---|---|
| 390x844 1회 | 9 | `fix-visual-03-judge-390-1.txt` |
| 390x844 2회 | 9 | `fix-visual-03-judge-390-2.txt` |
| 390x844 3회 | 9 | `fix-visual-03-judge-390-3.txt` |
| 360x740 | 9 | `fix-visual-03-judge-360.txt` |
| 1440x900 목업 | 9 | `fix-visual-03-judge-1440.txt` |

- 이번에 고친 4가지는 더 지적되지 않았다. 1440 판정은 아바타 배경이 원본과 같다고 적었다.
- 남은 지적은 미세 조정 수준이다. 카드 그림자가 원본보다 옅다, 제목 서체 질감(둥근 굵은 고딕)이 다르다, 상단 세로 리듬이 다르다(상태바 유무), 목록 아래 빈 공간이 크다. 두 번째·세 번째 카드가 납작하다는 말도 나왔지만 실측은 90px 로 드래프트(88~91)와 같다. 서체·그림자는 트리아지 ui-web-11(DEFER, 시각 취향)과 같은 종류다.

### 다른 화면 영향 (수정 전후 같은 스크립트, `fix-visual-03-diff.json`)

| 화면 | 390 | 360 | 1440 |
|---|---|---|---|
| 02 만들기 | 차이 0px | 0px | 0px |
| 04 모달 | 모달 자체는 같고, 뒤에 흐리게 보이는 목록(마스코트·카드 끝)만 다르다 | 같음 | 같음 |
| 05 대화 | 차이 0px | 0px | 0px |

- 04 나란히 보기: `fix-visual-03-04-modal-sbs-390.png`(전·후·차이).
- 05 의 15살 페르소나는 목록 맨 위라 파랑이고, 수정 전(과거=파랑)과 같다. 다른 페르소나는 종류별 색 대신 만든 순서의 색을 쓰도록 의도적으로 바꿨다.
- 긴 이름 회귀(ui-web-1): 줄 높이를 줄인 뒤에도 360·390 에서 긴 이름·미리보기가 두 줄 말줄임 안에 들어가고, 가로로 넘치지 않으며, 카드 밖으로 나가지 않는다. 새로고침 뒤에는 '새로운' 표시가 없다(`fix-visual-03-longnames.json`, `-longnames-360.png`·`-390.png`).

### 테스트·정적 검사

- `apps/web/lib/data.test.ts` 2건 추가: `isNewest`(3개를 만들면 맨 앞 하나만 표시, 맨 앞을 열면 다음 카드로 옮겨 가지 않음), `avatarBgAt`(3장 색이 파랑·노랑·복숭아, 4번째를 앞에 붙여도 기존 3장 색 유지, 이웃 카드 색이 다름).
- 레포 루트 `pnpm typecheck && pnpm test && pnpm lint` 모두 exit 0, 테스트 55/55(`fix-visual-03-checks.txt`). 글꼴 조각 테스트(`tokens.css @font-face` 와 조각 파일 일치)도 통과했다.

## 4. 참고

- pocs(3101)도 `packages/ui` 의 `PersonaList` 를 쓰므로 같은 외형이 된다(pocs 파일은 고치지 않았다). 다만 지금 떠 있는 3101 dev 서버는 서버 렌더링이 `PersonaList.tsx` 변경을 다시 컴파일하지 않았다. 그래서 서버 HTML(반짝이 26, 아바타 76)과 클라이언트(36, 78)가 달라 개발 모드에 hydration 경고가 뜬다. 같은 파일을 제자리에서 다시 써 봐도 그대로였다. `pocs-dev.log` 에는 그 전에 글꼴 조각 파일을 다시 만들 때 생긴 `Module not found` 오류들이 남아 있다. 코드 문제가 아니라 dev 서버 감시 문제로 보이며, 서버를 다시 띄우면 사라질 것으로 예상한다(재시작은 이번 작업 권한 밖이다). apps/web(3100) 목록은 클라이언트에서만 그리므로 영향이 없다.

## 5. 증거·스크립트

- 캡처: `evidence/gate3r2/fix-visual-03-{before,after}-{390,360,1440}-{02-create,03-list,04-modal,05-chat}.png`
- 판정: `fix-visual-03-judge-*.txt`, 실측: `fix-visual-03-{before,after}-measure.json`, `fix-visual-03-geometry.txt`, 비교: `fix-visual-03-diff.json`
- 스크립트: `evidence/gate3r2/fix-visual-03-scripts/` — `shots.mjs <before|after>`(가짜 API 로 02→03→04→05), `judge.sh`·`p03-*.txt`, `measure.py`·`diff.py`·`sbs.py`(Pillow, `uv run --offline --no-project --with pillow python -I`), `longnames.mjs`

## 6. 바꾼 파일

- `apps/web/lib/data.ts`: `AVATAR_BG` 를 지우고 `avatarBgAt`·`isNewest` 를 추가
- `apps/web/app/MindmeApp.tsx`: `avatarOf`·`isNew` 를 위 함수로 교체
- `apps/web/lib/data.test.ts`: 테스트 2건
- `packages/ui/src/screens/PersonaList.tsx`: 아바타 78, 반짝이 36
- `packages/ui/src/screens/PersonaList.module.css`: 히어로 마스코트·그림자·반짝이, 카드 여백·줄 높이·간격, 360 구간
- `packages/ui/src/styles/tokens.css`: `:root` 에 `--mm-avatar-*` 3개(@font-face 블록 밖)
- `packages/ui/src/components/Avatar.tsx`: 기본 배경을 토큰으로
