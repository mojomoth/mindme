# gate3r2-core-analysis 로그

- 일시: 2026-11-19
- 맡은 항목: analysis-1, analysis-2, analysis-3 (근거는 `gate3r2-triage.md`)
- 소유 파일: `packages/core/src/analysis/**`, `packages/core/src/server/http.ts`, `packages/core/test/{analysis,routes,http}.test.ts`
- 세 항목 모두 고치기 전에 먼저 재현했다. 새 테스트는 HEAD 코드에서 실패하고 지금 코드에서 통과하는 것까지 확인했다(HEAD 의 parse.ts·analyze.ts 를 /tmp 에 꺼내 같은 테스트를 돌림 → 2건 실패).

## analysis-1 — 여러 줄 메시지 속 날짜 구분선 모양 줄

- 재현: Android 메시지 본문 안의 `2019년 3월 2일 토요일` 줄을 구분선으로 읽었다. 그래서 그 뒤 본문 줄이 사라졌다(`current = undefined`). PC 판은 줄이 사라지는 데다 `day` 까지 바뀌어, 다음 메시지 날짜가 03-01 에서 03-02 로 잘못 붙었다.
- 수정(`parse.ts`): 모바일 날짜 구분선 모양 줄은 다음 비지 않은 줄이 같은 날짜의 모바일 메시지 줄(`MOBILE_LINE`)일 때만 구분선으로 본다(`opensDay`). 아니면 아래로 흘려보내 여러 줄 메시지 본문에 이어 붙인다. Android·iOS 실제 내보내기는 구분선 바로 뒤에 같은 날짜 메시지(시스템 메시지 포함)가 오므로 기존 동작이 그대로다. PC 판은 다음 줄이 `[이름] [오후 …]` 꼴이라 구분선으로 보지 않고, `day` 도 바뀌지 않는다.
- 분류 문서의 'current 가 있을 때만' 조건과 'SYSTEM·파일 끝도 구분선' 예외는 넣지 않았다. 모바일 판은 메시지 줄마다 날짜가 있어 모바일 구분선의 `day` 를 쓰는 곳이 없으므로, 규칙 하나로 충분하다.
- 테스트(`analysis.test.ts`): Android(사이에 빈 줄 포함)·PC 입력에서 날짜 줄과 다음 줄이 본문에 남고, 다음 메시지 날짜가 2019-03-01 그대로인지 단언한다.

## analysis-2 — 30만 1자 입력이 400 '기록 내용을 읽지 못했어요'로 나감

- 재현(3100, AI 호출 없음): `'가'x300001` → 400 `기록 내용을 읽지 못했어요. 파일이나 이야기를 다시 확인해 주세요.` 본문 상한(700,000)은 넘지 않아 zod `text.max(300000)` 에서 걸렸는데, apps/web 이 넘긴 고정 400 문구가 먼저 나갔다.
- 수정(`http.ts parseRequest`): 검증 실패의 첫 이슈가 `text` 의 문자열 `too_big` 이면 고정 문구보다 먼저 `tooLarge()`(413) 를 돌려준다. 최상위 `text` 는 `AnalyzeRequestSchema` 에만 있어 다른 route 에는 영향이 없다.
- 실측(고친 뒤 3100): `'가'x300001` → 413 `payload_too_large` `입력이 너무 길어요. 30만 자 이하로 줄여 주세요.`(api.md 와 같다). `'   '` → 400 고정 문구 그대로. 증거: `evidence/gate3r2/analyze-413.txt`
- 테스트(`routes.test.ts`): `analyzeRoute({ invalid: … })` 에 30만 1자를 보내 413 과 문구를 단언하고, 빈 기록은 여전히 400 인지 확인한다.
- 부수 효과: pocs(3101) 도 같은 `analyzeRoute` 를 쓰므로 30만 1자 응답이 400 `기록은 300,000자 이하로…` 에서 413 으로 바뀐다. pocs 파일은 건드리지 않았다.

## analysis-3 — 큰 입력(summarized)에서 owner.currentAge null

- 재현(가짜 generate, 합성 카톡 94,036자 → 2구간): 중간의 `나 95년생이야` 줄은 구간 요약 입력에 있지만 최종 분석 입력에는 없었다. `DigestSchema` 에 나이 단서를 받을 칸이 없고, `DIGEST_SYSTEM` 이 잡담을 버리기 때문이다.
- 처음 만든 4만 2천 자 합성 TXT 는 파싱 후 본문이 4만 자 아래로 줄어 direct 경로로 갔다. 그래서 200일치(94,036자)로 늘렸다.
- 수정(`analyze.ts`):
  - `DigestSchema` 최상위에 `ownerClues: string[]` 를 더했다.
  - `DIGEST_SYSTEM` 에 `'나'의 나이·출생연도·학년을 알 수 있는 말은 잡담이어도 버리지 않고 'YYYY-MM-DD 원문' 꼴로 남긴다` 를 넣었다.
  - 최종 입력 끝에 단서가 있을 때만 `나이 단서:` 와 `- …` 줄을 붙인다.
- 분류 문서가 제안한 `moments[].age` 는 넣지 않았다. 최종 분석에 출생연도 단서와 사건 날짜가 함께 들어가면 사건 나이도 계산되기 때문이다. 아래 실측에서 사건 나이가 실제로 채워졌다.
- 테스트(`analysis.test.ts`): 첫 구간의 가짜 요약만 `ownerClues` 를 돌려줄 때, 최종 입력이 `\n\n나이 단서:\n- 2015-01-03 나 2000년생이야` 로 끝나는지 단언한다. 프롬프트에 `ownerClues` 규칙이 있는지도 확인한다. `routes.test.ts` 의 가짜 요약 응답에도 `ownerClues: []` 를 넣었다.
- 실측(실제 AI 1회, 3100 `/api/analyze`, 오늘 2026-11-19): 200, 11.9초, `mode: summarized`, `chunks: 2`. `owner: { name: '이지우', currentAge: 31 }`(2026-1995). 사건 `2019-04-30 박서진과 크게 싸우고 운 날` 의 age 는 24(2019-1995)다. 증거: `evidence/gate3r2/analyze-big-age.json`(원문 text 는 빼고 글자 수만 남김)

## 검사

- `pnpm typecheck`: 통과
- `pnpm test`: 48/48 통과
- `pnpm lint`: 통과(apps/web 의 node 24.x engine 경고만 있음)

## 남은 문제

- `docs/dev-v1/api.md` 의 `구간 요약(summarized) 모드에서는 이름·나이 단서가 요약에서 빠질 수 있어 null 이 나오기 쉽다(P2)` 문장은 이제 맞지 않는다. 내 소유 파일이 아니라 고치지 않았으니 문서 담당이 지우거나 고쳐야 한다.
- `apps/web/app/api/analyze/route.ts` 의 고정 400 문구는 그대로 둬도 된다. 길이 초과는 이제 그 앞에서 413 으로 나간다.
- analysis-3 실측은 단서가 한 줄뿐인 합성 입력으로 1회만 했다. 단서가 '고1'처럼 학년뿐이거나 여러 구간에 엇갈려 나오는 경우는 확인하지 않았다.
