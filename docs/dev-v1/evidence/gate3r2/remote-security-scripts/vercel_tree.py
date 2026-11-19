#!/usr/bin/env python3
"""배포 파일 트리 경로만 출력(내용·키 없음) + 옛 배포 id 조회 상태."""
import json, re, sys, urllib.request, urllib.error
ENV, DEP = sys.argv[1], sys.argv[2]
OLD = sys.argv[3:]
tok = None
for line in open(ENV, encoding='utf-8'):
    m = re.match(r'\s*(?:export\s+)?(VERCEL_KEY|VERCEL_API_KEY)\s*=\s*(.*)', line)
    if m:
        tok = m.group(2).strip().strip('"').strip("'")
def api(p):
    req = urllib.request.Request('https://api.vercel.com' + p, headers={'Authorization': 'Bearer ' + tok, 'User-Agent': 'mindme-critic/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read()).get('error', {}).get('code')
        except Exception:
            return e.code, None
def walk(nodes, pre=''):
    for n in nodes or []:
        p = pre + '/' + n['name']
        kids = n.get('children') or []
        yield p, n.get('type'), len(kids)
        yield from walk(kids, p)
st, tree = api(f'/v6/deployments/{DEP}/files')
for p, t, k in walk(tree):
    print(f'{t:9} {k:3} {p}')
for o in OLD:
    st, b = api(f'/v13/deployments/{o}')
    print('OLD', o, st, b if not isinstance(b, dict) else b.get('readyState'))
    st, b = api(f'/v6/deployments/{o}/files')
    print('OLD files', o, st, b if not isinstance(b, list) else len(b))
