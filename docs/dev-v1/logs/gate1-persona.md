# Gate 1 — poc-persona (/pocs/persona)

이전 빌드 에이전트가 네트워크 장애(ENOTFOUND)로 보고 없이 멈춰서, 남은 코드를 점검하고 빠진 부분만 채웠다.

## 이어받을 때 상태

- 이미 있던 것: `packages/core/src/persona/{persona.ts,server.ts,persona.test.ts}`, `pocs/app/api/persona/route.ts`, `pocs/app/api/persona/avatar/route.ts`, `pocs/app/pocs/persona/*`, `pocs/fixtures/persona/*`(요청 4종, 샘플 사건, 합성 얼굴 사진, e2e.mjs), 증거 JSON 5개와 PNG 6개
- 없던 것: 이 로그, 증거를 다시 만드는 스크립트(아바타·페르소나 4케이스)

## 이번에 고친 것

| 문제 | 수정 |
|---|---|
| `/api/persona/avatar` 가 multipart 를 받아서 api.md·`AvatarRequestSchema` 계약(JSON `{age, kind, photo?: data URL}`)과 달랐다. 화면 단계에서 계약대로 부르면 400 이 난다 | 라우트를 JSON + `AvatarRequestSchema` 로 바꿨다. multipart 전용 `AvatarFormSchema`·`AVATAR_PHOTO_*` 와 해당 테스트는 지웠다. 본문 상한은 5.7MB(스키마 photo 5.6M 자 + 여유) |
| 결과 카드의 성격·기억·감정 칸이 키를 누를 때마다 다시 나뉘어, 끝에 친 쉼표·줄바꿈·띄어쓰기가 바로 사라졌다. 새 항목이나 두 단어짜리 항목을 칠 수 없었다(`fill()` 로 한 번에 넣던 e2e 로는 드러나지 않았다) | 목록 칸은 원문(`lists` 상태)으로 들고 있다가 저장할 때 나눈다. e2e 는 `pressSequentially` 로 한 글자씩 친다 |
| 현재의 나: 슬라이더를 잠가 두었는데 '지금 나이'를 바꾸면 요청 나이가 예전 값으로 남았다 | `theAge = kind==='present' ? currentAge : age` 로 요청·아바타·표시를 맞췄다 |
| LLM 초안의 줄바꿈이 그대로 남았다(chat 이 한 번 더 펴지만, 저장된 값 자체도 한 줄이 맞다) | `personaFromDraft` 의 `clip` 이 공백을 한 칸으로 펴고 자른다. 빈 greeting 은 '…왔어?' 로 바꾼다. 테스트 추가 |

## 요구사항 점검

| 요구사항 | 결과 | 근거 |
|---|---|---|
| POST /api/persona: kind·age·event?/eventId?·phase?·situation·events·profile·futureGoals → Persona | PASS | `PersonaGenerateRequestSchema`(계약 + event, futureGoals), 4케이스 200 |
| 이름 규칙 | PASS | '친구와 다툰 날의 홍길동', '12살의 홍길동', '지금의 홍길동', '30살의 홍길동' |
| 과거: 그 나이 이후는 모름 | PASS | `visibleEvents` 가 그 나이 뒤의 사건과 나이를 모르는 사건을 빼고 넘긴다. past-free(12살) memories 에 이사 이야기만 있다 |
| 과거: 사건 전·당시·직후 | PASS | `before` 는 사건 내용을 숨기고 분위기만 준다. past-event(직후) emotions: 서운함·분노·후회·억울함 |
| 과거: 사건 없으면 자유 대화 | PASS | past-free greeting "지호랑 또 얘기하고 싶다. 넌 어른이 됐으니까 모르는 사람이랑도 말 잘해?" |
| 현재: 성격·가치관·고민·감정 | PASS | present memories 에 퇴사 고민·멈춘 개인 작업, emotions 지침·불안·막막함 |
| 미래: 목표 기반 가상 인물, 단정 예언 금지 | PASS | future greeting 은 질문으로 끝나고 "~하게 될 거야" 같은 예언이 없다. 목표(그림책·가족)는 '바라는 마음'으로만 들어갔다 |
| 길이 제한·줄바꿈 정규화 | PASS | `personaFromDraft` 가 계약 한도(traits 10×40, speechStyle 500, memories 20×300, emotions 10×20, greeting 300)로 자르고 한 줄로 편다. 저장 전 `PersonaSchema.safeParse` 를 한 번 더 거친다 |
| POST /api/persona/avatar: 사진 없으면 기본 캐릭터(AI 호출 없음) | PASS | 23ms, `guide-face-512.png` |
| 사진 있으면 gpt-image-2 로 드래프트 스타일 아바타 | PASS | 15살 과거 29.7s, 40살 미래 35.2s(Server-Timing). 글로시 3D 토이, 파스텔 민트 배경, 안경·머리 모양 유지 |
| 클라이언트 리사이즈·한도·maxDuration·원본 미저장·지연 측정 | PASS | 긴 변 1024px JPEG(합성 사진 data URL 약 38만 자 ≈ 280KB), maxDuration 120 / 60, 사진은 메모리에서 `File` 로만 쓰고 저장하지 않는다, `Server-Timing: gen;dur=` + 화면에 'n초 걸렸어요' |
| /pocs/persona 폼·편집·확정 | PASS | e2e: 사건 선택 → 직후 → 사진 → 아바타 → 생성 → 감정 한 글자씩 추가 → 저장 |
| chat 연동 | PASS | chat 은 `mindme:personas` 의 `Persona[]`(또는 `{persona}[]`)를 `PersonaSchema` 로 읽는다. persona 는 `Persona[]` 를 쓴다. e2e `inChat: true`. 아바타는 256px WEBP data URL(약 13KB)로 줄여 저장 |

## 실행 결과 (2026-11-19, dev 서버 3101, 실제 AI 호출)

| 케이스 | 상태 | 시간 | 이름 |
|---|---|---|---|
| past-event (15살, 친구와 다툰 날, 직후) | 200 | 19.6s | 친구와 다툰 날의 홍길동 |
| past-free (12살, 사건 없음) | 200 | 18.3s | 12살의 홍길동 |
| present (26살) | 200 | 17.7s | 지금의 홍길동 |
| future (30살, 그림책 목표) | 200 | 25.0s | 30살의 홍길동 |
| avatar default | 200 | 0.02s | — |
| avatar past15 | 200 | 29.7s | 55.8KB webp |
| avatar future40 | 200 | 35.2s | 62.4KB webp |
| e2e (모바일 390) | 성공 | 아바타 30.0s, 페르소나 20.5s | savedEmotions 끝에 '외로운 마음' 이 그대로 들어감, inChat true |

검증 경로: avatar JSON 이 아니면 400 'JSON 형식이 아닙니다', photo 가 http URL 이면 400.

## 확인 명령

```bash
pnpm typecheck                                     # core·ui·pocs 통과
pnpm test                                          # 18 pass
node --test packages/core/src/persona/persona.test.ts   # 9 pass (루트 test glob 밖이라 따로 실행)
node pocs/fixtures/persona/persona-run.mjs         # 4케이스 → evidence/gate1/persona-*.json
node pocs/fixtures/persona/avatar-run.mjs          # 아바타 3건 → persona-avatar.json, persona-avatar-*.png|webp
node pocs/fixtures/persona/e2e.mjs                 # 화면 흐름 + 스크린샷 3장
```

## 증거

`docs/dev-v1/evidence/gate1/`: `persona-{past-event,past-free,present,future}.json`, `persona-avatar.json`, `persona-avatar-default.png`, `persona-avatar-generated-{past15,future40}.png`(webp 를 sips 로 PNG 변환), `persona-form-mobile.png`, `persona-result-{mobile,desktop}.png`

## 남은 문제

- 미래 케이스에서 모델이 '에이전시'를 '에이전리'로 두 번 연달아 잘못 썼다(입력 fixture 는 맞다). 결과 카드에서 고칠 수 있다. 화면 단계에서 자주 나오면 프롬프트에 '기록의 고유명사는 그대로 옮긴다'를 넣는다.
- `persona.test.ts` 가 `packages/core/src/persona/` 안에 있어 루트 `pnpm test` glob(`packages/*/test/**`)에 안 잡힌다. `packages/core/test/` 는 이 작업 소유가 아니라 옮기지 않았다. Integrate 에서 옮기거나 glob 을 넓힌다.
- 저장 실패 확인(`storage.get === null`)은 이전 목록이 남아 있으면 쓰기 실패를 놓친다. PoC 범위라 그대로 두었다.
- `gpt-image-2` 지연은 30~35s 다. Vercel Hobby 의 함수 시간 한도를 넘을 수 있어, 배포할 때 플랜 한도를 확인해야 한다.
