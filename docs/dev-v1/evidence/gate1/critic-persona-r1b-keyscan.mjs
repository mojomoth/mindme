#!/usr/bin/env node
// Critic r1b: .env 의 키 값이 /pocs/persona·/pocs/chat HTML·JS 청크·API 응답·증거 파일에 있는지 찾는다. 값은 출력하지 않고 개수만 낸다.
import { readFileSync, readdirSync } from 'node:fs';
const BASE = 'http://localhost:3101';
const env = readFileSync(new URL('../../../../.env', import.meta.url), 'utf8');
const secrets = env.split('\n').map((l) => /^\s*([A-Z0-9_]*(KEY|TOKEN|SECRET)[A-Z0-9_]*)\s*=\s*"?([^"\s]+)"?/.exec(l)).filter(Boolean).map((m) => ({ name: m[1], v: m[3] })).filter((s) => s.v.length >= 12);
const probes = secrets.flatMap((s) => [s.v, s.v.slice(-12), s.v.slice(0, 16)]);
const hit = (t) => probes.some((p) => t.includes(p));
const res = { secretsChecked: secrets.map((s) => s.name), pages: {}, chunks: 0, chunkHits: 0, apiHits: 0, evidenceHits: [] };
const seen = new Set();
for (const p of ['/pocs/persona', '/pocs/chat']) {
  const html = await (await fetch(BASE + p)).text();
  res.pages[p] = { htmlHit: hit(html) };
  for (const src of html.match(/\/_next\/static\/[^"']+\.js/g) ?? []) {
    if (seen.has(src)) continue; seen.add(src);
    const js = await (await fetch(BASE + src)).text();
    res.chunks++; if (hit(js)) res.chunkHits++;
    if (/OPENAI_API_KEY|process\.env\.OPENAI/.test(js)) res.envNameInChunk = (res.envNameInChunk ?? 0) + 1;
  }
}
for (const [u, b] of [['/api/persona', '{}'], ['/api/persona/avatar', '{"age":3,"kind":"past"}'], ['/api/persona', 'x']]) {
  const r = await fetch(BASE + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: b });
  const t = await r.text() + JSON.stringify([...r.headers]);
  if (hit(t)) res.apiHits++;
}
const dir = new URL('.', import.meta.url);
for (const f of readdirSync(dir)) if (/^(critic-persona-r1b|persona-)/.test(f)) { const t = readFileSync(new URL(f, dir)).toString('latin1'); if (hit(t)) res.evidenceHits.push(f); }
const log = readFileSync(new URL('../../logs/pocs-dev.log', import.meta.url), 'utf8');
res.devLogHit = hit(log);
console.log(JSON.stringify(res, null, 2));
