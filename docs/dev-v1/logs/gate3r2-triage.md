# Gate 3 r2 — 열린 P2 재분류 (2026-11-19)

워크플로 `gate3r2-triage`(4개 영역 병렬, 읽기 전용)가 run.md P2 목록을 현재 코드·실행으로 다시 확인했다. 원본: `evidence/gate3r2/triage.json`.

| id | 상태 | 영향 | 등급 | 비용 | 결정 | 항목 |
|---|---|---|---|---|---|---|
| ui-web-1 | OPEN | web | P2 | S | FIX_NOW | 03 목록 카드 제목·미리보기, 프로필 시트 제목이 어절 중간에서 줄바꿈된다(word-break: keep-all 없음, Gate 3) |
| ui-web-2 | OPEN | web | P3 | S | FIX_NOW | 프로필 시트에서 section aria-label='이름'과 입력란 라벨 '이름'이 겹친다(Gate 3) |
| ui-web-3 | OPEN | web | P2 | S | FIX_NOW | 모바일에서도 목업 PNG 263KB를 받는다(PhoneFrame img가 display:none이어도 다운로드됨, Gate 3 감사 P2-6) |
| ui-web-4 | OPEN | web | P2 | L | FIX_NOW | Pretendard 폰트 전체본 2.06MB를 모바일·데스크톱 모두 첫 방문에 받는다(tokens.css @font-face, Gate 3 감사 P2-7) |
| ui-web-5 | PARTIAL | web | P2 | M | DEFER | 02 만들기 모바일 첫 화면에서 사진 카드가 생성 버튼 뒤에 있다(Gate 2 visual과 Gate 3 중복, 360x740만 남음) |
| ui-web-6 | PARTIAL | web | P3 | M | DEFER | 화면 CSS에 hex 리터럴 색이 남아 있다(Gate 2 visual: 새 화면, Gate 3: 기존 화면) |
| ui-web-7 | OPEN | web | P3 | S | DEFER | 데스크톱 02에서 끝까지 스크롤하면 마스코트 발·말풍선 아래가 상태바 경계에서 잘린다(Gate 2 visual) |
| ui-web-8 | FIXED | web | P3 | S | DEFER | 03 목록 하단 안내 '다른 순간의 나도 만나보세요'가 생성 버튼에 가린다(Gate 1 원문 03 360px와 Gate 2 visual 중복) |
| ui-web-9 | FIXED | web | P3 | S | DEFER | 04 모달 상황 설명·프로필 시트(·05 입력창) 입력란이 안에서 스크롤될 때 줄이 반쯤 보인다(Gate 2 visual) |
| ui-web-10 | FIXED | web | P3 | S | DEFER | 긴 이름(20자)에서 말줄임이 이름 가운데에 두 번 들어간다(Gate 2 visual) |
| ui-web-11 | OPEN | web | P3 | L | DEFER | 시각 취향: 둥근 제목 서체·그라데이션 CTA·배경 질감이 없다(Gate 1 screens 배경·CTA 단색과 Gate 3 시각 취향 중복) |
| ui-web-12 | OPEN | web | P3 | S | DEFER | 시각 취향: 04 모달에 드래프트에 없는 안내 상자, 05 입력창 포커스 테두리(Gate 3) |
| analysis-1 | OPEN | web | P2 | S | FIX_NOW | analysis 파서: 여러 줄 메시지 속 날짜 구분선 모양 줄('2019년 3월 2일 토요일')을 구분선으로 잘못 읽음 (Gate 1) |
| analysis-2 | OPEN | web | P3 | S | FIX_NOW | analyze 400 문구: 30만 1자 입력을 '기록 내용을 읽지 못했어요'로 안내함, api.md 의 413 과도 다름 (Gate 3) |
| analysis-3 | OPEN | web | P2 | S | FIX_NOW | analyze 큰 입력(summarized)에서 owner.currentAge 가 null: 구간 요약이 나이 단서를 버림 (Gate 3) |
| analysis-4 | OPEN | pocs | P3 | S | DEFER | analysis 입력 UX(PoC): 30만 자 초과 시 안내 없이 버튼만 꺼지고, 다른 파일을 올려도 이전 오류 문구가 남음 (Gate 1) |
| analysis-5 | OPEN | web | P3 | S | FIX_NOW | analysis 입력 UX(web): '기록에서 지금 나이를 찾지 못했어요' 안내가 나이를 적은 뒤에도 남음 ('이전 오류 문구 잔존'의 web 잔여분) |
| analysis-6 | PARTIAL | pocs | P3 | S | DEFER | 오류 문구에 zod 영어 문구 섞임 (analysis·chat 수정 폼·API 400, Gate 1) |
| analysis-7 | OPEN | pocs | P2 | M | DEFER | 다시 분석하면 직접 고친 사건이 확인 없이 사라지고, 출처가 다른 기록이 합쳐지지 않음 (Gate 1) |
| analysis-8 | OPEN | pocs | P2 | S | DEFER | 프라이버시: localStorage 'mindme:analysis:last' 에 분석 원문(최대 30만 자)이 평문으로 남음 (Gate 1 + Gate 3 중복) |
| analysis-9 | OPEN | pocs | P3 | S | DEFER | PoC 파일 선택 버튼이 브라우저 기본 영어 'Choose File / No file chosen' (Gate 1) |
| persona-chat-1 | PARTIAL | web | P1 | S | FIX_NOW | 위기 감지: 돌려 말한 표현을 놓치고 마지막 user 메시지만 본다 (Gate 1) |
| persona-chat-2 | PARTIAL | web | P2 | S | FIX_NOW | 같은 이름 페르소나 중복: 모달은 해결, 첫 생성 흐름은 남음 (Gate 2→Gate 3) |
| persona-chat-3 | OPEN | web | P2 | S | FIX_NOW | 기록이 적을 때 설정 문구가 memories 로 새어 나온다 (Gate 1) |
| persona-chat-4 | OPEN | web | P3 | S | FIX_NOW | persona 400 문구에 필드 이름이 드러난다('…events 에서 찾지 못했어요') (Gate 3) |
| persona-chat-5 | OPEN | docs | P3 | S | FIX_NOW | api.md /api/chat: 'persona 없으면 샘플'이 apps/web 의 실제 400 과 다르다 (Gate 3) |
| persona-chat-6 | OPEN | web | P3 | S | FIX_NOW | present: age 와 profile.currentAge 가 같은지 서버가 검사하지 않는다 (Gate 1) |
| persona-chat-7 | OPEN | web | P2 | S | DEFER | 아바타 나이 차이가 약하다 (Gate 1 '8·34·60살' = Gate 3 '15·18·24·40살') |
| persona-chat-8 | FIXED | web | P2 | S | DEFER | chat persona.name 프롬프트 주입: 이름이 정보 블록 밖에 들어감 (Gate 1) |
| persona-chat-9 | FIXED | web | P3 | S | DEFER | 시스템 프롬프트 문구가 클라이언트 번들에 들어 있다 (Gate 1) |
| persona-chat-10 | FIXED | web | P2 | S | DEFER | persona past: 나이와 선택 사건 나이 불일치 통과, 미래 지식 누출 (Gate 1) |
| persona-chat-11 | FIXED | web | P2 | S | DEFER | 기본 아바타 해시 경로가 localStorage 에 저장된다 (Gate 1) |
| persona-chat-12 | FIXED | web | P2 | S | DEFER | 재시도 때 이미 그린 아바타를 다시 그린다 (Gate 2→Gate 3) |
| ops-1 | OPEN | deploy | P2 | S | DEFER | 함수 리전 iad1(미국 동부)이라 대화 첫 글자가 1.3~5.5초 걸린다는 지적 (Gate 3, report '서울 리전') |
| ops-2 | PARTIAL | deploy | P2 | S | DEFER | 함수별 maxDuration 실제 적용값 미확인 (Gate 3) |
| ops-3 | FIXED | deploy | P2 | S | DEFER | analyze maxDuration 60초인데 입력 상한이 30만 자라는 지적 (Gate 2 ponytail) |
| ops-4 | OPEN | deploy | P2 | L | DEFER | 속도 제한이 인스턴스 메모리 기반이라 완벽하지 않음 (Gate 3) |
| ops-5 | FIXED | web | P2 | S | DEFER | 아바타 생성 시간 편차 25~74초 vs 함수 한도 120초 (Gate 3, Gate 1 '아바타 30~35s Vercel 시간 한도 확인') |
| ops-6 | OPEN | web | P2 | S | DEFER | 얼굴 사진이 localStorage 'mindme:photo' 에 평문으로 남음 (Gate 3, PoC 'mindme:analysis:last' 는 Gate 1·3) |
| ops-7 | OPEN | web | P2 | S | DEFER | safe-area 실기기 미확인 (Gate 0·Gate 3) |
| ops-8 | OPEN | web | P3 | S | DEFER | 감사 P2-1: pocs 목업 전용 아바타 2장이 apps/web 빌드에 포함 |
| ops-9 | OPEN | web | P3 | S | DEFER | 감사 P2-2: 앱이 부르지 않는 아바타 기본값 분기(guide-face-512 빌드 포함) |
| ops-10 | OPEN | web | P3 | S | DEFER | 감사 P2-3: 보내는 쪽이 없는 요청 필드 PersonaGenerateRequestSchema.event |
| ops-11 | OPEN | web | P3 | S | FIX_NOW | 감사 P2-4: PersonaResponseSchema·PersonaResponse 가 코드에서 안 쓰임 |
| ops-12 | OPEN | web | P3 | S | DEFER | 감사 P2-5: core personaName 자르기를 앱 plainName 이 다시 바꾸는 우회 |
| ops-13 | OPEN | web | P2 | S | FIX_NOW | 감사 P2-6: 모바일에서도 데스크톱 목업 PNG 263KB 를 내려받음 |
| ops-14 | OPEN | web | P2 | L | FIX_NOW | 감사 P2-7: 폰트 Pretendard 전체본 2.06MB 를 첫 방문에 받음 |
| ops-15 | OPEN | deploy | P3 | S | DEFER | 감사 P2-8: 루트 pnpm build 가 pocs 를 빌드 |
| ops-16 | OPEN | web | P3 | S | DEFER | 감사 P2-9: 기본값만 쓰는 화면 옵션(PersonaModal minAge·maxAge, PersonaCreate storyMax) |
| ops-17 | FIXED | web | P3 | S | DEFER | 감사 P2-10: 빈 환경 변수(MINDME_*_MODEL=)면 모델 이름이 빈 문자열 |
| ops-18 | OPEN | web | P3 | S | DEFER | 감사 P2-11: 모달의 sameNamed·createFromModal 이 같은 계산을 두 번 함 |
| ops-19 | OPEN | pocs | P3 | S | DEFER | 감사 P2-12·13: pocs 옛 저장 모양 호환 코드와 수동 실행 스크립트(fixtures/persona/*.mjs) |
| ops-20 | OPEN | docs | P3 | S | FIX_NOW | 감사 P2-14: .env.example 이 코드가 읽는 키와 다름 |
| ops-21 | FIXED | docs | P3 | S | DEFER | 감사 P2-15: report.md '버전 고정' 표가 지운 의존성을 가리킴 |

## 메인 결정으로 바꾼 것

- ui-web-6: DEFER — 메인 결정: P3 코드 위생. 46곳을 바꿔도 사용자가 얻는 것이 없어 이번 배포에서 뺀다
- ui-web-4: FIX_NOW — 메인 결정: 모바일 첫 로드 3.1MB 중 66%. unicode-range 분할은 같은 글꼴 전체를 유지하므로 글자 범위 판단이 필요 없다
- ops-14: FIX_NOW — ui-web-4 와 같음

## 새로 찾은 P1 (메인 세션)

- NEW-deploy-env: Gate 3 r1 배포본(dpl_EP41jr…)의 배포 소스에 루트 `.env`(실제 키 파일)가 `/src/.env` 로 올라가 있었다. Vercel CLI 는 `.gitignore` 를 읽지 않는다. 공개 소스는 꺼져 있어(`/_src` → vercel.com 로그인 필요) 외부 노출은 아니다. 조치: `.vercelignore` 추가 → 재배포 → 파일 목록 API 로 확인 → 옛 배포본 삭제. 키 교체 권고는 사용자 몫(HIL).
- NEW-local-env: 이 환경의 `.env` 키 이름이 `OPENAI_KEY` 라 코드(`OPENAI_API_KEY`)가 키를 못 읽었다. `server/env.ts` 가 두 이름을 모두 읽도록 고쳤다(앞 이름 우선).

## 상세 (FIX_NOW 만)

### ui-web-1 — 03 목록 카드 제목·미리보기, 프로필 시트 제목이 어절 중간에서 줄바꿈된다(word-break: keep-all 없음, Gate 3)

- 근거: PersonaList.module.css:142 word-break 없음(normal). Playwright 측정: 390·1440 '다독/인 날', 360 '첫날/의 서', 미리보기 '별로/야.'. 프로필 시트 제목 '서/하린'(ProfileSheet.module.css:70)
- 이유: 현재 코드에서 재현된다. 한 파일에 몇 줄만 더하면 되고, 줄바꿈 위치는 Playwright 측정으로 확인할 수 있다.
- 고칠 방법: PersonaList.module.css 142행 `.text strong, .text span` 규칙에 `word-break: keep-all; overflow-wrap: anywhere;`를 더한다(공백 없는 긴 이름도 줄바꿈되게). ProfileSheet.module.css 70행 `.title`에 `word-break: keep-all;`을 더한다. 테스트: 긴 이름 페르소나를 심은 Playwright 스크립트에서 360·390 폭의 줄바꿈 위치를 Range.getClientRects로 재서 모두 공백 뒤인지 확인한다.
- 파일: packages/ui/src/screens/PersonaList.module.css, packages/ui/src/screens/ProfileSheet.module.css

### ui-web-2 — 프로필 시트에서 section aria-label='이름'과 입력란 라벨 '이름'이 겹친다(Gate 3)

- 근거: ProfileSheet.tsx:80 `<section aria-label="이름">`. Playwright로 3개 뷰포트에서 getByLabel('이름',{exact:true}) 2개, ariaSnapshot에 region "이름" > textbox "이름"
- 이유: 스크린리더가 '이름' 영역과 '이름' 입력란을 두 번 읽는다. 속성 하나만 지우면 되고, 접근성 트리로 확인할 수 있다.
- 고칠 방법: ProfileSheet.tsx 80행 section에서 aria-label="이름"을 지운다. 이름이 없는 section은 region으로 잡히지 않는다. 나머지 두 section은 그대로 둔다. 테스트: Playwright로 프로필 시트를 열고 getByLabel('이름',{exact:true})가 1개, getByRole('region',{name:'이름'})가 0개인지 확인한다.
- 파일: packages/ui/src/screens/ProfileSheet.tsx

### ui-web-3 — 모바일에서도 목업 PNG 263KB를 받는다(PhoneFrame img가 display:none이어도 다운로드됨, Gate 3 감사 P2-6)

- 근거: Playwright response 측정: 로컬·배포 모두 360x740·390x844에서 mockup-iphone.png 263,471B를 받는다(img는 display:none). 배포 모바일 첫 로드 3,124,996B 중 약 8%
- 이유: 모바일 첫 화면에서 쓰지 않는 이미지를 받는다. 한 파일 몇 줄로 고칠 수 있고, response 이벤트로 확인할 수 있다.
- 고칠 방법: PhoneFrame.tsx 20행의 img를 `<picture><source media="(max-width: 600px)" srcSet="data:," /><img className={styles.frame} src={mockup.src} … /></picture>`로 감싼다. 기준 폭은 CSS와 같은 600px로 한다. 테스트: Playwright response 이벤트로 390x844에서는 mockup-iphone 요청이 0건, 1440x900에서는 1건인지 확인하고, 데스크톱 스크린샷이 바뀌지 않았는지 비교한다.
- 파일: packages/ui/src/PhoneFrame.tsx

### ui-web-4 — Pretendard 폰트 전체본 2.06MB를 모바일·데스크톱 모두 첫 방문에 받는다(tokens.css @font-face, Gate 3 감사 P2-7)

- 근거: tokens.css:3-9 @font-face 단일 pretendard.woff2(2,057,688B). 배포 360x740 첫 로드 3,124,996B 중 66%가 폰트. 3개 뷰포트 모두 받음
- 이유: 비용이 L이다. 서브셋을 만들거나 unicode-range로 나누려면 외부 도구(fonttools)로 새 폰트 파일을 만들어야 한다. 어느 글자까지 넣을지(KS X 1001 2,350자 또는 전체 11,172자), 빠진 글자가 다른 글꼴로 섞여 보이는 것을 받아들일지, 드래프트와 글자 모양이 같은지는 사람이 판단해야 한다. font-display: swap이라 기능에는 영향이 없다.
- 고칠 방법: (DEFER) 나중에 고친다면 fonttools pyftsubset으로 unicode-range 분할 파일을 만들고 tokens.css에 @font-face를 여러 개 둔다. 그다음 Playwright로 받는 바이트와 스크린샷을 비교한다.
- 파일: packages/ui/src/styles/tokens.css, packages/ui/src/fonts/pretendard.woff2

### analysis-1 — analysis 파서: 여러 줄 메시지 속 날짜 구분선 모양 줄('2019년 3월 2일 토요일')을 구분선으로 잘못 읽음 (Gate 1)

- 근거: /tmp 재현(parseKakao): Android 메시지 중간의 날짜 줄 뒤 2줄 유실. PC 판은 줄 유실에 더해 다음 메시지 날짜가 03-01→03-02 로 바뀜. parse.ts:75-79, 기존 테스트 11건에 이 경우 없음
- 이유: apps/web 은 /api/analyze(core analyzeRecords→parseKakao)와 클라이언트의 카톡 판별(MindmeApp.tsx:200)에서 같은 파서를 쓴다. 흔한 입력은 아니지만 줄이 사라지고 날짜가 잘못 붙는다. 순수 함수라 단위 테스트로 고정할 수 있다.
- 고칠 방법: packages/core/src/analysis/parse.ts parseKakao: 루프를 인덱스 기반으로 바꾼다. current 가 있을 때 MOBILE_DATE 줄은 다음 비지 않은 줄이 같은 날짜의 MOBILE_LINE(또는 SYSTEM·파일 끝)일 때만 구분선으로 보고, 아니면 current.text 에 이어 붙인다(PC 판에서는 day 를 바꾸지 않음). 테스트: analysis.test.ts 에 Android·PC 입력을 하나씩 넣어 줄이 남고 다음 메시지 날짜가 그대로인지 단언.
- 파일: packages/core/src/analysis/parse.ts, packages/core/test/analysis.test.ts

### analysis-2 — analyze 400 문구: 30만 1자 입력을 '기록 내용을 읽지 못했어요'로 안내함, api.md 의 413 과도 다름 (Gate 3)

- 근거: 3100·배포 모두 '가'×300,001 → 400 '기록 내용을 읽지 못했어요…'(web analyze/route.ts:9 invalid 고정). 3101 은 '기록은 300,000자 이하로…'. api.md:152 는 413 이라 적음. 30만 자+공백은 trim 뒤 200
- 이유: 앱은 파일을 MAX_INPUT_CHARS 로, 이야기를 maxLength 2000 으로 먼저 막는다. 그래서 화면에는 안 나오고 API 를 직접 부를 때만 보인다. 한 곳만 고치면 되고 HTTP 응답으로 검증할 수 있다.
- 고칠 방법: packages/core/src/server/http.ts parseRequest: 검증 실패의 첫 이슈가 path[0]==='text' 인 문자열 too_big 이면 opts.invalid 보다 먼저 tooLarge()를 돌려준다(413 '입력이 너무 길어요. 30만 자 이하로 줄여 주세요.', api.md:152 와 일치). 테스트: routes.test.ts 에서 analyzeRoute({ invalid: '기록 내용을…' })에 '가'×300,001 을 보내 413 과 '30만 자' 문구를 단언.
- 파일: packages/core/src/server/http.ts, apps/web/app/api/analyze/route.ts, packages/core/test/routes.test.ts, docs/dev-v1/api.md

### analysis-3 — analyze 큰 입력(summarized)에서 owner.currentAge 가 null: 구간 요약이 나이 단서를 버림 (Gate 3)

- 근거: /tmp 가짜 generate: 59,906자 카톡의 '나 95년생' 줄이 구간 요약 입력에는 있고 최종 입력에는 없음(analyze.ts:46-56,154-161). 배포 실측 analyze-big.json: currentAge null, 사건 age 모두 비어 있음
- 이유: web 은 사용자가 나이를 비워 두면 owner.currentAge 로 채운다(MindmeApp.tsx:219). null 이면 30초 넘게 기다린 뒤 입력 화면으로 돌아가 나이를 다시 묻는다. 흐름이 막히지는 않아 P2 로 본다. 원인: DigestSchema 에 나이 필드가 없고 DIGEST_SYSTEM 이 잡담을 버린다. 그래서 4만 자를 넘는 입력은 나이 단서가 최종 분석까지 가지 못한다.
- 고칠 방법: packages/core/src/analysis/analyze.ts: DigestSchema moments 에 age(number|null), 최상위에 ownerClues(string[]: '나'의 나이·출생연도·학년 단서 원문과 날짜)를 더한다. DIGEST_SYSTEM 에 '잡담이어도 나이 단서는 남긴다'를 넣고, 최종 입력에 '| 나이: N' 과 '나이 단서:' 줄을 붙인다. 테스트: analysis.test.ts 에서 가짜 generate 가 ownerClues 를 돌려주면 최종 input 에 단서가 들어가는지 단언. 실측은 4만 자+'95년생' 카톡 1회.
- 파일: packages/core/src/analysis/analyze.ts, packages/core/test/analysis.test.ts, apps/web/app/MindmeApp.tsx

### analysis-5 — analysis 입력 UX(web): '기록에서 지금 나이를 찾지 못했어요' 안내가 나이를 적은 뒤에도 남음 ('이전 오류 문구 잔존'의 web 잔여분)

- 근거: MindmeApp.tsx:221 에서 나이 안내를 띄운 뒤 notice 를 지우는 곳은 pickFile(167)·pickPhoto(176)뿐. onAgeChange={setAge}(438), createFirst 시작에도 초기화 없음
- 이유: 파일 오류 문구는 고쳐졌다. 하지만 같은 notice 상태를 쓰는 나이 안내는 나이를 입력해도(onAgeChange=setAge), 다시 만들어도(createFirst) 지워지지 않는다. 페르소나를 모두 지우고 02 화면으로 돌아오면 지난 문구가 다시 보인다. 사소하지만 한 파일만 고치면 된다.
- 고칠 방법: apps/web/app/MindmeApp.tsx: onAgeChange 를 (v) => { setAge(v); setNotice(undefined); } 로 바꾸고, createFirst 첫 줄에 setNotice(undefined)를 넣는다. 검증: Playwright 에서 page.route 로 /api/analyze 를 owner.currentAge null 응답으로 바꾸고, 나이를 입력한 뒤 role=alert 가 사라지는지 스크린샷으로 확인.
- 파일: apps/web/app/MindmeApp.tsx

### persona-chat-1 — 위기 감지: 돌려 말한 표현을 놓치고 마지막 user 메시지만 본다 (Gate 1)

- 근거: node: detectCrisis('차라리 죽는 게 나아'·'사는 게 의미가 없어'·'살아야 할 이유가 없어'·'죽어야겠다'·'i want to end my life') 모두 false. 3100 실호출 결과 X-Crisis=0, 109 없음. index.ts:60 은 최근 3개를 본다
- 이유: 최근 user 메시지 3개를 검사하도록 바뀌어 '마지막 메시지만' 문제는 해결됐다. 하지만 꽤 직접적인 표현도 놓친다. 이때는 109 안내와 위기 대응 지시가 빠진다. 안전 문제라 P1로 둔다(이번 실호출에서는 모델이 스스로 119를 안내했다).
- 고칠 방법: packages/core/src/chat/index.ts 의 CRISIS_PATTERNS 에 '죽는게나아', '죽어야겠', '죽을거야', '사는게의미', '살아야할이유', '살아서뭐하', '영원히자고', 'endmylife' 같은 어간을 추가한다. chat.test.ts 의 위기 감지 테스트에 위 MISS 문장을 넣고, 오탐 테스트('배고파 죽겠어', '웃겨 죽겠다')는 그대로 통과하는지 고정한다.
- 파일: packages/core/src/chat/index.ts, packages/core/test/chat.test.ts, docs/dev-v1/api.md

### persona-chat-2 — 같은 이름 페르소나 중복: 모달은 해결, 첫 생성 흐름은 남음 (Gate 2→Gate 3)

- 근거: node(pickEvents 복사): 15살 사건 2개('민수와 크게 다툼', '반장 선거에서 떨어짐')와 17살 사건 1개 → ['15살의 홍길동','15살의 홍길동','17살의 홍길동']. 모달 쪽은 MindmeApp.tsx:277 sameNamed 로 막힌다
- 이유: 04 모달은 sameNamed 로 기존 페르소나를 이어갈지 묻는다. 하지만 첫 생성(createFirst)은 pickEvents 가 같은 나이 사건을 채워 넣는다. 제목이 명사형('…다툼', '…화해')이면 이름이 같은 페르소나가 함께 만들어진다. 한 해치 카카오톡처럼 나이가 몰린 기록에서 흔히 생긴다.
- 고칠 방법: apps/web/lib/data.ts pickEvents 의 두 번째 채우기 루프에서 plainName(personaName('past', age, profile.name, event.title)) 이 이미 고른 것과 같으면 건너뛴다(모자라면 기존처럼 present 가 채운다). data.test.ts 에 같은 나이·명사형 제목 사건 2개를 넣어 이름이 겹치지 않는지 고정한다.
- 파일: apps/web/lib/data.ts, apps/web/lib/data.test.ts, apps/web/app/MindmeApp.tsx

### persona-chat-3 — 기록이 적을 때 설정 문구가 memories 로 새어 나온다 (Gate 1)

- 근거: git log -S: PERSONA_SYSTEM·pastBlock(persona.ts:115-133)이 10c10f4 이후 그대로다. personaFromDraft 에 걸러 내는 코드가 없다. Gate1 critic-persona-r1b-invalid.json 기억에 '어른이 된 나라는 건 알지만…'과 '이름은 김서연이고 지금 아홉 살이다'가 있다
- 이유: Gate 1 Critic 이 권고한 규칙('설정 설명·대화 상대 문장은 기억에 넣지 않는다')이 들어가지 않았다. 초안을 걸러 내는 코드도 없다. 04 모달 기본 나이(지금-10살)처럼 기록이 없는 나이로 만들면 생길 수 있다. 비용 때문에 AI 재호출은 하지 않았고 코드와 이력으로 판단했다.
- 고칠 방법: persona.ts PERSONA_SYSTEM 의 memories 규칙에 '설정·지시 설명, 대화 상대에 대한 문장, 이름·나이를 소개하는 문장은 넣지 않는다'를 더한다. personaFromDraft 의 memories 에서 /대화 상대|어른이 된 (나|자신)|이름은 .+이고/ 처럼 좁은 패턴에 맞는 문장을 뺀다. persona.test.ts 에 그런 초안을 넣어 걸러지는지 고정하고, 3100 /api/persona(past, 기록 없음) 1회 호출로 확인한다.
- 파일: packages/core/src/persona/persona.ts, packages/core/src/persona/persona.test.ts

### persona-chat-4 — persona 400 문구에 필드 이름이 드러난다('…events 에서 찾지 못했어요') (Gate 3)

- 근거: persona.ts:105 '선택한 사건을 events 에서 찾지 못했어요.' curl 3100 /api/persona(eventId:'nope') → 400 같은 문구. api.md:177, persona.test.ts:43 도 같은 문구
- 이유: 앱에서는 events 안의 id 만 보내므로 이 문구가 나오지 않는다. API 를 직접 부를 때만 보이지만, core 문구 한 줄과 문서·테스트만 고치면 된다.
- 고칠 방법: packages/core/src/persona/persona.ts personaRequestError 첫 줄을 '선택한 사건을 찾지 못했어요. 사건을 다시 골라 주세요.'로 바꾸고 api.md:177 도 같이 고친다. persona.test.ts:43 기대값을 바꾸고, 문구에 'events' 가 없는지 assert 한다.
- 파일: packages/core/src/persona/persona.ts, packages/core/src/persona/persona.test.ts, docs/dev-v1/api.md

### persona-chat-5 — api.md /api/chat: 'persona 없으면 샘플'이 apps/web 의 실제 400 과 다르다 (Gate 3)

- 근거: api.md:257 은 '샘플로 대화'라고 쓴다. apps/web chat/route.ts:7 에는 prepare 가 없다. persona 를 빼고 curl 하면 3100·배포 모두 400 '대화 내용을 보내지 못했어요. 페르소나를 다시 열어 주세요.'다. 258 의 user 문구도 apps/web 에서는 고정 문구로 바뀐다
- 이유: 샘플로 대화하는 것은 pocs 뿐이다(prepare 로 SAMPLE_PERSONA 를 채움). apps/web 과 배포본은 고정 문구로 400 을 낸다. 문서만 고치면 된다.
- 고칠 방법: docs/dev-v1/api.md:257 을 'pocs 만 persona 를 빼면 SAMPLE_PERSONA 로 대화한다. apps/web 은 400 `대화 내용을 보내지 못했어요. 페르소나를 다시 열어 주세요.`'로 고친다. 258 에도 'apps/web 은 같은 고정 문구'를 덧붙인다. 검증은 curl 로 400 문구를 확인한다.
- 파일: docs/dev-v1/api.md

### persona-chat-6 — present: age 와 profile.currentAge 가 같은지 서버가 검사하지 않는다 (Gate 1)

- 근거: node: personaRequestError({kind:'present', age:70, profile.currentAge:26}) → undefined. api.md:176 에 '서버는 검사하지 않음'이라고 적혀 있다
- 이유: 앱(kindOf)과 pocs(theAge=currentAge)는 항상 같은 값을 보내 사용자 피해는 없다. API 를 직접 부르면 '지금의 홍길동'이 70살로 만들어진다. past·future 검사 옆에 한 줄을 더하면 된다.
- 고칠 방법: persona.ts personaRequestError 에 `if (now && req.kind === 'present' && req.age !== now) return '지금의 나는 지금 나이로만 만들 수 있어요.'` 를 더하고 api.md:176 을 400 문구로 바꾼다. persona.test.ts 에 present 나이 불일치 케이스를 추가한다.
- 파일: packages/core/src/persona/persona.ts, packages/core/src/persona/persona.test.ts, docs/dev-v1/api.md

### ops-11 — 감사 P2-4: PersonaResponseSchema·PersonaResponse 가 코드에서 안 쓰임

- 근거: packages/core/src/schemas.ts:105,151 정의만 있음. apps/web/app/MindmeApp.tsx:88 postJson<{ persona: Persona }>('/api/persona', req)
- 이유: 한 줄 타입 교체로 api.md 계약과 코드를 잇는다. 동작은 바뀌지 않고 typecheck 로 검증할 수 있다.
- 고칠 방법: MindmeApp.tsx:88 의 제네릭을 PersonaResponse 로 바꾸고 '@mindme/core' 의 type import 에 PersonaResponse 를 더한다. api.md 는 그대로 둔다. 확인: pnpm typecheck 통과.
- 파일: apps/web/app/MindmeApp.tsx, packages/core/src/schemas.ts

### ops-13 — 감사 P2-6: 모바일에서도 데스크톱 목업 PNG 263KB 를 내려받음

- 근거: 배포 Playwright 390x844: mockup-iphone.*.png 200 263,471B 수신. PhoneFrame.tsx:20 <img> 는 PhoneFrame.module.css:118 미디어쿼리에서 display:none 일 뿐
- 이유: 한 파일만 고치면 되고 화면 모습은 바뀌지 않는다. 네트워크 기록과 스크린샷 비교로 검증할 수 있다.
- 고칠 방법: packages/ui/src/PhoneFrame.tsx:20 의 <img> 를 <picture><source media="(max-width: 600px)" srcSet="data:," /><img …/></picture> 로 감싼다. 테스트: Playwright 로 390x844 에서 mockup 요청 0건, 1440x900 에서 1건인지 보고, 데스크톱 스크린샷 픽셀 차이가 0인지 확인한다.
- 파일: packages/ui/src/PhoneFrame.tsx

### ops-14 — 감사 P2-7: 폰트 Pretendard 전체본 2.06MB 를 첫 방문에 받음

- 근거: packages/ui/src/fonts/pretendard.woff2 2,057,688B. 배포 Playwright 모바일·데스크톱 모두 pretendard.*.woff2 200 2,057,688B 수신
- 이유: 서브셋 파일을 새로 만들어야 하고(새 도구 필요), 드래프트와 글자 모양이 같은지 사람이 다시 봐야 한다. 비용이 L 이다.
- 고칠 방법: 
- 파일: packages/ui/src/fonts/pretendard.woff2, packages/ui/src/styles/tokens.css

### ops-20 — 감사 P2-14: .env.example 이 코드가 읽는 키와 다름

- 근거: .env.example 은 키 6개(JEV_KEY 등)를 싣고 MINDME_TEXT_MODEL·MINDME_IMAGE_MODEL(llm.ts:13,92)은 없다. 앱은 OPENAI_API_KEY 만 읽고, 작업 트리 env.ts 는 OPENAI_KEY 도 읽는다
- 이유: 예시 파일 한 곳에 주석만 더하면 된다. 스펙 키 목록을 지우지 않으니 판단할 거리가 없고, grep 으로 확인할 수 있다.
- 고칠 방법: .env.example 위에 '앱이 읽는 키: OPENAI_API_KEY(로컬은 OPENAI_KEY 도 읽음)' 주석을 달고, 빈 값 줄 대신 '# MINDME_TEXT_MODEL=gpt-6-astra'·'# MINDME_IMAGE_MODEL=gpt-image-2' 주석 줄을 더한다. 확인: process.env 이름을 grep 해서 예시 파일에 모두 있는지 본다.
- 파일: .env.example, packages/core/src/server/env.ts, packages/core/src/server/llm.ts

