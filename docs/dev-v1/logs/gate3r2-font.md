# Gate 3 r2 font 빌더 로그 (ui-web-4 / ops-14)

## 재현
- 수정 전: 390x844 첫 로드(01 랜딩에서 02 만들기까지)에 `pretendard.woff2` 전체본 2,057,688B 를 한 번에 받았어요.

## 바꾼 것
- `scripts/subset-font.py`(새 파일): 원본 `packages/ui/src/fonts/pretendard.woff2`(그대로 둠)를 11개 조각으로 나눠 `packages/ui/src/fonts/subset/*.woff2` 와 `manifest.json` 을 만들고, `tokens.css` 의 `@font-face` 블록(마커 사이)을 다시 써요. 글리프를 빼지 않았고 가변 굵기 축(45 920)과 레이아웃 기능은 그대로예요. 14,336자 전부가 조각 하나에만 들어가요.
  - `latin-basic` 360자: ASCII·라틴-1·일반 문장부호·CJK 기호·한글 호환 자모·₩·€
  - `symbols` 2,804자: 나머지 비한글 글자
  - `hangul-common` 2,350자: KS X 1001 한글. 파이썬 `euc_kr` 코덱이 확장 완성형 11,172자까지 인코딩해서, 한글 영역(0xB0A1-0xC8FE)인지 바이트로 한 번 더 걸렀어요.
  - `hangul-rest-1..8`: 나머지 8,822자를 연속 구간으로 8개
- `packages/ui/src/styles/tokens.css`: `@font-face` 를 조각별로 교체(family `Pretendard`, weight 45 920, `font-display: swap` 유지, unicode-range 는 실제 코드포인트와 일치).
- `packages/ui/src/fonts/subset.test.ts`(새 파일): tokens.css 와 manifest·조각 파일이 맞는지, 코드포인트가 겹치지 않는지, KS 2,350자·희귀 음절('똠','쀍','햏')이 올바른 조각에 있는지 확인해요.

## 실측 (390x844, Playwright, 증거: docs/dev-v1/evidence/gate3r2/font-bytes.json)
- 첫 로드 폰트 합: 2,057,688B -> 466,852B (latin-basic 61,776 + hangul-common 405,076). 기준 700KB 이하 충족.
- 조각 11개 합은 약 2.3MB 로 원본보다 커요(조각마다 가변 테이블이 중복). 대신 화면에 쓰인 조각만 받아요.
- 수정 전후 스크린샷(01·02·03 목록·04 모달·일반 문장 테스트 페이지) 차이 픽셀 0.
- 희귀 음절 '똠쀍햏' 이 든 문장도 Pretendard 로 그려져요(`document.fonts.check` true, 테스트 문장 로드 후 조각 5개 로드).
- 증거 PNG: font-{before,after}-{01,02,03,04,test}.png

## 남은 문제
- 한글이 적게 쓰인 화면도 `hangul-common` 405KB 는 받아요. 더 줄이려면 이 조각을 쪼개야 하는데, 이번 목표(700KB)에는 필요 없어서 두지 않았어요.
- 원본 `pretendard.woff2` 는 참조만 끊었고 저장소에 남아 있어요(재생성 입력).
