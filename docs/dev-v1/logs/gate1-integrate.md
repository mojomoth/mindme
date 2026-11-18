# gate1-integrate 로그

2026-11-19. Gate 1 1차 실행이 네트워크 장애(ENOTFOUND)로 중단된 뒤 이어서 진행했다. 미커밋 작업(analysis·persona·chat·screens, Critic 로그·증거)은 그대로 두고 통합만 했다.

## 결과

| 항목 | 결과 |
|---|---|
| 최소 API 분리 | route 4개를 '입력 검증 → core 호출 → 응답'으로 줄였다. 동작은 그대로다(오류 문구·상태 코드·헤더 동일, 실제 호출 재확인) |
| `api.md` | 실제 핸들러 기준 v1 로 다시 썼다. 길이 제한 전부, `selfAtTime`, `meta`, `PersonaGenerateRequestSchema`(event·futureGoals), 엔드포인트별 본문 상한·maxDuration·400 문구 방식, 의미 오류 400, 429→503(analyze), 기본 아바타 경로, `X-Crisis`·109, persona 생략 시 샘플, AI 에 보내는 대화 상한 |
| `features.md` | F1 기록 분석, F2 페르소나, F3 아바타, F4 대화, F5 5개 화면. 입력·출력·제약·지연·증거 |
| `hil-gate1.md` | URL 별 체크박스와 항목마다 자동 검증 결과 |
| `run.md` | Gate 1 상태 표, TODO, P2(Critic 4건의 p2 전부), 다음 작업 = Gate 2, 중단·재개 1줄 |
| 그 밖 | `/pocs` 목록의 analysis·persona·chat `ready: true`. 루트 `pnpm test` glob 에 `packages/*/src/**/*.test.ts` 추가(persona.test.ts 가 빠져 있던 문제, `logs/gate1-persona.md` 남은 문제 2) |

## 바꾼 파일

| 파일 | 내용 |
|---|---|
| `packages/core/src/server/http.ts` (새) | `parseRequest(req, schema, { maxBody, tooLarge?, invalid?, prepare? })`, `fail`, `noKey`, `upstreamFail(tag, err, msg, rateLimited?)`, `dataUrlToFile` |
| `packages/core/src/chat/server.ts` (새, server-only) | `chatResponse(data)`: 위기 감지 → 프롬프트 → `streamText` → 첫 청크 대기(시작 전 오류 502) → 109 꼬리 → 헤더. chat route 에 있던 코드를 그대로 옮김 |
| `packages/core/src/server/index.ts` | export 2줄 추가 |
| `packages/core/test/http.test.ts` (새) | parseRequest 4경로, prepare, 429 매핑, data URL 5건 |
| `pocs/app/api/{analyze,chat,persona,persona/avatar}/route.ts` | 얇게 정리. avatar 의 Content-Length 선검사와 기본 캐릭터 import(Next 정적 에셋)는 route 에 남겼다 |
| `pocs/app/pocs/page.tsx` | PoC 3개 ready |
| `package.json` | test glob |
| `docs/dev-v1/{api,features,hil-gate1,run}.md` | 위 내용 |

- 동작 차이 1건(로그 형식만): persona·avatar 의 `console.error` 가 Error 가 아닐 때 객체 대신 `String(err)` 를 찍는다. 응답은 같다.
- 바꾸기 전 route 사본: 세션 scratchpad `api-before/` (레포 밖).

## 회귀 (2026-11-19)

| 검사 | 결과 | 증거 |
|---|---|---|
| `pnpm typecheck` | core·ui·pocs 통과 | |
| `pnpm test` | 32/32 (persona.test.ts 9건, http.test.ts 5건 포함) | `evidence/gate1/integrate-tests.txt` |
| `pnpm lint` | 통과 | |
| `pnpm build` (pocs next build) | 성공 (api 5개 동적, /pocs/screens/[screen] 5개 SSG) | |
| 빌드 뒤 dev 3101 | 재기동 없이 정상 | |
| 경로 | `/`, `/pocs`, `/pocs/{analysis,persona,chat,screens}`, `/pocs/screens/{landing,create,list,modal,chat}`, `/api/health` 200, `/pocs/screens/nope` 404 | |
| 오류 경로 10건 + 413 | 분리 전과 같은 상태·문구 | `evidence/gate1/integrate-api-errors.txt` |
| 실제 호출 | analyze(prompt) 200 30.1s 사건 5 / persona(past-event) 200 21.1s / avatar(합성 사진) 200 29.8s webp / chat 200 4.0s `x-crisis: 0` / 위기 문장 `x-crisis: 1` + 109 1회 | `integrate-analyze-prompt.json`, `integrate-persona-past-event.json` |
| 키 노출 | `.env` 값 6개 바이트 검색, 레포 + `pocs/.next/static` 657파일 0건(값 출력 없음). `NEXT_PUBLIC_` 사용 0, 클라이언트·`pocs/app/pocs` 의 `@mindme/core/server` import 0 | `evidence/gate1/integrate-keyscan.txt` |

## 남은 것

- HIL(`hil-gate1.md`) 미실시. 실제 카카오톡 내보내기 파일, 내 얼굴 아바타, 03 목록 2행 아바타는 사람이 봐야 한다.
- Gate 1 커밋은 Commit 단계.
- P2 는 `run.md` P2 목록. 이번 작업에서는 고치지 않았다(동작 변경 금지).
