// Gate 3 r2 critic-behavior r1: 모바일·데스크톱 뷰포트 실측 (AI 호출 없음: 시드 상태는 API 를 막는다)
import { chromium } from '/Users/jeongyounglee/work/repo/mindme/node_modules/@playwright/test/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';

const BASE = 'http://localhost:3100';
const REPO = '/Users/jeongyounglee/work/repo/mindme';
const EV = `${REPO}/docs/dev-v1/evidence/gate3r2`;
const shot = (n) => `${EV}/critic-behavior-r1-${n}.png`;
const VP = {
  390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  360: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  1440: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  1920: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
};
const BEFORE_FONT = 2_057_688;

const flowState = JSON.parse(await readFile(`${EV}/critic-behavior-r1-state.json`, 'utf8'));
const base = { kind: 'past', traits: ['낯가림'], speechStyle: '반말', memories: ['전학 첫날 사투리를 못 알아들었다'], emotions: ['외로움'] };
const seeded = {
  ...flowState,
  'mindme:personas': JSON.stringify([
    { ...base, id: 'per_long01', age: 13, name: '부산 학교로 전학 간 첫날의 서하린', greeting: '새 학교 첫날인데 다들 사투리를 써서 하나도 못 알아듣겠어. 오늘 기분 별로야. 그래도 짝꿍이 먼저 말 걸어 줬어.' },
    { ...base, id: 'per_long02', age: 14, name: '가나다라마바사아자차카타파하거너더러머버서어저의서하린', greeting: '띄어쓰기 없는 긴 이름도 칸 밖으로 넘치지 않아야 해요.' },
    ...JSON.parse(flowState['mindme:personas']),
  ]),
};

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
      if (x.top >= bottom - 2) return; // line-clamp 로 가려진 줄
      const prev = text[i - 1];
      breaks.push({ at: `${text.slice(Math.max(0, i - 5), i)}/${text.slice(i, i + 5)}`, atSpace: prev === ' ' || x.c === ' ' || /[.,!?…]/.test(prev) });
    });
    return { text: text.slice(0, 60), breaks, overflowX: el.scrollWidth > el.clientWidth + 1 };
  });

const out = { at: new Date().toISOString(), beforeFontBytes: BEFORE_FONT };
const browser = await chromium.launch();

/** 첫 방문 01 → 02: 목업·폰트 요청과 바이트 */
async function firstLoad(vp) {
  const ctx = await browser.newContext(VP[vp]);
  const page = await ctx.newPage();
  const res = [];
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  page.on('response', async (r) => {
    const url = r.url();
    let bytes = null;
    try { bytes = (await r.body()).length; } catch {}
    res.push({ url: url.replace(BASE, ''), status: r.status(), bytes, type: r.request().resourceType() });
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: shot(`${vp}-01-landing`), animations: 'disabled' });
  await page.locator('#pc-story').waitFor({ timeout: 10_000 });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: shot(`${vp}-02-create`), animations: 'disabled' });
  const fonts = res.filter((r) => /\.woff2/.test(r.url));
  const mock = res.filter((r) => /mockup/.test(r.url));
  const r = {
    mockupRequests: mock.length,
    mockup: mock,
    fontRequests: fonts.map((f) => ({ file: f.url.split('/').pop(), bytes: f.bytes, status: f.status })),
    fontBytes: fonts.reduce((s, f) => s + (f.bytes ?? 0), 0),
    totalBytes: res.reduce((s, f) => s + (f.bytes ?? 0), 0),
    oldFullFontRequested: fonts.some((f) => /pretendard\.[^/]*woff2$/.test(f.url) && !/subset|hangul|latin|symbols/.test(f.url)),
    errors,
    bad: res.filter((x) => x.status >= 400),
  };
  r.fontRatioVsBefore = +(r.fontBytes / BEFORE_FONT).toFixed(3);

  // 이미지·화면 정렬 (데스크톱은 목업 보임 + 화면이 목업 투명 영역 안)
  r.frame = await page.evaluate(() => {
    const img = document.querySelector('img[width="851"]');
    const screen = img?.closest('[class*="scaler"]')?.querySelector('[class*="screen"]');
    const R = (el) => el && (({ left, top, width, height }) => ({ left: +left.toFixed(1), top: +top.toFixed(1), width: +width.toFixed(1), height: +height.toFixed(1) }))(el.getBoundingClientRect());
    const ir = R(img);
    const sr = R(screen);
    return {
      img: ir,
      screen: sr,
      currentSrc: img?.currentSrc.slice(0, 60),
      naturalWidth: img?.naturalWidth,
      visible: img ? getComputedStyle(img).display !== 'none' && ir.width > 0 : false,
      ratios: ir && sr && ir.width ? { left: +((sr.left - ir.left) / ir.width).toFixed(4), top: +((sr.top - ir.top) / ir.height).toFixed(4), width: +(sr.width / ir.width).toFixed(4), height: +(sr.height / ir.height).toFixed(4) } : null,
      centered: ir ? Math.abs(ir.left + ir.width / 2 - innerWidth / 2) < 2 : null,
      inViewport: ir ? ir.top >= 0 && ir.left >= 0 && ir.top + ir.height <= innerHeight + 1 && ir.left + ir.width <= innerWidth + 1 : null,
    };
  });

  // 희귀 음절: 똠·햏 (KS X 1001 밖) 이 Pretendard 조각으로 그려지는지
  const before = res.length;
  await page.evaluate(() => {
    const d = document.createElement('p');
    d.id = 'critic-rare';
    d.textContent = '똠얌꿍 먹고 햏자 놀이 똠햏';
    d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;font-family:var(--mm-font);font-size:28px;font-weight:700;background:#fff;color:#000;margin:0';
    document.body.append(d);
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  r.rare = await page.evaluate(() => {
    const cps = { '똠': 0xb620, '햏': 0xd74f };
    const faces = [...document.fonts].filter((f) => /Pretendard/.test(f.family));
    const covers = (range, cp) =>
      range.split(',').some((part) => {
        const m = part.trim().replace(/^U\+/i, '').split('-');
        const lo = parseInt(m[0], 16);
        const hi = m[1] ? parseInt(m[1], 16) : lo;
        return cp >= lo && cp <= hi;
      });
    const by = Object.fromEntries(
      Object.entries(cps).map(([c, cp]) => {
        const f = faces.filter((x) => covers(x.unicodeRange, cp));
        return [c, f.map((x) => ({ status: x.status, range: x.unicodeRange.slice(0, 40) }))];
      }),
    );
    return {
      family: getComputedStyle(document.getElementById('critic-rare')).fontFamily,
      faces: faces.length,
      loadedFaces: faces.filter((f) => f.status === 'loaded').length,
      check: document.fonts.check('700 28px Pretendard', '똠햏'),
      coveringFaces: by,
    };
  });
  r.rare.newFontRequests = res.slice(before).filter((x) => /\.woff2/.test(x.url)).map((f) => ({ file: f.url.split('/').pop(), bytes: f.bytes }));
  await page.locator('#critic-rare').screenshot({ path: shot(`${vp}-rare-glyphs`) });
  await ctx.close();
  return r;
}

/** 03 목록 줄바꿈, 프로필 시트 접근성 트리 (시드 상태, API 차단) */
async function seededList(vp, suffix = '') {
  const ctx = await browser.newContext(VP[vp]);
  await ctx.route('**/api/**', (r) => r.abort());
  await ctx.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    sessionStorage.setItem('seeded', '1');
  }, seeded);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('main').first().click();
  await page.locator('li button').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const titles = await page.locator('li button strong').evaluateAll(BREAKS);
  const previews = await page.locator('li button strong + span').evaluateAll(BREAKS);
  await page.screenshot({ path: shot(`${vp}${suffix}-03-list`), animations: 'disabled' });
  const r = { titles, previews, errors };
  const spaced = [...titles, ...previews].filter((x) => !/^가나다라마바사/.test(x.text));
  r.midWordBreaks = spaced.flatMap((x) => x.breaks.filter((b) => !b.atSpace).map((b) => `${x.text.slice(0, 20)} → ${b.at}`));
  r.overflowX = [...titles, ...previews].filter((x) => x.overflowX).map((x) => x.text);

  // 긴 이름 프로필 시트 제목 + 대화(흐름에서 만든 '17살의 이지우') 시트 접근성
  await page.locator('li button', { hasText: '부산 학교로 전학 간' }).click();
  await page.getByRole('button', { name: '프로필 보기' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.waitFor();
  r.sheetLongTitle = (await dialog.locator('h2').evaluateAll(BREAKS))[0];
  await page.getByRole('button', { name: '닫기' }).click();
  await page.getByRole('button', { name: '나가기' }).click();
  await page.locator('li button', { hasText: '17살의 이지우' }).click();
  await page.getByRole('textbox', { name: '메시지' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: shot(`${vp}${suffix}-05-chat`), animations: 'disabled' });
  await page.getByRole('button', { name: '프로필 보기' }).click();
  dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await page.waitForTimeout(400);
  r.sheet = {
    labelExact이름: await page.getByLabel('이름', { exact: true }).count(),
    region이름: await page.getByRole('region', { name: '이름' }).count(),
    regions: await page.getByRole('region').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))),
    aria: await dialog.ariaSnapshot(),
  };
  await page.screenshot({ path: shot(`${vp}${suffix}-05b-sheet`), animations: 'disabled' });
  await ctx.close();
  return r;
}

try {
  for (const vp of ['390', '360', '1440', '1920']) {
    out[vp] = { firstLoad: await firstLoad(vp) };
    if (vp !== '1920') out[vp].seeded = await seededList(vp);
  }
  // 외형 비교용: 390 논리 폭 DPR 2 (드래프트 852x1846 과 비슷한 해상도)
  VP['390x2'] = { ...VP[390], deviceScaleFactor: 2 };
  await seededList('390x2', '-visual');
} finally {
  await writeFile(`${EV}/critic-behavior-r1-viewports.json`, JSON.stringify(out, null, 2));
  await browser.close();
}
for (const vp of ['390', '360', '1440', '1920']) {
  const f = out[vp]?.firstLoad;
  if (!f) continue;
  console.log(vp, JSON.stringify({ mockup: f.mockupRequests, fontBytes: f.fontBytes, ratio: f.fontRatioVsBefore, fonts: f.fontRequests.map((x) => `${x.file}:${x.bytes}`), old: f.oldFullFontRequested, total: f.totalBytes, errors: f.errors.length, bad: f.bad, frame: f.frame, rare: f.rare }));
  const s = out[vp].seeded;
  if (s) console.log(vp, 'seeded', JSON.stringify({ mid: s.midWordBreaks, overflow: s.overflowX, sheetTitle: s.sheetLongTitle, label: s.sheet.labelExact이름, region: s.sheet.region이름, regions: s.sheet.regions, errors: s.errors }));
}
