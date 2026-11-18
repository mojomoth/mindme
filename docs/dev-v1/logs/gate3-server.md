# gate3-server 로그 (polish-server)

- 일시: 2026-11-19
- 범위: report.md '열린 P2' 가운데 서버 쪽. 소유 파일은 `packages/core/**`, `apps/web/app/api/**`, `pocs/app/api/**`(호환에 필요한 만큼만), `docs/dev-v1/api.md`, 이 로그
- 클라이언트(`apps/web/app/**`, `apps/web/lib/**`)는 건드리지 않았다. owner 추정 결과를 쓰는 일은 polish-client 담당이라 계약(`owner`, `meta.me`)은 그대로 뒀다.

## 1. 공통 오류 문구 (`packages/core/src/server/http.ts`)

| 경우 | 전 | 후 |
|---|---|---|
| 413 기본 | `요청 본문이 너무 큽니다.` | `보낸 내용이 너무 길어요. 조금 줄여서 다시 보내 주세요.` |
| 400 JSON 아님 | `JSON 형식이 아닙니다.` | `보낸 내용을 읽지 못했어요. 다시 시도해 주세요.` |
| 503 키 없음 | `AI 공급자 키가 설정되지 않았습니다.` | `지금은 대화를 준비할 수 없어요. 잠시 후 다시 시도해 주세요.` |

- 키가 없다는 사유는 서버 로그에만 남는다: `noKey(tag)` 가 `[api/analyze] OPENAI_API_KEY 가 설정되지 않았어요.` 를 찍는다(키 이름만, 값 없음).
- `/api/chat` 의 첫 청크 전 오류는 사유를 버리고 있었다. 이제 `upstreamFail('api/chat', …)` 를 거쳐 키를 가린 메시지가 서버 로그에 남는다. 사용자 문구는 그대로다.
- zod 검증 문구(`errors.ts`)는 이미 한국어 라벨을 쓰고 필드 이름을 내보내지 않는다. 필드 이름이 보이는 곳은 pocs 아바타 route 의 고정 문구뿐인데, 개발 화면이라 일부러 둔 것이다(api.md 에 명시).
- 내부용 오류(`env.ts readKey`)도 해요체로 맞췄다. 이 오류는 응답에 나가지 않는다.

## 2. analyze: `meta.llm` 제거, 실행시간 한도

### meta.llm

- `analyzeRoute()` 는 기본적으로 `meta.llm` 을 빼고 응답한다. pocs 만 `analyzeRoute({ includeLlm: true })` 로 싣는다(`/pocs/analysis` 의 'AI 원시 응답' 패널이 쓴다).
- apps/web 은 `meta.me` 만 쓴다(`MindmeApp.tsx` 184행). `meta.mode·chunks·units·participants·me` 는 그대로 남겼다.
- 스키마 `AnalyzeMetaSchema.llm` 은 `optional` 로 바꿨다.

### Vercel 함수 시간 한도 (공식 문서 확인)

출처: https://vercel.com/docs/functions/configuring-functions/duration (last_updated 2026-08-24), 'Duration limits' 표. fluid compute 는 기본으로 켜져 있다.

| 플랜 | 기본 | 최대 |
|---|---|---|
| Hobby | 300s | 300s |
| Pro | 300s | 800s (확장 1800s 베타) |
| Enterprise | 300s | 800s (확장 1800s 베타) |

- 배포 계정의 플랜은 이 작업에서 확인할 수 없다. 300s 는 어느 플랜이든 쓸 수 있는 최대값이라 apps/web analyze `maxDuration` 을 60 → **300** 으로 올렸다(Next App Router 는 route 의 `export const maxDuration` 으로 설정).
- Gate 3 배포 뒤 `vercel inspect <url> --json` 의 `timeout` 으로 실제 적용값을 확인한다.

### 최악 지연이 300s 안에 들도록

- 입력 상한 30만 자는 그대로 뒀다. 클라이언트(`MindmeApp.tsx` `MAX_TEXT`)와 api.md 가 같은 값을 쓰고 있어서, 상한을 줄이면 계약이 바뀐다.
- 대신 구간 요약의 동시 실행 제한(4개씩)을 없애고 **모든 구간을 한꺼번에** 보낸다(`mapLimit` 삭제, `Promise.all`).
  - 전: 30만 자 ≈ 10구간 → 요약 3차례(4+4+2) + 최종 1회. 호출마다 최악 약 125초(타임아웃 60초 x 2회 + 재시도 대기)라 최악 약 500초 → 300초 초과.
  - 후: 요약 1차례 + 최종 1회 → 최악 약 250초 < 300초.
- 실측(3100, 실제 gpt-6-astra): 30만 자 합성 일기 → `summarized` 11구간, **29.9s**, 200, 심어 둔 사건 5건을 모두 찾음, OpenAI 429 없음. `evidence/gate3/server-analyze-300k.json`
- 남는 위험(P2):
  - 날짜 블록 하나가 1.5만 자를 넘는 식으로 묶음이 비효율적이면 구간 수가 이론상 최대 약 21개까지 늘 수 있다. 시간은 여전히 1차례지만 동시 호출이 많아진다.
  - 한꺼번에 보내면 순간 토큰량이 크다(30만 자 ≈ 30만 토큰). 계정의 TPM 한도가 낮으면 429 가 날 수 있고, 그때는 SDK 가 1회 재시도한 뒤 503 `AI 사용 한도에 걸렸어요. …` 로 끝난다. 이번 실측에서는 나지 않았다.
- pocs analyze 는 이미 300s 였다. 주석만 '동시 4' → '모두 동시'로 고쳤다.

## 3. 공개 배포 대비 남용 방지 (apps/web 만)

### 본문 크기 상한

- 엔드포인트별 상한은 이미 있었다(analyze 70만 · persona 100만 · avatar 570만 · chat 100만 자). 다만 `parseRequest` 가 본문을 다 읽은 뒤에 쟀다.
- 이제 `Content-Length` 가 `상한 x 3`(UTF-16 한 글자 = UTF-8 최대 3바이트)을 넘으면 본문을 읽기 전에 413 으로 거른다. avatar 는 원래대로 570만 바이트로 먼저 검사한다(base64 는 ASCII).
- Vercel 은 4.5MB 에서 먼저 끊는다.

### IP 기준 속도 제한

- `rateLimit(name, limit, windowMs, handler)` (`http.ts`). 새 의존성 없음. apps/web 의 route 만 감싼다(pocs 는 개발 화면이라 걸지 않음).
- IP 는 `x-forwarded-for` 첫 값(Vercel 이 채움), 없으면 `x-real-ip`. 고정 창(10분), 이름(엔드포인트)별로 따로 센다.
- 한도(IP 당 10분): analyze 10 · persona 30 · avatar 15 · chat 100. 처음 만들 때 analyze 1~2 · persona 최대 3 · avatar 최대 3 회를 부르므로, 재시도를 몇 번 해도 정상 사용은 걸리지 않는다.
- 넘으면 429 `rate_limited`, `짧은 시간에 요청이 많았어요. 10분쯤 뒤에 다시 시도해 주세요.`(1분 미만이면 `잠시 뒤에`), `Retry-After: <초>`. 클라이언트 `lib/api.ts` 는 한국어 message 를 그대로 보여 준다.
- **한계(완벽하지 않음)**:
  - 카운터가 서버 인스턴스 메모리에 있다. Vercel 이 인스턴스를 여럿 띄우면 인스턴스마다 따로 세고, 콜드 스타트나 재배포 때 초기화된다. 비용을 확실히 막으려면 공유 저장소(KV·Redis)나 Vercel Firewall 의 rate limit 규칙이 필요하다.
  - 같은 공유기·학교망 사용자는 한도를 나눠 쓴다.
  - 검증 전에 세므로 잘못된 요청도 한도를 쓴다(의도: 잘못된 요청 폭주도 막음).
  - 키가 1만 개를 넘으면 만료된 것을 지우고, 그래도 넘으면 모두 비운다(메모리 상한).
  - 로컬 dev 서버는 HMR 로 모듈을 다시 읽으면 카운터가 초기화된다. 회귀 스크립트 1회차에서 다른 작업의 파일 수정으로 카운터가 초기화돼 11번째가 400 으로 나왔고, curl 로 바로 다시 재서 10회 뒤 429 를 확인했다.

## 4. 미사용 공급자 제거

- `packages/core/src/server/ai.ts`: `getAnthropic`·`getGoogle`, `MODELS.anthropic`·`MODELS.google` 제거. `env.ts` 의 키 이름도 `OPENAI_API_KEY` 하나만 남겼다.
- `packages/core/package.json`: `@anthropic-ai/sdk`, `@google/genai` 제거. `pnpm install --offline` 로 lockfile 갱신(패키지 -22, 다른 패키지 영향 없음). 레포 코드에서 두 SDK 를 import 하는 곳은 0건이었다.
- `/api/health`(apps/web·pocs): `{ ok, providers: { anthropic, openai, google } }` → `{ ok, configured: { openai } }`. 값은 키 설정 여부만이다. health 를 읽는 코드는 없다(pocs 첫 화면은 링크만).
- report 초안에 넣을 내용: **12/1 이후 Claude 로 바꿀 때는 `server/env.ts` 에 `CLAUDE_API_KEY`, `server/ai.ts` 에 클라이언트, `server/llm.ts` 의 `generateObject`·`streamText` 에 분기만 더하면 된다. route 와 앱은 llm.ts 만 부르므로 고칠 필요가 없다.** `.env.example` 의 `CLAUDE_API_KEY`·`GOOGLE_API_KEY` 줄은 소유 범위 밖이라 그대로 뒀다.

## 5. 테스트 · 회귀

- `pnpm test` 44/44 통과(새 테스트 4개):
  - `http.test.ts`: Content-Length 선검사 413과 해요체 기본 문구, rateLimit(IP·이름별 카운트, 429 문구, Retry-After), JSON 아님 새 문구
  - `routes.test.ts`(신규, `mock.module` 로 `server-only`·`llm.ts` 대체): 키 없음 503 문구와 서버 로그의 키 이름, analyze `meta.llm` 기본 제외·`includeLlm` 포함, 30만 자 입력이 9~11구간이고 요약 호출이 모두 동시에 떠 있음(peak in-flight = 구간 수)
- `pnpm typecheck` 4패키지 통과, `pnpm lint` 경고 0
- 3100 실제 호출 1회씩(`evidence/gate3/server-regress.json`):

| API | 상태 | 시간 | 확인 |
|---|---|---|---|
| GET /api/health | 200 | 27ms | `{ ok: true, configured: { openai: true } }` |
| POST /api/analyze (kakao-pc 픽스처) | 200 | 30.7s | 사건 4건, owner 이지우·26, `meta` 에 `llm` 없음 |
| POST /api/persona | 200 | 17.0s | '체육대회 계주로 서진과 다툰 날의 이지우', 15살 |
| POST /api/persona/avatar (합성 얼굴) | 200 | 73.9s | `generated`, webp data URL. 전보다 느림(30~35s → 74s), maxDuration 120s 안 |
| POST /api/chat | 200 | 4.6s | 15살 말투 스트림, `X-Crisis: 0` |
| 30만 자 analyze | 200 | 29.9s | 11구간 동시 요약 (`server-analyze-300k.json`) |
| 속도 제한 | 429 | - | analyze 11번째·avatar 16번째 429, 다른 IP 는 따로 (`server-ratelimit.txt`) |

- pocs 3101: `/api/health` 새 모양, 잘못된 JSON 400 새 문구.
- 키 검사: 바꾼 파일·증거·dev 로그 24개에서 `.env` 키 값 0건, `sk-` 패턴 0건. `NEXT_PUBLIC_` 0건.

## 6. 남은 것 (P2)

- 속도 제한은 인스턴스별이다. 비용 사고를 확실히 막으려면 배포 뒤 Vercel Firewall rate limit 이나 OpenAI 프로젝트 월 사용 한도를 함께 건다.
- 아바타 생성 74s(이번 1회). 120s 한도에 여유가 줄었다. 배포에서 다시 잰다.
- 구간 수 이론상 최대 약 21개(묶음이 비효율적인 입력), 동시 호출 TPM 429 가능성.
