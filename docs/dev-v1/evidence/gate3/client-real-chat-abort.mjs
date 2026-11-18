#!/usr/bin/env node
// 실제 /api/chat(OpenAI) 스트리밍 중 '나가기' → 요청 취소 → 다시 들어오면 '답을 받지 못했어요 · 다시 받기' → 다시 받기로 답 받기.
import { chromium } from '@playwright/test';
const OUT = 'docs/dev-v1/evidence/gate3';
const p0 = { id: 'r1', name: '15살의 이지우', kind: 'past', age: 15, traits: ['수줍음', '고집이 셈'], speechStyle: '짧은 반말', memories: ['체육대회 계주 일로 서진과 다퉜다'], emotions: ['서운함'], greeting: '…왔어? 오늘 좀 기분이 별로야.' };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.addInitScript((d) => { if (!sessionStorage.getItem('s')) { localStorage.clear(); localStorage.setItem('mindme:profile', JSON.stringify({ name: '이지우', currentAge: 26 })); localStorage.setItem('mindme:personas', JSON.stringify([d])); sessionStorage.setItem('s', '1'); } }, p0);
const out = {};
p.on('requestfailed', (r) => r.url().includes('/api/chat') && (out.abortedRequest = r.failure()?.errorText));
await p.goto('http://localhost:3100');
await p.getByRole('heading', { name: '나의 페르소나' }).waitFor({ timeout: 8000 });
await p.locator('ul li button').first().click();
await p.getByLabel('메시지').fill('그날 계주 끝나고 어떤 기분이었어? 길게 얘기해 줘.');
await p.keyboard.press('Enter');
// 답 말풍선이 생기기 시작하면(스트리밍 중) 바로 나간다
await p.waitForFunction(() => document.querySelectorAll('[class*="__bubbleIn"]').length >= 2, null, { timeout: 30000 });
out.partialBeforeLeave = await p.locator('[class*="__bubbleIn"]').nth(1).textContent();
await p.getByRole('button', { name: '나가기' }).click();
await p.getByRole('heading', { name: '나의 페르소나' }).waitFor();
await p.waitForTimeout(500);
out.savedLastRole = await p.evaluate(() => JSON.parse(localStorage.getItem('mindme:chat:r1')).at(-1).role);
await p.locator('ul li button').first().click();
out.alert = (await p.locator('main [role=alert]').textContent()) ?? null;
await p.screenshot({ path: `${OUT}/client-real-05-reenter.png` });
const t0 = Date.now();
await p.getByRole('button', { name: '다시 받기' }).click();
await p.waitForFunction(() => { const m = JSON.parse(localStorage.getItem('mindme:chat:r1')); return m.at(-1).role === 'assistant' && m.length >= 3; }, null, { timeout: 60000 });
out.retrySeconds = (Date.now() - t0) / 1000;
out.reply = (await p.evaluate(() => JSON.parse(localStorage.getItem('mindme:chat:r1')).at(-1).content)).slice(0, 60);
await p.screenshot({ path: `${OUT}/client-real-05-retry-answered.png` });
await b.close();
console.log(JSON.stringify(out, null, 2));
