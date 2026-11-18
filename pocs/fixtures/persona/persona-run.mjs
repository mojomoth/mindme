#!/usr/bin/env node
// POST /api/persona 실측 4케이스(과거+사건, 과거 자유, 현재, 미래). 실제 AI 호출 4회.
// 사용법: node pocs/fixtures/persona/persona-run.mjs [출력 디렉터리]   (dev 서버 3101 필요)
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? path.join(here, '../../../docs/dev-v1/evidence/gate1'));

for (const name of ['past-event', 'past-free', 'present', 'future']) {
  const fixture = `pocs/fixtures/persona/req-${name}.json`;
  const body = JSON.parse(await readFile(path.join(here, `req-${name}.json`), 'utf8'));
  const t = Date.now();
  const res = await fetch('http://localhost:3101/api/persona', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const ms = Date.now() - t;
  const response = await res.json();
  const request = { ...body, events: `${body.events?.length ?? 0}개 (fixture 참고)` };
  await writeFile(
    path.join(out, `persona-${name}.json`),
    `${JSON.stringify({ at: new Date().toISOString(), endpoint: 'POST /api/persona', model: 'gpt-6-astra', fixture, request, status: res.status, ms, response }, null, 2)}\n`,
  );
  console.log(name, res.status, `${ms}ms`, response.persona?.name ?? response.error?.message);
}
