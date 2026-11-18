# gate1 Critic: analysis r1b (/pocs/analysis, POST /api/analyze)

판정: **PASS**. P0·P1 없음, P2 6건.
구현자 로그는 근거로 쓰지 않았다. 아래 내용은 모두 2026-11-19 에 dev 서버(3101)에서 직접 실행한 결과다.

## 1. 파서 단위 테스트
- 구현자 테스트: `pnpm test` 18/18 통과, `pnpm typecheck` 통과 → `evidence/gate1/critic-analysis-r1b-unit.txt`
- Critic 이 따로 쓴 엣지 케이스 7개 모두 통과 → `critic-analysis-r1b-parser.test.ts`, 결과 `critic-analysis-r1b-parser.txt`
  - PC: BOM, CRLF, 빈 줄과 들여쓰기가 섞인 여러 줄 메시지, 자정을 넘기는 날짜 구분선, 오전·오후 12시, 본문 속 `[오후 3:00]`, 시스템 메시지 다음 줄을 버리는지
  - Android: 날짜+시간 구분줄, 본문 속 ` : `
  - iOS: 요일 구분선, 빈 줄이 낀 여러 줄 메시지, 이모티콘 제외, `me` 부분 일치('도윤' → 최도윤)
  - Mac CSV: 헤더 줄, 따옴표 안 쉼표, `""` 이스케이프, 여러 줄
  - 빈 파일, 공백만, BOM만, 형식이 아닌 텍스트: 메시지 0개
  - 2.2MB(1,233,853자, 메시지 36,000개): 22ms 에 파싱, 메시지 수와 날짜 블록 300개 그대로

## 2. /api/analyze 실제 호출 (gpt-6-astra)
| 입력 | 결과 | 시간 | 스키마 | 시간순 | 인용문 원문 일치 |
|---|---|---|---|---|---|
| 픽스처 카톡 PC (me 없음) | 4건, 나=이지우 | 33.0s | OK | OK | 11/11 |
| 픽스처 카톡 iOS (me=이지우) | 3건 | 18.8s | OK | OK | 8/8 |
| 픽스처 일기 | 4건 | 32.0s | OK | OK | 12/12 |
| 픽스처 자유 프롬프트 | 5건 | 29.8s | OK | OK | 5/5 |
| **새 Android 카톡** (Critic 작성, me 없음) | 3건, 나=정도현 | 18.5s / 24.3s | OK | OK | 8/8 |
| **새 긴 카톡** 152,707자, 잡담 300일에 사건 3개 심음 | summarized 3구간, 3건 | 25.4s | OK | OK | 8/8 |

- 스키마: 모든 응답을 `AnalyzeResponseSchema.safeParse` 로 검증했다. 시간순은 `dateKey` 오름차순으로 확인했다.
- 인용문: `selfAtTime.quotes` 가 원문에 그대로 있는지 공백을 빼고 비교했다. 전체 52개 중 지어낸 인용문은 0개다.
- 새 카톡: 심은 사건(개강 첫날·서하, 할머니 별세, 휴학 결정)을 날짜까지 정확히 뽑았다. 미끼로 넣은 '주말 잡담'과 '로또 되면 세계일주(가정)'는 사건으로 잡지 않았다. 나이 단서가 없어서 age 를 비워 두었다(추측하지 않음). 감정(긴장 / 슬픔·후회 / 두려움·후련함)과 맥락(광주행 기차, 아빠의 실망)도 원문과 맞다.
- 긴 입력: 152,707자 가운데 잡담 4,205개 메시지에서 가짜 사건 0개. 사건 3건은 짧은 입력 때와 같다.
- 자유 프롬프트: '서른두 살'과 오늘 날짜로 2004·2009·2018·2023 을 계산했고 `dateEstimated: true` 를 붙였다. 산수도 맞다.
- PC 픽스처: 15살(2015) → 16살(2016) → 24살(2024) 로 나이가 이어진다. 화해 날짜(05-21)와 졸업식(2016-02-12)도 원문과 같다.
- 증거: `critic-analysis-r1b-{fx-kakao-pc,fx-kakao-mobile,fx-diary,fx-prompt,new-android,new-android-nome,new-long}.json`, 입력 파일 `critic-analysis-r1b-kakao-android.txt`, `critic-analysis-r1b-kakao-long.txt`

## 3. 잘못된 입력 → 4xx (`critic-analysis-r1b-invalid.txt`)
빈 text, 공백만 있는 text, source 누락, 없는 source 값, 숫자 text, JSON 아님, 빈 본문, 배열 본문, 카톡 형식 아님, 헤더만 있는 카톡 파일, me 41자, text 300,001자, 300,000자 비형식 입력은 모두 400 이다. 3.08MB 본문은 413, GET 요청은 405 로 막힌다. 5xx 는 나오지 않았다.

## 4. /pocs/analysis Playwright (desktop 1280, mobile 390)
스크립트는 `critic-analysis-r1b-ui.mjs`, 로그는 `critic-analysis-r1b-ui-{desktop,mobile}.txt` 에 있다. 두 화면 모두 11개 항목을 통과했다.
- 새 Android TXT 를 파일로 올리고 분석하면 3건이 나온다(21.5s).
- 나이에 '열일곱'을 넣으면 저장을 막고, 17 로 고치면 추가된다. 2018-03 사건은 맨 앞에 정렬된다.
- 두 번째 사건의 제목과 시점(2023-01-05)을 고치면 맨 뒤로 다시 정렬된다. 다른 사건 하나를 지울 수 있다.
- 새로고침해도 화면이 그대로이고, localStorage `mindme:events` 와 화면 내용이 같다.
- 형식이 아닌 텍스트로 분석하면 한국어 오류 문구가 나오고, 기존 타임라인은 남아 있다.
- 2.1MB TXT(1,222,941자)를 올리면 분석 버튼이 비활성화되고 글자 수가 빨간색으로 바뀐다.
- 페이지 오류 0. 콘솔 오류는 일부러 보낸 400 요청 1건뿐이다.
- 스크린샷을 직접 확인했다(`critic-analysis-r1b-{desktop,mobile}-{analyzed,reloaded,2mb}.png`). 모바일 390 폭에서 가로 넘침이나 겹침이 없다.

## 5. 키 노출 (`critic-analysis-r1b-keyscan.txt`)
- `.env` 의 KEY 계열 값 6개를 다음 위치에서 찾아봤고, 값이나 이름이 나온 곳은 0건이다: Critic 증거 24개 파일, `pocs-dev.log`, `/pocs/analysis` 클라이언트 청크 17개.
- 클라이언트 쪽 `@mindme/core/server` import 는 0건이다(route.ts 에서만 쓴다). NEXT_PUBLIC_ 도 0건이다. 청크에 보이는 'server-only' 문자열은 Next 프레임워크 자체 코드다.

## 결함
| 등급 | 내용 | 근거 |
|---|---|---|
| P2 | 여러 줄 메시지 중간에 `2019년 3월 2일 토요일` 같은 줄이 있으면 날짜 구분선으로 인식한다. 그 뒤에 이어지던 줄('기억나?')이 사라진다 | parser.txt '[관찰]' |
| P2 | 30만 자를 넘으면 버튼만 꺼지고 할 수 있는 일을 안내하지 않는다(뒤를 자르기, 기간 나누기 등). 실제 카톡 내보내기 파일은 이 한도를 자주 넘는다. 다른 파일을 올려도 이전 오류 문구가 그대로 남는다 | mobile-2mb.png |
| P2 | 수정 폼의 검증 오류에 zod 영어 문구가 섞인다. 예: '나이 값을 확인해 주세요. (Invalid input: expected number, received NaN)'. API 400 메시지도 영어 zod 문구다 | ui-desktop.txt, invalid.txt |
| P2 | 다시 분석하면 타임라인 전체가 새 결과로 바뀐다. 직접 추가하거나 고친 사건이 확인 없이 사라진다(`Analysis.tsx` analyze → setEvents). 기록 종류를 바꿔 분석해도 합쳐지지 않는다. 코드를 읽고 확인한 내용이다 | Analysis.tsx |
| P2 | `mindme:analysis:last` 에 원문 전체(최대 30만 자)가 localStorage 에 평문으로 남는다. PoC 에서는 괜찮지만 본 앱에서는 저장할지 다시 정해야 한다 | Analysis.tsx |
| P2 | 파일 선택 버튼이 브라우저 기본 'Choose File / No file chosen'(영어)이다 | desktop-reloaded.png |
