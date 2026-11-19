# Gate 3 r2 — web-ui 빌더 작업 로그

- 맡은 항목: ui-web-1, ui-web-2, ui-web-3/ops-13, analysis-5, persona-chat-2 (근거: `gate3r2-triage.md`)
- 실측 스크립트: `docs/dev-v1/evidence/gate3r2/web-ui-measure.mjs <before|after>`
  - 03 목록·05 대화·프로필 시트는 Gate 3 r1 로컬 상태(`evidence/gate3/critic-local-r1-state.json`, 실제로 생성된 페르소나 4개)를 localStorage 에 심어서 띄웠어요. 여기에 긴 이름 2개(띄어쓰기 있는 이름과 없는 이름)를 더했어요.
  - 02 나이 안내는 `page.route` 로 `/api/analyze` 를 가짜 응답으로 바꿔 확인했어요(1번째 `currentAge: null`, 2번째 500). 다른 `/api/**` 는 모두 abort 해서 **AI 호출은 0건**이에요.
  - 뷰포트: 1440x900(데스크톱 목업 안), 390x844, 360x740(DPR 3, 모바일)
  - 결과: `web-ui-before.json`, `web-ui-after.json`, 스크린샷 `web-ui-{before,after}-{list,sheet,create,notice,notice-age}-{desktop,390,360}.png`

## 항목별 결과

### ui-web-1 — 목록 카드·프로필 시트 제목이 어절 중간에서 줄바꿈됨 → 고침

- 재현(before): 화면에 보이는 줄에서 어절 중간 줄바꿈이 나왔어요.
  - 360: 제목 `간 첫날/의 서하`, `근한 날/의 서하`, 미리보기 `들 사투/리를`, `굴 보기/가 너무`, `걸고 첫/날 버텼`, 시트 제목 `독인 날/의 서하`
  - 390·1440: 제목 `를 다독/인 날의`, 미리보기 `칸 밖으/로 넘치`, ` 네 말/이 마음`, `기가 너/무 미안`, `첫날 버/텼다`, 시트 제목 `날의 서/하린`
- 변경: `PersonaList.module.css` 의 `.text strong, .text span` 에 `word-break: keep-all; overflow-wrap: anywhere;`, `ProfileSheet.module.css` 의 `.title` 에 `word-break: keep-all;` 을 더했어요(`overflow-wrap: anywhere` 는 원래 있었어요).
- 확인(after): 세 뷰포트 모두 띄어쓰기가 있는 글은 공백에서만 줄이 바뀌어요. 띄어쓰기 없는 28자 이름만 의도대로 글자 단위로 끊기고(`overflow-wrap: anywhere`), 가로로 넘친 요소는 0개예요. 두 줄 말줄임도 그대로예요.

### ui-web-2 — 프로필 시트의 '이름' 영역과 '이름' 입력란이 겹쳐 읽힘 → 고침

- 재현(before): 세 뷰포트 모두 `getByLabel('이름', {exact:true})` 2개, `getByRole('region', {name:'이름'})` 1개였어요. ariaSnapshot 은 `region "이름" > textbox "이름"` 이었어요.
- 변경: `ProfileSheet.tsx` 첫 section 의 `aria-label="이름"` 을 지웠어요. 나머지 두 section('성격과 말투', '기억과 감정')은 그대로예요.
- 확인(after): 세 뷰포트 모두 label 1개, region 0개였어요. 남은 region 은 '성격과 말투', '기억과 감정' 두 개예요.

### ui-web-3 / ops-13 — 모바일에서도 목업 PNG 를 내려받음 → 고침

- 재현(before): `mockup-iphone` 응답이 360·390·1440 모두 1건이었어요(모바일에서는 img 가 `display:none` 인데도 받음).
- 변경: `PhoneFrame.tsx` 의 img 를 `<picture>` 로 감싸고 `<source media="(max-width: 600px)">` 를 두었어요. 기준 폭은 `PhoneFrame.module.css` 미디어쿼리와 같은 600px 이에요.
  - 트리아지 안의 `srcSet="data:,"` 를 먼저 써 봤더니 모바일 콘솔에 `Failed to load resource: net::ERR_INVALID_URL` 오류가 4번 찍혔어요. 그래서 1x1 투명 GIF data URL 로 바꿨고, 이제 오류는 0건이에요.
- 확인(after):
  - `mockup-iphone` 응답: 360 **0건**, 390 **0건**, 1440 **1건**
  - 데스크톱 화면: 수정 전후 `create-desktop`·`notice-desktop` 스크린샷이 **바이트 단위로 같아요**(`cmp` 일치 → 픽셀 차이 0). 모바일 `create`·`notice` 스크린샷도 전후가 같아요.
  - 390 으로 열었다가 1440 으로 넓히면 목업을 그때 1건 받아서 정상으로 보여요.
  - pocs(3101 `/pocs/screens`)도 같은 PhoneFrame 을 써요. 390 0건, 1440 1건이고 콘솔 오류는 없어요(pocs 파일은 고치지 않았어요).

### analysis-5 — '지금 나이를 찾지 못했어요' 안내가 나이를 적은 뒤에도 남음 → 고침

- 재현(before): 가짜 `/api/analyze`(currentAge null)로 안내를 띄운 뒤에 확인했어요.
  - (1) 나이 '26' 을 입력해도 `role=alert` 가 1개 남았어요.
  - (2) 같은 입력으로 다시 만들어 안내를 띄운 뒤, 이야기만 바꿔 다시 만들고 → 분석 500 실패 → '입력 화면으로' 를 누르면 지난 안내가 1개 남았어요.
- 변경: `MindmeApp.tsx` 의 `onAgeChange` 를 `(v) => { setAge(v); setNotice(undefined); }` 로 바꾸고, `createFirst` 첫 줄에 `setNotice(undefined)` 를 넣었어요.
- 확인(after): 세 뷰포트 모두 (1) 0개, (2) 0개였어요. 나이를 끝내 못 찾으면 안내가 다시 뜨는 것도 그대로예요(스크립트의 (2) 단계에서 다시 뜨는 것을 기다려 확인).

### persona-chat-2 — 첫 생성 흐름에서 같은 이름 페르소나가 생김 → 고침

- 재현: `data.test.ts` 에 15살 명사형 제목 사건 2개('민수와 크게 다툼', '반장 선거에서 떨어짐')와 17살 사건 1개를 넣었더니 `['15살의 홍길동', '15살의 홍길동', '17살의 홍길동']` 이 나와 테스트가 실패했어요.
- 변경: `apps/web/lib/data.ts` `pickEvents` 에서 고를 때마다 이름(`plainName(personaName('past', age, name, title))`, 서버·04 모달 `sameNamed` 와 같은 규칙)이 이미 고른 것과 같으면 건너뛰어요. 나이 우선 1차 루프와 2차 채우기 루프 둘 다에 적용했어요. 1차 루프에도 넣은 이유는 나이가 달라도 제목이 같으면('…날') 이름이 같아지기 때문이에요. 모자라면 지금처럼 createFirst 가 '지금의 나'로 채워요.
- 확인: 같은 테스트가 `['15살의 홍길동', '17살의 홍길동', '반장 선거에서 떨어진 날의 홍길동']` 로 통과해요(같은 나이라도 '…날' 제목이면 이름이 달라 고름).
- `MindmeApp.tsx` 는 이 항목 때문에 바꾸지 않았어요.

## 바꾼 파일

- `packages/ui/src/screens/PersonaList.module.css` (ui-web-1)
- `packages/ui/src/screens/ProfileSheet.module.css` (ui-web-1)
- `packages/ui/src/screens/ProfileSheet.tsx` (ui-web-2)
- `packages/ui/src/PhoneFrame.tsx` (ui-web-3/ops-13)
- `apps/web/app/MindmeApp.tsx` (analysis-5)
- `apps/web/lib/data.ts`, `apps/web/lib/data.test.ts` (persona-chat-2)

## 검사 (레포 루트, Node 26)

- `pnpm typecheck` → 통과(core·ui·web·pocs)
- `pnpm test` → 49개 통과, 실패 0(다른 빌더의 테스트 포함)
- `pnpm lint` → 통과(web·pocs)

## 남은 문제

- UI 동작(줄바꿈·aria·목업 요청·안내 지우기)은 컴포넌트 테스트 환경이 없어서 단위 테스트로 고정하지 못했어요. 대신 `web-ui-measure.mjs` 를 다시 실행하면 같은 값을 확인할 수 있어요(dev 서버 3100 필요, AI 호출 없음).
- `onAgeChange` 는 나이 안내뿐 아니라 같은 `notice` 를 쓰는 파일·사진 오류 문구도 지워요. 사용자는 이미 문구를 본 뒤라 문제는 없다고 봤어요.
- 02 화면 '나의 이야기' textarea 의 줄바꿈(`기/억나요`)은 이번 범위(03 목록·시트 제목) 밖이라 그대로 두었어요.
