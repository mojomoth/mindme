# Mindme 개발 실행 (run)

> 세션이 끊겨도 이 파일만 보면 이어서 진행할 수 있어야 한다. 상세 로그는 `logs/<task>.md`, 증거는 `evidence/<gate>/`.

## 현재 상태

- 단계: **Gate 0 PASS → Gate 1 구현·검증 PASS (4개 작업 Critic PASS, Integrate 회귀 통과) → HIL 대기(기다리지 않고 Gate 2 진행) → Gate 2**
- 2026-11-19: Gate 1 1차 실행이 네트워크 장애(ENOTFOUND)로 중단되어, 남은 미커밋 작업을 살려 이어서 진행했다(persona·screens 는 이어받아 마무리).
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
| HIL (사람 확인) | 대기 — 사람 확인은 기다리지 않고 Gate 2 진행(무중단 원칙) | `hil-gate1.md` |
| Gate 1 커밋 | 완료 | Commit 단계 (main push) |

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
- [x] `report.md` 저장 (메인 세션)
- [x] Gate 0 독립 Critic r4, Gate 0 커밋
- [x] Gate 1: `/pocs/analysis`, `/pocs/persona`, `/pocs/chat`, `/pocs/screens` 5개 화면 (Critic 모두 PASS)
- [x] Gate 1 Integrate: API 분리, `api.md` 실측 반영, `features.md`, `hil-gate1.md`, 회귀 (`logs/gate1-integrate.md`)
- [ ] Gate 1 HIL(대기, Gate 2 는 기다리지 않고 진행): 사람이 `hil-gate1.md` 체크 (특히 실제 카카오톡 내보내기 파일, 내 얼굴 아바타, 03 목록 2행 아바타)
- [x] Gate 1 커밋 (Commit 단계)
- [ ] Gate 2: `apps/web`(3100) 통합 구현

## 마지막 검증

- 2026-11-17 scaffold: `pnpm typecheck` / `pnpm lint` / `pnpm test`(4) / `pnpm build` 통과, dev 3101 기동, health 200 (`providers` 모두 true), 스크린샷 4장 + 정렬 검증 1장.
- 2026-11-17 Gate 0 Critic r2: health/pocs/screens 200, 실제 키 값 바이트 검색 802파일 0건, OpenAI gpt-6-astra 200(3.2s) / Anthropic 400 한도 / Gemini 503 (`evidence/gate0/critic-r2-raw.txt`). report.md 반영 후 조건 3·4·7 갱신.
- 2026-11-17 Gate 0 Critic r3 probe: OpenAI gpt-6-astra 200(3.5s) / Anthropic claude-haiku-5-5 400 월 한도(2026-12-01 복구) / Gemini 3.5-flash 45s 타임아웃 (`evidence/gate0/critic-r3-raw.txt`). 결론 변화 없음: 직접 API 는 OpenAI 만 사용.

- 2026-11-17 Gate 0 Critic r4: 타입체크 3패키지 통과, 테스트 4/4, 키 값 바이트 검색 834파일 0건, 목업 정렬 6개 뷰포트 오차 0.01px 미만, Codex 독립 판정 PASS. 유일한 P0는 report.md 없음.
- 2026-11-19 Gate 1 Integrate: route 4개를 `parseRequest` → core 호출로 정리(동작 동일, 오류 경로 10건·정상 호출 analyze 30.1s / persona 21.1s / avatar 29.8s / chat 4.0s 재확인). `pnpm typecheck` 3패키지, `pnpm test` 32/32, `pnpm lint`, `next build` 통과, 빌드 뒤 dev 3101 정상, `/pocs` 10개 경로 200, 키 값 바이트 검색 657파일(레포 + `pocs/.next/static`) 0건 (`logs/gate1-integrate.md`).

## P2 목록

Gate 1 (Critic r1b·Integrate 기준, Gate 2 에서 처리할 후보)

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

- Anthropic API: 월 사용 한도 소진(2026-12-01 복구). 앱 AI 는 OpenAI 로 진행
- 서브에이전트는 `report.md` 파일을 쓸 수 없음 → report.md 반영은 메인 세션이 한다 (서브에이전트는 `logs/` 에 초안)

## 다음 작업

1. Gate 1 HIL: 사람이 `hil-gate1.md` 를 체크한다. 승인되면 Commit 단계에서 Gate 1 커밋
2. **Gate 2**: `apps/web`(포트 3100)에 목표 서비스 구현. `packages/ui/src/screens/*` 화면에 F1~F4(`features.md`)를 연결하고, `packages/core` 를 그대로 재사용한다(다시 쓰지 않음)
3. Gate 2 에서 처리할 P2 우선순위: 05 대화 자동 스크롤, chat 이름 필드 주입, past 사건 나이 검사, 기본 아바타 경로, zod 영어 오류 문구, analysis 다시 분석 확인
4. Anthropic 은 2026-12-01 복구 후 재측정하고, Gemini 는 쿼터·지연 해소 후 재측정한다 (결정: `report.md` 2장)
