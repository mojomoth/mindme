# Mindme 보조 도구 적용 안내 (dev-v1)

소스는 레포 밖 `../.tooling-src/<name>`에 `git clone --depth 1`로 받았고, 설치는 프로젝트 로컬 `.claude/skills/`에 복사했다. 설치 스크립트와 훅은 실행하지 않았다(플러그인 훅·마켓플레이스 설치 미사용). 상태는 모두 PASS(접근 가능).

| 도구 | 설치 위치 | 용도 |
|---|---|---|
| fluent-korean | `.claude/skills/fluent-korean/` | 한국어 문장 보정 |
| ponytail | `.claude/skills/ponytail`, `ponytail-review`, `ponytail-audit` | 불필요한 복잡성 제거 |
| no-ai-slop | `.claude/skills/no-ai-slop/` | 상투적 문구 검토, 고유 문체 유지 |
| hallmark | `.claude/skills/hallmark/` | 상투적 UI 디자인 감사 |
| gauntlet-loop | `.claude/skills/gauntlet-loop/` | 빌더/비평가 반복 루프 |

공통 규칙: Builder는 만들고 Critic은 독립 컨텍스트에서 판정한다. Critic은 파일을 고치지 않고 FAIL 항목만 보고한다. 코드·키·경로·인용은 보정 대상이 아니다.

## 1. fluent-korean
- 무엇: 조사·어미 누락, 명사 나열체, 비유로 바뀐 어휘를 막는 한국어 글쓰기 지침(원본은 Claude Code output-style 2종).
- 적용: 플러그인 대신 지침 본문을 파일로 둔다. `fluent-korean.md`(코딩 유지), `fluent-korean-not-coding.md`(비코딩). 전역 output-style로 켜지 않고 필요할 때 skill로 호출한다. Codex에는 `fluent-korean-not-coding.md` 본문을 프롬프트에 붙여 넣는다.
- 호출: 모든 게이트에서 Builder가 UI 문구·페르소나 대사·`docs/dev-v1/report.md`를 쓴 직후 `/fluent-korean`. Critic은 문구 샘플을 점검한다.
- 체크리스트
  - [ ] 조사·어미가 빠진 전보체 없음 ("저장 완료" 대신 "저장했어요" 등 톤 일관)
  - [ ] 명사 나열("페르소나 생성 진행 상태 확인") 없음
  - [ ] 번역투·직역("~를 통해", "~에 대해")과 비유적 대체어 없음
  - [ ] 드래프트(prompts.json)의 정확한 문구는 임의 변경하지 않음
  - [ ] 한 문장이 모호하지 않고 존댓말/해요체가 화면마다 같음

## 2. ponytail
- 무엇: "가장 작은 완전한 변경"만 허용하는 게으른 시니어 모드. 불필요한 기능·의존성·추상화를 거른다.
- 적용: 구현 에이전트 프롬프트에 `/ponytail`(full)을 포함한다. 리뷰는 `/ponytail-review`, 구조 점검은 `/ponytail-audit`. 전체 플러그인의 Node 훅은 설치하지 않았다. 규칙 전체가 필요하면 `../.tooling-src/ponytail/AGENTS.md`를 Codex 프롬프트에 포함한다.
- 호출: Builder는 구현 중 상시. Critic은 각 게이트 구현 완료 후 `/ponytail-review`. Gate 0 종료 시 `/ponytail-audit` 1회.
- 체크리스트
  - [ ] 요청되지 않은 기능·옵션·설정 없음 (스펙에 없는 것은 1줄로 "건너뜀" 명시)
  - [ ] 새 의존성은 불가피한 것만 (Tailwind 등 금지, 표준·기존 라이브러리 우선)
  - [ ] 한 번만 쓰는 추상화·래퍼·헬퍼 없음
  - [ ] 어댑터(Capacitor 대비)는 인터페이스+웹 구현 1개로 끝
  - [ ] 위험·미확인 사항을 응답 끝에 적음

## 3. no-ai-slop
- 무엇: 초안을 더 분명하게 다듬되 작성자 고유 목소리를 보존하는 편집/탐지 skill. 탐지 모드는 패턴을 인용만 하고 다시 쓰지 않는다.
- 적용: 한국어 문서에는 영어 패턴이 일부 맞지 않으므로 "탐지 모드"로 Critic이 쓰고, 수정은 fluent-korean과 함께 Builder가 한다. 판정은 영어 패턴을 한국어 상투구에 대응시킨다.
- 호출: Critic이 랜딩 문구, 페르소나 대사, 보고서 초안에 `/no-ai-slop` 탐지. 수정 후 재탐지 1회.
- 체크리스트
  - [ ] "함께 성장해요", "당신의 여정" 같은 상투적 감성 문구 없음
  - [ ] 군더더기 서두·맺음("~해 보세요!" 반복) 없음
  - [ ] 모든 문장이 같은 길이·같은 리듬이 아님
  - [ ] 드래프트의 고유 표현(예: 새싹 캐릭터 말투)은 유지
  - [ ] 근거 없는 수치·효과 주장 없음

## 4. hallmark
- 무엇: 모델 기본값 디자인(눈썹 라벨, 한 단어만 색칠, 빈 카드 등)을 브라우저 린트와 독립 리뷰어로 막는 디자인 skill.
- 적용: 새 디자인을 만들지 않는다(디자인은 `docs/screens/drafts/*.png`가 기준). `/hallmark audit <path>`만 쓴다. `redesign`과 테마 생성은 금지. 설치 스크립트(`scripts/install*.mjs`)는 실행하지 않았다. 린트는 필요할 때 `scripts/sloplint.mjs`를 읽고 검토한 뒤 실행한다.
- 호출: 각 화면 구현 후 Critic이 `/hallmark audit packages/ui/<화면>`. 결과는 드래프트와 충돌하면 드래프트가 우선이다.
- 체크리스트 (Floor는 FAIL 사유)
  - [ ] 색·폰트가 `:root` 토큰 경유 (리터럴 색 금지)
  - [ ] `transition: all`, width/height 애니메이션 없음, reduced-motion 대응
  - [ ] 모든 인터랙티브 요소에 `:focus-visible`
  - [ ] `overflow-x: clip`, 390px 폭에서 가로 스크롤 없음
  - [ ] 눈썹 라벨·한 단어만 강조·빈 프레임 같은 상투 패턴 없음
  - [ ] 허위 완료 폼(전송 없이 감사 메시지) 없음

## 5. gauntlet-loop
- 무엇: 목표를 "기준(bar) 설정, 작은 조각으로 분할, Builder와 Critic 분리, 블라인드 비교, 통과까지 반복" 프롬프트로 바꾸는 skill.
- 적용: 비교 기준을 드래프트 PNG 5장과 캐릭터 원본(`drafts_legacy/mindme-guide.png`는 참고만, 기준은 드래프트)으로 고정한다. 기준은 로컬 파일이므로 fetch 가능 조건을 만족한다. 수치 기준(빌드·타입체크·접근성 점수)을 함께 둔다.
- 호출: 화면 단위(01~05)와 캐릭터 이미지에 `/gauntlet-loop`. 화면별 Builder 1, Critic 1(이미지 비교는 Claude CLI), 화면당 최대 3라운드 후에도 FAIL이면 BLOCKED로 기록한다.
- 체크리스트 (Critic 판정)
  - [ ] 같은 뷰포트(390x844)의 스크린샷을 드래프트와 나란히 비교, 라벨 가린 채 판정
  - [ ] 색(#F0F6FA/#FFFFFF/#FF5B2A), 여백 24px, 글자 크기(26/14/13)가 일치
  - [ ] 문구가 prompts.json과 일치
  - [ ] 캐릭터가 노란 동글이+주황 두 잎 새싹 (legacy와 다름)
  - [ ] 가장 큰 차이 1개를 보고하고 Builder가 수정, 다음 라운드 재판정
  - [ ] 증거는 `docs/dev-v1/evidence/gate0/`에 저장

## 호출 순서 요약
Builder 구현(`/ponytail`) → 문구 보정(`/fluent-korean`) → Critic: `/ponytail-review`, `/hallmark audit`, `/no-ai-slop` 탐지, gauntlet 비교 → FAIL이면 Builder 수정 → 재판정.
