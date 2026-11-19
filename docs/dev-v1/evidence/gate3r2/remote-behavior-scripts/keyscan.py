# .env 값을 메모리에서만 비교한다. 출력은 '키 이름: 건수'뿐이다.
import os, sys, re, glob
ENV = '/Users/jeongyounglee/work/repo/mindme/.env'
vals = {}
for line in open(ENV, encoding='utf-8'):
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, v = line.split('=', 1)
    k = k.replace('export ', '').strip()
    v = v.strip().strip('"').strip("'")
    if len(v) >= 8:
        vals[k] = v
targets = []
for pat in sys.argv[1:]:
    targets += [p for p in glob.glob(pat) if os.path.isfile(p)]
blobs = []
for p in targets:
    with open(p, 'rb') as f:
        blobs.append(f.read())
print(f'files: {len(targets)}, bytes: {sum(len(b) for b in blobs)}')
for k, v in vals.items():
    full = v.encode()
    pre = v[:8].encode()
    print(f'{k}: full={sum(b.count(full) for b in blobs)} prefix8={sum(b.count(pre) for b in blobs)}')
sk = re.compile(rb'sk-[A-Za-z0-9_-]{20,}')
print(f'sk-pattern: {sum(len(sk.findall(b)) for b in blobs)}')
for name in [b'OPENAI_API_KEY', b'OPENAI_KEY', b'api.openai.com']:
    print(f'{name.decode()} (literal): {sum(b.count(name) for b in blobs)}')
