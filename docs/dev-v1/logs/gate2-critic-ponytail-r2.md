# Gate 2 Critic — ponytail r2

2026-11-19. 독립 Critic. 수정 로그(`gate2-fix-ponytail-r1.md`)는 참고만 했고, 판정은 직접 실행한 결과로 내렸다. 코드는 고치지 않았다.

**판정: PASS** (P0 0건, P1 0건, P2 6건. 모두 r1 에서 넘어온 것이고 새로 생긴 결함은 없다)

## 직접 실행한 것

| 항목 | 결과 | 증거 |
|---|---|---|
| `pnpm typecheck` (core·ui·pocs·web) | 통과, EXIT 0 | `evidence/gate2/critic-ponytail-r2-typecheck.txt` |
| `pnpm test` | 40/40 통과 (`apps/web/lib/data.test.ts` 포함) | `evidence/gate2/critic-ponytail-r2-test.txt` |
| `pnpm -r build` (pocs·web `next build`) | 둘 다 성공, EXIT 0 | `evidence/gate2/critic-ponytail-r2-build.txt` |
| `pnpm lint` | EXIT 0 | `evidence/gate2/critic-ponytail-r2-lint.txt` |
| `.env` 키 값 바이트 검색(값은 출력하지 않음) | 레포 838파일, `apps/web/.next` 643파일, `apps/web/.next/static` 25파일, `pocs/.next/static` 36파일, `git log -p --all` 모두 0건 | `evidence/gate2/critic-ponytail-r2-keyscan.txt` |
| 클라이언트 번들(`apps/web/.next/static`)의 서버 흔적 | `OPENAI_API_KEY`·`process.env`·`api.openai.com`·`server-only`·`openai`·시스템 프롬프트 문구 모두 0건. 클라이언트 쪽 `@mindme/core/server` import 0건 | `evidence/gate2/critic-ponytail-r2-bundle.txt` |
| 실제 HTTP(3100·3101) | 아래 표 | `evidence/gate2/critic-ponytail-r2-http.txt` |
| dev 서버 | 3100·3101 모두 켜져 있고 빌드 뒤에도 `/api/health` 200 | `evidence/gate2/critic-ponytail-r2-http.txt` |

실제 HTTP 결과(지금 26살, 13살 사건 '체육대회 계주로 서진과 다툰 날'):

- 15살 + 그 사건 → 400 `선택한 사건은 13살 때 일이에요…` (core 규칙. 앱은 이제 이 조합을 보내지 않는다)
- 14살 + 그 사건 → 200 `체육대회 계주로 서진과 다툰 날의 홍길동`
- 15살, 사건 없음 → 200 `15살의 홍길동`
- 검증 실패 400: web 은 고정 한국어 문구, pocs 는 zod 이슈를 한국어로 바꾼 문구(`나이 형식이 올바르지 않아요.` 등). 영어 zod 메시지 0건.
- chat 1.2MB → 413, avatar 6MB(content-length 없는 스트림) → 413, 사진 없는 avatar → 기본 캐릭터 200, data URL 형식 오류 → 400.

## r1 P1 재확인

1. **04 모달 나이 차 2살 → 400**: 고쳐졌다. `nearestEvent` 가 `at > age || at < age - 1` 이면 건너뛰어 core `personaRequestError`(차이 1까지)와 범위가 같다. 테스트가 1살 차는 고르고 2살 차는 고르지 않는지 본다. 위 HTTP 결과와도 맞다.
2. **route 본문 중복(pocs ↔ apps/web)**: 고쳐졌다. 본문 검증·413·키 확인·입력 오류 400·429→503·avatar 선검사·기본 캐릭터·Server-Timing 은 `packages/core/src/server/routes.ts` 한 벌이다. 두 앱의 route.ts 는 5~11줄이고 `dynamic`·`maxDuration`·`export const POST = xxxRoute({...})` 만 남았다. route 파일 안에 `parseRequest`·`hasKey`·`try/catch` 0건(`evidence/gate2/critic-ponytail-r2-dup.txt`).

## P2 (막지 않음)

1. **`owner` 를 앱이 쓰지 않는다** (r1 P2-1 그대로). core 는 분석마다 `owner` 를 만들지만 `apps/web` 사용 0건. 이름·나이 기본값으로 쓰거나 지운다.
2. **pocs 클라이언트 도우미 두 벌** (r1 P2-2 그대로). `pocs/app/pocs/persona/PersonaPoc.tsx:58-76` 의 `shrink`·`toDataUrl` 이 `packages/ui/src/image.ts` 와 같은 코드다. `@mindme/ui` 에서 가져오면 지울 수 있다. chat 스트림 읽기(`pocs/app/pocs/chat/Chat.tsx:91-109` 와 `apps/web/lib/api.ts` `streamChat`)도 10줄 남짓 비슷하지만, PoC 는 첫 글자 시간 측정이 붙은 개발 화면이라 이건 그대로 둬도 된다.
3. **쓰지 않는 AI SDK** (r1 P2-3, Gate 0 부터). `getAnthropic`·`getGoogle` 호출 0건, `@anthropic-ai/sdk`·`@google/genai` 는 health 표시 말고는 안 쓴다.
4. **서버 공통 문구의 말투** (r1 P2-4 그대로). `JSON 형식이 아닙니다.`·`요청 본문이 너무 큽니다.`·`AI 공급자 키가 설정되지 않았습니다.`(합쇼체)와 `선택한 사건을 events 에서 찾지 못했어요.`(필드 이름)가 남았다. 앱 클라이언트는 한글 문구를 그대로 보여 주므로, 배포에서 키가 빠지면 키 문구가 화면에 뜬다. 나머지 셋은 정상 앱 흐름으로는 나오지 않는다(본문 최대 약 16만 자 < 상한 100만 자, eventId 는 같은 목록에서 고른다).
5. **web analyze `maxDuration` 60 대 입력 상한 30만 자** (r1 P2-5 그대로, route 주석에 한계를 적어 둠). 4만 자를 넘는 기록은 배포에서 60초를 넘길 수 있다.
6. **analyze 응답의 `meta.llm`(AI 원시 출력)이 앱까지 내려간다** (r1 P2-6 그대로). 앱은 `meta.me` 만 쓴다.

## 문제없다고 본 것

- 사용자 입력과 시스템 프롬프트: 시스템 프롬프트를 만드는 곳은 네 군데이고, 분석·구간 요약·페르소나 생성은 고정 상수다. 사용자 글은 `input`(user 쪽)으로만 간다. chat 은 사용자 값이 `[너에 대한 정보]` 블록 안에만 들어가고(이번에 이름도 블록 안으로 옮겼다), 지시문에는 숫자 나이·enum 만 있다. `flat` 이 줄바꿈·대괄호·따옴표를 지운다.
- 모든 POST route 에 본문 상한이 있다. content-length 없이 스트림으로 보내도 413 이다(실측).
- 화면 컴포넌트는 presentational 을 지켰고, 상태는 `MindmeApp` 한 곳에 있다. 과한 추상화나 쓰지 않는 의존성이 새로 생기지 않았다(`apps/web` 의존성은 core·ui·next·react·@next/env 뿐).
- `lib/data.ts`·`MindmeApp.tsx` 는 core(`parseKakao`·`sortByTime`·`eventAgeOf`·`PersonaSchema`)와 ui(`shrinkImage`·`blobToDataUrl`·`webNative`)를 가져다 쓴다. 분석·페르소나·대화 로직을 다시 쓴 곳은 없다.
