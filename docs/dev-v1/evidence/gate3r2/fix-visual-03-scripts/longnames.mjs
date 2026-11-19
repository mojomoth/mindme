// 줄 높이를 줄인 뒤 긴 이름·미리보기(두 줄 말줄임)가 잘리거나 넘치지 않는지: localStorage 시드, API 차단(AI 호출 없음)
import { chromium } from '/Users/jeongyounglee/work/repo/mindme/node_modules/@playwright/test/index.mjs';
const EV = '/Users/jeongyounglee/work/repo/mindme/docs/dev-v1/evidence/gate3r2';
const base = { kind: 'past', traits: ['낯가림'], speechStyle: '반말', memories: ['기억'], emotions: ['외로움'] };
const personas = [
  { ...base, id: 'per_a', age: 13, name: '부산 학교로 전학 간 첫날의 서하린', greeting: '새 학교 첫날인데 다들 사투리를 써서 하나도 못 알아듣겠어. 오늘 기분 별로야.' },
  { ...base, id: 'per_b', age: 14, name: '가나다라마바사아자차카타파하거너더러머버서어저의서하린', greeting: '띄어쓰기 없는 긴 이름도 칸 밖으로 넘치지 않아야 해요.' },
  { ...base, id: 'per_c', age: 17, name: '17살의 서하린', greeting: '짧은 인사' },
  { ...base, kind: 'present', id: 'per_d', age: 26, name: '지금의 서하린', greeting: '요즘 어때?' },
];
const seed = { 'mindme:profile': JSON.stringify({ name: '서하린', currentAge: 26 }), 'mindme:events': '[]', 'mindme:personas': JSON.stringify(personas) };
const b = await chromium.launch();
const out = {};
for (const [vp, opts] of Object.entries({ 360: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true }, 390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true } })) {
  const ctx = await b.newContext(opts);
  await ctx.route('**/api/**', (r) => r.abort());
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed);
  const p = await ctx.newPage();
  await p.goto('http://localhost:3100', { waitUntil: 'networkidle' });
  await p.locator('main').first().click();
  await p.locator('li button').first().waitFor();
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await p.locator('ul').first().screenshot({ path: `${EV}/fix-visual-03-longnames-${vp}.png`, animations: 'disabled' });
  out[vp] = await p.evaluate(() => [...document.querySelectorAll('li button')].map((btn) => {
    const els = [...btn.querySelectorAll('strong, span > span')];
    const row = btn.getBoundingClientRect();
    return {
      h: Math.round(row.height),
      bg: getComputedStyle(btn.querySelector('span')).backgroundColor,
      badge: Boolean(btn.querySelector('em')),
      text: els.map((el) => ({ lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)), overflowX: el.scrollWidth > el.clientWidth + 1, inside: el.getBoundingClientRect().bottom <= row.bottom })),
    };
  }));
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out));
