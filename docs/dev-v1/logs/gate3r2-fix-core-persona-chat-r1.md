# Gate 3 r2 — core-persona-chat 수정 로그 (라운드 1, 2026-11-19)

빌더 `core-persona-chat`. 근거는 `gate3r2-critic-behavior-r1.md` 4절의 P2-2·P2-3이고, P2-3은 메인이 P1로 올렸다. 소유 파일만 고쳤다.

## 항목별 결과

| id | 재현 | 바꾼 것 | 고정한 테스트 |
|---|---|---|---|
| NEW-story-future-leak (P1) | Critic 상태 파일(`critic-behavior-r1-state.json`)을 다시 봤다. 이야기에서 나온 사건 `evt_04`는 date가 '첫 출근 날'이고 age가 없어서 `visibleEvents`가 이미 17살 입력에서 뺀다. 그런데 `buildPersonaInput`이 `profile.story` 원문을 kind와 상관없이 `[나의 이야기]`로 넣고 있었다(persona.ts:181). 그래서 17살 페르소나(`per_4418e64c`) 기억에 '첫 출근 날 너무 떨려서…', '사수가 말이 없어서…'가 들어갔다. 새 단위 테스트도 수정 전에는 과거 입력에 `[나의 이야기]`가 있어 실패했다 | `persona/persona.ts` `buildPersonaInput`: `[나의 이야기]` 줄을 `req.kind !== 'past'`일 때만 넣는다(조건 하나). apps/web의 `createFirst`는 이야기를 `/api/analyze`(`source: prompt`)로 보내 사건으로 만들고 `mergeEvents`로 `events`에 넣는다(MindmeApp.tsx:204-208). 04 모달도 같은 `events`를 넘긴다. 그래서 과거의 나는 나이로 거른 사건만 보고, 이야기 속 어린 시절 일처럼 나이가 붙은 사건은 그대로 받는다. 현재·미래는 지금처럼 원문을 넣는다. chat은 story를 쓰지 않아 고칠 곳이 없다 | `persona.test.ts` "과거: '나의 이야기' 원문은 넣지 않는다…": Critic과 같은 이야기 문장을 profile.story에 넣고, past 17(사건 없음)과 past 15+사건 입력에 원문·'사수'·`[나의 이야기]`가 없는지 확인한다. present 26과 future 30 입력에는 `[나의 이야기]\n원문`이 들어 있는지도 확인한다 |
| api-md-summarized-age (P2) | api.md:150이 analysis-3 수정 뒤에도 '구간 요약에서 이름·나이 단서가 빠져 null이 나오기 쉽다(P2)'라고 적고 있었다. analyze.ts:152-165는 구간 요약의 `ownerClues`를 최종 입력 끝 `나이 단서:` 줄로 넘긴다 | api.md `owner.currentAge` 아래 줄을 고쳤다. 구간 요약이 나이 단서를 `ownerClues`('YYYY-MM-DD 원문')로 남겨 최종 입력의 `나이 단서:` 줄로 넘긴다는 것, 실측(94,036자 카톡 2구간 → 31살, `analyze-big-age.json`), 그리고 남은 한계(단서가 아예 없으면 null, 일기의 이름은 따로 넘기지 않음)를 적었다. persona 절에는 '`past`에는 `profile.story` 원문을 넘기지 않는다. apps/web은 이야기를 사건으로 바꿔 넣으므로 나이로 거른 사건만 본다. `present`·`future`는 원문을 넘긴다'를 한 줄로 더했다 | 문서만 고쳤다(analyze.ts 코드와 대조) |

## 실측 (실제 AI, persona 2회 + chat 2회)

조건은 Critic 재현과 같다. `critic-behavior-r1-state.json`의 profile(이지우·27살, 같은 이야기)과 events 4개를 쓰고, 04 모달처럼 `kind: past`, `age: 17`, situation '고등학교 2학년 때 처음으로 반 대표로 발표했던 날', eventId 없이 3100 `/api/persona`를 불렀다. 그다음 만들어진 persona로 `/api/chat`에 [첫 인사, '요즘 무슨 일 있었어?']를 한 번 보냈다. 기억·말투·첫 인사·성격·감정·답에서 `/출근|사수|회사|입사|직장|팀장|월급/`을 찾았다.

| 증거 | persona | 기억 | 대화 답 | 누출 |
|---|---|---|---|---|
| `evidence/gate3r2/fix-story-leak-1.json` | 200, 15.5s, '17살의 이지우' | 반 대표 발표, 수업 시간 필기, 쉬는 시간 잡담 | 200, '오늘 반 대표로 처음 발표한 게 제일 큰일이었어. …' | 없음(`check.pass: true`) |
| `evidence/gate3r2/fix-story-leak-2.json` | 200, 17.0s, '17살의 이지우' | 반 대표 발표, 평범한 학교생활, 쉬는 시간 | 200, '오늘 반 대표로 처음 발표한 게 제일 큰일이었어. …' | 없음(`check.pass: true`) |

수정 전 같은 조건의 결과는 Critic 증거(`critic-behavior-r1-state.json`의 `per_4418e64c`, `critic-behavior-r1-visual-05-chat.png`)로 갈음했다. AI 호출을 아끼려고 수정 전 호출은 다시 하지 않았다. 스크립트는 레포 밖 `/tmp/mindme-fix-story/run.mjs`에 두었다.

## 검사

- `pnpm typecheck && pnpm test && pnpm lint`: 레포 루트에서 종료 코드 0
- `pnpm test`: 53개 모두 통과(새 테스트 포함)

## 남은 문제

- 이야기를 `/api/analyze`에 거치지 않고 `/api/persona`를 바로 부르는 호출자(직접 API 호출)는 과거 페르소나에서 이야기를 잃는다. 앱은 apps/web만 이야기를 보내고 늘 분석을 거치며, pocs는 story를 보내지 않는다. 미래 지식 차단을 우선해 받아들였다.
- 이야기에서 나온 사건이 실제보다 어린 나이로 잘못 분석되면 그 사건은 과거 페르소나에 들어간다. 이는 analyze의 나이 추정 정확도 문제다.
- 04 모달의 상황 설명(`situation`)은 과거에도 원문으로 넘긴다. 사용자가 그 시점을 설명하려고 직접 쓴 글이라 이번에는 건드리지 않았다.
