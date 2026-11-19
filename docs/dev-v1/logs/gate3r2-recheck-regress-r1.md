# Gate 3 R2 회귀 Critic 재검증 (라운드 1)

판정: PASS (P0·P1 없음)

| 항목 | 결과 | 증거 |
|---|---|---|
| pnpm typecheck | 통과 | evidence/gate3r2/recheck-regress-r1-typecheck.txt |
| pnpm test | 55개 중 55개 통과, 실패 0 | recheck-regress-r1-test.txt |
| pnpm lint | 통과, 경고 0 | recheck-regress-r1-lint.txt |
| pnpm build:web | 성공 | recheck-regress-r1-build-web.txt |
| pnpm build (pocs) | 성공 | recheck-regress-r1-build-pocs.txt |
| 키 노출 검사 | 추적·신규 파일 및 apps/web/.next 1821개 파일에서 모든 키 0건 | recheck-regress-r1-keyscan.txt |
| 3100 / 와 /api/health | 둘 다 200 | - |

키 검사는 파이썬 스크립트로 .env 값을 메모리에서만 비교했고, 키 이름별 건수만 기록했다.
