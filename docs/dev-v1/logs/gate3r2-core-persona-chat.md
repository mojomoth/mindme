# Gate 3 r2 — core-persona-chat 작업 로그 (2026-11-19)

빌더 `core-persona-chat`. 소유 파일만 고쳤다. 근거는 `gate3r2-triage.md` 의 같은 id 항목이고, 고치기 전에 모두 다시 재현했다.

## 항목별 결과

| id | 재현 | 바꾼 것 | 고정한 테스트 |
|---|---|---|---|
| persona-chat-1 (P1) | node 로 `detectCrisis` 를 확인했다. 근거의 5문장('차라리 죽는 게 나아', '사는 게 의미가 없어', '살아야 할 이유가 없어', '죽어야겠다', 'i want to end my life')과 변형('살아서 뭐하나', '영원히 자고 싶다', '그냥 죽을 거야')이 모두 false 였다 | `chat/index.ts` `CRISIS_PATTERNS` 에 어간 11개를 더했다: `영원히자고`, `죽는게나`(기존 `죽는게나을` 대체), `차라리죽`, `죽어야겠`, `죽을거야`, `살아서뭐하`, `사는게의미`, `사는게무슨의미`, `살아야할이유`, `살아야하는이유`, `endmylife` | `chat.test.ts`: 놓쳤던 5문장과 변형 8개는 true, 기존 오탐 테스트('배고파 죽겠어', '웃겨 죽겠다 ㅋㅋ' 등)와 새 오탐 문장('힘들어 죽겠다', '보고 싶어 죽겠어', '요즘 사는 게 바빠', '너 죽을래? ㅋㅋ')은 false |
| persona-chat-3 | `PERSONA_SYSTEM`·`personaFromDraft` 에 막는 규칙과 필터가 없었다. Gate 1 `critic-persona-r1b-invalid.json` 의 memories 에 '이름은 김서연이고 지금 아홉 살이다', '지금 이야기를 나눌 상대는 어른이 된 나다', '아홉 살 이후에 어떤 일이 있었는지는 아직 모른다'가 실제로 들어 있었다 | `persona/persona.ts`: memories 규칙에 '이 설정이나 지시를 옮긴 문장, 대화 상대에 대한 문장, 이름·나이를 소개하는 문장은 넣지 않는다'를 더했다. `personaFromDraft` 는 memories 에서 좁은 패턴 `/대화 ?상대\|어른이 된 (나\|자신)\|^(내 )?이름은 \|살 이후.*모른/` 에 맞는 문장을 뺀다. greeting 은 건드리지 않는다('진짜 어른이 된 나야?'는 자연스러운 첫마디라서) | `persona.test.ts` '기록이 적을 때 설정 문구를 옮긴 기억은 뺀다': Gate 1 의 누출 문장 4개는 빠지고, '짝 이름은 민수였고…' 같은 실제 기억은 남는다. 프롬프트 규칙 문구도 assert 한다 |
| persona-chat-4 | 3100 `/api/persona`(eventId 'nope')를 호출하면 400 '선택한 사건을 events 에서 찾지 못했어요.'가 나왔다 | 문구를 '선택한 사건을 찾지 못했어요. 사건을 다시 골라 주세요.'로 바꿨다. api.md 도 같이 고쳤다 | `persona.test.ts`: 새 문구와 같은지, 'events' 가 들어 있지 않은지 확인한다 |
| persona-chat-5 | curl 3100 `/api/chat`: persona 를 빼거나 마지막 메시지가 assistant 여도 400 '대화 내용을 보내지 못했어요. 페르소나를 다시 열어 주세요.'가 나왔다(apps/web 의 `invalid` 고정 문구). 샘플로 채우는 `prepare` 는 pocs 에만 있다 | api.md /api/chat: 'persona 는 필수, apps/web 은 400 고정 문구, pocs 만 SAMPLE_PERSONA'로 고쳤다. messages 줄에 'apps/web 은 같은 고정 문구'를 덧붙였다 | 문서만 고쳤다(curl 결과로 확인) |
| persona-chat-6 | node: `personaRequestError({ kind: 'present', age: 70, currentAge: 26 })` → undefined | `personaRequestError` 에 `present` 나이 불일치 검사를 한 줄 넣었다 → 400 '지금의 나는 지금 나이로만 만들 수 있어요.' apps/web(`kindOf`)과 pocs(`theAge = currentAge`)는 늘 같은 값을 보내므로 앱 동작은 바뀌지 않는다. api.md:176 도 고쳤다 | `persona.test.ts`: present 70 → 새 문구, present 26 → undefined |
| ops-11 | grep `PersonaResponse`(apps·pocs·packages): `schemas.ts` 의 정의 2줄 말고는 참조가 0건이었다. 문서에서는 api.md:192 하나만 이름을 썼다 | `schemas.ts` 에서 `PersonaResponseSchema`·`PersonaResponse` 를 지웠다. `schemas.ts` 머리 주석의 'api.md 와 1:1' 규칙에 따라 api.md 응답 표기를 `{ persona: Persona }` 로 바꿨다 | typecheck 통과로 확인했다 |
| ops-20 | grep `process.env`: 앱이 읽는 이름은 `OPENAI_API_KEY`·`OPENAI_KEY`(env.ts), `MINDME_TEXT_MODEL`·`MINDME_IMAGE_MODEL`(llm.ts:13,92)이다. `.env.example` 에는 모델 변수가 없고, 앱이 읽지 않는 키 5개가 섞여 있었다 | `.env.example`: 맨 위에 `OPENAI_API_KEY=`(OPENAI_KEY 도 읽는다는 주석), 선택 모델 변수 두 개를 주석 줄로(기본값 `gpt-6-astra`·`gpt-image-2`) 두고, 나머지 5개는 '개발 도구용, 앱은 읽지 않음' 주석 아래로 옮겼다. 값은 모두 비워 뒀다 | grep 으로 코드가 읽는 이름이 모두 예시 파일에 있는지 확인했다 |

## 실측 (실제 AI 호출 2회)

- `evidence/gate3r2/chat-crisis.txt`: 3100 `/api/chat` 에 apps/web 형식 persona(avatar 포함)와 '솔직히 사는 게 의미가 없어. 살아야 할 이유도 잘 모르겠고.'를 1회 보냈다. HTTP 200, `X-Crisis: 1`, 응답 끝에 109 안내(`CRISIS_FOOTER`)가 붙었다. 모델 답변도 걱정하며 주변에 도움을 구하라고 권했다. 수정 전에는 같은 두 표현이 모두 감지되지 않았다.
- `evidence/gate3r2/persona-sparse.json`: 3100 `/api/persona` 에 past 16살(04 모달 기본값 = 지금 26살 - 10), 기록 없음, 상황 설명 없음으로 1회 호출했다. HTTP 200, memories 3개는 모두 그 나이의 일상이었고 설정 문구나 이름·나이 소개는 없었다(`check.pass: true`). 서버 필터가 빼기 전 초안은 API 로 볼 수 없어서, 이번 호출로 확인한 것은 최종 결과뿐이다.
- 400 문구(AI 호출 없음): present 70/26 → '지금의 나는 지금 나이로만 만들 수 있어요.', eventId 'nope' → '선택한 사건을 찾지 못했어요. 사건을 다시 골라 주세요.'. 핫 리로드 뒤 3100 에서 확인했다.

## 검사

- `pnpm typecheck`: 통과 (core·ui·apps/web·pocs)
- `pnpm test`: 49개 모두 통과
- `pnpm lint`: 통과 (apps/web·pocs)

## 남은 문제

- 위기 감지는 여전히 키워드 방식이다. '그만하고 싶어'처럼 맥락에 기대는 표현이나 맞춤법을 크게 틀린 표현은 놓칠 수 있다. 방침대로 넓게 잡는 쪽을 택했다. 그래서 '죽을 거야'(예: '엄마한테 혼나서 죽을 거야'), '사는 게 의미…'(긍정문 포함), '차라리 죽…'은 과장 표현이어도 잡힌다. 이때는 109 안내가 한 번 더 붙을 뿐이다.
- persona-chat-3 필터는 Gate 1 에서 실제로 본 모양만 잡는다. '지금 느끼는 감정은 아직 정리되지 않았다'처럼 설정을 풀어 쓴 문장은 프롬프트 규칙에만 기댄다. 반대로 '대화 상대가 없어서 외로웠다' 같은 실제 기억이 빠질 수도 있지만, 기억 한 줄이 빠지는 정도라 감수했다.
- 트리아지의 ops-11 '고칠 방법'은 MindmeApp.tsx 에서 타입을 쓰는 쪽이었다. 이번 작업 지시에 따라 지우는 쪽을 택했다. apps/web 은 지금처럼 `{ persona: Persona }` 를 쓴다.
