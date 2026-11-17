# mascot-assets 로그

## 방법
- 생성: `cat <prompt> | codex exec --skip-git-repo-check -s workspace-write -i <드래프트 png>... -` (image_generation 기능 사용; `-i` 가 가변 인자라 프롬프트는 stdin 으로 전달). 프롬프트 원문은 에셋별 `*.prompt.txt`.
- 투명 배경: codex 가 순수 마젠타(#FF00FF) 배경으로 생성 -> PIL 로 크로마키 제거(`*.raw.png` 가 원본, `*.png` 가 투명본) -> sips/PIL 로 512/256 리사이즈.
- 검증: `claude -p --model claude-sonnet-5-5` (stdin 프롬프트, Read 허용)로 회색-파랑 위에 합성한 에셋과 드래프트 비교. 원문은 `*.verify.txt`.
- 알파 확인(PIL): 4종 모두 알파 범위 (0,255), 모서리 (0,0,0,0), 투명 픽셀 약 68~74%.
- 로고: docs/bi/drafts/mindme-wordmark*.svg 4종을 그대로 복사(새로 만들지 않음).

## 반복 이력
| 에셋 | 시도 | 판정 | 비고 |
|---|---|---|---|
| guide | 1 | FAIL | 납작한 2D 벡터라 시안의 3D 광택 스타일과 다름, 새싹 얇음 |
| guide | 2 | FAIL(엄격) -> PASS(기준 명확화 재질의) | 3D 스타일로 재생성. 1차 FAIL 사유는 말풍선/그림자/기울기(에셋 범위 밖)라서, 평가 기준에서 제외하고 재질의하여 PASS |
| guide-face | 1 | FAIL | 2D 벡터, 물방울형 |
| guide-face | 2 | PASS | 3D 스타일로 재생성 |
| avatar-teen | 1 | PASS | 검은 바가지머리, 파란 후드, 백팩까지 일치 |
| avatar-young | 1 | PASS | 시안 2번째 행 인물과 일치 |

## Claude 판정 요약
- guide 최종 PASS: 노란 3D 몸체, 주황 두 잎, 검은 타원 눈, 블러시, 손 흔들기, 잘림/마젠타 잔여물 없음.
- guide-face PASS, avatar-teen PASS, avatar-young PASS(원문은 *.verify.txt, 이전 판정은 *.iter1/iter2.txt).

## 주의
- avatar-young 은 시안 03 의 인물을 따라 갈색빛 웨이브 머리와 사원증/백팩 끈이 포함됨(검은 머리로 보이는 범위).
- 크로마키 가장자리는 육안 PASS이나 어두운 배경에서 미세 번짐 가능성 있음.
- push 불가(원격/gh 없음), commit 은 수행하지 않음.
