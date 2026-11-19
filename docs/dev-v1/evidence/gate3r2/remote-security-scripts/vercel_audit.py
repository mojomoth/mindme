#!/usr/bin/env python3
"""remote-security 2) Vercel API 로 배포 소스 업로드·옛 배포·프로젝트 설정 확인.
VERCEL_KEY 는 .env 에서 직접 읽어 Authorization 헤더에만 넣는다. 키 값·팀 id·사용자 정보는 출력하지 않는다.
업로드된 소스 파일 내용도 메모리에서 .env 값(8자 이상)과 비교해 '키 이름: 건수'만 출력한다.
사용법: python3 -I vercel_audit.py <env-path> <deployment-id> <project-id>
"""
import json, re, sys, time, urllib.request, urllib.error, urllib.parse, base64

ENV, DEP, PRJ = sys.argv[1], sys.argv[2], sys.argv[3]
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
TOKEN = secrets.get('VERCEL_KEY') or secrets.get('VERCEL_API_KEY')
assert TOKEN, 'VERCEL_KEY 없음'
TEAM = None


def api(path, raw=False):
    url = 'https://api.vercel.com' + path
    if TEAM:
        url += ('&' if '?' in url else '?') + 'teamId=' + TEAM
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + TOKEN, 'User-Agent': 'mindme-critic/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            b = r.read()
            return r.status, (b if raw else json.loads(b or b'null'))
    except urllib.error.HTTPError as e:
        b = e.read()
        try:
            j = json.loads(b)
            return e.code, {'error': {'code': j.get('error', {}).get('code'), 'message': j.get('error', {}).get('message')}}
        except Exception:
            return e.code, {'error': b[:200].decode('utf-8', 'replace')}


out = {}
# 프로젝트가 팀 소유면 teamId 가 필요하다 (값은 출력하지 않음)
st, prj = api(f'/v9/projects/{PRJ}')
if st != 200:
    st2, teams = api('/v2/teams')
    for t in (teams or {}).get('teams', []):
        TEAM = t['id']
        st, prj = api(f'/v9/projects/{PRJ}')
        if st == 200:
            break
out['team_scoped'] = TEAM is not None
out['project_status'] = st
if st == 200:
    out['project'] = {k: prj.get(k) for k in ['framework', 'rootDirectory', 'nodeVersion', 'publicSource', 'serverlessFunctionRegion',
                                              'sourceFilesOutsideRootDirectory', 'directoryListing', 'gitForkProtection']}
    out['project']['ssoProtection'] = prj.get('ssoProtection')
    out['project']['passwordProtection'] = bool(prj.get('passwordProtection'))
    out['project']['link'] = (prj.get('link') or {}).get('type')

# 프로젝트 환경 변수: 이름·종류·대상만
st, env = api(f'/v9/projects/{PRJ}/env')
out['project_env'] = [{'key': e.get('key'), 'type': e.get('type'), 'target': e.get('target')} for e in (env or {}).get('envs', [])] if st == 200 else {'status': st, **(env if isinstance(env, dict) else {})}


def flatten(nodes, prefix=''):
    for n in nodes or []:
        p = prefix + '/' + n['name']
        yield p, n
        if n.get('children'):
            yield from flatten(n['children'], p)


def file_tree(dep_id):
    st, tree = api(f'/v6/deployments/{dep_id}/files')
    if st != 200:
        return st, None
    return st, list(flatten(tree))


SUSPECT = re.compile(r'(^|/)(\.env(\.|$)|docs(/|$)|\.claude(/|$)|CLAUDE\.md$|scripts(/|$)|\.git(/|$)|.*\.log$|test-results|playwright-report|node_modules(/|$)|\.next(/|$))')

# 대상 배포 파일 목록
st, items = file_tree(DEP)
out['target'] = {'id': DEP, 'files_status': st}
if items:
    files = [(p, n) for p, n in items if n.get('type') == 'file']
    out['target']['files'] = len(files)
    out['target']['dirs_top_src'] = sorted({p.split('/')[2] for p, _ in items if p.startswith('/src/') and len(p.split('/')) > 2})
    out['target']['env_paths'] = [p for p, _ in items if re.search(r'(^|/)\.env', p)]
    out['target']['src_docs'] = [p for p, _ in items if p == '/src/docs' or p.startswith('/src/docs/')][:5]
    out['target']['suspect'] = sorted({p for p, _ in items if SUSPECT.search(p)})[:40]
    # 업로드된 소스 파일 내용을 .env 값과 비교 (메모리, 건수만)
    hits = {k: 0 for k in secrets}
    hit_files = {}
    sk = re.compile(rb'sk-[A-Za-z0-9_\-]{20,}')
    sk_files = []
    checked = 0
    total = 0
    for p, n in files:
        if not p.startswith('/src/') or n.get('uid') is None:
            continue
        st2, b = api(f'/v7/deployments/{DEP}/files/{n["uid"]}', raw=True)
        if st2 != 200:
            continue
        # v7 응답은 JSON {data: base64} 이거나 원본이다
        try:
            j = json.loads(b)
            if isinstance(j, dict) and 'data' in j:
                b = base64.b64decode(j['data'])
        except Exception:
            pass
        checked += 1
        total += len(b)
        for k, v in secrets.items():
            c = b.count(v.encode())
            if c:
                hits[k] += c
                hit_files.setdefault(k, []).append(p)
        if sk.search(b):
            sk_files.append(p)
    out['target']['content_checked_files'] = checked
    out['target']['content_bytes'] = total
    out['target']['content_env_hits'] = hits
    out['target']['content_env_hit_files'] = hit_files
    out['target']['content_sk_like_files'] = sk_files

# 프로젝트 배포 목록 전부 → 각 배포 files 에 .env 가 있는지
deps, until = [], None
while True:
    q = f'/v6/deployments?projectId={PRJ}&limit=100' + (f'&until={until}' if until else '')
    st, d = api(q)
    if st != 200:
        out['deployments_error'] = {'status': st, **d}
        break
    deps += d.get('deployments', [])
    nxt = (d.get('pagination') or {}).get('next')
    if not nxt:
        break
    until = nxt
rows = []
for dpl in deps:
    st, items = file_tree(dpl['uid'])
    envp = [p for p, _ in items if re.search(r'(^|/)\.env', p)] if items else None
    docs = any(p.startswith('/src/docs') for p, _ in items) if items else None
    rows.append({'uid': dpl['uid'], 'state': dpl.get('state') or dpl.get('readyState'), 'target': dpl.get('target'),
                 'created': time.strftime('%Y-%m-%d %H:%M', time.gmtime(dpl['created'] / 1000)),
                 'source': dpl.get('source'), 'url': dpl.get('url'), 'aliases': None,
                 'files_status': st, 'env_paths': envp, 'has_src_docs': docs})
out['deployments'] = rows

# 아직 남은 .env 포함 배포의 공개 접근 여부(배포 URL 의 /_src)
for r in rows:
    if r['env_paths']:
        try:
            req = urllib.request.Request('https://' + r['url'] + '/_src', method='GET', headers={'User-Agent': 'mindme-critic/1.0'})
            opener = urllib.request.build_opener(type('NR', (urllib.request.HTTPRedirectHandler,), {'redirect_request': lambda *a, **k: None})())
            try:
                resp = opener.open(req, timeout=30)
                r['url_src'] = resp.status
            except urllib.error.HTTPError as e:
                r['url_src'] = f'{e.code} -> {e.headers.get("location", "")[:80]}'
        except Exception as e:
            r['url_src'] = repr(e)[:80]

print(json.dumps(out, ensure_ascii=False, indent=1))
