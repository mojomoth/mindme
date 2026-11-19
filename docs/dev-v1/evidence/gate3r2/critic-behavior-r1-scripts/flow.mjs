// Gate 3 r2 critic-behavior r1: 데스크톱 1440x900 핵심 흐름 1회 (실제 AI, 사진 없음)
import { chromium } from '/Users/jeongyounglee/work/repo/mindme/node_modules/@playwright/test/index.mjs';
import { writeFile } from 'node:fs/promises';

const BASE = 'http://localhost:3100';
const REPO = '/Users/jeongyounglee/work/repo/mindme';
const EV = `${REPO}/docs/dev-v1/evidence/gate3r2`;
const shot = (n) => `${EV}/critic-behavior-r1-flow-${n}.png`;

const out = { at: new Date().toISOString(), viewport: '1440x900', console: [], pageErrors: [], badResponses: [], api: [], steps: {} };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && out.console.push({ type: m.type(), text: m.text().slice(0, 500) }));
page.on('pageerror', (e) => out.pageErrors.push(String(e).slice(0, 500)));
const started = new Map();
page.on('request', (r) => r.url().includes('/api/') && started.set(r, Date.now()));
page.on('response', (r) => {
  if (r.status() >= 400) out.badResponses.push({ url: r.url(), status: r.status() });
  if (r.url().includes('/api/')) out.api.push({ url: r.url().replace(BASE, ''), status: r.status(), headersMs: Date.now() - (started.get(r.request()) ?? Date.now()) });
});
const t0 = Date.now();
const lap = () => Math.round((Date.now() - t0) / 1000);

try {
  // 01 랜딩
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  out.steps.landing = { text: (await page.locator('main').first().innerText()).replace(/\s+/g, ' ').slice(0, 120) };
  await page.screenshot({ path: shot('01-landing'), animations: 'disabled' });

  // 02 만들기 (3초 뒤 자동 이동을 기다린다)
  await page.locator('#pc-story').waitFor({ timeout: 10_000 });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /TXT 파일 업로드/ }).click();
  await (await chooser).setFiles(`${REPO}/pocs/fixtures/analysis/kakao-mobile.txt`);
  await page.getByText('kakao-mobile.txt').waitFor();
  await page.locator('#pc-story').fill('첫 출근 날 너무 떨려서 아침도 못 먹었던 게 기억나요. 사수가 말이 없어서 눈치를 많이 봤어요.');
  await page.getByPlaceholder('홍길동').fill('이지우');
  await page.getByPlaceholder('32').fill('27');
  await page.screenshot({ path: shot('02-create'), animations: 'disabled' });
  out.steps.create = { at: lap() };

  // 진행 화면
  await page.getByRole('button', { name: '페르소나 생성하기' }).click();
  await page.getByText('페르소나를 만들고 있어요').waitFor({ timeout: 10_000 });
  await page.screenshot({ path: shot('02b-working'), animations: 'disabled' });

  // 03 목록
  await page.locator('li button').first().waitFor({ timeout: 240_000 });
  await page.waitForTimeout(500);
  const firstNames = await page.locator('li button strong').allInnerTexts();
  out.steps.list = { at: lap(), names: firstNames };
  await page.screenshot({ path: shot('03-list'), animations: 'disabled' });

  // 04 모달 → 과거의 나 하나 더
  await page.getByRole('button', { name: '페르소나 생성' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await page.locator('#pm-situation').fill('고등학교 2학년 때 처음으로 반 대표로 발표했던 날');
  await page.locator('#pm-age').fill('17');
  out.steps.modal = { agePill: await dialog.locator('output').innerText(), note: await dialog.locator('[aria-live]').innerText().catch(() => null) };
  await page.screenshot({ path: shot('04-modal'), animations: 'disabled' });
  await dialog.getByRole('button', { name: '생성하기' }).click();
  if (await page.getByRole('button', { name: '새로 만들기' }).isVisible().catch(() => false)) {
    out.steps.modal.sameNamedPrompt = true;
    await page.getByRole('button', { name: '새로 만들기' }).click();
  }
  await page.waitForFunction((n) => document.querySelectorAll('li button strong').length > n, firstNames.length, { timeout: 180_000 });
  await page.waitForTimeout(500);
  out.steps.modal.namesAfter = await page.locator('li button strong').allInnerTexts();
  out.steps.modal.at = lap();
  await page.screenshot({ path: shot('04b-list-after-modal'), animations: 'disabled' });

  // 05 대화 2턴 (스트리밍: 마지막 말풍선 글자 수를 100ms 마다 기록)
  await page.locator('li button').first().click();
  await page.getByRole('textbox', { name: '메시지' }).waitFor();
  const chatName = await page.locator('header, [data-statusbar-under]').first().innerText().catch(() => '');
  const turns = [];
  for (const msg of ['안녕, 나 미래의 너야. 오늘 하루는 어땠어?', '그때 제일 무서웠던 게 뭐였는지 기억나?']) {
    const before = await page.locator('p').evaluateAll((ps) => ps.length);
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
        return { len: ins.at(-1)?.textContent?.length ?? 0, n: ins.length, typing, busy: !!send && send.disabled && (document.querySelector('textarea, input[aria-label="메시지"]')?.value ?? '') === '' };
      });
      typingSeen ||= s.typing;
      samples.push({ ms: Date.now() - t, ...s });
      if (samples.length > 5 && !s.typing && samples.at(-1).len === samples.at(-4)?.len && samples.at(-1).n > (samples[0].n ?? 0) && Date.now() - t > 1500) {
        // 3번 연속 같은 길이 + 새 말풍선 → 끝난 것으로 본다 (아래에서 응답 완료도 확인)
        const done = await page.evaluate(() => !document.querySelector('p[aria-label="입력 중"]'));
        if (done && samples.at(-1).len === samples.at(-8)?.len) break;
      }
      await page.waitForTimeout(100);
    }
    const lens = [...new Set(samples.map((x) => x.len))];
    turns.push({ sent: msg, typingSeen, distinctLengths: lens.length, lengthsSample: lens.slice(0, 12), finalLen: samples.at(-1).len, ms: samples.at(-1).ms, pBefore: before });
  }
  out.steps.chat = { at: lap(), header: chatName.replace(/\s+/g, ' ').slice(0, 80), turns };
  out.steps.chat.bubbles = await page.locator('p').evaluateAll((ps) =>
    ps.filter((p) => /bubble(In|Out)/.test(p.className)).map((p) => ({ from: /bubbleOut/.test(p.className) ? 'me' : 'persona', text: p.textContent })),
  );
  out.steps.chat.alerts = await page.getByRole('alert').allInnerTexts();
  await page.screenshot({ path: shot('05-chat'), animations: 'disabled' });

  // 프로필 시트
  await page.getByRole('button', { name: '프로필 보기' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.waitFor();
  out.steps.sheet = {
    labelExact이름: await page.getByLabel('이름', { exact: true }).count(),
    region이름: await page.getByRole('region', { name: '이름' }).count(),
    aria: await sheet.ariaSnapshot(),
  };
  await page.screenshot({ path: shot('05b-sheet'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  if (await sheet.isVisible().catch(() => false)) await sheet.getByRole('button', { name: /닫기/ }).first().click();

  // 나가기 → 새로고침 → 복원
  await page.getByRole('button', { name: '나가기' }).click();
  await page.locator('li button').first().waitFor();
  const beforeReload = { names: await page.locator('li button strong').allInnerTexts(), previews: await page.locator('li button strong + span').allInnerTexts() };
  await page.reload({ waitUntil: 'networkidle' });
  const landingNotice = await page.locator('footer[role="status"]').innerText().catch(() => null);
  await page.locator('li button').first().waitFor({ timeout: 10_000 });
  const afterReload = { names: await page.locator('li button strong').allInnerTexts(), previews: await page.locator('li button strong + span').allInnerTexts() };
  await page.locator('li button').first().click();
  await page.getByRole('textbox', { name: '메시지' }).waitFor();
  const restored = await page.locator('p').evaluateAll((ps) => ps.filter((p) => /bubble(In|Out)/.test(p.className)).map((p) => p.textContent));
  out.steps.reload = {
    landingNotice,
    beforeReload,
    afterReload,
    sameList: JSON.stringify(beforeReload) === JSON.stringify(afterReload),
    restoredBubbles: restored.length,
    sameBubbles: JSON.stringify(restored) === JSON.stringify(out.steps.chat.bubbles.map((b) => b.text)),
  };
  await page.screenshot({ path: shot('06-restored'), animations: 'disabled' });

  // 다른 뷰포트 검사에 쓸 상태 (사진 없음, 비밀 없음)
  const state = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mindme:')).map((k) => [k, localStorage.getItem(k)])));
  await writeFile(`${EV}/critic-behavior-r1-state.json`, JSON.stringify(state, null, 2));
  out.stateKeys = Object.keys(state);
} catch (err) {
  out.error = String(err).slice(0, 1000);
  await page.screenshot({ path: shot('zz-error'), animations: 'disabled' }).catch(() => {});
} finally {
  out.totalSec = lap();
  await writeFile(`${EV}/critic-behavior-r1-flow.json`, JSON.stringify(out, null, 2));
  await browser.close();
  console.log(JSON.stringify({ error: out.error, totalSec: out.totalSec, console: out.console.length, pageErrors: out.pageErrors.length, bad: out.badResponses, steps: Object.keys(out.steps) }, null, 1));
}
