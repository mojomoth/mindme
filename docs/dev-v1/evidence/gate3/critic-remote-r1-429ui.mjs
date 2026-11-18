#!/usr/bin/env node
// Gate 3 배포 Critic r1: analyze 429(속도 제한)가 걸린 상태에서 만들기 화면이 서버 문구를 그대로 보여 주는지. AI 호출 없음.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const OUT = 'docs/dev-v1/evidence/gate3';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const out = { responses: [] };
page.on('response', (r) => r.url().includes('/api/') && out.responses.push({ status: r.status(), path: new URL(r.url()).pathname, retryAfter: r.headers()['retry-after'] ?? null }));
await page.goto('https://mindme-rho.vercel.app');
await page.getByRole('heading', { name: '페르소나 만들기' }).waitFor({ timeout: 10_000 });
await page.getByLabel('나의 이야기').fill('사람들 앞에 서면 얼굴부터 빨개지는 편이야.');
await page.getByRole('textbox', { name: '이름' }).fill('한도윤');
await page.getByLabel(/지금 나이/).fill('27');
await page.getByRole('button', { name: '페르소나 생성하기' }).click();
await page.getByRole('heading', { name: '페르소나를 만들지 못했어요' }).waitFor({ timeout: 30_000 });
out.alert = await page.locator('main [role=alert]').textContent().catch(() => null);
out.buttons = await page.locator('main button').allTextContents();
await page.screenshot({ path: `${OUT}/critic-remote-r1-429ui.png` });
writeFileSync(`${OUT}/critic-remote-r1-429ui.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
await browser.close();
