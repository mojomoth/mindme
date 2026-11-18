#!/usr/bin/env node
// POST /api/persona/avatar 실측: 기본(사진 없음) 1건 + 생성 2건(15살 과거, 40살 미래). 실제 gpt-image-2 호출 2회.
// 사용법: node pocs/fixtures/persona/avatar-run.mjs [출력 디렉터리]   (dev 서버 3101 필요)
// 결과: persona-avatar.json, persona-avatar-<run>.webp|png
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? path.join(here, '../../../docs/dev-v1/evidence/gate1'));
const base = 'http://localhost:3101';
const face = `data:image/jpeg;base64,${(await readFile(path.join(here, 'synthetic-face.jpg'))).toString('base64')}`;

const cases = [
  { run: 'default', age: 15, kind: 'past' },
  { run: 'generated-past15', age: 15, kind: 'past', photo: face },
  { run: 'generated-future40', age: 40, kind: 'future', photo: face },
];

const runs = [];
for (const c of cases) {
  const { run, ...body } = c;
  const t = Date.now();
  const res = await fetch(`${base}/api/persona/avatar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const ms = Date.now() - t;
  const data = await res.json();
  let bytes = null;
  if (res.ok) {
    const url = data.avatar.startsWith('data:') ? data.avatar : `${base}${data.avatar}`;
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    bytes = buf.length;
    const ext = data.avatar.startsWith('data:image/webp') ? 'webp' : 'png';
    await writeFile(path.join(out, `persona-avatar-${run}.${ext}`), buf);
  }
  runs.push({
    run,
    age: c.age,
    kind: c.kind,
    photo: c.photo ? `pocs/fixtures/persona/synthetic-face.jpg (data URL ${c.photo.length} chars)` : null,
    status: res.status,
    ms,
    serverTiming: res.headers.get('server-timing'),
    source: data.source ?? null,
    avatar: data.avatar?.startsWith('data:') ? `${data.avatar.slice(0, 30)}… (${data.avatar.length} chars)` : (data.avatar ?? data.error),
    imageBytes: bytes,
  });
  console.log(run, res.status, `${ms}ms`);
}

await writeFile(
  path.join(out, 'persona-avatar.json'),
  `${JSON.stringify({ at: new Date().toISOString(), endpoint: 'POST /api/persona/avatar (JSON, AvatarRequestSchema)', model: 'gpt-image-2 (images.edit, 1024x1024, quality medium, webp q80)', runs }, null, 2)}\n`,
);
