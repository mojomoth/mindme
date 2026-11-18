# Gate 1 — Critic: screens (r1b)

2026-11-19. 독립 검수다. 구현자 로그(`gate1-screens.md`)의 주장은 근거로 쓰지 않았다. 캡처를 새로 찍어 드래프트와 직접 비교했고, Playwright 로 인터랙션을 돌렸으며, 두 모델(claude-sonnet-5-5, codex gpt-6.1-sol)에게 따로 판정을 받았다. 코드는 고치지 않았다.

## 판정: **PASS** (P0 0, P1 0, P2 7)

## 1. 직접 캡처 · 비교 (Read 로 드래프트와 나란히 확인)

| 화면 | 구성·순서 | 문구(prompts.json) | 색 | 캐릭터 | 잘림·겹침·목업 밖 |
|---|---|---|---|---|---|
| 01 랜딩 | 일치 (로고, 히어로, 하트 말풍선, 제목, 2줄 부제, 점 3개, 안내문) | 일치 | 일치 (점 #FF5B2A) | 같은 캐릭터 | 없음 |
| 02 생성 | 일치 (뒤로·제목, 인사 말풍선, 제목·도움말, 기억 파일, 나의 이야기 + 0 / 2,000, 얼굴 사진 카드, CTA) | 일치 | 일치 | 같은 캐릭터 | 없음 |
| 03 목록 | 일치 (제목 + 말풍선 아이콘, 준비 pill, 2줄 제목, 부제, 페르소나 3, 3행, 하단 캐릭터 + 안내, CTA) | 일치 | 일치 | 1·3행 일치, **2행은 다른 그림체**(P2-1) | 390 에서는 없음, 360 에서 맞닿음(P2-3) |
| 04 모달 | 일치 (스크림 위 목록, 반짝이, X, 캐릭터, 제목·부제, 상황 설명 예시, 15살 pill, 슬라이더, 5살/80살, 생성하기) | 일치 | 일치 | 같은 캐릭터 | 없음 |
| 05 대화 | 일치 (뒤로, 아바타, 이름·상태, 나가기, 오늘, 시작 안내, 말풍선 4개 + 시간, 타이핑, 입력창, 전송) | 일치 | 일치 | 같은 소년 | 없음, 데스크톱 9:41 상태바 보임 |

- 측정(`critic-screens-r1b-ui.json` overflow): 모든 화면과 뷰포트(390x844, 375x667, 1440x900)에서 가로 스크롤 0, 잘린 텍스트 0. 데스크톱 목업 화면 밖으로 나간 요소는 03·04 의 히어로 이미지 박스(x=722..911, 화면 끝 900)뿐이다. 이미지의 투명 여백이고, 컨테이너에 잘려서 캡처상으로는 보이지 않는다.
- safe-area: 응답 HTML 에 `viewport-fit=cover` 가 있다. 모바일(<=600px)에서는 `env(safe-area-inset-*)` → `--mm-safe-*` 를 쓴다.
- 375x667 에서도 02 하단 CTA 까지 스크롤해서 누를 수 있고, 04 의 '생성하기'는 뷰포트 안(y 545..593)에 있다.

## 2. 인터랙션 (Playwright, `critic-screens-r1b-ui.mjs` → `critic-screens-r1b-ui.json`) — 25/25 통과

| 항목 | 결과 |
|---|---|
| landing 자동 이동 → create | 2570ms (networkidle 대기 약 500ms 이후부터 잰 값이라 실제로는 약 3초). 루트 `/pocs/screens` 도 같음. `?hold` 면 3.6초 뒤에도 그대로 |
| 02 글자수 | 0 → 10 → 1,500 → 2,000 (2,100자 입력 시 2,000 에서 멈춤) |
| 02 페르소나 생성하기 → list | OK |
| 목록 '+ 페르소나 생성' → 모달 | mobile·desktop OK |
| 슬라이더 → pill | 키보드 15→20→80(End)→5(Home), 트랙 중앙 클릭 43살(desktop 42), 드래그 67살. `--pct` 채움도 함께 바뀜 |
| 모달 닫기 | X → list OK, 스크림 클릭 → list OK. Esc 는 닫히지 않음(P2-5) |
| 목록 행 → 대화, 나가기 → list, 뒤로 → list | mobile·desktop OK |
| 대화 전송 | 말풍선 추가 OK, 120자 연속 문자열과 긴 URL 도 가로 넘침 없이 줄바꿈 |
| 콘솔 에러 | 0 |

`pnpm typecheck` 통과. `packages/ui/src`, `pocs/app/pocs/screens` 에서 `@mindme/core/server`·`NEXT_PUBLIC_` 를 참조하는 곳 0건. 라우트: landing·create·list·modal·chat 은 200, 없는 경로는 404.

## 3. 외부 모델 판정 (원본 A + 모바일 B + 데스크톱 C)

| 화면 | claude-sonnet-5-5 | codex gpt-6.1-sol | P1 지적 |
|---|---|---|---|
| 01 랜딩 | 9 / OK | 8 / NEEDS_FIX* | 없음 |
| 02 생성 | 8 / OK | 8 / OK | 없음 |
| 03 목록 | 8 / OK | 7 / NEEDS_FIX | codex: 2행 아바타가 다른 인물 → 직접 확인 후 P2-1 로 낮춤 |
| 04 모달 | 9 / OK | 8 / NEEDS_FIX* | 없음 |
| 05 대화 | 9 / OK | 8 / OK | 없음 |

\* codex 가 P2 만 적고 NEEDS_FIX 로 끝낸 경우다. 근거가 P2 뿐이라 기준상 수정 대상이 아니다.
최저 점수는 7 이다. 7 미만인 화면은 없다.

**2행 아바타 판단 근거** (`critic-screens-r1b-avatar-compare.png`): 옷차림과 소품은 같다(세이지 그린 상의, 백팩 끈, 목걸이 사원증, 노란 배경). 다른 점은 셋이다. 드래프트는 3/4 측면에 큰 얼굴을 바짝 크롭했고, 구현은 정면 상반신이라 얼굴이 작다. 머리도 드래프트는 갈색 가르마, 구현은 검은 웨이브다. 그래서 같은 캐릭터로 보기에는 그림체가 꽤 다르다. 다만 3D 토이 스타일, 역할, 의상이 같고 1행·3행은 원본과 맞는다. 구성요소 누락도 깨짐도 아니므로 P2 로 기록한다.

## 4. 결함 목록

P0·P1 없음.

| # | 등급 | 화면 | 내용 | 수정 힌트 |
|---|---|---|---|---|
| P2-1 | P2 | 03 목록 2행 | '첫 출근 날' 아바타가 드래프트와 그림체·크롭이 다름(정면 상반신, 검은 웨이브 머리 vs 3/4 측면 얼굴 클로즈업, 갈색 가르마) | `Avatar zoom` 을 키워 얼굴 중심으로 크롭하거나, `avatar-young` 을 드래프트 크롭 기준으로 다시 생성 |
| P2-2 | P2 | 전체 | 배경이 단색 `--mm-bg` 라서 드래프트의 옅은 하늘색 그라데이션·질감이 없음. CTA 도 단색 | 토큰 소유자 결정 사항 |
| P2-3 | P2 | 03 목록 (360px) | 360x780 에서 히어로 캐릭터 팔이 제목 '?' 와 부제 '요' 에 맞닿거나 살짝 겹침(텍스트 오른쪽 끝 239, 이미지 왼쪽 167, 세로 범위 겹침). 390 에서는 문제 없음 | 좁은 폭에서 heroArt 크기를 줄이거나 오른쪽으로 더 밀기 |
| P2-4 | P2 | 05 대화 | 메시지를 보내도 목록이 맨 아래로 스크롤되지 않음. 7개를 보내면 새 말풍선이 입력창 뒤에 가려짐(`critic-screens-r1b-chat-long-se.png`) | Gate 2 대화 화면에서 전송·수신 시 마지막 메시지로 scrollIntoView |
| P2-5 | P2 | 04 모달 | Esc 키로 닫히지 않음(X 와 스크림 클릭은 됨) | keydown Escape → onClose |
| P2-6 | P2 | 02 생성 (데스크톱) | 흰 패널과 CTA 사이가 약 10px 로 드래프트보다 좁음 | 하단 여백 조정 |
| P2-7 | P2 | 03 목록 (360px) | '다른 순간의 나도 만나보세요' 가 하단 CTA 그라데이션에 반쯤 가려짐(스크롤하면 보임) | 확인만 |

상투적인 UI·문구: prompts.json 문구를 그대로 썼다. 덧붙인 문구('다른 파일로 바꾸려면 눌러 주세요', 모달 placeholder '언제의 나를 만나고 싶나요?')도 상투적이지 않다고 봤다. 지적 없음.

## 증거 (`docs/dev-v1/evidence/gate1/`)

- 캡처: `critic-screens-r1b-{landing,create,list,modal,chat}-{desktop,mobile}.png`, `critic-screens-r1b-{create,list,modal}-se.png`(375x667), `critic-screens-r1b-list-360.png`, `critic-screens-r1b-chat-long-se.png`
- 아바타 비교: `critic-screens-r1b-avatar-compare.png` (좌 드래프트 / 우 구현, 위 1행 / 아래 2행)
- 인터랙션: `critic-screens-r1b-ui.mjs`, `critic-screens-r1b-ui.json`, `critic-screens-r1b-extra.mjs`, `critic-screens-r1b-extra.json`, `critic-screens-r1b-360.mjs`
- 모델 판정 원문: `critic-screens-r1b-vision-{claude,codex}-{landing,create,list,modal,chat}.txt`

## 재현
```
node scripts/shot.mjs "http://localhost:3101/pocs/screens/landing?hold" desktop docs/dev-v1/evidence/gate1/critic-screens-r1b-landing-desktop.png
node docs/dev-v1/evidence/gate1/critic-screens-r1b-ui.mjs > docs/dev-v1/evidence/gate1/critic-screens-r1b-ui.json
claude -p --model claude-sonnet-5-5 --allowedTools Read -- "<프롬프트> A=<draft> B=<mobile> C=<desktop>"
codex exec --skip-git-repo-check -m gpt-6.1-sol "<프롬프트>" -i <draft> -i <mobile> -i <desktop> < /dev/null   # 프롬프트를 -i 앞에 둘 것(-i 가 가변 인자라 뒤에 두면 프롬프트가 먹힘)
```
