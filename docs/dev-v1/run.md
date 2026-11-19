# Mindme 개발 실행 (run)

> 세션이 끊겨도 이 파일만 보면 이어서 진행할 수 있어야 한다. 상세 로그는 `logs/<task>.md`, 증거는 `evidence/<gate>/`.

## 현재 상태

- 단계: **Gate 0 PASS → Gate 1 PASS(HIL 승인 2026-11-19) → Gate 2 PASS(HIL 대기, `hil-gate2.md`) → Gate 3 PASS → Gate 3 r2 PASS(재배포 완료, HIL 대기, `hil-gate3.md`)**
- 배포 URL: **https://mindme-rho.vercel.app** (Vercel 배포 `dpl_9MKrcesnuzeUYgSG7cRmC57d57Ct`, Root Directory `apps/web`, Node 24.x, 함수 리전 iad1, `OPENAI_API_KEY` 는 서버 환경 변수만. 배포 절차는 `logs/gate3r2-deploy.md`)
- Gate 3 r2 (2026-11-19): Gate 1 HIL 승인 뒤 사용자 지시 '다음 배포까지 무중단 진행'으로 진행. 환경 복구 → 열린 P2 재분류(`logs/gate3r2-triage.md`) → 구현·Critic 루프 → 재배포 → 배포 URL Critic → 커밋·push
- 이 기기 환경: Node 26 은 nvm 으로 설치(`nvm use 26`, 기본값은 20 그대로). `codex`·`vercel` CLI 는 Node 20 경로(`~/.nvm/versions/node/v20.12.2/bin`)에 있다. Codex 구독 한도(2026-11-23 복구) 동안은 `CODEX_API_KEY="$OPENAI_KEY" codex exec …`(exec 전용 API 키, 전역 로그인 유지)로 돌린다. 루트 `.env` 키 이름이 `OPENAI_KEY` 형식이라 `server/env.ts` 가 `OPENAI_API_KEY` 다음 `OPENAI_KEY` 를 읽는다
- 2026-11-19: Gate 1 1차 실행이 네트워크 장애(ENOTFOUND)로 중단되어, 남은 미커밋 작업을 살려 이어서 진행했다(persona·screens 는 이어받아 마무리).
- 개발 서버: `pnpm dev:pocs` → http://localhost:3101 (로그 `logs/pocs-dev.log`), `pnpm dev:web` → http://localhost:3100 (로그 `logs/web-dev.log`)
- 원격: `origin = github.com/mojomoth/mindme` (public, 사용자가 추가). 검증 통과 단위마다 커밋·push

## 루프

Plan → Build → Independent Critic → Fix → Recheck → PASS

- 구현자와 검증자는 분리한다. 검증자는 실제 실행 결과(스크린샷·HTTP 응답·테스트)를 직접 확인한다.
- 실패한 항목만 다시 돈다. P0/P1 은 고친 뒤 통과, P2 는 기록하고 진행할 수 있다.
- 검증을 통과한 작업 단위마다 커밋한다(Commit 단계 에이전트만).

## 역할 · 파일 소유권

| 에이전트 | 역할 | 소유 파일 |
|---|---|---|
| Claude Opus 5.5 (메인) | 통합 · 스캐폴드 · UI 구현 | 루트 설정, `packages/**`, `pocs/**`, `apps/**`, `scripts/**`, `docs/dev-v1/{run,report,api}.md` |
| Claude Sonnet 5.5 | 조사 · 에셋 오케스트레이션 · 검증 보조 | `docs/dev-v1/tools.md`, `.claude/skills/**`, `docs/dev-v1/logs/<자기 작업>.md` |
| Codex gpt-6-astra | 이미지 생성·수정 | `assets/generated/**` |
| Codex gpt-6.1-sol | 독립 Critic (코드·동작 검증) | `docs/dev-v1/logs/critic-*.md` (읽기 전용 검토) |
| Claude CLI sonnet (`claude -p`) | 원본 드래프트 ↔ 실행 화면 외형 비교 | `docs/dev-v1/logs/visual-*.md` |

- 개별 에이전트는 run.md / report.md 를 직접 고치지 않는다. 자기 로그를 `logs/<task>.md` 에 남기고 메인이 반영한다.
- git commit 은 Commit 단계 에이전트만 한다.

## 게이트

### Gate 0 — 준비

| 조건 | 상태 | 근거 |
|---|---|---|
| 기존 프로젝트·제공 파일 확인 | PASS | `logs/scaffold.md` |
| Codex CLI · Claude CLI 실행 확인 | PASS | `logs/cli-model-smoke.md` |
| 오케스트레이션 준비 (도구·스킬 조사) | PASS | `tools.md`, `logs/tools-research.md`, `.claude/skills/` 7종 (Critic r1 PASS) |
| 모델·API 접근 확인 | PASS (OpenAI) / Anthropic BLOCKED (외부, 12/1 복구) / Gemini 보류 | 결정: Gate 1 직접 API 는 OpenAI 만 사용 (텍스트 gpt-6-astra → gpt-6.1-sol, 이미지 gpt-image-2). 상세는 `report.md` 2장. 측정: `logs/cli-model-smoke.md`, `evidence/gate0/critic-r2-raw.txt` |
| 개발 서버 실행 | PASS | `/api/health`, `/pocs`, `/pocs/screens` 200 |
| 최소 API 계약 정의 | PASS | `api.md` ↔ `packages/core/src/schemas.ts`, `pnpm test` 4/4 |
| 하네스 생성 | PASS | `run.md`, `report.md`, `api.md` (report.md 는 서브에이전트 쓰기가 거부돼 메인 세션이 저장) |
| 데스크톱 목업 정렬 · 모바일 전체화면 | PASS | `evidence/gate0/screens-desktop.png`, `screens-desktop-align.png`, `screens-mobile.png` |
| 키 노출 검사 (레포·클라이언트 청크) | PASS | 0건 (`logs/scaffold.md`) |

### Gate 1 — PoC

- 3개 PoC(기록 분석 / 페르소나 생성 / 대화) 핵심 기능을 `/pocs/...` 에서 실제 실행
- 각 PoC 의 입출력 검증 결과를 기능 정의로 남기고, 최소 API(`api.md`)로 분리
- 5개 화면 프론트엔드(`/pocs/screens`, 기능 없이 화면만) — 드래프트와 외형 비교
- PoC 완성 시 HIL(사람 확인). PoC·화면 동결 후 Gate 2

| 조건 | 상태 | 근거 |
|---|---|---|
| LLM 공통 호출(`llm.ts`: generateObject·streamText·editImage) | PASS | `logs/gate1-llm-base.md` |
| 기록 분석 `/pocs/analysis` | PASS (Critic r1b, P2 6) | `logs/gate1-analysis.md`, `logs/gate1-critic-analysis-r1b.md` |
| 페르소나 생성 + 아바타 `/pocs/persona` | PASS (Critic r1b, P2 7) | `logs/gate1-persona.md`, `logs/gate1-critic-persona-r1b.md` |
| 대화 `/pocs/chat` | PASS (Critic r1 P1 수정 → r1b, P2 3) | `logs/gate1-chat.md`, `logs/gate1-critic-chat-r1b.md` |
| 5개 화면 `/pocs/screens` | PASS (Critic r1b, 유사도 7~8/10, P2 7) | `logs/gate1-screens.md`, `logs/gate1-critic-screens-r1b.md` |
| 최소 API 분리 (route 얇게, 로직은 core) | PASS | `api.md`(실측 기준 v1), `packages/core/src/server/http.ts`, `packages/core/src/chat/server.ts`, `evidence/gate1/integrate-api-errors.txt` |
| 기능 정의 | PASS | `features.md` (F1~F5) |
| 회귀: typecheck · test · lint · build · 경로 · 키 검사 | PASS | 3패키지 통과, 32/32, 경고 0, next build 성공, `/pocs` 10개 경로 200, 키 값 657파일 0건 (`evidence/gate1/integrate-*`) |
| HIL (사람 확인) | PASS — 2026-11-19 사용자 승인 | `hil-gate1.md` |
| Gate 1 커밋 | 완료 | Commit 단계 (main push) |

### Gate 2 — 통합 구현

- `apps/web`(포트 3100)에 목표 서비스 구현 — PoC 코드는 `packages/*` 로 재사용, 다시 쓰지 않음
- 전체 화면 이동 플로우 확인
- 워크플로우 진행 내역을 기획 문서에 반영

| 조건 | 상태 | 근거 |
|---|---|---|
| `apps/web` 통합 구현 (packages 재사용, route 얇게) | PASS | `logs/gate2-web.md`, `logs/gate2-core.md` |
| 전체 플로우 (데스크톱·모바일, 실제 AI) | PASS (e2e Critic r1, P2 3) | `logs/gate2-critic-e2e-r1.md`, `evidence/gate2/critic-e2e-r1-*` |
| 원본 드래프트 ↔ 화면 비교 | PASS (visual r2, P2 7) | `logs/gate2-critic-visual-r2.md` |
| 코드 품질 | PASS (ponytail r2, P2 6) | `logs/gate2-critic-ponytail-r2.md`, `logs/gate2-fix-*.md` |
| 최종 회귀 | PASS | typecheck 4패키지, test 40/40, `next build`(web) 성공, 3100·3101 주요 경로 200 |
| 워크플로우 내역 기획 문서 반영 | PASS | `workflow.md`, `MINDME_CONTEXT.md` '구현 반영' |
| HIL (사람 확인) | 대기 (무중단 원칙) | `hil-gate2.md` |

### Gate 3 — 완성 및 배포

- 원본 디자인 ↔ 실제 화면 비교, 데스크톱 검증, 핵심 인터랙션 동작
- 불필요한 UI·코드 제거, 빌드·주요 테스트 통과, 키 노출 검사
- Vercel 배포 성공, 배포 URL 에서 핵심 시나리오 재검증 (파일 저장·실행시간·브라우저 권한 제약 확인)

진행: polish(서버·클라이언트) → audit → cleanup → 로컬 Critic r1 → 배포 → 배포 URL Critic r1. 열린 P0·P1 없음.

| 조건 | 상태 | 근거 |
|---|---|---|
| 원본 드래프트 ↔ 화면 비교 | PASS (01~05 모두 7점 이상, Sonnet 5.5·Codex gpt-6.1-sol) | `logs/gate3-critic-local-r1.md` 1장, `evidence/gate3/critic-local-r1-judge-*` |
| 데스크톱 검증 | PASS (1280x720·1440x900·1920x1080 목업 중심 오차 0.01px 이내, 문서 스크롤 없음) | `logs/gate3-critic-local-r1.md` 2장, `critic-local-r1-capture.json` |
| 핵심 인터랙션 | PASS (실제 OpenAI. 만들기→목록→모달→대화→나가기·다시 받기→프로필 수정→새로고침 복원) | `logs/gate3-critic-local-r1.md` 3장, `critic-local-r1-flow.{mjs,json}` |
| 불필요한 코드 제거 | PASS (감사 P1 8건 삭제, 추가 39·삭제 93줄. 미사용 SDK 2종 제거) | `logs/gate3-audit.md`, `logs/gate3-cleanup.md`, `evidence/gate3/cleanup-diff.patch` |
| 빌드·테스트 | PASS (typecheck 4패키지, test 45/45, lint 경고 0, `build:web`·pocs `build` 성공) | `evidence/gate3/critic-local-r1-{typecheck,test,build-web,build-pocs}.txt` |
| 키 노출 검사 | PASS (작업 트리 1004파일, git 이력 115MB, 클라이언트·서버 빌드 산출물, 배포된 HTML·정적 파일 19개·응답 본문 모두 0건. `NEXT_PUBLIC_` 0) | `evidence/gate3/critic-local-r1-keyscan.txt`, `logs/gate3-critic-remote-r1.md` 3장 |
| 배포 | PASS (https://mindme-rho.vercel.app, READY) | `logs/gate3-deploy-1.md` |
| 배포 URL 핵심 시나리오 재검증 | PASS (데스크톱·모바일 각 2회, 사진 포함 1회. 콘솔 오류 0, 4xx·5xx 0, 로컬과 화면 10쌍 차이 픽셀 0) | `logs/gate3-critic-remote-r1.md` 1·4장, `evidence/gate3/critic-remote-r1-*` |
| 배포 제약 확인 | PASS, 일부 미확인(아래) | `logs/gate3-critic-remote-r1.md` 2장 |

배포 제약 실측: analyze 30만 자 32초(한도 300초), avatar 27.5~31.6초(한도 120초), 요청 본문 4.5MB 초과 시 Vercel 413 을 클라이언트가 한국어로 안내, 스트리밍 청크 단위 도착, 서버 무상태(파일 쓰기 0, 기록은 localStorage), https 보안 컨텍스트와 `Permissions-Policy` 헤더 확인. 미확인은 함수별 `maxDuration` 적용값뿐이다(배포 API 가 값을 돌려주지 않음).

### Gate 3 r2 — 재배포 (2026-11-19)

진행: P2 재분류 54건(이미 해결 12, 이번 수정 17, 나머지 보류) → 빌더 4개(core 분석·core 페르소나/대화·웹 UI·폰트) → Critic(회귀·Codex gpt-6.1-sol·실동작/외형 Claude CLI) → 수정 2라운드 → 재배포 2회 → 배포 URL Critic 3회. 열린 P0·P1 없음.

| 조건 | 상태 | 근거 |
|---|---|---|
| 열린 P2 재분류 | PASS (54건, 결정 근거 포함) | `logs/gate3r2-triage.md`, `evidence/gate3r2/triage.json` |
| 키 파일 배포 업로드 차단 (NEW P1) | PASS — r1 배포 소스에 `/src/.env` 가 있었다. `.vercelignore` 추가, 재배포 소스 189파일에 `.env`·docs 0, 옛 배포본 삭제 | `logs/gate3r2-deploy.md`, `evidence/gate3r2/deploy-source-files.txt` |
| 과거 페르소나 미래 기억 누출 (Critic 이 새로 찾음, 메인이 P1 로 올림) | PASS — 과거의 나에는 '나의 이야기' 원문을 넣지 않고 나이로 거른 사건만 쓴다. 실제 AI 3회 모두 누출 0 | `logs/gate3r2-fix-core-persona-chat-r1.md`, `evidence/gate3r2/fix-story-leak-*.json` |
| 위기 감지 누락 (P1) | PASS — 돌려 말한 표현 보강, 긍정 문장 오탐 줄임. Codex r2 의 새 누락 3문장까지 테스트 고정 | `logs/gate3r2-core-persona-chat.md`, `logs/gate3r2-critic-codex-r2.md`, `evidence/gate3r2/chat-crisis.txt` |
| 분석 | PASS — 파서 날짜 줄 경계(모바일·PC·인용), 30만 1자 413, 큰 입력의 나이 단서(59,033자 → currentAge 31) | `logs/gate3r2-core-analysis.md`, `logs/gate3r2-fix-core-analysis-r1.md` |
| 웹 화면 | PASS — 03 목록 외형 6 → 8점(배포 7점), keep-all, 시트 라벨 중복, 나이 안내 지우기, 첫 생성 같은 이름 방지 | `logs/gate3r2-web-ui.md`, `logs/gate3r2-fix-web-ui-r1.md` |
| 모바일 첫 로드 용량 | PASS — 목업 PNG 263KB → 0, 폰트 2,057,688B → 466,852B(unicode-range 11조각, 글리프 그대로) | `logs/gate3r2-font.md`, `evidence/gate3r2/font-bytes.json` |
| 보안 헤더·교차 사이트 요청 (배포 Critic P2) | PASS — 다른 사이트에서 브라우저로 보낸 POST 403, nosniff·Referrer-Policy·X-Frame-Options·frame-ancestors, `/api/*` no-store | `logs/gate3r2-critic-remote-final.md`, `evidence/gate3r2/final-remote-curl.txt` |
| 로컬 회귀 | PASS — typecheck 4패키지, test 56/56, lint 경고 0, build:web·pocs build, 키 값 7종 1,930파일 0건 | `evidence/gate3r2/final-*.txt` |
| 독립 코드 리뷰 (Codex gpt-6.1-sol) | PASS — r1 P2 2건, r2 P1 1·P2 4건 모두 처리(긍정 오탐 1건은 기록) | `logs/gate3r2-critic-codex-r1.md`, `logs/gate3r2-critic-codex-r2.md` |
| 배포 URL 재검증 | PASS — 핵심 흐름(실제 AI) 데스크톱·모바일 오류 0, 미래 기억 0, 위기 감지·413, 로컬과 화면 차이 0~18px, 키 노출 0(42파일 2.48MB), 옛 배포 404 | `logs/gate3r2-critic-remote-behavior.md`, `logs/gate3r2-critic-remote-security.md`, `logs/gate3r2-critic-remote-final.md` |

## TODO

- [x] 모노레포 스캐폴드 (pnpm workspace: packages/core, packages/ui, pocs)
- [x] PhoneFrame (목업 실측 정렬, 모바일 safe-area)
- [x] `/api/health`, 최소 API 계약, 스키마 테스트
- [x] Playwright 스크린샷 스크립트 (`pnpm shot`)
- [x] 마스코트·에셋 (`logs/mascot-assets.md`, Critic r1 PASS)
- [x] `report.md` 저장 (메인 세션)
- [x] Gate 0 독립 Critic r4, Gate 0 커밋
- [x] Gate 1: `/pocs/analysis`, `/pocs/persona`, `/pocs/chat`, `/pocs/screens` 5개 화면 (Critic 모두 PASS)
- [x] Gate 1 Integrate: API 분리, `api.md` 실측 반영, `features.md`, `hil-gate1.md`, 회귀 (`logs/gate1-integrate.md`)
- [x] Gate 1 HIL: 2026-11-19 사용자 승인 (`hil-gate1.md`)
- [x] Gate 1 커밋 (Commit 단계)
- [x] Gate 2: `apps/web`(3100) 통합 구현, Critic 3종 PASS, 회귀, `workflow.md`
- [ ] Gate 2 HIL(대기): 사람이 `hil-gate2.md` 체크
- [x] Gate 2 커밋 (`b3a469e`, `cea5c30`)
- [x] Gate 3: polish 2종, 감사·정리, 로컬 Critic r1, Vercel 배포·키 등록, 배포 URL Critic r1 (모두 PASS)
- [x] Gate 3 r2: 환경 복구, P2 재분류, 구현·Critic 루프, `.env` 업로드 차단·옛 배포 삭제, 재배포, 배포 URL Critic (모두 PASS)
- [ ] Gate 3 HIL(대기): 사람이 `hil-gate3.md` 를 배포 URL 에서 체크 (r2 항목 포함, 특히 키 교체)
- [x] Gate 3 커밋 (`3a10cfd`~`313d40a`)

## 마지막 검증

- 2026-11-19 Gate 3 r2: 로컬 typecheck 4패키지·test 56/56·lint 0·build 2종·키 검사 1,930파일 0건. 배포 `dpl_9MKrces…` READY, 배포 URL Critic 3회 PASS(핵심 흐름 실제 AI 오류 0, 교차 사이트 POST 403, 보안 헤더, 키 노출 0). dev 3100·3101 켜 둠.
- 2026-11-19 Gate 3: 로컬 Critic r1 PASS(typecheck 4패키지, test 45/45, build 2종, 키 검사 0건), 배포 URL Critic r1 PASS(핵심 시나리오 데스크톱·모바일, 30만 자 analyze 32초, 키 검사 0건, 속도 제한 429 확인). dev 3100·3101 켜 둠.

- 2026-11-19 Gate 2 최종 회귀: `pnpm typecheck` 4패키지, `pnpm test` 40/40, `next build`(apps/web) 성공, 3100 `/`·`/api/health` 200, 3101 `/pocs`·`/pocs/screens`·`/api/health` 200.

- 2026-11-17 scaffold: `pnpm typecheck` / `pnpm lint` / `pnpm test`(4) / `pnpm build` 통과, dev 3101 기동, health 200 (`providers` 모두 true), 스크린샷 4장 + 정렬 검증 1장.
- 2026-11-17 Gate 0 Critic r2: health/pocs/screens 200, 실제 키 값 바이트 검색 802파일 0건, OpenAI gpt-6-astra 200(3.2s) / Anthropic 400 한도 / Gemini 503 (`evidence/gate0/critic-r2-raw.txt`). report.md 반영 후 조건 3·4·7 갱신.
- 2026-11-17 Gate 0 Critic r3 probe: OpenAI gpt-6-astra 200(3.5s) / Anthropic claude-haiku-5-5 400 월 한도(2026-12-01 복구) / Gemini 3.5-flash 45s 타임아웃 (`evidence/gate0/critic-r3-raw.txt`). 결론 변화 없음: 직접 API 는 OpenAI 만 사용.

- 2026-11-17 Gate 0 Critic r4: 타입체크 3패키지 통과, 테스트 4/4, 키 값 바이트 검색 834파일 0건, 목업 정렬 6개 뷰포트 오차 0.01px 미만, Codex 독립 판정 PASS. 유일한 P0는 report.md 없음.
- 2026-11-19 Gate 1 Integrate: route 4개를 `parseRequest` → core 호출로 정리(동작 동일, 오류 경로 10건·정상 호출 analyze 30.1s / persona 21.1s / avatar 29.8s / chat 4.0s 재확인). `pnpm typecheck` 3패키지, `pnpm test` 32/32, `pnpm lint`, `next build` 통과, 빌드 뒤 dev 3101 정상, `/pocs` 10개 경로 200, 키 값 바이트 검색 657파일(레포 + `pocs/.next/static`) 0건 (`logs/gate1-integrate.md`).

## P2 목록

Gate 3 r2 (열린 항목. 재분류 결과 `logs/gate3r2-triage.md` 의 DEFER + 이번 Critic)

- 위기 감지 긍정 문장 오탐 잔존: '사는 게 의미 없는 건 아니야', '사는 게 무슨 의미인지 이제 알겠어' → 109 안내가 한 번 붙는다. 키워드 방식의 한계이고, 놓치는 것보다 낫다는 방침으로 둔다
- 과거 페르소나는 '나의 이야기' 원문을 받지 않는다. 앱은 이야기를 분석해 나이가 붙은 사건으로 넘기므로 영향이 없지만, `/api/persona` 를 직접 부르는 호출자는 과거 페르소나에서 이야기를 잃는다. 분석이 사건 나이를 어리게 잡으면 그 사건은 과거 페르소나에 들어간다
- 03 목록 외형 7~8점: 카드가 조금 촘촘하고, 히어로와 목록의 세로 리듬이 다르며, 배경 그라데이션이 약하다(시각 취향, HIL)
- 시각 취향(HIL): 둥근 제목 서체·그라데이션 CTA·배경 질감 없음, 04 모달 안내 상자, 05 입력창 포커스 테두리, 데스크톱 02 마스코트 하단 잘림, 360x740 02 사진 카드 스크롤
- CSS hex 리터럴 46곳(기존 화면 5개 파일). 화면은 같고 코드 위생 문제라 미뤘다
- 아바타 나이 차이가 약하다(프롬프트 조정은 이미지 비용이 커서 HIL 판단 뒤)
- 함수 리전 iad1 유지: 실측해 보니 첫 글자 지연은 대부분 모델 시간이다(배포 /api/chat 첫 바이트 2.2~4.0초, OpenAI 왕복 0.34초). OpenAI 가 미국에 있어 icn1 로 옮겨도 줄 근거가 없다
- 함수별 `maxDuration` 적용값은 배포 API 로 확인할 수 없다(코드 export 로만 확인)
- 속도 제한이 인스턴스 메모리 기반이다. 비용을 확실히 막으려면 Vercel Firewall·OpenAI 프로젝트 월 한도(외부 설정, 사용자 몫)
- 얼굴 사진이 localStorage `mindme:photo` 에 평문으로 남는다. 보관 정책은 HIL
- 감사 P3(`logs/gate3-audit.md`): pocs 전용 아바타 2장이 web 빌드에 포함, 앱이 안 쓰는 기본값 분기·요청 필드, `plainName` 우회, 루트 `pnpm build` 가 pocs 빌드, 기본값만 쓰는 화면 옵션, 모달 계산 중복
- PoC 전용(동결): 30만 자 초과 안내, zod 영어 문구, 다시 분석 시 직접 고친 사건 소실, `mindme:analysis:last` 원문 저장, 'Choose File' 영어
- Vercel CLI 48.0.3 이 Node `24.x` 를 경고한다(빌드는 성공). CLI 를 올리면 사라질 것으로 본다
- r2 에서 해결한 Gate 3 r1 항목: analyze 400 문구, persona 400 필드 이름, api.md `/api/chat`, 03 제목 줄바꿈, 시트 라벨 중복, summarized `currentAge` null, 모바일 목업·폰트 용량, Gate 1 의 파서·위기 감지·present 나이·설정 문구 기억 누출

Gate 3 (열린 항목. 로컬 Critic r1·배포 Critic r1 기준)

- analyze 400 문구: 30만 1자 입력이 '기록 내용을 읽지 못했어요…'로 끝나 길이 초과를 읽기 실패처럼 안내한다(클라이언트가 먼저 막아 앱에서는 안 보임)
- persona 400 문구에 필드 이름이 나온다('…events 에서 찾지 못했어요'). API 를 직접 부를 때만 보인다
- api.md ↔ `/api/chat`: 문서는 persona 를 빼면 샘플로 대화한다고 하는데 배포(apps/web)는 400 이다
- 03 목록 카드 제목이 어절 중간에서 줄바꿈된다(`word-break: keep-all` 없음)
- 프로필 시트: `section aria-label="이름"` 과 입력란 라벨이 겹친다
- 아바타 나이 차이가 약하다(15·18·24·40살이 머리 모양·안경 같고 옷만 다름, Gate 1 P2 와 같음)
- 시각 취향: 둥근 제목 서체·그라데이션 CTA·배경 질감 없음, 04 모달의 드래프트에 없는 안내 상자, 05 입력창 포커스 테두리
- 함수 리전 iad1(미국 동부): 대화 첫 글자 1.3~5.5초. 리전 변경은 미결정
- 함수별 `maxDuration` 실제 적용값을 배포 API 로 확인하지 못했다
- analyze 큰 입력(summarized)에서 `owner.currentAge` 가 null
- 속도 제한이 인스턴스 메모리라 완벽하지 않다. 비용을 확실히 막으려면 Vercel Firewall 이나 OpenAI 프로젝트 월 한도를 함께 건다
- 프라이버시: 얼굴 사진이 localStorage `mindme:photo`, analyze 원문이 `mindme:analysis:last`(PoC)에 평문으로 남는다
- 아바타 생성 시간 편차(25~74초)로 120초 한도 여유가 줄 때가 있다
- 정리 감사 P2 15건 중 판단 대기분(`logs/gate3-audit.md`): 모바일에서도 목업 PNG 263KB·폰트 2.06MB 를 받는다 등
- 모바일 02 360x740 첫 화면에서 사진 카드는 스크롤해야 보인다. 일부 CSS 에 hex 리터럴이 남아 있다

Gate 3 에서 처리한 Gate 2 항목(취소선 대신 요약): 대화 중 나가기, 같은 이름 중복 확인, 아바타 재사용 재시도, 03 하단 안내, 02 모바일 첫 화면, 입력란 반쯤 보이는 줄, 긴 이름 말줄임, 프로필 시트 재구성, `http.ts` 문구, analyze 300초·동시 요약, `meta.llm` 제거, 미사용 SDK 제거, PoC 중복 코드 제거 (`logs/gate3-client.md`, `logs/gate3-server.md`, `logs/gate3-cleanup.md`)

Gate 2 (Critic 최종 라운드 기준, Gate 3 후보)

- e2e 대화: 스트리밍 중 '나가기'를 누르면 보낸 질문이 답 없이 남고, 다시 들어가도 안내·'다시 받기'가 없다
- e2e 모달: 이미 페르소나가 있는 사건으로 만들면 이름이 같은 페르소나가 또 생긴다(목록에서는 미리보기로만 구별)
- e2e 재시도: `/api/persona` 만 실패해도 '다시 시도'가 이미 성공한 아바타까지 다시 그린다(약 30초·이미지 비용)
- visual: 긴 이름(20자)은 말줄임이 이름 가운데에 두 번 들어간다
- visual: 03 목록 페르소나 3개 이상이면 하단 안내가 생성 버튼에 가린다(스크롤하면 보임)
- visual: 02 만들기 모바일 첫 화면에서 사진 카드가 생성 버튼 뒤에 있다(360x740 은 이름·나이 줄까지)
- visual: 04 모달 상황 설명·프로필 시트 입력란이 안에서 스크롤될 때 위아래 줄이 반쯤 보인다(Codex 가 가장 심각하게 봄)
- visual: 프로필 시트가 입력 칸 5개를 이은 설정 폼처럼 보인다(어울림 Sonnet 6, Codex 8)
- visual: 데스크톱 02 에서 폼을 다 채우면 마스코트 발·말풍선 아래가 상태바 경계에서 잘려 보인다
- visual: 새 화면 CSS 에 hex 리터럴 색이 남아 있다
- ponytail: core analysis 가 만드는 `owner` 를 apps/web 이 쓰지 않는다
- ponytail: pocs PersonaPoc 의 `shrink`·`toDataUrl` 이 `packages/ui/src/image.ts` 와 같은 코드다
- ponytail: core 의 `getAnthropic`·`getGoogle` 호출처가 없고 두 SDK 는 health 표시에만 쓴다
- ponytail: `server/http.ts` 공통 오류 문구가 합쇼체이거나 필드 이름을 드러낸다. 배포 환경에 키가 없으면 'AI 공급자 키가 설정되지 않았습니다.' 가 그대로 보인다
- ponytail: analyze `maxDuration` 60초인데 입력 상한은 30만 자다(4만 자 초과 시 배포에서 초과 가능)
- ponytail: analyze 응답의 `meta.llm`(AI 원시 출력)이 클라이언트까지 내려간다. 앱은 `meta.me` 만 쓴다

Gate 1 (Gate 2 에서 처리한 것은 취소선. 나머지는 Gate 3 후보)

- ~~screens 05 자동 스크롤, 04 모달 Esc, 03 360px 히어로·02 하단 간격, 기본 아바타 해시 경로, 화면 zod 영어 문구~~ → Gate 2 해결 (`logs/gate2-web.md`, `logs/gate2-core.md`)
- 해결 여부를 이번에 다시 확인하지 않은 항목은 아래 원문 목록을 기준으로 한다(Gate 1 목록 전체는 git 이력의 이전 run.md 참고)

Gate 1 원문 (Critic r1b·Integrate 기준)

- analysis 파서(`packages/core/src/analysis/parse.ts`): 여러 줄 메시지 중간에 날짜 구분선과 같은 모양의 줄('2019년 3월 2일 토요일')이 있으면 구분선으로 인식해, 그 뒤에 이어지던 줄이 사라진다
- analysis 입력 UX: 30만 자를 넘는 파일을 올리면 버튼만 꺼지고 할 수 있는 일을 안내하지 않는다. 다른 파일을 올려도 이전 오류 문구가 남는다
- analysis·chat 오류 문구: 수정 폼 검증 오류와 API 400 메시지에 zod 영어 문구가 섞인다
- analysis 다시 분석: 타임라인 전체가 새 결과로 바뀌어 직접 추가·수정한 사건이 확인 없이 사라진다. 출처가 다른 기록끼리 합쳐지지 않는다
- analysis 프라이버시: localStorage `mindme:analysis:last` 에 원문 전체(최대 30만 자)가 평문으로 남는다
- analysis UI 문구: 파일 선택 버튼이 브라우저 기본 영어 'Choose File / No file chosen' 이다
- chat 이름 필드 주입: `persona.name` 이 정보 블록 밖(첫 줄·마지막 규칙 줄)에 들어가 40자 이내 짧은 지시가 먹힌다(PWNED 접두어, 영어로만 답하기, 해적 캐릭터). 코드 출력·위기 대응 무력화·자해 방법·규칙 유출은 0건
- chat 위기 감지: 돌려 말한 표현은 감지하지 못하고(X-Crisis 0, 109 없음) 마지막 user 메시지만 검사한다
- chat 번들: 시스템 프롬프트 문구가 클라이언트 번들에 들어 있다(비밀은 아님)
- persona (past): 과거 나이와 선택한 사건의 나이가 달라도 통과하고, 선택한 사건은 나이와 상관없이 프롬프트에 들어가 미래 지식이 샐 수 있다
- persona 프롬프트: 기록이 적을 때 설정 문구가 memories 로 새어 나온다
- persona 기본 아바타: 해시가 붙은 `/_next/static/media` 경로로 localStorage 에 저장돼, 다시 빌드하면 깨진다
- persona (present): `age` 와 `profile.currentAge` 일치를 서버가 검사하지 않는다
- ~~api.md 에 `futureGoals`·`event` 없음~~ → Integrate 에서 반영
- 아바타 품질: 8살과 34살의 나이 차이가 약하고, 60살은 회색 머리 말고는 나이 든 티가 적다
- persona·chat PoC 화면: 새로고침하면 폼의 이름·지금 나이가 샘플 값으로 돌아간다. chat 모바일에서 이름이 길면 '초기화' 버튼이 세로로 꺾인다
- screens 03 목록 2행 아바타: '첫 출근 날의 홍길동' 그림체·크롭이 드래프트와 다르다(드래프트 3/4 측면·갈색 가르마, 구현 정면 상반신·검은 웨이브. 의상·소품은 같음). codex P1(7점) / claude P2(8점) — HIL 판단
- screens 배경: 단색 `--mm-bg` 라 드래프트의 옅은 하늘색 그라데이션·질감이 없다. CTA 도 단색
- screens 03 목록 360px: 히어로 캐릭터 팔이 제목 '?'·부제 끝 '요'에 맞닿는다. 하단 '다른 순간의 나도 만나보세요' 가 CTA 그라데이션에 반쯤 가려진다(스크롤하면 보임)
- screens 05 대화: 메시지를 보내도 맨 아래로 스크롤되지 않아 새 말풍선이 입력창 뒤에 가려진다
- screens 04 모달: Esc 로 닫히지 않는다(X·스크림 클릭은 됨)
- screens 02 생성 데스크톱: 흰 패널 하단과 CTA 사이 간격이 약 10px 로 드래프트보다 좁다
- 실제 사용자 카카오톡 내보내기 파일·30만 자 상한 입력은 실측하지 않았다. 아바타 30~35s 는 Vercel 함수 시간 한도 확인 필요 (Gate 3)

Gate 0

- ~~스키마 길이 제한이 api.md 에 없음~~ → Gate 1 Integrate 에서 반영
- ~~카카오톡 TXT 파서, 03 '고개 내민' 마스코트, 01 하트 말풍선 에셋 없음~~ → Gate 1 에서 해소
- safe-area 는 Chromium 에뮬레이션에서 0px 라 실기기 확인 필요 (Gate 3)
- Anthropic 월 한도(12/1 복구), Gemini 45초 타임아웃: 외부 요인, Gate 1 은 OpenAI 사용

## BLOCKED

- Codex CLI 구독 한도(2026-11-23 20:02 복구): exec 전용 `CODEX_API_KEY` 로 우회(프로젝트 OpenAI 크레딧 사용). 워크플로 안의 Codex Critic 에이전트가 셸 명령 하나에서 1시간 넘게 멈춰, Codex 리뷰는 메인 세션이 직접 돌렸다
- Anthropic API: 월 사용 한도 소진(2026-12-01 복구). 앱 AI 는 OpenAI 로 진행
- 서브에이전트는 `report.md` 파일을 쓸 수 없음 → report.md 반영은 메인 세션이 한다 (서브에이전트는 `logs/` 에 초안)

## 다음 작업

1. Gate 3 HIL: 사람이 `hil-gate3.md` 를 배포 URL 에서 체크한다. r2 에서 더한 항목이 있다: **옛 배포본에 올라갔던 키 교체**(OpenAI·Anthropic·Google·Vercel·Render), 03 목록 외형, 과거의 나가 미래 일을 모르는지, 모바일 첫 화면 속도
2. 2026-12-01 이후 Claude 전환 검토(Anthropic 월 한도 복구 뒤 재측정). 바꿀 곳은 `server/env.ts`·`server/ai.ts`·`server/llm.ts` 세 곳
3. 실기기 safe-area 확인과 Capacitor 포팅(iOS·Android)
4. 외부 설정(사용자): Vercel Firewall rate limit, OpenAI 프로젝트 월 한도
5. HIL 결과를 `report.md`·P2 목록에 반영한다
