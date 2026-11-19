// recheck-behavior-r1: NEW-story-future-leak 2차. 1차에서 만든 17살 페르소나(그대로)로 chat 1회 + 현재 페르소나 1회. 1차 chat 은 OpenAI 과부하 502.
import { chromium } from '/Users/jeongyounglee/work/repo/mindme/node_modules/@playwright/test/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const REPO = '/Users/jeongyounglee/work/repo/mindme';
const EV = `${REPO}/docs/dev-v1/evidence/gate3r2`;
const BASE = 'http://localhost:3100';
const shot = (n) => `${EV}/recheck-behavior-r1-story-${n}.png`;
const first = JSON.parse(readFileSync(`${EV}/recheck-behavior-r1-story.json`, 'utf8'));
const LEAK = /출근|사수|회사|입사|직장|팀장|월급|회식|건배/;
const STORY_ONLY = /옥상|김밥/;
const story = first.setup.profile.story;
const profile = first.setup.profile;
// 1차 스크립트의 사건·기존 페르소나를 그대로 다시 만든다
const ev = (id, title, date, extra) => ({ id, title, date, dateEstimated: false, emotions: ['긴장'], context: '', people: [], summary: '', ...extra });
const events = [
  ev('evt_01', '중학교 졸업식 날', '2012-02-14', { emotions: ['아쉬움', '설렘'], people: ['민지'], summary: '민지와 교복에 낙서하며 사진을 찍고 고등학교에서도 연락하자고 약속했다.' }),
  ev('evt_02', '수능 끝난 날', '2015-11-12', { emotions: ['홀가분함'], people: ['엄마'], summary: '시험장을 나와 엄마와 떡볶이를 먹었다.' }),
  ev('evt_03', '첫 출근에 말 없는 사수 앞에서 긴장한 날', '첫 출근 날', { dateEstimated: true, emotions: ['긴장', '눈치'], people: ['사수'], summary: '첫 출근 날 사수가 말이 없어서 눈치를 많이 봤다.' }),
  ev('evt_04', '팀 회식에서 건배사를 한 날', '2023-12-20', { emotions: ['쑥스러움'], people: ['팀장님'], summary: '연말 팀 회식에서 처음으로 건배사를 했다.' }),
];
const pBase = { kind: 'past', phase: 'after', traits: ['수줍음'], speechStyle: '반말', emotions: ['설렘'] };
const seedPersonas = [
  { ...pBase, id: 'per_seed26', name: '팀 회식에서 건배사를 한 날의 한서윤', age: 26, eventId: 'evt_04', memories: ['연말 회식에서 건배사를 했다'], greeting: '건배사 하고 나니까 얼굴이 아직도 뜨거워.' },
  { ...pBase, id: 'per_seed15', name: '중학교 졸업식 날의 한서윤', age: 15, eventId: 'evt_01', memories: ['민지랑 교복에 낙서했다'], greeting: '졸업식 끝났는데 아직 실감이 안 나.' },
];
const { eventId, ...p17rest } = first.steps.past17.persona;
const past = p17rest; // eventId 없음
const out = { at: new Date().toISOString(), api: [], console: [], pageErrors: [], steps: {} };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(([p, e, ps, pid, greeting]) => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('mindme:')) localStorage.removeItem(k);
  localStorage.setItem('mindme:profile', JSON.stringify(p));
  localStorage.setItem('mindme:events', JSON.stringify(e));
  localStorage.setItem('mindme:personas', JSON.stringify(ps));
}, [profile, events, [past, ...seedPersonas]]);
const page = await ctx.newPage();
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && out.console.push({ type: m.type(), text: m.text().slice(0, 400) }));
page.on('pageerror', (e) => out.pageErrors.push(String(e).slice(0, 400)));
const t0 = new Map();
page.on('request', (r) => {
  if (!r.url().includes('/api/')) return;
  t0.set(r, Date.now());
  const b = r.postDataJSON();
  if (r.url().endsWith('/api/persona')) out.api.push({ url: '/api/persona', req: { kind: b.kind, age: b.age, situation: b.situation, eventId: b.eventId ?? null, eventsCount: b.events?.length, profileHasStory: Boolean(b.profile?.story) } });
  if (r.url().endsWith('/api/chat')) out.api.push({ url: '/api/chat', req: { personaId: b.persona?.id, messages: b.messages } });
});
page.on('response', (r) => r.url().includes('/api/') && out.api.push({ url: r.url().replace(BASE, ''), status: r.status(), headersMs: Date.now() - (t0.get(r.request()) ?? Date.now()), crisis: r.headers()['x-crisis'] ?? null }));
const leakOf = (p) => {
  const text = [p.name, p.speechStyle, ...p.memories, p.greeting, ...p.traits, ...p.emotions].join('\n');
  return { leak: [...new Set(text.match(new RegExp(LEAK, 'g')) ?? [])], storyOnly: [...new Set(text.match(new RegExp(STORY_ONLY, 'g')) ?? [])] };
};
try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('li button').first().waitFor({ timeout: 15_000 });
  // 17살과 대화 (실제 AI)
  await page.locator('li button', { hasText: past.name }).first().click();
  const box = page.getByRole('textbox', { name: '메시지' });
  await box.waitFor();
  await box.fill('요즘 무슨 일 있었어?');
  await page.getByRole('button', { name: '보내기' }).click();
  await page.waitForFunction((id) => { const c = JSON.parse(localStorage.getItem(`mindme:chat:${id}`) ?? '[]'); return c.length >= 3 && c.at(-1).role === 'assistant'; }, past.id, { timeout: 120_000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const chat = await page.evaluate((id) => JSON.parse(localStorage.getItem(`mindme:chat:${id}`) ?? '[]'), past.id);
  const reply = chat.at(-1)?.role === 'assistant' && chat.length >= 3 ? chat.at(-1).content : null;
  out.steps.chat = { persona: past.name, sent: '요즘 무슨 일 있었어?', reply, alerts: await page.getByRole('alert').allInnerTexts(), leak: reply ? [...new Set(reply.match(new RegExp(LEAK, 'g')) ?? [])] : null, storyOnly: reply ? [...new Set(reply.match(new RegExp(STORY_ONLY, 'g')) ?? [])] : null };
  await page.screenshot({ path: shot('past17-chat'), animations: 'disabled' });
  if (!reply) throw new Error('chat 답 없음');
  await page.getByRole('button', { name: '나가기' }).click();
  await page.locator('li button').first().waitFor();

  // 현재 29살 (실제 AI)
  await page.getByRole('button', { name: '페르소나 생성' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await page.locator('#pm-situation').fill('요즘 주말마다 혼자 등산을 다니고 있어요');
  await page.locator('#pm-age').fill('29');
  out.steps.present29Pill = await dialog.locator('output').innerText();
  await page.screenshot({ path: shot('present29-modal'), animations: 'disabled' });
  const t = Date.now();
  await dialog.getByRole('button', { name: '생성하기' }).click();
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem('mindme:personas')) ?? []).length > 3, null, { timeout: 180_000 });
  await page.locator('li button').first().waitFor();
  await page.waitForTimeout(600);
  const made = (await page.evaluate(() => JSON.parse(localStorage.getItem('mindme:personas'))))[0];
  out.steps.present29 = { ms: Date.now() - t, persona: made, check: leakOf(made) };
  out.steps.finalList = await page.locator('li button strong').allInnerTexts();
  await page.screenshot({ path: shot('present29-list'), animations: 'disabled' });
} catch (e) {
  out.error = String(e).slice(0, 800);
  await page.screenshot({ path: shot('error2'), animations: 'disabled' }).catch(() => {});
} finally {
  await browser.close();
}
first.retry = out;
first.verdict = {
  ...first.verdict,
  firstChatAttempt: 'OpenAI 과부하로 502(앱은 "답변을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요." + 다시 받기). 같은 페르소나로 retry 에서 다시 보냄',
  pastChatLeak: out.steps.chat?.leak ?? null,
  pastChatStoryOnly: out.steps.chat?.storyOnly ?? null,
  presentStoryOnlyTerms: out.steps.present29?.check.storyOnly ?? null,
  presentLeakTerms: out.steps.present29?.check.leak ?? null,
};
writeFileSync(`${EV}/recheck-behavior-r1-story.json`, JSON.stringify(first, null, 2) + '\n');
console.log(JSON.stringify({ steps: out.steps, verdict: first.verdict, api: out.api, console: out.console, pageErrors: out.pageErrors, error: out.error }, null, 1));
