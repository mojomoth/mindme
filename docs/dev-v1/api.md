# 최소 API 계약 (v0)

- 코드 기준: `packages/core/src/schemas.ts` (zod). 이 문서와 1:1 이다. 한쪽을 바꾸면 다른 쪽도 같이 바꾼다.
- 모든 Route Handler 는 서버 전용이다. AI 키는 서버(`@mindme/core/server`)에서만 읽는다.
- 서버는 상태를 저장하지 않는다. 사건·페르소나·대화 기록은 클라이언트(localStorage/IndexedDB)가 보관하고, 필요한 만큼 요청 본문에 실어 보낸다.
- 요청 본문은 Vercel 제한(4.5MB) 안에 들어와야 한다.

## 공통

### 에러 응답 (모든 엔드포인트)

```json
{ "error": { "code": "invalid_request", "message": "사람이 읽을 수 있는 설명" } }
```

| 상태 | code | 언제 |
|---|---|---|
| 400 | `invalid_request` | zod 검증 실패 |
| 413 | `payload_too_large` | 본문 크기 초과 |
| 502 | `upstream_error` | AI 공급자 오류 |
| 503 | `provider_unavailable` | 키 없음·한도 초과 |

### 공용 타입

```ts
Source      = 'kakao' | 'diary' | 'prompt'
PersonaKind = 'past' | 'present' | 'future'
Phase       = 'before' | 'during' | 'after'   // 사건 발생 전 · 당시 · 직후
Age         = 1..120 (정수)

Event {                       // 타임라인 사건
  id: string                  // ≤64
  title: string               // ≤80, 예: "친구와 다툰 날"
  date: string                // 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' | 추정 표현("중학교 2학년 봄")
  dateEstimated: boolean      // 기본 false. AI 가 날짜를 추정했으면 true
  age?: Age                   // 그때 나이(알 수 있으면)
  emotions: string[]          // ≤10, 예: ["서운함", "분노"]
  context: string             // ≤1000, 대화 맥락
  people: string[]            // ≤20, 등장 인물
  summary: string             // ≤1000
}

Profile {
  name: string                // ≤20, 예: "홍길동"
  currentAge?: Age
  story?: string              // ≤2000, 페르소나 만들기 화면의 '나의 이야기'
}

Persona {
  id: string
  name: string                // '15살의 홍길동', '친구와 다툰 날의 홍길동' 형식, ≤40
  kind: PersonaKind
  age: Age
  eventId?: string
  phase?: Phase
  traits: string[]            // 성격, ≤10
  speechStyle: string         // 말투, ≤500
  memories: string[]          // 기억, ≤20
  emotions: string[]          // 감정, ≤10
  greeting: string            // 첫 인사, ≤300
  avatar?: string             // 이미지 URL 또는 data URL
}

ChatMessage { role: 'user' | 'assistant', content: string (≤4000) }
```

## GET /api/health

키 '존재 여부'만 돌려준다. 키 값·길이·접두사는 응답하지 않는다.

```json
{ "ok": true, "providers": { "anthropic": true, "openai": true, "google": true } }
```

## POST /api/analyze

카카오톡 TXT · 일기 · 자유 프롬프트에서 사건 타임라인을 뽑는다.

요청 (`AnalyzeRequestSchema`)

```json
{ "source": "kakao", "text": "카카오톡 내보내기 TXT 전체…", "me": "홍길동" }
```

- `text`: 1~300,000자 (앞뒤 공백 제거 후)
- `me`(선택): 카카오톡 대화에서 '나'의 대화명. 없으면 AI 가 추정

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
      "summary": "민수와 크게 다투고 일주일 동안 말을 하지 않았다."
    }
  ]
}
```

- 사건은 최대 100개. 추가·수정·삭제는 클라이언트에서 하고, 결과를 `/api/persona` 에 그대로 넘긴다.

## POST /api/persona

선택한 시점의 '나'를 만든다.

요청 (`PersonaRequestSchema`)

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

- `situation` 기본값 `""`, `events` 기본값 `[]` (사건 없이 자유 대화 가능)
- `past`: `age`·`eventId`·`phase` 로 그 시점 성격·감정·기억을 반영
- `present`: 현재 성격·가치관·고민 기반. `eventId`·`phase` 는 쓰지 않음
- `future`: `situation` 에 목표·가치관·바라는 삶을 담는다

응답 200 (`PersonaResponseSchema`)

```json
{
  "persona": {
    "id": "per_01",
    "name": "15살의 홍길동",
    "kind": "past",
    "age": 15,
    "eventId": "evt_01",
    "phase": "after",
    "traits": ["수줍음", "고집"],
    "speechStyle": "반말, 짧게 끊어 말함, ㅋㅋ 자주 씀",
    "memories": ["민수와 체육대회 조 편성으로 다툼"],
    "emotions": ["서운함", "후회"],
    "greeting": "…왔어? 오늘 좀 기분이 별로야."
  }
}
```

## POST /api/persona/avatar

얼굴 사진으로 해당 나이의 3D 아바타를 만든다. 사진이 없으면 기본 캐릭터를 돌려준다.

요청 (`AvatarRequestSchema`)

```json
{ "age": 15, "kind": "past", "photo": "data:image/jpeg;base64,/9j/…" }
```

- `photo`(선택): `data:image/(jpeg|png|webp);base64,…` 형식, 약 4MB 이하. 클라이언트에서 리사이즈해서 보낸다.

응답 200 (`AvatarResponseSchema`)

```json
{ "avatar": "data:image/png;base64,…", "source": "generated" }
```

```json
{ "avatar": "/mascot.png", "source": "default" }
```

## POST /api/chat

페르소나와 대화한다. 응답은 스트리밍 텍스트다.

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

- `messages` 1~100개, 마지막은 반드시 `user`
- 대화 기록은 클라이언트가 보관하고 매번 보낸다

응답 200

- `Content-Type: text/plain; charset=utf-8`, 청크 단위 스트림 (페르소나 답변 본문만)
- 스트림 도중 오류는 연결 종료로 알린다. 시작 전 오류는 위 공통 에러 JSON
