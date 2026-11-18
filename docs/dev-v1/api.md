# 최소 API 계약 (v1, Gate 1 실측 + Gate 2 core-p2-fixes 반영)

- 코드 기준: `packages/core/src/schemas.ts`(zod), `packages/core/src/persona/persona.ts`(`PersonaGenerateRequestSchema`), `packages/core/src/errors.ts`(검증 오류 문구). 이 문서와 1:1 이다. 한쪽을 바꾸면 다른 쪽도 같이 바꾼다.
- Route Handler(`pocs/app/api/**/route.ts`)는 얇게 둔다: `parseRequest`(본문 상한 → JSON → zod) → 키 확인 → core 함수 → 응답. 공통 처리는 `packages/core/src/server/http.ts`, 대화 스트림은 `packages/core/src/chat/server.ts`.
- 모든 Route Handler 는 서버 전용이다. AI 키는 서버(`@mindme/core/server`)에서만 읽고, AI 호출은 모두 `packages/core/src/server/llm.ts`(OpenAI) 를 거친다.
- 서버는 상태를 저장하지 않는다. 사건·페르소나·대화 기록은 클라이언트(localStorage)가 보관하고, 필요한 만큼 요청 본문에 실어 보낸다.
- 문자열 필드는 앞뒤 공백을 지운 뒤 검사한다. 아래 `≤n` 은 글자 수(UTF-16 길이) 상한이고, `text` 표시는 빈 문자열을 허용하지 않는다는 뜻이다.

## 공통

### 에러 응답 (모든 엔드포인트)

```json
{ "error": { "code": "invalid_request", "message": "사람이 읽을 수 있는 설명" } }
```

| 상태 | code | 언제 |
|---|---|---|
| 400 | `invalid_request` | JSON 이 아님(`JSON 형식이 아닙니다.`), zod 검증 실패, 입력 의미 오류(엔드포인트별) |
| 413 | `payload_too_large` | 본문 글자 수가 엔드포인트 상한 초과 |
| 502 | `upstream_error` | AI 공급자 오류 |
| 503 | `provider_unavailable` | OpenAI 키 없음(`AI 공급자 키가 설정되지 않았습니다.`), `/api/analyze` 는 HTTP 429 도 503 |

- zod 검증 실패 문구는 첫 번째 이슈를 `zodErrorMessage`(core `errors.ts`)로 바꾼 한국어다. zod 기본 메시지(영어)는 응답에 싣지 않는다. 예: `나이는 120 이하여야 해요.`, `기록을 입력해 주세요.`, `기록 종류 값이 올바르지 않아요.`, `대화가 하나 이상 있어야 해요.`. 필드 이름은 한국어 라벨로 바꾸고, 라벨이 없는 필드는 `요청 형식이 올바르지 않아요.`
- `parseRequest(req, schema, { invalid })` 에 `invalid` 문구를 주면 그 고정 문구를 쓴다(`/api/persona/avatar`, `apps/web` 의 route). 클라이언트 폼 검증도 `zodErrorMessage` 를 그대로 쓸 수 있다(비밀 없음, `@mindme/core`).

| 엔드포인트 | 본문 상한(글자) | maxDuration |
|---|---|---|
| `POST /api/analyze` | 700,000 | 300s |
| `POST /api/persona` | 1,000,000 | 60s |
| `POST /api/persona/avatar` | 5,700,000 (Content-Length 도 먼저 검사) | 120s |
| `POST /api/chat` | 1,000,000 | 기본값 |

배포 시 Vercel 요청 본문 4.5MB 제한이 먼저 걸린다.

### 공용 타입

```ts
Source      = 'kakao' | 'diary' | 'prompt'
PersonaKind = 'past' | 'present' | 'future'
Phase       = 'before' | 'during' | 'after'   // 사건 발생 전 · 당시 · 직후
Age         = 1..120 (정수)

Event {                       // 타임라인 사건
  id: text ≤64
  title: text ≤80             // 예: "친구와 다툰 날". AI 에는 '~한 날'(밤·아침 등)로 끝내라고 지시한다
  date: text ≤40              // 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' | 추정 표현("중학교 2학년 봄")
  dateEstimated: boolean      // 기본 false. AI 가 날짜를 추정했으면 true
  age?: Age                   // 그때 나이(알 수 있으면)
  emotions: text ≤20 [] ≤10   // 예: ["서운함", "분노"]
  context: string ≤1000       // 대화 맥락
  people: text ≤40 [] ≤20     // 등장 인물
  summary: string ≤1000
  selfAtTime?: {              // 그 시점의 '나' 단서. /api/persona 가 성격·말투를 잡을 때 쓴다
    traits: text ≤40 [] ≤10
    speechStyle: string ≤300
    quotes: text ≤200 [] ≤5   // '나'가 실제로 한 말(원문). 없으면 []
  }
}

Profile {
  name: text ≤20              // 예: "홍길동"
  currentAge?: Age
  story?: string ≤2000        // 페르소나 만들기 화면의 '나의 이야기'
}

Persona {
  id: text ≤64                // 서버가 'per_' + 8자리로 만든다
  name: text ≤40              // '15살의 홍길동' · '친구와 다툰 날의 홍길동' · '지금의 홍길동' · '30살의 홍길동'
                              // past + 사건: 제목이 날·밤·아침·낮·저녁·새벽·때·무렵·하루·순간·시절로 끝날 때만 '제목의 이름',
                              // '…크게 다툼' 같은 명사형이면 '15살의 홍길동'. 40자를 넘으면 제목을 '…'로 줄인다
  kind: PersonaKind
  age: Age
  eventId?: text ≤64
  phase?: Phase
  traits: text ≤40 [] ≤10     // 성격
  speechStyle: string ≤500    // 말투
  memories: text ≤300 [] ≤20  // 기억
  emotions: text ≤20 [] ≤10   // 감정
  greeting: text ≤300         // 첫 인사
  avatar?: string             // 이미지 URL 또는 data URL (상한 없음)
}

ChatMessage { role: 'user' | 'assistant', content: text ≤4000 }

Owner {                       // 기록을 남긴 '나' (/api/analyze 가 추정)
  name: text ≤20 | null       // 모르면 null
  currentAge: Age | null      // 오늘 기준 연 나이. 모르면 null
}
```

## GET /api/health

`providers.<이름>` 의 값은 **configured**(서버 환경 변수에 그 공급자 키가 설정돼 있는지)다. 키가 유효한지, 한도·권한이 남았는지(=실제로 호출할 수 있는지)는 확인하지 않는다. 키 값·길이·접두사는 응답하지 않는다.

```json
{ "ok": true, "providers": { "anthropic": true, "openai": true, "google": true } }
```

- 앱이 실제로 부르는 공급자는 `openai` 하나다. `anthropic`·`google` 이 `true` 여도 지금은 쓰지 않는다(Gate 0 실측: Anthropic 월 한도 초과로 2026-12-01 복구 예정, Google 은 타임아웃·429).
- 화면에서 'AI 사용 가능'을 판단할 때는 `providers.openai` 만 본다. 실제 호출 실패는 각 엔드포인트의 502/503 으로 알 수 있다.

## POST /api/analyze

카카오톡 TXT · 일기 · 자유 프롬프트에서 사건 타임라인을 뽑는다. core: `analyzeRecords(data, generateObject)`.

요청 (`AnalyzeRequestSchema`)

```json
{ "source": "kakao", "text": "카카오톡 내보내기 TXT 전체…", "me": "홍길동" }
```

- `text`: text ≤300,000
- `me`(선택): text ≤40. 카카오톡 대화에서 '나'의 대화명. 없으면 1:1 방 제목으로 찾고, 그래도 없으면 AI 가 추정
- `source=kakao`: PC(Windows)·Android·iOS·Mac CSV 형식. 메시지 형식이 하나도 없으면 400 `카카오톡 대화 형식을 찾지 못했어요. …`

처리

- 정리한 본문이 40,000자 이하면 한 번에 분석(`direct`). 넘으면 날짜 경계로 30,000자씩 나눠 구간마다 요약(동시 4)한 뒤 최종 분석(`summarized`). 300,000자면 약 10구간, 2~3분 걸릴 수 있다.

응답 200 (`AnalyzeResponseSchema`)

```json
{
  "events": [
    {
      "id": "evt_01",
      "title": "친구와 다툰 날",
      "date": "2015-05",
      "dateEstimated": true,
      "age": 15,
      "emotions": ["서운함", "후회"],
      "context": "체육대회 조 편성 문제로 단톡방에서 말다툼",
      "people": ["민수"],
      "summary": "민수와 크게 다투고 일주일 동안 말을 하지 않았다.",
      "selfAtTime": { "traits": ["고집이 셈"], "speechStyle": "화나면 짧게 끊어 말함", "quotes": ["됐어 너랑 말 안 해"] }
    }
  ],
  "owner": { "name": "이지우", "currentAge": 26 },
  "meta": { "mode": "direct", "chunks": 0, "units": 33, "participants": ["이지우", "박서진"], "me": "이지우", "llm": { } }
}
```

- `events`: 최대 100개, 시간순 정렬, id 는 정렬 후 `evt_01..`
- `owner`(Gate 2 추가, 서버는 항상 채움. 스키마상 optional 은 예전 저장본 호환용): 기록을 남긴 '나'. 앱이 Profile 기본값('15살의 홍길동' 이름)과 사건의 과거·현재·미래 판정에 쓴다
  - `name`: AI 추정 → 없으면 카카오톡에서 찾은 '나'(`meta.me`) → 없으면 `null`. 따옴표·줄바꿈은 공백으로, 20자로 자른다
  - `currentAge`: AI 추정 → 없으면 사건들의 (연도 - 나이) 중앙값으로 출생연도를 잡아 `오늘 연도 - 출생연도` → 없으면 `null`. 사건 당시 나이 중 가장 큰 값보다 작으면 그 값으로 올린다
  - 구간 요약(`summarized`) 모드에서는 이름·나이 단서가 요약에서 빠질 수 있어 `null` 이 나오기 쉽다(P2)
- `meta`(검증용, 클라이언트 동작에는 필요 없음): `mode` `direct|summarized`, `chunks` 구간 수, `units`(kakao 메시지 수 · diary 항목 수 · prompt 문단 수), `participants`, `me`, `llm`(마지막 AI 호출 원시 출력)
- 오류: 413 `입력이 너무 길어요. 30만 자 이하로 줄여 주세요.`, 429 → 503 `AI 사용 한도에 걸렸어요. …`, 그 밖의 AI 오류 → 502 `기록을 분석하지 못했어요. …`
- 사건 추가·수정·삭제는 클라이언트에서 하고, 결과를 `/api/persona` 에 그대로 넘긴다.

## POST /api/persona

선택한 시점의 '나'를 만든다. core: `generatePersona(data)`.

요청 (`PersonaGenerateRequestSchema` = `PersonaRequestSchema` + `event`, `futureGoals`)

```json
{
  "kind": "past",
  "age": 15,
  "eventId": "evt_01",
  "phase": "after",
  "situation": "민수랑 싸우고 집에 돌아온 저녁",
  "events": [ /* Event[] — /api/analyze 결과(수정본) */ ],
  "profile": { "name": "홍길동", "currentAge": 32, "story": "…" }
}
```

| 필드 | 형식 | 설명 |
|---|---|---|
| `kind` | PersonaKind | |
| `age` | Age | 만들 인물의 나이. `present` 는 클라이언트가 `profile.currentAge` 와 같게 보낸다(서버는 검사하지 않음) |
| `eventId?` | text ≤64 | `past` 에서 `events` 안의 사건 id. 없으면 400 `선택한 사건을 events 에서 찾지 못했어요.` |
| `event?` | Event | 분석 결과 없이 사건 하나를 직접 넘길 때. `eventId` 보다 우선 |
| `phase?` | Phase | `past` + 사건이 있을 때. 기본 `after` |
| `situation` | string ≤2000, 기본 `""` | 상황 설명 |
| `events` | Event[] ≤100, 기본 `[]` | 사건 없이도 생성 가능(자유 대화) |
| `futureGoals?` | string ≤2000 | `future` 의 목표·가치관·바라는 삶 |
| `profile` | Profile | |

- `past`: 그 나이 이후 사건, 나이를 알 수 없는 사건, 선택한 사건보다 날짜가 뒤인 사건은 AI 에 넘기지 않는다(선택한 사건은 항상 넘김). `profile.currentAge` 가 있고 `age > currentAge` 면 400 `과거의 나는 지금 나이보다 어려야 해요.`
- `past` + 사건: 사건 당시 나이(`event.age`, 없으면 `date` 연도와 `currentAge` 로 계산)가 있으면 `age` 는 그 나이이거나 1살 많아야 한다(`before` 는 1살 적어도 됨). 어긋나면 400 `선택한 사건은 15살 때 일이에요. 나이를 15살로 맞춰 주세요.` (미래 지식 차단). 나이를 알 수 없는 사건은 검사하지 않는다
- `past` + `before`: 선택한 사건은 제목·날짜만 넘긴다(요약·맥락·감정·인물·그때의 나는 넘기지 않음). 인물은 사건이 일어날 줄 모르고, 분위기만 반영한다
- `present`: 현재 성격·가치관·고민 기반. `eventId`·`phase` 는 쓰지 않는다
- `future`: `futureGoals`(와 `situation`)를 바탕으로 한 가상 인물, 예언 금지. `currentAge` 가 있고 `age ≤ currentAge` 면 400 `미래의 나는 지금 나이보다 많아야 해요.`
- AI 초안은 Persona 상한으로 자르고 줄바꿈을 한 칸 공백으로 편다. 빈 greeting 은 `…왔어?`

응답 200 (`PersonaResponseSchema`)

```json
{
  "persona": {
    "id": "per_1a2b3c4d",
    "name": "친구와 다툰 날의 홍길동",
    "kind": "past",
    "age": 15,
    "eventId": "evt_01",
    "phase": "after",
    "traits": ["수줍음", "고집이 셈"],
    "speechStyle": "반말, 짧게 끊어 말함. \"됐어, 신경 쓰지 마.\"",
    "memories": ["민수와 체육대회 조 편성으로 다툼"],
    "emotions": ["서운함", "후회"],
    "greeting": "…왔어? 오늘 좀 기분이 별로야."
  }
}
```

- 오류: 413 `요청 본문이 너무 큽니다.`, AI 오류 → 502 `페르소나를 만들지 못했어요. …`

## POST /api/persona/avatar

얼굴 사진으로 해당 나이의 3D 아바타를 만든다(gpt-image-2 편집, 스타일 참조 `assets/generated/avatar-teen-512.png`). 사진이 없으면 AI 를 부르지 않고 기본 캐릭터를 돌려준다. 사진은 메모리에서만 쓰고 저장하지 않는다.

요청 (`AvatarRequestSchema`)

```json
{ "age": 15, "kind": "past", "photo": "data:image/jpeg;base64,/9j/…" }
```

- `photo`(선택): `data:image/(jpeg|png|webp);base64,…`, ≤5,600,000자. 클라이언트가 긴 변 1024px JPEG 로 줄여 보낸다(보통 300KB 안팎)
- 검증 실패는 고정 문구 400 `age(1~120), kind(past|present|future), photo(JPG·PNG·WEBP data URL)를 확인해 주세요.`

응답 200 (`AvatarResponseSchema`)

```json
{ "avatar": "data:image/webp;base64,…", "source": "generated" }
```

```json
{ "avatar": "/_next/static/media/guide-face-512.<hash>.png", "source": "default" }
```

- 생성 시 헤더 `Server-Timing: gen;dur=<ms>` (실측 30~35s)
- `default` 경로는 빌드마다 해시가 바뀐다. 오래 보관하지 않는다(P2)
- 오류: 413 `사진이 너무 커요. 더 작은 사진으로 해 주세요.`, AI 오류 → 502 `아바타를 만들지 못했어요. …`

## POST /api/chat

페르소나와 대화한다. 응답은 스트리밍 텍스트다. core: `chatResponse(data)`.

요청 (`ChatRequestSchema`)

```json
{
  "persona": { /* Persona */ },
  "messages": [
    { "role": "assistant", "content": "…왔어? 오늘 좀 기분이 별로야." },
    { "role": "user", "content": "그때 기분은 어땠어?" }
  ]
}
```

- `persona` 를 빼면 내장 샘플 `SAMPLE_PERSONA`(15살의 홍길동)로 대화한다
- `messages` 1~100개, 마지막은 반드시 `user`(아니면 400 `마지막 메시지는 user 여야 합니다.`)
- 대화 기록은 클라이언트가 보관하고 매번 보낸다(PoC 화면은 최근 40개). 서버는 AI 에 최근 24개·합계 12,000자까지만 보낸다(마지막 user 는 항상 포함)
- persona 의 문자열 값(이름 포함)은 시스템 프롬프트의 `[너에 대한 정보]` 블록 안에만 들어간다. 지시문에는 `age`(정수)·`kind`·`phase`(enum)만 쓴다
- 블록에 넣기 전에 줄바꿈·대괄호·따옴표(`"` `'` `“”` `‘’` `「」` `『』` 백틱)를 공백으로 바꾸고, 이름은 40자로 자른다

응답 200

- `Content-Type: text/plain; charset=utf-8`, `Cache-Control: no-store`, 청크 단위 스트림 (페르소나 답변 본문만)
- `X-Crisis: 1|0`: 최근 user 메시지 3개 중 하나에 자해·자살 키워드가 있으면 1(`detectCrisisInChat`). 키워드에는 돌려 말한 표현('다 놓고 싶다', '없어지고 싶다', '다 끝내고 싶다', '살 이유가 없다' 등)도 들어 있다. '배고파 죽겠어', '숙제 끝내고 싶어' 같은 관용 표현은 잡지 않는다. 이때 응답 끝에 109 안내(`CRISIS_FOOTER`)를 한 번 붙인다(모델이 이미 109 를 썼으면 생략)
- 첫 청크를 받을 때까지 기다린다. 시작 전 오류는 502 `답변을 만들지 못했어요. …` JSON, 스트림 도중 오류는 연결 종료로 알린다
- 오류: 413 `요청 본문이 너무 큽니다.`
