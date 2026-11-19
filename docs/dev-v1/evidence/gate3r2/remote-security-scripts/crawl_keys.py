#!/usr/bin/env python3
"""remote-security 1) 배포 URL 키 노출 검사.
HTML(여러 경로) → /_next/static 의 JS·CSS·media 재귀 수집 → API 오류 본문까지 내려받아
.env 의 모든 값(8자 이상)을 바이트 검색한다. 키 값은 메모리에서만 비교하고 '키 이름: 건수'만 출력한다.
사용법: python3 -I crawl_keys.py <download-dir> <env-path>
"""
import base64, hashlib, json, os, re, sys, urllib.request, urllib.error

BASE = 'https://mindme-rho.vercel.app'
DL, ENV = sys.argv[1], sys.argv[2]
UA = {'User-Agent': 'mindme-critic/1.0'}


def get(url, method='GET', body=None, headers=None):
    req = urllib.request.Request(url, data=body, method=method, headers={**UA, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def save(name, data):
    p = os.path.join(DL, re.sub(r'[^A-Za-z0-9._-]', '_', name))[:240]
    with open(p, 'wb') as f:
        f.write(data)
    return p


# ── .env 읽기 (값은 출력하지 않는다) ──
secrets = {}
for line in open(ENV, encoding='utf-8'):
    m = re.match(r'\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)', line)
    if not m:
        continue
    v = m.group(2).strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'':
        v = v[1:-1]
    if len(v) >= 8:
        secrets[m.group(1)] = v

blobs = {}  # name -> bytes
status = {}

# ── HTML 경로 ──
html_paths = ['/', '/?x=1', '/index', '/does-not-exist-xyz', '/_not-found', '/api', '/robots.txt', '/favicon.ico',
              '/.env', '/src/.env', '/_src', '/_logs', '/.git/config', '/package.json']
for p in html_paths:
    st, h, b = get(BASE + p)
    status[p] = (st, h.get('Content-Type') or h.get('content-type'), len(b))
    blobs['html' + p] = b

# ── 정적 자산 재귀 수집 ──
ref = re.compile(rb'(?:/_next/|(?<![\w/])static/)[A-Za-z0-9_\-./~%]+?\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|ico|json|txt|map)')
queue, seen = [], set()

def enqueue(b):
    for m in ref.findall(b):
        s = m.decode()
        if s.startswith('static/'):
            s = '/_next/' + s
        if s not in seen:
            seen.add(s)
            queue.append(s)

for k, b in list(blobs.items()):
    enqueue(b)
while queue:
    p = queue.pop(0)
    st, h, b = get(BASE + p)
    status[p] = (st, h.get('Content-Type') or h.get('content-type'), len(b))
    if st == 200:
        blobs['static' + p] = b
        save('static' + p, b)
        if p.endswith(('.js', '.css', '.json', '.txt')):
            enqueue(b)

# ── 소스맵 (있으면 위험) ──
maps = {}
for p in [k[len('static'):] for k in blobs if k.startswith('static') and k.endswith('.js')]:
    st, h, b = get(BASE + p + '.map')
    maps[p + '.map'] = st
    if st == 200:
        blobs['map' + p] = b

# ── API 응답·오류 본문 ──
J = {'content-type': 'application/json'}
api = [
    ('GET /api/health', BASE + '/api/health', 'GET', None, None),
    ('GET /api/chat', BASE + '/api/chat', 'GET', None, None),
    ('POST /api/chat bad-json', BASE + '/api/chat', 'POST', b'{not json', J),
    ('POST /api/chat schema', BASE + '/api/chat', 'POST', json.dumps({'persona': {}, 'messages': []}).encode(), J),
    ('POST /api/chat text/plain', BASE + '/api/chat', 'POST', b'"x"', {'content-type': 'text/plain'}),
    ('POST /api/persona schema', BASE + '/api/persona', 'POST', json.dumps({'age': -1}).encode(), J),
    ('GET /api/persona', BASE + '/api/persona', 'GET', None, None),
    ('GET /api/analyze', BASE + '/api/analyze', 'GET', None, None),
    ('GET /api/nope', BASE + '/api/nope', 'GET', None, None),
]
api_out = {}
for name, url, method, body, hd in api:
    st, h, b = get(url, method, body, hd)
    blobs['api ' + name] = b + json.dumps(h).encode()
    api_out[name] = {'status': st, 'ct': h.get('Content-Type') or h.get('content-type'),
                     'cache': h.get('Cache-Control') or h.get('cache-control'),
                     'acao': h.get('Access-Control-Allow-Origin') or h.get('access-control-allow-origin'),
                     'body': b[:300].decode('utf-8', 'replace')}

# ── 검색 ──
total_bytes = sum(len(b) for b in blobs.values())
hits = {}
for name, v in secrets.items():
    needles = {
        'full': v.encode(),
        'prefix16': v[:16].encode() if len(v) >= 24 else None,
        'suffix16': v[-16:].encode() if len(v) >= 24 else None,
        'b64': base64.b64encode(v.encode()),
        'sha256hex': hashlib.sha256(v.encode()).hexdigest().encode(),
    }
    c = {}
    for kind, n in needles.items():
        if n:
            c[kind] = sum(b.count(n) for b in blobs.values())
    hits[name] = c

sk = re.compile(rb'sk-[A-Za-z0-9_\-]{20,}')
sk_hits = {k: len(sk.findall(b)) for k, b in blobs.items() if sk.search(b)}
generic = re.compile(rb'(?:AIza[0-9A-Za-z_\-]{30,}|sk-ant-[A-Za-z0-9_\-]{20,}|sk-or-[A-Za-z0-9_\-]{20,}|ghp_[A-Za-z0-9]{30,})')
generic_hits = {k: len(generic.findall(b)) for k, b in blobs.items() if generic.search(b)}
names = [b'NEXT_PUBLIC_', b'OPENAI_API_KEY', b'OPENAI_KEY', b'VERCEL_KEY', b'process.env', b'apiKey', b'Bearer ']
name_hits = {n.decode(): {k: b.count(n) for k, b in blobs.items() if n in b} for n in names}

print(json.dumps({
    'files': len(blobs), 'bytes': total_bytes,
    'static_files': sorted(k[len('static'):] for k in blobs if k.startswith('static')),
    'status': status,
    'sourcemaps': maps,
    'env_keys_checked': len(secrets),
    'env_hits': hits,
    'sk_like_hits': sk_hits,
    'other_key_like_hits': generic_hits,
    'name_hits': name_hits,
    'api': api_out,
}, ensure_ascii=False, indent=1))
