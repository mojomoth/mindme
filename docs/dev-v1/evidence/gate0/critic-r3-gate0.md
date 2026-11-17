# Gate 0 독립 Critic — round 3

- 일시: 2026-11-17
- 판정: **FAIL** (P0 1건, P1 1건)
- 근거 원시 출력: `critic-r3-raw.txt`

## 조건별 판정

| # | 조건 | 판정 | 근거 |
|---|---|---|---|
| 1 | 기존 프로젝트·제공 파일 확인 | PASS | `logs/scaffold.md`, 드래프트 5장·목업·에셋 실재 |
| 2 | Codex CLI · Claude CLI 실행 기록 | PASS | `logs/cli-model-smoke.md`. 이번 라운드에서도 codex-cli 0.169.0 실제 실행(gpt-6.1-sol 정렬 판정), claude 2.1.326 확인 |
| 3 | 오케스트레이션(역할·소유권) | PASS(문서 상태는 낡음) | run.md 역할·소유권 표 있음, `.claude/skills/` 7종, `tools.md`. 단 run.md 표는 아직 '진행 중' 으로 표기 → P1 |
| 4 | 모델·API 접근 확인 | 측정 PASS / 결정 기록 FAIL | 직접 probe: OpenAI gpt-6-astra 200 (3.5s) / Anthropic 400 월 한도(2026-12-01 복구) / Gemini 45s 타임아웃. 공급자 결정이 공식 하네스(run.md·report.md)에 없음 → P1 |
| 5 | 개발 서버 3101 | PASS | LISTEN pid 86133, /api/health·/pocs·/pocs/screens 모두 200 |
| 6 | 최소 API 계약 | PASS | `api.md` ↔ `packages/core/src/schemas.ts` 필드·제약·기본값 일치, `pnpm test` 4/4, typecheck 통과 |
| 7 | 하네스 run.md / report.md | **FAIL** | `docs/dev-v1/report.md` 없음 (r1·r2 에 이어 3회째). git 이력에도 없음 → P0 |
| 8 | 키 노출 0건 | PASS | 패턴 grep 실제 키 0건(설명문 'sk-ant' 2건뿐), `.next/static` 0건, .env 실제 값 6종 바이트 검색 803파일·git 이력 0건, health 응답은 존재 여부만 |
| 9 | 목업 셸 | PASS | 아래 |

### 9. 목업 셸 상세

- 데스크톱 1440x900: 목업 중심 (720.0, 450.0) = 뷰포트 중심. 스크롤 없음.
- 마젠타 측정(`critic-r3-align-measure.json`, 5개 뷰포트): 목업이 완전 투명한 바깥 영역으로 넘친 마젠타 0px(전 뷰포트). 화면 안쪽 완전 투명 영역의 틈: 1440@1 8px, 1440@2 2px, 나머지 0px(가장자리 안티앨리어싱 수준). 1920x1080 에선 화면이 정확히 390x891.5.
- 네 모서리 확대(`critic-r3-align-corners.png`): 틈·넘침 없음.
- 모바일 390x844 DPR3: 목업·상태바·홈 인디케이터 없음, 외곽 7,400px 모두 앱 배경 #F0F6FA.
- Codex gpt-6.1-sol 독립 판정(`critic-r3-codex-align.txt`): A 중앙 PASS / B 넘침 0px PASS / C 틈 0px PASS / D 모바일 전체화면 PASS → VERDICT: PASS.

### 에셋 (assets/generated)

- `critic-r3-assets-sheet.png`(체커보드 합성): guide·guide-face 는 드래프트의 '주황 새싹 두 잎을 단 노란 동글이' 와 일치, avatar-teen(파란 후드·백팩)·avatar-young(초록 티·사원증)은 03-persona-list 아바타와 일치.
- 12개 PNG 모두 RGBA, 네 모서리 알파 0, 투명 비율 66~71%. PASS.

## 결함

### P0
1. **report.md 없음** — 게이트 조건 7 불통. 3라운드 연속. 원인: 서브에이전트 쓰기 거부 + 메인 세션 미반영(`logs/fix-gate0-r2.md` 가 BLOCKED 로 넘김). 수정: 메인 세션이 `logs/fix-gate0-r1.md` 의 report 본문 + `logs/fix-gate0-r2.md` 변경 3줄로 `docs/dev-v1/report.md` 를 직접 만든다.

### P1
1. **run.md 가 실제 상태와 다름 / 공급자 결정 미기록** — Gate 0 표에 오케스트레이션 '진행 중', 모델 '부분', 하네스 '부분'(report.md 는 메인이 옮길 것) 그대로. TODO 의 마스코트·report.md 미체크. 수정: `logs/fix-gate0-r2.md` 의 '메인 반영 2' 를 적용하고, 오늘 probe(OpenAI 200 / Anthropic 한도 / Gemini 45s 타임아웃)를 '마지막 검증' 에 추가.

### P2 (기록 후 진행)
1. Anthropic API 월 한도(2026-12-01 복구), Gemini 타임아웃 — 외부 요인. Gate 1 은 OpenAI 기준으로 설계하고 복구 후 재측정.
2. `codex exec -i` 는 뒤따르는 위치 인자(프롬프트)까지 이미지로 받아 "No prompt provided via stdin" 로 실패한다. 프롬프트는 stdin(`-`)으로 넘길 것. `logs/cli-model-smoke.md` 사용법에 반영 권장.
3. `api.md` 의 `Persona.id` 에 길이 제한(≤64) 표기 누락 (스키마는 `text(64)`). 다른 필드는 일치.
4. 03-persona-list 하단의 '고개 내민' 마스코트와 01-landing 의 하트 말풍선은 아직 에셋 없음. Gate 1 화면 작업 때 필요. `guide-face` 는 이름과 달리 전신(방향 다른 변형)이다.
5. 카카오톡 TXT 파서가 `packages/core` 에 아직 없음 (Gate 1 범위).
