# Gate 3 · polish-client

report.md '열린 P2' 중 클라이언트·UI 항목만 고쳤다. 파일 범위는 `apps/web/**`(app/api 제외)와 `packages/ui/**`. 서버·core 는 건드리지 않았다.

## 결과

| # | 항목 | 결과 | 증거 |
|---|---|---|---|
| 1 | 답을 받는 중에 '나가기' | 요청이 취소되고(`net::ERR_ABORTED`) 질문만 저장된다. 다시 들어가면 '답을 받지 못했어요.' + '다시 받기'가 보이고, 누르면 답을 받는다(실제 OpenAI 4.0초) | `client-after-05-reenter-unanswered.png`, `client-real-05-*.png`, `client-real-chat-abort.json` |
| 2 | 모달에서 같은 이름 페르소나 중복 | 만들기 전에 이름을 미리 계산해 같은 이름이 있으면 "‘15살의 이지우’ 페르소나가 이미 있어요. 그 대화를 이어갈까요?"를 묻는다. '대화 이어가기' → 기존 대화, '새로 만들기' → 그대로 생성. `/api/persona` 호출 0회 | `client-after-04-duplicate.png` |
| 3 | 다시 시도할 때 아바타 다시 그림 | 성공했거나 그리는 중인 아바타를 재사용한다. persona 1회 실패 → 다시 시도: persona 2회, avatar **1회** | `client-after.json` `retry` |
| 3+ | (찾은 버그) 실패 화면이 사라짐 | persona 가 먼저 실패하고 아바타가 늦게 끝나면, 늦은 진행 표시가 실패 화면을 덮어써서 '다시 시도' 버튼 없이 '만들고 있어요'에 멈췄다. 진행 표시에 작업 번호를 붙이고, 실패한 뒤에는 더 바꾸지 않는다 | `client-before-03-retry-stuck.png` |
| 4a | 03 하단 안내 | 생성 버튼 영역은 `position: sticky` 라서 흐름 안에 자기 높이(버튼 50 + 위 12 + 아래 safe-area)만큼 자리를 차지한다. 스크롤 끝 여백이 이미 '버튼 높이 + safe-area'라 가리지 않는다. 안내 글자와 버튼 영역이 딱 붙어 있어서 8px 띄웠다(스크롤 끝 간격 0 → 8px). 첫 화면에서는 페르소나가 많으면 안내가 접히는 선 아래에 있는 것이 정상이다 | `client-after-03-list-top.png`, `-03-list-end.png` |
| 4b | 02 모바일 첫 화면 | 모바일 높이 880px 이하에서 캐릭터(120→92)·업로드 칸(125→100)·이야기 칸(3줄→2줄)·위 여백을 줄였다. 390x844: 사진 카드 아래 763 < 버튼 778. 360x740: 이름·나이 줄 아래 605 < 버튼 674(사진 카드는 스크롤) | `client-after-02-create-390.png`, `-360.png` |
| 4c | 입력란 안에서 스크롤할 때 반쯤 보이는 줄 | 위아래 padding 을 투명 테두리로 바꿨다. padding 은 스크롤 영역에 들어가 그 자리에 윗줄이 걸쳐 보이고, 테두리는 스크롤 밖이다. 높이 = 줄 수 × 22px. 끝까지 내렸을 때 잘린 픽셀: 04 모달 7→0, 05 입력창 1→0, 시트 말투 17→0, 기억 19→0. 시트는 flex 가 칸을 눌러 높이가 줄던 것도 막았다(`flex: none`) | `client-before.json` / `client-after.json`, `client-*-04-modal-textarea.png`, `client-*-05-composer.png` |
| 4d | 긴 이름 말줄임 두 번 | core 가 40자에 맞추려고 사건 제목을 '…'로 자른 이름이면 클라이언트가 '17살의 이지우'로 바꿔 저장한다(`plainName`). 화면 말줄임은 한 번만 남는다 | `client-after.json` `longName`, `client-after-03-after-retry.png` |
| 5 | 프로필 시트 | 옅은 하늘색 바탕 위 흰 카드 3묶음(이름 / 성격·말투 / 기억·감정), 흰 테두리 큰 원형 아바타(88→112), 제목은 페르소나 이름, 라벨 13px, 테두리 없는 채움 입력란, 주황 '저장'. hex 는 tokens 변수로 바꿨다(ProfileSheet 10곳, Working 6곳 → 0) | `client-after-06-profile-sheet-*.png` |
| 6 | analyze owner 기본값 | 이름·나이를 비워 두면 owner(없으면 `meta.me`)를 쓴다. 나이는 이제 비워 둘 수 있고(`required` 제거), owner 에도 없으면 입력 화면으로 돌아가 "기록에서 지금 나이를 찾지 못했어요. 지금 나이를 적어 주세요."를 띄운다. 분석 결과는 캐시돼 다시 분석하지 않는다 | `client-after.json` `ownerProfile` |
| 7 | 카메라 권한 | 사진은 `webNative.pickPhoto()` → `<input type=file accept="image/*">`(이미 그렇게 돼 있음, 모바일에서 카메라·앨범 선택). `apps/web/next.config.ts` 에 `Permissions-Policy: camera=(self), microphone=(), geolocation=()`. 파일·사진 선택은 여전히 `NativeAdapter` 한 곳에서만 한다(앱·화면 코드에 `input[type=file]`·`getUserMedia` 없음) | `client-after.json` `permissionsPolicy` |

## 결정과 근거

- **중복은 이름에 번호를 붙이지 않고 묻는다.** '15살의 이지우 (2)'는 사람 이름처럼 읽히지 않는다. 같은 이름을 다시 만드는 경우 대부분은 그 대화를 다시 찾으려는 것이라 '대화 이어가기'를 주 버튼으로 둔다. 상황이 달라 일부러 새로 만들려는 사람을 막지 않으려고 '새로 만들기'도 남긴다. 이름은 프로필 시트에서 바꿀 수 있다.
- 같은 이름 판정은 서버와 같은 함수(`personaName` + `nearestEvent`)로 미리 계산한다. 서버 호출 없이 모달 안에서 바로 묻는다.
- 아바타 캐시는 모듈 안 `Map<종류:나이:사진, Promise>`. 진행 중인 요청도 재사용하고, 실패한 그림은 지워서 다음 시도에 다시 그린다. 페르소나가 만들어지면 지운다(성공한 두 페르소나가 같은 그림을 나눠 쓰지 않게).
- 긴 이름은 core 를 고치지 않고 클라이언트에서 바꿨다(소유권). core `personaName` 이 잘린 제목 대신 나이 이름을 쓰게 바꾸면 `plainName` 을 지울 수 있다.
- 이미 저장된 '…' 이름은 바꾸지 않았다. 새로 만든 페르소나부터 적용된다.

## 확인

- `pnpm typecheck` 4패키지, `pnpm test` 45/45(`plainName` 1건 추가), `pnpm lint`, `pnpm --filter @mindme/web build` 통과
- `node docs/dev-v1/evidence/gate3/client-capture.mjs <before|after>`: AI 호출을 route 로 흉내 낸 재현(비용 0). 수정 전 `client-before.json`, 수정 후 `client-after.json`, 페이지 오류 0
- `node docs/dev-v1/evidence/gate3/client-real-chat-abort.mjs`: 실제 `/api/chat` 으로 나가기·다시 받기 확인
- 결과 JSON 에서 키 패턴(`sk-…`) 0건

## 남은 것 (P2)

- 실제 API 확인에서는 첫 글자가 오기 전(입력 중 표시)에 나갔다. 글자가 오는 중에 나가는 경우는 같은 abort 경로이고, 흉내 낸 재현으로만 확인했다.
- 02 360x740 첫 화면에서 사진 카드는 여전히 스크롤해야 보인다(요구 범위는 이름·나이 줄).
- 이미 같은 이름 페르소나가 둘 저장된 기존 데이터는 그대로 둔다.
- Conversation·PersonaCreate·PersonaList·PersonaModal CSS 에는 hex 가 아직 남아 있다(이번 범위는 새 화면인 ProfileSheet·Working).
