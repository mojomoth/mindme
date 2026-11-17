# scaffold 로그 (Gate 0)

> `docs/dev-v1/report.md` 작성은 서브에이전트 하네스가 거부했다("Subagents should return findings as text"). 아래 "report.md 초안" 절을 메인 세션이 report.md 로 옮긴다.

## 만든 것

- 루트: `package.json`(scripts: dev:pocs, build, typecheck, lint, test, shot), `pnpm-workspace.yaml`(packages/*, pocs, apps/*; `allowBuilds: protobufjs: false`), `tsconfig.base.json`, `pnpm-lock.yaml`, `.gitignore` 에 `next-env.d.ts` 추가
- `packages/core`: `src/schemas.ts`(API 계약 zod), `src/index.ts`, `src/server/{env,ai,index}.ts`(`server-only`), `test/schemas.test.ts`(node --test, 4건)
- `packages/ui`: `src/styles/tokens.css`, `src/fonts/{pretendard.woff2,PRETENDARD-LICENSE.txt}`(legacy 에서 복사), `src/assets/mockup-iphone.png`(원본 assets/ 유지, 복사본), `src/PhoneFrame.tsx`+`.module.css`, `src/native.ts`(NativeAdapter: pickFile, storage), `src/env.d.ts`
- `pocs`: Next 16.4.6 — `next.config.ts`, `app/layout.tsx`, `app/page.tsx`(→ /pocs), `app/pocs/page.tsx`(인덱스, 미구현 '준비 중'), `app/pocs/screens/page.tsx`(PhoneFrame + 준비 중), `app/api/health/route.ts`, `eslint.config.mjs`. `AGENTS.md` 는 `next dev` 가 자동 생성(유지)
- `scripts/shot.mjs`: `node scripts/shot.mjs <url> <desktop|mobile> <out.png> [--full]` (desktop 1440x900 DPR1, mobile 390x844 DPR3 터치)
- `docs/dev-v1/{api.md,run.md}`

## 실행 기록

| 명령 | 결과 |
|---|---|
| `pnpm install` | OK (442 패키지, 공급망 정책 통과) |
| `pnpm exec playwright install chromium` | OK |
| `pnpm typecheck` | OK (core, ui, pocs — pocs 는 `next typegen && tsc`) |
| `pnpm lint` | OK (0 경고) |
| `pnpm test` | 4/4 pass |
| `pnpm build` | OK — `/`, `/pocs`, `/pocs/screens` 정적, `/api/health` 동적 |
| dev 3101 (nohup, `logs/pocs-dev.log`) | `/api/health` 200, `/pocs` 200, `/pocs/screens` 200, `/` 200 |
| health 응답 | `{"ok":true,"providers":{"anthropic":true,"openai":true,"google":true}}` |
| prod `next start -p 3102` health | 위와 동일 (확인 후 종료) |

### 겪은 문제

1. TS 7.0.2 / ESLint 10 → typescript-eslint(<6.1), eslint 플러그인(≤9) 피어 불일치 → TS 6.0.3, ESLint 9.39.5 로 고정
2. `@anthropic-ai/sdk@1.9.0`, `@google/genai@3.4.0` 이 공개 1일 미만이라 pnpm 이 `minimumReleaseAgeExclude` 를 자동 추가함 → 예외를 지우고 1.8.0 / 3.3.0 사용, `pnpm clean --lockfile` 후 재설치
3. 처음 health 가 providers 모두 false: Next 가 pocs/ 기준으로 env 를 먼저 로드·캐시(`__NEXT_PROCESSED_ENV`) → `loadEnvConfig(root, dev, log, true)`(forceReload)로 해결
4. 첫 스크린샷 2건이 컴파일 중 실패 → 재실행으로 통과(1회성)
5. 스크린샷에 Next 개발 인디케이터가 찍힘 → `devIndicators: false`

## 목업 실측 (PIL, 플러드필 스크립트는 scratchpad — 재현 방법은 아래)

- 이미지 851x1848 RGBA, 중앙 alpha 0
- 화면 영역: 중앙 (425,924)에서 alpha<128 4방향 플러드필 → bbox x 36..815, y 34..1816 = 780x1783
  - left 36/851 = 4.2303%, top 34/1848 = 1.8398%, width 780/851 = 91.6569%, height 1783/1848 = 96.4827%
  - 중앙 행 alpha: 베젤 안쪽 경계 x=34(215) → 35(18) → 36(0)
- 코너: 위쪽 행별 xmin — top+0:161, +10:103, +20:84, +40:62, +80:42, +100:38, x0(36) 도달 top+116 / bottom-114 → 원 근사 반경 113~116 → 112px 채택(가로 14.359%, 세로 6.282%). 반경이 작으면 베젤 아래로 숨고, 크면 틈이 보이므로 작게 잡음
- Dynamic Island(불투명, x 200..650 · y 40..200 안): x 306..545, y 54..128 → 화면 기준 x 270..509, y 20..94 → 논리(÷2) y 10..47
- 상단 스피커 라인 y 0..35 (화면 bbox 위)

### 정렬 검증

- 화면 배경을 마젠타로 바꾸고 main 숨김 → 1440x900 DPR2, 1920x1200 DPR1, 800x700 DPR2 렌더
- 바깥에서 밝은색 플러드필 후 도달 못 한 밝은 픽셀 = 틈 후보: 6 / 1 / 5 px, 모두 측면 버튼 하이라이트 위치(x≈525css) — 화면-베젤 틈 0
- 코너·Island 확대 육안 확인: 마젠타가 베젤 밖으로 새지 않음, 9:41 과 Island 수직 정렬 일치
- 측정된 화면 rect (1440x900): screen 359.6x822.0 @ (540.4, 39.7), frame 392.3x852 @ (523.8, 24) → 배율 0.922

## 증거

- `docs/dev-v1/evidence/gate0/screens-desktop.png` (1440x900, 목업 + 준비 중)
- `docs/dev-v1/evidence/gate0/screens-desktop-align.png` (2880x1800, 마젠타 정렬 검증)
- `docs/dev-v1/evidence/gate0/screens-mobile.png` (390x844 DPR3, 목업 없음)
- `docs/dev-v1/evidence/gate0/pocs-desktop.png`, `pocs-mobile.png` (PoC 인덱스)

## 키 노출 검사

- `grep -rInE "sk-ant|sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|apik[A-Za-z0-9_-]{8,}"` 레포(.env, node_modules, .next, .git 제외) → 0건
- 같은 패턴으로 `pocs/.next/static`(클라이언트 청크) → 0건
- 실제 .env 값(12자 이상) 바이트 검색: `pocs/.next` 전체 0건, 레포(node_modules·.git·.next 제외, logs 포함) 0건 — 값은 출력하지 않고 개수만 집계
- `NEXT_PUBLIC` 사용 0건 (next.config.ts 주석 1건만)

---

## report.md 초안 (메인 세션이 docs/dev-v1/report.md 로 옮길 내용)

### 아키텍처 결정

| 결정 | 근거 |
|---|---|
| pnpm workspace 모노레포 (`packages/core`, `packages/ui`, `pocs`, `apps/*`) | PoC 코드를 Gate 2 에서 다시 쓰지 않고 재사용 |
| `@mindme/core`: zod 스키마·타입 + 서버 전용 AI 클라이언트(`@mindme/core/server`, `import 'server-only'`) | API 계약을 한 곳에서 관리. 서버 코드가 클라이언트에 섞이면 빌드 실패로 막힘 |
| `@mindme/ui`: 화면 컴포넌트·PhoneFrame·토큰·폰트·이미지 | PoC 와 apps 가 같은 화면 공유 |
| 패키지는 TS 소스를 그대로 export, Next `transpilePackages` | 패키지 빌드 단계·dist 제거 |
| Next.js 16.4.6 (App Router, Turbopack), React 19.3.1 | 최신 안정판 |
| CSS Modules + CSS 변수 (Tailwind 없음) | 의존성 최소화 |
| 루트 `.env` 하나, `next.config.ts` 에서 `loadEnvConfig(root, dev, log, true)` | Next 가 pocs/ 기준 env 를 먼저 캐시 → forceReload 필요(실측) |
| SDK 에 `apiKey` 명시 전달 | 키 이름(`CLAUDE_API_KEY` 등)이 SDK 기본값과 다름 |
| 서버 무상태, 클라이언트 저장 | Vercel 파일시스템 비영속 |
| `NativeAdapter`(pickFile, storage) 경계 | Capacitor 포팅 시 구현만 교체 |
| 목업 배율을 CSS 만으로 계산 `min(1, tan(atan2(100dvh - 48px, 924px)), tan(atan2(100vw - 48px, 425.5px)))` | JS 측정 없이 SSR 첫 화면부터 정확 |
| 목업 안은 390px 논리 폭으로 그리고 `transform: scale` | 드래프트(390 폭)와 같은 px 값으로 구현·비교. `contain: layout paint` 로 fixed 모달이 화면 안에 갇힘 |
| 데스크톱 목업 안 가짜 상태바(9:41)·홈 인디케이터, `--mm-safe-top: 59px` / `--mm-safe-bottom: 34px`; 모바일(≤600px)은 `env(safe-area-inset-*)` | 드래프트와 같은 크롬, 실기기에서는 OS 값 사용 |

### 버전 고정

| 패키지 | 버전 | 이유 |
|---|---|---|
| typescript | 6.0.3 (7.0.2 아님) | typescript-eslint 8.x 가 `<6.1` 만 지원 |
| eslint | 9.39.5 (10 아님) | eslint-config-next 16.4 플러그인 피어 ≤9 |
| @anthropic-ai/sdk | 1.8.0 | 1.9.0 은 공개 1일 미만 → pnpm `minimumReleaseAge` 위반, 예외 두지 않음 |
| @google/genai | 3.3.0 | 위와 같음 |
| openai | 7.57.0 | 정책 통과 |
| zod 4.6.7, @playwright/test 1.65.1, server-only 0.0.1 | — | 최신 |
| protobufjs 설치 스크립트 | 차단 | 불필요 |

### 미해결

- Anthropic 직접 API 월 한도 소진(12/1 복구), Gemini 타임아웃 — `logs/cli-model-smoke.md`
- 원격 저장소·gh 없음 → push BLOCKED
- 모바일 safe-area 는 Chromium 에뮬레이션에서 0 → 실기기 확인 필요(Gate 3)
