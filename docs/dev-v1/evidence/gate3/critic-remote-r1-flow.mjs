#!/usr/bin/env node
// Gate 3 배포 URL Critic r1 (독립 작성, 실제 배포·실제 AI). 코드·설정은 건드리지 않는다.
// 사용법: node docs/dev-v1/evidence/gate3/critic-remote-r1-flow.mjs <desktop|mobile> [photo-path]
//  - 사진 없음: 랜딩 → 만들기(합성 카톡 TXT + 이야기) → 목록 → 모달 미래 → 모달 과거 → 대화 스트리밍
//    → 글자가 오는 중 나가기 → 재진입 '다시 받기' → 새로고침 유지
//  - 사진 있음: 만들기(사진 포함) → 목록까지. avatar 요청 본문 크기·응답 시간·Server-Timing 기록
// 모든 응답 본문(JS 포함)을 .env 키 값·접두사로 검사한다(값은 출력하지 않는다).
import { chromium, devices } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'https://mindme-rho.vercel.app';
const OUT = 'docs/dev-v1/evidence/gate3';
const MODE = process.argv[2] ?? 'desktop';
const PHOTO = process.argv[3];
const P = `critic-remote-r1-${MODE}${PHOTO ? '-photo' : ''}`;

const keyVals = readFileSync('.env', 'utf8')
  .split('\n')
  .map((l) => l.match(/^\s*([A-Z0-9_]*KEY[A-Z0-9_]*)\s*=\s*["']?([^"'\s]+)/))
  .filter((m) => m && m[2].length >= 8)
  .map((m) => ({ name: m[1], value: m[2], prefix: m[2].slice(0, 8) }));

const log = { mode: MODE, photo: Boolean(PHOTO), steps: [], checks: {}, console: [], badResponses: [], api: [], resources: { js: 0, css: 0, img: 0, font: 0 }, keyScan: { bodies: 0, bytes: 0, hits: [] }, errors: [] };
const t0 = Date.now();
const check = (k, v) => {
  log.checks[k] = v;
  console.log(`CHECK ${k} = ${JSON.stringify(v)}`);
};

const browser = await chromium.launch();
const ctxOpts =
  MODE === 'mobile'
    ? { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const ctx = await browser.newContext(ctxOpts);
const page = await ctx.newPage();
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && log.console.push(`${m.type()}: ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => log.console.push(`pageerror: ${e.message}`));
const reqStart = new Map();
page.on('request', (r) => {
  reqStart.set(r, Date.now());
  if (r.url().includes('/api/')) log.api.push({ t: +((Date.now() - t0) / 1000).toFixed(1), m: r.method(), u: new URL(r.url()).pathname, reqBytes: r.postDataBuffer()?.length ?? 0 });
});
page.on('requestfailed', (r) => log.api.push({ t: +((Date.now() - t0) / 1000).toFixed(1), failed: new URL(r.url()).pathname, why: r.failure()?.errorText }));
const bodyChecks = [];
page.on('response', (res) => {
  const url = res.url();
  const ct = res.headers()['content-type'] ?? '';
  if (res.status() >= 400) log.badResponses.push(`${res.status()} ${url}`);
  if (/javascript/.test(ct)) log.resources.js++;
  else if (/css/.test(ct)) log.resources.css++;
  else if (/image/.test(ct)) log.resources.img++;
  else if (/font/.test(ct)) log.resources.font++;
  if (url.includes('/api/')) {
    const start = reqStart.get(res.request());
    const done = res.finished().then(() => {
      log.api.push({ t: +((Date.now() - t0) / 1000).toFixed(1), done: new URL(url).pathname, status: res.status(), ms: start ? Date.now() - start : null, serverTiming: res.headers()['server-timing'] ?? null });
    });
    bodyChecks.push(done.catch(() => {}));
  }
  if (/image|font/.test(ct)) return;
  bodyChecks.push(
    res
      .body()
      .then((b) => {
        log.keyScan.bodies++;
        log.keyScan.bytes += b.length;
        const s = b.toString('latin1');
        for (const k of keyVals) {
          if (s.includes(k.value)) log.keyScan.hits.push(`VALUE ${k.name} in ${url}`);
          if (s.includes(k.prefix)) log.keyScan.hits.push(`PREFIX ${k.name} in ${url}`);
        }
        if (/sk-(proj-|ant-|svcacct-)?[A-Za-z0-9_-]{16,}/.test(s)) log.keyScan.hits.push(`sk- pattern in ${url}`);
        if (/OPENAI_API_KEY|CLAUDE_API_KEY|VERCEL_API_KEY|api\.openai\.com/.test(s)) log.keyScan.hits.push(`name/host pattern in ${url}`);
      })
      .catch(() => {}),
  );
});
const apiDone = (path) => log.api.filter((a) => a.done === path);

const shot = async (name) => {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${P}-${name}.png` });
};
const pick = async (button, file) => {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button.click()]);
  check(`chooser:${file.split('/').pop()}`, { accept: await chooser.element().getAttribute('accept'), multiple: chooser.isMultiple() });
  await chooser.setFiles(file);
};
const ls = (k) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), k);
const listNames = () => page.locator('ul li strong').allTextContents();
const LIST = () => page.getByRole('heading', { name: '나의 페르소나' });
const WORKING = () => page.getByRole('heading', { name: '페르소나를 만들고 있어요' });
const FAILED = () => page.getByRole('heading', { name: '페르소나를 만들지 못했어요' });
const bubblesIn = () => page.locator('main section p[class*="bubbleIn"]:not([aria-label])');

async function setSlider(target) {
  const s = page.getByLabel('그때의 나이');
  await s.focus();
  await page.keyboard.press('Home');
  for (let i = 5; i < target; i++) await page.keyboard.press('ArrowRight');
  return Number(await s.inputValue());
}
async function openModal(situation, age) {
  await page.getByRole('button', { name: '페르소나 생성' }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByLabel('상황 설명').fill(situation);
  const got = await setSlider(age);
  return { slider: got, pill: await page.locator('[role=dialog] output').textContent() };
}
async function waitList(label) {
  const t = Date.now();
  await Promise.race([LIST().waitFor({ timeout: 300_000 }), FAILED().waitFor({ timeout: 300_000 })]);
  const failed = await FAILED().isVisible().catch(() => false);
  const res = { ms: Date.now() - t, failed, alert: failed ? await page.locator('main [role=alert]').textContent().catch(() => null) : null };
  check(`${label}:wait`, res);
  return res;
}
async function send(text, { stopAfterChars } = {}) {
  await page.getByLabel('메시지').fill(text);
  const start = await bubblesIn().count();
  const tSend = Date.now();
  await page.keyboard.press('Enter');
  const lens = [];
  let firstChunkMs = null;
  let changed = Date.now();
  const end = Date.now() + 90_000;
  while (Date.now() < end) {
    if ((await page.locator('main [role=alert]').count()) > 0) break;
    const typing = (await page.getByLabel('입력 중').count()) > 0;
    if ((await bubblesIn().count()) > start) {
      const len = ((await bubblesIn().last().textContent()) ?? '').length;
      if (firstChunkMs === null && len > 0) firstChunkMs = Date.now() - tSend;
      if (stopAfterChars && len >= stopAfterChars) return { partial: true, len, firstChunkMs };
      if (lens.at(-1) !== len) (lens.push(len), (changed = Date.now()));
      else if (!typing && Date.now() - changed > 2500) break;
    }
    await page.waitForTimeout(50);
  }
  return { firstChunkMs, distinctLengths: lens.length, finalLen: lens.at(-1), reply: ((await bubblesIn().last().textContent()) ?? '').trim().slice(0, 160), alert: await page.locator('main [role=alert]').textContent().catch(() => null) };
}

try {
  // 01 랜딩 (콜드 로드 시간)
  const tg = Date.now();
  const nav = await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  check('landingHttp', { status: nav.status(), ms: Date.now() - tg, permissionsPolicy: nav.headers()['permissions-policy'] ?? null });
  await page.getByRole('heading', { name: '다시 만나는, 그때의 나' }).waitFor();
  check('fonts', await page.evaluate(async () => {
    await document.fonts.ready;
    return { status: document.fonts.status, loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family), bodyFont: getComputedStyle(document.body).fontFamily.slice(0, 120) };
  }));
  await shot('01-landing');
  await page.getByRole('heading', { name: '페르소나 만들기' }).waitFor({ timeout: 8000 });
  check('landingAutoMs', Date.now() - tg);
  check('secureContext', await page.evaluate(() => ({ isSecureContext, protocol: location.protocol })));
  await shot('02-create-empty');

  // 02 만들기
  await pick(page.getByRole('button', { name: /TXT 파일 업로드/ }), `${OUT}/critic-remote-r1-kakao.txt`);
  await page.getByLabel('나의 이야기').fill('사람들 앞에 서면 얼굴부터 빨개지지만 하고 싶은 건 끝내 해 보는 편이야. 지금은 동네에서 작은 빵집을 하고, 언젠가 빵 만드는 법을 가르치는 학교를 열고 싶어.');
  await page.getByRole('textbox', { name: '이름' }).fill('한도윤');
  await page.getByLabel(/지금 나이/).fill('27');
  if (PHOTO) {
    await pick(page.getByRole('button', { name: '사진 업로드' }), PHOTO);
    await page.waitForTimeout(1500);
  }
  check('fileNameShown', await page.getByText('critic-remote-r1-kakao.txt').isVisible());
  await shot('02-create-filled');

  await page.getByRole('button', { name: '페르소나 생성하기' }).click();
  await WORKING().waitFor();
  await shot('02b-working');
  const first = await waitList('firstCreate');
  if (first.failed) throw new Error(`first create failed: ${first.alert}`);
  await page.waitForTimeout(600);
  const made = await ls('mindme:personas');
  check('firstCreate', { count: made.length, items: made.map((p) => ({ name: p.name, kind: p.kind, age: p.age, avatar: p.avatar ? p.avatar.slice(0, 22) : null, avatarLen: p.avatar?.length ?? 0 })) });
  check('events', ((await ls('mindme:events')) ?? []).map((e) => `${e.date} age=${e.age ?? '-'} ${e.title}`));
  check('apiTimings', { analyze: apiDone('/api/analyze'), persona: apiDone('/api/persona'), avatar: apiDone('/api/persona/avatar') });
  if (PHOTO) check('avatarRequests', log.api.filter((a) => a.u === '/api/persona/avatar'));
  await shot('03-list');
  if (PHOTO) throw 'done-photo';

  // 04 모달 미래
  check('modalFuture', await openModal('서른다섯쯤 빵 학교를 열어 첫 수강생들 앞에 선 나', 40));
  await shot('04-modal-future');
  await page.getByRole('button', { name: '생성하기' }).click();
  await waitList('future');
  check('futureMade', (await ls('mindme:personas'))[0]?.name);

  // 04 모달 과거
  check('modalPast', await openModal('반장 선거 연설에서 머리가 하얘져 두 표 차이로 떨어진 날의 나', 13));
  await shot('04-modal-past');
  await page.getByRole('button', { name: '생성하기' }).click();
  await page.waitForTimeout(800);
  if (await page.getByRole('button', { name: '대화 이어가기' }).isVisible().catch(() => false)) {
    check('pastDuplicateAsked', true);
    await page.getByRole('button', { name: '대화 이어가기' }).click();
  } else {
    await waitList('past');
    const p0 = (await ls('mindme:personas'))[0];
    check('pastMade', { name: p0?.name, kind: p0?.kind, age: p0?.age });
    await shot('04c-list-after-modal');
    await page.locator('ul li button').first().click();
  }

  // 05 대화 스트리밍
  await page.getByRole('button', { name: '프로필 보기' }).waitFor({ timeout: 10_000 });
  const chatTitle = await page.locator('main header h1').textContent();
  check('chatHeader', { title: chatTitle, status: await page.locator('main header p').textContent() });
  check('chat1', await send('그날 연설 끝나고 집에 가는 길에 무슨 생각 했어?'));
  await shot('05-chat');

  // 글자가 오는 중 나가기 → 재진입
  const r2 = await send('그때 무대 위에서 무엇이 제일 무서웠는지 아주 길게 자세히 이야기해 줘.', { stopAfterChars: 6 });
  check('midStream', r2);
  await page.getByRole('button', { name: '나가기' }).click();
  await LIST().waitFor();
  await page.waitForTimeout(2500);
  check('midStreamAbort', log.api.filter((a) => a.failed === '/api/chat'));
  const idx = (await listNames()).indexOf(chatTitle);
  await page.locator('ul li button').nth(Math.max(idx, 0)).click();
  await page.getByRole('button', { name: '프로필 보기' }).waitFor();
  await page.waitForTimeout(500);
  check('reenter', {
    lastIsMine: (await page.locator('main section p[class*="bubble"]').last().getAttribute('class'))?.includes('bubbleOut'),
    alert: await page.locator('main [role=alert]').textContent().catch(() => null),
    retryButton: await page.getByRole('button', { name: '다시 받기' }).count(),
  });
  await shot('05b-reenter');
  if (await page.getByRole('button', { name: '다시 받기' }).count()) {
    const before = await bubblesIn().count();
    await page.getByRole('button', { name: '다시 받기' }).click();
    const tEnd = Date.now() + 60_000;
    let len = 0;
    let still = Date.now();
    while (Date.now() < tEnd) {
      if ((await bubblesIn().count()) > before) {
        const l = ((await bubblesIn().last().textContent()) ?? '').length;
        if (l !== len) (len = l), (still = Date.now());
        else if (Date.now() - still > 2500 && (await page.getByLabel('입력 중').count()) === 0) break;
      }
      await page.waitForTimeout(80);
    }
    check('retryAnswered', { len, alert: await page.locator('main [role=alert]').count() });
    await shot('05c-retry');
  }
  check('composerOverlap', await page.evaluate(() => {
    const last = [...document.querySelectorAll('main section p[class*="bubble"]')].at(-1)?.getBoundingClientRect();
    const box = document.querySelector('textarea[aria-label="메시지"]')?.closest('form,div')?.getBoundingClientRect();
    return last && box ? { lastBottom: Math.round(last.bottom), composerTop: Math.round(box.top), hidden: last.bottom > box.top + 1 } : null;
  }));
  const bubblesBefore = await page.locator('main section p[class*="bubble"]').count();
  await page.getByRole('button', { name: '나가기' }).click();
  await LIST().waitFor();

  // 새로고침 유지
  const namesBefore = await listNames();
  await page.reload();
  await page.getByRole('heading', { name: '다시 만나는, 그때의 나' }).waitFor();
  const trl = Date.now();
  await LIST().waitFor({ timeout: 8000 });
  const names = await listNames();
  check('afterReload', { landingToListMs: Date.now() - trl, same: JSON.stringify(names) === JSON.stringify(namesBefore), names });
  await shot('07-list-reloaded');
  await page.locator('ul li button').nth(Math.max(names.indexOf(chatTitle), 0)).click();
  await page.getByRole('button', { name: '프로필 보기' }).waitFor();
  await page.waitForTimeout(400);
  check('chatRestored', { bubbles: await page.locator('main section p[class*="bubble"]').count(), before: bubblesBefore });
  await shot('07b-chat-restored');
  await page.getByRole('button', { name: '나가기' }).click();
  await LIST().waitFor();
  // 모바일: 문서 가로 스크롤 없음
  check('docScroll', await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight })));
} catch (err) {
  if (err !== 'done-photo') {
    log.errors.push(String(err?.stack ?? err).slice(0, 1500));
    console.error(err);
    await page.screenshot({ path: `${OUT}/${P}-zz-failure.png` }).catch(() => {});
  }
} finally {
  await page.waitForTimeout(500);
  // 중단된 스트림 응답은 body() 가 끝나지 않을 수 있어 최대 15초만 기다린다(run 1 에서 멈춤).
  await Promise.race([Promise.allSettled(bodyChecks), new Promise((r) => setTimeout(r, 15_000))]);
  log.totalSec = (Date.now() - t0) / 1000;
  writeFileSync(`${OUT}/${P}-flow.json`, JSON.stringify(log, null, 2));
  console.log(`keyScan bodies=${log.keyScan.bodies} hits=${log.keyScan.hits.length} console=${log.console.length} bad=${log.badResponses.length}`);
  await browser.close();
}
