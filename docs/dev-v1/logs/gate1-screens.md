# Gate 1 — screens-frontend (`/pocs/screens`)

2026-11-19. 이전 빌드 에이전트가 네트워크 장애(ENOTFOUND)로 보고 없이 멈춰서 이어서 마무리했다. 이미 있던 파일은 그대로 두고, 현재 상태를 캡처해 드래프트와 비교한 뒤 차이가 큰 곳만 고쳤다.

## 시작 시점 상태 (이전 에이전트 작업물, 유지)

- `packages/ui/src/screens/` — Landing, PersonaCreate, PersonaList, PersonaModal, Conversation (+ module.css, types.ts, shared.module.css). 모두 props 기반 presentational 이라 Gate 2 에서 재사용할 수 있다.
- `packages/ui/src/components/` — Avatar, Wordmark, icons(인라인 SVG), assets.ts(캐릭터 경로)
- `packages/ui/assets/` — guide/guide-peek/guide-peek-open/guide-mark/avatar-teen/avatar-young 등 (원본 `assets/generated/`, codex 로 생성, `*.verify.txt` 에 claude -p 검증 결과)
- `pocs/app/pocs/screens/` — `page.tsx`(=landing), `[screen]/page.tsx`(landing|create|list|modal|chat, 그 밖의 경로는 404), `ScreensDemo.tsx`(라우팅만, AI 호출 없음), `mock.ts`(prompts.json 문구)
- `packages/ui/src/index.ts` — 화면과 컴포넌트 export 를 추가만 했다

처음 캡처에서 모바일 5화면은 드래프트와 거의 같았다. 다른 곳은 아래 세 군데였다.

## 이번에 고친 것

| # | 화면 | 차이 | 원인 → 수정 | 파일 |
|---|---|---|---|---|
| 1 | 05 대화 (데스크톱) | 목업 상단 9:41 상태바가 안 보임 | sticky 헤더(z-index 2)가 PhoneFrame 상태바(z-index 2)보다 DOM 에서 뒤에 있어서 상태바를 덮음 → 헤더 z-index 를 1 로 내림 | `packages/ui/src/screens/Conversation.module.css` |
| 2 | 01 랜딩 | 드래프트는 로딩 점 3개가 모두 진한 주황인데, 구현은 투명도 깜빡임 때문에 캡처마다 2개가 옅게 나옴 | 애니메이션을 opacity 대신 translateY(-4px) 바운스로 바꿈. 정지 프레임에서도 세 점 모두 #FF5B2A (픽셀 샘플로 확인) | `packages/ui/src/screens/Landing.module.css` |
| 3 | 05 대화 | 드래프트는 아바타가 얼굴 중심으로 원을 채우는데, 구현은 전신이 작게 보임 | `Avatar` 에 선택 prop `zoom`(기본 1.08, 기존과 같음)을 추가하고, 대화 화면에서만 1.3 을 씀. 목록 화면은 그대로 | `packages/ui/src/components/Avatar.tsx`, `Avatar.module.css`, `screens/Conversation.tsx` |

## 동작 확인 (Playwright, 390x844 모바일)

```
landing->create auto 3081ms        # 3초 자동 이동 (?hold 를 붙이면 멈춤: 스크린샷용)
create->list OK                    # '페르소나 생성하기'
list(+페르소나 생성)->modal OK
slider min=5 max=80 val=15
modal close->list OK
list row->chat OK
chat 나가기->list OK
chat h-overflow false
```
- 터치 타깃: create·list 화면에 44px 미만 요소 없음. 모달의 닫기 버튼과 슬라이더가 43px 로 측정됐는데, 등장 애니메이션 `scale(0.98)` 도중이라서다. CSS 값은 44px. '나가기' pill 은 보이는 높이가 32px 이고, `::after` 로 터치 영역을 46px 까지 넓혔다.
- 라우트: `/pocs/screens`, `/pocs/screens/{landing,create,list,modal,chat}` 모두 200
- 상태바와 홈 인디케이터는 데스크톱 목업 안에서만 그린다. 모바일(<=600px)은 전체 화면이고 `env(safe-area-inset-*)` 를 쓴다.
- `pnpm typecheck` 3패키지 통과. `packages/ui`, `pocs/app/pocs/screens` 에 `@mindme/core/server`·`NEXT_PUBLIC_` 참조 0건

## 외형 비교 — `claude -p --model claude-sonnet-5-5` (드래프트 A + 모바일 B + 데스크톱 C)

### r1 (수정 전) 유사도
| 화면 | 유사도 | 주요 지적 (요약) |
|---|---|---|
| 01 랜딩 | 8/10 | [P1] 로딩 점 2개가 옅음 → **수정(#2)**. [P1] 로고 마크와 캐릭터 질감 차이(에셋 차이). [P2] 배경 그라데이션, 말풍선 위치 |
| 02 생성 | 8/10 | [P1] 사진 카드 폭이 입력창과 다름 → 실측해 보니 드래프트와 같은 위치(924 기준 75..851)라 **해당 없음**. [P1] 데스크톱 글자가 작음 → 목업 축소 배율 때문으로 의도한 결과. [P2] 캐릭터 그림자, 테두리 톤 |
| 03 목록 | 7/10 | [P1] 상단 여백, 리스트 아래 빈 공간 → 모바일 캡처에 상태바 44px 가 없어서 콘텐츠가 위로 붙은 것(의도). [P1] 아바타 크롭과 포즈가 다름(에셋 차이). [P2] 배경 그라데이션, 카드 그림자 |
| 04 모달 | 8/10 | [P1] CTA 폭, 캐릭터 채도. [P2] 스크림 농도 조금 진함 |
| 05 대화 | 8/10 | [P1] 아바타 크롭 → **수정(#3)**. [P1] 배경 그라데이션 없음. [P2] 말풍선 패딩, 타이핑 점 명암(애니메이션 프레임) |

(데스크톱 상태바 누락은 직접 캡처를 비교하다 찾아서 #1 로 고쳤다.)

### r2 (수정 후, 고친 항목만 다시 판정)
- 01 랜딩: 로딩 점 3개 모두 진한 주황 → **해결**. 유사도 8/10
- 05 대화: 데스크톱 9:41 상태바 → **해결**. 아바타 얼굴 중심 크롭 → **해결** (드래프트보다 조금 타이트함). 유사도 8/10

### 남은 차이 (P2, 고치지 않음)
- 배경: 드래프트는 아주 옅은 하늘색 그라데이션이고, 구현은 토큰 `--mm-bg` 단색이다. 공용 토큰(`packages/ui/src/styles/tokens.css`)은 소유 범위 밖이라 그대로 두었다.
- 캐릭터 포즈·질감·새싹 각도: 드래프트 이미지와 codex 로 생성한 에셋은 원래 다른 그림이다. 기존 `*.verify.txt` 에서 같은 캐릭터로 판정됐다. 다시 생성해도 픽셀 단위로 같아지지는 않아서 다시 만들지 않았다.
- 목록과 모달의 아바타 크롭, 말풍선 패딩 2~4px, 스크림 농도 등 미세 간격

## 증거 (갱신)

`docs/dev-v1/evidence/gate1/screens-{landing,create,list,modal,chat}-{desktop,mobile}.png`
- desktop = 1440x900 (아이폰 목업 안), mobile = 390x844 DPR3
- 랜딩은 `?hold` 로 자동 이동을 멈추고 찍었다
- `screens-compare.png` 는 이전 에이전트가 만든 파일이다 (11/17, 수정 전).

## 재현
```
node scripts/shot.mjs "http://localhost:3101/pocs/screens/landing?hold" desktop docs/dev-v1/evidence/gate1/screens-landing-desktop.png
node scripts/shot.mjs http://localhost:3101/pocs/screens/chat mobile docs/dev-v1/evidence/gate1/screens-chat-mobile.png
claude -p --model claude-sonnet-5-5 --allowedTools Read -- "A=<draft> B=<mobile> C=<desktop> 를 Read 로 읽고 차이 목록..."
```

## 판정
PASS: 5화면 구현, 라우팅, 3초 자동 이동, 데스크톱 목업과 모바일 캡처, typecheck 모두 통과. 시각 유사도는 7~8/10 이고, 남은 차이는 에셋·배경 톤 수준의 P2 다.
