#!/usr/bin/env node
// Gate 2 Critic visual r2: 실제 앱 상태(실제 AI 생성)로 01~05 + 진행·프로필 시트를 데스크톱(목업)·모바일로 캡처.
// 긴 이름(20자, 입력 한도)·긴 메시지(끊김 없는 ㅋ 연속 포함)로 레이아웃 스트레스.
// 사용법: node docs/dev-v1/evidence/gate2/critic-visual-r2-capture.mjs
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

const BASE = 'http://localhost:3100';
const OUT = 'docs/dev-v1/evidence/gate2';
const LONG_NAME = '남궁하늘빛초롱별아름이와다솜이의새벽노을'.slice(0, 20);
const LONG_MSG =
  '오늘 회사에서 정말 길고 이상한 하루를 보냈어. 아침부터 회의가 세 번이나 있었고, 점심도 제대로 못 먹었는데 저녁에 팀장님이 갑자기 다음 주 발표를 내가 맡으라고 하셨어. ' +
  'ㅋ'.repeat(70) +
  ' 근데 이상하게 예전처럼 무섭지는 않더라. 너라면 이런 날 어떻게 버텼을 것 같아? https://example.com/very/long/path/that/does/not/break/naturally/anywhere/at/all';
const log = { longName: LONG_NAME, runs: {}, console: [] };

const browser = await chromium.launch();

async function audit(page, label) {
  // 목업(화면) 밖으로 나간 요소, 가로 스크롤, 잘린 텍스트(ellipsis 포함) 수집
  const r = await page.evaluate(() => {
    const main = document.querySelector('main');
    const content = main?.parentElement;
    const screen = content?.parentElement;
    const sr = screen.getBoundingClientRect();
    const out = [];
    const clipped = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('[aria-hidden="true"]') || el.tagName === 'IMG' && el.alt === '' && el.width > 800) continue;
      const rr = el.getBoundingClientRect();
      if (!rr.width || !rr.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (screen.contains(el) && (rr.left < sr.left - 1 || rr.right > sr.right + 1)) out.push(`${el.tagName}.${el.className}`.slice(0, 80) + ` [${Math.round(rr.left)}..${Math.round(rr.right)}] vs [${Math.round(sr.left)}..${Math.round(sr.right)}]`);
      if (el.children.length === 0 && el.textContent.trim() && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && cs.overflow !== 'visible')
        clipped.push({ tag: el.tagName, text: el.textContent.trim().slice(0, 60), sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight, ellipsis: cs.textOverflow, clamp: cs.webkitLineClamp });
    }
    return { docScrollW: document.documentElement.scrollWidth, innerW: innerWidth, screen: [Math.round(sr.left), Math.round(sr.top), Math.round(sr.width), Math.round(sr.height)], outOfScreen: out.slice(0, 20), clipped: clipped.slice(0, 20) };
  });
  return { label, ...r };
}


// r2 추가: 목업 스크롤 상태(상태바 덮개) 점검. 스크롤 영역(.content)과 상태바 배경·겹치는 요소 수를 기록하고 캡처.
async function scrollShots(page, R, shot, name) {
  const info = async () => page.evaluate(() => {
    const c = document.querySelector('main').parentElement;
    const screen = c.parentElement;
    const sb = [...screen.children].find((e) => e !== c && e.textContent.includes('9:41'));
    const sr = screen.getBoundingClientRect();
    const under = [];
    if (sb) {
      const br = sb.getBoundingClientRect();
      for (const el of c.querySelectorAll('h1,h2,h3,p,button,img,label,strong,span')) {
        const r = el.getBoundingClientRect();
        if (r.width && r.height && r.top < br.bottom && r.bottom > br.top) under.push(`${el.tagName}:${(el.textContent || el.alt || '').trim().slice(0, 20)}`);
      }
    }
    return { top: c.scrollTop, h: c.clientHeight, sh: c.scrollHeight, statusBg: sb ? getComputedStyle(sb).backgroundColor : null, statusZ: sb ? getComputedStyle(sb).zIndex : null, underStatusBar: under.slice(0, 12), screenTop: Math.round(sr.top) };
  });
  await page.evaluate(() => { document.querySelector('main').parentElement.scrollTop = 0; });
  await page.mouse.move(720, 500); await page.mouse.wheel(0, 60); await page.waitForTimeout(500);
  R.checks[`${name}-wheel60`] = await info();
  await shot(`${name}s-wheel60`);
  await page.evaluate(() => { const c = document.querySelector('main').parentElement; c.scrollTop = c.scrollHeight; });
  await page.waitForTimeout(400);
  R.checks[`${name}-bottom`] = await info();
  await shot(`${name}s-bottom`);
  await page.evaluate(() => { document.querySelector('main').parentElement.scrollTop = 0; });
  await page.waitForTimeout(300);
}

async function run(kind, ctxOpts, { full, storage }) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && log.console.push(`${kind} ${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => log.console.push(`${kind} pageerror: ${e.message}`));
  const R = (log.runs[kind] = { audits: [], checks: {} });
  const shot = async (name) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/critic-visual-r2-${kind}-${name}.png` });
    R.audits.push(await audit(page, name));
  };
  const pick = async (button, file) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button.click()]);
    await chooser.setFiles(file);
  };
  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await shot('01-landing');
    await page.getByRole('heading', { name: '페르소나 만들기' }).waitFor({ timeout: 6000 });
    await pick(page.getByRole('button', { name: /TXT 파일 업로드/ }), 'pocs/fixtures/analysis/kakao-pc.txt');
    await page.getByLabel('나의 이야기').fill('사람들 앞에서는 긴장하지만 친한 친구랑은 장난을 많이 쳐. 요즘은 첫 회사에 적응하는 중이고, 언젠가 작은 책방을 열고 싶어.');
    await page.getByLabel('이름').fill(LONG_NAME);
    await page.getByLabel(/지금 나이/).fill('26');
    if (full) await pick(page.getByRole('button', { name: '사진 업로드' }), 'pocs/fixtures/persona/synthetic-face.jpg');
    await shot('02-create');
    if (kind === 'desktop') await scrollShots(page, R, shot, '02');

    if (full) {
      await page.getByRole('button', { name: '페르소나 생성하기' }).click();
      await page.getByRole('heading', { name: '페르소나를 만들고 있어요' }).waitFor();
      await page.waitForTimeout(1500);
      await shot('02b-working');
      await page.getByRole('heading', { name: '나의 페르소나' }).waitFor({ timeout: 300_000 });
    } else {
      await page.evaluate((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: '나의 페르소나' }).waitFor({ timeout: 8000 });
    }
    await page.waitForTimeout(800);
    R.checks.personas = await page.locator('ul li strong').allTextContents();
    await shot('03-list');
    if (kind === 'desktop') await scrollShots(page, R, shot, '03');

    await page.getByRole('button', { name: '페르소나 생성' }).click();
    await page.getByRole('dialog').waitFor();
    await page.getByLabel('상황 설명').fill('작은 책방을 열어서 아침마다 커피를 내리고 손님과 책 이야기를 나누고 싶어. 가끔은 동네 아이들에게 그림책도 읽어 주고, 비 오는 날에는 문을 일찍 닫고 혼자 책을 읽는 그런 하루.');
    const slider = page.getByLabel('그때의 나이');
    await slider.focus();
    const start = Number(await slider.inputValue());
    for (let i = start; i < 30; i++) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(600);
    await shot('04-modal');
    if (full) {
      await page.getByRole('button', { name: '생성하기' }).click();
      await page.getByRole('heading', { name: '페르소나를 만들고 있어요' }).waitFor();
      await page.waitForTimeout(1500);
      await shot('04b-working-modal');
      await page.getByRole('heading', { name: '나의 페르소나' }).waitFor({ timeout: 200_000 });
      await page.waitForTimeout(800);
      R.checks.afterModal = await page.locator('ul li strong').allTextContents();
      await shot('03c-list-after-modal');
    } else {
      await page.keyboard.press('Escape');
    }

    // 05 대화: 가장 긴 이름의 페르소나
    const names = await page.locator('ul li strong').allTextContents();
    const idx = names.reduce((b, n, i) => (n.length > names[b].length ? i : b), 0);
    R.checks.chatTarget = names[idx];
    await page.locator('ul li button').nth(idx).click();
    await page.getByRole('heading', { name: names[idx] }).waitFor();
    await shot('05a-chat-greeting');
    await page.getByLabel('메시지').fill(LONG_MSG);
    await shot('05b-chat-composer-long');
    await page.keyboard.press('Enter');
    await page.getByLabel('입력 중').waitFor({ timeout: 10_000 }).then(() => shot('05c-chat-typing')).catch(() => (R.checks.typingMissed = true));
    await page.waitForFunction(() => !document.querySelector('[aria-label="입력 중"]') && document.querySelector('button[aria-label="보내기"]'), null, { timeout: 60_000 });
    await page.waitForTimeout(4000);
    await page.getByLabel('메시지').fill('어떤 게 제일 걱정돼?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => !document.querySelector('[aria-label="입력 중"]'), null, { timeout: 60_000 });
    await page.waitForTimeout(4000);
    await shot('05d-chat-reply');
    // 맨 위로 스크롤해 긴 말풍선 전체 확인
    await page.evaluate(() => { const s = document.querySelector('main section'); (s?.closest('[class*=scroll], main') ?? s).scrollTop = 0; document.querySelectorAll('*').forEach((e) => { if (e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY !== 'visible') e.scrollTop = 0; }); });
    await shot('05e-chat-top');

    await page.getByRole('button', { name: '프로필 보기' }).click();
    await page.getByRole('dialog').waitFor();
    await page.waitForTimeout(700);
    await shot('06-profile-sheet');
    await page.keyboard.press('Escape');

    R.storage = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
    R.ok = true;
  } catch (e) {
    R.ok = false;
    R.error = String(e);
    await page.screenshot({ path: `${OUT}/critic-visual-r2-${kind}-error.png` }).catch(() => {});
  }
  await ctx.close();
  return R.storage;
}

const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const mobile360 = { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

const STORE_DEFAULT = (await import('node:path')).join((await import('node:os')).tmpdir(), 'mm-store-r2.json');
const reuse = process.argv.includes('--reuse');
let storage;
if (reuse) storage = JSON.parse(await readFile((process.env.STORE ?? STORE_DEFAULT), 'utf8'));
else {
  storage = await run('desktop', desktop, { full: true });
  if (storage) await writeFile((process.env.STORE ?? STORE_DEFAULT), JSON.stringify(Object.fromEntries(Object.entries(storage).filter(([k]) => !k.startsWith('mindme:chat:')))));
}
const st = Object.fromEntries(Object.entries(storage ?? {}).filter(([k]) => !k.startsWith('mindme:chat:')));
await run('mobile', mobile, { full: false, storage: st });
await run('mobile360', mobile360, { full: false, storage: st });
for (const r of Object.values(log.runs)) delete r.storage;
await writeFile(`${OUT}/critic-visual-r2-capture.json`, JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 1).slice(0, 6000));
await browser.close();
