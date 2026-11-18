// Critic r1b 보조: 375x667 캡처, 긴 메시지 줄바꿈, 대화 스크롤
import { chromium } from '@playwright/test';
const E = 'docs/dev-v1/evidence/gate1';
const B = 'http://localhost:3101/pocs/screens';
const b = await chromium.launch();
const se = { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const p = await b.newPage(se);
for (const s of ['create', 'list', 'modal']) {
  await p.goto(`${B}/${s}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  await p.screenshot({ path: `${E}/critic-screens-r1b-${s}-se.png` });
}
await p.goto(`${B}/chat`, { waitUntil: 'networkidle' });
const long = 'ㅋ'.repeat(120);
const urlLike = 'https://example.com/' + 'a'.repeat(80);
for (const t of [long, urlLike, '긴 문장 테스트 '.repeat(15), '1', '2', '3', '4']) {
  await p.getByPlaceholder('메시지를 입력하세요').fill(t);
  await p.keyboard.press('Enter'); await p.waitForTimeout(150);
}
await p.waitForTimeout(400);
const r = await p.evaluate(() => {
  const doc = document.documentElement;
  const wide = [...document.querySelectorAll('main *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1).map((el) => el.tagName + '.' + el.className);
  const composer = document.querySelector('textarea, input[placeholder="메시지를 입력하세요"]').getBoundingClientRect();
  return { hScroll: doc.scrollWidth > doc.clientWidth, wide: wide.slice(0, 5), composerBottom: composer.bottom, vh: innerHeight };
});
await p.screenshot({ path: `${E}/critic-screens-r1b-chat-long-se.png` });
console.log(JSON.stringify(r));
await b.close();
