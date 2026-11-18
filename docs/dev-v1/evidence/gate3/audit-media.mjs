import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const out = {};
for (const [kind, opts] of Object.entries({ mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 } } })) {
  const page = await browser.newPage(opts);
  const got = [];
  page.on('response', async (r) => { const u = r.url(); if (/\.(png|woff2|webp|jpg)(\?|$)/.test(u) || u.includes('/_next/image')) { let len = 0; try { len = (await r.body()).length; } catch {} got.push({ file: u.split('/').pop().split('?')[0], bytes: len }); } });
  await page.goto('http://localhost:3100/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  out[kind] = got;
  await page.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
