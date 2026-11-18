# Gate 1 HIL (사람 확인)

dev 서버를 켠 뒤 아래 URL 을 열어 직접 확인한다. 각 항목 옆의 '자동'은 이미 끝난 자동 검증 결과다. 문제가 있으면 항목 아래에 한 줄 적어 두면 Gate 2 전에 반영한다.

```bash
cd /Users/jyl/work/repo/ai-agent-live-1117/mindme && pnpm dev:pocs   # http://localhost:3101
```

- 목록: http://localhost:3101/pocs
- 자동 검증 요약(2026-11-19 gate1-integrate): `pnpm typecheck` 3패키지 통과, `pnpm test` 32/32, `pnpm lint` 통과, `next build` 성공, `/pocs` 아래 10개 경로 200(없는 화면은 404), 키 값 바이트 검색 657파일 0건

## 1. 기록 분석 — http://localhost:3101/pocs/analysis

- [ ] '예시 불러오기 → 카톡 PC판' → 분석하기를 누르면 30초 안팎에 사건 4개가 시간순으로 나온다
  - 자동: PASS. 33.8s, 사건 4개(다툼·화해·졸업·첫 출근) (`evidence/gate1/analysis-kakao-pc.json`)
- [ ] 일기·직접 쓰기 예시도 사건이 그럴듯하게 나온다. 없는 사건을 지어내지 않는다
  - 자동: PASS. 일기 4개, 프롬프트 5개, 지어낸 사건 0 (`analysis-diary.json`, `analysis-prompt.json`, `integrate-analyze-prompt.json`)
- [ ] 내 카카오톡 내보내기 TXT 를 실제로 올려 본다(30만 자 이하)
  - 자동: 미확인. 합성 픽스처로만 검증했다. 사람 확인이 필요한 핵심 항목
- [ ] 사건을 추가·수정·삭제하고 새로고침해도 그대로다
  - 자동: PASS (Playwright, `logs/gate1-analysis.md`)
- [ ] 문구가 자연스럽다. 'Choose File' 같은 영어 기본 문구, 영어 오류 문구가 거슬리는지 본다
  - 자동: P2 로 기록됨(파일 선택 버튼, zod 영어 오류)

## 2. 페르소나 생성 — http://localhost:3101/pocs/persona

- [ ] 사건을 골라 '과거의 나(직후)'를 만들면 이름이 '○○의 홍길동' 이고 말투·기억·감정이 그 사건과 맞는다
  - 자동: PASS. 19.6s, '친구와 다툰 날의 홍길동' (`persona-past-event.json`, 통합 재실행 21.1s)
- [ ] 현재의 나, 미래의 나도 만들어 본다. 미래의 나가 '꼭 성공해' 같은 예언을 하지 않는다
  - 자동: PASS (`persona-present.json`, `persona-future.json`)
- [ ] 내 얼굴 사진을 올리면 30초 안팎에 그 나이의 3D 아바타가 나온다. 나와 닮았는지 본다
  - 자동: PASS(합성 얼굴). 29.7~35.2s. 나이 차이 표현이 약하다는 P2 있음 (`persona-avatar-generated-*.png`)
- [ ] 결과 카드에서 성격·기억·감정을 한 글자씩 고치고 저장할 수 있다
  - 자동: PASS (e2e, `logs/gate1-persona.md`)
- [ ] 저장한 페르소나가 대화 화면 선택지에 나온다
  - 자동: PASS (e2e `inChat: true`)

## 3. 대화 — http://localhost:3101/pocs/chat

- [ ] 샘플 '15살의 홍길동'과 5턴 이상 대화한다. 답이 2초 안팎에 흘러나오기 시작하고, 그 나이 말투로 1~3문장이다
  - 자동: PASS. 첫 청크 평균 1.97s, 전체 4.44s (`chat-run.json`, `chat-transcript.md`)
- [ ] 감정을 묻고 서로 위로하는 흐름이 느껴진다. 상담사처럼 들리지 않는다
  - 자동: PASS(6턴 트랜스크립트). 사람 판단 필요
- [ ] 2번에서 만든 내 페르소나로 바꿔 대화한다. 과거의 나가 그 나이 이후 일을 모른다
  - 자동: PASS (`critic-chat-r1b-personas.json`)
- [ ] 새로고침하면 대화가 남아 있고, 초기화하면 첫 인사만 남는다
  - 자동: PASS (데스크톱·모바일 Playwright)
- [ ] 힘든 마음을 털어놓으면 말투를 유지한 채 걱정하고, 끝에 109 안내가 한 번 붙는다
  - 자동: PASS (`X-Crisis: 1`, 109 1회). 돌려 말한 표현은 감지하지 못한다(P2)

## 4. 5개 화면 — http://localhost:3101/pocs/screens

데스크톱(목업 안)과 휴대폰(또는 브라우저 폭 390px)에서 각각 본다. 원본: `docs/screens/drafts/01-landing.png` ~ `05-conversation.png`.

- [ ] 01 랜딩: http://localhost:3101/pocs/screens/landing — 3초 뒤 생성 화면으로 넘어간다
  - 자동: PASS. 약 3초 자동 이동, 유사도 8/10
- [ ] 02 생성: http://localhost:3101/pocs/screens/create
  - 자동: PASS. 유사도 8/10. 데스크톱 패널 하단과 CTA 사이가 좁다(P2)
- [ ] 03 목록: http://localhost:3101/pocs/screens/list — 2행 아바타가 드래프트와 같은 인물로 보이는지 본다
  - 자동: PASS. 유사도 7/10. 2행 아바타 그림체 차이를 두 모델이 다르게 판정(P1/P2), 사람 판단 필요
- [ ] 04 모달: http://localhost:3101/pocs/screens/modal — 슬라이더 5~80살, X·바깥 클릭으로 닫힌다
  - 자동: PASS. Esc 로는 닫히지 않는다(P2)
- [ ] 05 대화: http://localhost:3101/pocs/screens/chat
  - 자동: PASS. 유사도 8/10. 메시지를 보내도 맨 아래로 스크롤되지 않는다(P2)
- [ ] 전체 배경 단색(드래프트는 옅은 하늘색 그라데이션)이 괜찮은지 본다
  - 자동: P2 로 기록됨

## 판정

- [ ] Gate 1 PoC·화면 동결, Gate 2 진행 승인
- 메모:
