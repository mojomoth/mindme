# Gate 0 독립 Critic — round 4

- 일시: 2026-11-17
- 판정: **FAIL** (P0 1건, P1 0건, P2 5건)
- 방법: 구현자 설명은 믿지 않고 이번 라운드에서 직접 실행한 결과로만 판정했다. 코드는 수정하지 않았다.

## 조건별 판정

| # | 조건 | 판정 | 근거(이번 라운드 실행) |
|---|---|---|---|
| 1 | 기존 프로젝트·제공 파일 확인 | PASS | 드래프트 5장, 목업(851x1848 RGBA), `assets/generated` 12개 PNG가 실제로 있음. `packages/ui/src/assets/mockup-iphone.png` 는 원본과 바이트 단위로 같음(cmp) |
| 2 | Codex CLI · Claude CLI 실행 기록 | PASS | codex-cli 0.169.0 실제 실행(`codex exec -m gpt-6.1-sol -s read-only -i ×5 -`, 정렬 판정, 16.8k 토큰), claude 2.1.326 확인. 기록: `logs/cli-model-smoke.md` |
| 3 | 오케스트레이션(역할·소유권) | PASS | run.md 역할·소유권 표, 루프 정의, 커밋 담당 분리 |
| 4 | 모델·API 접근 확인 | PASS(결정 기록) | 직접 probe(키 출력 없음): OpenAI gpt-6-astra **200 (2.4s)** / Anthropic claude-haiku-5-5 400 월 한도(2026-12-01 복구) / Gemini 3.5-flash 45s 타임아웃. run.md 조건 4에 'Gate 1 직접 API 는 OpenAI 만' 결정 기록 |
| 5 | 개발 서버 3101 | PASS | pid 86133 LISTEN. `/api/health` 200 (70B, `providers` 불리언만), `/pocs` 200, `/pocs/screens` 200 |
| 6 | 최소 API 계약 | PASS | `api.md` ↔ `packages/core/src/schemas.ts` 엔드포인트 4개·타입·enum·필수/선택·기본값 일치. `pnpm test` 4/4, `pnpm typecheck` 3개 패키지 통과 |
| 7 | 하네스 run.md / report.md | **FAIL** | `docs/dev-v1/report.md` **없음** (`ls` → No such file, `git ls-files` 에도 없음). 4라운드 연속. run.md 는 필수 섹션을 모두 갖춤 |
| 8 | 키 노출 0건 | PASS | 아래 |
| 9 | 목업 셸 | PASS | 아래 |

### 8. 키 노출

- 패턴 grep (`sk-`, `sk-ant`, `AIza`, `apik`). `.env`·node_modules·.git·.next 는 뺐다. 결과는 오탐뿐이다(`mask-`, `grotesk-` 같은 CSS·폰트 이름, 그리고 이전 Critic 문서와 로그에 적힌 grep 명령 설명문). 실제 키는 0건.
- `pocs/.next/static` 패턴 0건.
- `.env` 실제 값 6종(12자 이상) 바이트 검색: 레포 834파일(.next 포함, cache 제외) 0건, `git log -p --all` 0건.
- 응답 본문 3종과 codex 출력 파일: 실제 값 0건, 키 이름 0건. `NEXT_PUBLIC_` 사용 0건(주석 1건). `.env` 는 gitignore 대상이고 추적되지 않음.
- `packages/core/src/server/*` 세 파일 모두 `import 'server-only'`. SDK 에 apiKey 를 명시해서 넘김.

### 9. 목업 셸

- 스크린샷: `critic-r4-pocs-screens-desktop.png`, `critic-r4-pocs-screens-mobile.png`, `critic-r4-pocs-desktop.png`, `critic-r4-pocs-mobile.png` (`scripts/shot.mjs`)
- 마젠타 측정(`critic-r4-align-measure.json`): 앱 화면을 마젠타로 칠하고 목업 알파(원본 화면 구멍 bbox 36,34–816,1817 플러드필)를 프레임 rect 에 맞춰 리샘플해 픽셀 단위로 비교했다. 뷰포트 6개(1440x900@1, 1440x900@2, 1280x720, 1920x1080, 1024x768@2, 601x900):
  - 프레임 중심 = 뷰포트 중심 (오차 < 0.01px), 스크롤 없음
  - 화면 구멍 안쪽인데 앱이 덮지 못한 틈: **0px** (전 뷰포트)
  - 목업 바깥 투명 영역으로 넘친 앱: **0px**, 합성 이미지에서 구멍 밖에 보이는 마젠타: **0px**
  - 1920x1080 에서는 화면이 정확히 390x891.5
- 네 모서리 3배 확대(`critic-r4-align-corners.png`): 틈·넘침 없음
- 모바일 390x844 DPR3: 프레임 img·상태바·홈 인디케이터 모두 `display:none`, 화면 rect 0,0,390,844, 스크롤 390x844, 가장자리 15,978px 모두 #F0F6FA
- Codex gpt-6.1-sol 독립 판정(`critic-r4-codex-align.txt`): A 중앙 PASS / B 넘침 PASS / C 틈 PASS / D 모바일 전체화면 PASS → **VERDICT: PASS**

### 에셋 (assets/generated)

- `critic-r4-assets-sheet.png` (체커보드 합성)를 Read 로 직접 보고 01-landing·03-persona-list 와 비교했다.
  - guide·guide-face: 주황 새싹 두 잎을 단 노란 동글이(볼터치, 짧은 팔다리)로 드래프트와 일치한다.
  - avatar-teen(파란 후드·백팩), avatar-young(초록 티·사원증·백팩 끈): 03-persona-list 의 아바타와 일치한다.
- 12개 PNG 모두 RGBA이고 네 모서리 알파가 0이다. 투명 비율은 66~71%다. PASS.

## 결함

### P0
1. **`docs/dev-v1/report.md` 없음** — 게이트 조건 7이 통과하지 못했다. r1부터 r4까지 4라운드 연속이다. 본문은 `logs/fix-gate0-r1.md` 26~117행에 준비돼 있다(`## 1. 기술 검증 결과` / `## 2. 중요 결정` / `## 3. 미해결 문제` 확인). 만드는 방법은 `logs/fix-gate0-r3.md` 에 적혀 있다. 서브에이전트의 Write 는 하네스가 거부하므로 **메인 세션이 직접** 이 파일을 저장해야 한다. 저장한 뒤 run.md 조건 7을 PASS 로, TODO 를 `[x]` 로 바꾼다. run.md 조건 4와 다음 작업 2번이 `report.md 2장` 을 참조하므로, 이 파일이 없으면 참조가 끊긴 상태다.

### P1
- 없음

### P2 (기록 후 진행)
1. Anthropic API 월 한도(2026-12-01 복구), Gemini 3.5-flash 45s 타임아웃 — 외부 요인. Gate 1 은 OpenAI 로 진행하고, 복구된 뒤 다시 측정한다.
2. `api.md` 에 표기되지 않은 스키마 제약이 있다. `Persona.id`·`Event.date` 의 길이 제한(≤64·≤40), `situation` ≤2000, `me` ≤40, 배열 원소 길이(emotions 원소 ≤20, traits·people 원소 ≤40, memories 원소 ≤300), 문자열 trim·min 1 이 문서에 없다. 구조·필드·기본값은 일치하므로 계약 불일치는 아니다.
3. 카카오톡 TXT 파서가 `packages/core` 에 아직 없다(Gate 1 범위).
4. 03-persona-list 하단의 '고개 내민' 마스코트와 01-landing 의 하트 말풍선 에셋이 아직 없다. `guide-face` 는 이름과 달리 전신 변형이다.
5. 모바일 safe-area 는 Chromium 에뮬레이션에서 0px이다. 실기기 검증은 Gate 3 에서 한다.
