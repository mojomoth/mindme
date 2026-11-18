#!/usr/bin/env node
// Gate 3 로컬 최종 Critic r1 (독립 작성, 실제 AI). 사용법: node docs/dev-v1/evidence/gate3/critic-local-r1-flow.mjs
// 데스크톱 1440x900(목업 안), 사진 있음: 랜딩 자동 이동 → 만들기(합성 카톡 TXT) → 목록 → 모달 미래(persona 1회 실패 → 다시 시도, 아바타 호출 수)
// → 모달 과거 · 같은 이름 → 대화 스트리밍 → 글자가 오는 중 나가기 → 재진입 다시 받기 → 프로필 수정 → 새로고침 유지 → 429 표시
// 끝나면 localStorage 를 critic-local-r1-state.json 에 남긴다(모바일·뷰포트 캡처용, 키 없음).
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost:3100';
const OUT = 'docs/dev-v1/evidence/gate3';
const P = 'critic-local-r1';
const IP = `198.19.${Math.floor(Math.random() * 200) + 20}.${Math.floor(Math.random() * 200) + 20}`;

const keyVals = readFileSync('.env', 'utf8')
  .split('\n')
  .map((l) => l.match(/^\s*([A-Z0-9_]*KEY[A-Z0-9_]*)\s*=\s*["']?([^"'\s]+)/))
  .filter((m) => m && m[2].length >= 8)
  .map((m) => ({ name: m[1], value: m[2] }));

const log = { ip: IP, steps: [], checks: {}, console: [], errors: [], api: [], keyScan: { bodies: 0, hits: [] } };
const t0 = Date.now();
const check = (k, v) => {
  log.checks[k] = v;
  console.log(`CHECK ${k} = ${JSON.stringify(v)}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, extraHTTPHeaders: { 'x-forwarded-for': IP } });
const page = await ctx.newPage();
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && log.console.push(`${m.type()}: ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => log.console.push(`pageerror: ${e.message}`));
page.on('request', (r) => r.url().includes('/api/') && log.api.push({ t: +((Date.now() - t0) / 1000).toFixed(1), m: r.method(), u: new URL(r.url()).pathname }));
page.on('requestfailed', (r) => r.url().includes('/api/') && log.api.push({ t: +((Date.now() - t0) / 1000).toFixed(1), failed: new URL(r.url()).pathname, why: r.failure()?.errorText }));
const bodyChecks = [];
page.on('response', (res) => {
  const ct = res.headers()['content-type'] ?? '';
  if (/image|font/.test(ct)) return;
  bodyChecks.push(
    res
      .text()
      .then((b) => {
        log.keyScan.bodies++;
        for (const k of keyVals) if (b.includes(k.value)) log.keyScan.hits.push(`${k.name} in ${res.url()}`);
        if (/sk-(proj-)?[A-Za-z0-9_-]{24,}/.test(b)) log.keyScan.hits.push(`sk- in ${res.url()}`);
      })
      .catch(() => {}),
  );
});
const apiCount = (path) => log.api.filter((a) => a.u === path).length;

const shot = async (name) => {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${P}-desktop-${name}.png` });
};
const pick = async (button, file) => {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button.click()]);
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
  return { slider: got, pill: await page.locator('[role=dialog] output').textContent(), note: await page.locator('[role=dialog] p[aria-live]').textContent().catch(() => null) };
}
/** 스트리밍 관찰. stopAfterChars 가 있으면 그만큼 받으면 바로 돌아온다(나가기 시험용). */
async function send(text, { stopAfterChars } = {}) {
  const box = page.getByLabel('메시지');
  await box.fill(text);
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
    await page.waitForTimeout(60);
  }
  return { firstChunkMs, samples: lens.length, finalLen: lens.at(-1), reply: ((await bubblesIn().last().textContent()) ?? '').trim().slice(0, 200), alert: await page.locator('main [role=alert]').textContent().catch(() => null) };
}

try {
  // 01 랜딩 → 자동 이동
  const tg = Date.now();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '다시 만나는, 그때의 나' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await shot('01-landing');
  await page.getByRole('heading', { name: '페르소나 만들기' }).waitFor({ timeout: 8000 });
  check('landingAutoMs', Date.now() - tg);
  await shot('02-create-empty');

  // 02 만들기 (합성 카톡 TXT + 이야기 + 이름·나이 + 사진)
  await pick(page.getByRole('button', { name: /TXT 파일 업로드/ }), `${OUT}/${P}-kakao.txt`);
  await page.getByLabel('나의 이야기').fill('겁이 많지만 먼저 다가가고 싶어 하는 편이야. 그림 그릴 때 제일 나다워. 지금은 디자이너로 일하고, 내 이름으로 그림책을 내는 게 꿈이야.');
  await page.getByRole('textbox', { name: '이름' }).fill('서하린');
  await page.getByLabel(/지금 나이/).fill('31');
  await pick(page.getByRole('button', { name: '사진 업로드' }), 'pocs/fixtures/persona/synthetic-face.jpg');
  await page.waitForTimeout(500);
  check('fileNameShown', await page.getByText(`${P}-kakao.txt`).isVisible());
  await shot('02-create-filled');

  const tc = Date.now();
  await page.getByRole('button', { name: '페르소나 생성하기' }).click();
  await WORKING().waitFor();
  await shot('02b-working');
  await LIST().waitFor({ timeout: 360_000 });
  await page.waitForTimeout(600);
  const first = await ls('mindme:personas');
  check('firstCreate', { ms: Date.now() - tc, count: first.length, items: first.map((p) => ({ name: p.name, kind: p.kind, age: p.age, avatar: p.avatar ? p.avatar.slice(0, 22) : null })) });
  check('events', ((await ls('mindme:events')) ?? []).map((e) => `${e.date} age=${e.age ?? '-'} ${e.title}`));
  await shot('03-list');

  // 04 모달 미래 40살 + /api/persona 1회 실패 → 다시 시도 (아바타 다시 그리는지)
  const avatarBefore = apiCount('/api/persona/avatar');
  const personaBefore = apiCount('/api/persona');
  let failOnce = true;
  await page.route('**/api/persona', (r) => {
    if (!failOnce) return r.continue();
    failOnce = false;
    return r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'upstream_error', message: '잠깐 문제가 생겼어요.' } }) });
  });
  check('modalFuture', await openModal('서른다섯 넘어서 내 이름으로 첫 그림책을 내고 북토크를 여는 나', 40));
  await shot('04-modal-future');
  await page.getByRole('button', { name: '생성하기' }).click();
  await FAILED().waitFor({ timeout: 120_000 });
  check('futureFailText', await page.locator('main [role=alert]').textContent().catch(() => null));
  await shot('04b-fail');
  const tr = Date.now();
  await page.getByRole('button', { name: '다시 시도' }).click();
  await LIST().waitFor({ timeout: 240_000 });
  await page.unroute('**/api/persona');
  const fut = (await ls('mindme:personas'))[0];
  check('avatarCacheRetry', {
    ms: Date.now() - tr,
    personaCalls: apiCount('/api/persona') - personaBefore,
    avatarCalls: apiCount('/api/persona/avatar') - avatarBefore,
    made: { name: fut.name, kind: fut.kind, age: fut.age, avatar: fut.avatar?.slice(0, 22) ?? null },
  });
  await shot('04c-list-after-future');

  // 04 모달 과거 15살 (전학) — 이미 같은 이름이 있으면 중복 질문, 없으면 만들고 한 번 더 열어 중복 확인
  const PAST = '부산으로 전학 간 첫날, 아무에게도 말을 못 걸고 점심을 혼자 먹던 나';
  check('modalPast', await openModal(PAST, 15));
  await page.waitForTimeout(300);
  await shot('04-modal-past');
  let pBefore = apiCount('/api/persona');
  await page.getByRole('button', { name: '생성하기' }).click();
  await page.waitForTimeout(800);
  let dupVisible = await page.getByRole('button', { name: '대화 이어가기' }).isVisible().catch(() => false);
  if (!dupVisible) {
    await LIST().waitFor({ timeout: 240_000 });
    check('pastCreated', (await ls('mindme:personas'))[0].name);
    check('modalPastAgain', await openModal(PAST, 15));
    pBefore = apiCount('/api/persona');
    await page.getByRole('button', { name: '생성하기' }).click();
    await page.waitForTimeout(800);
    dupVisible = await page.getByRole('button', { name: '대화 이어가기' }).isVisible().catch(() => false);
  }
  check('duplicate', { asked: dupVisible, text: await page.locator('[role=dialog] [role=status]').textContent().catch(() => null), personaCalls: apiCount('/api/persona') - pBefore });
  await shot('04d-duplicate');
  const namesBeforeOpen = await ls('mindme:personas');
  await page.getByRole('button', { name: '대화 이어가기' }).click();
  await page.getByRole('button', { name: '프로필 보기' }).waitFor({ timeout: 8000 });
  const chatTitle = await page.locator('main header h1').textContent();
  check('dupOpenExisting', { chatTitle, countUnchanged: (await ls('mindme:personas')).length === namesBeforeOpen.length });

  // 05 대화 스트리밍
  check('chatHeader', { title: chatTitle, status: await page.locator('main header p').textContent() });
  const r1 = await send('전학 첫날 혼자 점심 먹을 때 무슨 생각 했어?');
  check('chat1', r1);
  await shot('05-chat');

  // 글자가 오는 중에 나가기 → 요청 취소 → 재진입 시 '다시 받기'
  const abortedBefore = log.api.filter((a) => a.failed === '/api/chat').length;
  const r2 = await send('그때 짝꿍한테 먼저 인사하려고 마음먹은 순간을 길게 자세히 이야기해 줘.', { stopAfterChars: 8 });
  check('midStream', r2);
  await page.getByRole('button', { name: '나가기' }).click();
  await LIST().waitFor();
  await page.waitForTimeout(3000);
  check('midStreamAbort', { abortedRequests: log.api.filter((a) => a.failed === '/api/chat').length - abortedBefore, screen: await page.locator('h1').first().textContent() });
  const idx = (await listNames()).indexOf(chatTitle);
  await page.locator('ul li button').nth(idx).click();
  await page.getByRole('button', { name: '프로필 보기' }).waitFor();
  await page.waitForTimeout(500);
  const lastBubble = page.locator('main section p[class*="bubble"]').last();
  check('reenterAfterMidStream', {
    lastIsMine: (await lastBubble.getAttribute('class'))?.includes('bubbleOut'),
    alert: await page.locator('main [role=alert]').textContent().catch(() => null),
    retryButton: await page.getByRole('button', { name: '다시 받기' }).count(),
    stored: ((await ls(`mindme:chat:${(await ls('mindme:personas')).find((p) => p.name === chatTitle)?.id}`)) ?? []).slice(-2).map((m) => `${m.role}:${(m.content ?? '').slice(0, 30)}`),
  });
  await shot('05b-reenter-unanswered');
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
    check('retryAnswered', { len, alert: await page.locator('main [role=alert]').count(), reply: ((await bubblesIn().last().textContent()) ?? '').slice(0, 120) });
    await shot('05c-retry-answered');
  }

  // 하단 가림: 입력창이 마지막 말풍선을 가리지 않는지
  check('composerOverlap', await page.evaluate(() => {
    const last = [...document.querySelectorAll('main section p[class*="bubble"]')].at(-1)?.getBoundingClientRect();
    const box = document.querySelector('textarea[aria-label="메시지"]')?.closest('form,div')?.getBoundingClientRect();
    return last && box ? { lastBottom: Math.round(last.bottom), composerTop: Math.round(box.top), hidden: last.bottom > box.top + 1 } : null;
  }));

  // 프로필 수정
  await page.getByRole('button', { name: '프로필 보기' }).click();
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(400);
  await shot('06-profile');
  const newName = '열다섯 하린이';
  await page.getByRole('textbox', { name: '이름' }).fill(newName);
  const emo = page.getByLabel(/^감정/);
  await emo.fill(`${await emo.inputValue()}, 설렘`);
  await page.getByRole('button', { name: '저장' }).click();
  await page.waitForTimeout(400);
  check('profileSaved', { sheetClosed: (await page.getByRole('dialog').count()) === 0, header: await page.locator('main header h1').textContent() });
  await shot('06b-after-save');

  // 429 표시(서버 본문 그대로)
  await page.route('**/api/chat', (r) => r.fulfill({ status: 429, contentType: 'application/json', headers: { 'retry-after': '600' }, body: JSON.stringify({ error: { code: 'rate_limited', message: '짧은 시간에 요청이 많았어요. 10분쯤 뒤에 다시 시도해 주세요.' } }) }));
  await page.getByLabel('메시지').fill('혹시 들려?');
  await page.keyboard.press('Enter');
  await page.locator('main [role=alert]').waitFor({ timeout: 10_000 });
  check('chat429Ui', await page.locator('main [role=alert]').textContent());
  await shot('06c-chat-429');
  await page.unroute('**/api/chat');

  await page.getByRole('button', { name: '나가기' }).click();
  await LIST().waitFor();

  // 새로고침 유지
  await page.reload();
  await page.getByRole('heading', { name: '다시 만나는, 그때의 나' }).waitFor();
  const trl = Date.now();
  await LIST().waitFor({ timeout: 8000 });
  const names = await listNames();
  check('afterReload', { landingToListMs: Date.now() - trl, names, editedPersisted: names.includes(newName) });
  await shot('07-list-reloaded');
  await page.locator('ul li button').nth(names.indexOf(newName)).click();
  await page.getByRole('heading', { name: newName }).waitFor();
  check('chatRestored', { bubbles: await page.locator('main section p[class*="bubble"]').count() });
  await page.getByRole('button', { name: '프로필 보기' }).click();
  check('emotionPersisted', (await page.getByLabel(/^감정/).inputValue()).includes('설렘'));
  await page.keyboard.press('Escape');
  await shot('07b-chat-restored');
  await page.getByRole('button', { name: '나가기' }).click();
  await LIST().waitFor();

  // 다른 화면 캡처용 상태 저장
  const state = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mindme:')).map((k) => [k, localStorage.getItem(k)])));
  writeFileSync(`${OUT}/${P}-state.json`, JSON.stringify(state));
  check('stateKeys', Object.keys(state));
} catch (err) {
  log.errors.push(String(err?.stack ?? err).slice(0, 1500));
  console.error(err);
  await page.screenshot({ path: `${OUT}/${P}-desktop-zz-failure.png` }).catch(() => {});
} finally {
  await Promise.allSettled(bodyChecks);
  log.totalSec = (Date.now() - t0) / 1000;
  writeFileSync(`${OUT}/${P}-flow.json`, JSON.stringify(log, null, 2));
  await browser.close();
}
