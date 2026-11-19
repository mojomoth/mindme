#!/bin/sh
# 사용: judge.sh <프롬프트 파일> <출력 파일>  (레포 루트에서 실행)
claude -p --model sonnet --allowedTools Read -- "$(cat "$1")" < /dev/null > "$2"
