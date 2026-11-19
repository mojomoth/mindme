# Gate 3 r2 — 독립 실동작·외형 Critic (라운드 1)

- 일시: 2026-11-19, 대상: `http://localhost:3100`(apps/web dev), 작업 트리(커밋 전)
- 방법: 구현자 설명 없이 브라우저(Playwright chromium)와 HTTP 로 직접 확인했다. 파일은 고치지 않았다. 스크립트는 `evidence/gate3r2/critic-behavior-r1-scripts/` 에 있다.
- AI 호출: 핵심 흐름 1회(analyze 2, persona 4, chat 2), 위기 감지 chat 2회. 나머지는 AI 없이(입력 검증 오류, 가짜 응답 `page.route`, 순수 함수) 확인했다.
- 판정: **FAIL** — P1 1건(03 목록 외형 점수 7점 미만, 이번 라운드 변경과는 무관한 기존 차이), P2 3건. 검증 대상 18개 항목은 모두 기대대로 동작했다.

## 1. 핵심 흐름 (1440x900, 실제 AI)

01 랜딩 → 02 만들기(`pocs/fixtures/analysis/kakao-mobile.txt`, 이야기 한 줄, 이지우·27살, 사진 없음) → 진행 화면 → 03 목록 → 04 모달(17살, '고등학교 2학년 때 처음으로 반 대표로 발표했던 날') → 05 대화 2턴 → 프로필 시트 → 나가기 → 새로고침 → 복원 순서로 진행했다.

| 확인 | 결과 |
|---|---|
| 콘솔 오류·경고, pageerror | 0, 0 |
| 4xx·5xx 응답 | 0 |
| API | analyze 200(7.6s·19.6s), persona 200 x4(9.7~13.6s), chat 200 x2(헤더 1.3s·2.0s) |
| 03 첫 생성 이름 | 열한 번 탈락 끝에 합격한 날의 / 첫 출근에 잔뜩 긴장한 날의 / 회의에서 의견을 칭찬받은 날의 이지우 (겹침 없음) |
| 04 모달 | '17살의 이지우' 추가, 같은 이름 확인 창 없음(겹치는 이름 없음) |
| 05 스트리밍 | 100ms 간격으로 잰 마지막 말풍선 길이가 턴마다 14·16단계로 늘었다. 입력 중 표시도 보였다 |
| 새로고침 복원 | 랜딩 '잠시 후 나의 페르소나로 이동해요' → 목록 4개·미리보기 동일, 대화 말풍선 5개 동일 |

증거: `critic-behavior-r1-flow.json`, `critic-behavior-r1-flow-0*.png`, 상태 `critic-behavior-r1-state.json`.

## 2. 항목별 결과

| id | 판정 | 근거 |
|---|---|---|
| analysis-1 | PASS | Android·PC 여러 줄 메시지 속 '2019년 3월 2일 토요일' 줄이 본문에 남고, 다음 메시지 날짜도 03-01 그대로다. 예시 파일 2개는 회귀 없음(17·33개). 단, 구분선 바로 뒤가 시스템 줄(시간 없음)이거나 파일 끝이면 그 줄이 앞 메시지 본문에 붙는다(아래 P2) |
| analysis-2 | PASS | '가'x300,001 → 413 `입력이 너무 길어요. 30만 자 이하로 줄여 주세요.`(prompt·kakao 둘 다). 공백만 → 400 |
| analysis-3 | PASS | 가짜 generate 로 80,256자 카톡(구간 2개)을 돌렸다. 구간 요약의 `ownerClues` 가 최종 입력 '나이 단서:' 줄로 들어간다. 실제 AI 실측은 구현자 증거 `analyze-big-age.json`(summarized, currentAge 31)을 참고했고 다시 돌리지는 않았다. api.md 150행 설명은 고친 뒤에도 그대로다(아래 P2) |
| analysis-5 | PASS | `/api/analyze` 를 currentAge null 로 바꾸면 안내가 뜨고, 나이 첫 글자를 치자마자 사라진다(390·1440). 다시 띄운 뒤 이야기를 바꿔 다시 만들고 실패 → '입력 화면으로'로 돌아오면 지난 안내가 없다 |
| persona-chat-1 (P1) | PASS | 3100 실호출: '나도 요즘 좀 그래. 솔직히 사는 게 의미가 없어.' → X-Crisis 1, 109 안내 1회. '웃겨 죽겠다 ㅋㅋㅋ' → X-Crisis 0, 109 없음. 키워드 함수: 트리아지 MISS 5문장과 변형 4문장 모두 잡고, 관용 표현 6문장은 잡지 않는다. 앞선 user 메시지의 위기 신호도 잡는다 |
| persona-chat-2 | PASS | 트리아지 예시(15살 명사형 제목 2개 + 17살 1개)를 가짜 응답으로 02부터 만들었다. persona 요청은 past 15·past 17·present 26으로 갔고, 목록은 15살의 / 17살의 / 지금의 홍길동이다. 함수 단위로도 겹침이 없다 |
| persona-chat-3 | PASS | `personaFromDraft` 에 설정 문구 5개와 정상 기억 3개를 넣으면 정상 3개만 남는다('내 이름을 친구가 놀려서 속상했다'는 남는다) |
| persona-chat-4 | PASS | eventId 'nope' → 400 `선택한 사건을 찾지 못했어요. 사건을 다시 골라 주세요.`(필드 이름 없음) |
| persona-chat-5 | PASS | persona 없이 /api/chat → 400 `대화 내용을 보내지 못했어요. 페르소나를 다시 열어 주세요.`, api.md 에 같은 문구가 있다 |
| persona-chat-6 | PASS | present age 70·currentAge 26 → 400 `지금의 나는 지금 나이로만 만들 수 있어요.`(12ms, AI 호출 전), 필드 이름 없음 |
| ops-11 | PASS | `PersonaResponseSchema`·`PersonaResponse` 를 지웠고, 코드·api.md 에 남은 참조가 없다. core `tsc --noEmit` 통과. 트리아지는 '타입으로 쓰기'를 제안했지만, 안 쓰는 코드를 지운 것도 같은 문제를 닫는다 |
| ops-20 | PASS | 코드가 읽는 이름(OPENAI_API_KEY·OPENAI_KEY, MINDME_TEXT_MODEL·MINDME_IMAGE_MODEL)이 `.env.example` 에 모두 있고, 기본값(gpt-6-astra, gpt-image-2)도 ai.ts 와 같다 |
| ui-web-1 | PASS | 긴 이름 2개를 더한 목록에서 390·360·1440 카드 제목·미리보기의 줄바꿈 위치를 Range 로 쟀다. 모두 공백에서 끊긴다. 띄어쓰기 없는 이름만 글자 사이에서 끊기고 넘치지 않는다. 프로필 시트 긴 제목도 '서하린 / 이야기'로 어절 단위로 끊긴다 |
| ui-web-2 | PASS | 390·360·1440 프로필 시트: `getByLabel('이름',{exact})` 1개, region '이름' 0개. 접근성 트리에는 '성격과 말투'·'기억과 감정' region 만 있다 |
| ui-web-3 / ops-13 | PASS | 첫 방문 01→02: 390·360 목업 PNG 요청 0건(img currentSrc 는 1x1 data GIF), 1440·1920 은 1건 |
| ui-web-4 / ops-14 | PASS | 01→02 폰트 수신 466,852B(latin-basic 61,776 + hangul-common 405,076). 수정 전 2,057,688B 대비 22.7%로, 4개 뷰포트 모두 같다. 옛 전체본 요청 없음. '똠'·'햏'은 각각 hangul-rest-2(185,268B)·rest-8(209,548B)을 그때 받아 Pretendard 로 그린다(FontFace loaded, `fonts.check` true). fontTools 검사: 조각 cmap 합 14,336자 = 원본, 선언 범위와 파일 글자 일치, 겹침 없음, wght 축 유지, 표본 16자 윤곽이 원본과 같다. 02 화면은 수정 전 캡처와 390·360 픽셀 차이 0, 1440 은 2px(색 1단계)이다 |
| NEW-local-env | PASS | 루트 .env 에는 `OPENAI_KEY` 이름만 있는데 `/api/health` 가 configured true 이고, 실제 AI 호출도 성공했다. 가짜 값 단위 확인: OPENAI_KEY 만 있어도 읽고, 둘 다 있으면 OPENAI_API_KEY 가 우선이며, 앞 값이 공백이면 뒤로 넘어가고, 둘 다 없으면 오류 문구가 OPENAI_API_KEY 를 가리킨다 |
| NEW-deploy-env | PASS(로컬 모사) | Vercel CLI 기본 무시 목록 + `.vercelignore` 를 `ignore` 패키지로 재현했다. 올라가는 파일 189개에 `.env`·`.env.*` 가 없다(없으면 1,212개 중 `.env`·`.env.example` 포함). 빌드에 필요한 파일(lock, workspace, apps/web, packages, assets/generated 의 쓰는 PNG 2장, pocs/package.json)은 모두 남는다. 실제 재배포 파일 목록 확인은 메인 몫이다 |
| 데스크톱 목업 | PASS | 1440x900·1920x1080: 목업이 보이고 가운데 정렬, 뷰포트 안. 화면 위치 비율(왼 0.0423, 위 0.0184, 폭 0.9166, 높이 0.9648)이 CSS 실측값과 같다 |

증거: `critic-behavior-r1-http.json`, `-pure.json`, `-mocked.json`, `-viewports.json`, `-fontcheck.json`, `-vercelignore.json`, `-390-*`·`-360-*`·`-1440-*`·`-1920-*.png`, `-samename-list.png`, `-390-age-notice*.png`, `-360-sheet-longtitle.png`.

## 3. 외형 비교 (claude -p --model sonnet)

| 화면 | 실제 데이터 | 드래프트 비슷한 데이터·상태 | 판단 |
|---|---|---|---|
| 03 목록 | 6 | 6, 7 | 중앙값 6 → 기준(7) 미만, P1 |
| 05 대화 | 6 | 7, 7 | 7 → 통과. 실제 데이터 6점은 AI 답이 3~5줄로 길고 입력 중 표시가 없던 상태 탓이다 |
| 프로필 시트 | 7 | — | 통과(Gate 2 r2 는 6) |

- '드래프트 비슷한 데이터'는 이름·문장 길이를 드래프트와 맞추고, 03은 생성 직후(준비 배지), 05는 입력 중 표시가 보이는 상태로 찍은 것이다(가짜 응답).
- 03에서 세 번 모두 나온 차이: 새로 만든 카드 모두에 '새로운 페르소나' 표시(드래프트는 첫 카드만), 카드 높이·간격이 촘촘함, 아바타 배경이 모두 같은 파랑(드래프트는 카드마다 다름), 히어로 마스코트가 부제 끝에 붙음. 실제 데이터에서는 AI 이름이 길어 제목이 2줄이 된다.
- 이번 라운드가 03에 준 변경은 `word-break: keep-all` 뿐이다. 드래프트 비슷한 데이터에서는 줄바꿈이 일어나지 않으므로, 점수는 기존 차이를 반영한다. Gate 2 r2 Sonnet 점수는 7점이었다.
- 원문: `critic-behavior-r1-visual-*.txt`, 캡처 `critic-behavior-r1-visual-*.png`.

## 4. 발견

### P1

1. **03 목록 외형 점수 6/10 (기준 7 미만)** — web-ui. 위 3절. 이번 변경 때문에 생긴 회귀는 아니다. 기준을 그대로 적용해 P1 로 올린다. 기존 차이를 받아들일지는 메인·HIL 이 판단한다.

### P2

1. **analysis-1 경계: 날짜 구분선 뒤가 시스템 줄(시간 없음)이거나 파일 끝이면, 구분선 줄이 앞 메시지 본문에 붙는다** — core-analysis. `opensDay` 는 다음 줄이 같은 날짜의 MOBILE_LINE 일 때만 true 다. 트리아지가 적은 'SYSTEM·파일 끝' 경우가 빠졌다. 재현: `['…오후 11:50, 이지우 : 잘 자', '2019년 3월 2일 토요일', '박서진님이 들어왔습니다.', …]` → 첫 메시지 text 가 '잘 자\n2019년 3월 2일 토요일'. 다음 모바일 메시지 날짜는 줄에 들어 있어 맞다.
2. **api.md 150행이 analysis-3 수정 뒤에도 '구간 요약 모드에서는 나이 단서가 빠져 null 이 나오기 쉽다(P2)'라고 쓴다** — core-persona-chat(api.md). `ownerClues` 로 단서를 넘긴다는 설명으로 바꿔야 한다.
3. **(새로 발견, 기존 문제) 04 모달의 과거 페르소나가 '나의 이야기'에 적힌 더 나중 일을 기억으로 가진다** — core-persona-chat. 흐름 실행에서 02 이야기('첫 출근 날 너무 떨려서…사수가 말이 없어서…')를 쓴 뒤 04에서 17살(고2 발표)을 만들었다. 그러자 기억에 '첫 출근 날…사수가 말이 없어서 눈치를 많이 봤다'가 들어갔고, 17살이 '오늘 첫 출근이라…사수도 말이 없어서'라고 답했다(`critic-behavior-r1-visual-05-chat.png`). `buildPersonaInput` 이 `profile.story` 를 나이와 상관없이 `[나의 이야기]` 로 넣는다(persona.ts:181). pastBlock 의 '그 나이 이후 일을 모른다' 지시와 충돌한다. persona-chat-10(사건 경로 미래 지식 누출, P2)과 같은 종류여서 P2 로 둔다. 다만 첫 실행에서 바로 재현됐다.

## 5. 남은 확인

- NEW-deploy-env: 실제 재배포 뒤 Vercel 파일 목록 API 로 `.env` 가 없는지, 옛 배포본을 지웠는지는 메인이 확인한다.
- analysis-3: 실제 AI 로 4만 자 넘는 입력을 돌린 것은 구현자 증거뿐이다(비용 때문에 다시 돌리지 않았다).
