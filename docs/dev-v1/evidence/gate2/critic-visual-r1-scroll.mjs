#!/usr/bin/env node
// Critic visual r1 보조: 데스크톱 목업에서 스크롤 상태(02 폼 입력 직후, 03 목록 맨 아래)와 상태바 겹침 확인.
// 사용법: STORE=<critic-visual-r1-capture 가 남긴 저장값 json> node docs/dev-v1/evidence/gate2/critic-visual-r1-scroll.mjs
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const OUT = 'docs/dev-v1/evidence/gate2';
const storage = JSON.parse(await readFile(process.env.STORE, 'utf8'));
const b = await chromium.launch();
const res = {};
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const sc = () => page.evaluate(() => { const c = document.querySelector('main').parentElement; return { top: c.scrollTop, h: c.clientHeight, sh: c.scrollHeight }; });
await page.goto('http://localhost:3100', { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: '페르소나 만들기' }).waitFor({ timeout: 6000 });
res.create_initial = await sc();
await page.screenshot({ path: `${OUT}/critic-visual-r1-desktop-s1-create-top.png` });
const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /TXT 파일 업로드/ }).click()]);
await ch.setFiles('pocs/fixtures/analysis/kakao-pc.txt');
res.create_afterFile = await sc();
await page.getByLabel('이름').fill('이지우');
res.create_afterName = await sc();
await page.getByLabel(/지금 나이/).fill('26');
res.create_afterAge = await sc();
// 사용자가 휠로 조금 내렸을 때
await page.evaluate(() => { document.querySelector('main').parentElement.scrollTop = 0; });
await page.mouse.move(720, 500); await page.mouse.wheel(0, 60); await page.waitForTimeout(400);
res.create_wheel60 = await sc();
await page.screenshot({ path: `${OUT}/critic-visual-r1-desktop-s2-create-wheel60.png` });
// 03 목록 맨 아래
await page.evaluate((s) => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('heading', { name: '나의 페르소나' }).waitFor({ timeout: 8000 });
await page.waitForTimeout(500);
res.list_initial = await sc();
await page.mouse.move(720, 500); await page.mouse.wheel(0, 2000); await page.waitForTimeout(600);
res.list_bottom = await sc();
await page.screenshot({ path: `${OUT}/critic-visual-r1-desktop-s3-list-bottom.png` });
await page.mouse.wheel(0, -2000); await page.mouse.wheel(0, 140); await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/critic-visual-r1-desktop-s4-list-mid.png` });
await writeFile(`${OUT}/critic-visual-r1-scroll.json`, JSON.stringify(res, null, 2));
console.log(res);
await b.close();
