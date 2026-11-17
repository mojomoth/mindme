# cli-model-smoke 로그

## 요약
| 항목 | 결과 | 지연 |
|---|---|---|
| codex exec gpt-6-astra | PASS ("OK") | 6s |
| codex exec gpt-6.1-sol | PASS ("OK") | 7s |
| claude -p claude-sonnet-5-5 | PASS ("OK") | 4s |
| claude -p claude-opus-5-5 | PASS ("OK") | 2s |
| claude -p 이미지 분석(01-landing.png) | PASS (Read 도구로 이미지 읽고 정확히 요약) | 6s |
| codex 이미지 생성 (image_generation 기능, stable/true) | PASS, 256x256 PNG 53KB 생성 | 38s |
| API Anthropic messages (claude-sonnet-5-5) | FAIL HTTP 400: 사용 한도 도달, 2026-12-01 00:00 UTC 까지 복구 안 됨 | 464ms |
| API OpenAI responses (gpt-6-astra) | PASS HTTP 200 | 5097ms |
| API Gemini generateContent (gemini-3.5-flash) | FAIL: 응답 없음, 60s 타임아웃 2회 (HTTP 상태 못 받음) | >60000ms |

## 주의 / 블로커
- CLAUDE_API_KEY(직접 API)는 월 사용 한도 소진: 12/1 전까지 앱의 Claude API 호출 불가. 앱 개발 중 AI 호출은 OpenAI(gpt-6-astra)로 대체하거나 한도 해제 필요.
- Gemini 직접 호출은 이 환경에서 타임아웃. 키/네트워크/모델명 재확인 필요 (미해결).
- `claude` CLI(구독 로그인)는 정상. 단 경고: 로그인이 2026-11-18까지만 유효 가능. 장기 작업 전 `claude auth login` 또는 `claude setup-token`.
- .env 키 이름: JEV_KEY, GOOGLE_API_KEY, OPENAI_API_KEY, CLAUDE_API_KEY, VERCEL_API_KEY, RENDER_API_KEY.
- JEV_KEY: 접두사(4자)만으로 서비스 판별 불가 -> 용도 미상, 미사용.
- 스크립트: /Users/jyl/work/repo/ai-agent-live-1117/.scratch-mindme/smoke.mjs (레포 밖, 키 출력 없음).

## CLI 레시피
```sh
# 1) codex 텍스트 실행 (비대화형)
codex exec --skip-git-repo-check -m gpt-6-astra "프롬프트"      # 또는 -m gpt-6.1-sol
# 파일 쓰기가 필요하면: -s workspace-write -C <작업디렉터리>

# 2) codex 이미지 생성 (image_generation 도구 내장, 기본 활성)
codex exec --skip-git-repo-check -s workspace-write -C /Users/jyl/work/repo/ai-agent-live-1117/mindme \
  "image_generation 도구로 <설명>의 이미지를 생성하고 PNG를 <절대경로>.png 로 저장. 저장 후 경로만 출력."
# 검증된 예: docs/dev-v1/evidence/gate0/codex-imagegen-test.png (약 38s)

# 3) codex 이미지 수정/참조 첨부 (-i 지원은 help 확인, 실제 수정 실행은 미검증)
codex exec --skip-git-repo-check -s workspace-write -C <repo> -i /abs/ref.png \
  "첨부 이미지를 참조해 <수정 지시>. 결과를 <절대경로>.png 로 저장."

# 4) claude -p 텍스트
claude -p --model claude-sonnet-5-5 "프롬프트"     # 또는 claude-opus-5-5

# 5) claude -p 이미지 검증 (Read 도구로 이미지 읽기; 프롬프트 뒤에 -- 필수)
claude -p --model claude-sonnet-5-5 --allowedTools Read -- "Read <절대경로>.png 를 보고 <검증 질문>"
```
- 주의: `--allowedTools` 뒤에 프롬프트를 두면 도구 값으로 먹힘. 반드시 `--` 로 구분하거나 프롬프트를 앞에 둘 것.
- codex 출력 끝에 'tokens used' 포함. tail 로 자르면 편함.
