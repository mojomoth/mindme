# Mindme 워크플로우 기록

개발이 실제로 어떻게 진행됐는지 정리한 문서다. 근거는 `logs/*`, `evidence/*`, `run.md`.

## 1. 게이트 루프 이력

```mermaid
flowchart LR
  P[Plan] --> B[Build] --> C[Critic] --> F[Fix] --> R[Recheck] --> OK{PASS}
  R -- 실패 항목만 --> F
```

| 게이트 | 라운드 | 중단·재개 | 판정 |
|---|---|---|---|
| Gate 0 준비 | Critic r1~r4 (수정 r1~r3) | 없음 | PASS. r4 에서 남은 P0 는 report.md 없음 하나였고 저장 후 해소 |
| Gate 1 PoC | 작업별 Critic r1 → r1b (chat 은 P1 수정 후 r1b) | 11/19 네트워크 장애(ENOTFOUND)로 1차 실행 중단, 미커밋 작업을 살려 재개 | 4개 작업 PASS, 통합 회귀 통과, 계약 Critic PASS(P2 4). HIL 은 기다리지 않음 |
| Gate 2 통합 | e2e r1, visual r1→r2, ponytail r1→r2 | 없음 | 3개 Critic 모두 PASS, 열린 P0·P1 없음 |
| Gate 3 배포 | 아직 시작 전 | | |

```mermaid
flowchart TD
  G0[Gate 0 준비 PASS] --> G1[Gate 1 PoC PASS]
  G1 -. HIL 대기 .-> G2
  G1 --> G2[Gate 2 통합 PASS]
  G2 --> G3[Gate 3 배포 예정]
```

## 2. 앱 화면 플로우

```mermaid
flowchart LR
  L[01 랜딩] --> C[02 만들기: 기록·사진·이름·지금 나이]
  C --> W[진행 화면: 분석, 페르소나 3개, 아바타]
  W --> LI[03 목록]
  LI -- 새 나 만나기 --> M[04 모달: 나이·상황]
  M --> W2[진행 화면] --> LI
  LI --> CH[05 대화]
  CH -- 아바타 --> PS[프로필 시트: 수정·확정]
  PS --> CH
  CH -- 나가기 --> LI
```

화면 이동은 상태 하나로 한다. 경로는 `/` 하나다.

## 3. 데이터 흐름

```mermaid
flowchart LR
  subgraph 브라우저
    S[(localStorage: profile·events·personas·photo·chat)]
    UI[MindmeApp + @mindme/ui]
  end
  subgraph apps/web route
    R[analyze · persona · persona/avatar · chat]
  end
  CORE[@mindme/core: schemas·analysis·persona·chat]
  AI[OpenAI: 텍스트 gpt-6-astra, 이미지 gpt-image-2]
  UI <--> S
  UI -- JSON, 스트림 --> R
  R --> CORE --> AI
```

서버는 상태를 갖지 않는다. 키는 서버에서만 읽는다.
