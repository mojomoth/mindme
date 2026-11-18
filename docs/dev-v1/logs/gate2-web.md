# Gate 2 — web-app (`apps/web`, 포트 3100)

2026-11-19. 구현: Claude Opus 5.5. 실제 AI(OpenAI)로 전체 플로우를 데스크톱(사진 있음)·모바일(사진 없음)에서 한 번씩 끝까지 돌렸다.

## 결과

| 항목 | 상태 | 근거 |
|---|---|---|
| 전체 플로우 01→02→진행→03→04→진행→03→05→프로필→나가기→새로고침 복원 | PASS (데스크톱·모바일) | `evidence/gate2/web-flow-{desktop,mobile}.json`, `web-flow-*-NN-*.png` 14장씩 |
| 실패 화면·다시 시도·입력 유지, 대화 오프라인 안내, 360px 목록 | PASS | `evidence/gate2/web-states.json`, `web-state-*.png` |
| typecheck(4패키지)·lint·test 39/39·`next build`(web·pocs) | PASS | 아래 '회귀' |
| 키 값 검색(apps/web 소스·`.next/static`·`.next/server`·ui·증거·dev 로그 321파일) | 0건 | `evidence/gate2/web-keyscan.txt` |
| dev 서버 | 3100 켜 둠 (`pnpm dev:web`, 로그 `logs/web-dev.log`), 3101 그대로 | `/api/health` 200 |

실측 (데스크톱, 사진 있음): 랜딩→만들기 2.8s, 첫 생성(카톡 분석 + 이야기 분석 병렬 → 페르소나 3개·아바타 3개 병렬) 82s, 모달 미래 30살(페르소나 + 아바타) 29s, 대화 답변 약 4~5s. 모바일(사진 없음): 첫 생성 52s, 모달 24s.

첫 생성 결과 예: `체육대회 계주 일로 서진과 다툰 날의 이지우` · `졸업하며 다른 고등학교로 갈라진 날의 이지우` · `첫 출근 뒤 한 주의 소감을 나눈 날의 이지우`, 모달 → `30살의 이지우`(future, 상황을 futureGoals 로).

## 결정

- **화면 이동은 상태 하나(`screen`)로** 한다. App Router 경로를 나누지 않았다. 근거: 저장소가 브라우저뿐이라 경로마다 같은 로드·하이드레이션 처리가 반복되고, PhoneFrame 을 화면마다 다시 그리지 않아도 되며, Capacitor 로 옮길 때도 그대로 쓴다. 대신 브라우저 뒤로 가기는 앱 안 이동에 쓰이지 않는다(Gate 3 에서 필요하면 history 연결).
- 페이지는 `dynamic(..., { ssr: false })` 로 불러 첫 렌더에서 저장값을 읽고, 불러오는 동안 같은 랜딩을 보여 준다(PoC 와 같은 방식).
- **route 는 얇은 래퍼**: `parseRequest → core 함수` 그대로. pocs 와 15줄 안팎이 겹친다. Next 는 `maxDuration` 같은 세그먼트 설정을 파일 안 리터럴로만 읽어서 한 줄 re-export 로 줄일 수 없다(core 소유자에게 NEXT 로 남김). 다른 점은 두 가지: zod 영어 문구 대신 엔드포인트별 한국어 고정 문구(`invalid`), `maxDuration` 은 analyze·persona·chat 60, avatar 120.
- **기록 판별**: TXT 를 core `parseKakao` 로 읽어 메시지가 하나라도 나오면 `kakao`, 아니면 `diary`. '나의 이야기'가 있으면 `prompt` 로 함께 분석(두 호출 병렬)하고 사건을 합쳐 core `sortByTime` 로 정렬, `evt_01..` 다시 매김. 이야기는 `profile.story` 로도 넘긴다.
- **처음 만들 페르소나**: 나이를 아는 지난 사건 중 감정·대사 단서가 많은 것부터, 나이가 겹치지 않게 최대 3개(`lib/data.ts pickEvents`). 3개가 안 되면 '지금의 나'를 더한다. 페르소나와 아바타는 동시에 부르고(`Promise.allSettled`), 아바타가 실패하면 기본 캐릭터로 둔다. 하나라도 성공하면 목록으로 간다.
- **모달**: 나이 < 지금 → past(그 나이~2년 전 사건 중 상황 설명과 2글자 묶음이 2개 이상 겹치는 사건을 연결, 상황이 비면 같은 나이 사건, 없으면 자유), 같으면 present, 크면 future(상황을 `futureGoals` 로). 슬라이더 아래에 어떤 나가 만들어지는지 한 줄로 알려 준다.
- **이름·지금 나이**: 02 패널에 한 줄로 추가(이름은 비우면 카톡 분석이 찾은 대화명 → '나'). 생성 때 나이를 반드시 받으므로 모달에서는 다시 묻지 않는다.
- **저장**: `NativeAdapter.storage`(localStorage). 키 `mindme:{profile,events,personas,photo}`, `mindme:chat:<id>`. 아바타는 256px WEBP data URL(약 14KB), 얼굴 사진은 다음 아바타용으로 768px JPEG(약 120KB). 기본 캐릭터는 저장하지 않고 그릴 때 정한다(빌드 해시 경로 P2 해소). 서버는 무상태.
- **대화**: 첫 메시지 = `persona.greeting`. 최근 40개를 보내고, 아바타는 빼고 보낸다. 실패하면 보낸 말은 남기고 '다시 받기'. 나가면 진행 중인 스트림을 끊는다.
- `packages/ui` 에 이미지 도우미(`shrinkImage`, `blobToDataUrl`)를 옮겨 두었다(PoC persona 화면의 것과 같은 코드). PoC 는 그대로 둠.

## 바꾼 파일

- 새로: `apps/web/**` (package.json, next.config.ts, tsconfig.json, eslint.config.mjs, `app/{layout,page,MindmeApp}.tsx`, `app/api/{analyze,persona,persona/avatar,chat,health}/route.ts`, `lib/{api,data}.ts`)
- `packages/ui`: `native.ts`(+`pickPhoto`), `image.ts`(새), `index.ts`(export), `components/useEscape.ts`(새), `screens/Working.*`(새 진행 화면), `screens/ProfileSheet.*`(새 프로필 시트), `PersonaCreate.*`(이름·나이, 안내 문구, 하단 간격 P2), `PersonaList.*`(대화 버튼 선택, 360px 히어로, 두 줄 말줄임), `PersonaModal.*`(Esc P2, 포커스, 나이 안내), `Conversation.*`(자동 스크롤 P2, textarea·Enter/Shift+Enter/IME, 아바타 → 프로필, 실패 안내)
- 루트 `package.json`: `dev:web`, `build:web`. `pnpm-lock.yaml` 은 `apps/web` 추가로 pnpm 이 갱신(새 외부 의존성 없음, pocs 와 같은 버전).

## 회귀

- `pnpm typecheck`: core·ui·pocs·web 통과. `pnpm lint`: pocs·web 경고 0. `pnpm test`: 39/39. `pnpm build`(pocs)·`pnpm build:web` 성공.
- 사고 1건: ui 화면에 훅을 넣은 직후 pocs 3101 이 전부 500 이 됐다(서버 컴포넌트가 `@mindme/ui` 를 import 하는데 훅 쓰는 모듈에 `'use client'` 가 없었음). `Conversation`·`PersonaModal`·`ProfileSheet`·`useEscape` 에 `'use client'` 를 달아 바로 복구했다. 그 사이(약 10분) 3101 을 쓴 다른 작업의 결과가 500 이었다면 다시 확인해야 한다.
- `/pocs/screens/chat`·`list` 스크린샷으로 PoC 화면이 그대로인 것 확인.

## 남은 것 (P2)

- 03 목록: 360px 처럼 낮은 화면에서 맨 아래 '다른 순간의 나도 만나보세요' 가 처음엔 CTA 에 가린다(스크롤하면 보임). 히어로 팔 겹침은 해소.
- 미래 페르소나가 "책방을 열었는지는 기억 안 나"처럼 미래 일을 피해 말한다(core 프롬프트의 '예언 금지'가 강하게 먹음). 대화 품질 판단은 HIL.
- analyze `maxDuration` 60s: 4만 자를 넘는 기록은 구간 요약 때문에 배포에서 60초를 넘길 수 있다(로컬은 제한 없음). Gate 3 에서 실측.
- 첫 생성 82s(사진 있음): 배포 환경에서는 함수별 한도 안이지만 사용자가 오래 기다린다. 진행 화면에 단계와 예상 시간을 보여 준다.
- 저장은 localStorage 동기 API. Capacitor 에서 Preferences(비동기)로 바꾸려면 `NativeAdapter.storage` 를 Promise 로 바꿔야 한다.
- 브라우저 뒤로 가기는 앱 화면 이동에 쓰이지 않는다.
- 모달에서 지금 나이를 묻는 입력은 두지 않았다(생성 화면에서 반드시 받음). 저장값이 깨져 프로필이 없으면 생성 화면으로 보낸다.
