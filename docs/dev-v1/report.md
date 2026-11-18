# Mindme 개발 보고 (report)

> 기술 검증 결과, 중요 결정, 미해결 문제만 적는다. 진행 단계와 TODO 는 `run.md`, 상세 로그는 `logs/<task>.md`, 증거는 `evidence/<gate>/` 에 있다.

## 1. 기술 검증 결과

### Gate 0 (2026-11-17)

| 항목 | 결과 | 근거 |
|---|---|---|
| `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` | PASS (테스트 4/4) | `logs/scaffold.md` |
| dev 서버 3101 | PASS: `/api/health`, `/pocs`, `/pocs/screens` 모두 200 | `logs/scaffold.md`, `evidence/gate0/critic-r1-gate0.md` |
| 최소 API 계약 | PASS: `api.md` 와 `packages/core/src/schemas.ts` 의 필드·제약이 일치 | `evidence/gate0/critic-r1-gate0.md` |
| 목업 정렬 (데스크톱) | PASS: 화면과 베젤 사이 틈 0px, 바깥 넘침 0px (1440x900@1·@2, 1280x720, 1920x1080, 1024x640). 1440 에서 정중앙(중심 720, 450) | `evidence/gate0/screens-desktop-align.png`, `critic-r1-align-magenta-1440.png`, `critic-r1-codex-align.txt` |
| 모바일 전체화면 (≤600px) | PASS: 목업 숨김, screen 0,0,390,844, 가로 스크롤 없음, `viewport-fit=cover` | `evidence/gate0/screens-mobile.png`, `critic-r1-pocs-screens-mobile.png` |
| 키 노출 | PASS: 레포(.env 제외)·`pocs/.next/static`·응답 본문에서 실제 키 0건, `NEXT_PUBLIC_` 0건 | `logs/scaffold.md`, `evidence/gate0/critic-r1-gate0.md` |
| Codex CLI / Claude CLI | PASS: `codex exec`(gpt-6-astra, gpt-6.1-sol, 이미지 생성), `claude -p`(sonnet·opus, 이미지 분석) | `logs/cli-model-smoke.md` |
| 생성 에셋 (guide, guide-face, avatar-teen, avatar-young) | PASS: 1024 RGBA, 모서리 알파 0, 마젠타 잔여 0px, 드래프트 01·03 과 외형 일치 | `logs/mascot-assets.md`, `evidence/gate0/critic-r1-assets-sheet.png` |

### 모델·API 직접 호출 (키를 출력하지 않는 fetch 스크립트)

| 공급자 / 모델 | 결과 | 측정 |
|---|---|---|
| OpenAI gpt-6-astra (responses) | 200 | 5.1s (smoke), 4.8s (Critic r1), 2.7s (fix-r1), 3.2s (Critic r2) |
| OpenAI gpt-6.1-sol (responses) | 200 | 4.4s (fix-r1) |
| OpenAI gpt-image-2 (images/generations, 1024x1024, quality low) | 200, PNG 생성 | 9.3s (fix-r1), `evidence/gate0/fix-r1-gpt-image-2-probe.png` |
| Anthropic claude-sonnet-5-5 / claude-haiku-5-5 (messages) | 400: 월 사용 한도 도달, 2026-12-01 00:00 UTC 복구 (r2 재확인) | 0.4~0.5s |
| Google 모델 목록 | 200 (gemini-3.5-flash, gemini-3.1-pro-preview 포함) | — |
| Google gemini-3.5-flash (generateContent) | 타임아웃 3회(60s 2회, 45s 1회), 성공 1회 200, r2 에서 503 "high demand" | 성공 시 39.3s, 503 까지 19.2s |
| Google gemini-3.1-pro-preview (generateContent) | 429: 쿼터 초과 | — |

결론: 지금 직접 API 로 쓸 수 있는 공급자는 **OpenAI 하나뿐**이다. `/api/health` 의 `providers` 는 키가 있는지만 보므로 `anthropic:true`, `google:true` 가 실제 호출 가능 여부와 다르다(P2, 아래 미해결 참고).

### Gate 1 PoC 실측 (2026-11-19, Gate 1 최종 Critic)

| 기능 | 모델 | 결과 | 지연 |
|---|---|---|---|
| 카카오톡·일기·프롬프트 분석 `/api/analyze` | gpt-6-astra (structured output) | 사건 3개 시간순 추출, 스키마 일치 | 약 22s |
| 페르소나 생성 `/api/persona` | gpt-6-astra | 과거(사건 직후) 생성, 이름 형식 일치 | 약 15s |
| 아바타 `/api/persona/avatar` | gpt-image-2 (사진 있을 때만) | 사진 없으면 기본 캐릭터 반환 | 11ms (기본) |
| 대화 `/api/chat` | gpt-6-astra 스트리밍 | 35청크, 위기 신호 시 109 안내 | 첫 청크 1.6~2.7s, 전체 약 4.7s |

- 검사: typecheck 3패키지, test 32/32, lint, next build 통과. 키 값 바이트 검색 677파일 0건.
- 1차 실행은 DNS 장애(ENOTFOUND)로 에이전트 7개가 중단됐다. 남은 파일을 이어받아 재개했다.

### Gate 2 통합 실측 (2026-11-19)

- 실측(데스크톱): 첫 생성 82초, 모달 미래 29초, 대화 답 4~5초. 모바일(사진 없음): 첫 생성 52초, 모달 24초.
- Critic: e2e r1, visual r1→r2, ponytail r1→r2 모두 PASS. P0·P1 열림 0.
- 회귀: typecheck 4패키지, test 40/40, `next build` 성공, 3100·3101 주요 경로 200, 키 값 검색 0건(`evidence/gate2/web-keyscan.txt`).
- Gate 1 P2 중 자동 스크롤, 모달 Esc, 기본 아바타 경로, zod 영어 문구 등은 해결.

### Gate 3 배포 구성 (2026-11-19)

- 주소: https://mindme-rho.vercel.app (Vercel 프로젝트 mindme). Root Directory `apps/web`, `sourceFilesOutsideRootDirectory` 켬, install `pnpm install --frozen-lockfile`.
- Node 24.x: 로컬 v26 은 Vercel 이 지원하지 않아 `apps/web` 의 engines 를 24.x 로 두었다.
- 환경 변수는 `OPENAI_API_KEY`(production, sensitive) 하나다. 모델 이름은 코드 기본값(gpt-6-astra, gpt-image-2)을 쓴다. 보호 설정(ssoProtection)은 해제했다.
- fluid compute, 함수 리전 iad1, 기본 함수 시간 300초. 랜딩은 정적이라 CDN 캐시에서 나간다.
- 루트 `pnpm build` 는 pocs 를 빌드하므로 배포는 `apps/web` 기준으로만 한다.

### Gate 3 배포 제약 실측

| 항목 | 결과 |
|---|---|
| analyze 30만 자 | 200, 32.3초, 7구간 요약 (한도 300초) |
| avatar | 생성 25.8~29.8초, 요청 전체 27.5~31.6초 (한도 120초). 로컬 1회는 74초가 나온 적 있다 |
| 요청 본문 | 4.4MB 는 함수까지 도달, 4.7MB 는 Vercel 413. 사진은 클라이언트에서 줄여 약 128KB 를 보낸다 |
| 스트리밍 | 청크 단위 도착. 첫 호출 5.46초, 이후 2.2초 안팎(첫 글자 1.3~5.5초) |
| 서버 상태 | 파일 쓰기 0건. 기록은 모두 localStorage. 처음 보는 persona id 도 200 |
| 브라우저 권한 | https 보안 컨텍스트, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`. 사진 선택 정상 |
| 로컬과 비교 | 화면 10쌍(5화면 x 데스크톱·모바일) 차이 픽셀 0 |
| 미확인 | 함수별 `maxDuration` 적용값(배포 API 가 값을 돌려주지 않음) |

## 2. 중요 결정

### AI 공급자 (Gate 1)

| 용도 | 기본 | 대체 순서 | 근거 |
|---|---|---|---|
| PoC 텍스트 (기록 분석, 페르소나 생성, 대화) | OpenAI **gpt-6-astra** | 1) OpenAI gpt-6.1-sol → 2) Anthropic claude-sonnet-5-5 (2026-12-01 한도 복구 후) → 3) Google gemini-3.5-flash (지연 해소 시) | 직접 호출이 안정적으로 200, 3~5초 |
| 아바타 이미지 | OpenAI **gpt-image-2** API | 1) gpt-image-2.6-flare → 2) gemini-3.1-flash-image (쿼터·지연 해소 시) | fix-r1 에서 200, 9.3s 확인. 투명 배경 출력은 Gate 1 PoC 에서 따로 검증 |
| 개발용 에셋 생성 | Codex CLI (`codex exec`, image_generation) | — | 앱 런타임과 별개. `logs/mascot-assets.md` |

- **Anthropic 직접 API: BLOCKED (외부 원인).** 월 사용 한도 소진으로 2026-12-01 00:00 UTC 까지 쓸 수 없다. 한도를 올리거나 복구된 뒤 다시 측정해서 텍스트 기본 공급자를 바꿀지 정한다.
- **Google Gemini 직접 API: 보류.** flash 는 응답이 40초 안팎이거나 타임아웃이고, pro-preview 는 429 다. 대화 UX 에 쓸 수 없는 지연이다. 쿼터·네트워크를 확인한 뒤 다시 측정한다.
- 공급자 선택은 서버 코드 한 곳(`@mindme/core/server`)에서 하고, 호출부는 공급자를 모르게 둔다. 그래야 Anthropic 이 복구됐을 때 설정만 바꾸면 된다.
- 개발 도구로 쓰는 Claude CLI(`claude -p`, 구독 로그인)는 직접 API 한도와 별개로 정상이다.

### 아키텍처

| 결정 | 근거 |
|---|---|
| pnpm workspace 모노레포 (`packages/core`, `packages/ui`, `pocs`, `apps/*`) | PoC 코드를 Gate 2 에서 새로 쓰지 않고 그대로 재사용 |
| `@mindme/core`: zod 스키마·타입과 서버 전용 AI 클라이언트(`@mindme/core/server`, `import 'server-only'`) | API 계약을 한 곳에서 관리. 서버 코드가 클라이언트 번들에 섞이면 빌드가 실패해서 막힌다 |
| `@mindme/ui`: 화면 컴포넌트, PhoneFrame, 토큰, 폰트, 이미지 | PoC 와 apps 가 같은 화면을 공유 |
| 패키지는 TS 소스를 그대로 export 하고 Next `transpilePackages` 로 빌드 | 패키지 빌드 단계와 dist 를 없앰 |
| Next.js 16.4.6 (App Router, Turbopack), React 19.3.1 | 최신 안정판 |
| CSS Modules + CSS 변수 (Tailwind 없음) | 의존성 최소화 |
| 루트 `.env` 하나를 `next.config.ts` 에서 `loadEnvConfig(root, dev, log, true)` 로 로드 | Next 가 pocs/ 기준 env 를 먼저 캐시하므로 forceReload 가 필요했다(실측) |
| SDK 에 `apiKey` 를 명시 전달 | 키 이름(`CLAUDE_API_KEY` 등)이 SDK 기본값과 다르다 |
| 서버 무상태, 데이터는 클라이언트에 저장 | Vercel 파일시스템은 비영속 |
| `NativeAdapter`(pickFile, storage) 경계 | Capacitor 로 옮길 때 구현만 바꾼다 |
| 목업 배율을 CSS 만으로 계산: `min(1, tan(atan2(100dvh - 48px, 924px)), tan(atan2(100vw - 48px, 425.5px)))` | JS 측정 없이 SSR 첫 화면부터 정확하다 |
| 목업 안은 390px 논리 폭으로 그리고 `transform: scale` 로 줄인다 | 드래프트(390 폭)와 같은 px 값으로 구현·비교. `contain: layout paint` 로 fixed 모달이 화면 안에 갇힌다 |
| 데스크톱 목업 안에는 가짜 상태바(9:41)와 홈 인디케이터, `--mm-safe-top: 59px` / `--mm-safe-bottom: 34px`. 모바일(≤600px)은 `env(safe-area-inset-*)` | 드래프트와 같은 크롬을 보여 주고, 실기기에서는 OS 값을 쓴다 |
| 목업 화면 영역 실측: left 4.2303%, top 1.8398%, width 91.6569%, height 96.4827%, 코너 반경 112px | 알파 플러드필 실측(`logs/scaffold.md`). 반경을 작게 잡아 베젤 아래로 숨긴다 |

### 버전 고정

| 패키지 | 버전 | 이유 |
|---|---|---|
| typescript | 6.0.3 (7.0.2 아님) | typescript-eslint 8.x 가 `<6.1` 만 지원 |
| eslint | 9.39.5 (10 아님) | eslint-config-next 16.4 플러그인 피어가 ≤9 |
| ~~@anthropic-ai/sdk~~ | 제거됨 (Gate 3) | 앱이 쓰지 않아 의존성 삭제 |
| ~~@google/genai~~ | 제거됨 (Gate 3) | 앱이 쓰지 않아 의존성 삭제 |
| openai | 7.57.0 | 정책 통과 |
| zod 4.6.7, @playwright/test 1.65.1, server-only 0.0.1 | — | 최신 |
| ~~protobufjs 설치 스크립트~~ | 제거됨 (Gate 3) | 앱이 쓰지 않아 의존성 삭제 |

### Gate 2 결정

- 화면 이동은 App Router 경로 대신 상태 하나로 한다. 저장소가 브라우저뿐이고 Capacitor 이전에도 그대로 쓴다. 대신 브라우저 뒤로 가기는 앱 이동에 쓰이지 않는다.
- route 는 `parseRequest → core 함수` 얇은 래퍼다. `maxDuration` 은 Next 가 파일 안 리터럴로만 읽어 한 줄 re-export 가 안 된다(analyze·persona·chat 60초, avatar 120초).
- 처음 만들 때 지난 사건 중 나이가 겹치지 않는 최대 3개로 페르소나를 자동 추출하고 아바타와 함께 병렬 생성한다. 아바타가 실패하면 기본 캐릭터로 둔다.
- 현재 나이는 생성 때 받는다. 모달은 나이로 과거·현재·미래를 정한다.
- 저장은 localStorage, 서버는 무상태. AI 는 OpenAI 만 쓴다.
- 새 외부 의존성 없음. 이미지 도우미를 `packages/ui` 로 옮겼다.

### Gate 3 결정과 보안 조치

- analyze `maxDuration` 60 → 300초. 구간 요약을 모두 동시 실행해 최악 지연을 약 500초에서 약 250초로 줄였다(30만 자 실측 29.9~32초). 순간 토큰이 커서 계정 TPM 이 낮으면 429 가 날 수 있다.
- analyze 응답에서 `meta.llm`(AI 원시 출력) 제거. pocs 만 `includeLlm` 으로 받는다.
- 키 없음·본문 초과·JSON 오류 문구를 해요체로 바꾸고, 키 사유는 서버 로그에만 남긴다(키 이름만, 값 없음).
- 남용 방지(apps/web 만): `Content-Length` 로 본문을 읽기 전에 413, IP 별 10분 고정 창 속도 제한(analyze 10·persona 30·avatar 15·chat 100)과 429 + `Retry-After`. 새 의존성 없음. 인스턴스 메모리라 완벽하지 않다.
- 미사용 공급자 제거: `@anthropic-ai/sdk`·`@google/genai`, `getAnthropic`·`getGoogle`, protobufjs 설정. `/api/health` 는 `{ ok, configured: { openai } }`. 12/1 이후 Claude 전환은 `env.ts`·`ai.ts`·`llm.ts` 세 곳에 분기만 더한다.
- 정리: 안 쓰는 마스코트 PNG·복사본 함수·중복 상수·미사용 스키마와 export 를 삭제(추가 39·삭제 93줄).
- 클라이언트: 대화 중 나가기 처리(취소 + '다시 받기'), 같은 이름 확인, 아바타 재사용 재시도, 03·02 모바일 여백, 입력란 스크롤 잘림, 프로필 시트 재구성.
- 키 검사: 작업 트리 1004파일·git 이력 115MB·빌드 산출물·배포 HTML·정적 파일·브라우저 응답 본문 모두 0건. `NEXT_PUBLIC_` 0. 소스맵은 403.
- '버전 고정' 표의 `@anthropic-ai/sdk`·`@google/genai`·protobufjs 항목은 제거됨으로 표시했다.

## 3. 미해결 문제

| 문제 | 상태 | 다음 조치 |
|---|---|---|
| Anthropic 직접 API 월 한도 소진 | BLOCKED (외부, 2026-12-01 복구) | 복구 후 재측정. 그 전까지 OpenAI 사용 |
| Gemini 지연(flash 39s·타임아웃)과 쿼터(pro 429) | 보류 | 쿼터·네트워크 확인 후 재측정 |
| ~~원격 저장소 없음~~ | 해결 | 사용자가 `github.com/mojomoth/mindme`(public) 원격을 추가. 게이트별 커밋 후 push (gh CLI 는 여전히 없음) |
| `/api/health` 가 키 존재만 보고 `true` 를 돌려줌 (P2) | 열림 | 필드 이름을 `configured` 로 바꾸거나 api.md 에 의미를 명시 |
| Claude CLI 로그인 2026-11-18 만료 가능 (P2) | 열림 | 긴 작업 전에 `claude setup-token` |
| `NativeAdapter.storage` 가 동기 API (P2) | 열림 | Capacitor Preferences 는 비동기라 Gate 1 에서 async 로 바꾸고, 카메라 어댑터 추가 |
| 생성 에셋이 아직 `packages/ui` 로 옮겨지지 않음, 로고용 '빼꼼' 변형 없음 (P2) | 열림 | Gate 1 |
| gpt-image-2 투명 배경 출력 | 미검증 | Gate 1 아바타 PoC 에서 확인 |
| 모바일 safe-area 는 Chromium 에뮬레이션에서 0 | 열림 | 실기기 확인(Capacitor 포팅 시) |
| git 작성자 정보 미설정 | 우회 | 기존 이력과 같은 `JY <jyl@JYui-MacBookAir.local>` 를 커밋마다 `-c` 로 지정 (전역 설정은 바꾸지 않음) |
| 페르소나 이름이 명사형 사건 제목과 붙어 어색함 ('…다툼의 홍길동') (P2) | 열림 | Gate 2 |
| 과거 페르소나에 선택한 사건 나이가 맞지 않아도 통과 → 미래 지식이 샐 수 있음 (P2) | 열림 | Gate 2 |
| chat: persona.name 짧은 주입 지시가 먹힘, 돌려 말한 위기 표현은 감지 못 함 (P2) | 열림 | Gate 2 |

### Gate 2 이후 열린 문제 (P2)

- 대화 중 나가기 시 질문이 답 없이 남음, 같은 이름 페르소나 중복, 재시도 때 아바타 재생성.
- 공통 오류 문구(`http.ts`)가 합쇼체이고 키 없음 문구가 그대로 노출됨.
- analyze 60초 한도 대비 입력 상한 30만 자, 응답에 `meta.llm` 포함.
- 시각 P2: 긴 이름 말줄임 이중, 03 하단 안내 가림, 입력란 내부 스크롤 시 반쯤 보이는 줄, 프로필 시트가 설정 폼 느낌.
- 실제 카톡 파일·실기기 safe-area·Vercel 시간 한도는 Gate 3 에서 확인.

### Gate 3 이후 (P2)

- P2 전체는 `run.md` 'P2 목록'. 사용자에게 영향이 큰 것: 함수 리전(iad1), 아바타 나이 차이, 제목 서체·CTA·배경 질감, 사진 localStorage 평문, 속도 제한의 한계.
- 다음: HIL(`hil-gate3.md`), 12/1 이후 Claude 전환 검토, 실기기 safe-area·Capacitor 포팅, 서울 리전·Firewall·OpenAI 월 한도.
