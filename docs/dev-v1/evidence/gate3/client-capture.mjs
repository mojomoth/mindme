#!/usr/bin/env node
// polish-client 재현·확인. AI 호출은 모두 Playwright route 로 흉내 낸다(비용 0).
// 사용법: node docs/dev-v1/evidence/gate3/client-capture.mjs <before|after>
import { chromium } from '@playwright/test';
const TAG = process.argv[2] ?? 'after';
const OUT = 'docs/dev-v1/evidence/gate3';
const BASE = 'http://localhost:3100';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const LONG = '말투는 짧고 편한 반말. '.repeat(8);
const persona = (id, name, kind, age, extra = {}) => ({ id, name, kind, age, traits: ['수줍음', '고집이 셈'], speechStyle: LONG, memories: Array.from({ length: 6 }, (_, i) => `기억 ${i + 1}: 체육대회 날 서진과 다툰 뒤 집에 혼자 걸어간 저녁`), emotions: ['서운함'], greeting: '…왔어? 오늘 좀 기분이 별로야.', ...extra });
const seed = {
  'mindme:profile': { name: '이지우', currentAge: 26 },
  'mindme:events': [],
  'mindme:personas': [
    persona('a', '15살의 이지우', 'past', 15),
    persona('e', '체육대회 계주로 서진과 다툰 날의 남궁하늘빛초롱별', 'past', 16),
    persona('b', '지금의 이지우', 'present', 26),
    persona('c', '30살의 이지우', 'future', 30),
    persona('d', '20살의 이지우', 'past', 20),
  ],
};
const b = await chromium.launch();
const out = { tag: TAG };
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const page = async (opts, data = seed) => {
  const p = await b.newPage(opts);
  await p.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v)); sessionStorage.setItem('seeded', '1'); } }, data);
  p.on('pageerror', (e) => (out.pageErrors ??= []).push(String(e)));
  return p;
};
const rect = (p, sel) => p.locator(sel).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
const skip = async (p, heading) => { await p.getByRole('button', { name: /건너뛰기|시작/ }).first().click({ timeout: 1500 }).catch(() => {}); await p.getByRole('heading', { name: heading }).waitFor({ timeout: 8000 }); };

// A) 03 목록 4개: 스크롤 끝에서 하단 안내가 버튼에 가리는지
{
  const p = await page(MOBILE);
  await p.goto(BASE);
  await skip(p, '나의 페르소나');
  const peek0 = await rect(p, '[class*="__peek"] p');
  const bar0 = await rect(p, '[class*="__bottomBar"]');
  out.listPeekFirstScreen = { peek: peek0, bar: bar0, belowFold: peek0.top >= bar0.top };
  await p.screenshot({ path: `${OUT}/client-${TAG}-03-list-top.png` });
  await p.evaluate(() => { const c = document.querySelector('main').parentElement; c.scrollTop = c.scrollHeight; });
  await p.waitForTimeout(200);
  const peek = await rect(p, '[class*="__peek"] p');
  const bar = await rect(p, '[class*="__bottomBar"]');
  out.listPeekAtEnd = { peek, bar, gapPx: bar.top - peek.bottom, covered: peek.bottom > bar.top };
  await p.screenshot({ path: `${OUT}/client-${TAG}-03-list-end.png` });
  await p.close();
}

// B) 02 만들기 모바일 첫 화면: 사진 카드·이름 줄이 버튼 뒤에 있는지
for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 740 }]) {
  const p = await page({ ...MOBILE, viewport: vp }, {});
  await p.goto(BASE);
  await skip(p, '페르소나 만들기');
  const bar = await rect(p, '[class*="__bottomBar"]');
  const me = await rect(p, '[class*="__me"]');
  const photo = await rect(p, 'section[aria-labelledby=pc-photo]');
  const btn = await rect(p, '[class*="__bottomBar"] button');
  out[`create${vp.width}`] = { buttonTop: btn.top, meBottom: me.bottom, photoBottom: photo.bottom, meCovered: me.bottom > btn.top, photoCovered: photo.bottom > btn.top };
  await p.screenshot({ path: `${OUT}/client-${TAG}-02-create-${vp.width}.png` });
  await p.close();
}

// C) 04 모달·05 입력란·프로필 시트: 끝까지 스크롤한 여러 줄 입력란의 첫 줄이 잘리는지
const partial = (p, sel) => p.locator(sel).evaluate((el) => {
  el.scrollTop = el.scrollHeight;
  const cs = getComputedStyle(el), lh = parseFloat(cs.lineHeight);
  const box = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  // 보이는 첫 줄 위쪽이 잘린 픽셀 수(0 이면 줄 경계에 맞음). 패딩도 스크롤 영역이라 패딩 안에 반쯤 보이는 줄이 생긴다.
  const visibleTop = el.scrollTop;
  const firstLineTop = parseFloat(cs.paddingTop);
  const cut = ((visibleTop - firstLineTop) % lh + lh) % lh;
  return { clientHeight: el.clientHeight, lineHeight: lh, linesInBox: +(box / lh).toFixed(2), paddingTop: cs.paddingTop, cutPx: +cut.toFixed(1) };
});
{
  const p = await page({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE);
  await skip(p, '나의 페르소나');
  await p.getByRole('button', { name: '페르소나 생성' }).click();
  await p.getByLabel('상황 설명').fill('새 학기가 시작된 날, 친구에게 먼저 말을 걸고 싶었던 나. 그런데 막상 말을 꺼내려니 목소리가 안 나왔다. 집에 와서 한참 울었다.');
  out.modalTextarea = await partial(p, '#pm-situation');
  await p.locator('[role=dialog]').screenshot({ path: `${OUT}/client-${TAG}-04-modal-textarea.png` });
  await p.keyboard.press('Escape');
  await p.locator('ul li button').first().click();
  await p.getByLabel('메시지').fill('줄1\n줄2\n줄3\n줄4\n줄5\n줄6\n줄7');
  out.chatInput = await partial(p, 'textarea[aria-label=메시지]');
  await p.locator('form[class*=composer]').screenshot({ path: `${OUT}/client-${TAG}-05-composer.png` });
  await p.getByLabel('메시지').fill('');
  await p.getByRole('button', { name: '프로필 보기' }).click();
  out.sheetSpeech = await partial(p, '#ps-speech');
  out.sheetMemories = await partial(p, '#ps-memories');
  await p.screenshot({ path: `${OUT}/client-${TAG}-06-profile-sheet-desktop.png` });
  await p.close();
}
{
  const p = await page(MOBILE);
  await p.goto(BASE);
  await skip(p, '나의 페르소나');
  await p.locator('ul li button').first().click();
  await p.getByRole('button', { name: '프로필 보기' }).click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/client-${TAG}-06-profile-sheet-mobile.png` });
  await p.locator('[role=dialog]').evaluate((el) => (el.scrollTop = el.scrollHeight));
  await p.waitForTimeout(100);
  await p.screenshot({ path: `${OUT}/client-${TAG}-06-profile-sheet-mobile-end.png` });
  await p.close();
}

// D) 대화 중 나가기 → 다시 들어오기
{
  const p = await page(MOBILE);
  let chatCalls = 0, aborted = false;
  await p.route('**/api/chat', async (r) => {
    chatCalls++;
    if (chatCalls === 1) { await new Promise((res) => setTimeout(res, 4000)); return r.abort().catch(() => {}); }
    return r.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: '응, 기억나. 그날 진짜 속상했어.' });
  });
  p.on('requestfailed', (req) => { if (req.url().includes('/api/chat')) aborted = true; });
  await p.goto(BASE);
  await skip(p, '나의 페르소나');
  await p.locator('ul li button').first().click();
  await p.getByLabel('메시지').fill('그날 기억나?');
  await p.keyboard.press('Enter');
  await p.getByLabel('입력 중').waitFor();
  await p.getByRole('button', { name: '나가기' }).click();
  await p.getByRole('heading', { name: '나의 페르소나' }).waitFor();
  await p.waitForTimeout(300);
  out.chatAbortedOnLeave = aborted;
  await p.locator('ul li button').first().click();
  await p.waitForTimeout(300);
  const alert = p.locator('main [role=alert]');
  out.reenterAlert = (await alert.count()) ? await alert.textContent() : null;
  await p.screenshot({ path: `${OUT}/client-${TAG}-05-reenter-unanswered.png` });
  const retry = p.getByRole('button', { name: '다시 받기' });
  if (await retry.count()) {
    await retry.click();
    await p.getByText('응, 기억나.').waitFor({ timeout: 5000 });
    out.retryAnswered = true;
    await p.screenshot({ path: `${OUT}/client-${TAG}-05-retry-answered.png` });
  }
  out.chatCalls = chatCalls;
  await p.close();
}

// E) 모달: 이미 있는 페르소나(15살)와 같은 이름 → 안내
{
  const p = await page({ viewport: { width: 1440, height: 900 } });
  let personaCalls = 0;
  await p.route('**/api/persona', (r) => { personaCalls++; const req = r.request().postDataJSON(); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ persona: persona(`n${personaCalls}`, `${req.age}살의 이지우`, req.kind, req.age) }) }); });
  await p.goto(BASE);
  await skip(p, '나의 페르소나');
  await p.getByRole('button', { name: '페르소나 생성' }).click();
  await p.getByLabel('그때의 나이').fill('15');
  await p.getByRole('button', { name: '생성하기' }).click();
  await p.waitForTimeout(500);
  out.dupDialog = await p.locator('[role=dialog]').count() ? (await p.locator('[role=dialog]').innerText()).replace(/\s+/g, ' ') : null;
  await p.screenshot({ path: `${OUT}/client-${TAG}-04-duplicate.png` });
  const go = p.getByRole('button', { name: /대화 이어가기/ });
  if (await go.count()) { await go.click(); await p.waitForTimeout(300); out.dupWentTo = await p.locator('header h1').textContent(); }
  out.dupPersonaCalls = personaCalls;
  out.dupPersonaCount = await p.evaluate(() => JSON.parse(localStorage.getItem('mindme:personas')).length);
  await p.close();
}

// F) 다시 시도: 성공한 아바타는 다시 그리지 않는다 + 긴 이름 말줄임
{
  const p = await page({ viewport: { width: 1440, height: 900 } }, { ...seed, 'mindme:photo': PNG });
  let personaCalls = 0, avatarCalls = 0;
  await p.route('**/api/persona/avatar', (r) => { avatarCalls++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ avatar: PNG, source: 'generated' }) }); });
  await p.route('**/api/persona', (r) => {
    personaCalls++;
    if (personaCalls === 1) return r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'upstream_error', message: '페르소나를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.' } }) });
    const req = r.request().postDataJSON();
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ persona: persona('long', `졸업하며 서진과 헤어짐을 아쉬워…의 ${req.profile.name}`, req.kind, req.age) }) });
  });
  await p.goto(BASE);
  await skip(p, '나의 페르소나');
  await p.getByRole('button', { name: '페르소나 생성' }).click();
  await p.getByLabel('그때의 나이').fill('17');
  await p.getByRole('button', { name: '생성하기' }).click();
  await p.getByRole('heading', { name: '페르소나를 만들지 못했어요' }).waitFor({ timeout: 8000 }).catch(async () => { out.retryDebug = (await p.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 200); await p.screenshot({ path: `${OUT}/client-${TAG}-03-retry-stuck.png` }); });
  if (!out.retryDebug) {
    await p.getByRole('button', { name: '다시 시도' }).click();
    await p.getByRole('heading', { name: '나의 페르소나' }).waitFor();
  }
  out.retry = { personaCalls, avatarCalls };
  out.longName = await p.evaluate(() => JSON.parse(localStorage.getItem('mindme:personas'))[0].name);
  if (!out.retryDebug) out.longNameShown = await p.locator('ul li strong').first().evaluate((el) => ({ text: el.textContent, clamped: el.scrollHeight > el.clientHeight + 1 }));
  await p.screenshot({ path: `${OUT}/client-${TAG}-03-after-retry.png` });
  await p.close();
}

// G) analyze owner 를 이름·나이 기본값으로 (비워 둔 경우)
{
  const p = await page({ viewport: { width: 1440, height: 900 } }, {});
  let personaReq;
  await p.route('**/api/analyze', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [], owner: { name: '박서진', currentAge: 31 } }) }));
  await p.route('**/api/persona', (r) => { personaReq = r.request().postDataJSON(); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ persona: persona('p', `지금의 ${personaReq.profile.name}`, personaReq.kind, personaReq.age) }) }); });
  await p.goto(BASE);
  await skip(p, '페르소나 만들기');
  await p.getByLabel('나의 이야기').fill('요즘 회사를 계속 다닐지 고민이 많아.');
  out.ownerSubmitEnabled = await p.getByRole('button', { name: '페르소나 생성하기' }).isEnabled();
  if (out.ownerSubmitEnabled) {
    await p.getByRole('button', { name: '페르소나 생성하기' }).click();
    await p.getByRole('heading', { name: '나의 페르소나' }).waitFor({ timeout: 8000 }).catch(() => {});
    out.ownerProfile = await p.evaluate(() => localStorage.getItem('mindme:profile'));
    out.ownerPersonaReq = personaReq && { kind: personaReq.kind, age: personaReq.age, profile: personaReq.profile };
  }
  await p.close();
}

// H) 권한 헤더
{
  const res = await fetch(BASE);
  out.permissionsPolicy = res.headers.get('permissions-policy');
}
await b.close();
console.log(JSON.stringify(out, null, 2));
