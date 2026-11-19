# Gate 3 r2 회귀 Critic 라운드 1

판정: 통과 (P0·P1 없음)

| 검사 | 결과 |
| --- | --- |
| pnpm typecheck | 통과 (종료 코드 0) |
| pnpm test | 51개 중 51개 통과, 실패 0 |
| pnpm lint | 경고 0, 종료 코드 0 |
| pnpm build:web | 통과 |
| pnpm build (pocs) | 통과 |
| 키 노출 | .env 값 7개(8자 이상) 모두 0건. 추적 파일, 새 파일, apps/web/.next, pocs/.next/static 총 1730개 검사 |
| NEXT_PUBLIC_ | 코드 사용 0건 (주석 2건만) |
| .vercelignore | .env, .env.* 제외. docs/, scripts/ 는 import 하는 코드가 없어 안전. 빌드에 쓰는 guide-face-512.png 는 raw.png 패턴에 걸리지 않음. packages, lockfile, workspace, tsconfig.base.json, pocs/package.json 은 제외하지 않음 |
| dev 서버 | 3100/api/health 200, 3101/api/health 200, 3100/ 200 |

증거: docs/dev-v1/evidence/gate3r2/critic-regress-r1-*.txt
