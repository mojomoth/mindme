// Gate 3 r2 remote-behavior: 배포 URL 1440x900 핵심 흐름 1회 (실제 AI, 사진 없음)
import { chromium } from '/Users/jeongyounglee/work/repo/mindme/node_modules/@playwright/test/index.mjs';
import { writeFile } from 'node:fs/promises';

const BASE = 'https://mindme-rho.vercel.app';
const REPO = '/Users/jeongyounglee/work/repo/mindme';
const EV = `${REPO}/docs/dev-v1/evidence/gate3r2`;
const shot = (n) => `${EV}/remote-behavior-flow-${n}.png`;
const LEAK = /출근|사수|회사|입사|직장|팀장|월급|회의|합격|신입|퇴근|팀 사람/g;
const RGB = { 'rgb(220, 234, 248)': 'blue', 'rgb(254, 241, 197)': 'yellow', 'rgb(254, 223, 210)': 'peach' };

const out = { at: new Date().toISOString(), base: BASE, viewport: '1440x900', console: [], pageErrors: [], badResponses: [], api: [], steps: {} };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && out.console.push({ type: m.type(), text: m.text().slice(0, 500) }));
page.on('pageerror', (e) => out.pageErrors.push(String(e).slice(0, 500)));
const started = new Map();
page.on('request', (r) => r.url().includes('/api/') && started.set(r, Date.now()));
page.on('requestfailed', (r) => out.badResponses.push({ url: r.url().replace(BASE, ''), failed: r.failure()?.errorText }));
page.on('response', (r) => {
  if (r.status() >= 400) out.badResponses.push({ url: r.url().replace(BASE, ''), status: r.status() });
  if (r.url().includes('/api/')) out.api.push({ url: r.url().replace(BASE, ''), status: r.status(), headersMs: Date.now() - (started.get(r.request()) ?? Date.now()), xCrisis: r.headers()['x-crisis'] ?? null });
});
const t0 = Date.now();
const lap = () => Math.round((Date.now() - t0) / 1000);

const measureList = () => page.evaluate((RGB) => {
  const cards = [...document.querySelectorAll('li button')].map((b) => {
    const av = b.querySelector(':scope > span');
    const bg = av ? getComputedStyle(av).backgroundColor : null;
    return { name: b.querySelector('strong')?.textContent, desc: b.querySelector('strong + span')?.textContent?.slice(0, 60), isNew: !!b.querySelector('em'), bg: RGB[bg] ?? bg };
  });
  const ready = document.querySelector('p[role="status"]');
  return { ready: ready ? ready.textContent : null, newBadges: [...document.querySelectorAll('li em')].map((e) => e.textContent), newIndex: cards.findIndex((c) => c.isNew), cards };
}, RGB);
const docScroll = () => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, cw: document.documentElement.clientWidth, ch: document.documentElement.clientHeight }));

try {
  // 01 랜딩
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  out.steps.landing = { text: (await page.locator('main').first().innerText()).replace(/\s+/g, ' ').slice(0, 120), scroll: await docScroll() };
  await page.screenshot({ path: shot('01-landing'), animations: 'disabled' });

  // 02 만들기 (3초 뒤 자동 이동)
  await page.locator('#pc-story').waitFor({ timeout: 10_000 });
  out.steps.autoToCreateSec = lap();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /TXT 파일 업로드/ }).click();
  await (await chooser).setFiles(`${REPO}/pocs/fixtures/analysis/kakao-mobile.txt`);
  await page.getByText('kakao-mobile.txt').waitFor();
  await page.locator('#pc-story').fill('첫 출근 날 사수가 말이 없어서 하루 종일 눈치를 봤어요. 회사 화장실에서 몰래 숨 고르던 게 기억나요.');
  await page.getByPlaceholder('홍길동').fill('이지우');
  await page.getByPlaceholder('32').fill('27');
  await page.screenshot({ path: shot('02-create'), animations: 'disabled' });
  out.steps.create = { at: lap() };

  // 진행 화면
  await page.getByRole('button', { name: '페르소나 생성하기' }).click();
  await page.getByText('페르소나를 만들고 있어요').waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: shot('02b-working'), animations: 'disabled' });

  // 03 목록
  const tCreate = Date.now();
  await page.locator('li button').first().waitFor({ timeout: 240_000 });
  await page.waitForTimeout(700);
  out.steps.list = { at: lap(), createSec: Math.round((Date.now() - tCreate) / 1000), ...(await measureList()), scroll: await docScroll() };
  await page.screenshot({ path: shot('03-list'), animations: 'disabled' });
  const firstCount = out.steps.list.cards.length;

  // 04 모달 → 17살 과거의 나
  await page.getByRole('button', { name: '페르소나 생성' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await page.locator('#pm-situation').fill('고등학교 2학년 때 처음으로 반 대표로 발표했던 날');
  await page.locator('#pm-age').fill('17');
  await page.waitForTimeout(300);
  out.steps.modal = { agePill: await dialog.locator('output').innerText().catch(() => null), note: await dialog.locator('[aria-live]').innerText().catch(() => null) };
  await page.screenshot({ path: shot('04-modal'), animations: 'disabled' });
  const personaReq = page.waitForRequest((r) => r.url().endsWith('/api/persona'));
  await dialog.getByRole('button', { name: '생성하기' }).click();
  if (await page.getByRole('button', { name: '새로 만들기' }).isVisible().catch(() => false)) {
    out.steps.modal.sameNamedPrompt = true;
    await page.getByRole('button', { name: '새로 만들기' }).click();
  }
  const req = (await personaReq).postDataJSON();
  out.steps.modal.request = { kind: req.kind, age: req.age, eventId: req.eventId ?? null, situation: req.situation, events: req.events?.length, profileStory: !!req.profile?.story };
  await page.waitForFunction((n) => document.querySelectorAll('li button strong').length > n, firstCount, { timeout: 180_000 });
  await page.waitForTimeout(700);
  out.steps.modal.at = lap();
  out.steps.modal.listAfter = await measureList();
  await page.screenshot({ path: shot('04b-list-after-modal'), animations: 'disabled' });

  // 17살 페르소나 내용(localStorage)
  const p17 = await page.evaluate(() => JSON.parse(localStorage.getItem('mindme:personas'))[0]);
  const p17text = JSON.stringify({ greeting: p17.greeting, memories: p17.memories, traits: p17.traits, speechStyle: p17.speechStyle, emotions: p17.emotions });
  out.steps.p17 = { id: p17.id, name: p17.name, kind: p17.kind, age: p17.age, eventId: p17.eventId ?? null, greeting: p17.greeting, memories: p17.memories, traits: p17.traits, speechStyle: p17.speechStyle, emotions: p17.emotions, leakWords: p17text.match(LEAK) ?? [] };

  // 05 대화 2턴 (17살, 스트리밍)
  await page.locator('li button').first().click();
  await page.getByRole('textbox', { name: '메시지' }).waitFor();
  const turns = [];
  for (const msg of ['안녕, 나 10년 뒤의 너야. 요즘 무슨 일 있었어?', '요즘 제일 신경 쓰이는 사람이 누구야?']) {
    await page.getByRole('textbox', { name: '메시지' }).fill(msg);
    await page.getByRole('button', { name: '보내기' }).click();
    const samples = [];
    const t = Date.now();
    let typingSeen = false;
    while (Date.now() - t < 90_000) {
      const s = await page.evaluate(() => {
        const ins = [...document.querySelectorAll('p')].filter((p) => /bubbleIn/.test(p.className) && !/typing/.test(p.className));
        const typing = !!document.querySelector('p[aria-label="입력 중"]');
        const send = document.querySelector('button[aria-label="보내기"]');
        return { len: ins.at(-1)?.textContent?.length ?? 0, n: ins.length, typing, busy: !!send?.disabled };
      });
      typingSeen ||= s.typing;
      samples.push({ ms: Date.now() - t, ...s });
      if (samples.length > 10 && !s.typing && s.n > samples[0].n && samples.at(-1).len === samples.at(-8)?.len && Date.now() - t > 1500) {
        const sendOk = await page.evaluate(() => { const b = document.querySelector('button[aria-label="보내기"]'); return b && !document.querySelector('p[aria-label="입력 중"]'); });
        if (sendOk) break;
      }
      await page.waitForTimeout(100);
    }
    const lens = [...new Set(samples.map((x) => x.len))];
    const firstGrow = samples.find((x) => x.n > samples[0].n && x.len > 0);
    turns.push({ sent: msg, typingSeen, distinctLengths: lens.length, lengthsSample: lens.slice(0, 15), firstTextMs: firstGrow?.ms ?? null, finalLen: samples.at(-1).len, ms: samples.at(-1).ms });
  }
  out.steps.chat = { at: lap(), turns };
  out.steps.chat.bubbles = await page.locator('p').evaluateAll((ps) =>
    ps.filter((p) => /bubble(In|Out)/.test(p.className)).map((p) => ({ from: /bubbleOut/.test(p.className) ? 'me' : 'persona', text: p.textContent })),
  );
  out.steps.chat.leakWords = out.steps.chat.bubbles.filter((b) => b.from === 'persona').flatMap((b) => b.text.match(LEAK) ?? []);
  out.steps.chat.alerts = await page.getByRole('alert').allInnerTexts();
  out.steps.chat.scroll = await docScroll();
  await page.screenshot({ path: shot('05-chat'), animations: 'disabled' });

  // 프로필 시트
  await page.getByRole('button', { name: '프로필 보기' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.waitFor();
  await page.waitForTimeout(500);
  out.steps.sheet = { aria: (await sheet.ariaSnapshot()).slice(0, 3000) };
  await page.screenshot({ path: shot('05b-sheet'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  if (await sheet.isVisible().catch(() => false)) await sheet.getByRole('button', { name: /닫기/ }).first().click();
  out.steps.sheet.closed = !(await sheet.isVisible().catch(() => false));

  // 나가기 → 새로고침 → 복원
  await page.getByRole('button', { name: '나가기' }).click();
  await page.locator('li button').first().waitFor();
  const beforeReload = { names: await page.locator('li button strong').allInnerTexts(), previews: await page.locator('li button strong + span').allInnerTexts() };
  await page.reload({ waitUntil: 'networkidle' });
  const landingNotice = await page.locator('footer[role="status"]').innerText().catch(() => null);
  const tR = Date.now();
  await page.locator('li button').first().waitFor({ timeout: 10_000 });
  const toListMs = Date.now() - tR;
  await page.waitForTimeout(500);
  const afterList = await measureList();
  const afterReload = { names: await page.locator('li button strong').allInnerTexts(), previews: await page.locator('li button strong + span').allInnerTexts() };
  await page.screenshot({ path: shot('06-list-reloaded'), animations: 'disabled' });
  await page.locator('li button').first().click();
  await page.getByRole('textbox', { name: '메시지' }).waitFor();
  const restored = await page.locator('p').evaluateAll((ps) => ps.filter((p) => /bubble(In|Out)/.test(p.className)).map((p) => p.textContent));
  out.steps.reload = {
    landingNotice, toListMs, afterList,
    beforeReload, afterReload,
    sameList: JSON.stringify(beforeReload) === JSON.stringify(afterReload),
    restoredBubbles: restored.length,
    sameBubbles: JSON.stringify(restored) === JSON.stringify(out.steps.chat.bubbles.map((b) => b.text)),
  };
  await page.screenshot({ path: shot('06b-chat-restored'), animations: 'disabled' });

  const state = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mindme:')).map((k) => [k, localStorage.getItem(k)])));
  await writeFile(`${EV}/remote-behavior-state.json`, JSON.stringify(state, null, 2));
  out.stateKeys = Object.keys(state);
} catch (err) {
  out.error = String(err).slice(0, 1000);
  await page.screenshot({ path: shot('zz-error'), animations: 'disabled' }).catch(() => {});
} finally {
  out.totalSec = lap();
  await writeFile(`${EV}/remote-behavior-flow.json`, JSON.stringify(out, null, 2));
  await browser.close();
  console.log(JSON.stringify({ error: out.error, totalSec: out.totalSec, console: out.console, pageErrors: out.pageErrors, bad: out.badResponses, api: out.api, steps: Object.keys(out.steps) }, null, 1));
}
