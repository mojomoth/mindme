# Gate 3 r2 — Codex Critic r1 (gpt-6.1-sol)

- 실행: 메인 세션이 직접 `codex exec -s read-only -m gpt-6.1-sol` (exec 전용 `CODEX_API_KEY`, 구독 한도 11/23 복구 전 우회). 리뷰 대상은 `git diff HEAD` + 새 텍스트 파일(34개 파일, 188KB 패치).
- 워크플로 안의 Codex Critic 에이전트는 14:26 셸 명령 하나에서 1시간 넘게 멈춰 워크플로를 중단했고, 같은 리뷰를 메인이 직접 돌렸다.
- 원문: `evidence/gate3r2/critic-codex-r1-raw.txt` (토큰 135,713)

## 결과: P0 0, P1 0, P2 2

1. [P2] 위기 감지 새 패턴(`사는게의미`, `살아야할이유`, `살아야하는이유`)이 부정 표현 없이도 걸린다. `detectCrisis('살아야 할 이유를 찾았어')`, `detectCrisis('요즘 사는 게 의미 있어')` → true (기대 false). `packages/core/src/chat/index.ts:50`
2. [P2] 기억 필터가 `대화 상대`·`어른이 된 나`가 들어간 실제 추억까지 지운다. `['전학 온 뒤 민수가 유일한 대화 상대였다', '작문 시간에 어른이 된 나에게 편지를 썼다']` → `[]` (기대: 둘 다 보존). `packages/core/src/persona/persona.ts:200`

처리: 두 건 모두 사용자 문구에 직접 닿아 이번 배포 전에 고친다(메인, fix-recheck 워크플로가 persona.ts 를 끝낸 뒤).
