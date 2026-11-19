// analysis-5(나이 안내) · persona-chat-2(첫 생성 같은 이름) 브라우저 실측. /api/* 는 page.route 가짜 응답 (AI 호출 없음)
import { chromium } from '/Users/jeongyounglee/work/repo/mindme/node_modules/@playwright/test/index.mjs';
import { writeFile } from 'node:fs/promises';
const { personaName } = await import('/Users/jeongyounglee/work/repo/mindme/packages/core/src/persona/persona.ts');

const BASE = 'http://localhost:3100';
const EV = '/Users/jeongyounglee/work/repo/mindme/docs/dev-v1/evidence/gate3r2';
const out = { at: new Date().toISOString() };
const browser = await chromium.launch();
const VP = {
  390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  1440: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

async function ageNotice(vp) {
  const ctx = await browser.newContext(VP[vp]);
  let calls = 0;
  await ctx.route('**/api/**', (r) => {
    if (!r.request().url().endsWith('/api/analyze')) return r.abort();
    calls++;
    return calls === 1
      ? r.fulfill({ json: { events: [], owner: { name: null, currentAge: null }, meta: { mode: 'direct', chunks: 1, units: 1, participants: [] } } })
      : r.fulfill({ status: 500, json: { error: { code: 'upstream_error', message: '기록을 분석하지 못했어요. 잠시 뒤 다시 시도해 주세요.' } } });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('#pc-story').waitFor({ timeout: 10_000 });
  await page.locator('#pc-story').fill('중학교 때 친구랑 크게 다퉜던 일이 아직도 생각나요.');
  await page.getByRole('button', { name: '페르소나 생성하기' }).click();
  const alert = page.getByRole('alert').filter({ hasText: '나이' });
  await alert.waitFor({ timeout: 10_000 });
  const r = { shownText: await alert.innerText() };
  await page.screenshot({ path: `${EV}/critic-behavior-r1-${vp}-age-notice.png`, animations: 'disabled' });
  await page.getByPlaceholder('32').pressSequentially('2');
  r.afterFirstDigit = await alert.count();
  await page.getByPlaceholder('32').pressSequentially('6');
  r.afterAge = await alert.count();
  await page.screenshot({ path: `${EV}/critic-behavior-r1-${vp}-age-notice-after.png`, animations: 'disabled' });
  // 다시 안내를 띄운 뒤(나이 지움, 같은 입력은 분석 건너뜀) 이야기를 바꿔 다시 만들기 → 실패 → 입력 화면으로: 지난 안내가 없어야 한다
  await page.getByPlaceholder('32').fill('');
  await page.getByRole('button', { name: '페르소나 생성하기' }).click();
  await alert.waitFor({ timeout: 10_000 });
  r.reshown = await alert.count();
  await page.locator('#pc-story').fill('고등학교 때 수능 끝난 날이 기억나요.');
  await page.getByRole('button', { name: '페르소나 생성하기' }).click();
  await page.getByRole('button', { name: '입력 화면으로' }).click();
  await page.locator('#pc-story').waitFor();
  r.afterRetryFail = await alert.count();
  r.analyzeCalls = calls;
  r.errors = errors;
  r.pass = r.afterFirstDigit === 0 && r.afterAge === 0 && r.reshown === 1 && r.afterRetryFail === 0;
  await ctx.close();
  return r;
}

async function sameName() {
  const ctx = await browser.newContext(VP[1440]);
  const ev = (id, title, age, emotions) => ({ id, title, date: `${2026 - 26 + age}-05`, dateEstimated: true, age, emotions, context: '', people: ['민수'], summary: '요약' });
  const events = [ev('evt_01', '민수와 크게 다툼', 15, ['서운함', '분노', '후회']), ev('evt_02', '반장 선거에서 떨어짐', 15, ['창피함', '실망']), ev('evt_03', '전학', 17, ['불안'])];
  const reqs = [];
  await ctx.route('**/api/**', async (r) => {
    const url = r.request().url();
    if (url.endsWith('/api/analyze')) return r.fulfill({ json: { events, owner: { name: '홍길동', currentAge: 26 }, meta: { mode: 'direct', chunks: 1, units: 3, participants: [] } } });
    if (url.endsWith('/api/persona')) {
      const b = r.request().postDataJSON();
      reqs.push({ kind: b.kind, age: b.age, eventId: b.eventId });
      const picked = b.events.find((e) => e.id === b.eventId);
      return r.fulfill({ json: { persona: { id: `per_${reqs.length}`, name: personaName(b.kind, b.age, b.profile.name, picked?.title), kind: b.kind, age: b.age, ...(picked ? { eventId: picked.id, phase: 'after' } : {}), traits: ['고집'], speechStyle: '반말', memories: ['기억'], emotions: ['서운함'], greeting: '왔어?' } } });
    }
    return r.abort();
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('#pc-story').waitFor({ timeout: 10_000 });
  await page.locator('#pc-story').fill('중학교 때 민수랑 다툰 일, 반장 선거에서 떨어진 일, 고등학교 때 전학 간 일이 기억나요.');
  await page.getByPlaceholder('홍길동').fill('홍길동');
  await page.getByPlaceholder('32').fill('26');
  await page.getByRole('button', { name: '페르소나 생성하기' }).click();
  await page.locator('li button').first().waitFor({ timeout: 20_000 });
  const names = await page.locator('li button strong').allInnerTexts();
  await page.screenshot({ path: `${EV}/critic-behavior-r1-samename-list.png`, animations: 'disabled' });
  await ctx.close();
  return { events: events.map((e) => `${e.age}살 ${e.title}`), personaRequests: reqs, names, pass: new Set(names).size === names.length };
}

try {
  out['analysis-5'] = { 390: await ageNotice('390'), 1440: await ageNotice('1440') };
  out['persona-chat-2-e2e'] = await sameName();
} finally {
  await writeFile(`${EV}/critic-behavior-r1-mocked.json`, JSON.stringify(out, null, 2));
  await browser.close();
}
console.log(JSON.stringify(out, null, 1));
