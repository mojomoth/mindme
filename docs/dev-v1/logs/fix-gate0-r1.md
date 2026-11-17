# fix-gate0-r1 로그 (Builder, Gate 0 Critic round 1 결함 수정)

- 일시: 2026-11-17
- 대상 결함: P0 `report.md` 없음, P1 AI 공급자 결정 미기록 (`evidence/gate0/critic-r1-gate0.md`)

## 한 일

1. OpenAI 직접 API 재측정 (키를 출력하지 않는 fetch 스크립트, scratchpad 의 `probe.mjs`. 오류 메시지의 `sk-`/`AIza` 패턴은 가림)
   | 호출 | 결과 | 지연 |
   |---|---|---|
   | responses gpt-6-astra | 200, 출력 "OK" | 2741ms |
   | responses gpt-6.1-sol | 200 | 4426ms |
   | images/generations gpt-image-2 (1024x1024, quality low) | 200, PNG 834,886 B | 9261ms |
   - 이미지 증거: `evidence/gate0/fix-r1-gpt-image-2-probe.png` (Read 로 직접 확인: 노란 동글이 + 주황 두 잎 새싹, 불투명 배경). 투명 배경 출력은 확인하지 않음.
   - Anthropic·Gemini 는 다시 호출하지 않고 Critic r1 측정값을 그대로 썼다(Anthropic 400 한도 12/1, gemini-3.5-flash 39.3s·타임아웃, gemini-3.1-pro-preview 429).
2. `docs/dev-v1/report.md` 작성 시도 → **하네스가 거부**: `Subagents should return findings as text, not write report files.` (scaffold 에이전트가 겪은 것과 같은 거부). 도구 우회(셸로 쓰기 등)는 하지 않았다.
   → 메인 세션이 아래 '최종 report.md 본문'을 그대로 `docs/dev-v1/report.md` 로 저장해야 P0 이 닫힌다.
3. run.md 는 소유권 규칙대로 건드리지 않았다. 메인이 반영할 것: TODO '[ ] report.md 생성' 체크, Gate 0 조건 4 → `PASS (OpenAI) / Anthropic BLOCKED(외부) / Gemini 보류`, 조건 7 → report.md 저장 후 PASS.
4. dev 서버 3101 은 그대로 둠(pid 86133 LISTEN). 커밋 안 함.

---

## 최종 report.md 본문 (메인 세션이 docs/dev-v1/report.md 로 그대로 저장)

````markdown
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
| OpenAI gpt-6-astra (responses) | 200 | 5.1s (smoke), 4.8s (Critic), 2.7s (fix-r1) |
| OpenAI gpt-6.1-sol (responses) | 200 | 4.4s (fix-r1) |
| OpenAI gpt-image-2 (images/generations, 1024x1024, quality low) | 200, PNG 생성 | 9.3s (fix-r1), `evidence/gate0/fix-r1-gpt-image-2-probe.png` |
| Anthropic claude-sonnet-5-5 / claude-haiku-5-5 (messages) | 400: 월 사용 한도 도달, 2026-12-01 00:00 UTC 복구 | 0.5s |
| Google 모델 목록 | 200 (gemini-3.5-flash, gemini-3.1-pro-preview 포함) | — |
| Google gemini-3.5-flash (generateContent) | 타임아웃 3회(60s 2회, 45s 1회), 성공 1회 200 | 성공 시 39.3s |
| Google gemini-3.1-pro-preview (generateContent) | 429: 쿼터 초과 | — |

결론: 지금 직접 API 로 쓸 수 있는 공급자는 **OpenAI 하나뿐**이다. `/api/health` 의 `providers` 는 키가 있는지만 보므로 `anthropic:true`, `google:true` 가 실제 호출 가능 여부와 다르다(P2, 아래 미해결 참고).

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
| @anthropic-ai/sdk | 1.8.0 | 1.9.0 은 공개 1일 미만이라 pnpm `minimumReleaseAge` 위반. 예외를 두지 않음 |
| @google/genai | 3.3.0 | 위와 같음 |
| openai | 7.57.0 | 정책 통과 |
| zod 4.6.7, @playwright/test 1.65.1, server-only 0.0.1 | — | 최신 |
| protobufjs 설치 스크립트 | 차단 | 필요 없음 |

## 3. 미해결 문제

| 문제 | 상태 | 다음 조치 |
|---|---|---|
| Anthropic 직접 API 월 한도 소진 | BLOCKED (외부, 2026-12-01 복구) | 복구 후 재측정. 그 전까지 OpenAI 사용 |
| Gemini 지연(flash 39s·타임아웃)과 쿼터(pro 429) | 보류 | 쿼터·네트워크 확인 후 재측정 |
| 원격 저장소·gh 없음 | push BLOCKED | 커밋만 진행 |
| `/api/health` 가 키 존재만 보고 `true` 를 돌려줌 (P2) | 열림 | 필드 이름을 `configured` 로 바꾸거나 api.md 에 의미를 명시 |
| Claude CLI 로그인 2026-11-18 만료 가능 (P2) | 열림 | 긴 작업 전에 `claude setup-token` |
| `NativeAdapter.storage` 가 동기 API (P2) | 열림 | Capacitor Preferences 는 비동기라 Gate 1 에서 async 로 바꾸고, 카메라 어댑터 추가 |
| 생성 에셋이 아직 `packages/ui` 로 옮겨지지 않음, 로고용 '빼꼼' 변형 없음 (P2) | 열림 | Gate 1 |
| gpt-image-2 투명 배경 출력 | 미검증 | Gate 1 아바타 PoC 에서 확인 |
| 모바일 safe-area 는 Chromium 에뮬레이션에서 0 | 열림 | 실기기 확인(Gate 3) |
````
