# Gate 1 기능 정의 (PoC 검증 결과)

2026-11-19 기준. 각 기능은 `/pocs/...` 에서 실제로 실행해 확인한 입출력만 적었다. API 상세는 `api.md`, 증거는 `evidence/gate1/`, 실행 로그는 `logs/gate1-<task>.md`.

- 텍스트 모델: OpenAI `gpt-6-astra`(Responses API, `MINDME_TEXT_MODEL` 로 교체 가능). 이미지: `gpt-image-2`(`MINDME_IMAGE_MODEL`). 호출은 모두 `packages/core/src/server/llm.ts` 를 거친다.
- 지연은 dev 서버(3101)에서 클라이언트가 잰 값이다. 배포 환경 지연은 Gate 3 에서 다시 잰다.
- 저장: 서버는 아무것도 저장하지 않는다. 클라이언트 localStorage 키는 `mindme:events`, `mindme:analysis:last`, `mindme:personas`, `mindme:chat:<personaId>`.

## F1. 기록 분석 → 사건 타임라인

| 항목 | 내용 |
|---|---|
| PoC · API | `/pocs/analysis` · `POST /api/analyze` · core `analyzeRecords`(`packages/core/src/analysis/`) |
| 입력 | `source`(kakao·diary·prompt), `text` 1~300,000자, `me?`(카톡 내 이름). 화면에서는 TXT 파일 열기·붙여넣기·예시 4종 |
| 출력 | `Event[]`(≤100, 시간순, `evt_01..`). 사건마다 제목·날짜(추정 여부)·나이·감정·인물·맥락·요약·`selfAtTime`(그때의 성격·말투·실제로 한 말) |
| 처리 | 카톡 PC·Android·iOS·Mac CSV 파서, 시스템 메시지와 사진·이모티콘 표시는 뺀다. 정리한 본문 40,000자 이하면 한 번에, 넘으면 날짜 경계로 30,000자씩 구간 요약(동시 4) 후 분석 |
| 화면 기능 | 타임라인 표시, 사건 추가·수정·삭제(EventSchema 검증, 시간순 재정렬), 새로고침 후 유지 |
| 지연 | 19.2~33.8s(direct), 45.0s(64,116자, 2구간). 통합 재실행 prompt 30.1s |
| 검증 | 픽스처에 심은 사건이 모두 나오고 없는 사건 0. 잡담만 있는 200여 일에서 가짜 사건 0. 나이 단서가 없으면 age 를 비워 둔다 |
| 제약·한계 | 실제 사용자 내보내기 파일로는 확인하지 않았다. 300,000자 입력은 실제로 보내 보지 않았다(10구간이면 2~3분). 여러 줄 메시지 안의 날짜 모양 줄을 구분선으로 오인한다. 다시 분석하면 직접 고친 타임라인이 확인 없이 바뀐다. 원문이 localStorage 에 평문으로 남는다 |
| 증거 | `evidence/gate1/analysis-{kakao-pc,kakao-mobile,diary,prompt,kakao-long}.json`, `analysis-page.png`, `integrate-analyze-prompt.json`, Critic `logs/gate1-critic-analysis-r1b.md` |

## F2. 페르소나 생성 (과거·현재·미래의 나)

| 항목 | 내용 |
|---|---|
| PoC · API | `/pocs/persona` · `POST /api/persona` · core `generatePersona`(`packages/core/src/persona/`) |
| 입력 | `kind`, `age`, `eventId?`/`event?`, `phase?`(before·during·after), `situation`, `events`(F1 결과), `profile`(이름·지금 나이·나의 이야기), `futureGoals?` |
| 출력 | `Persona`: 이름('친구와 다툰 날의 홍길동' · '12살의 홍길동' · '지금의 홍길동' · '30살의 홍길동'), 성격 ≤10, 말투 ≤500자, 기억 ≤20, 감정 ≤10, 첫 인사 ≤300자 |
| 규칙 | 과거: 그 나이 뒤의 사건·나이 모르는 사건은 AI 에 넘기지 않는다. 사건 전(before)은 사건 내용을 숨긴다. 미래: 목표 기반 가상 인물, 예언 금지. 나이 모순(과거 > 지금, 미래 ≤ 지금)과 없는 eventId 는 400 |
| 화면 기능 | 사건 선택 → 시점 → 생성 → 결과 카드에서 성격·기억·감정·말투·첫 인사 편집 → 저장(`mindme:personas`) → `/pocs/chat` 에서 선택 가능 |
| 지연 | 17.7~25.0s(4케이스). 통합 재실행 past-event 21.1s |
| 증거 | `evidence/gate1/persona-{past-event,past-free,present,future}.json`, `persona-form-mobile.png`, `persona-result-{mobile,desktop}.png`, `integrate-persona-past-event.json`, Critic `logs/gate1-critic-persona-r1b.md` |
| 제약·한계 | 과거 나이와 선택한 사건의 나이가 달라도 통과한다(선택 사건은 항상 프롬프트에 들어가 미래 지식이 샐 수 있다). present 의 age 와 currentAge 일치는 서버가 검사하지 않는다. 기록이 적으면 프롬프트 설정 문구가 기억으로 새어 나온다. 고유명사 오타가 가끔 나온다('에이전시' → '에이전리') |

## F3. 아바타 생성 (사진 → 그 나이의 3D 캐릭터)

| 항목 | 내용 |
|---|---|
| PoC · API | `/pocs/persona`(사진 올리기) · `POST /api/persona/avatar` · core `generateAvatar` |
| 입력 | `age`, `kind`, `photo?`(JPG·PNG·WEBP data URL). 클라이언트가 긴 변 1024px JPEG 로 줄인다(합성 사진 약 280KB) |
| 출력 | 사진 있음: `data:image/webp;base64,…`(55~70KB), `source: generated`. 없음: 기본 캐릭터 경로, `source: default`(AI 호출 없음). 화면은 256px WEBP(약 13KB)로 줄여 페르소나에 저장 |
| 지연 | 생성 29.7~35.2s(`Server-Timing`), 기본 0.02s. 통합 재실행 29.8s |
| 검증 | 글로시 3D 토이 스타일, 파스텔 배경, 안경·머리 모양 유지. 사진은 메모리에서만 쓰고 저장하지 않는다 |
| 제약·한계 | 30~35s 라 Vercel 함수 시간 한도(플랜별)를 확인해야 한다. 8살과 34살의 나이 차이가 약하다. 기본 캐릭터 경로에 빌드 해시가 붙어 다시 빌드하면 저장된 아바타가 깨진다 |
| 증거 | `evidence/gate1/persona-avatar.json`, `persona-avatar-default.png`, `persona-avatar-generated-{past15,future40}.png`, `critic-persona-r1b-avatar-*.png` |

## F4. 페르소나와 대화 (스트리밍)

| 항목 | 내용 |
|---|---|
| PoC · API | `/pocs/chat` · `POST /api/chat` · core `buildSystemPrompt`·`chatResponse`(`packages/core/src/chat/`) |
| 입력 | `persona?`(없으면 샘플 '15살의 홍길동'), `messages` 1~100개(마지막 user). 화면은 최근 40개를 보낸다 |
| 출력 | `text/plain` 스트림(답변 본문만), 헤더 `X-Crisis: 1|0` |
| 규칙 | 1인칭, 그 나이 말투, 메신저처럼 1~3문장, 감정 질문을 주고받되 상담사 말투 금지. 과거의 나는 그 나이 이후를 모른다. AI 에는 최근 24개·12,000자만 보낸다. 위기 키워드면 페르소나를 유지한 채 걱정하고, 서버가 끝에 109 안내를 1회 붙인다 |
| 화면 기능 | 저장된 페르소나·샘플 선택, 대화 저장(`mindme:chat:<id>`)·새로고침 복원·초기화, 입력 중 표시, 첫 글자·전체 지연 표시 |
| 지연 | 첫 청크 평균 1.97s(1.50~2.42), 전체 평균 4.44s(3.93~5.15). 통합 재실행 4.0s |
| 검증 | 6턴 + 위기 1건 실제 대화, persona 필드 탈출 공격 10건 중 코드·모드 전환 0건 |
| 제약·한계 | 위기 감지는 키워드라 돌려 말한 표현을 놓치고 마지막 메시지만 본다. persona.name 에 넣은 짧은 지시는 먹힌다(말투·언어 변경 수준, 위기 대응 무력화 0건). 답변 길이는 프롬프트로만 제한한다 |
| 증거 | `evidence/gate1/chat-run.json`, `chat-transcript.md`, `chat-{desktop,mobile}.png`, `chat-fix-r1-jailbreak.json`, `critic-chat-r1b-*.json`, Critic `logs/gate1-critic-chat-r1b.md` |

## F5. 5개 화면 프론트엔드 (기능 없이 화면만)

| 항목 | 내용 |
|---|---|
| PoC | `/pocs/screens`(= landing), `/pocs/screens/{landing,create,list,modal,chat}`. 컴포넌트는 `packages/ui/src/screens/*`(props 기반, Gate 2 재사용) |
| 입력 | 없음. 문구는 `docs/screens/drafts/prompts.json` 을 옮긴 `mock.ts` |
| 출력 | 01 랜딩 → 3초 뒤 02 생성 자동 이동(`?hold` 면 멈춤) → 03 목록 → 04 모달 → 05 대화. 데스크톱은 아이폰 목업 안, 모바일(≤600px)은 전체 화면 + safe-area |
| 검증 | 드래프트 대비 유사도 7~8/10, 인터랙션 25/25, 가로 스크롤 0. AI 호출 없음 |
| 제약·한계 | 배경 그라데이션 없음(단색), 목록 2행 아바타 그림체가 드래프트와 다름, 360px 폭에서 히어로 팔이 제목에 맞닿음, 대화 화면 자동 스크롤 없음, 모달 Esc 닫기 없음 |
| 증거 | `evidence/gate1/screens-{landing,create,list,modal,chat}-{desktop,mobile}.png`, `critic-screens-r1b-*`, `logs/gate1-screens.md`, `logs/gate1-critic-screens-r1b.md` |

## 연결

F1 `mindme:events` → F2(사건 선택) → F2·F3 `mindme:personas` → F4(대화). F5 는 Gate 2 에서 F1~F4 와 연결한다.
