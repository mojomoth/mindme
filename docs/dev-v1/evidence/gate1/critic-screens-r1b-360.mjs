// Critic r1b: 360px(안드로이드 소형) 목록 헤더 겹침 측정
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto('http://localhost:3101/pocs/screens/list', { waitUntil: 'networkidle' });
await p.waitForTimeout(400);
await p.screenshot({ path: 'docs/dev-v1/evidence/gate1/critic-screens-r1b-list-360.png' });
const r = await p.evaluate(() => {
  const sub = [...document.querySelectorAll('main p')].find((e) => e.textContent.includes('선택해 주세요'));
  const range = document.createRange(); range.selectNodeContents(sub);
  const t = range.getBoundingClientRect();
  const img = document.querySelector('[class*="heroArt"] img').getBoundingClientRect();
  return { textRight: Math.round(t.right), textTop: Math.round(t.top), textBottom: Math.round(t.bottom), imgLeft: Math.round(img.left), imgTop: Math.round(img.top), imgBottom: Math.round(img.bottom), vw: innerWidth };
});
console.log(JSON.stringify(r));
await b.close();
