# Gate 0 독립 Critic — round 1

- 일시: 2026-11-17
- 검증자: Claude Opus 5.5 (독립 Critic, 코드 수정 없음) + 정렬 2차 판정 Codex gpt-6.1-sol
- 판정: **FAIL** (P0 1건, P1 1건)

## 조건별 결과 (직접 실행 기준)

| # | 조건 | 결과 | 근거 |
|---|---|---|---|
| 1 | 기존 프로젝트·제공 파일 확인 | PASS | drafts 5장 + prompts.json, mockup 851x1848 RGBA, legacy 폰트 → `packages/ui/src/fonts/pretendard.woff2` |
| 2 | Codex CLI · Claude CLI 실행 | PASS | `codex exec -m gpt-6.1-sol -s read-only -i ...` 실제 실행(16,051 tokens, `critic-r1-codex-align.txt`). `claude -p --model claude-sonnet-5-5` → "OK" 3.3s. 경고: 로그인 2026-11-18 만료 가능 |
| 3 | 오케스트레이션 준비 | PASS | `run.md` 역할·소유권 표, `tools.md`, `.claude/skills/` 7종 |
| 4 | 모델·API 접근 | **부분 (P1)** | 아래 표 |
| 5 | 개발 서버 3101 | PASS | LISTEN pid 86133. `/api/health` 200(70B), `/pocs` 200, `/pocs/screens` 200 |
| 6 | 최소 API 계약 | PASS | `api.md` ↔ `packages/core/src/schemas.ts` 필드·제약 일치(Event/Profile/Persona/ChatMessage/Error, analyze/persona/avatar/chat). `pnpm test` 4/4 |
| 7 | 하네스 run.md/report.md | **FAIL (P0)** | `docs/dev-v1/report.md` 없음 (`ls: No such file or directory`). 초안은 `logs/scaffold.md` 하단에만 있음 |
| 8 | 키 노출 0건 | PASS | 패턴 grep(sk-, sk-ant, AIza, apik) 레포(.env 제외)·`pocs/.next/static`: 실제 키 0건(scaffold.md 의 grep 명령 문자열 1건만). 실제 .env 값 6종(≥12자) 바이트 검색: 783파일(.next 포함, cache 제외) 0건. 응답 본문 3종 0건. `NEXT_PUBLIC_` 0건 |
| 9 | 목업 셸 | PASS | 아래 정렬 측정 |

typecheck: `pnpm typecheck` core/ui/pocs 모두 Done(exit 0). lint: pocs Done.

## 모델·API 직접 호출 (키 비출력 스크립트)

| 공급자/모델 | 결과 |
|---|---|
| OpenAI gpt-6-astra (responses) | HTTP 200, 4.8s |
| Anthropic claude-haiku-5-5 (messages) | HTTP 400 "reached your specified API usage limits ... 2026-12-01 00:00 UTC" |
| Google models list | HTTP 200 (gemini-3.5-flash, gemini-3.1-pro-preview 목록에 있음) |
| Google gemini-3.5-flash generateContent | 1회 45s 타임아웃, 1회 HTTP 200 **39.3s** |
| Google gemini-3.1-pro-preview generateContent | HTTP 429 quota 초과 |

→ 실사용 가능한 공급자는 OpenAI 뿐. `/api/health` 는 키 존재만 보므로 `anthropic:true, google:true` 를 돌려줘 실제 상태와 다르다.

## 목업 정렬 측정 (픽셀)

방법: `.screen` 배경을 #FF00FF 로 칠하고 자식 숨김 → 스크린샷. 목업 PNG 알파를 frame 실제 크기로 리샘플, 중앙에서 flood-fill 한 투명 영역(틈 검사)과 바깥 투명 영역(넘침 검사)을 비교.

| 뷰포트 | 화면 안 비마젠타(틈) | 바깥 마젠타(넘침) | 가로 스크롤 |
|---|---|---|---|
| 1440x900@1 | 0 (2px 침식) / 195 (무침식, 전부 프레임 경계 블렌드 마젠타, 배경색 0) | 0 | 없음 |
| 1440x900@2 | 0 / 28 | 0 | 없음 |
| 1280x720@1 | 0 / 14 | 0 | 없음 |
| 1920x1080@1 | 0 / 0 (390x891.5 원배율) | 0 | 없음 |
| 1024x640@1 | 0 / 2 | 0 | 없음 |

- 데스크톱 1440: device x 523.8..916.2 (중심 720.0), y 24..876 (중심 450) → 정중앙.
- 모바일 390x844: frame·상태바 `display:none`, screen 0,0,390,844, 스크롤 390x844, `viewport-fit=cover`. 600px 까지 목업 없음, 601px 부터 목업.
- Codex gpt-6.1-sol 판정: A 중앙 PASS / B 틈·넘침 없음 PASS / C 모바일 전체화면 PASS (`critic-r1-codex-align.txt`).

## 생성 에셋 (assets/generated)

- guide, guide-face, avatar-teen, avatar-young: 1024 RGBA, 모서리 알파 0, 투명 67~71%, 가시 마젠타 잔여 0px. 256/512 리사이즈본도 동일.
- 밝은·어두운 배경 합성 확인(`critic-r1-assets-sheet.png`): guide = 노란 3D 동글이 + 주황 두 잎 새싹, 블러시, 손 흔들기 → 01/03 드래프트와 일치. teen = 검은 바가지머리·파란 후드·백팩(03 1행 일치). young = 검은 웨이브 머리·녹색 티·사원증·백팩끈(03 2행 일치).
- 주의: mascot-assets 로그상 guide 2차는 "기준 명확화 재질의"로 PASS 로 바뀌었다. 직접 봤을 때 캐릭터 자체는 일치하므로 수용.

## 결함

### P0
1. `docs/dev-v1/report.md` 없음 — Gate 0 조건 7 불충족. `logs/scaffold.md` 의 'report.md 초안' 을 옮기고 기술 검증 결과·중요 결정·미해결 문제 섹션을 갖출 것.

### P1
1. AI 공급자 결정 미기록 — Anthropic API 한도(12/1까지), Gemini pro 429·flash 39s. OpenAI 만 정상. Gate 1 PoC 기본 공급자(OpenAI gpt-6-astra, 이미지 gpt-image-2 API 는 미검증)와 대체 순서를 report.md 에 결정으로 남기고, Anthropic 한도는 BLOCKED(외부)로 기록할 것.

### P2
1. `/api/health` 가 키 존재만 보고 `anthropic:true` → 실제 사용 불가와 불일치. 이름을 `configured` 로 바꾸거나 문서에 명시.
2. run.md 게이트 상태값이 '부분'·'진행 중' — PASS/FAIL/BLOCKED 어휘로 통일. 조건 4·7 행 갱신 필요.
3. Claude CLI 로그인 2026-11-18 만료 경고 — 장기 작업 전 `claude setup-token`.
4. `NativeAdapter.storage` 가 동기 API — Capacitor Preferences 는 비동기라 포팅 시 인터페이스가 바뀐다. 사진(카메라) 어댑터도 아직 없음.
5. 생성 에셋이 아직 `packages/ui` 로 옮겨지지 않음, 로고용 머리·바닥 '빼꼼' 변형(03 하단) 없음 — Gate 1 에서 처리.
6. 모바일 safe-area 는 에뮬레이션에서 0 — 실기기 확인은 Gate 3.
