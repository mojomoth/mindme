# Mindme 개발 실행 (run)

> 세션이 끊겨도 이 파일만 보면 이어서 진행할 수 있어야 한다. 상세 로그는 `logs/<task>.md`, 증거는 `evidence/<gate>/`.

## 현재 상태

- 단계: **Gate 0 PASS (Critic r4 8/9 + 메인이 report.md 저장해 조건 7 해소) → Gate 1 진행 중**
- 개발 서버: `pnpm dev:pocs` → http://localhost:3101 (로그 `logs/pocs-dev.log`)
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

### Gate 2 — 통합 구현

- `apps/web`(포트 3100)에 목표 서비스 구현 — PoC 코드는 `packages/*` 로 재사용, 다시 쓰지 않음
- 전체 화면 이동 플로우 확인
- 워크플로우 진행 내역을 기획 문서에 반영

### Gate 3 — 완성 및 배포

- 원본 디자인 ↔ 실제 화면 비교, 데스크톱 검증, 핵심 인터랙션 동작
- 불필요한 UI·코드 제거, 빌드·주요 테스트 통과, 키 노출 검사
- Vercel 배포 성공, 배포 URL 에서 핵심 시나리오 재검증 (파일 저장·실행시간·브라우저 권한 제약 확인)

## TODO

- [x] 모노레포 스캐폴드 (pnpm workspace: packages/core, packages/ui, pocs)
- [x] PhoneFrame (목업 실측 정렬, 모바일 safe-area)
- [x] `/api/health`, 최소 API 계약, 스키마 테스트
- [x] Playwright 스크린샷 스크립트 (`pnpm shot`)
- [x] 마스코트·에셋 (`logs/mascot-assets.md`, Critic r1 PASS)
- [ ] `report.md` 저장 (메인 세션. 본문: `logs/fix-gate0-r1.md` + `logs/fix-gate0-r2.md` 변경 3줄 적용본, `logs/fix-gate0-r3.md` 참고)
- [x] Gate 0 독립 Critic r4 실행 (판정 FAIL, `evidence/gate0/critic-r4-gate0.md`)
- [x] Gate 0 커밋 (chore(gate0): monorepo scaffold, mockup shell, harness, assets)
- [ ] Gate 1: `/pocs/analysis`, `/pocs/persona`, `/pocs/chat`, `/pocs/screens` 5개 화면

## 마지막 검증

- 2026-11-17 scaffold: `pnpm typecheck` / `pnpm lint` / `pnpm test`(4) / `pnpm build` 통과, dev 3101 기동, health 200 (`providers` 모두 true), 스크린샷 4장 + 정렬 검증 1장.
- 2026-11-17 Gate 0 Critic r2: health/pocs/screens 200, 실제 키 값 바이트 검색 802파일 0건, OpenAI gpt-6-astra 200(3.2s) / Anthropic 400 한도 / Gemini 503 (`evidence/gate0/critic-r2-raw.txt`). report.md 반영 후 조건 3·4·7 갱신.
- 2026-11-17 Gate 0 Critic r3 probe: OpenAI gpt-6-astra 200(3.5s) / Anthropic claude-haiku-5-5 400 월 한도(2026-12-01 복구) / Gemini 3.5-flash 45s 타임아웃 (`evidence/gate0/critic-r3-raw.txt`). 결론 변화 없음: 직접 API 는 OpenAI 만 사용.

- 2026-11-17 Gate 0 Critic r4: 타입체크 3패키지 통과, 테스트 4/4, 키 값 바이트 검색 834파일 0건, 목업 정렬 6개 뷰포트 오차 0.01px 미만, Codex 독립 판정 PASS. 유일한 P0는 report.md 없음.

## P2 목록

- 스키마 길이 제한(Persona.id ≤64, Event.date ≤40, situation ≤2000, me ≤40)이 api.md 에 없음
- 카카오톡 TXT 파서(packages/core), 03 '고개 내민' 마스코트, 01 하트 말풍선 에셋 없음 (Gate 1)
- safe-area 는 Chromium 에뮬레이션에서 0px 라 실기기 확인 필요 (Gate 3)
- Anthropic 월 한도(12/1 복구), Gemini 45초 타임아웃: 외부 요인, Gate 1 은 OpenAI 사용

## BLOCKED

- Anthropic API: 월 사용 한도 소진(2026-12-01 복구). 앱 AI 는 OpenAI 로 진행
- 서브에이전트는 `report.md` 파일을 쓸 수 없음 → report.md 반영은 메인 세션이 한다 (서브에이전트는 `logs/` 에 초안)

## 다음 작업

1. Gate 1: `/pocs/analysis`, `/pocs/persona`, `/pocs/chat` PoC 3종과 `/pocs/screens` 5개 화면 프론트엔드
2. Anthropic 은 2026-12-01 복구 후 재측정하고, Gemini 는 쿼터·지연 해소 후 재측정한다 (결정: `report.md` 2장)
3. 위 P2 항목은 Gate 1 에서 처리
