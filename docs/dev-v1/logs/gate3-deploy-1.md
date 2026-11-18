# gate3 deploy-vercel
- 프로젝트 mindme 생성(REST), Root Directory=apps/web, sourceFilesOutsideRootDirectory=true, Node 24.x(로컬 v26과 다름; Vercel 미지원 → apps/web engines 24.x 추가), install: pnpm install --frozen-lockfile
- env: OPENAI_API_KEY(production, sensitive). MINDME_*_MODEL 은 코드 기본값 사용, 미등록.
- next.config 의 루트 .env 로드는 !process.env.VERCEL 분기라 빌드 영향 없음.
- 배포 1회차 READY: https://mindme-rho.vercel.app (/ , /api/health 응답 확인). 보호 설정 ssoProtection 해제.
