#!/usr/bin/env python3
"""파일들을 .env 값(8자 이상)·sk- 토큰 모양으로 바이트 검색. '키 이름: 건수'만 출력."""
import re, sys
ENV, files = sys.argv[1], sys.argv[2:]
sec = {}
for line in open(ENV, encoding='utf-8'):
    m = re.match(r'\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)', line)
    if m:
        v = m.group(2).strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'':
            v = v[1:-1]
        if len(v) >= 8:
            sec[m.group(1)] = v
blobs = [open(f, 'rb').read() for f in files]
print('files', len(files), 'bytes', sum(map(len, blobs)))
for k, v in sec.items():
    print(f'{k}: {sum(b.count(v.encode()) for b in blobs)}')
print('sk-like:', sum(len(re.findall(rb"sk-[A-Za-z0-9_\-]{20,}", b)) for b in blobs))
print('NEXT_PUBLIC_:', sum(b.count(b"NEXT_PUBLIC_") for b in blobs))
