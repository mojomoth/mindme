# report.md 반영 초안 — Gate 3 (메인 세션이 옮긴다)

## 1. 배포 구성
- 주소: https://mindme-rho.vercel.app (Vercel 프로젝트 mindme). Root Directory `apps/web`, `sourceFilesOutsideRootDirectory` 켬, install `pnpm install --frozen-lockfile`.
- Node 24.x: 로컬 v26 은 Vercel 이 지원하지 않아 `apps/web` 의 engines 를 24.x 로 두었다.
- 환경 변수는 `OPENAI_API_KEY`(production, sensitive) 하나다. 모델 이름은 코드 기본값(gpt-6-astra, gpt-image-2)을 쓴다. 보호 설정(ssoProtection)은 해제했다.
- fluid compute, 함수 리전 iad1, 기본 함수 시간 300초. 랜딩은 정적이라 CDN 캐시에서 나간다.
- 루트 `pnpm build` 는 pocs 를 빌드하므로 배포는 `apps/web` 기준으로만 한다.

## 2. 제약 실측 (배포 URL, 실제 OpenAI)
| 항목 | 결과 |
|---|---|
| analyze 30만 자 | 200, 32.3초, 7구간 요약 (한도 300초) |
| avatar | 생성 25.8~29.8초, 요청 전체 27.5~31.6초 (한도 120초). 로컬 1회는 74초가 나온 적 있다 |
| 요청 본문 | 4.4MB 는 함수까지 도달, 4.7MB 는 Vercel 413. 사진은 클라이언트에서 줄여 약 128KB 를 보낸다 |
| 스트리밍 | 청크 단위 도착. 첫 호출 5.46초, 이후 2.2초 안팎(첫 글자 1.3~5.5초) |
| 서버 상태 | 파일 쓰기 0건. 기록은 모두 localStorage. 처음 보는 persona id 도 200 |
| 브라우저 권한 | https 보안 컨텍스트, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`. 사진 선택 정상 |
| 로컬과 비교 | 화면 10쌍(5화면 x 데스크톱·모바일) 차이 픽셀 0 |
| 미확인 | 함수별 `maxDuration` 적용값(배포 API 가 값을 돌려주지 않음) |

## 3. 결정과 보안 조치
- analyze `maxDuration` 60 → 300초. 구간 요약을 모두 동시 실행해 최악 지연을 약 500초에서 약 250초로 줄였다(30만 자 실측 29.9~32초). 순간 토큰이 커서 계정 TPM 이 낮으면 429 가 날 수 있다.
- analyze 응답에서 `meta.llm`(AI 원시 출력) 제거. pocs 만 `includeLlm` 으로 받는다.
- 키 없음·본문 초과·JSON 오류 문구를 해요체로 바꾸고, 키 사유는 서버 로그에만 남긴다(키 이름만, 값 없음).
- 남용 방지(apps/web 만): `Content-Length` 로 본문을 읽기 전에 413, IP 별 10분 고정 창 속도 제한(analyze 10·persona 30·avatar 15·chat 100)과 429 + `Retry-After`. 새 의존성 없음. 인스턴스 메모리라 완벽하지 않다.
- 미사용 공급자 제거: `@anthropic-ai/sdk`·`@google/genai`, `getAnthropic`·`getGoogle`, protobufjs 설정. `/api/health` 는 `{ ok, configured: { openai } }`. 12/1 이후 Claude 전환은 `env.ts`·`ai.ts`·`llm.ts` 세 곳에 분기만 더한다.
- 정리: 안 쓰는 마스코트 PNG·복사본 함수·중복 상수·미사용 스키마와 export 를 삭제(추가 39·삭제 93줄).
- 클라이언트: 대화 중 나가기 처리(취소 + '다시 받기'), 같은 이름 확인, 아바타 재사용 재시도, 03·02 모바일 여백, 입력란 스크롤 잘림, 프로필 시트 재구성.
- 키 검사: 작업 트리 1004파일·git 이력 115MB·빌드 산출물·배포 HTML·정적 파일·브라우저 응답 본문 모두 0건. `NEXT_PUBLIC_` 0. 소스맵은 403.
- report.md 정정 필요: '버전 고정' 표의 `@anthropic-ai/sdk`·`@google/genai`·protobufjs 차단 항목은 지금은 없다.

## 4. 미해결 (P2) 와 다음 작업
- P2 전체는 `run.md` 'P2 목록'. 사용자에게 영향이 큰 것: 함수 리전(iad1), 아바타 나이 차이, 제목 서체·CTA·배경 질감, 사진 localStorage 평문, 속도 제한의 한계.
- 다음: HIL(`hil-gate3.md`), 12/1 이후 Claude 전환 검토, 실기기 safe-area·Capacitor 포팅, 서울 리전·Firewall·OpenAI 월 한도.
