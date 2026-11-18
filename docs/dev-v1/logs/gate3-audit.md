# Gate 3 · audit (불필요한 UI·코드)

- 일시: 2026-11-19
- 역할: 독립 감사(ponytail-audit). 코드는 고치지 않았다. 이 로그와 `evidence/gate3/audit-*` 만 만들었다.
- 범위: `packages/core`, `packages/ui`(assets 포함), `apps/web`, `pocs`, `scripts`, 루트 설정. 원본 보관인 `assets/generated` 와 제공 자료 `docs/screens/**`, 다른 에이전트 소유인 `.claude/skills/**` 는 제외했다.
- 기준 상태: Gate 3 polish-client·polish-server 변경이 커밋되지 않은 작업 트리. `pnpm test` 45/45 통과.

## 확인 방법

| 도구 | 결과 | 증거 |
|---|---|---|
| `tsc --noUnusedLocals --noUnusedParameters` (4패키지, 임시 실행) | 0건 | — |
| `npx knip@5` 기본 + `--include-entry-exports` | 안 쓰는 export 5개 파일, 안 쓰는 타입 11개. 안 쓰는 의존성 0 | `evidence/gate3/audit-knip.txt` |
| export 이름을 레포 전체에서 grep (테스트·pocs·fixtures·scripts 포함) | knip 이 놓친 `LlmEventSchema`, ui `Avatar` 재수출, `MODELS.openai.sol` 을 더 찾음 | — |
| CSS Module 클래스 ↔ `styles.x`/`shared.x` 대조 (스크립트) | 안 쓰는 클래스 0 (Working 의 `todo·active·done` 은 `styles[s.state]` 로 씀) | — |
| apps/web 빌드 산출물 `.next/static/media` | 실제로 쓰지 않는 PNG 가 3개 함께 나감 | 아래 P1-1, P2-1 |
| Playwright 로 3100 첫 화면 내려받는 파일 측정 (모바일 390x844, 데스크톱 1440x900) | 모바일에서도 목업 PNG 263KB·폰트 2.06MB 를 받음 | `evidence/gate3/audit-media.json`, 스크립트 `audit-media.mjs` |
| 키 노출 | 작업 트리(.env 제외)·git 전체 이력에 `sk-…` 패턴 0, `NEXT_PUBLIC_` 0, 클라이언트 청크에 키 이름·프롬프트 문자열 0 | — |

## 보안 (P0/P1)

없음. 키는 서버 `env.ts → ai.ts` 에서만 읽고, 클라이언트 청크에는 `PERSONA_SYSTEM`·`ANALYZE_SYSTEM` 같은 프롬프트도 들어가지 않는다(트리 셰이킹 확인). 속도 제한이 인스턴스별 메모리라는 점은 코드 주석에 한계를 적어 둔 결정이라 다시 올리지 않는다.

## P1 — 삭제 대상 (지워도 동작이 바뀌지 않음)

1. **아무도 쓰지 않는 마스코트 이미지** — `packages/ui/assets/guide-face-256.png`(36KB), `packages/ui/src/components/assets.ts:3,13`
   - `characters.guideFace` 를 부르는 곳이 apps·pocs·ui 어디에도 없다. 그런데 import 되어 있어서 apps/web 빌드에 `guide-face-256.*.png` 로 함께 나간다.
   - 고칠 것: PNG 와 import·키 두 줄을 지운다.

2. **PoC 에 남은 이미지 도우미 복사본** — `pocs/app/pocs/persona/PersonaPoc.tsx:58-76` (`shrink`, `toDataUrl`)
   - `packages/ui/src/image.ts` 의 `shrinkImage`·`blobToDataUrl` 과 줄 단위로 같다(ui 쪽 주석도 "PoC persona 화면에서 옮김"). 옮긴 뒤 원본을 지우지 않았다.
   - 고칠 것: 이미 `@mindme/ui` 에서 `webNative` 를 가져오는 줄에 두 함수를 더하고 복사본 약 19줄을 지운다. 다른 점은 ui 쪽이 읽기 실패 때 reject 한다는 것 하나다(지금은 영원히 기다림).

3. **같은 상한을 앱이 따로 들고 있음** — `apps/web/app/MindmeApp.tsx:39` `const MAX_TEXT = 300_000`
   - core 가 이미 `MAX_INPUT_CHARS`(analyze.ts:14)를 내보내고 pocs 는 그걸 쓴다. 한쪽만 바꾸면 파일 선택 화면과 서버 상한이 어긋난다.
   - 고칠 것: `MAX_INPUT_CHARS` 를 import 하고 상수를 지운다. 값이 같아서 동작은 그대로다.

4. **아무도 넘기지 않는 LLM 옵션** — `packages/core/src/server/llm.ts:26,53,91-95`, `ai.ts:8`
   - `generateObject`·`streamText`·`editImage` 의 `model?`, `editImage` 의 `size`·`format`·`quality`·`timeoutMs` 를 넘기는 호출이 하나도 없다(호출부: `persona/server.ts`, `chat/server.ts`, `test/llm-smoke.ts`). 모델은 환경 변수(`MINDME_TEXT_MODEL`·`MINDME_IMAGE_MODEL`)로 바꾼다.
   - `MODELS.openai.sol`('gpt-6.1-sol')도 읽는 곳이 없다. 대체 모델은 report.md 대로 환경 변수로 바꾸면 된다.
   - 고칠 것: 옵션을 지우고 기본값(`1024x1024`, `medium`, `webp`, 110초)을 본문에 둔다. 약 8줄.

5. **어디에도 안 쓰는 스키마·타입** — `packages/core/src/schemas.ts:62-64,148,154,157`
   - `ErrorResponseSchema`·`ErrorResponse`, `SelfAtTime`, `PersonaRequest`(앱은 `PersonaGenerateRequest` 를 씀)는 정의만 있고 코드·테스트·api.md 어디서도 이름으로 부르지 않는다.
   - 고칠 것: 네 정의(6줄)를 지운다. 타입·미사용 상수라 런타임 영향이 없다.

6. **밖에서 안 쓰는 export 키워드** — 파일 안에서만 쓰는 이름
   - core: `issueMessage`(errors.ts), `birthYearOf`·`LlmEventSchema`(analyze.ts), `CHAT_LIMITS`(chat/index.ts), `clientIp`(http.ts), `Provider`(env.ts), `PersonaDraft`(persona.ts), `KakaoMessage`·`KakaoChat`·`DiaryEntry`(parse.ts), `AgeSchema`·`SelfAtTimeSchema`(schemas.ts)
   - ui: `index.ts:14` 의 `Avatar` 재수출(앱·pocs 는 `Avatar` 를 직접 쓰지 않음)
   - 고칠 것: `export` 만 뺀다(ui 의 `Avatar` 는 줄 삭제). ui 화면 `*Props` 타입 export 는 컴포넌트 라이브러리의 관례라 남겨도 된다.

7. **사라진 의존성의 빌드 설정** — `pnpm-workspace.yaml:5-6` `allowBuilds: protobufjs: false`
   - protobufjs 는 `@google/genai` 가 끌고 오던 패키지다. Gate 3 에서 `@anthropic-ai/sdk`·`@google/genai` 를 뺐고, `pnpm-lock.yaml` 에 protobuf 가 0건이다.
   - 고칠 것: 두 줄을 지운다.

8. **PoC 목록의 죽은 분기** — `pocs/app/pocs/page.tsx:5-8,15,19-27,43`, `pocs.module.css:52` `.badge`
   - 네 항목이 모두 `ready: true` 라서 '준비 중' 분기와 `.badge` 는 그려지지 않는다. "Gate 1 에서 하나씩 채워 나갑니다." 안내도 지난 이야기다.
   - 고칠 것: `ready` 필드와 분기, `.badge` 선택자를 지우고 안내 문장을 뺀다. 약 12줄.

## P2 — 판단이 필요한 것

1. **pocs 목업에만 쓰는 아바타 2장이 앱 빌드에 포함** — `characters.avatarTeen`·`avatarYoung` 은 `pocs/app/pocs/screens/mock.ts` 만 쓴다. ui 의 `characters` 에 묶여 있어 apps/web `.next/static/media` 에 92KB 가 함께 나간다(내려받지는 않음). pocs 가 직접 import 하게 옮길지, 그냥 둘지 정한다.
2. **앱이 부르지 않는 아바타 기본값 분기** — `apps/web/app/api/persona/avatar/route.ts` 는 사진이 없을 때 `guide-face-512.png` 경로를 돌려주지만, 앱은 사진이 없으면 이 API 를 부르지 않는다(route 주석에도 있음). 그래도 빌드에 `guide-face-512.*.png` 가 들어간다. api.md 계약(`source: 'default'`)을 유지할지 정한다.
3. **보내는 쪽이 없는 요청 필드** — `PersonaGenerateRequestSchema.event`(persona.ts:20, 65). 앱·pocs 어느 화면도 `event` 를 보내지 않고 테스트 1건만 쓴다. api.md 에 적힌 계약이라 지우려면 api.md 도 바꿔야 한다.
4. **`PersonaResponseSchema`·`PersonaResponse` 가 코드에서 안 쓰임** — api.md 가 응답 스키마로 이름을 적어 두었다. `MindmeApp.tsx:88` 의 `{ persona: Persona }` 를 이 타입으로 바꾸든지, 스키마를 지우고 api.md 를 고친다.
5. **`plainName` 우회** — core `personaName` 이 긴 제목을 '…'로 자르고, 앱 `lib/data.ts:46` 이 그 이름을 다시 '17살의 …'로 바꾼다. apps/web 에서는 core 의 자르기 분기가 결과에 남지 않는다. core 를 고치면 `plainName` 과 호출 3곳을 지울 수 있지만, pocs 에 보이는 이름도 바뀐다(gate3-client 로그에 같은 판단이 있음).
6. **모바일에서도 목업 PNG 를 내려받음** — `PhoneFrame.tsx:20` 의 `<img>` 는 600px 이하에서 `display: none` 이지만 브라우저는 그래도 받는다. 390x844 실측 263,471바이트(`audit-media.json`). `<picture><source media="(max-width: 600px)" srcset="data:,">` 한 줄이나 CSS 배경으로 옮기면 모바일 첫 화면에서 빠진다. 화면 모습은 그대로다.
7. **폰트 2.06MB 전체본** — `packages/ui/src/fonts/pretendard.woff2` 를 모바일·데스크톱 모두 첫 방문에 받는다. KS X 1001 + 라틴 서브셋으로 줄이면 수백 KB 로 줄지만, 새 파일을 만드는 작업이고 드래프트와 글자 모양이 같은지 다시 봐야 한다.
8. **루트 `pnpm build` 가 pocs 를 빌드** — `package.json` 의 `build` 는 `@mindme/pocs`, 배포 대상 빌드는 `build:web` 이다. Vercel 을 루트 기준으로 설정하면 pocs 가 배포될 수 있다. 배포 설정에서 Root Directory 를 `apps/web` 으로 두거나 `build` 를 web 으로 바꾼다.
9. **기본값만 쓰는 화면 옵션** — `PersonaModal` 의 `minAge`·`maxAge`, `PersonaCreate` 의 `storyMax` 를 넘기는 곳이 없다. 지우면 줄은 줄지만 값이 컴포넌트 안에 고정된다.
10. **빈 환경 변수에서 모델 이름이 빈 문자열** — `llm.ts:13,101` 이 `?.trim() ?? 기본값` 이라 `MINDME_TEXT_MODEL=` 처럼 비워 두면 `''` 로 호출해 400 이 난다(`llm-smoke.ts` 는 `||` 를 씀). P1-4 를 고칠 때 `||` 로 바꾸면 된다. Vercel 에 빈 값으로 등록하지 않으면 생기지 않는다.
11. **모달의 같은 계산 두 번** — `MindmeApp.tsx` 의 `sameNamed`(279-280)와 `createFromModal`(287-288)이 `kindOf`·`nearestEvent` 를 똑같이 계산한다. onSubmit 에서 한 번 계산해 넘기면 두 줄이 준다.
12. **pocs 의 옛 저장 모양 호환** — `PersonaPoc.tsx:43`(`{ events }`), `Chat.tsx:25`(`{ persona }`)는 예전 PoC 가 저장하던 모양을 읽는다. 지금 PoC 는 배열로만 저장한다. 개발자 브라우저(3101)에 옛 데이터가 남아 있을 수 있어 그대로 둬도 된다.
13. **pocs 수동 실행 스크립트** — `pocs/fixtures/persona/{avatar-run,e2e,persona-run}.mjs` 와 `req-*.json` 은 코드에서 부르지 않는다(knip 'unused files'). `logs/gate1-persona.md` 가 근거로 쓰므로 Gate 1 증거로 남길지, `evidence/gate1/` 로 옮길지 정한다.
14. **`.env.example`** — 코드가 읽는 키는 `OPENAI_API_KEY` 하나와 선택값 `MINDME_TEXT_MODEL`·`MINDME_IMAGE_MODEL` 인데, 예시 파일은 쓰지 않는 키 5개를 싣고 `MINDME_*` 는 없다. 스펙이 .env 키 목록을 정해 두었으니 남길지 판단한다.
15. **문서가 지운 의존성을 가리킴** — report.md '버전 고정' 표에 `@anthropic-ai/sdk`·`@google/genai`·protobufjs 차단이 아직 있다. 메인 소유 문서라 고치지 않았다.

## 줄 수

- P1 을 모두 적용하면 약 -60줄, PNG 1개(36KB), 설정 2줄. 새로 더하는 코드는 import 2곳뿐이다.
- 의존성은 이미 정리돼 있다(-0). knip 기준 안 쓰는 의존성 없음.

## 결론

STATUS: PASS (P0 0, 보안 P1 0). 삭제 대상 P1 8건은 동작을 바꾸지 않는 정리라, 배포 전에 한 번에 지우고 `pnpm typecheck·test·lint·build:web` 만 다시 돌리면 된다. P2 15건은 기록하고 진행해도 된다.

## 읽지 않은 것

- `pocs/app/pocs/analysis/Analysis.tsx`·`PersonaPoc.tsx`·`chat/Chat.tsx` 는 앞부분과 grep 으로만 봤다(개발 화면, 배포 대상 아님).
- CSS 파일 안의 규칙 중복(같은 값 반복)은 보지 않았다. 클래스 사용 여부만 확인했다.
- `.claude/skills/**`, `docs/screens/**`, `assets/generated/**` 는 범위 밖이다.
