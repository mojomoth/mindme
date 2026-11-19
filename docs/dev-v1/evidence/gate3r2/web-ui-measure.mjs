#!/usr/bin/env node
// Gate 3 r2 web-ui 실측: node docs/dev-v1/evidence/gate3r2/web-ui-measure.mjs <before|after>
// AI 호출 없음: 03·05·시트는 localStorage 를 심어 띄우고, 02 나이 안내는 /api/analyze 를 가짜 응답으로 바꾼다.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('usage: web-ui-measure.mjs <before|after>');
const BASE = process.env.BASE ?? 'http://localhost:3100';
const dir = path.dirname(new URL(import.meta.url).pathname);
const shot = (name, vp) => path.join(dir, `web-ui-${phase}-${name}-${vp}.png`);

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  360: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

// Gate 3 r1 로컬 실측 상태(실제 생성된 페르소나 4개)에 긴 이름 2개를 더한다. 사진은 쓰지 않아 뺀다.
const state = JSON.parse(await readFile(path.join(dir, '../gate3/critic-local-r1-state.json'), 'utf8'));
delete state['mindme:photo'];
const base = { kind: 'past', traits: ['낯가림'], speechStyle: '반말', memories: [], emotions: [] };
state['mindme:personas'] = JSON.stringify([
  { ...base, id: 'per_extra01', age: 13, name: '부산 학교로 전학 간 첫날의 서하린', greeting: '새 학교 첫날인데 다들 사투리를 써서 하나도 못 알아듣겠어. 오늘 기분 별로야. 그래도 짝꿍이 먼저 말 걸어 줬어.' },
  { ...base, id: 'per_extra02', age: 14, name: '가나다라마바사아자차카타파하거너더러머버서어저의서하린', greeting: '띄어쓰기 없는 긴 이름도 칸 밖으로 넘치지 않아야 해요.' },
  ...JSON.parse(state['mindme:personas']),
]);

/** 요소 안 글자의 줄바꿈 위치('앞/뒤')와, 공백에서 끊겼는지. */
const BREAKS = (els) =>
  els.map((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const chars = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode())
      for (let i = 0; i < n.data.length; i++) {
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + 1);
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
      breaks.push({
        at: `${text.slice(Math.max(0, i - 4), i)}/${text.slice(i, i + 4)}`,
        atSpace: text[i - 1] === ' ' || text[i] === ' ',
        visible: x.top < bottom,
      });
    });
    return { text, breaks, overflowX: el.scrollWidth > el.clientWidth + 1 };
  });

async function seeded(browser, vp, out) {
  const ctx = await browser.newContext(VIEWPORTS[vp]);
  await ctx.route('**/api/**', (r) => r.abort()); // 비용 방지: 이 흐름에서는 API 를 부르지 않는다
  await ctx.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    sessionStorage.setItem('seeded', '1');
  }, state);
  const page = await ctx.newPage();
  const mockups = [];
  page.on('response', (res) => /mockup-iphone/.test(res.url()) && mockups.push({ url: res.url(), status: res.status() }));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  out.mockupResponses = mockups.length;
  out.mockupImg = await page.evaluate(() => {
    const img = document.querySelector('img[width="851"]');
    return img ? { currentSrc: img.currentSrc.slice(0, 80), complete: img.complete, naturalWidth: img.naturalWidth, inPicture: img.parentElement?.tagName === 'PICTURE' } : null;
  });
  await page.locator('main').first().click(); // 01 랜딩 건너뛰기
  await page.locator('li button').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  out.list = {
    titles: await page.locator('li button strong').evaluateAll(BREAKS),
    previews: await page.locator('li button strong + span').evaluateAll(BREAKS),
  };
  await page.screenshot({ path: shot('list', vp), animations: 'disabled' });

  await page.locator('li button', { hasText: '수능을 끝내고' }).click();
  await page.getByRole('button', { name: '프로필 보기' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  out.sheet = {
    title: (await dialog.locator('h2').evaluateAll(BREAKS))[0],
    labelExact이름: await page.getByLabel('이름', { exact: true }).count(),
    region이름: await page.getByRole('region', { name: '이름' }).count(),
    regions: await page.getByRole('region').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))),
    aria: await dialog.ariaSnapshot(),
  };
  await page.screenshot({ path: shot('sheet', vp), animations: 'disabled' });
  await ctx.close();
}

async function ageNotice(browser, vp, out) {
  const ctx = await browser.newContext(VIEWPORTS[vp]);
  let analyzeCalls = 0;
  await ctx.route('**/api/**', (r) => {
    if (!r.request().url().endsWith('/api/analyze')) return r.abort();
    analyzeCalls++;
    // 1번째: 나이를 못 찾음. 2번째: 서버 오류(실패 화면 → '입력 화면으로')
    return analyzeCalls === 1
      ? r.fulfill({ json: { events: [], owner: { name: null, currentAge: null } } })
      : r.fulfill({ status: 500, json: { error: '잠시 후 다시 시도해 주세요.' } });
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('main').first().click();
  await page.locator('#pc-story').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: shot('create', vp), animations: 'disabled' });
  await page.locator('#pc-story').fill('중학교 때 친구와 크게 다툰 일이 아직도 기억나요.');
  await page.getByRole('button', { name: '페르소나 생성하기' }).click();
  const alert = page.getByRole('alert').filter({ hasText: '나이를 찾지 못했어요' });
  await alert.waitFor();
  out.notice = { shown: await alert.count() };
  await page.screenshot({ path: shot('notice', vp), animations: 'disabled' });

  // (1) 나이를 적으면 안내가 사라져야 한다
  await page.getByPlaceholder('32').fill('26');
  out.notice.afterAgeInput = await alert.count();
  await page.screenshot({ path: shot('notice-age', vp), animations: 'disabled' });

  // (2) 나이를 지우고 같은 입력으로 다시 만들어 안내를 다시 띄운 뒤(분석은 건너뜀),
  //     이야기만 바꿔 다시 만들기 → 실패 → 입력 화면으로: 지난 안내가 남지 않아야 한다
  await page.getByPlaceholder('32').fill('');
  await page.getByRole('button', { name: '페르소나 생성하기' }).click();
  await alert.waitFor();
  await page.locator('#pc-story').fill('고등학교 때 수능을 끝낸 날이 기억나요.');
  await page.getByRole('button', { name: '페르소나 생성하기' }).click();
  await page.getByRole('button', { name: '입력 화면으로' }).click();
  await page.locator('#pc-story').waitFor();
  out.notice.afterRetryFail = await alert.count();
  out.notice.analyzeCalls = analyzeCalls;
  await ctx.close();
}

const browser = await chromium.launch();
const result = { phase, base: BASE };
try {
  for (const vp of Object.keys(VIEWPORTS)) {
    result[vp] = {};
    await seeded(browser, vp, result[vp]);
    await ageNotice(browser, vp, result[vp]);
  }
} finally {
  await browser.close();
}
await writeFile(path.join(dir, `web-ui-${phase}.json`), `${JSON.stringify(result, null, 2)}\n`);
for (const vp of Object.keys(VIEWPORTS)) {
  const r = result[vp];
  const bad = [...r.list.titles, ...r.list.previews, r.sheet.title].flatMap((x) => x.breaks.filter((b) => b.visible && !b.atSpace).map((b) => b.at));
  console.log(vp, { mockup: r.mockupResponses, midWordBreaks: bad, overflowX: [...r.list.titles, r.sheet.title].filter((x) => x.overflowX).length, label이름: r.sheet.labelExact이름, region이름: r.sheet.region이름, notice: r.notice });
}
