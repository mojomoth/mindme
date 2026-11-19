// Gate 3 r2 remote-behavior: (7) 배포 03 목록, 드래프트와 비슷한 3개를 localStorage 주입 (AI 0)
import { chromium } from '/Users/jeongyounglee/work/repo/mindme/node_modules/@playwright/test/index.mjs';
import { writeFile } from 'node:fs/promises';
const BASE = 'https://mindme-rho.vercel.app';
const EV = '/Users/jeongyounglee/work/repo/mindme/docs/dev-v1/evidence/gate3r2';
const ev = (id, title, age, date) => ({ id, title, date, dateEstimated: false, age, emotions: ['설렘', '긴장'], context: '', people: ['민수'], summary: '요약' });
const events = [ev('evt_01', '중학교 생활', 15, '2015-03'), ev('evt_02', '졸업식 날', 19, '2019-02'), ev('evt_03', '첫 출근 날', 25, '2025-03')];
const seed = {
  profile: { name: '홍길동', currentAge: 26 },
  personas: [
    { id: 'per_a', name: '15살의 홍길동', kind: 'past', age: 15, eventId: 'evt_01', phase: 'after', traits: ['수줍음'], speechStyle: '반말', memories: ['기억'], emotions: ['설렘'], greeting: '꿈이 많던 중학생 시절의 나' },
    { id: 'per_b', name: '첫 출근 날의 홍길동', kind: 'past', age: 25, eventId: 'evt_03', phase: 'after', traits: ['긴장'], speechStyle: '반말', memories: ['기억'], emotions: ['설렘'], greeting: '설렘과 긴장이 가득했던 하루' },
    { id: 'per_c', name: '졸업식 날의 홍길동', kind: 'past', age: 19, eventId: 'evt_02', phase: 'after', traits: ['아쉬움'], speechStyle: '반말', memories: ['기억'], emotions: ['설렘'], greeting: '새로운 시작을 앞둔 나' },
  ],
};
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.route('**/api/**', (r) => r.abort());
await ctx.addInitScript(([s, e]) => {
  localStorage.setItem('mindme:profile', JSON.stringify(s.profile));
  localStorage.setItem('mindme:events', JSON.stringify(e));
  localStorage.setItem('mindme:personas', JSON.stringify(s.personas));
}, [seed, events]);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto(BASE, { waitUntil: 'networkidle' });
await p.locator('li button').first().waitFor({ timeout: 10_000 });
await p.waitForLoadState('networkidle');
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(800);
await p.screenshot({ path: `${EV}/remote-behavior-visual-03-list.png`, animations: 'disabled' });
const info = { names: await p.locator('li button strong').allInnerTexts(), errs };
await writeFile(`${EV}/remote-behavior-visual.json`, JSON.stringify(info, null, 2));
console.log(JSON.stringify(info));
await b.close();
