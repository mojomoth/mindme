// recheck-behavior-r1: VISUAL-03 + 회귀(01→02→03→04→05). /api/* 는 가짜 응답(AI 호출 0).
// A: 첫 생성(가짜 analyze·persona)으로 드래프트와 같은 상태(준비 알림 + 새로운 표시) → 04 모달로 1개 더 → 05 대화
// B: localStorage 주입(드래프트 비슷한 3개) → 새로고침 뒤 목록
import { chromium } from '/Users/jeongyounglee/work/repo/mindme/node_modules/@playwright/test/index.mjs';
import { writeFileSync } from 'node:fs';
const REPO = '/Users/jeongyounglee/work/repo/mindme';
const EV = `${REPO}/docs/dev-v1/evidence/gate3r2`;
const BASE = 'http://localhost:3100';
const { personaName } = await import(`${REPO}/packages/core/src/persona/persona.ts`);
const shot = (n) => `${EV}/recheck-behavior-r1-${n}.png`;
const VP = {
  390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  360: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  1440: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const ev = (id, title, age, date) => ({ id, title, date, dateEstimated: false, age, emotions: ['설렘', '긴장'], context: '', people: ['민수'], summary: '요약' });
const events = [ev('evt_01', '중학교 생활', 15, '2015-03'), ev('evt_02', '졸업식 날', 19, '2019-02'), ev('evt_03', '첫 출근 날', 25, '2025-03')];
const greet = { 15: '꿈이 많던 중학생 시절의 나', 19: '새로운 시작을 앞둔 나', 25: '설렘과 긴장이 가득했던 하루', 16: '처음 교복을 입은 날의 나' };
const RGB = { 'rgb(220, 234, 248)': 'blue', 'rgb(254, 241, 197)': 'yellow', 'rgb(254, 223, 210)': 'peach' };

async function fakeApi(ctx) {
  await ctx.route('**/api/**', async (r) => {
    const url = r.request().url();
    if (url.endsWith('/api/analyze')) return r.fulfill({ json: { events, owner: { name: '홍길동', currentAge: 26 }, meta: { mode: 'direct', chunks: 1, units: 3, participants: [] } } });
    if (url.endsWith('/api/persona')) {
      const q = r.request().postDataJSON();
      const picked = q.events.find((e) => e.id === q.eventId);
      return r.fulfill({ json: { persona: { id: `per_${q.age}_${Date.now() % 100000}`, name: personaName(q.kind, q.age, q.profile.name, picked?.title), kind: q.kind, age: q.age, ...(picked ? { eventId: picked.id, phase: 'after' } : {}), traits: ['수줍음'], speechStyle: '반말', memories: ['기억'], emotions: ['설렘'], greeting: greet[q.age] ?? '안녕! 미래의 나는 어떻게 지내고 있어?' } } });
    }
    if (url.endsWith('/api/chat')) return r.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', headers: { 'x-crisis': '0' }, body: '음… 새 학기가 조금 걱정돼. 친구들이랑 반이 갈릴까 봐.' });
    return r.abort();
  });
}

/** 03 목록 실측 */
const measureList = (page) => page.evaluate((RGB) => {
  const vw = document.documentElement.clientWidth;
  const main = document.querySelector('main')?.getBoundingClientRect();
  const cards = [...document.querySelectorAll('li button')].map((b) => {
    const r = b.getBoundingClientRect();
    const av = b.querySelector(':scope > span');
    const bg = getComputedStyle(av).backgroundColor;
    const strong = b.querySelector('strong');
    const desc = b.querySelector('strong + span');
    return {
      name: strong.textContent, desc: desc?.textContent, isNew: !!b.querySelector('em'),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      bg, bgName: RGB[bg] ?? bg,
      textOverflow: [strong, desc].some((el) => el && el.scrollWidth > el.clientWidth + 1),
      insideMain: main ? r.left >= main.left - 0.5 && r.right <= main.right + 0.5 : null,
    };
  });
  const ready = document.querySelector('p[role="status"]');
  return {
    docOverflowX: document.documentElement.scrollWidth > vw + 1,
    mainRect: main && { x: Math.round(main.x), y: Math.round(main.y), w: Math.round(main.width), h: Math.round(main.height) },
    ready: ready ? ready.textContent : null,
    newBadges: [...document.querySelectorAll('li em')].map((e) => e.textContent),
    cards,
  };
}, RGB);

/** 맨 아래로 스크롤했을 때 '다른 순간의 나도…'가 생성 버튼에 가리는지 */
const bottomCheck = (page) => page.evaluate(() => {
  const peek = [...document.querySelectorAll('p')].find((p) => p.textContent.includes('다른 순간의 나도'));
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('페르소나 생성'));
  const sc = [peek, ...(function* up(el) { while ((el = el?.parentElement)) yield el; })(peek)].find((el) => el && el.scrollHeight > el.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(el).overflowY)) ?? document.scrollingElement;
  sc.scrollTop = sc.scrollHeight;
  const a = peek.getBoundingClientRect();
  const b = btn.getBoundingClientRect();
  return { peekBottom: Math.round(a.bottom), buttonTop: Math.round(b.top), hiddenByButton: a.bottom > b.top + 1 };
});

const out = { at: new Date().toISOString(), A: {}, B: {} };
const browser = await chromium.launch();

for (const vp of [390, 360, 1440]) {
  const ctx = await browser.newContext(VP[vp]);
  await fakeApi(ctx);
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(`${m.type()}: ${m.text().slice(0, 300)}`));
  page.on('pageerror', (e) => errs.push(`pageerror: ${String(e).slice(0, 300)}`));
  const r = (out.A[vp] = { steps: [] });
  try {
    // 01 랜딩 → 02 만들기(3초 뒤 자동)
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    r.steps.push({ s: '01', text: (await page.locator('main').first().innerText()).replace(/\s+/g, ' ').slice(0, 60) });
    await page.screenshot({ path: shot(`${vp}-01-landing`), animations: 'disabled' });
    await page.locator('#pc-story').waitFor({ timeout: 10_000 });
    await page.waitForTimeout(400);
    r.steps.push({ s: '02', ok: true });
    await page.screenshot({ path: shot(`${vp}-02-create`), animations: 'disabled' });
    await page.locator('#pc-story').fill('중학교 때 꿈이 많았어요.');
    await page.getByPlaceholder('홍길동').fill('홍길동');
    await page.getByPlaceholder('32').fill('26');
    await page.getByRole('button', { name: '페르소나 생성하기' }).click();
    // 03 목록
    await page.locator('li button').first().waitFor({ timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(900);
    r.list = await measureList(page);
    await page.screenshot({ path: shot(`${vp}-03-list`), animations: 'disabled' });
    r.bottom = await bottomCheck(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot(`${vp}-03-list-bottom`), animations: 'disabled' });
    await page.evaluate(() => { const m = document.querySelector('main'); (m?.scrollHeight > m?.clientHeight ? m : document.scrollingElement).scrollTop = 0; });
    r.steps.push({ s: '03', names: r.list.cards.map((c) => c.name) });
    // 04 모달 → 1개 더
    await page.getByRole('button', { name: '페르소나 생성' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await page.locator('#pm-situation').fill('고등학교 입학식 날 처음 교복을 입었어');
    await page.locator('#pm-age').fill('16');
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot(`${vp}-04-modal`), animations: 'disabled' });
    r.steps.push({ s: '04', pill: await dialog.locator('output').innerText() });
    await dialog.getByRole('button', { name: '생성하기' }).click();
    if (await page.getByRole('button', { name: '새로 만들기' }).isVisible().catch(() => false)) await page.getByRole('button', { name: '새로 만들기' }).click();
    await page.waitForFunction(() => document.querySelectorAll('li button').length === 4, null, { timeout: 20_000 });
    await page.waitForTimeout(700);
    r.afterModal = await measureList(page);
    await page.screenshot({ path: shot(`${vp}-04b-list-after-modal`), animations: 'disabled' });
    // 기존 3장 색이 그대로인지
    const before = Object.fromEntries(r.list.cards.map((c) => [c.name, c.bgName]));
    r.colorsKept = r.afterModal.cards.filter((c) => c.name in before).every((c) => before[c.name] === c.bgName);
    // 05 대화
    await page.locator('li button').nth(1).click();
    const box = page.getByRole('textbox', { name: '메시지' });
    await box.waitFor();
    await box.fill('요즘 어떻게 지내?');
    await page.getByRole('button', { name: '보내기' }).click();
    await page.getByText('친구들이랑 반이 갈릴까 봐').waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
    r.chat = {
      header: (await page.locator('header').first().innerText().catch(() => '')).replace(/\s+/g, ' '),
      bubbles: await page.locator('p').evaluateAll((ps) => ps.filter((p) => /bubble(In|Out)/.test(p.className)).map((p) => p.textContent)),
      chatAvatarBg: await page.evaluate(() => getComputedStyle(document.querySelector('header span, main span[style*="background"]')).backgroundColor),
      overflowX: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1),
    };
    await page.screenshot({ path: shot(`${vp}-05-chat`), animations: 'disabled' });
    r.steps.push({ s: '05', ok: true });
    await page.getByRole('button', { name: '나가기' }).click();
    await page.locator('li button').first().waitFor();
    r.steps.push({ s: 'back-to-list', ok: true });
  } catch (e) {
    r.error = String(e).slice(0, 600);
    await page.screenshot({ path: shot(`${vp}-error`), animations: 'disabled' }).catch(() => {});
  }
  r.consoleErrors = errs;
  await ctx.close();
}

// B: localStorage 주입
const seed = {
  profile: { name: '홍길동', currentAge: 26 },
  personas: [
    { id: 'per_a', name: '15살의 홍길동', kind: 'past', age: 15, eventId: 'evt_01', phase: 'after', traits: ['수줍음'], speechStyle: '반말', memories: ['기억'], emotions: ['설렘'], greeting: '꿈이 많던 중학생 시절의 나' },
    { id: 'per_b', name: '첫 출근 날의 홍길동', kind: 'past', age: 25, eventId: 'evt_03', phase: 'after', traits: ['긴장'], speechStyle: '반말', memories: ['기억'], emotions: ['설렘'], greeting: '설렘과 긴장이 가득했던 하루' },
    { id: 'per_c', name: '졸업식 날의 홍길동', kind: 'past', age: 19, eventId: 'evt_02', phase: 'after', traits: ['아쉬움'], speechStyle: '반말', memories: ['기억'], emotions: ['설렘'], greeting: '새로운 시작을 앞둔 나' },
  ],
};
for (const vp of [390, 360, 1440]) {
  const ctx = await browser.newContext(VP[vp]);
  await ctx.route('**/api/**', (r) => r.abort());
  await ctx.addInitScript(([s, e]) => {
    localStorage.setItem('mindme:profile', JSON.stringify(s.profile));
    localStorage.setItem('mindme:events', JSON.stringify(e));
    localStorage.setItem('mindme:personas', JSON.stringify(s.personas));
  }, [seed, events]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(`${m.type()}: ${m.text().slice(0, 300)}`));
  page.on('pageerror', (e) => errs.push(`pageerror: ${String(e).slice(0, 300)}`));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('li button').first().waitFor({ timeout: 10_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  out.B[vp] = { list: await measureList(page), consoleErrors: errs };
  await page.screenshot({ path: shot(`${vp}-03-list-seeded`), animations: 'disabled' });
  await ctx.close();
}
await browser.close();
writeFileSync(`${EV}/recheck-behavior-r1-visual.json`, JSON.stringify(out, null, 2) + '\n');
const brief = (l) => l && { ready: l.ready, badges: l.newBadges.length, docOverflowX: l.docOverflowX, cards: l.cards.map((c) => `${c.name}|${c.bgName}|new=${c.isNew}|h=${c.rect.h}|x=${c.rect.x}..${c.rect.x + c.rect.w}|ovf=${c.textOverflow}|in=${c.insideMain}`) };
for (const vp of [390, 360, 1440]) {
  const a = out.A[vp];
  console.log(vp, 'A', JSON.stringify({ steps: a.steps, list: brief(a.list), bottom: a.bottom, afterModal: brief(a.afterModal), colorsKept: a.colorsKept, chat: a.chat, err: a.error, console: a.consoleErrors }, null, 1));
  console.log(vp, 'B', JSON.stringify({ list: brief(out.B[vp].list), console: out.B[vp].consoleErrors }));
}
