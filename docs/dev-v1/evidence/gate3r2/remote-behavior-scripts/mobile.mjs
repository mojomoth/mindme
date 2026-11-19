// Gate 3 r2 remote-behavior: 배포 390x844 모바일 (사진 없음)
// A 첫 방문 01→02(목업·폰트 요청), B 1) 결과 localStorage 주입 → 03·05, 04 모달 실제 AI 1회 → 03 '새로운' 표시
// C 보조: 첫 생성 경로(3개 동시 생성)를 가짜 /api 응답으로 돌려 모바일 03 의 '새로운'·아바타 배경 확인 (AI 0)
import { chromium } from '/Users/jeongyounglee/work/repo/mindme/node_modules/@playwright/test/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
const BASE = 'https://mindme-rho.vercel.app';
const REPO = '/Users/jeongyounglee/work/repo/mindme';
const EV = `${REPO}/docs/dev-v1/evidence/gate3r2`;
const shot = (n) => `${EV}/remote-behavior-390-${n}.png`;
const VP = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const BEFORE_FONT = 2_057_688;
const RGB = { 'rgb(220, 234, 248)': 'blue', 'rgb(254, 241, 197)': 'yellow', 'rgb(254, 223, 210)': 'peach' };
const state = JSON.parse(await readFile(`${EV}/remote-behavior-state.json`, 'utf8'));

const BREAKS = (els) =>
  els.map((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const chars = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode())
      for (let i = 0; i < n.data.length; i++) {
        const r = document.createRange();
        r.setStart(n, i); r.setEnd(n, i + 1);
        const rect = [...r.getClientRects()].find((x) => x.width > 0);
        chars.push({ c: n.data[i], top: rect ? Math.round(rect.top) : null });
      }
    const text = chars.map((x) => x.c).join('');
    const bottom = el.getBoundingClientRect().bottom;
    const breaks = [];
    let top = chars.find((x) => x.top !== null)?.top;
    chars.forEach((x, i) => {
      if (x.top === null || top === undefined || x.top <= top + 4) return;
      top = x.top;
      if (x.top >= bottom - 2) return; // line-clamp 로 가려진 줄
      const prev = text[i - 1];
      breaks.push({ at: `${text.slice(Math.max(0, i - 5), i)}/${text.slice(i, i + 5)}`, atSpace: prev === ' ' || x.c === ' ' || /[.,!?…~]/.test(prev) });
    });
    return { text, lines: breaks.length + 1, breaks, overflowX: el.scrollWidth > el.clientWidth + 1 };
  });
const measureList = (page) => page.evaluate((RGB) => {
  const cards = [...document.querySelectorAll('li button')].map((b) => {
    const av = b.querySelector(':scope > span');
    const bg = av ? getComputedStyle(av).backgroundColor : null;
    const r = b.getBoundingClientRect();
    return { name: b.querySelector('strong')?.textContent, isNew: !!b.querySelector('em'), bg: RGB[bg] ?? bg, h: Math.round(r.height), x: Math.round(r.x), w: Math.round(r.width) };
  });
  const ready = document.querySelector('p[role="status"]');
  return { ready: ready ? ready.textContent : null, newBadges: [...document.querySelectorAll('li em')].map((e) => e.textContent), newIndex: cards.map((c, i) => (c.isNew ? i : -1)).filter((i) => i >= 0), docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, cards };
}, RGB);
const neighborsDiffer = (cards) => cards.every((c, i) => i === 0 || c.bg !== cards[i - 1].bg);

const out = { at: new Date().toISOString(), base: BASE, viewport: '390x844 DPR3', beforeFontBytes: BEFORE_FONT };
const browser = await chromium.launch();
const watch = (page, bag) => {
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && bag.console.push(`${m.type()}: ${m.text().slice(0, 300)}`));
  page.on('pageerror', (e) => bag.console.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on('response', (r) => r.status() >= 400 && bag.bad.push({ url: r.url().replace(BASE, ''), status: r.status() }));
};

// A. 첫 방문 01 → 02
{
  const ctx = await browser.newContext(VP);
  const page = await ctx.newPage();
  const A = (out.A = { console: [], bad: [] });
  watch(page, A);
  const res = [];
  page.on('response', async (r) => {
    let bytes = null;
    try { bytes = (await r.body()).length; } catch {}
    res.push({ url: r.url().replace(BASE, ''), status: r.status(), bytes, encoded: r.headers()['content-length'] ?? null, type: r.request().resourceType() });
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: shot('01-landing'), animations: 'disabled' });
  await page.locator('#pc-story').waitFor({ timeout: 10_000 });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: shot('02-create'), animations: 'disabled' });
  const fonts = res.filter((r) => /\.woff2/.test(r.url));
  const pngs = res.filter((r) => /\.png/.test(r.url) || r.type === 'image');
  Object.assign(A, {
    mockupRequests: res.filter((r) => /mockup/i.test(r.url)).length,
    imageRequests: pngs.map((x) => ({ file: x.url.split('/').pop().slice(0, 60), bytes: x.bytes, status: x.status })),
    fontRequests: fonts.map((f) => ({ file: f.url.split('/').pop(), bytes: f.bytes, status: f.status })),
    fontCount: fonts.length,
    fontBytes: fonts.reduce((s, f) => s + (f.bytes ?? 0), 0),
    totalBytes: res.reduce((s, f) => s + (f.bytes ?? 0), 0),
    requests: res.length,
    imgCurrentSrc: await page.evaluate(() => document.querySelector('img[width="851"]')?.currentSrc?.slice(0, 40)),
    docScroll: await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, cw: document.documentElement.clientWidth, ch: document.documentElement.clientHeight })),
  });
  A.fontRatioVsBefore = +(A.fontBytes / BEFORE_FONT).toFixed(3);
  await ctx.close();
}

// B. 1) 결과 주입 → 03 · 05, 04 모달(실제 AI 1회) → 03
{
  const ctx = await browser.newContext(VP);
  await ctx.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    sessionStorage.setItem('seeded', '1');
  }, state);
  const page = await ctx.newPage();
  const B = (out.B = { console: [], bad: [], api: [] });
  watch(page, B);
  page.on('response', (r) => r.url().includes('/api/') && B.api.push({ url: r.url().replace(BASE, ''), status: r.status() }));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('li button').first().waitFor({ timeout: 10_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  B.list = await measureList(page);
  B.titles = await page.locator('li button strong').evaluateAll(BREAKS);
  B.previews = await page.locator('li button strong + span').evaluateAll(BREAKS);
  B.midWordBreaks = [...B.titles, ...B.previews].flatMap((x) => x.breaks.filter((b) => !b.atSpace).map((b) => `${x.text.slice(0, 20)} → ${b.at}`));
  B.neighborsDiffer = neighborsDiffer(B.list.cards);
  await page.screenshot({ path: shot('03-list-seeded'), animations: 'disabled' });

  // 05: 1)에서 나눈 17살 대화 복원
  await page.locator('li button', { hasText: '17살의 이지우' }).click();
  await page.getByRole('textbox', { name: '메시지' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  B.chat = await page.evaluate(() => {
    const bubbles = [...document.querySelectorAll('p')].filter((p) => /bubble(In|Out)/.test(p.className));
    const input = document.querySelector('[aria-label="메시지"]')?.getBoundingClientRect();
    const last = bubbles.at(-1)?.getBoundingClientRect();
    return { bubbles: bubbles.length, overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, bubbleOverflow: bubbles.filter((b) => b.getBoundingClientRect().right > innerWidth + 0.5).length, inputTop: input && Math.round(input.top), lastBottom: last && Math.round(last.bottom), header: document.querySelector('header')?.innerText.replace(/\s+/g, ' ').slice(0, 60) };
  });
  await page.screenshot({ path: shot('05-chat-seeded'), animations: 'disabled' });
  await page.getByRole('button', { name: '프로필 보기' }).click();
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(500);
  B.sheetTitle = (await page.getByRole('dialog').locator('h2').evaluateAll(BREAKS))[0];
  await page.screenshot({ path: shot('05b-sheet-seeded'), animations: 'disabled' });
  await page.getByRole('button', { name: '닫기' }).first().click();
  await page.getByRole('button', { name: '나가기' }).click();
  await page.locator('li button').first().waitFor();

  // 04 모달 → 15살 과거의 나 (실제 AI)
  await page.getByRole('button', { name: '페르소나 생성' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await page.locator('#pm-situation').fill('중학교 3학년 겨울방학에 처음 혼자 기차를 타고 할머니 댁에 간 날');
  await page.locator('#pm-age').fill('15');
  await page.waitForTimeout(300);
  await page.screenshot({ path: shot('04-modal'), animations: 'disabled' });
  const n = await page.locator('li button').count();
  await dialog.getByRole('button', { name: '생성하기' }).click();
  if (await page.getByRole('button', { name: '새로 만들기' }).isVisible().catch(() => false)) await page.getByRole('button', { name: '새로 만들기' }).click();
  await page.waitForFunction((k) => document.querySelectorAll('li button').length > k, n, { timeout: 120_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  B.afterModal = await measureList(page);
  B.afterModalTitles = await page.locator('li button strong').evaluateAll(BREAKS);
  B.afterModalMidWord = B.afterModalTitles.flatMap((x) => x.breaks.filter((b) => !b.atSpace).map((b) => `${x.text.slice(0, 20)} → ${b.at}`));
  B.afterModalNeighborsDiffer = neighborsDiffer(B.afterModal.cards);
  B.colorsKept = B.list.cards.every((c) => B.afterModal.cards.find((d) => d.name === c.name)?.bg === c.bg);
  await page.screenshot({ path: shot('03-list-after-modal'), animations: 'disabled' });
  const p15 = await page.evaluate(() => JSON.parse(localStorage.getItem('mindme:personas'))[0]);
  B.p15 = { name: p15.name, kind: p15.kind, age: p15.age, greeting: p15.greeting, memories: p15.memories, leakWords: JSON.stringify(p15).match(/출근|사수|회사|입사|직장|팀장|월급|회의|합격/g) ?? [] };
  await ctx.close();
}

// C. 보조: 첫 생성 경로를 가짜 /api 로 (배포 프론트, AI 0)
{
  const { personaName } = await import(`${REPO}/packages/core/src/persona/persona.ts`);
  const ctx = await browser.newContext(VP);
  const ev = (id, title, age, date) => ({ id, title, date, dateEstimated: false, age, emotions: ['설렘', '긴장'], context: '', people: ['민수'], summary: '요약' });
  const events = [ev('evt_01', '열한 번의 탈락 끝에 최종 합격한 날', 25, '2024-02'), ev('evt_02', '긴장 속에 첫 출근을 마친 날', 25, '2024-03'), ev('evt_03', '수학여행에서 처음 장기자랑 무대에 선 날', 17, '2016-05')];
  await ctx.route('**/api/**', async (r) => {
    const url = r.request().url();
    if (url.endsWith('/api/analyze')) return r.fulfill({ json: { events, owner: { name: '이지우', currentAge: 27 }, meta: { mode: 'direct', chunks: 1, units: 3, participants: [] } } });
    if (url.endsWith('/api/persona')) {
      const q = r.request().postDataJSON();
      const picked = q.events.find((e) => e.id === q.eventId);
      return r.fulfill({ json: { persona: { id: `per_${q.age}_${q.eventId ?? 'x'}`, name: personaName(q.kind, q.age, q.profile.name, picked?.title), kind: q.kind, age: q.age, ...(picked ? { eventId: picked.id, phase: 'after' } : {}), traits: ['수줍음'], speechStyle: '반말', memories: ['기억'], emotions: ['설렘'], greeting: '오늘 하루 정말 길었어. 너는 어때?' } } });
    }
    return r.abort();
  });
  const page = await ctx.newPage();
  const C = (out.C = { console: [], bad: [] });
  watch(page, C);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('#pc-story').waitFor({ timeout: 10_000 });
  await page.locator('#pc-story').fill('수학여행 장기자랑이 기억나요.');
  await page.getByPlaceholder('홍길동').fill('이지우');
  await page.getByPlaceholder('32').fill('27');
  await page.getByRole('button', { name: '페르소나 생성하기' }).click();
  await page.locator('li button').first().waitFor({ timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  C.list = await measureList(page);
  C.titles = await page.locator('li button strong').evaluateAll(BREAKS);
  C.midWordBreaks = C.titles.flatMap((x) => x.breaks.filter((b) => !b.atSpace).map((b) => `${x.text.slice(0, 20)} → ${b.at}`));
  C.neighborsDiffer = neighborsDiffer(C.list.cards);
  await page.screenshot({ path: shot('03-list-fresh-mocked'), animations: 'disabled' });
  await ctx.close();
}

await browser.close();
await writeFile(`${EV}/remote-behavior-390.json`, JSON.stringify(out, null, 2));
const A = out.A;
console.log('A', JSON.stringify({ mockup: A.mockupRequests, images: A.imageRequests, fontCount: A.fontCount, fontBytes: A.fontBytes, ratio: A.fontRatioVsBefore, fonts: A.fontRequests, total: A.totalBytes, img: A.imgCurrentSrc, scroll: A.docScroll, console: A.console, bad: A.bad }));
const B = out.B;
console.log('B', JSON.stringify({ list: B.list, mid: B.midWordBreaks, titles: B.titles.map((t) => `${t.text}|lines=${t.lines}|${t.breaks.map((b) => b.at).join(',')}`), neighbors: B.neighborsDiffer, chat: B.chat, sheetTitle: B.sheetTitle, afterModal: B.afterModal, afterMid: B.afterModalMidWord, afterNeighbors: B.afterModalNeighborsDiffer, colorsKept: B.colorsKept, p15: B.p15, api: B.api, console: B.console, bad: B.bad }, null, 1));
const C = out.C;
console.log('C', JSON.stringify({ list: C.list, mid: C.midWordBreaks, titles: C.titles.map((t) => `${t.text}|lines=${t.lines}|${t.breaks.map((b) => b.at).join(',')}`), neighbors: C.neighborsDiffer, console: C.console, bad: C.bad }, null, 1));
