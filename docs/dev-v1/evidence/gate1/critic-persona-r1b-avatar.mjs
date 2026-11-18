#!/usr/bin/env node
// Critic r1b: /api/persona/avatar 실제 호출. 사진 없음 / 8살 과거(JPEG) / 60살 미래(PNG) / 34살 현재(JPEG 512) / 깨진 이미지 데이터.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const out = path.dirname(fileURLToPath(import.meta.url));
const scratch = process.argv[2];
const base = 'http://localhost:3101';
const jpg = 'data:image/jpeg;base64,' + readFileSync(path.join(scratch, 'face-1024.jpg')).toString('base64');
const png = 'data:image/png;base64,' + readFileSync(path.join(scratch, 'face-768.png')).toString('base64');
const jpg512 = 'data:image/jpeg;base64,' + readFileSync(path.join(scratch, 'face-512.jpg')).toString('base64');
const cases = {
  default: { age: 20, kind: 'past' },
  past8: { age: 8, kind: 'past', photo: jpg },
  future60: { age: 60, kind: 'future', photo: png },
  present34: { age: 34, kind: 'present', photo: jpg512 },
  broken: { age: 20, kind: 'past', photo: 'data:image/jpeg;base64,AAAAAAAAAAAAAAAA' },
};
const res = {};
await Promise.all(Object.entries(cases).map(async ([k, body]) => {
  const reqBytes = JSON.stringify(body).length;
  const t = Date.now();
  const r = await fetch(base + '/api/persona/avatar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await r.text();
  const ms = Date.now() - t;
  let j; try { j = JSON.parse(text); } catch { j = null; }
  const info = { status: r.status, ms, reqBytes, respBytes: text.length, serverTiming: r.headers.get('server-timing'), source: j?.source, error: j?.error };
  if (j?.avatar?.startsWith('data:')) {
    const [, fmt, b64] = /^data:image\/(\w+);base64,(.*)$/.exec(j.avatar);
    const file = `critic-persona-r1b-avatar-${k}.${fmt}`;
    writeFileSync(path.join(out, file), Buffer.from(b64, 'base64'));
    info.file = file; info.imageBytes = Buffer.from(b64, 'base64').length;
  } else if (j?.avatar) info.avatar = j.avatar;
  res[k] = info;
}));
writeFileSync(path.join(out, 'critic-persona-r1b-avatar.json'), JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
