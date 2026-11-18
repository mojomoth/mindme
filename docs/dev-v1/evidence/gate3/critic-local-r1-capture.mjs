#!/usr/bin/env node
// Gate 3 로컬 Critic r1: 모바일 390x844 화면 01~05 캡처 + 데스크톱 1280x720·1440x900·1920x1080 목업 정합·내부 스크롤.
// critic-local-r1-flow.mjs 가 남긴 localStorage(critic-local-r1-state.json)를 넣어 실제 앱 상태로 그린다. AI 호출 없음.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost:3100';
const OUT = 'docs/dev-v1/evidence/gate3';
const P = 'critic-local-r1';
const state = JSON.parse(readFileSync(`${OUT}/${P}-state.json`, 'utf8'));
const log = { mobile: {}, desktop: {}, console: [], errors: [] };
const LIST = (page) => page.getByRole('heading', { name: '나의 페르소나' });
const DRAFT_SITUATION = '새 학기가 시작된 날,\n친구에게 먼저 말을 걸고 싶었던 나.';

const browser = await chromium.launch();
async function ctxWith(opts, withState) {
  const ctx = await browser.newContext(opts);
  if (withState) await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, state);
  const page = await ctx.newPage();
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && log.console.push(`${m.type()}: ${m.text().slice(0, 200)}`));
  page.on('pageerror', (e) => log.console.push(`pageerror: ${e.message}`));
  return { ctx, page };
}
async function setSlider(page, target) {
  const s = page.getByLabel('그때의 나이');
  await s.focus();
  await page.keyboard.press('Home');
  for (let i = 5; i < target; i++) await page.keyboard.press('ArrowRight');
}
const chatName = JSON.parse(state['mindme:personas']).find((p) => (state[`mindme:chat:${p.id}`] ?? '[]').length > 5)?.name;

// 목업·화면 정합 측정 (PhoneFrame: stage > device > scaler > [screen, img.frame])
const measure = (page) =>
  page.evaluate(() => {
    const frame = document.querySelector('img[width="851"][height="1848"]');
    if (!frame || getComputedStyle(frame).display === 'none') return { mockup: false, docScrollW: document.documentElement.scrollWidth, vw: innerWidth, docScrollH: document.documentElement.scrollHeight, vh: innerHeight };
    const screen = frame.previousElementSibling;
    const content = screen.children[1];
    const f = frame.getBoundingClientRect();
    const s = screen.getBoundingClientRect();
    const r = (n) => Math.round(n * 100) / 100;
    const exp = { left: f.left + f.width * 0.042303, top: f.top + f.height * 0.018398, width: f.width * 0.916569, height: f.height * 0.964827 };
    return {
      mockup: true,
      vw: innerWidth,
      vh: innerHeight,
      frame: { x: r(f.left), y: r(f.top), w: r(f.width), h: r(f.height) },
      centerOffset: { x: r(f.left + f.width / 2 - innerWidth / 2), y: r(f.top + f.height / 2 - innerHeight / 2) },
      screenVsExpected: { dl: r(s.left - exp.left), dt: r(s.top - exp.top), dw: r(s.width - exp.width), dh: r(s.height - exp.height) },
      inViewport: f.left >= 0 && f.top >= 0 && f.right <= innerWidth + 0.5 && f.bottom <= innerHeight + 0.5,
      docScroll: { w: document.documentElement.scrollWidth > innerWidth, h: document.documentElement.scrollHeight > innerHeight + 1 },
      content: { scrollH: content.scrollHeight, clientH: content.clientHeight, overflowY: getComputedStyle(content).overflowY },
    };
  });
const innerScroll = (page) =>
  page.evaluate(async () => {
    const frame = document.querySelector('img[width="851"][height="1848"]');
    const content = frame && getComputedStyle(frame).display !== 'none' ? frame.previousElementSibling.children[1] : document.scrollingElement;
    // 실제로 스크롤되는 요소(내용 영역 또는 그 안의 스크롤러)
    const all = [content, ...content.querySelectorAll('*')].filter((el) => el.scrollHeight > el.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(el).overflowY));
    const el = all[0];
    if (!el) return { scroller: null };
    el.scrollTop = el.scrollHeight;
    await new Promise((r) => setTimeout(r, 200));
    return { scroller: el.tagName + (el === content ? '(content)' : ''), scrollTop: Math.round(el.scrollTop), max: el.scrollHeight - el.clientHeight, windowY: scrollY };
  });
const footerOverlap = (page) =>
  page.evaluate(() => {
    const hint = [...document.querySelectorAll('p,span,div')].find((e) => e.childElementCount === 0 && e.textContent?.trim() === '다른 순간의 나도 만나보세요');
    const cta = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('페르소나 생성'));
    if (!hint || !cta) return null;
    const h = hint.getBoundingClientRect();
    const c = cta.getBoundingClientRect();
    return { hintBottom: Math.round(h.bottom), ctaTop: Math.round(c.top), gap: Math.round(c.top - h.bottom), covered: h.bottom > c.top };
  });

try {
  // ── 모바일 390x844
  const M = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
  {
    const { ctx, page } = await ctxWith(M, false);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '다시 만나는, 그때의 나' }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${P}-mobile-01-landing.png` });
    log.mobile.landing = await measure(page);
    await page.getByRole('heading', { name: '페르소나 만들기' }).waitFor({ timeout: 8000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${P}-mobile-02-create.png` });
    log.mobile.create = await measure(page);
    await ctx.close();
  }
  {
    const { ctx, page } = await ctxWith(M, true);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await LIST(page).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${P}-mobile-03-list.png` });
    log.mobile.list = { measure: await measure(page), personas: await page.locator('ul li').count() };
    log.mobile.listScroll = await innerScroll(page);
    await page.waitForTimeout(300);
    log.mobile.listFooter = await footerOverlap(page);
    await page.screenshot({ path: `${OUT}/${P}-mobile-03b-list-end.png` });
    await page.evaluate(() => (document.scrollingElement.scrollTop = 0));
    await page.getByRole('button', { name: '페르소나 생성' }).click();
    await page.getByRole('dialog').waitFor();
    await page.getByLabel('상황 설명').fill(DRAFT_SITUATION);
    await setSlider(page, 15);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${P}-mobile-04-modal.png` });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    const names = await page.locator('ul li strong').allTextContents();
    await page.locator('ul li button').nth(Math.max(0, names.indexOf(chatName))).click();
    await page.getByRole('button', { name: '프로필 보기' }).waitFor();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${P}-mobile-05-chat.png` });
    log.mobile.chat = await measure(page);
    await page.getByRole('button', { name: '프로필 보기' }).click();
    await page.getByRole('dialog').waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${P}-mobile-06-profile.png` });
    await ctx.close();
  }

  // ── 데스크톱 3종: 목업 중앙·화면 영역 정합·내부 스크롤
  for (const [w, h] of [[1280, 720], [1440, 900], [1920, 1080]]) {
    const tag = `${w}x${h}`;
    const { ctx, page } = await ctxWith({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }, true);
    const r = {};
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '다시 만나는, 그때의 나' }).waitFor();
    r.landing = await measure(page);
    await LIST(page).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(600);
    r.list = await measure(page);
    await page.screenshot({ path: `${OUT}/${P}-${tag}-03-list.png` });
    r.listScroll = await innerScroll(page);
    await page.waitForTimeout(300);
    r.listFooter = await footerOverlap(page);
    await page.screenshot({ path: `${OUT}/${P}-${tag}-03b-list-end.png` });
    if (w === 1440) {
      await page.getByRole('button', { name: '페르소나 생성' }).click();
      await page.getByRole('dialog').waitFor();
      await page.getByLabel('상황 설명').fill(DRAFT_SITUATION);
      await setSlider(page, 15);
      await page.waitForTimeout(400);
      r.modal = await measure(page);
      await page.screenshot({ path: `${OUT}/${P}-${tag}-04-modal.png` });
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'detached' });
    }
    const names = await page.locator('ul li strong').allTextContents();
    await page.locator('ul li button').nth(Math.max(0, names.indexOf(chatName))).click();
    await page.getByRole('button', { name: '프로필 보기' }).waitFor();
    await page.waitForTimeout(600);
    r.chat = await measure(page);
    await page.screenshot({ path: `${OUT}/${P}-${tag}-05-chat.png` });
    r.chatScroll = await page.evaluate(() => {
      const sec = document.querySelector('main section');
      let el = sec;
      while (el && !(el.scrollHeight > el.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
      return el ? { scroller: el.tagName, atBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 4, windowY: scrollY } : { scroller: null };
    });
    log.desktop[tag] = r;
    await ctx.close();
  }
} catch (err) {
  log.errors.push(String(err?.stack ?? err).slice(0, 1500));
  console.error(err);
} finally {
  writeFileSync(`${OUT}/${P}-capture.json`, JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log, null, 1).slice(0, 6000));
  await browser.close();
}
