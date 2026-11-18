#!/usr/bin/env node
// Gate 3 배포 Critic r1 보충: 메인 흐름에서 과거 모달이 '이미 있어요' 질문으로 끝나서, 겹치지 않는 과거(20살)를 배포에서 한 번 만든다.
// 상태는 critic-local-r1-state.json 을 심는다(키 없음). 사용법: node docs/dev-v1/evidence/gate3/critic-remote-r1-modal-past.mjs
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const OUT = 'docs/dev-v1/evidence/gate3';
const state = JSON.parse(readFileSync(`${OUT}/critic-local-r1-state.json`, 'utf8'));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const out = { console: [], bad: [] };
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && out.console.push(m.text().slice(0, 200)));
page.on('response', (r) => r.status() >= 400 && out.bad.push(`${r.status()} ${r.url()}`));
await page.goto('https://mindme-rho.vercel.app');
await page.evaluate((s) => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, state);
await page.reload();
await page.getByRole('heading', { name: '나의 페르소나' }).waitFor({ timeout: 10_000 });
const before = (await page.locator('ul li strong').allTextContents()).length;
await page.getByRole('button', { name: '페르소나 생성' }).click();
await page.getByRole('dialog').waitFor();
await page.getByLabel('상황 설명').fill('스무 살 여름, 처음 혼자 떠난 제주 여행에서 길을 잃었던 밤의 나');
const s = page.getByLabel('그때의 나이');
await s.focus(); await page.keyboard.press('Home');
for (let i = 5; i < 20; i++) await page.keyboard.press('ArrowRight');
out.pill = await page.locator('[role=dialog] output').textContent();
await page.screenshot({ path: `${OUT}/critic-remote-r1-modal-past-04.png` });
const t = Date.now();
await page.getByRole('button', { name: '생성하기' }).click();
await page.waitForTimeout(800);
out.duplicateAsked = await page.getByRole('button', { name: '대화 이어가기' }).isVisible().catch(() => false);
if (!out.duplicateAsked) {
  await page.getByRole('heading', { name: '나의 페르소나' }).waitFor({ timeout: 120_000 });
  out.ms = Date.now() - t;
  const p = JSON.parse(await page.evaluate(() => localStorage.getItem('mindme:personas')))[0];
  out.made = { name: p.name, kind: p.kind, age: p.age, greeting: p.greeting, avatar: p.avatar?.slice(0, 22) ?? null };
  out.count = { before, after: (await page.locator('ul li strong').allTextContents()).length };
  await page.screenshot({ path: `${OUT}/critic-remote-r1-modal-past-03.png` });
}
writeFileSync(`${OUT}/critic-remote-r1-modal-past.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
await browser.close();
