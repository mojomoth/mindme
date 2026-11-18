# Gate 2 · ponytail 결함 수정 r1

## P1-1 모달 나이 차 2살 사건 → /api/persona 400

- 원인: `apps/web/lib/data.ts` `nearestEvent` 는 age-2~age 사건을 골랐고, core `personaRequestError` 는 나이 차가 2살 이상이면 400 으로 거른다.
- 수정: 범위를 `at < age - 1` 로 줄여 core 의 ±1살 규칙과 맞췄다(주석도 고침).
- 테스트: `apps/web/lib/data.test.ts` — 1살 차는 고르고 2살 차는 고르지 않는다. 옛 범위(age-2)로 되돌리면 실패하는 것을 확인했다.
  - data.ts 가 `@mindme/ui`(tsx)를 import 해서 node 가 못 읽으니 `mock.module` 로 막았다. 루트 `pnpm test` 에 `--experimental-test-module-mocks` 와 `apps/*/lib/**/*.test.ts` 를 더했다.
- 실제 HTTP(3100, OpenAI 호출): 같은 시나리오(지금 26살, 13살 사건, '친구 서진과 계주 때문에 다툰 일')
  - 모달 15살 → 사건 없음 → 200 `15살의 홍길동`
  - 모달 14살 → evt_01 → 200 `친구와 다툰 날의 홍길동`
  - 증거: `docs/dev-v1/evidence/gate2/fix-ponytail-r1-modal-age-gap.txt`

## P1-2 route 본문 중복(pocs ↔ apps/web)

- `packages/core/src/server/routes.ts` 에 `analyzeRoute`·`personaRoute`·`avatarRoute`·`chatRoute(opts)` 를 두고 `@mindme/core/server` 로 내보냈다.
  - 본문 상한, 413 문구, 키 확인, InputError → 400, 429 → 503, avatar content-length 선검사·기본 캐릭터·Server-Timing 은 모두 여기 한 벌.
  - opts: `invalid`(400 고정 문구), `prepare`(본문 기본값), avatar 는 `defaultAvatar`(앱마다 이미지 import 경로가 달라 앱이 넘긴다).
- 각 앱 route.ts 에는 `dynamic`·`maxDuration` 리터럴과 `export const POST = xxxRoute({...})` 만 남았다(5~11줄). maxDuration 은 앱마다 다르게 둔다(pocs analyze 300, web 60).
- 문구 정리: analyze 413 을 '입력이 너무 길어요. …' 하나로 맞췄다(api.md 반영). pocs avatar 400 은 개발 화면이라 필드 이름 문구를 그대로 넘긴다(api.md 그대로).
- 실제 HTTP(3100·3101): 400(검증·JSON)·413(본문·content-length)·기본 아바타 200·chat 스트림 200 확인.
  - 증거: `docs/dev-v1/evidence/gate2/fix-ponytail-r1-routes.txt`, `fix-ponytail-r1-route-lines.txt`

## 확인

- `pnpm typecheck` 통과, `pnpm lint` 통과, `pnpm test` 40/40 통과.
- dev 서버 3100·3101 은 켜 둔 채로 둔다(hot reload 로 반영).
