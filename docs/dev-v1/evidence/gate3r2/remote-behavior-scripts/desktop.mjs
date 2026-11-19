// Gate 3 r2 remote-behavior: (3) 1440x900·1920x1080 목업 정렬·문서 스크롤, (6) 로컬 3100 vs 배포 01·02·04 같은 크기 캡처
import { chromium } from '/Users/jeongyounglee/work/repo/mindme/node_modules/@playwright/test/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
const REMOTE = 'https://mindme-rho.vercel.app';
const LOCAL = 'http://localhost:3100';
const REPO = '/Users/jeongyounglee/work/repo/mindme';
const EV = `${REPO}/docs/dev-v1/evidence/gate3r2`;
const state = JSON.parse(await readFile(`${EV}/remote-behavior-state.json`, 'utf8'));
const VP = {
  1440: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  1920: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const browser = await chromium.launch();
const out = { at: new Date().toISOString(), frame: {}, parity: {} };

const frame = (page) => page.evaluate(() => {
  const img = document.querySelector('img[width="851"]');
  const screen = img?.closest('[class*="scaler"]')?.querySelector('[class*="screen"]');
  const R = (el) => el && (({ left, top, width, height, right, bottom }) => ({ left: +left.toFixed(1), top: +top.toFixed(1), width: +width.toFixed(1), height: +height.toFixed(1), right: +right.toFixed(1), bottom: +bottom.toFixed(1) }))(el.getBoundingClientRect());
  const ir = R(img), sr = R(screen);
  const de = document.documentElement;
  return {
    img: ir, screen: sr, currentSrc: img?.currentSrc.split('/').pop().slice(0, 50), naturalWidth: img?.naturalWidth, imgComplete: img?.complete,
    screenInsideImg: !!(ir && sr && sr.left >= ir.left && sr.top >= ir.top && sr.right <= ir.right && sr.bottom <= ir.bottom),
    ratios: ir && sr && ir.width ? { left: +((sr.left - ir.left) / ir.width).toFixed(4), top: +((sr.top - ir.top) / ir.height).toFixed(4), width: +(sr.width / ir.width).toFixed(4), height: +(sr.height / ir.height).toFixed(4) } : null,
    centeredX: ir ? Math.abs(ir.left + ir.width / 2 - innerWidth / 2) < 2 : null,
    inViewport: ir ? ir.top >= 0 && ir.left >= 0 && ir.bottom <= innerHeight + 1 && ir.right <= innerWidth + 1 : null,
    docScroll: { sw: de.scrollWidth, sh: de.scrollHeight, cw: de.clientWidth, ch: de.clientHeight, bodySh: document.body.scrollHeight },
    noDocScroll: de.scrollWidth <= de.clientWidth && de.scrollHeight <= de.clientHeight,
    scrollY: (window.scrollTo(0, 99999), window.scrollY),
  };
});
const settle = async (page) => {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
};

// (3) 목업 정렬: 01·02(첫 방문), 03·05(주입)
for (const vp of ['1440', '1920']) {
  const r = (out.frame[vp] = {});
  const errs = [];
  let ctx = await browser.newContext(VP[vp]);
  let page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
  await page.goto(REMOTE, { waitUntil: 'networkidle' });
  await settle(page);
  r['01'] = await frame(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${EV}/remote-behavior-${vp}-01-landing.png`, animations: 'disabled' });
  await page.locator('#pc-story').waitFor({ timeout: 10_000 });
  await settle(page);
  r['02'] = await frame(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${EV}/remote-behavior-${vp}-02-create.png`, animations: 'disabled' });
  await ctx.close();
  ctx = await browser.newContext(VP[vp]);
  await ctx.route('**/api/**', (x) => x.abort());
  await ctx.addInitScript((s) => { if (sessionStorage.getItem('seeded')) return; localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); }, state);
  page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
  await page.goto(REMOTE, { waitUntil: 'networkidle' });
  await page.locator('li button').first().waitFor({ timeout: 10_000 });
  await settle(page);
  r['03'] = await frame(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${EV}/remote-behavior-${vp}-03-list.png`, animations: 'disabled' });
  await page.locator('li button').first().click();
  await page.getByRole('textbox', { name: '메시지' }).waitFor();
  await settle(page);
  r['05'] = await frame(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${EV}/remote-behavior-${vp}-05-chat.png`, animations: 'disabled' });
  r.errors = errs;
  await ctx.close();
}

// (6) 로컬 vs 배포: 01·02(첫 방문), 04(주입 상태에서 모달)
for (const vp of ['1440', '390']) {
  for (const [tag, base] of [['local', LOCAL], ['remote', REMOTE]]) {
    const r = (out.parity[`${vp}-${tag}`] = { fonts: [] });
    let ctx = await browser.newContext(VP[vp]);
    await ctx.route('**/api/**', (x) => x.abort());
    let page = await ctx.newPage();
    page.on('response', (x) => /\.woff2/.test(x.url()) && r.fonts.push(x.url().split('/').pop()));
    await page.goto(base, { waitUntil: 'networkidle' });
    await settle(page);
    r.fontCheck01 = await page.evaluate(() => document.fonts.check('700 28px Pretendard', '다시 만나는'));
    await page.screenshot({ path: `${EV}/remote-behavior-parity-${vp}-01-${tag}.png`, animations: 'disabled' });
    await page.locator('#pc-story').waitFor({ timeout: 10_000 });
    await settle(page);
    await page.screenshot({ path: `${EV}/remote-behavior-parity-${vp}-02-${tag}.png`, animations: 'disabled' });
    await ctx.close();
    ctx = await browser.newContext(VP[vp]);
    await ctx.route('**/api/**', (x) => x.abort());
    await ctx.addInitScript((s) => { if (sessionStorage.getItem('seeded')) return; localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); }, state);
    page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('li button').first().waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: '페르소나 생성' }).click();
    await page.getByRole('dialog').waitFor();
    await settle(page);
    await page.locator('#pm-situation').blur().catch(() => {});
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${EV}/remote-behavior-parity-${vp}-04-${tag}.png`, animations: 'disabled' });
    await ctx.close();
  }
}
await browser.close();
await writeFile(`${EV}/remote-behavior-desktop.json`, JSON.stringify(out, null, 2));
for (const vp of ['1440', '1920']) for (const s of ['01', '02', '03', '05']) { const f = out.frame[vp][s]; console.log(vp, s, JSON.stringify({ inside: f.screenInsideImg, ratios: f.ratios, centered: f.centeredX, inVp: f.inViewport, noScroll: f.noDocScroll, scrollY: f.scrollY, doc: f.docScroll, src: f.currentSrc, nat: f.naturalWidth, img: f.img })); }
console.log(JSON.stringify(out.frame['1440'].errors), JSON.stringify(out.frame['1920'].errors));
console.log(JSON.stringify(out.parity));
