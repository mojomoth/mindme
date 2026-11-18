#!/usr/bin/env node
// Gate 3 배포 Critic r1: 로컬(3100)과 배포 URL 의 같은 화면을 같은 상태로 찍어 픽셀 차이를 잰다. AI 호출 없음.
// 상태는 critic-local-r1-state.json(로컬 Critic 이 남긴 localStorage, 키 없음)을 그대로 심는다.
// 사용법: node docs/dev-v1/evidence/gate3/critic-remote-r1-parity.mjs
import { chromium, devices } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = 'docs/dev-v1/evidence/gate3';
const TARGETS = { local: 'http://localhost:3100', remote: 'https://mindme-rho.vercel.app' };
const state = JSON.parse(readFileSync(`${OUT}/critic-local-r1-state.json`, 'utf8'));
const VIEWS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 },
};
const result = {};
const browser = await chromium.launch();
for (const [view, opts] of Object.entries(VIEWS)) {
  for (const [name, base] of Object.entries(TARGETS)) {
    const ctx = await browser.newContext({ ...opts, reducedMotion: 'reduce', timezoneId: 'Asia/Seoul' });
    const page = await ctx.newPage();
    const bad = [];
    const consoleMsgs = [];
    page.on('response', (r) => r.status() >= 400 && bad.push(`${r.status()} ${new URL(r.url()).pathname}`));
    page.on('console', (m) => ['error', 'warning'].includes(m.type()) && consoleMsgs.push(m.text().slice(0, 200)));
    page.on('pageerror', (e) => consoleMsgs.push(`pageerror: ${e.message}`));
    const snap = async (tag) => {
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/critic-remote-r1-parity-${view}-${tag}-${name}.png` });
    };
    // 01 랜딩 · 02 만들기 (빈 상태)
    await page.goto(base);
    await page.getByRole('heading', { name: '다시 만나는, 그때의 나' }).waitFor();
    await snap('01-landing');
    await page.getByRole('heading', { name: '페르소나 만들기' }).waitFor({ timeout: 8000 });
    await snap('02-create');
    // 03 목록 · 05 대화 (같은 localStorage)
    await page.evaluate((s) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    }, state);
    await page.reload();
    await page.getByRole('heading', { name: '나의 페르소나' }).waitFor({ timeout: 10_000 });
    await snap('03-list');
    await page.getByRole('button', { name: '페르소나 생성' }).click();
    await page.getByRole('dialog').waitFor();
    await snap('04-modal');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const chatId = Object.keys(state).find((k) => k.startsWith('mindme:chat:'))?.slice(12);
    const idx = JSON.parse(state['mindme:personas']).findIndex((p) => p.id === chatId);
    await page.locator('ul li button').nth(Math.max(idx, 0)).click();
    await page.getByRole('button', { name: '프로필 보기' }).waitFor();
    await snap('05-chat');
    result[`${view}-${name}`] = { bad, console: consoleMsgs };
    await ctx.close();
  }
}
await browser.close();
writeFileSync(`${OUT}/critic-remote-r1-parity.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
