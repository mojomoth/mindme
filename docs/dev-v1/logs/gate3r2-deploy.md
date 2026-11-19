# Gate 3 r2 — 재배포 (2026-11-19)

## 배포
- 방법: 레포 루트에서 `vercel link --yes --project mindme --scope mojomoths-projects` → `vercel deploy --prod --yes` (Vercel CLI 48.0.3, 토큰은 `.env` 의 `VERCEL_KEY` 를 환경 변수로만 사용)
- 결과: `dpl_GPR9o3pKk6TqFWQ8wbpzgA5n469g` READY, production, 별칭 `mindme-rho.vercel.app`·`mindme-mojomoths-projects.vercel.app`, 리전 iad1
- CLI 경고: `Found invalid Node.js Version: "24.x"` — CLI 48.0.3 이 서버보다 오래돼 생기는 경고로 보인다. 프로젝트 설정 Node 24.x 로 빌드가 성공했고 r1 배포와 같은 설정이다. 바꾸지 않는다
- `vercel link` 가 `.gitignore` 에 `.vercel` 줄을 덧붙였으나 이미 `.vercel/` 가 있어 되돌렸다

## 키 파일 업로드 문제 (NEW-deploy-env, P1)
- 발견: r1 배포본 `dpl_EP41jr…` 의 배포 소스 목록(`GET /v6/deployments/{id}/files`)에 `/src/.env` 가 있었다. Vercel CLI 는 `.gitignore` 를 읽지 않는다
- 노출 범위: 프로젝트 `publicSource` 가 꺼져 있어 `/_src` 는 vercel.com 로그인 화면으로 넘어간다. 팀 구성원(소유자 본인)만 볼 수 있었다. 공개 HTML·정적 파일에는 키가 없었다(r1 Critic)
- 조치: `.vercelignore` 추가(`.env`, `.env.*`, `docs/`, `.claude/`, `scripts/`, 산출물) → 재배포 → 새 배포 소스 189개 파일에 `.env`·docs·.claude 0건 확인(`evidence/gate3r2/deploy-source-files.txt`) → 옛 배포본 삭제(`DELETE /v13/deployments/dpl_EP41jr…` → DELETED, 옛 URL 404). 남은 배포는 새 프로덕션 하나
- 남은 일(HIL): 옛 배포 소스에 올라갔던 키(그 당시 `.env` 의 OpenAI·Anthropic·Google·Vercel·Render 키)는 교체를 권한다. 외부 계정 작업이라 사용자 몫이다

## 확인
- `/` 200(0.79s), `/api/health` 200 `{"ok":true,"configured":{"openai":true}}`
- 배포 URL 상세 재검증은 `logs/gate3r2-critic-remote-*.md`
