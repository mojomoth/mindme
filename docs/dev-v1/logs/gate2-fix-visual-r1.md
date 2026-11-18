# Gate 2 fix-visual-r1 — 데스크톱 목업 상태바 겹침(P1)

## 결함
데스크톱 목업에서 스크롤하면 내용이 투명한 상태바(9:41·아이콘)와 다이내믹 아일랜드 밑으로 그대로 지나갔다. 02는 제목·뒤로 가기·인사 말풍선이, 03은 맨 아래로 내렸을 때 제목이 상태바와 겹쳤다.

## 원인
`packages/ui/src/PhoneFrame.module.css`의 `.statusBar`가 배경 없는 absolute(z-index 2)이고, `.content` 스크롤 영역은 화면 맨 위(0px)부터 시작한다.

## 수정 (최소 변경 2곳)
- `packages/ui/src/PhoneFrame.module.css`
  - `.statusBar`에 `background: var(--mm-bg)`를 깔았다. 스크롤한 내용은 상태바 아래로 숨고, 처음 화면은 바탕색이 같아 달라 보이지 않는다.
  - `.screen:has([data-statusbar-under]) .statusBar { background: none; }`: 05 대화 화면은 흰 sticky 헤더가 상태바 뒤를 채우므로 덮개를 두지 않는다. 이미 통과한 화면이라 모습을 그대로 둔다.
- `packages/ui/src/screens/Conversation.tsx`: `<header … data-statusbar-under>` 속성 하나를 추가했다.
- 모바일(<=600px)은 `.statusBar { display: none }`이라 영향이 없다.
- 02 '사진 업로드'가 처음 화면에서 버튼에 가리는 것과 03에서 3개부터 스크롤이 생기는 것은 레이아웃을 바꾸지 않았다. 스크롤이 생기더라도 상태바와 겹치지 않게 하는 것이 이번 수정의 범위다.

## 확인 (apps/web 3100에서 실제 실행, AI 호출 없음)
- 스크립트: `docs/dev-v1/evidence/gate2/fix-visual-r1-verify.mjs` → `fix-visual-r1-verify.json`
  - 02: 스크롤 0, 60px(휠), 맨 아래(100px). 상태바 배경은 rgb(240,246,250)이고, 스크린샷에서 9:41·아이콘이 깨끗하게 보이며 내용은 그 아래로 숨는다.
  - 03(페르소나 5개, scrollHeight 993 / clientHeight 892): 맨 아래(101px)에서도 제목이 상태바 밑으로 숨고 9:41과 겹치지 않는다.
  - 05 대화: 상태바 배경 rgba(0,0,0,0). 기존처럼 흰 헤더가 상태바 뒤까지 이어진다.
  - 모바일 390: 상태바 `display: none`, 화면은 그대로다.
- 증거: `fix-visual-r1-desktop-01-landing.png`, `-02-top.png`, `-02-wheel60.png`, `-02-bottom.png`, `-03-top.png`, `-03-bottom.png`, `-05-chat.png`, `fix-visual-r1-mobile-02-create.png`
- `pnpm --filter @mindme/web typecheck` 통과. pocs 3101 `/pocs/screens` 200, web 3100 `/` 200(두 서버 모두 계속 실행 중).
