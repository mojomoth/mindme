# Mindme 개발 실행 (run)

> 세션이 끊겨도 이 파일만 보면 이어서 진행할 수 있어야 한다. 상세 로그는 `logs/<task>.md`, 증거는 `evidence/<gate>/`.

## 현재 상태

- 단계: **Gate 0 진행 중**
- 개발 서버: `pnpm dev:pocs` → http://localhost:3101 (로그 `logs/pocs-dev.log`)
- 원격 저장소 없음 → push 는 BLOCKED (커밋만)

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
| 오케스트레이션 준비 (도구·스킬 조사) | 진행 중 | `tools.md`, `logs/tools-research.md` |
| 모델·API 접근 확인 | 부분 | OpenAI PASS / Anthropic API 한도 초과 / Gemini 타임아웃 (`logs/cli-model-smoke.md`) |
| 개발 서버 실행 | PASS | `/api/health`, `/pocs`, `/pocs/screens` 200 |
| 최소 API 계약 정의 | PASS | `api.md` ↔ `packages/core/src/schemas.ts`, `pnpm test` 4/4 |
| 하네스 생성 | 부분 | `run.md`, `api.md` 완료. `report.md` 는 서브에이전트 쓰기 거부 → 초안이 `logs/scaffold.md` 하단, 메인이 옮길 것 |
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
- [ ] 마스코트·에셋 (`logs/mascot-assets.md`)
- [ ] `report.md` 생성 (`logs/scaffold.md` 의 'report.md 초안' 옮기기)
- [ ] Gate 0 독립 Critic (gpt-6.1-sol) → PASS 판정
- [ ] Gate 0 커밋
- [ ] Gate 1: `/pocs/analysis`, `/pocs/persona`, `/pocs/chat`, `/pocs/screens` 5개 화면

## 마지막 검증

- 2026-11-17 scaffold: `pnpm typecheck` / `pnpm lint` / `pnpm test`(4) / `pnpm build` 통과, dev 3101 기동, health 200 (`providers` 모두 true), 스크린샷 4장 + 정렬 검증 1장.

## 다음 작업

1. Gate 0 독립 Critic: 실행 화면·health·키 노출 재확인
2. Anthropic API 한도·Gemini 타임아웃 대응 결정 (`logs/cli-model-smoke.md`)
3. Gate 0 커밋 후 Gate 1 착수
