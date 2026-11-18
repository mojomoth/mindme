# gate1-llm-base 로그

## 결과
- `packages/core/src/server/llm.ts` 추가. 공개 함수는 `generateObject`, `streamText` 두 개.
- `packages/core/src/server/index.ts` 에 `export * from './llm.ts';` 한 줄 추가. `@mindme/core/server` 에서 바로 import 할 수 있다.
- 실제 호출 스크립트: `packages/core/test/llm-smoke.ts` (`.test` 가 아니라서 `pnpm test` 에는 포함되지 않음. 키가 없으면 SKIP)
- `pnpm typecheck` 통과, `pnpm test` 4/4 통과, dev 서버 3101 `/api/health` 200

## 구현 메모
- 클라이언트는 기존 `getOpenAI()`(ai.ts)를 다시 쓴다. 기본 모델은 `MODELS.openai.astra`(gpt-6-astra)이고, `opts.model` 이 있으면 그것을, 없으면 `MINDME_TEXT_MODEL` 을 쓴다.
- generateObject: Responses API `text.format = zodTextFormat(schema, 'output')` 로 json_schema strict 요청. 응답은 `JSON.parse` 한 뒤 `schema.parse` 로 다시 검증한다. zod 4.6.7 + openai 7.57.0 helper 조합에서 정상 동작을 확인했다.
- streamText: `stream: true` 로 요청해 `response.output_text.delta` 만 UTF-8 로 인코딩해 enqueue 한다. 스트림을 cancel 하면 요청도 abort 된다.
- 타임아웃 60s, 재시도 1회는 SDK 요청 옵션(`timeout`, `maxRetries: 1`)으로 처리한다. 직접 짠 재시도 루프는 없다.
- 에러는 `LLM 호출 실패 (HTTP n): ...` 형태로 감싸고 `sk-...` 패턴은 `sk-***` 로 가린다. 원본 에러(cause)는 붙이지 않는다.
- Next 밖(node)에서 실행할 때는 `server-only` 때문에 `--conditions=react-server` 가 필요하다.

## 실제 호출 (2026-11-17)
실행: `node --conditions=react-server --env-file=.env packages/core/test/llm-smoke.ts`

| 실행 | 모델 | generateObject | streamText 첫 청크 / 전체 |
|---|---|---|---|
| 1 | gpt-6-astra | 6342ms | 3424ms / 4945ms (32 청크) |
| 2 | gpt-6-astra | 6500ms | 2316ms / 3956ms (33 청크) |
| 3 | gpt-6.1-sol (`MINDME_TEXT_MODEL`) | 3597ms | 4641ms / 5967ms (37 청크) |

응답 예시(1회차):
- generateObject: `{"mood":"기쁨","reply":"시험이 끝나서 정말 홀가분하겠다, 이제 마음 편히 쉬어!"}`
- streamText: `요즘 수행평가랑 숙제가 겹쳐서 좀 정신없어. 그래도 쉬는 시간에 친구들이랑 떠드는 건 재밌어ㅋㅋ`

에러 경로:
- 가짜 키: `LLM 호출 실패 (HTTP 401): 401 Incorrect API key provided: sk-*** ...` → 키 문자열이 가려진 것을 확인
- 없는 모델(`MINDME_TEXT_MODEL=no-such-model`): `LLM 호출 실패 (HTTP 404): 404 The model ... does not exist ...`

## 참고
- gpt-6-astra 의 structured output 응답이 6초대로 느린 편이다. 실시간 채팅은 streamText 로 처리하고, generateObject 는 분석·페르소나 생성 같은 단발성 호출에만 쓰는 것이 좋다.
