#!/usr/bin/env node
// remote-security 4) 4.5MB 초과 본문 → Vercel 413 을 웹 앱의 실제 클라이언트 코드(apps/web/lib/api.ts postJson)가
// 한국어로 바꾸는지 본다. 배포에 5MB POST 1회(/api/chat, AI 호출 없음). fetch 를 감싸 원래 응답도 기록한다.
import { writeFileSync } from 'node:fs';
import { postJson, errorText } from '/Users/jeongyounglee/work/repo/mindme/apps/web/lib/api.ts';

const BASE = 'https://mindme-rho.vercel.app';
const out = process.argv[2] ?? '.';
const raw = {};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const t = Date.now();
  const res = await realFetch(url, init);
  const copy = res.clone();
  raw.url = String(url);
  raw.requestBytes = Buffer.byteLength(init.body);
  raw.ms = Date.now() - t;
  raw.status = res.status;
  raw.headers = Object.fromEntries([...res.headers].filter(([k]) => /content-type|x-vercel-error|x-vercel-id|cache-control|server/.test(k)));
  raw.body = (await copy.text()).slice(0, 300);
  return res;
};
const body = { persona: {}, messages: [{ role: 'user', content: 'a'.repeat(5_000_000) }] };
let thrown = null;
try {
  await postJson(`${BASE}/api/chat`, body);
} catch (e) {
  thrown = { message: e.message, errorText: errorText(e) };
}
const result = { item: 'remote-security-4 413', at: new Date().toISOString(), raw, clientThrown: thrown };
writeFileSync(`${out}/p413.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
