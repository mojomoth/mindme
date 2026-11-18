# Gate 2 Critic — ponytail r1

2026-11-19. 독립 Critic. 구현자 로그(gate2-core·gate2-web)는 참고만 했고, 판정은 직접 실행한 결과로 내렸다. 코드는 고치지 않았다.

**판정: FAIL** (P1 2건, P2 6건)

## 직접 실행한 것

| 항목 | 결과 | 증거 |
|---|---|---|
| `pnpm typecheck` (core·ui·pocs·web) | 통과, EXIT 0 | `evidence/gate2/critic-ponytail-r1-typecheck.txt` |
| `pnpm test` | 39/39 통과 | `evidence/gate2/critic-ponytail-r1-test.txt` |
| `pnpm -r build` (pocs·web `next build`) | 둘 다 성공, EXIT 0 | `evidence/gate2/critic-ponytail-r1-build.txt` |
| `pnpm lint` | 경고 0, EXIT 0 | `evidence/gate2/critic-ponytail-r1-lint.txt` |
| `.env` 키 값 바이트 검색(값은 출력하지 않음) | 레포 715파일·`apps/web/.next` 전체 607파일·`apps/web/.next/static` 25파일·`pocs/.next/static` 36파일 모두 0건 | `evidence/gate2/critic-ponytail-r1-keyscan.txt` |
| 클라이언트 번들(`apps/web/.next/static`)에 서버 코드가 있는지 | `OPENAI_API_KEY`·`process.env`·`api.openai.com`·`server-only`·시스템 프롬프트 문구(`너는 `·`자살예방`·`CRISIS_PATTERNS`) 0건. 화면 문구만 있음. 클라이언트 쪽 `@mindme/core/server` import 0건 | 이 로그 |
| dev 서버 | 3100·3101 모두 켜져 있고 `/api/health` 200, 빌드 뒤에도 200 | 이 로그 |
| 04 모달 과거 페르소나 재현(3100 실제 HTTP, AI 호출 전 400) | 400 | `evidence/gate2/critic-ponytail-r1-modal-age-gap.txt` |

## P1

1. **04 모달: 2살 전 사건을 이어 붙이면 페르소나 생성이 400 으로 실패한다** (`apps/web/lib/data.ts:73`, `packages/core/src/persona/persona.ts` `personaRequestError`)
   - `nearestEvent` 는 사건 나이가 `age-2 ~ age` 이면 고른다. 같은 Gate 에서 core 는 사건 나이와 요청 나이가 2살 이상 차이 나면 400 을 돌려주도록 바뀌었다(차이 1까지만 허용).
   - 재현: 지금 26살, 13살 사건 '체육대회 계주로 서진과 다툰 날', 모달에서 15살 + '친구 서진과 계주 때문에 다툰 일' → `nearestEvent` 가 13살 사건을 고르고 `/api/persona` 가 `400 선택한 사건은 13살 때 일이에요. 나이를 13살로 맞춰 주세요.` 진행 화면의 '다시 시도'는 같은 요청을 다시 보내서 계속 실패한다.
   - 가장 작은 수정: `nearestEvent` 범위를 `at < age - 1` 로 줄인다(core 규칙과 맞춤). 테스트 한 건(나이 차 2인 사건은 고르지 않음)을 붙인다.

2. **route 핸들러가 pocs 와 apps/web 에 거의 그대로 복사돼 있다** (`apps/web/app/api/{analyze,persona,persona/avatar,chat}/route.ts`)
   - Gate 2 원칙은 '중복되면 얇은 래퍼만, 로직은 core 에(한 줄 re-export 수준)'다. 지금은 pocs route 본문을 복사했다: 본문 검증 → 키 확인 → `AnalyzeInputError`/`PersonaInputError` → 400, 429 → 503 문구, avatar 의 `content-length` 선검사·사진 없을 때 기본 캐릭터·`Server-Timing` 까지 두 벌이다(파일당 16~34줄, `evidence/gate2/critic-ponytail-r1-route-dup.txt`). 이미 두 벌이 어긋나 있다(analyze `maxDuration` 300 대 60, 400 문구 방식, avatar 안내 문구).
   - 구현자가 든 이유('`maxDuration` 은 파일 안 리터럴이어야 해서 re-export 불가')는 핸들러 본문에는 해당하지 않는다. `export const maxDuration = 60; export const POST = analyzeRoute({ invalid: '…' });` 처럼 세그먼트 설정만 파일에 두고 핸들러는 core(`@mindme/core/server`)에서 만들면 된다.
   - 가장 작은 수정: `packages/core/src/server/routes.ts` 에 `analyzeRoute`·`personaRoute`·`avatarRoute`·`chatRoute(opts)` 를 두고, 두 앱 route 는 설정 리터럴 몇 줄과 `export const POST = …` 만 남긴다.

## P2

1. **`owner` 를 앱이 쓰지 않는다**: core 가 이번에 `LlmAnalysisSchema.owner`·`normalizeOwner`·`OwnerSchema` 를 더했지만(분석 호출마다 출력 필드가 늘어난다), `apps/web` 은 이름을 `meta.me` 에서만 읽고 나이는 늘 직접 받는다(`MindmeApp.tsx:184`, `owner` 사용 0건). 앱에서 이름·나이 기본값으로 쓰거나, 쓰지 않을 거면 지운다.
2. **이미지 도우미 두 벌**: `packages/ui/src/image.ts` 로 옮겼지만 `pocs/app/pocs/persona/PersonaPoc.tsx:57-75` 의 `shrink`·`toDataUrl` 이 그대로 남았다. pocs 도 `@mindme/ui` 에서 가져오면 된다.
3. **쓰지 않는 AI SDK**: `packages/core/src/server/ai.ts` 의 `getAnthropic`·`getGoogle` 을 부르는 곳이 없다. `@anthropic-ai/sdk`·`@google/genai` 의존성도 health 표시 말고는 쓰이지 않는다(OpenAI 만 쓰는 방침). Gate 0 부터 있던 것이라 이번 변경분은 아니다.
4. **사용자에게 그대로 보이는 서버 문구가 말투·용어가 섞여 있다**: `lib/api.ts` 는 한글이 들어간 서버 문구를 그대로 보여 준다. 그래서 `AI 공급자 키가 설정되지 않았습니다.`·`JSON 형식이 아닙니다.`·`요청 본문이 너무 큽니다.`(합쇼체, 앱의 해요체와 다름), `선택한 사건을 events 에서 찾지 못했어요.`(필드 이름 노출)가 화면에 뜰 수 있다.
5. **analyze `maxDuration` 60 대 입력 상한 30만 자**: 클라이언트·route 모두 30만 자까지 받지만, 4만 자를 넘으면 구간 요약 때문에 배포 환경에서 60초를 넘길 수 있다(pocs 주석은 2~3분). 구현자도 P2 로 남겼다. 상한을 줄이거나 `maxDuration` 을 pocs 처럼 300 으로 맞춘다.
6. **analyze 응답의 `meta.llm`(AI 원시 출력)이 앱 클라이언트까지 내려간다**: 앱은 `meta.me` 만 쓴다. 응답이 커질 뿐 쓰임이 없다.

## 문제없다고 본 것

- 클라이언트 번들에 키·서버 코드·시스템 프롬프트가 없다(위 검색). `@mindme/core/server` 는 `server-only` 로 막혀 있고 route 에서만 import 한다.
- 모든 POST route 에 본문 상한(`maxBody`)이 있고, avatar 는 본문을 읽기 전에 `content-length` 로 먼저 거른다.
- chat 시스템 프롬프트: 사용자 값은 `[너에 대한 정보]` 블록 안에만 들어가고, 지시문에는 숫자 나이·enum 만 남았다. `flat` 이 줄바꿈·대괄호·따옴표를 지운다. 분석·페르소나 생성은 사용자 글을 `input`(user 쪽)으로만 보낸다.
- 화면 컴포넌트(`Working`·`ProfileSheet`·모달·대화 변경)는 presentational 을 유지했고, 상태는 `MindmeApp` 한 곳에 있다. `useEscape` 는 한 번만 리스너를 단다. 과한 추상화는 보지 못했다.
- `lib/data.ts`·`MindmeApp.tsx` 는 core(`parseKakao`·`sortByTime`·`eventAgeOf`·`PersonaSchema`)와 ui 를 가져다 쓴다. 분석·페르소나·대화 로직을 다시 쓴 곳은 없다.
