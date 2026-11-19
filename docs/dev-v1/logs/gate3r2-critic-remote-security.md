# Gate 3 r2 배포 Critic: 보안·제약 (remote-security)

- 대상: https://mindme-rho.vercel.app (프로덕션, 배포 `dpl_GPR9o3pKk6TqFWQ8wbpzgA5n469g`, 함수 리전 iad1)
- 시각: 2026-11-19 07:25~07:35 UTC
- 방식: 구현자 설명 없이 배포 URL의 실제 응답만 보고 판정했다. 레포 코드는 읽기만 하고 고치지 않았다.
- AI 호출: `/api/analyze` 큰 입력 1회만 했다. `/api/persona/avatar`는 부르지 않았고, 429 실측도 하지 않았다.
- 키 규칙: `.env` 값은 파이썬이 직접 읽어 메모리에서만 비교하고 '키 이름: 건수'만 출력했다. VERCEL_KEY는 Authorization 헤더에만 넣었다.

## 판정 요약

| id | 판정 | 등급 | 한 줄 |
|---|---|---|---|
| sec-keys | PASS | - | HTML 14경로, JS 9개, CSS 2개, PNG 8개, API 응답 9개(헤더 포함) 등 42개 2.48MB에서 `.env` 값 7종이 모두 0건이다. `sk-` 토큰 모양과 `NEXT_PUBLIC_`도 0건이고, 소스맵은 403이다 |
| sec-upload | PASS | - | 배포 소스 189개 파일에 `.env`·`.env.*`가 없다. `/src/docs`·`/src/.claude`·`/src/scripts`는 파일 0개짜리 디렉터리 이름만 남았다. 업로드된 파일 189개의 내용도 키 값 0건이다 |
| sec-old-deploy | PASS | - | 프로젝트의 배포는 지금 배포 1개뿐이고, r1 배포(`dpl_EP41jr…`)는 404(삭제됨)다. `/_src`는 307 → vercel.com 로그인으로 가며, 공개 소스는 꺼져 있다(publicSource null) |
| sec-env | PASS | - | 프로젝트 환경 변수는 `OPENAI_API_KEY` 하나(type sensitive, production 전용)다. `NEXT_PUBLIC_` 변수는 없다 |
| sec-headers | PASS | - | Permissions-Policy `camera=(self), microphone=(), geolocation=()`가 HTML·404·API·정적 파일에 모두 붙는다. http는 308로 https로 넘어가고 HSTS는 2년 preload다. 정적 파일은 1년 immutable이고 API는 CDN MISS다 |
| sec-headers-p2 | FAIL | P2 | API JSON 응답(분석 결과처럼 개인 내용이 담긴 응답)이 `public, max-age=0, must-revalidate`로 나간다. `X-Content-Type-Options`·`frame-ancestors`(X-Frame-Options)·`Referrer-Policy`가 없다 |
| sec-cross-site-post | FAIL | P2 | 서버가 Content-Type을 보지 않는다. `text/plain` 본문도 JSON으로 읽으므로, 다른 사이트가 방문자 브라우저로 preflight 없는 POST를 보내 AI 비용을 쓰게 할 수 있다 |
| lim-analyze-big | PASS | - | 59,033자(정리 본문 44,331자) → 200, 42.8초, mode summarized, 2구간, `owner.currentAge` 31(기대 31)이다. 사건 나이 26·27·28도 95년생과 맞고, `meta.llm`은 없다 |
| lim-413 | PASS | - | 5MB 본문은 Vercel이 0.5~0.7초 만에 413 `FUNCTION_PAYLOAD_TOO_LARGE`(text/plain)로 끊는다. 실제 클라이언트 모듈과 Chromium에서 모두 '보낸 내용이 너무 커요. 조금 줄여서 다시 해 주세요.'가 나온다 |
| lim-stateless | PASS | - | 서버 코드에 파일 쓰기가 없다. 읽기는 번들 에셋 PNG를 `readFile`로 읽는 1곳뿐이다. 사진은 메모리에서만 쓰고, 속도 제한 기록도 메모리 Map에만 둔다 |
| lim-ratelimit | PASS(코드) | - | analyze는 10분에 10회, persona 30회, avatar 15회, chat 100회다(IP 기준, 고정 창). 인스턴스마다 따로 세는 한계는 코드 주석에 적혀 있다 |
| info-r1-env | 정보 | - | r1 배포에 올라갔던 `/src/.env`는 배포를 지워서 없어졌다. 키를 교체할지는 triage대로 사용자가 정한다(HIL) |

전체 판정은 PASS다. P0와 P1은 없고 P2가 2건이다.

## 1) 키 노출

스크립트: `remote-security-scripts/crawl_keys.py` · 결과: `remote-security-crawl.json`

- HTML 경로 14개: `/`, `/?x=1`, `/index`, `/does-not-exist-xyz`, `/_not-found`, `/api`, `/robots.txt`, `/favicon.ico`, `/.env`, `/src/.env`, `/_src`, `/_logs`, `/.git/config`, `/package.json`
  - `/.env`·`/src/.env`·`/.git/config`·`/package.json`은 모두 404(Next 404 페이지)다.
  - `/_src`·`/_logs`는 vercel.com 로그인 페이지로 리디렉션된다. 크롤러가 그 로그인 페이지 HTML에서 `/_next/static/...` 경로를 뽑아 배포 도메인에 요청했기 때문에 404가 여러 건 찍혔다. 앱 자산과는 관계없다.
- 정적 자산: HTML이 참조하는 파일과 JS·CSS 안에서 다시 참조하는 파일을 재귀로 모았다. JS 9개, CSS 2개, PNG 8개 모두 200이다.
- 소스맵: JS 9개의 `.map`이 모두 403이다.
- API 응답 본문과 헤더: `GET /api/health`, `GET /api/chat`(405), `POST /api/chat`(깨진 JSON·스키마 오류·text/plain), `POST /api/persona`(스키마 오류), `GET /api/persona`·`GET /api/analyze`(405), `GET /api/nope`(404)
- 검색어: `.env` 값 7종(JEV_KEY, GOOGLE_KEY, OPENAI_KEY, CLAUDE_KEY, VERCEL_KEY, RENDER_KEY, OPENROUTER_KEY)마다 전체 값, 앞 16자, 뒤 16자, base64, sha256 hex를 찾았다. `sk-[A-Za-z0-9_-]{20,}`, Google·Anthropic·OpenRouter·GitHub 토큰 모양, `NEXT_PUBLIC_`, `OPENAI_API_KEY`, `process.env`, `apiKey`, `Bearer `도 찾았다.
- 결과는 모두 0건이다. analyze 큰 입력 응답과 413 응답, 헤더 기록, 이 증거 파일들도 다시 검사했는데 키 값 0건, `sk-` 모양 0건이다(`scan_files.py`).
- `/api/health` 본문은 `{"ok":true,"configured":{"openai":true}}`다. 키 값·길이·접두사는 없다.

## 2) 배포 소스 업로드

스크립트: `remote-security-scripts/vercel_audit.py`, `vercel_tree.py` · 결과: `remote-security-vercel.json`, `remote-security-deploy-tree.txt`

- `GET /v6/deployments/dpl_GPR9o3pKk6TqFWQ8wbpzgA5n469g/files`: 파일 189개
  - 경로에 `.env`가 들어간 항목은 0개다(`.env.example` 포함).
  - `/src/docs`, `/src/.claude`, `/src/scripts`는 자식이 0개인 디렉터리 항목만 있다. 문서·로그·증거 파일은 올라가지 않았다.
  - 업로드된 `/src/...` 파일 189개의 내용을 `/v7/deployments/.../files/{uid}`로 내려받았다(11.76MB). 메모리에서 `.env` 값 7종과 비교했더니 모두 0건이고, `sk-` 모양도 0건이다.
  - 빌드 산출물(`/out`)에는 `index`, `_not-found`, `_global-error`, `api/{analyze,chat,health,persona,persona/avatar}`만 있다. `pocs` 소스는 올라갔지만 라우트가 아니어서 `/pocs`·`/pocs/analysis`·`/pocs/chat`은 404다.
- `GET /v6/deployments?projectId=prj_wNu3xymebkbMHdLGXYgeXlmA4tqa`: 배포는 1개(지금 배포, READY, production, cli)뿐이다.
- r1 배포 `dpl_EP41jrGmPNjfxMW8xkqtCwxpjm9e`: `/v13/deployments`와 `/files` 모두 404 not_found다. 삭제가 확인됐다.
- 프로젝트 설정: rootDirectory `apps/web`, publicSource null, directoryListing false, passwordProtection 없음, Node 24.x, 리전 iad1
- 프로젝트 환경 변수(이름·종류만 확인): `OPENAI_API_KEY` sensitive, production 전용. `NEXT_PUBLIC_` 변수는 없다.
- `https://mindme-rho.vercel.app/_src`: 307 → `https://vercel.com/deployments/mindme-rho.vercel.app/source` → `vercel.com/login`(제목 'Login – Vercel'). 공개 소스가 아니다. `/_logs`도 같다.

## 3) 헤더

결과: `remote-security-headers.txt`, `remote-security-crawl.json`의 `api`

- `http://mindme-rho.vercel.app/` → 308 → `https://mindme-rho.vercel.app/`
- `strict-transport-security: max-age=63072000; includeSubDomains; preload`(모든 응답)
- `permissions-policy: camera=(self), microphone=(), geolocation=()`: `/`, 404, `/api/health`, `/api/chat` 400, JS·CSS·PNG, analyze 200 응답에서 모두 확인했다.
- 캐시
  - HTML: `public, max-age=0, must-revalidate`, `x-vercel-cache: HIT`(프리렌더), `x-nextjs-stale-time: 300`
  - `/_next/static/immutable/*`: `public,max-age=31536000,immutable`(해시 이름이라 맞다)
  - API: `public, max-age=0, must-revalidate`, `/api/health`는 `x-vercel-cache: MISS`다. s-maxage가 없어 CDN이 저장하지 않는다.
  - chat 스트림의 `Cache-Control: no-store`는 코드(`chat/server.ts:52`)로 확인했다. r1 실측과 같다.
- CORS: HTML·정적 파일에는 Vercel 기본값 `access-control-allow-origin: *`가 붙는다. API 응답에는 ACAO가 없다. `OPTIONS /api/chat`(Origin evil.example)은 204인데 ACAO가 없어 브라우저가 막는다.
- `x-powered-by`는 없다. 로컬 dev(:3100)에는 `X-Powered-By: Next.js`가 있지만 배포에는 없다.

## 4) 제약 실측

### /api/analyze 큰 입력 1회

스크립트: `remote-security-scripts/big.mjs` · 결과: `remote-security-analyze-big.json`, `remote-security-analyze-big-response.json`

- 입력: 합성 카톡 PC 형식 TXT 59,033자, 메시지 1,575개, 2021-01~2023-11. 나는 '정다온'이다.
  - 나이 단서는 29,669자 위치의 `[정다온] [오후 9:31] 나 95년생이야` 한 줄뿐이다. 잡담에는 나이·연도 단서가 없다.
  - 심어 둔 사건은 3개다: 2021-03 이직 첫 출근, 2022-07 첫 자취 이사, 2023-09 전사 발표 자책.
  - 미리 계산하니 정리 본문이 44,331자(> DIRECT_CHARS 40,000)여서 summarized 경로, 2구간이 예상됐다. 나이 줄은 0번 구간에 들어간다.
- 결과: HTTP 200, 42,760ms, `x-vercel-id icn1::iad1::…`
  - `meta`: mode `summarized`, chunks 2, units 1575, participants [정다온, 한유진], me 정다온. `meta.llm`은 없다.
  - `owner`: name 정다온, **currentAge 31**(2026 − 1995 = 31). 구간 요약을 거친 뒤에도 나이 단서가 살아 있다.
  - events: `2021-03-17 age=26`, `2022-07-02 age=27`, `2023-09-23 age=28`. 3개 모두 찾았고 나이도 95년생 기준과 맞다.
  - 응답 cache-control은 `public, max-age=0, must-revalidate`이고 ACAO는 없다.
- 참고: 30만 자 최악 시간은 이번에 재지 않았다. 코드 주석은 약 250초 < maxDuration 300초라고 적고 있다.

### 413(본문 4.5MB 초과)

스크립트: `remote-security-scripts/p413.mjs`, `pw413.mjs` · 결과: `remote-security-413.json`

- Node: 실제 클라이언트 모듈 `apps/web/lib/api.ts`의 `postJson`으로 배포 `/api/chat`에 5,000,056바이트를 1회 보냈다.
  - 원래 응답: 413, `text/plain; charset=utf-8`, `x-vercel-error: FUNCTION_PAYLOAD_TOO_LARGE`, 본문 'Request Entity Too Large…', 698ms
  - 클라이언트가 던진 문구: **'보낸 내용이 너무 커요. 조금 줄여서 다시 해 주세요.'**(`errorText`도 같다)
- Chromium(Playwright): 배포 페이지 출처에서 5MB를 1회 POST했다.
  - 연결이 끊기지 않고 413 응답이 왔다(516ms). `api.ts`의 `post()` 규칙을 그대로 따르면 같은 한국어 문구가 나온다.
  - 배포 JS 9개 중 1개에 이 문구가 실제로 들어 있다.
- 화면 연결: `MindmeApp.tsx` 276·330·385행이 `errorText(err)`로 오류 화면과 채팅 오류를 보여 준다.
- 실제로 4.5MB에 닿을 수 있는지: 클라이언트가 파일을 30만 자로 막는다. 한글이면 JSON 약 0.9MB다. 채팅은 100개 × 4,000자라 1.2MB 미만이고, 사진은 768px JPEG로 줄인다. 보통 사용으로는 닿기 어렵고, 닿더라도 한국어로 안내된다.
- 1MB~4.5MB 구간은 함수 자체의 413 JSON(한국어 `error.message`)이 처리한다(`http.ts` parseRequest).

### 서버 무상태(코드)

- `packages/core/src`, `apps/web/app`, `apps/web/lib`, `packages/ui/src`에 `writeFile`·`appendFile`·`createWriteStream`·`mkdir`·`/tmp`·KV·Blob·DB 사용이 없다.
- `node:fs`는 `persona/server.ts`가 스타일 참조 PNG를 `readFile`로 읽을 때만 쓴다(읽기 전용).
- 사진은 `dataUrlToFile` → `editImage`로 메모리에서만 다룬다. 저장하지 않는다.
- 상태는 속도 제한 `hits` Map(메모리, 최대 1만 키) 하나뿐이다. 응답에 `set-cookie`도 없다.

## 5) 속도 제한(코드만, 429 실측 안 함)

- `apps/web/app/api/*/route.ts`: analyze `rateLimit('analyze', 10, 600_000)`, persona `30`, avatar `15`, chat `100`. 모두 10분 고정 창이다.
- 키는 `x-forwarded-for` 첫 값이다. Vercel이 이 헤더를 덮어써서 외부 값을 넘기지 않는다고 문서화돼 있어, 위조로 한도를 피하기는 어렵다고 본다(실측하지 않음).
- 잘못된 요청(400)도 횟수에 들어간다. 그래서 이번에는 analyze 오류 본문 검사를 하지 않았다.
- 인스턴스마다 따로 세서 인스턴스가 여럿이면 한도도 늘어나고, 콜드 스타트면 초기화된다. 이 한계는 `http.ts` 주석에 '공개 배포용 최소 보호'로 적혀 있다.

## 발견(P2)

### P2-1 API 응답 캐시 지시와 기본 보안 헤더

- 사실
  - `/api/analyze` 200 응답(분석한 사건·이름·나이)과 오류 응답이 `cache-control: public, max-age=0, must-revalidate`로 나간다.
  - 응답 전체에 `X-Content-Type-Options: nosniff`, `X-Frame-Options`(또는 CSP `frame-ancestors`), `Referrer-Policy`가 없다.
- 영향: POST 응답이고 max-age=0이라 공유 캐시가 재사용할 가능성은 낮다. 그래도 개인 내용이 담긴 응답이 `public`으로 표시된다. 다른 사이트가 이 앱을 iframe에 넣는 것도 막지 않는다. 로그인이 없고 데이터가 브라우저 localStorage에 있어 실제 피해 경로는 좁다.
- 제안: API 응답에는 `Cache-Control: no-store`를 붙인다(chat처럼). `next.config.ts` headers에 `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`(또는 `Content-Security-Policy: frame-ancestors 'none'`), `Referrer-Policy: strict-origin-when-cross-origin`을 더한다.

### P2-2 Content-Type을 보지 않아 다른 사이트에서 보낸 POST도 처리한다

- 사실: `POST /api/chat`에 `content-type: text/plain`, 본문 `"x"`를 보냈더니 400 '대화 내용을 보내지 못했어요…'(스키마 오류)가 왔다. JSON으로 읽었다는 뜻이다. `parseRequest`(`http.ts:33~38`)는 `req.text()` → `JSON.parse`만 하고 Content-Type·Origin·`Sec-Fetch-Site`를 보지 않는다.
- 영향: `text/plain` POST는 브라우저가 preflight 없이 보낸다. 그래서 다른 사이트가 방문자 브라우저로 `/api/analyze`(30만 자)·`/api/chat`을 몰래 부르게 할 수 있다. 응답은 못 읽지만 AI 비용은 나간다. 방문자 IP마다 한도가 따로라 IP 기준 제한도 나뉘어 빠져나간다. 공개 API라 curl로 직접 부르는 것과 성격은 같지만, 방문자 수만큼 IP가 늘어난다는 점이 다르다.
- 제안: `parseRequest` 앞에서 `content-type`이 `application/json`이 아니면 415로 거른다. 그러면 다른 출처의 요청은 preflight를 거쳐야 하고, ACAO가 없어 막힌다. 또는 `Sec-Fetch-Site`가 `cross-site`인 요청을 403으로 거른다. 같은 출처 웹 앱은 이미 `Content-Type: application/json`을 보내므로(`api.ts:10`) 영향이 없다.

## 범위 밖 메모

- 계정 전체 프로젝트도 훑었다. mindme 프로젝트에는 `.env`가 든 배포가 0개다.

## 증거

- `docs/dev-v1/evidence/gate3r2/remote-security-crawl.json`: 키 검색(건수만), 정적 자산 목록, 소스맵, API 오류 본문
- `docs/dev-v1/evidence/gate3r2/remote-security-vercel.json`: 프로젝트 설정, 환경 변수 이름·종류, 대상 배포 파일·내용 검사, 배포 목록
- `docs/dev-v1/evidence/gate3r2/remote-security-deploy-tree.txt`: 대상 배포 파일 트리 경로, r1 배포 404
- `docs/dev-v1/evidence/gate3r2/remote-security-headers.txt`: 헤더 실측
- `docs/dev-v1/evidence/gate3r2/remote-security-analyze-big.json`, `remote-security-analyze-big-response.json`: 큰 입력 analyze 1회
- `docs/dev-v1/evidence/gate3r2/remote-security-413.json`: 5MB 413(Node 실제 클라이언트 모듈, Chromium)
- `docs/dev-v1/evidence/gate3r2/remote-security-scripts/`: 위 스크립트 전부(키 값 없음, 실행할 때 `.env`를 직접 읽음)
