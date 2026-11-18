# gate1-analysis 로그 (/pocs/analysis)

## 결과
- `pnpm typecheck` 3패키지 통과, `pnpm test` 17/17 통과(이 작업 9개: `packages/core/test/analysis.test.ts`), `pnpm -C pocs lint` 경고 0
- 픽스처 4개와 긴 입력 1개를 dev 서버(3101) `/api/analyze` 에 실제로 보냄. 모두 200
- 페이지에서 예시 불러오기 → 분석 → 사건 추가·수정 → 새로고침 후 유지 → 삭제까지 Playwright 로 실제 조작, 페이지 오류 0

## 파일
| 파일 | 내용 |
|---|---|
| `packages/core/src/analysis/parse.ts` | 순수 함수. `parseKakao`(PC·Android·iOS·Mac CSV), `splitDiary`, `kakaoDayBlocks`, `packChunks` |
| `packages/core/src/analysis/analyze.ts` | 프롬프트, AI 출력 스키마, `analyzeRecords`(AI 호출은 인자로 받음), `normalizeEvents`, `sortByTime`, 예산 상수 |
| `packages/core/src/schemas.ts` (추가만) | `SelfAtTimeSchema`, `EventSchema.selfAtTime?`, `AnalyzeMetaSchema`, `AnalyzeResponseSchema.meta?`, 타입 2개 |
| `packages/core/src/index.ts` (추가만) | analysis 두 파일 export |
| `packages/core/test/analysis.test.ts` | 파서·분할·정렬·정규화·파이프라인(가짜 generate) 테스트 |
| `pocs/app/api/analyze/route.ts` | POST. `analyzeRecords(data, generateObject)` — AI 호출은 `llm.ts` 만 거침 |
| `pocs/app/pocs/analysis/{page,Loader,Analysis}.tsx`, `analysis.module.css` | PoC 화면 |
| `pocs/fixtures/analysis/*.txt` | 합성 픽스처 4개 (가상 인물 이지우·박서진·민수, 실존 정보 없음) |

## 파서
- PC(Windows): `--------------- 2015년 5월 14일 목요일 ---------------` 구분선 + `[이름] [오후 4:12] 메시지`
- 모바일: Android `2015년 5월 14일 오후 4:12, 이름 : 메시지`, iOS `2015. 5. 14. 오후 4:12, 이름 : 메시지`, 24시간 표기도 처리. 구분선 `2015년 5월 14일 목요일`
- Mac CSV: `2015-05-14 16:12:00,"이름","메시지"` (따옴표 안 여러 줄, `""` 이스케이프)
- 형식에 맞지 않는 줄은 앞 메시지에 이어 붙인다(여러 줄 메시지). 시스템 메시지(들어왔습니다·나갔습니다·초대·내보냄·관리자 가림·운영정책 안내)와 내용 없는 표시(사진·이모티콘·동영상·삭제된 메시지)는 뺀다.
- '나': `me` 를 주면 정확히 같은 이름, 없으면 부분 일치. `me` 가 없으면 1:1 방 제목('박서진 님과 카카오톡 대화')의 상대가 아닌 쪽. 그래도 모르면 AI 가 대화 흐름으로 추정(프롬프트에 그렇게 적는다).
- 일기: 30자 이하 줄이 날짜로 시작하면 머리줄(`2019년 2월 12일 화요일 맑음`, `2018.11.15 (목)`, `# 2019-08-23`, `[2020/3/16]`). 없으면 통째로 한 항목.
- 카카오 메시지 형식이 하나도 없으면 400 (`카카오톡 대화 형식을 찾지 못했어요…`).

## 토큰 예산 (analyze.ts 상수)
- 입력 상한 `MAX_INPUT_CHARS = 300_000` = api.md·`AnalyzeRequestSchema` 의 text 1~300,000자. 라우트 본문 상한 700,000(UTF-16 길이, 이스케이프 여유), 넘으면 413.
- 정리한 본문(날짜 블록 `## YYYY-MM-DD` + `HH:MM 이름(나): 메시지`)이 `DIRECT_CHARS = 40,000` 이하면 한 번에 분석.
- 넘으면 날짜 블록 경계를 지키며 `CHUNK_CHARS = 30,000` 묶음으로 나눠(하루가 30,000자를 넘으면 줄 단위로 자르고 날짜 머리줄을 다시 붙임) 구간마다 사건 후보만 요약(동시 4개) → 요약본으로 최종 분석. 300,000자면 약 10구간.
- 한국어는 대략 1글자 ≈ 1토큰으로 잡았다. `maxDuration = 300`.

## AI 호출
- `generateObject`(gpt-6-astra, Responses API structured output). AI 출력 스키마는 strict 모드에 맞춰 길이 제한 없이 받고(나이는 nullable), `normalizeEvents` 가 계약 길이로 자른 뒤 `EventSchema.parse` 로 한 번 더 검증한다.
- 정렬: 날짜에서 연도·월·일 키를 뽑아 안정 정렬. 연도가 없으면 (연도·나이가 모두 있는 사건에서 구한 출생연도 중앙값 + 나이), 그것도 없으면 AI 가 낸 순서에서 바로 앞 사건 뒤에 둔다. id 는 정렬 후 `evt_01..`.
- 오늘 날짜를 입력 머리말에 넣어 '서른두 살' 같은 단서로 연도를 계산하게 했다(prompt 결과 2004·2009·2018·2023, 모두 `dateEstimated: true`).

## 실제 실행 (2026-11-17, dev 3101, gpt-6-astra)
| 입력 | 증거 | 시간 | 모드 | 사건 |
|---|---|---|---|---|
| 카톡 PC (me 없음) | `evidence/gate1/analysis-kakao-pc.json` | 33.8s | direct, 메시지 33 | 2015-05-14 계주로 서진과 다툰 날(15살) / 2015-05-21 화해(15살) / 2016-02-12 중학교 졸업(16살) / 2024-03 첫 출근 일주일(24살, 추정) |
| 카톡 모바일 iOS (me=이지우) | `evidence/gate1/analysis-kakao-mobile.json` | 19.2s | direct | 2024-02-29 최종 합격 / 2024-03-04 첫 출근 / 2024-03-08 첫 회의 의견 |
| 일기 | `evidence/gate1/analysis-diary.json` | 28.9s | direct, 항목 5 | 2018-11-15 수능 / 2019-02-12 고등학교 졸업식 / 2019-08-23 모의고사 / 2019-12-10 합격 |
| 자유 프롬프트 | `evidence/gate1/analysis-prompt.json` | 31.9s | direct, 문단 6 | 10살 이사 / 15살 민수와 다툼 / 15살 편지에 고맙다고 못 함 / 24살 첫 출근 / 29살 퇴사 |
| 긴 카톡 (PC 픽스처 + 잡담만 있는 날 200여 일, 64,116자) | `evidence/gate1/analysis-kakao-long.json` | 45.0s | summarized, 2구간, 메시지 2,103 | PC 와 같은 4개. 잡담에서 가짜 사건 0 |

품질 판단 (직접 확인)
- 픽스처에 심은 사건(15살 다툼·화해, 중학교·고등학교 졸업식, 합격, 첫 출근, 이사, 퇴사)이 모두 나왔고 날짜·나이가 맞다. 없는 사건은 없었다.
- me 를 안 준 PC 대화에서 1:1 방 제목으로 '나=이지우'를 찾았고 quotes 가 모두 이지우가 실제로 한 말이다.
- selfAtTime: 말투가 원문 근거와 맞다(예: "화가 나면 느낌표를 겹쳐 쓰거나 짧고 단호하게 말을 끊는다" ← "학원 때문에 못 간다고 말했잖아!!", "됐어 너랑 말 안 해").
- 모바일·일기에는 나이 단서가 없어 age 가 비어 있다(지어내지 않음). 일기와 카톡 모바일 사이의 출생연도는 이어 주지 않는다(입력 간 연결은 범위 밖).
- 아쉬운 점: 자유 프롬프트의 '민수와 다툼'과 '편지에 고맙다고 못 함'이 두 사건으로 나뉨(같은 일의 연속이지만 감정이 달라 분리한 것으로 보임, 수정 UI 로 합칠 수 있음). traits 가 키워드보다 짧은 구절로 나온다.

## 화면 (/pocs/analysis)
- 기록 종류(카카오톡·일기·직접 쓰기), 카톡 내 이름, TXT 파일 열기, 붙여넣기, 예시 불러오기(픽스처 4개), 글자 수/상한, 분석하기
- 타임라인: 시점·나이·추정 표시, 감정, 요약, 인물·맥락·그때의 나·말투·한 말. 사건 추가·수정·삭제(EventSchema 로 검증, 저장할 때마다 시간순 재정렬)
- localStorage: `mindme:events`(Event[], `/pocs/persona` 가 같은 키를 읽음), `mindme:analysis:last`(마지막 요청·응답). 접근 실패는 무시
- 접기 패널: 원본 입력, AI 원시 응답(응답 JSON 전체, `meta.llm` 이 AI 출력 그대로)
- Playwright 실조작: 예시 '카톡 PC판' → 분석 33.0s, 사건 4개 → 2015-10 사건 추가(다툼·화해와 졸업 사이로 정렬됨) → 마지막 사건 제목 수정 → 새로고침 후 동일 → 추가한 사건 삭제. 스크린샷 `evidence/gate1/analysis-page.png` (1280 폭, 전체 페이지)

## 메인에 넘길 것
- api.md 반영 필요(소유자가 메인이라 직접 고치지 않음). 추가분:
  - `Event` 에 `selfAtTime?: { traits: string[] (≤10, 각 ≤40), speechStyle: string (≤300), quotes: string[] (≤5, 각 ≤200) }` — 그 시점의 나(성격·말투·실제로 한 말)
  - `POST /api/analyze` 응답에 `meta?: { mode: 'direct'|'summarized', chunks, units, participants: string[], me?, llm }` — 검증용
  - 처리 방식: 정리한 본문 40,000자 이하는 한 번에, 넘으면 날짜 경계로 30,000자씩 구간 요약 후 분석. 300,000자 입력은 2~3분 걸릴 수 있음
  - 400 `invalid_request` 에 '카카오톡 형식을 찾지 못함' 경우 추가, 429 는 503 `provider_unavailable`
- `/pocs` 목록의 '기록 분석' 항목 `ready: true` 로 바꾸기 (`pocs/app/pocs/page.tsx`, 내 소유 아님)
- run.md P2 '카카오톡 TXT 파서(packages/core)' 해소

## 남은 위험
- 실제 사용자 내보내기 파일로는 확인하지 못했다(형식은 공개된 대표 형식 기준). 카카오 버전별로 시스템 문구·날짜 표기가 다를 수 있다.
- 300,000자 상한 입력은 실제로 보내 보지 않았다(64,116자/2구간까지 확인). 10구간이면 요약 호출 10회 + 최종 1회.
- 일기 본문 중 30자 이하이면서 날짜로 시작하는 줄은 머리줄로 오인될 수 있다.
