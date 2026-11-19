#!/usr/bin/env node
// 브라우저(Chromium)에서 배포 페이지 출처로 5MB 본문 POST 1회 → 응답이 413 으로 오는지(연결 끊김이 아닌지),
// apps/web/lib/api.ts post() 와 같은 규칙으로 한국어 문구가 나오는지. AI 호출 없음.
import { chromium } from '/Users/jeongyounglee/work/repo/mindme/node_modules/@playwright/test/index.mjs';
import { writeFileSync } from 'node:fs';
const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const net = [];
page.on('response', (r) => r.url().includes('/api/') && net.push({ status: r.status(), path: new URL(r.url()).pathname, xVercelError: r.headers()['x-vercel-error'] ?? null }));
page.on('requestfailed', (r) => net.push({ failed: r.failure()?.errorText, path: new URL(r.url()).pathname }));
await page.goto('https://mindme-rho.vercel.app/');
const result = await page.evaluate(async () => {
  // apps/web/lib/api.ts post() 의 오류 처리 규칙을 그대로 옮김
  const OFFLINE = '연결이 잠깐 끊겼어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
  const hangul = /[가-힣]/;
  const body = JSON.stringify({ persona: {}, messages: [{ role: 'user', content: 'a'.repeat(5_000_000) }] });
  const t = performance.now();
  let res;
  try {
    res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  } catch (e) {
    return { networkError: String(e), shown: OFFLINE, ms: performance.now() - t };
  }
  const msg = (await res.json().catch(() => null))?.error?.message;
  const shown = typeof msg === 'string' && hangul.test(msg) ? msg : res.status === 413 ? '보낸 내용이 너무 커요. 조금 줄여서 다시 해 주세요.' : '서버가 잠시 대답하지 않아요. 잠시 뒤 다시 시도해 주세요.';
  return { status: res.status, bytes: body.length, shown, ms: Math.round(performance.now() - t) };
});
// 배포 번들에 같은 문구가 실제로 들어 있는지
const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean));
let bundleHas = 0;
for (const src of scripts) bundleHas += (await (await fetch(src)).text()).includes('보낸 내용이 너무 커요. 조금 줄여서 다시 해 주세요.') ? 1 : 0;
const out = { item: 'remote-security-4 413 browser', at: new Date().toISOString(), result, net, scripts: scripts.length, bundleFilesWith413Text: bundleHas };
writeFileSync(`${OUT}/pw413.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await browser.close();
