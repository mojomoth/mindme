# Gate 3 정리 (Builder)

감사(`logs/gate3-audit.md`)에서 삭제 대상으로 짚은 P1 8건을 처리했다. 동작은 바꾸지 않았고, 지운 코드만 있다.
바뀐 줄: 추가 39 / 삭제 93 (`evidence/gate3/cleanup-diff.patch`, 이 작업분만 따로 뽑음).

## 처리 내역

| # | 대상 | 한 일 |
|---|---|---|
| 1 | `packages/ui/assets/guide-face-256.png` | 파일 삭제, `assets.ts` 의 import·`guideFace` 키 삭제. 빌드 후 `apps/web/.next/static/media` 에 `guide-face-256.*` 0건 |
| 2 | `pocs/app/pocs/persona/PersonaPoc.tsx` | 복사본 `shrink`·`toDataUrl`(21줄) 삭제, `@mindme/ui` 의 `shrinkImage`·`blobToDataUrl` 사용. ui 쪽은 `onerror` 도 처리하므로 읽기 실패 시 멈추지 않고 오류로 끝난다 |
| 3 | `apps/web/app/MindmeApp.tsx` | 지역 상수 `MAX_TEXT` 삭제, `@mindme/core` 의 `MAX_INPUT_CHARS` 사용 |
| 4 | `packages/core/src/server/llm.ts`, `ai.ts` | 아무도 넘기지 않던 `model?`(generateObject·streamText·editImage), `size`·`format`·`quality`·`timeoutMs` 삭제. 기본값(1024x1024, medium, webp, 압축 80, 110초)을 본문에 고정. `MODELS.openai.sol` 삭제. env 폴백을 `??` 에서 `||` 로 바꿔 빈 `MINDME_TEXT_MODEL=`·`MINDME_IMAGE_MODEL=` 도 기본 모델로 간다 |
| 5 | `packages/core/src/schemas.ts` | `ErrorResponseSchema`·`ErrorResponse`·`SelfAtTime`·`PersonaRequest` 삭제 |
| 6 | core·ui export | `export` 만 뗌: `issueMessage`, `birthYearOf`, `LlmEventSchema`, `CHAT_LIMITS`, `clientIp`, `AgeSchema`, `SelfAtTimeSchema`, `Provider`, `PersonaDraft`, `KakaoMessage`·`KakaoChat`·`DiaryEntry`. ui `index.ts` 의 `Avatar` 재수출 줄 삭제(화면 컴포넌트는 상대 경로로 가져옴). `LlmEvent` 타입은 테스트가 쓰므로 그대로 둠. ui `*Props` 타입도 관례대로 둠 |
| 7 | `pnpm-workspace.yaml` | `allowBuilds: protobufjs: false` 두 줄 삭제 |
| 8 | `pocs/app/pocs/page.tsx`, `pocs.module.css` | `ready` 필드·'준비 중' 분기·안내 문장 삭제. `.badge` 선택자와 그 분기에서만 쓰던 `.item[aria-disabled]` 삭제, `.badgeOn` 한 규칙으로 합침. `.lead` 는 `pocs/app/page.tsx` 등이 쓰므로 남김 |

pocs 는 PoC 기록이라 파일을 지우지 않았고, 중복 코드만 packages 로 모았다.

## 확인

| 항목 | 결과 | 증거 |
|---|---|---|
| `pnpm typecheck` (core·ui·pocs·web) | PASS | — |
| `pnpm lint` (web·pocs) | PASS | — |
| `pnpm test` | PASS 45/45 | `evidence/gate3/cleanup-test.txt` |
| `pnpm build:web` | PASS | `evidence/gate3/cleanup-build-web.txt` |
| `pnpm build` (pocs) | PASS | `evidence/gate3/cleanup-build-pocs.txt` |
| 3100 주요 플로우 (모바일 390, 실제 AI) | PASS: 랜딩 → 만들기(카톡 TXT·이야기·사진) → 진행 → 목록(페르소나 3개, 아바타 모두 `data:image/webp` 생성본) → 대화 답 95자 스트리밍, 오류 안내 없음. 80초 | `evidence/gate3/cleanup-flow.{mjs,json}`, `cleanup-0{1..4}-*.png`, `cleanup-flow.txt` |
| 3101 pocs | PASS: 목록 4개 모두 '열기', 페르소나 PoC 사진 줄이기 `279KB → 186KB` (ui `shrinkImage`) | `cleanup-05-pocs-index.png`, `cleanup-06-pocs-persona-photo.png` |
| 브라우저 콘솔 오류·경고 | 0건 | `cleanup-flow.json` |
| 응답 본문 키 검사 | 78개 본문에서 0건. 증거 파일 `sk-` 패턴 0건 | `cleanup-flow.json` |

## 남긴 것

- `report.md` 97행 'protobufjs 설치 스크립트 차단'은 Gate 0 결정 기록이라 고치지 않았다. 지금은 설정이 없다는 점만 Close 단계에서 덧붙이면 된다.
- dev 서버 3100·3101 은 켜 둔 채로 마쳤다.
